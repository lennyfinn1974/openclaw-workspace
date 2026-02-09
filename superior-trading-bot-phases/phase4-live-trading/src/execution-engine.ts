/**
 * Execution Engine — Core Phase 4 Module
 *
 * Order lifecycle pipeline:
 * 1. SIZING — CapitalAllocator determines quantity via Kelly fraction (capped at 2%)
 * 2. SLIPPAGE MODEL — estimate fill price: base 2bps + spread/2, capped at 10bps
 * 3. RISK CHECK — RiskGovernor.evaluateTrade() → VETO or APPROVE
 * 4. EXECUTE — paper mode: instant synthetic fill; live mode: POST /api/orders
 * 5. TRACK — record fill, compute actual slippage
 * 6. RECORD — feed outcome to CapitalAllocator (updates Beta distribution)
 *
 * Safety: paper trading default, kill switch (3 consecutive losses or 8% drawdown)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  TradingMode, TradeProposal, ExecutionOrder, FillReport, Position,
  KillSwitchState, TradeOutcome, TradeDirection
} from './types';
import { ArenaConnector } from './arena-connector';
import { MarketDataCache } from './market-data-cache';
import { CapitalAllocator } from './capital-allocator';
import { RiskGovernor } from './risk-governor';

// ===================== EXECUTION ENGINE =====================

export class ExecutionEngine extends EventEmitter {
  private mode: TradingMode;
  private arena: ArenaConnector;
  private marketData: MarketDataCache;
  private allocator: CapitalAllocator;
  private riskGovernor: RiskGovernor;

  // Position tracking
  private positions: Map<string, Position> = new Map();  // symbol → Position
  private trades: FillReport[] = [];

  // Kill switch
  private killSwitch: KillSwitchState = {
    active: false,
    reason: null,
    triggeredAt: null,
    consecutiveLosses: 0,
    drawdownPercent: 0,
  };

  private killSwitchMaxLosses: number;
  private killSwitchMaxDrawdown: number;

  // Stats
  private totalPnL = 0;
  private initialCapital: number;

  constructor(config: {
    mode?: TradingMode;
    arena: ArenaConnector;
    marketData: MarketDataCache;
    allocator: CapitalAllocator;
    riskGovernor: RiskGovernor;
    initialCapital?: number;
    killSwitchConsecutiveLosses?: number;
    killSwitchDrawdownPercent?: number;
  }) {
    super();
    this.mode = config.mode || 'paper';
    this.arena = config.arena;
    this.marketData = config.marketData;
    this.allocator = config.allocator;
    this.riskGovernor = config.riskGovernor;
    this.initialCapital = config.initialCapital || 5000;
    this.killSwitchMaxLosses = config.killSwitchConsecutiveLosses || 3;
    this.killSwitchMaxDrawdown = config.killSwitchDrawdownPercent || 0.08;
  }

  // ===================== ORDER LIFECYCLE =====================

  async executeProposal(proposal: TradeProposal): Promise<ExecutionOrder> {
    const order: ExecutionOrder = {
      id: uuidv4(),
      timestamp: Date.now(),
      proposal,
      lifecycleState: 'sizing',
      mode: this.mode,
      quantity: 0,
      estimatedFillPrice: 0,
      estimatedSlippageBps: 0,
      riskAmount: 0,
      riskPercent: 0,
      riskApproved: false,
    };

    // Check kill switch
    if (this.killSwitch.active) {
      order.lifecycleState = 'rejected';
      order.vetoReason = `Kill switch active: ${this.killSwitch.reason}`;
      console.log(`[EXEC] REJECTED: Kill switch active — ${this.killSwitch.reason}`);
      this.emit('order:rejected', order);
      return order;
    }

    // Step 1: SIZING
    const totalCapital = this.allocator.getTotalCapital();
    const arm = this.allocator.getArm(proposal.signal.strategyId);
    const allocation = arm?.currentAllocation || (1 / 6); // equal weight fallback
    const kellyFraction = arm?.kellyFraction || 0.01;

    // Position size = capital * allocation * kelly, capped at 2% of total capital
    const maxPositionValue = totalCapital * 0.02;
    const kellyPositionValue = totalCapital * allocation * Math.min(kellyFraction, 0.25);
    const positionValue = Math.min(kellyPositionValue || maxPositionValue * 0.5, maxPositionValue);
    const price = proposal.estimatedPrice;
    order.quantity = Math.max(1, Math.floor(positionValue / price));

    // Step 2: SLIPPAGE MODEL
    order.lifecycleState = 'slippage_estimate';
    const spreadBps = this.marketData.getSpread(proposal.signal.symbol) || 2;
    const baseSlippageBps = 2; // 2bps base
    order.estimatedSlippageBps = Math.min(baseSlippageBps + spreadBps / 2, 10); // cap at 10bps
    const slippageMultiplier = 1 + (order.estimatedSlippageBps / 10000) *
      (proposal.signal.direction === 'buy' ? 1 : -1);
    order.estimatedFillPrice = price * slippageMultiplier;

    // Step 3: RISK CHECK
    order.lifecycleState = 'risk_check';
    order.riskAmount = order.quantity * order.estimatedFillPrice * 0.02; // 2% stop-loss assumption
    order.riskPercent = totalCapital > 0 ? order.riskAmount / totalCapital : 1;

    const veto = this.riskGovernor.evaluateTrade({
      strategyId: proposal.signal.strategyId,
      symbol: proposal.signal.symbol,
      direction: proposal.signal.direction,
      size: order.quantity,
      riskAmount: order.riskAmount,
    });

    if (veto) {
      order.lifecycleState = 'vetoed';
      order.riskApproved = false;
      order.vetoReason = veto.reason;
      console.log(`[RISK] VETO: ${veto.severity} — ${veto.reason}`);
      this.emit('order:vetoed', order, veto);
      this.emit('risk:veto', veto);
      return order;
    }

    order.riskApproved = true;

    // Step 4: EXECUTE
    order.lifecycleState = 'executing';

    if (this.mode === 'paper') {
      // Paper mode: instant synthetic fill
      order.fillPrice = order.estimatedFillPrice;
      order.fillTimestamp = Date.now();
      order.actualSlippageBps = order.estimatedSlippageBps;
      order.lifecycleState = 'filled';

      const fill = this.buildFillReport(order);
      console.log(
        `[EXEC] PAPER FILL: ${proposal.signal.direction.toUpperCase()} ` +
        `${order.quantity} ${proposal.signal.symbol} @ $${order.fillPrice!.toFixed(2)} ` +
        `(slippage: ${order.actualSlippageBps!.toFixed(1)}bps)`
      );
      this.processFill(fill, order);
    } else {
      // Live mode: submit to Arena
      try {
        const result = await this.arena.placeOrder({
          symbol: proposal.signal.symbol,
          side: proposal.signal.direction,
          quantity: order.quantity,
          price: price,
        });

        if (result.success && result.fillPrice) {
          order.fillPrice = result.fillPrice;
          order.fillTimestamp = Date.now();
          order.actualSlippageBps = Math.abs(
            (result.fillPrice - price) / price * 10000
          );
          order.lifecycleState = 'filled';

          const fill = this.buildFillReport(order);
          console.log(
            `[EXEC] LIVE FILL: ${proposal.signal.direction.toUpperCase()} ` +
            `${order.quantity} ${proposal.signal.symbol} @ $${result.fillPrice.toFixed(2)} ` +
            `(slippage: ${order.actualSlippageBps.toFixed(1)}bps)`
          );
          this.processFill(fill, order);
        } else {
          order.lifecycleState = 'rejected';
          order.vetoReason = result.error || 'Order rejected by arena';
          console.log(`[EXEC] LIVE REJECTED: ${order.vetoReason}`);
          this.emit('order:rejected', order);
        }
      } catch (err: any) {
        order.lifecycleState = 'rejected';
        order.vetoReason = `Execution error: ${err.message}`;
        console.log(`[EXEC] ERROR: ${err.message}`);
        this.emit('order:rejected', order);
      }
    }

    return order;
  }

  // ===================== FILL PROCESSING =====================

  private buildFillReport(order: ExecutionOrder): FillReport {
    return {
      orderId: order.id,
      timestamp: order.fillTimestamp!,
      symbol: order.proposal.signal.symbol,
      direction: order.proposal.signal.direction,
      quantity: order.quantity,
      fillPrice: order.fillPrice!,
      estimatedPrice: order.proposal.estimatedPrice,
      slippageBps: order.actualSlippageBps!,
      mode: order.mode,
      strategyId: order.proposal.signal.strategyId,
      value: order.quantity * order.fillPrice!,
    };
  }

  private processFill(fill: FillReport, order: ExecutionOrder): void {
    this.trades.push(fill);
    if (this.trades.length > 5000) this.trades.shift();

    // Update or create position
    const existing = this.positions.get(fill.symbol);

    if (existing && existing.direction !== fill.direction) {
      // Closing trade — compute P&L
      const closingQty = Math.min(existing.quantity, fill.quantity);
      const entryValue = closingQty * existing.avgEntryPrice;
      const exitValue = closingQty * fill.fillPrice;

      let pnl: number;
      if (existing.direction === 'buy') {
        pnl = exitValue - entryValue;
      } else {
        pnl = entryValue - exitValue;
      }

      fill.pnl = pnl;
      this.totalPnL += pnl;

      // Record outcome in allocator
      const outcome: TradeOutcome = {
        pnl,
        pnlPercentage: entryValue > 0 ? pnl / entryValue : 0,
        holdingPeriodMinutes: (Date.now() - existing.openedAt) / 60000,
        maxAdverseExcursion: 0,
        maxFavorableExcursion: 0,
        isWinner: pnl > 0,
      };
      this.allocator.recordOutcome(fill.strategyId, outcome);

      // Update equity in risk governor
      const equity = this.initialCapital + this.totalPnL;
      this.riskGovernor.updateEquity(equity);
      this.allocator.setTotalCapital(equity);

      // Kill switch check
      this.updateKillSwitch(pnl, equity);

      // Remove or reduce position
      const remaining = existing.quantity - closingQty;
      if (remaining <= 0) {
        this.positions.delete(fill.symbol);
      } else {
        existing.quantity = remaining;
        this.positions.set(fill.symbol, existing);
      }

      this.riskGovernor.setOpenPositions(this.positions.size);
      console.log(
        `[EXEC] CLOSED: ${fill.symbol} P&L: $${pnl.toFixed(2)} ` +
        `(total: $${this.totalPnL.toFixed(2)})`
      );
    } else if (existing && existing.direction === fill.direction) {
      // Adding to position
      const totalQty = existing.quantity + fill.quantity;
      existing.avgEntryPrice = (
        (existing.avgEntryPrice * existing.quantity) +
        (fill.fillPrice * fill.quantity)
      ) / totalQty;
      existing.quantity = totalQty;
      existing.currentPrice = fill.fillPrice;
      this.positions.set(fill.symbol, existing);
    } else {
      // New position
      const pos: Position = {
        symbol: fill.symbol,
        direction: fill.direction,
        quantity: fill.quantity,
        avgEntryPrice: fill.fillPrice,
        currentPrice: fill.fillPrice,
        unrealizedPnL: 0,
        strategyId: fill.strategyId,
        openedAt: Date.now(),
      };
      this.positions.set(fill.symbol, pos);
      this.riskGovernor.setOpenPositions(this.positions.size);
    }

    this.emit('trade:executed', fill);
  }

  // ===================== KILL SWITCH =====================

  private updateKillSwitch(pnl: number, equity: number): void {
    if (pnl <= 0) {
      this.killSwitch.consecutiveLosses++;
    } else {
      this.killSwitch.consecutiveLosses = 0;
    }

    const drawdown = this.initialCapital > 0 ?
      (this.initialCapital - equity) / this.initialCapital : 0;
    this.killSwitch.drawdownPercent = Math.max(0, drawdown);

    // Check triggers
    if (this.killSwitch.consecutiveLosses >= this.killSwitchMaxLosses) {
      this.tripKillSwitch(
        `${this.killSwitch.consecutiveLosses} consecutive losses`
      );
    }

    if (this.killSwitch.drawdownPercent >= this.killSwitchMaxDrawdown) {
      this.tripKillSwitch(
        `Drawdown ${(this.killSwitch.drawdownPercent * 100).toFixed(1)}% ` +
        `exceeds ${(this.killSwitchMaxDrawdown * 100).toFixed(1)}% limit`
      );
    }
  }

  private tripKillSwitch(reason: string): void {
    if (this.killSwitch.active) return; // Already tripped
    this.killSwitch.active = true;
    this.killSwitch.reason = reason;
    this.killSwitch.triggeredAt = Date.now();
    console.log(`[KILL SWITCH] ACTIVATED: ${reason}`);
    this.emit('kill-switch:tripped', this.killSwitch);
  }

  resetKillSwitch(): void {
    this.killSwitch = {
      active: false,
      reason: null,
      triggeredAt: null,
      consecutiveLosses: 0,
      drawdownPercent: this.killSwitch.drawdownPercent, // preserve current drawdown
    };
    console.log('[KILL SWITCH] Reset manually');
    this.emit('kill-switch:reset');
  }

  // ===================== POSITION UPDATES =====================

  updatePositionPrices(): void {
    for (const [symbol, pos] of this.positions) {
      const price = this.marketData.getPrice(symbol);
      if (price !== null) {
        pos.currentPrice = price;
        if (pos.direction === 'buy') {
          pos.unrealizedPnL = (price - pos.avgEntryPrice) * pos.quantity;
        } else {
          pos.unrealizedPnL = (pos.avgEntryPrice - price) * pos.quantity;
        }
        this.positions.set(symbol, pos);
      }
    }

    // Update total exposure
    let totalExposure = 0;
    for (const pos of this.positions.values()) {
      totalExposure += pos.currentPrice * pos.quantity;
    }
    this.riskGovernor.setTotalExposure(totalExposure);
  }

  // ===================== MODE =====================

  setMode(mode: TradingMode): void {
    const oldMode = this.mode;
    this.mode = mode;
    console.log(`[EXEC] Mode changed: ${oldMode} → ${mode}`);
    this.emit('mode:changed', { from: oldMode, to: mode });
  }

  // ===================== GETTERS =====================

  getMode(): TradingMode { return this.mode; }
  getPositions(): Position[] { return Array.from(this.positions.values()); }
  getPosition(symbol: string): Position | undefined { return this.positions.get(symbol); }
  getTrades(): FillReport[] { return this.trades; }
  getRecentTrades(limit: number = 50): FillReport[] { return this.trades.slice(-limit); }
  getTotalPnL(): number { return this.totalPnL; }
  getKillSwitchState(): KillSwitchState { return { ...this.killSwitch }; }
  getEquity(): number { return this.initialCapital + this.totalPnL + this.getUnrealizedPnL(); }
  getOpenPositionCount(): number { return this.positions.size; }

  getUnrealizedPnL(): number {
    let total = 0;
    for (const pos of this.positions.values()) {
      total += pos.unrealizedPnL;
    }
    return total;
  }
}
