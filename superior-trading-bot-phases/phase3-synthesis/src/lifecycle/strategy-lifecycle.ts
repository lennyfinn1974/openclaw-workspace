/**
 * Strategy Lifecycle Manager
 *
 * Manages the complete lifecycle of synthesized strategies:
 *   BIRTH → INCUBATION → PAPER → VALIDATION → LIVE → RETIREMENT
 *
 * - BIRTH: Strategy just created by GP/NMF/Adversarial
 * - INCUBATION: Being evolved and backtested (min N generations)
 * - PAPER: Running in paper trading with realistic slippage
 * - VALIDATION: Paper results being statistically validated
 * - LIVE: (Future) Allocated real capital
 * - RETIREMENT: Performance decayed or superseded
 *
 * Promotion/demotion happens automatically based on criteria.
 * Strategies have health scores that decay over time.
 */

import { EventEmitter } from 'events';
import {
  LifecycleStage, StrategyLifecycle, LifecycleConfig, PromotionCriteria,
  StrategyMetrics, PaperTradingResult, StrategyNode,
} from '../types';

const DEFAULT_CONFIG: LifecycleConfig = {
  incubationGenerations: 10,
  paperTradingMinHours: 4,
  paperTradingMinTrades: 20,
  validationMinScore: 0.6,
  maxActiveStrategies: 30,
  retirementThreshold: 0.2,
  decayHalfLifeHours: 48,
  healthCheckIntervalMs: 60000,
};

const PROMOTION_CRITERIA: Record<string, PromotionCriteria> = {
  INCUBATION_TO_PAPER: {
    stage: 'INCUBATION', minFitness: 0.4, minTrades: 10,
    maxDrawdown: 0.15, minWinRate: 0.45, minSharpe: 0.5, minDegradationRatio: 0.4,
  },
  PAPER_TO_VALIDATION: {
    stage: 'PAPER', minFitness: 0.5, minTrades: 20,
    maxDrawdown: 0.10, minWinRate: 0.48, minSharpe: 0.8, minDegradationRatio: 0.5,
  },
  VALIDATION_TO_LIVE: {
    stage: 'VALIDATION', minFitness: 0.6, minTrades: 30,
    maxDrawdown: 0.08, minWinRate: 0.50, minSharpe: 1.0, minDegradationRatio: 0.6,
  },
};

export class StrategyLifecycleManager extends EventEmitter {
  private config: LifecycleConfig;
  private strategies: Map<string, StrategyLifecycle> = new Map();
  private retired: Map<string, StrategyLifecycle> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<LifecycleConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===================== LIFECYCLE MANAGEMENT =====================

  /**
   * Register a new strategy at BIRTH stage.
   */
  birth(strategyId: string, tree: StrategyNode, source: StrategyLifecycle['source'], generation: number, parentIds: string[] = []): void {
    if (this.strategies.has(strategyId)) return;

    const now = Date.now();
    const lifecycle: StrategyLifecycle = {
      strategyId, stage: 'BIRTH', tree, source,
      createdAt: now, generation, parentIds,
      incubationMetrics: null, paperMetrics: null, validationScore: 0,
      promotionHistory: [{ from: 'BIRTH' as LifecycleStage, to: 'BIRTH', at: now, reason: 'Created' }],
      lastUpdated: now,
      currentAllocation: 0, lifetimeReturn: 0,
      decayRate: 0, healthScore: 1.0,
    };

    this.strategies.set(strategyId, lifecycle);
    this.emit('lifecycle:birth', { strategyId, source });

    // Auto-promote to INCUBATION
    this.promote(strategyId, 'INCUBATION', 'Auto-promoted from BIRTH');
  }

  /**
   * Update incubation metrics (called after GP evaluation).
   */
  updateIncubationMetrics(strategyId: string, metrics: StrategyMetrics, generation: number): void {
    const lc = this.strategies.get(strategyId);
    if (!lc || lc.stage !== 'INCUBATION') return;

    lc.incubationMetrics = metrics;
    lc.generation = generation;
    lc.lastUpdated = Date.now();

    // Check if ready for paper trading
    const generationsSinceBirth = generation - (lc.promotionHistory[0]?.at ? 0 : 0);
    if (generationsSinceBirth >= this.config.incubationGenerations) {
      if (this.meetsPromotion(lc, PROMOTION_CRITERIA.INCUBATION_TO_PAPER)) {
        this.promote(strategyId, 'PAPER', `Fitness=${metrics.effectiveFitness.toFixed(3)}, WR=${(metrics.winRate * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Update paper trading metrics.
   */
  updatePaperMetrics(strategyId: string, result: PaperTradingResult): void {
    const lc = this.strategies.get(strategyId);
    if (!lc || lc.stage !== 'PAPER') return;

    lc.paperMetrics = result;
    lc.lastUpdated = Date.now();
    lc.lifetimeReturn = result.totalReturnPct;

    const elapsedHours = (Date.now() - result.startTime) / (1000 * 60 * 60);

    // Check if ready for validation
    if (elapsedHours >= this.config.paperTradingMinHours && result.tradeCount >= this.config.paperTradingMinTrades) {
      const criteria = PROMOTION_CRITERIA.PAPER_TO_VALIDATION;
      const passesReturn = result.totalReturnPct > 0;
      const passesDD = result.maxDrawdownPct <= criteria.maxDrawdown;
      const passesWR = result.winRate >= criteria.minWinRate;
      const passesSharpe = result.sharpeRatio >= criteria.minSharpe;

      if (passesReturn && passesDD && passesWR && passesSharpe) {
        this.promote(strategyId, 'VALIDATION',
          `Return=${(result.totalReturnPct * 100).toFixed(2)}%, DD=${(result.maxDrawdownPct * 100).toFixed(1)}%, Sharpe=${result.sharpeRatio.toFixed(2)}`
        );
      } else if (result.totalReturnPct < -0.03 || result.maxDrawdownPct > 0.15) {
        this.retire(strategyId, `Paper trading failed: Return=${(result.totalReturnPct * 100).toFixed(2)}%, DD=${(result.maxDrawdownPct * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Set validation score (from walk-forward / regime stress tests).
   */
  updateValidationScore(strategyId: string, score: number): void {
    const lc = this.strategies.get(strategyId);
    if (!lc || lc.stage !== 'VALIDATION') return;

    lc.validationScore = score;
    lc.lastUpdated = Date.now();

    if (score >= this.config.validationMinScore) {
      this.promote(strategyId, 'LIVE', `Validation score=${score.toFixed(3)}`);
    } else if (score < 0.3) {
      this.retire(strategyId, `Validation failed: score=${score.toFixed(3)}`);
    }
  }

  // ===================== PROMOTION & RETIREMENT =====================

  private promote(strategyId: string, to: LifecycleStage, reason: string): void {
    const lc = this.strategies.get(strategyId);
    if (!lc) return;

    const from = lc.stage;
    lc.stage = to;
    lc.lastUpdated = Date.now();
    lc.promotionHistory.push({ from, to, at: Date.now(), reason });

    this.emit('lifecycle:promoted', { strategyId, from, to, reason });

    // Enforce max active strategies
    this.enforceCapacity();
  }

  retire(strategyId: string, reason: string): void {
    const lc = this.strategies.get(strategyId);
    if (!lc) return;

    const from = lc.stage;
    lc.stage = 'RETIREMENT';
    lc.lastUpdated = Date.now();
    lc.promotionHistory.push({ from, to: 'RETIREMENT', at: Date.now(), reason });

    this.strategies.delete(strategyId);
    this.retired.set(strategyId, lc);

    this.emit('lifecycle:retired', { strategyId, from, reason });
  }

  private meetsPromotion(lc: StrategyLifecycle, criteria: PromotionCriteria): boolean {
    const m = lc.incubationMetrics;
    if (!m) return false;
    return (
      m.effectiveFitness >= criteria.minFitness &&
      m.tradeCount >= criteria.minTrades &&
      m.maxDrawdown <= criteria.maxDrawdown &&
      m.winRate >= criteria.minWinRate &&
      m.sharpeRatio >= criteria.minSharpe &&
      m.degradationRatio >= criteria.minDegradationRatio
    );
  }

  private enforceCapacity(): void {
    const active = this.getActiveStrategies();
    if (active.length <= this.config.maxActiveStrategies) return;

    // Retire lowest health score strategies
    const sorted = active.sort((a, b) => a.healthScore - b.healthScore);
    const excess = active.length - this.config.maxActiveStrategies;
    for (let i = 0; i < excess; i++) {
      this.retire(sorted[i].strategyId, 'Population overflow — lowest health retired');
    }
  }

  // ===================== HEALTH DECAY =====================

  startHealthChecks(): void {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(() => this.runHealthCheck(), this.config.healthCheckIntervalMs);
  }

  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private runHealthCheck(): void {
    const now = Date.now();
    const halfLifeMs = this.config.decayHalfLifeHours * 60 * 60 * 1000;

    for (const [id, lc] of this.strategies) {
      const age = now - lc.createdAt;
      const decayFactor = Math.pow(0.5, age / halfLifeMs);

      // Base health from metrics
      let baseHealth = 0.5;
      if (lc.incubationMetrics) {
        baseHealth = Math.max(0, lc.incubationMetrics.effectiveFitness);
      }
      if (lc.paperMetrics) {
        const paperHealth = lc.paperMetrics.totalReturnPct > 0 ? 0.7 : 0.3;
        baseHealth = Math.max(baseHealth, paperHealth);
      }

      lc.healthScore = baseHealth * decayFactor;
      lc.decayRate = 1 - decayFactor;

      // Retire if health too low
      if (lc.healthScore < this.config.retirementThreshold && lc.stage !== 'BIRTH' && lc.stage !== 'INCUBATION') {
        this.retire(id, `Health decay: score=${lc.healthScore.toFixed(3)}`);
      }
    }

    this.emit('health:checked', { active: this.strategies.size, retired: this.retired.size });
  }

  // ===================== PUBLIC API =====================

  getStrategy(strategyId: string): StrategyLifecycle | undefined {
    return this.strategies.get(strategyId);
  }

  getActiveStrategies(): StrategyLifecycle[] {
    return [...this.strategies.values()];
  }

  getRetiredStrategies(): StrategyLifecycle[] {
    return [...this.retired.values()];
  }

  getByStage(stage: LifecycleStage): StrategyLifecycle[] {
    return [...this.strategies.values()].filter(lc => lc.stage === stage);
  }

  getCountByStage(): Record<LifecycleStage, number> {
    const counts: Record<string, number> = {
      BIRTH: 0, INCUBATION: 0, PAPER: 0, VALIDATION: 0, LIVE: 0, RETIREMENT: this.retired.size,
    };
    for (const lc of this.strategies.values()) {
      counts[lc.stage] = (counts[lc.stage] || 0) + 1;
    }
    return counts as Record<LifecycleStage, number>;
  }

  getStats() {
    const counts = this.getCountByStage();
    const active = this.getActiveStrategies();
    const avgHealth = active.length > 0
      ? active.reduce((s, lc) => s + lc.healthScore, 0) / active.length
      : 0;

    return {
      totalActive: this.strategies.size,
      totalRetired: this.retired.size,
      countByStage: counts,
      avgHealthScore: avgHealth,
      oldestAge: active.length > 0 ? Date.now() - Math.min(...active.map(lc => lc.createdAt)) : 0,
    };
  }
}
