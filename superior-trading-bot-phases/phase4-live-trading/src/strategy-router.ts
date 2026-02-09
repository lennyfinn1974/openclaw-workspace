/**
 * Strategy Router — Signal Generation
 *
 * 6 built-in strategies (matching L5 arms):
 * - momentum — buy on positive price momentum across recent quotes
 * - mean-reversion — buy when price below recent average
 * - trend-follow — follow arena bot consensus direction
 * - volatility-arb — trade on regime transitions
 * - ict-smart-money — follow top-ranked arena bots
 * - regime-adaptive — switch approach based on market regime
 *
 * Evaluates every 15s, emits TradeProposal events.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  StrategySignal, TradeProposal, TradeDirection, MarketRegime, BotSummary
} from './types';
import { MarketDataCache } from './market-data-cache';
import { CapitalAllocator } from './capital-allocator';

interface BotTradeInfo {
  botId: string;
  symbol: string;
  direction: TradeDirection;
  price: number;
  timestamp: number;
  rank?: number;
}

// ===================== STRATEGY ROUTER =====================

export class StrategyRouter extends EventEmitter {
  private marketData: MarketDataCache;
  private allocator: CapitalAllocator;
  private signalIntervalMs: number;
  private signalTimer: ReturnType<typeof setInterval> | null = null;
  private currentRegime: MarketRegime = 'QUIET';
  private recentBotTrades: BotTradeInfo[] = [];
  private botRankings: Map<string, number> = new Map();
  private lastRegime: MarketRegime = 'QUIET';
  private signalCount = 0;

  constructor(config: {
    marketData: MarketDataCache;
    allocator: CapitalAllocator;
    signalIntervalMs?: number;
  }) {
    super();
    this.marketData = config.marketData;
    this.allocator = config.allocator;
    this.signalIntervalMs = config.signalIntervalMs || 15000;
  }

  // ===================== LIFECYCLE =====================

  start(): void {
    this.signalTimer = setInterval(() => {
      this.evaluate();
    }, this.signalIntervalMs);
    console.log(`[STRATEGY] Router started (interval: ${this.signalIntervalMs / 1000}s)`);
    this.emit('started');
  }

  stop(): void {
    if (this.signalTimer) {
      clearInterval(this.signalTimer);
      this.signalTimer = null;
    }
    this.emit('stopped');
  }

  // ===================== EXTERNAL INPUTS =====================

  onBotTrade(trade: BotTradeInfo): void {
    this.recentBotTrades.push(trade);
    // Keep last 200 trades
    if (this.recentBotTrades.length > 200) {
      this.recentBotTrades.shift();
    }
  }

  onLeaderboardUpdate(bots: BotSummary[]): void {
    this.botRankings.clear();
    for (const bot of bots) {
      this.botRankings.set(bot.botId, bot.rank);
    }
  }

  setRegime(regime: MarketRegime): void {
    this.lastRegime = this.currentRegime;
    this.currentRegime = regime;
  }

  // ===================== EVALUATION =====================

  private evaluate(): void {
    const symbols = this.marketData.getActiveSymbols();
    if (symbols.length === 0) return;

    const signals: StrategySignal[] = [];

    for (const symbol of symbols) {
      const price = this.marketData.getPrice(symbol);
      if (price === null) continue;

      // Run all 6 strategies
      const momentumSig = this.momentumStrategy(symbol, price);
      if (momentumSig) signals.push(momentumSig);

      const meanRevSig = this.meanReversionStrategy(symbol, price);
      if (meanRevSig) signals.push(meanRevSig);

      const trendSig = this.trendFollowStrategy(symbol, price);
      if (trendSig) signals.push(trendSig);

      const volSig = this.volatilityArbStrategy(symbol, price);
      if (volSig) signals.push(volSig);

      const ictSig = this.ictSmartMoneyStrategy(symbol, price);
      if (ictSig) signals.push(ictSig);

      const regimeSig = this.regimeAdaptiveStrategy(symbol, price);
      if (regimeSig) signals.push(regimeSig);
    }

    // Filter out any NaN strength signals and pick the best
    const validSignals = signals.filter(s => isFinite(s.strength) && s.strength > 0);
    if (validSignals.length > 0) {
      validSignals.sort((a, b) => b.strength - a.strength);
      const best = validSignals[0];

      console.log(
        `[STRATEGY] Signal: ${best.strategyName} ` +
        `${best.direction.toUpperCase()} ${best.symbol} ` +
        `strength=${best.strength.toFixed(2)}`
      );

      const proposal = this.buildProposal(best);
      this.emit('proposal', proposal);
    }
  }

  // ===================== STRATEGIES =====================

  private momentumStrategy(symbol: string, price: number): StrategySignal | null {
    const history = this.marketData.getPriceHistory(symbol, 20);
    if (history.length < 5) return null; // Need minimum data

    const momentum = this.marketData.getMomentum(symbol, 20);
    if (momentum === null || !isFinite(momentum)) return null;

    const threshold = 0.002; // 0.2% price move
    if (Math.abs(momentum) < threshold) return null;

    const direction: TradeDirection = momentum > 0 ? 'buy' : 'sell';
    const strength = Math.min(1, Math.abs(momentum) / 0.01); // normalize to 1% max

    if (!isFinite(strength) || strength < 0.3) return null;

    return this.buildSignal('momentum', 'Momentum Breakout', symbol, direction, strength,
      `Price momentum ${(momentum * 100).toFixed(2)}% over 20 periods`);
  }

  private meanReversionStrategy(symbol: string, price: number): StrategySignal | null {
    const history = this.marketData.getPriceHistory(symbol, 30);
    if (history.length < 5) return null;

    const avgPrice = this.marketData.getAveragePrice(symbol, 30);
    if (avgPrice === null || avgPrice === 0) return null;

    const deviation = (price - avgPrice) / avgPrice;
    if (!isFinite(deviation)) return null;
    const threshold = 0.003; // 0.3% deviation
    if (Math.abs(deviation) < threshold) return null;

    // Buy when below average, sell when above
    const direction: TradeDirection = deviation < 0 ? 'buy' : 'sell';
    const strength = Math.min(1, Math.abs(deviation) / 0.01);

    if (!isFinite(strength) || strength < 0.3) return null;

    return this.buildSignal('mean-reversion', 'Mean Reversion', symbol, direction, strength,
      `Price deviation ${(deviation * 100).toFixed(2)}% from 30-period average`);
  }

  private trendFollowStrategy(symbol: string, price: number): StrategySignal | null {
    // Follow arena bot consensus direction
    const recentTrades = this.recentBotTrades
      .filter(t => t.symbol === symbol && Date.now() - t.timestamp < 60000);

    if (recentTrades.length < 3) return null;

    const buyCount = recentTrades.filter(t => t.direction === 'buy').length;
    const sellCount = recentTrades.filter(t => t.direction === 'sell').length;
    const total = buyCount + sellCount;

    const buyRatio = buyCount / total;
    if (Math.abs(buyRatio - 0.5) < 0.15) return null; // No clear consensus

    const direction: TradeDirection = buyRatio > 0.5 ? 'buy' : 'sell';
    const strength = Math.abs(buyRatio - 0.5) * 2; // 0-1

    if (strength < 0.3) return null;

    return this.buildSignal('trend-follow', 'Trend Following', symbol, direction, strength,
      `Bot consensus: ${buyCount} buy / ${sellCount} sell (${(buyRatio * 100).toFixed(0)}% buy)`);
  }

  private volatilityArbStrategy(symbol: string, price: number): StrategySignal | null {
    // Trade on regime transitions
    if (this.currentRegime === this.lastRegime) return null;

    const volatility = this.marketData.getVolatility(symbol, 50);
    if (volatility === null) return null;

    let direction: TradeDirection;
    let strength: number;
    let reason: string;

    if (this.lastRegime === 'QUIET' && (this.currentRegime === 'VOLATILE' || this.currentRegime === 'BREAKOUT')) {
      // Volatility expansion — buy momentum
      direction = 'buy';
      strength = 0.6;
      reason = `Regime transition: ${this.lastRegime} → ${this.currentRegime} (volatility expansion)`;
    } else if ((this.lastRegime === 'VOLATILE' || this.lastRegime === 'BREAKOUT') && this.currentRegime === 'QUIET') {
      // Volatility contraction — mean revert
      direction = 'sell';
      strength = 0.5;
      reason = `Regime transition: ${this.lastRegime} → ${this.currentRegime} (volatility contraction)`;
    } else {
      return null;
    }

    return this.buildSignal('volatility-arb', 'Volatility Arbitrage', symbol, direction, strength, reason);
  }

  private ictSmartMoneyStrategy(symbol: string, price: number): StrategySignal | null {
    // Follow top-ranked arena bots
    const recentTrades = this.recentBotTrades
      .filter(t => t.symbol === symbol && Date.now() - t.timestamp < 120000);

    // Only consider trades from top 5 bots
    const topBotTrades = recentTrades.filter(t => {
      const rank = this.botRankings.get(t.botId);
      return rank !== undefined && rank <= 5;
    });

    if (topBotTrades.length < 2) return null;

    const buyCount = topBotTrades.filter(t => t.direction === 'buy').length;
    const total = topBotTrades.length;
    const buyRatio = buyCount / total;

    if (Math.abs(buyRatio - 0.5) < 0.2) return null;

    const direction: TradeDirection = buyRatio > 0.5 ? 'buy' : 'sell';
    const strength = Math.min(1, Math.abs(buyRatio - 0.5) * 2 + 0.2); // boost for smart money

    if (strength < 0.4) return null;

    return this.buildSignal('ict-smart-money', 'ICT Smart Money', symbol, direction, strength,
      `Top-5 bots: ${buyCount}/${total} buying (following smart money)`);
  }

  private regimeAdaptiveStrategy(symbol: string, price: number): StrategySignal | null {
    // Switch approach based on market regime
    switch (this.currentRegime) {
      case 'TRENDING': {
        // In trending regime, go with momentum
        const momentum = this.marketData.getMomentum(symbol, 10);
        if (momentum === null || !isFinite(momentum) || Math.abs(momentum) < 0.001) return null;
        const direction: TradeDirection = momentum > 0 ? 'buy' : 'sell';
        return this.buildSignal('regime-adaptive', 'Regime Adaptive', symbol, direction,
          Math.min(1, Math.abs(momentum) / 0.008 + 0.2),
          `Regime TRENDING: riding momentum ${(momentum * 100).toFixed(2)}%`);
      }
      case 'RANGING': {
        // In ranging regime, mean-revert
        const avg = this.marketData.getAveragePrice(symbol, 20);
        if (avg === null) return null;
        const dev = (price - avg) / avg;
        if (Math.abs(dev) < 0.002) return null;
        const direction: TradeDirection = dev < 0 ? 'buy' : 'sell';
        return this.buildSignal('regime-adaptive', 'Regime Adaptive', symbol, direction,
          Math.min(1, Math.abs(dev) / 0.008 + 0.1),
          `Regime RANGING: mean-reverting ${(dev * 100).toFixed(2)}% deviation`);
      }
      case 'VOLATILE': {
        // In volatile regime, reduce size / skip weak signals
        return null; // Conservative in volatile regimes
      }
      case 'BREAKOUT': {
        // In breakout, follow strong moves
        const momentum = this.marketData.getMomentum(symbol, 5);
        if (momentum === null || Math.abs(momentum) < 0.005) return null;
        const direction: TradeDirection = momentum > 0 ? 'buy' : 'sell';
        return this.buildSignal('regime-adaptive', 'Regime Adaptive', symbol, direction,
          Math.min(1, Math.abs(momentum) / 0.01 + 0.3),
          `Regime BREAKOUT: following strong move ${(momentum * 100).toFixed(2)}%`);
      }
      default:
        return null;
    }
  }

  // ===================== BUILDERS =====================

  private buildSignal(
    strategyId: string,
    strategyName: string,
    symbol: string,
    direction: TradeDirection,
    strength: number,
    reason: string
  ): StrategySignal {
    this.signalCount++;
    return {
      id: `sig-${this.signalCount}`,
      timestamp: Date.now(),
      strategyId,
      strategyName,
      symbol,
      direction,
      strength,
      reason,
      regime: this.currentRegime,
    };
  }

  private buildProposal(signal: StrategySignal): TradeProposal {
    const price = this.marketData.getPrice(signal.symbol) || 100;
    const arm = this.allocator.getArm(signal.strategyId);
    const kellyFraction = arm?.kellyFraction || 0.01;
    const allocationWeight = arm?.currentAllocation || (1 / 6);

    const positionValue = this.allocator.getTotalCapital() * allocationWeight * Math.min(kellyFraction, 0.25);
    const suggestedSize = Math.max(1, Math.floor(positionValue / price));

    return {
      id: uuidv4(),
      timestamp: Date.now(),
      signal,
      suggestedSize,
      estimatedPrice: price,
      estimatedValue: suggestedSize * price,
      kellyFraction,
      allocationWeight,
    };
  }

  // ===================== GETTERS =====================

  getSignalCount(): number { return this.signalCount; }
  getCurrentRegime(): MarketRegime { return this.currentRegime; }
}
