/**
 * Capital Allocator (from Layer 5)
 *
 * Thompson Sampling multi-armed bandit for capital allocation.
 * Kelly criterion position sizing.
 * Correlation-aware portfolio optimization.
 *
 * Phase 4: Wired to execution engine — no demo data, real outcomes only.
 */

import { EventEmitter } from 'events';
import {
  StrategyArm, AllocationDecision, CorrelationMatrix,
  MarketRegime, RegimePerformance, TradeOutcome
} from './types';

// ===================== THOMPSON SAMPLING ENGINE =====================

class ThompsonSampler {
  sampleBeta(alpha: number, beta: number): number {
    if (alpha <= 0 || beta <= 0) return 0.5;
    if (alpha === 1 && beta === 1) return Math.random();
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    if (x + y === 0) return 0.5;
    return x / (x + y);
  }

  private sampleGamma(shape: number): number {
    if (shape < 1) {
      return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x: number, v: number;
      do {
        x = this.standardNormal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  private standardNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  selectArm(arms: StrategyArm[]): number {
    let bestSample = -Infinity;
    let bestIdx = 0;
    for (let i = 0; i < arms.length; i++) {
      const sample = this.sampleBeta(arms[i].alpha, arms[i].beta);
      if (sample > bestSample) {
        bestSample = sample;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  getAllocationWeights(arms: StrategyArm[], simulations: number = 10000): number[] {
    const counts = new Array(arms.length).fill(0);
    for (let s = 0; s < simulations; s++) {
      const idx = this.selectArm(arms);
      counts[idx]++;
    }
    return counts.map(c => c / simulations);
  }
}

// ===================== KELLY CRITERION =====================

class KellyCriterion {
  static fullKelly(winRate: number, avgWinSize: number, avgLossSize: number): number {
    if (avgLossSize === 0 || winRate <= 0) return 0;
    const b = avgWinSize / avgLossSize;
    const p = winRate;
    const q = 1 - p;
    const kelly = (b * p - q) / b;
    return Math.max(0, kelly);
  }

  static halfKelly(winRate: number, avgWinSize: number, avgLossSize: number): number {
    return this.fullKelly(winRate, avgWinSize, avgLossSize) / 2;
  }

  static fractionalKelly(
    winRate: number,
    avgWinSize: number,
    avgLossSize: number,
    fraction: number = 0.25
  ): number {
    return this.fullKelly(winRate, avgWinSize, avgLossSize) * fraction;
  }

  static positionSize(
    capital: number,
    kellyFraction: number,
    maxRiskPerTrade: number = 0.02,
    volatilityScalar: number = 1.0
  ): number {
    const kellySize = capital * kellyFraction;
    const maxSize = capital * maxRiskPerTrade;
    const scaledSize = kellySize * volatilityScalar;
    return Math.min(scaledSize, maxSize);
  }
}

// ===================== CORRELATION OPTIMIZER =====================

class CorrelationOptimizer {
  static pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
    }
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  static buildCorrelationMatrix(strategyReturns: Map<string, number[]>): CorrelationMatrix {
    const ids = Array.from(strategyReturns.keys());
    const n = ids.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) { matrix[i][j] = 1; }
        else if (j > i) {
          const corr = this.pearsonCorrelation(
            strategyReturns.get(ids[i])!, strategyReturns.get(ids[j])!
          );
          matrix[i][j] = corr; matrix[j][i] = corr;
        }
      }
    }
    const minLen = Math.min(...Array.from(strategyReturns.values()).map(r => r.length));
    return { strategyIds: ids, matrix, lastUpdated: Date.now(), sampleSize: minLen };
  }

  static optimizeWithCorrelation(
    weights: number[],
    correlationMatrix: CorrelationMatrix,
    maxCorrelation: number = 0.7,
    penaltyFactor: number = 0.5
  ): number[] {
    const n = weights.length;
    const adjusted = [...weights];
    const { matrix } = correlationMatrix;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(matrix[i][j]) > maxCorrelation) {
          const penalty = (Math.abs(matrix[i][j]) - maxCorrelation) * penaltyFactor;
          if (adjusted[i] > adjusted[j]) { adjusted[j] *= (1 - penalty); }
          else { adjusted[i] *= (1 - penalty); }
        }
      }
    }
    const sum = adjusted.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return adjusted.map(w => w / sum);
  }
}

// ===================== CAPITAL ALLOCATOR =====================

export class CapitalAllocator extends EventEmitter {
  private arms: Map<string, StrategyArm> = new Map();
  private sampler = new ThompsonSampler();
  private returnHistories: Map<string, number[]> = new Map();
  private correlationMatrix: CorrelationMatrix | null = null;
  private lastAllocation: AllocationDecision | null = null;
  private totalCapital: number;
  private rebalanceIntervalMs: number;
  private rebalanceTimer: ReturnType<typeof setInterval> | null = null;
  private currentRegime: MarketRegime = 'QUIET';
  private allocationHistory: AllocationDecision[] = [];

  constructor(config: {
    totalCapital?: number;
    rebalanceIntervalMs?: number;
  } = {}) {
    super();
    this.totalCapital = config.totalCapital || 5000;
    this.rebalanceIntervalMs = config.rebalanceIntervalMs || 60000;
  }

  // ===================== LIFECYCLE =====================

  start(): void {
    this.rebalanceTimer = setInterval(() => {
      this.rebalance();
    }, this.rebalanceIntervalMs);
    this.emit('started');
  }

  stop(): void {
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
      this.rebalanceTimer = null;
    }
    this.emit('stopped');
  }

  // ===================== STRATEGY ARM MANAGEMENT =====================

  addArm(arm: StrategyArm): void {
    this.arms.set(arm.id, arm);
    this.returnHistories.set(arm.id, []);
    this.emit('arm:added', arm);
  }

  removeArm(id: string): void {
    this.arms.delete(id);
    this.returnHistories.delete(id);
    this.emit('arm:removed', { id });
  }

  recordOutcome(armId: string, outcome: TradeOutcome): void {
    const arm = this.arms.get(armId);
    if (!arm) return;

    if (outcome.isWinner) { arm.alpha += 1; arm.wins += 1; }
    else { arm.beta += 1; arm.losses += 1; }

    arm.totalTrades += 1;
    arm.totalPnL += outcome.pnl;
    arm.winRate = arm.wins / arm.totalTrades;
    arm.avgReturn = arm.totalPnL / arm.totalTrades;

    const history = this.returnHistories.get(armId) || [];
    history.push(outcome.pnlPercentage);
    if (history.length > 500) history.shift();
    this.returnHistories.set(armId, history);

    if (arm.wins > 0 && arm.losses > 0) {
      arm.avgWinSize = arm.totalPnL > 0 ?
        (arm.totalPnL / arm.wins) : Math.abs(arm.avgReturn);
      arm.avgLossSize = arm.losses > 0 ?
        Math.abs((arm.totalPnL - arm.avgWinSize * arm.wins) / arm.losses) : 1;
      arm.kellyFraction = KellyCriterion.halfKelly(arm.winRate, arm.avgWinSize, arm.avgLossSize);
    }

    if (history.length > 10) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
      const std = Math.sqrt(variance);
      arm.sharpeRatio = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
    }

    let peak = 0; let maxDD = 0; let cumReturn = 0;
    for (const ret of history) {
      cumReturn += ret; peak = Math.max(peak, cumReturn);
      maxDD = Math.max(maxDD, peak - cumReturn);
    }
    arm.maxDrawdown = maxDD;

    this.arms.set(armId, arm);
    this.emit('outcome:recorded', { armId, outcome, arm });
  }

  // ===================== ALLOCATION =====================

  rebalance(): AllocationDecision {
    const armsArray = Array.from(this.arms.values());
    if (armsArray.length === 0) return this.emptyAllocation();

    let weights = this.sampler.getAllocationWeights(armsArray, 10000);
    weights = this.applyKellyScaling(armsArray, weights);
    weights = this.applyRegimeAdjustment(armsArray, weights);

    if (this.returnHistories.size >= 2) {
      this.correlationMatrix = CorrelationOptimizer.buildCorrelationMatrix(this.returnHistories);
      weights = CorrelationOptimizer.optimizeWithCorrelation(weights, this.correlationMatrix);
    }

    const allocations = new Map<string, number>();
    for (let i = 0; i < armsArray.length; i++) {
      allocations.set(armsArray[i].id, weights[i]);
      armsArray[i].targetAllocation = weights[i];
      armsArray[i].currentAllocation = weights[i];
      this.arms.set(armsArray[i].id, armsArray[i]);
    }

    const decision: AllocationDecision = {
      timestamp: Date.now(),
      allocations,
      totalCapital: this.totalCapital,
      method: this.correlationMatrix ? 'correlation_optimized' : 'thompson_sampling',
      confidence: this.calculateConfidence(armsArray),
      regime: this.currentRegime,
    };

    this.lastAllocation = decision;
    this.allocationHistory.push(decision);
    if (this.allocationHistory.length > 1000) this.allocationHistory.shift();

    this.emit('allocation:updated', decision);
    return decision;
  }

  private applyKellyScaling(arms: StrategyArm[], weights: number[]): number[] {
    const scaled = weights.map((w, i) => {
      const kelly = arms[i].kellyFraction;
      if (kelly <= 0) return w * 0.1;
      return w * Math.min(kelly, 0.25);
    });
    const sum = scaled.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return scaled.map(w => w / sum);
  }

  private applyRegimeAdjustment(arms: StrategyArm[], weights: number[]): number[] {
    const adjusted = weights.map((w, i) => {
      const regimePerf = arms[i].performanceByRegime[this.currentRegime];
      if (!regimePerf || regimePerf.trades < 5) return w;
      const regimeMultiplier = regimePerf.winRate > 0.5 ?
        1 + (regimePerf.winRate - 0.5) :
        1 - (0.5 - regimePerf.winRate) * 0.5;
      return w * regimeMultiplier;
    });
    const sum = adjusted.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return adjusted.map(w => w / sum);
  }

  private calculateConfidence(arms: StrategyArm[]): number {
    const totalTrades = arms.reduce((sum, a) => sum + a.totalTrades, 0);
    const dataConfidence = Math.min(1, totalTrades / 100);
    const weights = arms.map(a => a.targetAllocation);
    const entropy = this.shannonEntropy(weights);
    const maxEntropy = Math.log(arms.length);
    const diversification = maxEntropy > 0 ? entropy / maxEntropy : 0;
    return (dataConfidence * 0.6 + diversification * 0.4);
  }

  private shannonEntropy(weights: number[]): number {
    return -weights.filter(w => w > 0).reduce((sum, w) => sum + w * Math.log(w), 0);
  }

  private emptyAllocation(): AllocationDecision {
    return {
      timestamp: Date.now(), allocations: new Map(), totalCapital: this.totalCapital,
      method: 'thompson_sampling', confidence: 0, regime: this.currentRegime,
    };
  }

  // ===================== SETTERS =====================

  setRegime(regime: MarketRegime): void {
    if (this.currentRegime !== regime) {
      const from = this.currentRegime;
      this.currentRegime = regime;
      this.emit('regime:changed', { from, to: regime });
      this.rebalance();
    }
  }

  setTotalCapital(capital: number): void {
    this.totalCapital = capital;
    this.emit('capital:updated', { totalCapital: capital });
  }

  // ===================== GETTERS =====================

  getArms(): StrategyArm[] { return Array.from(this.arms.values()); }
  getArm(id: string): StrategyArm | undefined { return this.arms.get(id); }
  getAllocation(): AllocationDecision | null { return this.lastAllocation; }
  getCorrelationMatrix(): CorrelationMatrix | null { return this.correlationMatrix; }
  getTotalCapital(): number { return this.totalCapital; }
  getAllocationHistory(): AllocationDecision[] { return this.allocationHistory; }

  getKellyPositionSize(armId: string, maxRisk: number = 0.02): number {
    const arm = this.arms.get(armId);
    if (!arm) return 0;
    return KellyCriterion.positionSize(
      this.totalCapital * arm.currentAllocation, arm.kellyFraction, maxRisk
    );
  }
}

export { KellyCriterion, CorrelationOptimizer, ThompsonSampler };
