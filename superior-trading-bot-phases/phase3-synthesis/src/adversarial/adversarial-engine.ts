/**
 * Adversarial Strategy Generator — Creates counter-strategies targeting
 * competitor weaknesses. Inspired by adversarial ML / Red Queen dynamics.
 *
 * 1. Replay leader's trades over recent periods
 * 2. Identify conditions where leaders consistently lose
 * 3. Build strategies specifically exploiting those conditions
 * 4. Detect shared weaknesses across multiple bots (highest value)
 */

import { EventEmitter } from 'events';
import {
  AdversarialConfig, AdversarialStrategy, BotWeakness, WeaknessConditions,
  StrategyNode, ObservationEvent, MarketRegime, IndicatorSnapshot,
  StrategyFingerprint, TradeDirection,
} from '../types';
import { ExpressionTree } from '../genetic/expression-tree';

const DEFAULT_CONFIG: AdversarialConfig = {
  targetBotCount: 5,
  lookbackPeriods: 200,
  exploitThreshold: 0.3,
  maxStrategiesPerTarget: 3,
  sharedWeaknessBonus: 1.5,
};

const REGIMES: MarketRegime[] = ['TRENDING', 'RANGING', 'VOLATILE', 'BREAKOUT', 'EVENT', 'QUIET'];
let advId = 0;

export class AdversarialEngine extends EventEmitter {
  private config: AdversarialConfig;
  private treeEngine: ExpressionTree;
  private weaknessCache: Map<string, BotWeakness[]> = new Map();
  private strategies: AdversarialStrategy[] = [];

  constructor(config: Partial<AdversarialConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.treeEngine = new ExpressionTree();
  }

  // ===================== WEAKNESS ANALYSIS =====================

  analyzeWeaknesses(botId: string, trades: ObservationEvent[], fingerprint?: StrategyFingerprint): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];

    weaknesses.push(...this.findRegimeWeaknesses(botId, trades));
    weaknesses.push(...this.findIndicatorWeaknesses(botId, trades));
    weaknesses.push(...this.findTimingWeaknesses(botId, trades));
    if (fingerprint) {
      const bw = this.findBiasWeakness(botId, trades, fingerprint);
      if (bw) weaknesses.push(bw);
    }

    const significant = weaknesses
      .filter(w => w.severity >= this.config.exploitThreshold && w.sampleSize >= 5)
      .sort((a, b) => b.severity * b.frequency - a.severity * a.frequency);

    this.weaknessCache.set(botId, significant);
    return significant;
  }

  private findRegimeWeaknesses(botId: string, trades: ObservationEvent[]): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];

    for (const regime of REGIMES) {
      const rt = trades.filter(t => {
        const enr = (t as unknown as Record<string, unknown>).enrichment as Record<string, unknown> | undefined;
        return enr?.marketRegime === regime || t.enrichmentMetadata?.indicators?.trendStrength === (regime as unknown);
      });
      if (rt.length < 5) continue;

      const returns = rt.map(t => (t.payload as Record<string, unknown>).pnl as number || 0);
      const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
      const lossRate = returns.filter(r => r < 0).length / returns.length;

      if (lossRate > 0.6 && avg < 0) {
        weaknesses.push({
          botId,
          weakness: `Loses ${(lossRate * 100).toFixed(0)}% in ${regime}`,
          regime,
          conditions: { regime },
          severity: Math.min(1, lossRate * Math.abs(avg)),
          frequency: rt.length / trades.length,
          expectedEdge: Math.abs(avg),
          sampleSize: rt.length,
          confidence: this.calcConfidence(rt.length, lossRate),
        });
      }
    }
    return weaknesses;
  }

  private findIndicatorWeaknesses(botId: string, trades: ObservationEvent[]): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];
    const getInd = (t: ObservationEvent) => t.enrichmentMetadata?.indicators;

    const checks: { filter: (ind: IndicatorSnapshot) => boolean; desc: string; cond: WeaknessConditions }[] = [
      { filter: ind => ind.rsi14 < 30, desc: 'Loses when RSI oversold (<30)', cond: { indicators: { rsi: { max: 30 } } } },
      { filter: ind => ind.rsi14 > 70, desc: 'Loses when RSI overbought (>70)', cond: { indicators: { rsi: { min: 70 } } } },
      { filter: ind => ind.atr14 > 2, desc: 'Loses during high volatility', cond: { volatilityState: 'high' } },
      { filter: ind => ind.volumeRatio < 0.5, desc: 'Loses during low volume', cond: { indicators: { volume: { minRatio: 0 } } } },
    ];

    for (const { filter, desc, cond } of checks) {
      const filtered = trades.filter(t => { const ind = getInd(t); return ind ? filter(ind) : false; });
      this.checkCondition(botId, filtered, trades, desc, cond, weaknesses);
    }

    // Counter-trend trades
    const counterTrend = trades.filter(t => {
      const ind = getInd(t);
      const p = t.payload as Record<string, unknown>;
      if (!ind) return false;
      return (p.direction === 'buy' && ind.priceVsMA50 < -2) || (p.direction === 'sell' && ind.priceVsMA50 > 2);
    });
    this.checkCondition(botId, counterTrend, trades, 'Loses trading against trend', { indicators: {} }, weaknesses);

    return weaknesses;
  }

  private findTimingWeaknesses(botId: string, trades: ObservationEvent[]): BotWeakness[] {
    const weaknesses: BotWeakness[] = [];
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let consLoss = 0;
    const afterStreak: ObservationEvent[] = [];

    for (const t of sorted) {
      const pnl = (t.payload as Record<string, unknown>).pnl as number || 0;
      if (pnl < 0) { consLoss++; if (consLoss >= 2) afterStreak.push(t); }
      else { consLoss = 0; }
    }

    if (afterStreak.length >= 5) {
      const returns = afterStreak.map(t => (t.payload as Record<string, unknown>).pnl as number || 0);
      const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
      const lossRate = returns.filter(r => r < 0).length / returns.length;

      if (lossRate > 0.6) {
        weaknesses.push({
          botId, weakness: 'Tilts after consecutive losses',
          regime: 'RANGING', conditions: { precedingAction: 'sell' },
          severity: Math.min(1, lossRate * 1.5), frequency: afterStreak.length / trades.length,
          expectedEdge: Math.abs(avg), sampleSize: afterStreak.length,
          confidence: this.calcConfidence(afterStreak.length, lossRate),
        });
      }
    }
    return weaknesses;
  }

  private findBiasWeakness(botId: string, trades: ObservationEvent[], fp: StrategyFingerprint): BotWeakness | null {
    if (Math.abs(fp.directionBias) < 0.3) return null;
    const dir: TradeDirection = fp.directionBias > 0 ? 'buy' : 'sell';
    const biased = trades.filter(t => (t.payload as Record<string, unknown>).direction === dir);
    const returns = biased.map(t => (t.payload as Record<string, unknown>).pnl as number || 0);
    const avg = returns.reduce((a, b) => a + b, 0) / Math.max(returns.length, 1);
    if (avg >= 0) return null;

    return {
      botId, weakness: `Strong ${dir} bias (${(fp.directionBias * 100).toFixed(0)}%) but loses`,
      regime: 'RANGING', conditions: { precedingAction: dir },
      severity: Math.min(1, Math.abs(fp.directionBias) * Math.abs(avg) * 10),
      frequency: biased.length / trades.length, expectedEdge: Math.abs(avg),
      sampleSize: biased.length, confidence: this.calcConfidence(biased.length, 0.5),
    };
  }

  private checkCondition(botId: string, ct: ObservationEvent[], all: ObservationEvent[], desc: string, cond: WeaknessConditions, out: BotWeakness[]): void {
    if (ct.length < 5) return;
    const returns = ct.map(t => (t.payload as Record<string, unknown>).pnl as number || 0);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const lossRate = returns.filter(r => r < 0).length / returns.length;
    if (lossRate > 0.55 && avg < 0) {
      out.push({
        botId, weakness: desc, regime: (cond.regime as MarketRegime) || 'RANGING', conditions: cond,
        severity: Math.min(1, lossRate * Math.abs(avg) * 5), frequency: ct.length / all.length,
        expectedEdge: Math.abs(avg), sampleSize: ct.length,
        confidence: this.calcConfidence(ct.length, lossRate),
      });
    }
  }

  // ===================== COUNTER-STRATEGY GENERATION =====================

  generateCounterStrategies(topBots: { botId: string; trades: ObservationEvent[]; fingerprint?: StrategyFingerprint }[]): AdversarialStrategy[] {
    const strategies: AdversarialStrategy[] = [];

    for (const bot of topBots.slice(0, this.config.targetBotCount)) {
      const weaknesses = this.analyzeWeaknesses(bot.botId, bot.trades, bot.fingerprint);
      for (const w of weaknesses.slice(0, this.config.maxStrategiesPerTarget)) {
        const s = this.buildCounter(w, bot.trades);
        if (s) strategies.push(s);
      }
    }

    // Shared weakness exploitation
    strategies.push(...this.exploitShared(topBots));

    this.strategies.push(...strategies);
    this.emit('adversarial:generated', { count: strategies.length });
    return strategies;
  }

  private buildCounter(w: BotWeakness, trades: ObservationEvent[]): AdversarialStrategy | null {
    const entry = this.weaknessToTree(w);
    if (!entry) return null;
    const exit = this.buildExit();
    const simReturn = this.simulate(entry, trades, w);
    if (simReturn <= 0) return null;

    return {
      id: `adv_${++advId}_${Date.now().toString(36)}`,
      targetBotIds: [w.botId], weaknessesExploited: [w],
      entryConditions: entry, exitConditions: exit,
      expectedEdge: w.expectedEdge, simulatedReturn: simReturn,
      confidence: w.confidence, createdAt: Date.now(),
    };
  }

  private weaknessToTree(w: BotWeakness): StrategyNode | null {
    const conditions: StrategyNode[] = [];
    const ts = Date.now().toString(36);

    if (w.conditions.regime) conditions.push(this.regimeNode(w.conditions.regime, ts));
    if (w.conditions.indicators?.rsi?.max) conditions.push(this.cmpNode('RSI', 'LT', w.conditions.indicators.rsi.max, ts));
    if (w.conditions.indicators?.rsi?.min) conditions.push(this.cmpNode('RSI', 'GT', w.conditions.indicators.rsi.min, ts));
    if (w.conditions.volatilityState === 'high') conditions.push(this.cmpNode('ATR', 'GT', 2, ts));
    if (w.conditions.volatilityState === 'low') conditions.push(this.cmpNode('ATR', 'LT', 0.5, ts));
    if (conditions.length === 0) conditions.push(this.cmpNode('RSI', 'LT', 40, ts));

    let combined = conditions[0];
    for (let i = 1; i < conditions.length; i++) {
      combined = { id: `adv_and_${ts}_${i}`, type: 'logical', value: 'AND', children: [combined, conditions[i]] };
    }

    const counter = w.conditions.precedingAction === 'buy' ? 'SELL' : 'BUY';
    return {
      id: `adv_root_${ts}`, type: 'logical', value: 'IF_THEN_ELSE',
      children: [
        combined,
        { id: `adv_a1_${ts}`, type: 'action', value: counter, params: { confidence: 0.7 } },
        { id: `adv_a2_${ts}`, type: 'action', value: 'HOLD', params: { confidence: 0.3 } },
      ],
    };
  }

  private regimeNode(regime: MarketRegime, ts: string): StrategyNode {
    const map: Record<string, { ind: string; op: string; val: number }> = {
      TRENDING: { ind: 'TREND_STRENGTH', op: 'GT', val: 25 },
      RANGING: { ind: 'TREND_STRENGTH', op: 'LT', val: 15 },
      VOLATILE: { ind: 'ATR', op: 'GT', val: 2 },
      BREAKOUT: { ind: 'BB_POSITION', op: 'GT', val: 0.9 },
      QUIET: { ind: 'ATR', op: 'LT', val: 0.5 },
      EVENT: { ind: 'VOLUME_RATIO', op: 'GT', val: 3 },
    };
    const m = map[regime] || map.RANGING;
    return this.cmpNode(m.ind, m.op, m.val, ts);
  }

  private cmpNode(ind: string, op: string, val: number, ts: string): StrategyNode {
    const r = Math.random().toString(36).slice(2, 6);
    return {
      id: `adv_cmp_${ts}_${r}`, type: 'comparator', value: op,
      children: [
        { id: `adv_ind_${ts}_${r}`, type: 'indicator', value: ind },
        { id: `adv_c_${ts}_${r}`, type: 'constant', value: String(val) },
      ],
    };
  }

  private buildExit(): StrategyNode {
    const ts = Date.now().toString(36);
    return {
      id: `adv_exit_${ts}`, type: 'logical', value: 'IF_THEN_ELSE',
      children: [
        this.cmpNode('TREND_STRENGTH', 'GT', 30, ts),
        { id: `adv_ec_${ts}`, type: 'action', value: 'CLOSE', params: { confidence: 0.6 } },
        { id: `adv_eh_${ts}`, type: 'action', value: 'HOLD', params: { confidence: 0.5 } },
      ],
    };
  }

  private exploitShared(bots: { botId: string; trades: ObservationEvent[]; fingerprint?: StrategyFingerprint }[]): AdversarialStrategy[] {
    const strategies: AdversarialStrategy[] = [];
    const all: BotWeakness[] = [];
    for (const b of bots) {
      const cached = this.weaknessCache.get(b.botId);
      if (cached) all.push(...cached);
    }

    const groups = new Map<string, BotWeakness[]>();
    for (const w of all) {
      if (!groups.has(w.regime)) groups.set(w.regime, []);
      groups.get(w.regime)!.push(w);
    }

    for (const [regime, ws] of groups) {
      const unique = new Set(ws.map(w => w.botId));
      if (unique.size >= 2) {
        const avgSev = ws.reduce((s, w) => s + w.severity, 0) / ws.length;
        const avgEdge = ws.reduce((s, w) => s + w.expectedEdge, 0) / ws.length;

        const shared: BotWeakness = {
          botId: 'shared', weakness: `${unique.size} bots weak in ${regime}`,
          regime: regime as MarketRegime, conditions: { regime: regime as MarketRegime },
          severity: Math.min(1, avgSev * this.config.sharedWeaknessBonus),
          frequency: ws.reduce((s, w) => s + w.frequency, 0) / ws.length,
          expectedEdge: avgEdge, sampleSize: ws.reduce((s, w) => s + w.sampleSize, 0),
          confidence: Math.min(0.95, avgSev * unique.size * 0.2),
        };

        const s = this.buildCounter(shared, bots[0].trades);
        if (s) {
          s.targetBotIds = [...unique];
          s.weaknessesExploited = ws;
          strategies.push(s);
        }
      }
    }
    return strategies;
  }

  private simulate(entry: StrategyNode, trades: ObservationEvent[], w: BotWeakness): number {
    const weak = trades.filter(t => {
      const enr = (t as unknown as Record<string, unknown>).enrichment as Record<string, unknown> | undefined;
      return enr?.marketRegime === w.regime;
    });
    if (weak.length === 0) return 0;
    const returns = weak.map(t => (t.payload as Record<string, unknown>).pnl as number || 0);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    return -avg * 0.7 * w.confidence; // opposite of their loss, reduced by slippage & uncertainty
  }

  private calcConfidence(n: number, eff: number): number {
    return Math.min(0.95, Math.min(1, n / 50) * 0.5 + Math.min(1, Math.abs(eff)) * 0.5);
  }

  // ===================== PUBLIC API =====================

  getWeaknesses(botId: string): BotWeakness[] { return this.weaknessCache.get(botId) || []; }
  getAllWeaknesses(): Map<string, BotWeakness[]> { return new Map(this.weaknessCache); }
  getStrategies(): AdversarialStrategy[] { return [...this.strategies]; }

  getStats() {
    let totalW = 0;
    for (const ws of this.weaknessCache.values()) totalW += ws.length;
    return { botsAnalyzed: this.weaknessCache.size, totalWeaknesses: totalW, strategiesGenerated: this.strategies.length };
  }
}
