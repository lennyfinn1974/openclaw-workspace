/**
 * Adversarial Strategy Generator
 * Layer 3: Strategy Synthesis
 *
 * Generates counter-strategies that specifically target weaknesses
 * of current top-performing bots. Inspired by adversarial ML —
 * creates strategies that exploit where champions consistently fail.
 *
 * Process:
 * 1. Replay leader's trades over recent periods
 * 2. Identify conditions where the leader consistently loses
 * 3. Build strategies specifically targeting those conditions
 * 4. Create natural arms race driving continuous improvement
 */

import { EventEmitter } from 'events';
import {
  AdversarialConfig, AdversarialStrategy, BotWeakness, WeaknessConditions,
  StrategyNode
} from '../types/synthesis';
import {
  ObservationEvent, TradeEvent, MarketRegime, IndicatorSnapshot, StrategyFingerprint
} from '../types/core';
import { ExpressionTree } from './ExpressionTree';

// ===================== DEFAULT CONFIG =====================

const DEFAULT_CONFIG: AdversarialConfig = {
  targetBotCount: 5,
  lookbackPeriods: 200,
  exploitThreshold: 0.3,
  maxStrategiesPerTarget: 3,
};

const REGIMES: MarketRegime[] = ['TRENDING', 'RANGING', 'VOLATILE', 'BREAKOUT', 'EVENT', 'QUIET'];

let adversarialId = 0;

// ===================== ADVERSARIAL GENERATOR =====================

export class AdversarialGenerator extends EventEmitter {
  private config: AdversarialConfig;
  private treeEngine: ExpressionTree;
  private weaknessCache: Map<string, BotWeakness[]> = new Map();
  private generatedStrategies: AdversarialStrategy[] = [];

  constructor(config: Partial<AdversarialConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.treeEngine = new ExpressionTree();
  }

  // ===================== WEAKNESS ANALYSIS =====================

  /**
   * Analyze a bot's trade history to find exploitable weaknesses.
   */
  analyzeWeaknesses(
    botId: string,
    trades: ObservationEvent[],
    fingerprint?: StrategyFingerprint
  ): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];

    // Analysis 1: Regime-specific losses
    const regimeWeaknesses = this.findRegimeWeaknesses(botId, trades);
    weaknesses.push(...regimeWeaknesses);

    // Analysis 2: Indicator-conditioned losses
    const indicatorWeaknesses = this.findIndicatorWeaknesses(botId, trades);
    weaknesses.push(...indicatorWeaknesses);

    // Analysis 3: Timing weaknesses (when entries are consistently bad)
    const timingWeaknesses = this.findTimingWeaknesses(botId, trades);
    weaknesses.push(...timingWeaknesses);

    // Analysis 4: Direction bias exploitation
    if (fingerprint) {
      const biasWeakness = this.findDirectionBiasWeakness(botId, trades, fingerprint);
      if (biasWeakness) weaknesses.push(biasWeakness);
    }

    // Filter by severity threshold and sort
    const significant = weaknesses
      .filter(w => w.severity >= this.config.exploitThreshold && w.sampleSize >= 5)
      .sort((a, b) => b.severity * b.frequency - a.severity * a.frequency);

    this.weaknessCache.set(botId, significant);
    return significant;
  }

  /**
   * Find regimes where bot consistently loses.
   */
  private findRegimeWeaknesses(botId: string, trades: ObservationEvent[]): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];

    for (const regime of REGIMES) {
      const regimeTrades = trades.filter(t => {
        const enrichment = (t as any).enrichment || t.enrichmentMetadata;
        return enrichment?.marketRegime === regime || enrichment?.regime === regime;
      });

      if (regimeTrades.length < 5) continue;

      const returns = regimeTrades.map(t => (t.payload as any).pnl || 0);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const lossRate = returns.filter(r => r < 0).length / returns.length;

      if (lossRate > 0.6 && avgReturn < 0) {
        const severity = Math.min(1, lossRate * Math.abs(avgReturn));
        const frequency = regimeTrades.length / trades.length;

        weaknesses.push({
          botId,
          weakness: `Loses ${(lossRate * 100).toFixed(0)}% of trades in ${regime} regime`,
          regime,
          conditions: { regime },
          severity,
          frequency,
          expectedEdge: Math.abs(avgReturn),
          sampleSize: regimeTrades.length,
          confidence: this.calculateConfidence(regimeTrades.length, lossRate),
        });
      }
    }

    return weaknesses;
  }

  /**
   * Find indicator conditions where bot consistently fails.
   */
  private findIndicatorWeaknesses(botId: string, trades: ObservationEvent[]): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];

    // Check RSI extremes
    const oversoldTrades = trades.filter(t => {
      const ind = this.getIndicators(t);
      return ind && ind.rsi14 < 30;
    });
    const overboughtTrades = trades.filter(t => {
      const ind = this.getIndicators(t);
      return ind && ind.rsi14 > 70;
    });

    this.checkConditionWeakness(
      botId, oversoldTrades, trades,
      'Loses when RSI is oversold (< 30)',
      { indicators: { rsi: { max: 30 } } },
      weaknesses
    );

    this.checkConditionWeakness(
      botId, overboughtTrades, trades,
      'Loses when RSI is overbought (> 70)',
      { indicators: { rsi: { min: 70 } } },
      weaknesses
    );

    // Check high volatility
    const highVolTrades = trades.filter(t => {
      const ind = this.getIndicators(t);
      return ind && ind.atr14 > 2;
    });

    this.checkConditionWeakness(
      botId, highVolTrades, trades,
      'Loses during high volatility (ATR > 2)',
      { volatilityState: 'high' },
      weaknesses
    );

    // Check low volume
    const lowVolumeTrades = trades.filter(t => {
      const ind = this.getIndicators(t);
      return ind && ind.volumeRatio < 0.5;
    });

    this.checkConditionWeakness(
      botId, lowVolumeTrades, trades,
      'Loses during low volume periods',
      { indicators: { volume: { minRatio: 0 } } },
      weaknesses
    );

    // Check against trend
    const counterTrendTrades = trades.filter(t => {
      const ind = this.getIndicators(t);
      const payload = t.payload as any;
      if (!ind) return false;
      return (payload.direction === 'buy' && ind.priceVsMA50 < -2) ||
             (payload.direction === 'sell' && ind.priceVsMA50 > 2);
    });

    this.checkConditionWeakness(
      botId, counterTrendTrades, trades,
      'Loses when trading against the trend',
      { indicators: { rsi: {} } }, // placeholder conditions
      weaknesses
    );

    return weaknesses;
  }

  /**
   * Find timing patterns where bot enters at bad moments.
   */
  private findTimingWeaknesses(botId: string, trades: ObservationEvent[]): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];

    // Check if bot trades too frequently after losses
    const tradesByTime = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let consecutiveLosses = 0;
    let afterLossStreak: ObservationEvent[] = [];

    for (const trade of tradesByTime) {
      const pnl = (trade.payload as any).pnl || 0;
      if (pnl < 0) {
        consecutiveLosses++;
        if (consecutiveLosses >= 2) {
          afterLossStreak.push(trade);
        }
      } else {
        consecutiveLosses = 0;
      }
    }

    if (afterLossStreak.length >= 5) {
      const returns = afterLossStreak.map(t => (t.payload as any).pnl || 0);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const lossRate = returns.filter(r => r < 0).length / returns.length;

      if (lossRate > 0.6) {
        weaknesses.push({
          botId,
          weakness: 'Tilts after consecutive losses — trades worse after loss streaks',
          regime: 'RANGING' as MarketRegime,
          conditions: { precedingAction: 'sell' },
          severity: Math.min(1, lossRate * 1.5),
          frequency: afterLossStreak.length / trades.length,
          expectedEdge: Math.abs(avgReturn),
          sampleSize: afterLossStreak.length,
          confidence: this.calculateConfidence(afterLossStreak.length, lossRate),
        });
      }
    }

    return weaknesses;
  }

  /**
   * Find weaknesses from direction bias.
   */
  private findDirectionBiasWeakness(
    botId: string,
    trades: ObservationEvent[],
    fingerprint: StrategyFingerprint
  ): BotWeakness | null {
    const bias = fingerprint.directionBias;

    // Strong bias = exploitable
    if (Math.abs(bias) < 0.3) return null;

    const biasDirection = bias > 0 ? 'buy' : 'sell';
    const biasedTrades = trades.filter(t => (t.payload as any).direction === biasDirection);
    const returns = biasedTrades.map(t => (t.payload as any).pnl || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / Math.max(returns.length, 1);

    if (avgReturn >= 0) return null; // bias is actually profitable, not a weakness

    return {
      botId,
      weakness: `Strong ${biasDirection} bias (${(bias * 100).toFixed(0)}%) but loses on average`,
      regime: 'RANGING' as MarketRegime,
      conditions: { precedingAction: biasDirection as any },
      severity: Math.min(1, Math.abs(bias) * Math.abs(avgReturn) * 10),
      frequency: biasedTrades.length / trades.length,
      expectedEdge: Math.abs(avgReturn),
      sampleSize: biasedTrades.length,
      confidence: this.calculateConfidence(biasedTrades.length, 0.5),
    };
  }

  private checkConditionWeakness(
    botId: string,
    conditionTrades: ObservationEvent[],
    allTrades: ObservationEvent[],
    description: string,
    conditions: WeaknessConditions,
    weaknesses: BotWeakness[]
  ): void {
    if (conditionTrades.length < 5) return;

    const returns = conditionTrades.map(t => (t.payload as any).pnl || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const lossRate = returns.filter(r => r < 0).length / returns.length;

    if (lossRate > 0.55 && avgReturn < 0) {
      weaknesses.push({
        botId,
        weakness: description,
        regime: (conditions.regime as MarketRegime) || 'RANGING',
        conditions,
        severity: Math.min(1, lossRate * Math.abs(avgReturn) * 5),
        frequency: conditionTrades.length / allTrades.length,
        expectedEdge: Math.abs(avgReturn),
        sampleSize: conditionTrades.length,
        confidence: this.calculateConfidence(conditionTrades.length, lossRate),
      });
    }
  }

  // ===================== COUNTER-STRATEGY GENERATION =====================

  /**
   * Generate adversarial strategies targeting top bots' weaknesses.
   */
  generateCounterStrategies(
    topBots: { botId: string; trades: ObservationEvent[]; fingerprint?: StrategyFingerprint }[]
  ): AdversarialStrategy[] {
    const strategies: AdversarialStrategy[] = [];

    // Analyze weaknesses for all target bots
    for (const bot of topBots.slice(0, this.config.targetBotCount)) {
      const weaknesses = this.analyzeWeaknesses(bot.botId, bot.trades, bot.fingerprint);

      // Generate counter-strategies for top weaknesses
      for (const weakness of weaknesses.slice(0, this.config.maxStrategiesPerTarget)) {
        const strategy = this.buildCounterStrategy(weakness, bot.trades);
        if (strategy) {
          strategies.push(strategy);
        }
      }
    }

    // Also look for shared weaknesses across multiple bots
    const sharedStrategies = this.exploitSharedWeaknesses(topBots);
    strategies.push(...sharedStrategies);

    this.generatedStrategies.push(...strategies);
    this.emit('adversarial:generated', { count: strategies.length });

    return strategies;
  }

  /**
   * Build a specific counter-strategy for a weakness.
   */
  private buildCounterStrategy(
    weakness: BotWeakness,
    targetTrades: ObservationEvent[]
  ): AdversarialStrategy | null {
    // Build entry conditions from weakness conditions
    const entryTree = this.weaknessToEntryTree(weakness);
    if (!entryTree) return null;

    // Build exit conditions (opposite of what the target does)
    const exitTree = this.buildExitTree(weakness);

    // Simulate the counter-strategy
    const simulatedReturn = this.simulateCounterStrategy(
      entryTree, exitTree, targetTrades, weakness
    );

    if (simulatedReturn <= 0) return null; // only accept profitable counters

    return {
      id: `adv_${++adversarialId}_${Date.now().toString(36)}`,
      targetBotIds: [weakness.botId],
      weaknessesExploited: [weakness],
      entryConditions: entryTree,
      exitConditions: exitTree,
      expectedEdge: weakness.expectedEdge,
      simulatedReturn,
      confidence: weakness.confidence,
      createdAt: Date.now(),
    };
  }

  /**
   * Convert weakness conditions into an expression tree for entry.
   */
  private weaknessToEntryTree(weakness: BotWeakness): StrategyNode | null {
    const conditions: StrategyNode[] = [];

    // Regime condition
    if (weakness.conditions.regime) {
      // When target bot's weak regime is active, enter in opposite direction
      conditions.push(this.buildRegimeCondition(weakness.conditions.regime));
    }

    // Indicator conditions
    if (weakness.conditions.indicators) {
      const ind = weakness.conditions.indicators;
      if (ind.rsi) {
        if (ind.rsi.max) {
          conditions.push(this.buildComparison('RSI', 'LT', ind.rsi.max));
        }
        if (ind.rsi.min) {
          conditions.push(this.buildComparison('RSI', 'GT', ind.rsi.min));
        }
      }
    }

    // Volatility condition
    if (weakness.conditions.volatilityState === 'high') {
      conditions.push(this.buildComparison('ATR', 'GT', 2));
    } else if (weakness.conditions.volatilityState === 'low') {
      conditions.push(this.buildComparison('ATR', 'LT', 0.5));
    }

    if (conditions.length === 0) {
      // Default: use RSI-based entry when target is weak
      conditions.push(this.buildComparison('RSI', 'LT', 40));
    }

    // Combine conditions with AND
    let combined = conditions[0];
    for (let i = 1; i < conditions.length; i++) {
      combined = {
        id: `adv_and_${Date.now().toString(36)}_${i}`,
        type: 'logical',
        value: 'AND',
        children: [combined, conditions[i]],
      };
    }

    // Wrap in IF-THEN-ELSE with counter-action
    const counterAction = weakness.conditions.precedingAction === 'buy' ? 'SELL' : 'BUY';

    return {
      id: `adv_root_${Date.now().toString(36)}`,
      type: 'logical',
      value: 'IF_THEN_ELSE',
      children: [
        combined,
        { id: `adv_act1_${Date.now().toString(36)}`, type: 'action', value: counterAction, params: { confidence: 0.7 } },
        { id: `adv_act2_${Date.now().toString(36)}`, type: 'action', value: 'HOLD', params: { confidence: 0.3 } },
      ],
    };
  }

  private buildRegimeCondition(regime: MarketRegime): StrategyNode {
    // Map regime to indicator conditions
    const regimeMap: Record<string, { indicator: string; op: string; value: number }> = {
      'TRENDING': { indicator: 'TREND_STRENGTH', op: 'GT', value: 25 },
      'RANGING': { indicator: 'TREND_STRENGTH', op: 'LT', value: 15 },
      'VOLATILE': { indicator: 'ATR', op: 'GT', value: 2 },
      'BREAKOUT': { indicator: 'BB_POSITION', op: 'GT', value: 0.9 },
      'QUIET': { indicator: 'ATR', op: 'LT', value: 0.5 },
      'EVENT': { indicator: 'VOLUME_RATIO', op: 'GT', value: 3 },
    };

    const mapping = regimeMap[regime] || regimeMap['RANGING'];
    return this.buildComparison(mapping.indicator, mapping.op, mapping.value);
  }

  private buildComparison(indicator: string, operator: string, value: number): StrategyNode {
    return {
      id: `adv_cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'comparator',
      value: operator,
      children: [
        { id: `adv_ind_${Date.now().toString(36)}`, type: 'indicator', value: indicator },
        { id: `adv_const_${Date.now().toString(36)}`, type: 'constant', value: String(value) },
      ],
    };
  }

  private buildExitTree(weakness: BotWeakness): StrategyNode {
    // Simple exit: close when conditions change
    return {
      id: `adv_exit_${Date.now().toString(36)}`,
      type: 'logical',
      value: 'IF_THEN_ELSE',
      children: [
        this.buildComparison('TREND_STRENGTH', 'GT', 30),
        { id: `adv_exit_close_${Date.now().toString(36)}`, type: 'action', value: 'CLOSE', params: { confidence: 0.6 } },
        { id: `adv_exit_hold_${Date.now().toString(36)}`, type: 'action', value: 'HOLD', params: { confidence: 0.5 } },
      ],
    };
  }

  /**
   * Find weaknesses shared by multiple top bots (most exploitable).
   */
  private exploitSharedWeaknesses(
    bots: { botId: string; trades: ObservationEvent[]; fingerprint?: StrategyFingerprint }[]
  ): AdversarialStrategy[] {
    const strategies: AdversarialStrategy[] = [];

    // Collect all weaknesses
    const allWeaknesses: BotWeakness[] = [];
    for (const bot of bots) {
      const cached = this.weaknessCache.get(bot.botId);
      if (cached) allWeaknesses.push(...cached);
    }

    // Group by similar conditions
    const regimeGroups = new Map<string, BotWeakness[]>();
    for (const w of allWeaknesses) {
      const key = w.regime;
      if (!regimeGroups.has(key)) regimeGroups.set(key, []);
      regimeGroups.get(key)!.push(w);
    }

    // Find shared weaknesses (same regime, multiple bots)
    for (const [regime, weaknesses] of regimeGroups) {
      const uniqueBots = new Set(weaknesses.map(w => w.botId));
      if (uniqueBots.size >= 2) {
        // Multiple bots are weak in same regime — high-value exploit
        const avgSeverity = weaknesses.reduce((s, w) => s + w.severity, 0) / weaknesses.length;
        const avgEdge = weaknesses.reduce((s, w) => s + w.expectedEdge, 0) / weaknesses.length;

        const sharedWeakness: BotWeakness = {
          botId: 'shared',
          weakness: `${uniqueBots.size} bots weak in ${regime} regime`,
          regime: regime as MarketRegime,
          conditions: { regime: regime as MarketRegime },
          severity: Math.min(1, avgSeverity * 1.5), // bonus for being shared
          frequency: weaknesses.reduce((s, w) => s + w.frequency, 0) / weaknesses.length,
          expectedEdge: avgEdge,
          sampleSize: weaknesses.reduce((s, w) => s + w.sampleSize, 0),
          confidence: Math.min(0.95, avgSeverity * uniqueBots.size * 0.2),
        };

        const strategy = this.buildCounterStrategy(sharedWeakness, bots[0].trades);
        if (strategy) {
          strategy.targetBotIds = [...uniqueBots];
          strategy.weaknessesExploited = weaknesses;
          strategies.push(strategy);
        }
      }
    }

    return strategies;
  }

  /**
   * Simulate counter-strategy to estimate returns.
   */
  private simulateCounterStrategy(
    entryTree: StrategyNode,
    exitTree: StrategyNode,
    trades: ObservationEvent[],
    weakness: BotWeakness
  ): number {
    // Simplified simulation: assume we trade opposite of target
    // during their weak conditions and capture the edge
    const weakTrades = trades.filter(t => {
      const regime = ((t as any).enrichment?.marketRegime ||
        t.enrichmentMetadata?.indicators?.trendStrength);
      return regime === weakness.regime;
    });

    if (weakTrades.length === 0) return 0;

    const targetReturns = weakTrades.map(t => (t.payload as any).pnl || 0);
    const avgTargetLoss = targetReturns.reduce((a, b) => a + b, 0) / targetReturns.length;

    // Our edge is roughly the opposite of their loss, reduced by slippage and uncertainty
    const slippageFactor = 0.7;  // 30% reduction for execution costs
    const uncertaintyFactor = weakness.confidence;

    return -avgTargetLoss * slippageFactor * uncertaintyFactor;
  }

  // ===================== UTILITY =====================

  private getIndicators(event: ObservationEvent): IndicatorSnapshot | null {
    return event.enrichmentMetadata?.indicators || null;
  }

  private calculateConfidence(sampleSize: number, effectSize: number): number {
    // Simplified confidence calculation based on sample size and effect size
    const sampleFactor = Math.min(1, sampleSize / 50);
    const effectFactor = Math.min(1, Math.abs(effectSize));
    return Math.min(0.95, sampleFactor * 0.5 + effectFactor * 0.5);
  }

  // ===================== PUBLIC API =====================

  getWeaknesses(botId: string): BotWeakness[] {
    return this.weaknessCache.get(botId) || [];
  }

  getAllWeaknesses(): Map<string, BotWeakness[]> {
    return new Map(this.weaknessCache);
  }

  getGeneratedStrategies(): AdversarialStrategy[] {
    return [...this.generatedStrategies];
  }

  getStats(): {
    botsAnalyzed: number;
    totalWeaknesses: number;
    strategiesGenerated: number;
  } {
    let totalWeaknesses = 0;
    for (const weaknesses of this.weaknessCache.values()) {
      totalWeaknesses += weaknesses.length;
    }
    return {
      botsAnalyzed: this.weaknessCache.size,
      totalWeaknesses,
      strategiesGenerated: this.generatedStrategies.length,
    };
  }
}

export default AdversarialGenerator;
