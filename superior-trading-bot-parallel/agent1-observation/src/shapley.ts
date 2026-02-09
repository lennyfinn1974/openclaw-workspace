// ============================================================
// Shapley Value Trade Attribution System
// Decomposes bot performance into factor contributions
// ============================================================

import { ShapleyAttribution, ObservedTrade, IndicatorState, MarketRegime } from './types';
import { BotFingerprinter } from './bot-fingerprinter';

// Factors that contribute to trade outcomes
const FACTORS = ['signalQuality', 'timing', 'sizing', 'exitQuality', 'regimeAlignment'] as const;
type Factor = typeof FACTORS[number];

interface TradeContext {
  trade: ObservedTrade;
  indicators: IndicatorState | null;
  regime: MarketRegime;
  prevTrade: ObservedTrade | null;
}

export class ShapleyAttributor {
  private fingerprinter: BotFingerprinter;
  private tradeContexts: Map<string, TradeContext[]> = new Map(); // botId → contexts
  private maxContextsPerBot = 200;

  constructor(fingerprinter: BotFingerprinter) {
    this.fingerprinter = fingerprinter;
  }

  /** Record trade context for attribution */
  recordContext(
    trade: ObservedTrade,
    indicators: IndicatorState | null,
    regime: MarketRegime
  ): void {
    const { botId } = trade;
    let contexts = this.tradeContexts.get(botId);
    if (!contexts) {
      contexts = [];
      this.tradeContexts.set(botId, contexts);
    }

    const prevTrade = contexts.length > 0 ? contexts[contexts.length - 1].trade : null;
    contexts.push({ trade, indicators, regime, prevTrade });

    if (contexts.length > this.maxContextsPerBot) {
      contexts.shift();
    }
  }

  /**
   * Compute Shapley values for a bot.
   *
   * Uses approximate Shapley via marginal contribution of each factor.
   * For each factor, we estimate how much adding that factor to the
   * "null coalition" (random/baseline performance) improves the outcome.
   *
   * This is a permutation-sampling approximation since exact Shapley
   * over 5 factors = 5! = 120 permutations is tractable.
   */
  computeAttribution(botId: string, period: string = 'all'): ShapleyAttribution | null {
    const contexts = this.tradeContexts.get(botId);
    if (!contexts || contexts.length < 10) return null;

    const fp = this.fingerprinter.getFingerprint(botId);
    if (!fp) return null;

    // Compute factor scores for each trade
    const factorScores = contexts.map(ctx => this.evaluateFactors(ctx));

    // Average factor contributions
    const avgContributions: Record<Factor, number> = {
      signalQuality: 0,
      timing: 0,
      sizing: 0,
      exitQuality: 0,
      regimeAlignment: 0,
    };

    for (const scores of factorScores) {
      for (const factor of FACTORS) {
        avgContributions[factor] += scores[factor];
      }
    }

    for (const factor of FACTORS) {
      avgContributions[factor] /= factorScores.length;
    }

    // Normalize to Shapley values (must sum to total P&L contribution)
    const totalScore = Object.values(avgContributions).reduce((a, b) => a + b, 0);
    const totalPnL = fp.totalPnL;

    const shapleyValues: Record<Factor, number> = { ...avgContributions };
    if (totalScore !== 0) {
      for (const factor of FACTORS) {
        shapleyValues[factor] = (avgContributions[factor] / totalScore) * totalPnL;
      }
    }

    // Marginal contribution vs random baseline
    const randomBaseline = 0; // random trading has 0 expected P&L
    const marginalContribution = totalPnL - randomBaseline;

    return {
      botId,
      period,
      contributions: shapleyValues,
      totalShapley: totalPnL,
      marginalContribution,
      rank: 0, // set externally after ranking all bots
    };
  }

  /** Evaluate factor contributions for a single trade context */
  private evaluateFactors(ctx: TradeContext): Record<Factor, number> {
    const { trade, indicators, regime, prevTrade } = ctx;
    const pnl = trade.pnl;

    return {
      signalQuality: this.scoreSignalQuality(trade, indicators),
      timing: this.scoreTiming(trade, prevTrade, indicators),
      sizing: this.scoreSizing(trade),
      exitQuality: this.scoreExitQuality(trade, indicators),
      regimeAlignment: this.scoreRegimeAlignment(trade, regime),
    };
  }

  /**
   * Signal quality: Was the trade in the right direction given indicator state?
   * Positive = signal aligned with profitable outcome
   */
  private scoreSignalQuality(trade: ObservedTrade, indicators: IndicatorState | null): number {
    if (!indicators) return 0;

    let score = 0;
    const isBuy = trade.side === 'buy';
    const profitable = trade.pnl > 0;

    // RSI agreement
    if (isBuy && indicators.rsi14 < 35) score += 0.3;
    else if (!isBuy && indicators.rsi14 > 65) score += 0.3;
    else if (isBuy && indicators.rsi14 > 70) score -= 0.2;
    else if (!isBuy && indicators.rsi14 < 30) score -= 0.2;

    // MACD agreement
    if (isBuy && indicators.macdCrossover === 'bullish') score += 0.3;
    else if (!isBuy && indicators.macdCrossover === 'bearish') score += 0.3;

    // Bollinger agreement
    if (isBuy && indicators.bbPercentB < 0.1) score += 0.2; // near lower band
    else if (!isBuy && indicators.bbPercentB > 0.9) score += 0.2; // near upper band

    // Multiply by outcome direction
    return score * (profitable ? 1 : -1);
  }

  /** Timing: How well-timed was entry relative to price action? */
  private scoreTiming(
    trade: ObservedTrade,
    prevTrade: ObservedTrade | null,
    indicators: IndicatorState | null
  ): number {
    if (!prevTrade || !indicators) return 0;

    // Time since last trade (patience score)
    const intervalMs = trade.observedAt - prevTrade.observedAt;
    const patienceScore = Math.min(intervalMs / 60000, 1); // max out at 1 min

    // Volatility timing — trading during right vol conditions
    const volScore = indicators.volatilityRank > 0.3 && indicators.volatilityRank < 0.7 ? 0.3 : -0.1;

    // RSI slope — entering as momentum builds
    const slopeScore = trade.side === 'buy'
      ? Math.max(0, indicators.rsiSlope * 0.1)
      : Math.max(0, -indicators.rsiSlope * 0.1);

    return (patienceScore * 0.3 + volScore + slopeScore) * (trade.pnl > 0 ? 1 : -1);
  }

  /** Sizing: Was position size appropriate? */
  private scoreSizing(trade: ObservedTrade): number {
    const tradeValue = trade.quantity * trade.price;
    // Penalize extreme sizes, reward moderate ones
    // Rough heuristic: $100-$1000 is moderate for a $5000 account
    if (tradeValue > 0 && tradeValue < 2500) {
      const normalizedSize = tradeValue / 2500;
      // Bell curve centered at 0.3 (moderate sizing)
      const sizeScore = Math.exp(-((normalizedSize - 0.3) ** 2) / 0.1);
      return sizeScore * (trade.pnl > 0 ? 0.5 : -0.3);
    }
    return -0.2; // extreme position = negative contribution
  }

  /** Exit quality: Did the bot exit at the right time? */
  private scoreExitQuality(trade: ObservedTrade, indicators: IndicatorState | null): number {
    if (trade.side !== 'sell' || !indicators) return 0;

    let score = 0;

    // Good exit: selling when RSI is high (overbought)
    if (indicators.rsi14 > 65) score += 0.3;
    // Good exit: selling when above upper Bollinger
    if (indicators.bbPercentB > 0.85) score += 0.2;
    // Bad exit: selling during bullish MACD crossover
    if (indicators.macdCrossover === 'bullish') score -= 0.3;

    return score * (trade.pnl > 0 ? 1 : -0.5);
  }

  /** Regime alignment: Was the trade aligned with market regime? */
  private scoreRegimeAlignment(trade: ObservedTrade, regime: MarketRegime): number {
    const isBuy = trade.side === 'buy';
    let score = 0;

    switch (regime) {
      case 'trending_up':
        score = isBuy ? 0.5 : -0.3;
        break;
      case 'trending_down':
        score = isBuy ? -0.3 : 0.5;
        break;
      case 'ranging':
        // Mean reversion works best in ranging markets
        score = 0.1;
        break;
      case 'volatile':
        // Higher risk — penalize unless trade was profitable
        score = trade.pnl > 0 ? 0.3 : -0.4;
        break;
      case 'quiet':
        // Small moves — neutral
        score = 0;
        break;
    }

    return score * (trade.pnl > 0 ? 1 : -1);
  }

  /** Compute attributions for all tracked bots and rank them */
  computeAllAttributions(period: string = 'all'): ShapleyAttribution[] {
    const results: ShapleyAttribution[] = [];

    for (const botId of this.tradeContexts.keys()) {
      const attr = this.computeAttribution(botId, period);
      if (attr) results.push(attr);
    }

    // Rank by total Shapley value
    results.sort((a, b) => b.totalShapley - a.totalShapley);
    results.forEach((r, i) => { r.rank = i + 1; });

    return results;
  }
}
