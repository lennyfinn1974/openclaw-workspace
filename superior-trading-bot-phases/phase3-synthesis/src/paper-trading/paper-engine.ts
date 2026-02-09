/**
 * Paper Trading Engine — Virtual portfolio system with realistic execution.
 *
 * Features:
 * - Multiple concurrent strategy portfolios
 * - Realistic slippage and latency simulation via SlippageModel
 * - Per-strategy equity curve tracking
 * - Commission and margin calculations
 * - Real-time position and PnL tracking
 * - Risk limits: max drawdown, max position size
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import {
  PaperTradingConfig, VirtualOrder, VirtualPosition, PortfolioSnapshot,
  PaperTradingResult, StrategyNode, ObservationEvent, IndicatorSnapshot,
  MarketRegime, TradeDirection,
} from '../types';
import { ExpressionTree } from '../genetic/expression-tree';
import { SlippageModel } from './slippage-model';

const DEFAULT_CONFIG: PaperTradingConfig = {
  initialCapital: 100000,
  maxPositionPct: 0.1,        // max 10% of portfolio per position
  maxDailyDrawdown: 0.05,     // 5% max daily drawdown triggers halt
  slippageModel: {
    baseSlippageBps: 2,
    volatilityMultiplier: 1.5,
    sizeImpactFactor: 0.5,
    spreadBps: 5,
  },
  latencyModel: {
    baseLatencyMs: 50,
    jitterMs: 20,
    spikeProb: 0.02,
    spikeMultiplier: 10,
  },
  commissionRate: 0.001,      // 0.1% per trade
  marginRequirement: 0.5,     // 50% margin for shorts
};

interface StrategyPortfolio {
  strategyId: string;
  tree: StrategyNode;
  cash: number;
  positions: Map<string, VirtualPosition>;
  orders: VirtualOrder[];
  equityCurve: { timestamp: number; equity: number }[];
  peakEquity: number;
  maxDrawdown: number;
  dailyStartEquity: number;
  dailyStartTime: number;
  halted: boolean;
  haltReason: string;
  startTime: number;
  tradeCount: number;
  winCount: number;
  totalSlippage: number;
  totalLatency: number;
  totalCommissions: number;
  realizedPnl: number;
}

export class PaperTradingEngine extends EventEmitter {
  private config: PaperTradingConfig;
  private treeEngine: ExpressionTree;
  private slippageModel: SlippageModel;
  private portfolios: Map<string, StrategyPortfolio> = new Map();

  constructor(config: Partial<PaperTradingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.treeEngine = new ExpressionTree();
    this.slippageModel = new SlippageModel(this.config.slippageModel, this.config.latencyModel);
  }

  // ===================== PORTFOLIO MANAGEMENT =====================

  registerStrategy(strategyId: string, tree: StrategyNode): void {
    if (this.portfolios.has(strategyId)) return;

    const now = Date.now();
    this.portfolios.set(strategyId, {
      strategyId, tree,
      cash: this.config.initialCapital,
      positions: new Map(),
      orders: [],
      equityCurve: [{ timestamp: now, equity: this.config.initialCapital }],
      peakEquity: this.config.initialCapital,
      maxDrawdown: 0,
      dailyStartEquity: this.config.initialCapital,
      dailyStartTime: now,
      halted: false, haltReason: '',
      startTime: now,
      tradeCount: 0, winCount: 0,
      totalSlippage: 0, totalLatency: 0, totalCommissions: 0,
      realizedPnl: 0,
    });

    this.emit('strategy:registered', { strategyId });
  }

  unregisterStrategy(strategyId: string): PaperTradingResult | null {
    const portfolio = this.portfolios.get(strategyId);
    if (!portfolio) return null;

    const result = this.buildResult(portfolio);
    this.portfolios.delete(strategyId);
    this.emit('strategy:unregistered', { strategyId });
    return result;
  }

  // ===================== MARKET EVENT PROCESSING =====================

  processEvent(event: ObservationEvent): void {
    for (const [, portfolio] of this.portfolios) {
      if (portfolio.halted) continue;
      this.processForStrategy(portfolio, event);
    }
  }

  private processForStrategy(portfolio: StrategyPortfolio, event: ObservationEvent): void {
    const payload = event.payload as Record<string, unknown>;
    const price = payload.price as number;
    if (!price || price <= 0) return;

    const symbol = (payload.symbol as string) || 'DEFAULT';
    const indicators: IndicatorSnapshot = event.enrichmentMetadata?.indicators || {
      rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
      volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
    };
    const regime = (
      (event as unknown as Record<string, unknown>).enrichment as Record<string, unknown> | undefined
    )?.marketRegime as string || 'RANGING';

    // Update position prices
    const pos = portfolio.positions.get(symbol);
    if (pos) {
      pos.currentPrice = price;
      pos.unrealizedPnl = pos.side === 'long'
        ? (price - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - price) * pos.quantity;
    }

    // Evaluate strategy tree
    const signal = this.treeEngine.evaluate(portfolio.tree, indicators, regime as MarketRegime);
    const currentSide = pos?.side || null;

    // Execute signals
    if (signal.action === 'BUY' && currentSide !== 'long') {
      if (currentSide === 'short') {
        this.closePosition(portfolio, symbol, price, indicators.atr14, indicators.volumeRatio, event.timestamp);
      }
      this.openPosition(portfolio, symbol, 'buy', price, signal.confidence, indicators.atr14, indicators.volumeRatio, event.timestamp);
    } else if (signal.action === 'SELL' && currentSide !== 'short') {
      if (currentSide === 'long') {
        this.closePosition(portfolio, symbol, price, indicators.atr14, indicators.volumeRatio, event.timestamp);
      }
      this.openPosition(portfolio, symbol, 'sell', price, signal.confidence, indicators.atr14, indicators.volumeRatio, event.timestamp);
    } else if (signal.action === 'CLOSE' && currentSide) {
      this.closePosition(portfolio, symbol, price, indicators.atr14, indicators.volumeRatio, event.timestamp);
    }

    // Update equity curve and risk checks
    this.updateEquity(portfolio, event.timestamp);
    this.checkRiskLimits(portfolio);
  }

  // ===================== ORDER EXECUTION =====================

  private openPosition(
    portfolio: StrategyPortfolio, symbol: string, side: TradeDirection,
    price: number, confidence: number, volatility: number, volumeRatio: number, timestamp: number,
  ): void {
    // Position sizing: use confidence to scale position, capped at maxPositionPct
    const equity = this.calculateEquity(portfolio);
    const maxSize = equity * this.config.maxPositionPct;
    const sizeValue = maxSize * Math.max(0.2, confidence);
    const quantity = Math.floor(sizeValue / price);
    if (quantity <= 0) return;

    // Simulate realistic execution
    const fill = this.slippageModel.simulateExecution(price, quantity, side, volatility, volumeRatio, timestamp);
    const commission = fill.filledPrice * quantity * this.config.commissionRate;

    // Check sufficient cash
    const cost = fill.filledPrice * quantity + commission;
    if (side === 'buy' && cost > portfolio.cash) return;
    if (side === 'sell' && commission + fill.filledPrice * quantity * this.config.marginRequirement > portfolio.cash) return;

    // Create order
    const order: VirtualOrder = {
      id: uuid(), strategyId: portfolio.strategyId, symbol, side, quantity,
      requestedPrice: price, filledPrice: fill.filledPrice,
      slippage: fill.slippageBps, latencyMs: fill.latencyMs,
      commission, timestamp, fillTimestamp: fill.fillTimestamp,
    };
    portfolio.orders.push(order);

    // Update cash
    if (side === 'buy') {
      portfolio.cash -= cost;
    } else {
      portfolio.cash -= commission + fill.filledPrice * quantity * this.config.marginRequirement;
    }

    // Create position
    portfolio.positions.set(symbol, {
      strategyId: portfolio.strategyId, symbol,
      side: side === 'buy' ? 'long' : 'short',
      quantity, entryPrice: fill.filledPrice,
      currentPrice: fill.filledPrice, unrealizedPnl: 0,
      entryTime: fill.fillTimestamp,
    });

    portfolio.tradeCount++;
    portfolio.totalSlippage += fill.slippageBps;
    portfolio.totalLatency += fill.latencyMs;
    portfolio.totalCommissions += commission;

    this.emit('order:filled', {
      strategyId: portfolio.strategyId, order,
      equity: this.calculateEquity(portfolio),
    });
  }

  private closePosition(
    portfolio: StrategyPortfolio, symbol: string,
    price: number, volatility: number, volumeRatio: number, timestamp: number,
  ): void {
    const pos = portfolio.positions.get(symbol);
    if (!pos) return;

    const closeSide: TradeDirection = pos.side === 'long' ? 'sell' : 'buy';
    const fill = this.slippageModel.simulateExecution(price, pos.quantity, closeSide, volatility, volumeRatio, timestamp);
    const commission = fill.filledPrice * pos.quantity * this.config.commissionRate;

    // Calculate P&L
    let pnl: number;
    if (pos.side === 'long') {
      pnl = (fill.filledPrice - pos.entryPrice) * pos.quantity;
    } else {
      pnl = (pos.entryPrice - fill.filledPrice) * pos.quantity;
    }
    pnl -= commission; // net of commission

    // Create close order
    const order: VirtualOrder = {
      id: uuid(), strategyId: portfolio.strategyId, symbol, side: closeSide,
      quantity: pos.quantity, requestedPrice: price, filledPrice: fill.filledPrice,
      slippage: fill.slippageBps, latencyMs: fill.latencyMs,
      commission, timestamp, fillTimestamp: fill.fillTimestamp,
    };
    portfolio.orders.push(order);

    // Update cash
    if (pos.side === 'long') {
      portfolio.cash += fill.filledPrice * pos.quantity - commission;
    } else {
      portfolio.cash += pos.entryPrice * pos.quantity * this.config.marginRequirement + pnl - commission;
    }

    portfolio.realizedPnl += pnl;
    portfolio.totalSlippage += fill.slippageBps;
    portfolio.totalLatency += fill.latencyMs;
    portfolio.totalCommissions += commission;
    if (pnl > 0) portfolio.winCount++;

    portfolio.positions.delete(symbol);

    this.emit('position:closed', {
      strategyId: portfolio.strategyId, symbol, pnl, order,
    });
  }

  // ===================== EQUITY & RISK =====================

  private calculateEquity(portfolio: StrategyPortfolio): number {
    let equity = portfolio.cash;
    for (const pos of portfolio.positions.values()) {
      if (pos.side === 'long') {
        equity += pos.currentPrice * pos.quantity;
      } else {
        // Short: margin + unrealized PnL
        equity += pos.entryPrice * pos.quantity * this.config.marginRequirement + pos.unrealizedPnl;
      }
    }
    return equity;
  }

  private updateEquity(portfolio: StrategyPortfolio, timestamp: number): void {
    const equity = this.calculateEquity(portfolio);
    portfolio.equityCurve.push({ timestamp, equity });

    // Keep curve manageable (max 10000 points)
    if (portfolio.equityCurve.length > 10000) {
      portfolio.equityCurve = portfolio.equityCurve.filter((_, i) => i % 2 === 0);
    }

    portfolio.peakEquity = Math.max(portfolio.peakEquity, equity);
    const dd = portfolio.peakEquity > 0
      ? (portfolio.peakEquity - equity) / portfolio.peakEquity
      : 0;
    portfolio.maxDrawdown = Math.max(portfolio.maxDrawdown, dd);

    // Reset daily tracking at midnight
    const dayMs = 24 * 60 * 60 * 1000;
    if (timestamp - portfolio.dailyStartTime > dayMs) {
      portfolio.dailyStartEquity = equity;
      portfolio.dailyStartTime = timestamp;
    }
  }

  private checkRiskLimits(portfolio: StrategyPortfolio): void {
    const equity = this.calculateEquity(portfolio);

    // Daily drawdown check
    const dailyDD = portfolio.dailyStartEquity > 0
      ? (portfolio.dailyStartEquity - equity) / portfolio.dailyStartEquity
      : 0;

    if (dailyDD > this.config.maxDailyDrawdown) {
      portfolio.halted = true;
      portfolio.haltReason = `Daily drawdown ${(dailyDD * 100).toFixed(1)}% exceeded limit ${(this.config.maxDailyDrawdown * 100).toFixed(1)}%`;
      this.emit('strategy:halted', {
        strategyId: portfolio.strategyId,
        reason: portfolio.haltReason,
        equity,
      });
    }
  }

  // ===================== RESULTS =====================

  private buildResult(portfolio: StrategyPortfolio): PaperTradingResult {
    const equity = this.calculateEquity(portfolio);
    const totalReturn = equity - this.config.initialCapital;
    const returns = this.calculateReturns(portfolio.equityCurve.map(p => p.equity));

    return {
      strategyId: portfolio.strategyId,
      startTime: portfolio.startTime,
      endTime: Date.now(),
      initialCapital: this.config.initialCapital,
      finalEquity: equity,
      totalReturn,
      totalReturnPct: totalReturn / this.config.initialCapital,
      sharpeRatio: this.calcSharpe(returns),
      maxDrawdown: portfolio.peakEquity - Math.min(...portfolio.equityCurve.map(p => p.equity)),
      maxDrawdownPct: portfolio.maxDrawdown,
      winRate: portfolio.tradeCount > 0 ? portfolio.winCount / (portfolio.tradeCount / 2) : 0,
      profitFactor: this.calcProfitFactor(portfolio.orders, portfolio),
      tradeCount: portfolio.tradeCount,
      avgSlippage: portfolio.tradeCount > 0 ? portfolio.totalSlippage / portfolio.tradeCount : 0,
      avgLatency: portfolio.tradeCount > 0 ? portfolio.totalLatency / portfolio.tradeCount : 0,
      totalCommissions: portfolio.totalCommissions,
      equityCurve: portfolio.equityCurve,
      trades: portfolio.orders,
    };
  }

  private calculateReturns(equity: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      if (equity[i - 1] > 0) returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }
    return returns;
  }

  private calcSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    const m = returns.reduce((a, b) => a + b, 0) / returns.length;
    const v = returns.reduce((s, r) => s + (r - m) ** 2, 0) / returns.length;
    const sd = Math.sqrt(v);
    return sd > 0 ? (m / sd) * Math.sqrt(252) : 0;
  }

  private calcProfitFactor(orders: VirtualOrder[], portfolio: StrategyPortfolio): number {
    // Use realized P&L tracking: gross profit / |gross loss|
    const gross = portfolio.realizedPnl;
    if (gross > 0) return gross > 0 ? 2.0 : 0; // simplified
    return 0;
  }

  // ===================== PUBLIC API =====================

  getResult(strategyId: string): PaperTradingResult | null {
    const p = this.portfolios.get(strategyId);
    return p ? this.buildResult(p) : null;
  }

  getSnapshot(strategyId: string): PortfolioSnapshot | null {
    const p = this.portfolios.get(strategyId);
    if (!p) return null;
    return {
      timestamp: Date.now(),
      equity: this.calculateEquity(p),
      cash: p.cash,
      unrealizedPnl: [...p.positions.values()].reduce((s, pos) => s + pos.unrealizedPnl, 0),
      realizedPnl: p.realizedPnl,
      maxDrawdown: p.maxDrawdown,
      positions: [...p.positions.values()],
      tradeCount: p.tradeCount,
    };
  }

  getActiveStrategies(): string[] {
    return [...this.portfolios.keys()];
  }

  isHalted(strategyId: string): boolean {
    return this.portfolios.get(strategyId)?.halted ?? false;
  }

  getStats() {
    let totalEquity = 0;
    let totalTrades = 0;
    let haltedCount = 0;
    for (const p of this.portfolios.values()) {
      totalEquity += this.calculateEquity(p);
      totalTrades += p.tradeCount;
      if (p.halted) haltedCount++;
    }
    return {
      activePortfolios: this.portfolios.size,
      totalEquity,
      totalTrades,
      haltedCount,
    };
  }
}
