/**
 * Layer 5: Capital Allocator
 *
 * Thompson Sampling multi-armed bandit for capital allocation.
 * Kelly criterion position sizing.
 * Correlation-aware portfolio optimization.
 *
 * Phase 1: SIMULATION ONLY - no real capital allocation.
 */

import { EventEmitter } from 'events';
import {
  StrategyArm, AllocationDecision, CorrelationMatrix,
  MarketRegime, RegimePerformance, TradeOutcome
} from './types';

// ===================== THOMPSON SAMPLING ENGINE =====================

class ThompsonSampler {
  /**
   * Sample from Beta(alpha, beta) distribution using the
   * Joehnk method (rejection sampling for Beta distribution).
   */
  sampleBeta(alpha: number, beta: number): number {
    // Use the ratio-of-uniforms method for general Beta
    if (alpha <= 0 || beta <= 0) return 0.5;

    // For alpha=1, beta=1 (uniform prior), return uniform random
    if (alpha === 1 && beta === 1) return Math.random();

    // Gamma-based Beta sampling: Beta(a,b) = G(a) / (G(a) + G(b))
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    if (x + y === 0) return 0.5;
    return x / (x + y);
  }

  /**
   * Sample from Gamma(shape, 1) using Marsaglia-Tsang method.
   */
  private sampleGamma(shape: number): number {
    if (shape < 1) {
      // Gamma(shape) = Gamma(shape+1) * U^(1/shape)
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

  /** Box-Muller standard normal */
  private standardNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Select the best arm via Thompson Sampling.
   * Returns arm index with highest sampled value.
   */
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

  /**
   * Get allocation weights via Thompson Sampling.
   * Runs N simulations and uses frequency as weight.
   */
  getAllocationWeights(arms: StrategyArm[], simulations: number = 10000): number[] {
    const counts = new Array(arms.length).fill(0);

    for (let s = 0; s < simulations; s++) {
      const idx = this.selectArm(arms);
      counts[idx]++;
    }

    // Normalize to weights
    return counts.map(c => c / simulations);
  }
}

// ===================== KELLY CRITERION =====================

class KellyCriterion {
  /**
   * Full Kelly fraction: f* = (bp - q) / b
   * where b = win/loss ratio, p = win probability, q = 1-p
   */
  static fullKelly(winRate: number, avgWinSize: number, avgLossSize: number): number {
    if (avgLossSize === 0 || winRate <= 0) return 0;

    const b = avgWinSize / avgLossSize;  // odds ratio
    const p = winRate;
    const q = 1 - p;

    const kelly = (b * p - q) / b;
    return Math.max(0, kelly);  // Never negative (don't bet against yourself)
  }

  /**
   * Half Kelly: More conservative, f* / 2.
   * Preferred in practice due to estimation error.
   */
  static halfKelly(winRate: number, avgWinSize: number, avgLossSize: number): number {
    return this.fullKelly(winRate, avgWinSize, avgLossSize) / 2;
  }

  /**
   * Fractional Kelly with custom fraction.
   */
  static fractionalKelly(
    winRate: number,
    avgWinSize: number,
    avgLossSize: number,
    fraction: number = 0.25  // Quarter Kelly default — very conservative
  ): number {
    return this.fullKelly(winRate, avgWinSize, avgLossSize) * fraction;
  }

  /**
   * Optimal position size given Kelly fraction and risk parameters.
   */
  static positionSize(
    capital: number,
    kellyFraction: number,
    maxRiskPerTrade: number = 0.02,  // 2% max
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
  /**
   * Compute Pearson correlation between two return series.
   */
  static pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }

    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  /**
   * Build correlation matrix from return histories.
   */
  static buildCorrelationMatrix(
    strategyReturns: Map<string, number[]>
  ): CorrelationMatrix {
    const ids = Array.from(strategyReturns.keys());
    const n = ids.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else if (j > i) {
          const corr = this.pearsonCorrelation(
            strategyReturns.get(ids[i])!,
            strategyReturns.get(ids[j])!
          );
          matrix[i][j] = corr;
          matrix[j][i] = corr;
        }
      }
    }

    const minLen = Math.min(
      ...Array.from(strategyReturns.values()).map(r => r.length)
    );

    return {
      strategyIds: ids,
      matrix,
      lastUpdated: Date.now(),
      sampleSize: minLen
    };
  }

  /**
   * Apply correlation penalty to Thompson Sampling weights.
   * Reduces allocation to highly correlated strategies.
   * Uses a simplified mean-variance-like approach.
   */
  static optimizeWithCorrelation(
    weights: number[],
    correlationMatrix: CorrelationMatrix,
    maxCorrelation: number = 0.7,
    penaltyFactor: number = 0.5
  ): number[] {
    const n = weights.length;
    const adjusted = [...weights];
    const { matrix } = correlationMatrix;

    // For each pair, if correlation > threshold, reduce both
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(matrix[i][j]) > maxCorrelation) {
          const penalty = (Math.abs(matrix[i][j]) - maxCorrelation) * penaltyFactor;
          // Penalize the one with lower weight more
          if (adjusted[i] > adjusted[j]) {
            adjusted[j] *= (1 - penalty);
          } else {
            adjusted[i] *= (1 - penalty);
          }
        }
      }
    }

    // Re-normalize
    const sum = adjusted.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return adjusted.map(w => w / sum);
  }

  /**
   * Calculate portfolio variance given weights and correlation matrix.
   */
  static portfolioVariance(
    weights: number[],
    volatilities: number[],
    correlationMatrix: number[][]
  ): number {
    const n = weights.length;
    let variance = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] *
          volatilities[i] * volatilities[j] *
          correlationMatrix[i][j];
      }
    }

    return variance;
  }
}

// ===================== CAPITAL ALLOCATOR (LAYER 5) =====================

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
    this.totalCapital = config.totalCapital || 100000;
    this.rebalanceIntervalMs = config.rebalanceIntervalMs || 60000; // 1 min default
  }

  // ===================== LIFECYCLE =====================

  start(): void {
    this.rebalanceTimer = setInterval(() => {
      this.rebalance();
    }, this.rebalanceIntervalMs);

    // Initialize with demo strategies if empty
    if (this.arms.size === 0) {
      this.initializeDemoStrategies();
    }

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

  /**
   * Record a trade outcome for a strategy arm.
   * Updates Beta distribution parameters for Thompson Sampling.
   */
  recordOutcome(armId: string, outcome: TradeOutcome): void {
    const arm = this.arms.get(armId);
    if (!arm) return;

    // Update Beta distribution
    if (outcome.isWinner) {
      arm.alpha += 1;
      arm.wins += 1;
    } else {
      arm.beta += 1;
      arm.losses += 1;
    }

    arm.totalTrades += 1;
    arm.totalPnL += outcome.pnl;
    arm.winRate = arm.wins / arm.totalTrades;
    arm.avgReturn = arm.totalPnL / arm.totalTrades;

    // Update return history
    const history = this.returnHistories.get(armId) || [];
    history.push(outcome.pnlPercentage);
    if (history.length > 500) history.shift();  // Keep last 500
    this.returnHistories.set(armId, history);

    // Update Kelly fraction
    if (arm.wins > 0 && arm.losses > 0) {
      arm.avgWinSize = arm.totalPnL > 0 ?
        (arm.totalPnL / arm.wins) : Math.abs(arm.avgReturn);
      arm.avgLossSize = arm.losses > 0 ?
        Math.abs((arm.totalPnL - arm.avgWinSize * arm.wins) / arm.losses) : 1;
      arm.kellyFraction = KellyCriterion.halfKelly(
        arm.winRate, arm.avgWinSize, arm.avgLossSize
      );
    }

    // Update Sharpe ratio (rolling)
    if (history.length > 10) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
      const std = Math.sqrt(variance);
      arm.sharpeRatio = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
    }

    // Update max drawdown
    let peak = 0;
    let maxDD = 0;
    let cumReturn = 0;
    for (const ret of history) {
      cumReturn += ret;
      peak = Math.max(peak, cumReturn);
      maxDD = Math.max(maxDD, peak - cumReturn);
    }
    arm.maxDrawdown = maxDD;

    this.arms.set(armId, arm);
    this.emit('outcome:recorded', { armId, outcome, arm });
  }

  // ===================== ALLOCATION =====================

  /**
   * Run Thompson Sampling and produce allocation weights.
   */
  rebalance(): AllocationDecision {
    const armsArray = Array.from(this.arms.values());
    if (armsArray.length === 0) {
      return this.emptyAllocation();
    }

    // Step 1: Thompson Sampling weights
    let weights = this.sampler.getAllocationWeights(armsArray, 10000);

    // Step 2: Apply Kelly criterion scaling
    weights = this.applyKellyScaling(armsArray, weights);

    // Step 3: Regime-aware adjustment
    weights = this.applyRegimeAdjustment(armsArray, weights);

    // Step 4: Correlation optimization
    if (this.returnHistories.size >= 2) {
      this.correlationMatrix = CorrelationOptimizer.buildCorrelationMatrix(
        this.returnHistories
      );
      weights = CorrelationOptimizer.optimizeWithCorrelation(
        weights, this.correlationMatrix
      );
    }

    // Step 5: Build allocation decision
    const allocations = new Map<string, number>();
    for (let i = 0; i < armsArray.length; i++) {
      allocations.set(armsArray[i].id, weights[i]);
      armsArray[i].targetAllocation = weights[i];
      armsArray[i].currentAllocation = weights[i]; // In simulation, instant
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
      if (kelly <= 0) return w * 0.1; // Minimum allocation for exploration
      return w * Math.min(kelly, 0.25); // Cap at 25% Kelly
    });

    const sum = scaled.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return scaled.map(w => w / sum);
  }

  private applyRegimeAdjustment(arms: StrategyArm[], weights: number[]): number[] {
    const adjusted = weights.map((w, i) => {
      const regimePerf = arms[i].performanceByRegime[this.currentRegime];
      if (!regimePerf || regimePerf.trades < 5) return w; // Not enough data

      // Boost strategies that perform well in current regime
      const regimeMultiplier = regimePerf.winRate > 0.5 ?
        1 + (regimePerf.winRate - 0.5) : // Up to 1.5x boost
        1 - (0.5 - regimePerf.winRate) * 0.5; // Up to 0.75x penalty

      return w * regimeMultiplier;
    });

    const sum = adjusted.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return adjusted.map(w => w / sum);
  }

  private calculateConfidence(arms: StrategyArm[]): number {
    // Confidence based on total observations
    const totalTrades = arms.reduce((sum, a) => sum + a.totalTrades, 0);
    const dataConfidence = Math.min(1, totalTrades / 100); // Full confidence at 100 trades

    // Confidence based on consistency of allocations
    const weights = arms.map(a => a.targetAllocation);
    const entropy = this.shannonEntropy(weights);
    const maxEntropy = Math.log(arms.length);
    const diversification = maxEntropy > 0 ? entropy / maxEntropy : 0;

    return (dataConfidence * 0.6 + diversification * 0.4);
  }

  private shannonEntropy(weights: number[]): number {
    return -weights
      .filter(w => w > 0)
      .reduce((sum, w) => sum + w * Math.log(w), 0);
  }

  private emptyAllocation(): AllocationDecision {
    return {
      timestamp: Date.now(),
      allocations: new Map(),
      totalCapital: this.totalCapital,
      method: 'thompson_sampling',
      confidence: 0,
      regime: this.currentRegime,
    };
  }

  // ===================== REGIME =====================

  setRegime(regime: MarketRegime): void {
    if (this.currentRegime !== regime) {
      this.currentRegime = regime;
      this.emit('regime:changed', { from: this.currentRegime, to: regime });
      this.rebalance(); // Re-allocate on regime change
    }
  }

  // ===================== GETTERS =====================

  getArms(): StrategyArm[] {
    return Array.from(this.arms.values());
  }

  getArm(id: string): StrategyArm | undefined {
    return this.arms.get(id);
  }

  getAllocation(): AllocationDecision | null {
    return this.lastAllocation;
  }

  getCorrelationMatrix(): CorrelationMatrix | null {
    return this.correlationMatrix;
  }

  getTotalCapital(): number {
    return this.totalCapital;
  }

  getAllocationHistory(): AllocationDecision[] {
    return this.allocationHistory;
  }

  getKellyPositionSize(armId: string, maxRisk: number = 0.02): number {
    const arm = this.arms.get(armId);
    if (!arm) return 0;
    return KellyCriterion.positionSize(
      this.totalCapital * arm.currentAllocation,
      arm.kellyFraction,
      maxRisk
    );
  }

  // ===================== DEMO DATA =====================

  private initializeDemoStrategies(): void {
    const strategies: StrategyArm[] = [
      this.createArm('momentum', 'Momentum Breakout', 12, 8, 0.6),
      this.createArm('mean-reversion', 'Mean Reversion', 10, 10, 0.5),
      this.createArm('trend-follow', 'Trend Following', 15, 5, 0.75),
      this.createArm('volatility-arb', 'Volatility Arbitrage', 8, 12, 0.4),
      this.createArm('ict-smart-money', 'ICT Smart Money', 11, 9, 0.55),
      this.createArm('regime-adaptive', 'Regime Adaptive', 13, 7, 0.65),
    ];

    for (const arm of strategies) {
      this.addArm(arm);
    }

    // Seed return histories with simulated data
    for (const arm of strategies) {
      const returns: number[] = [];
      for (let i = 0; i < 50; i++) {
        const r = (Math.random() - (1 - arm.winRate)) * 0.04;
        returns.push(r);
      }
      this.returnHistories.set(arm.id, returns);
    }

    // Run initial allocation
    this.rebalance();
  }

  private createArm(
    id: string,
    name: string,
    alpha: number,
    beta: number,
    winRate: number
  ): StrategyArm {
    const avgWinSize = 0.015;
    const avgLossSize = 0.01;
    return {
      id,
      name,
      alpha,
      beta,
      totalTrades: alpha + beta - 2,
      wins: alpha - 1,
      losses: beta - 1,
      totalPnL: (alpha - 1) * avgWinSize - (beta - 1) * avgLossSize,
      avgReturn: ((alpha - 1) * avgWinSize - (beta - 1) * avgLossSize) / Math.max(1, alpha + beta - 2),
      sharpeRatio: winRate > 0.5 ? 1.2 + Math.random() : 0.5 + Math.random() * 0.5,
      maxDrawdown: 0.02 + Math.random() * 0.03,
      kellyFraction: KellyCriterion.halfKelly(winRate, avgWinSize, avgLossSize),
      winRate,
      avgWinSize,
      avgLossSize,
      currentAllocation: 0,
      targetAllocation: 0,
      performanceByRegime: {
        TRENDING: { trades: 10, winRate: winRate + 0.1, avgReturn: 0.02, sharpeRatio: 1.5 },
        RANGING: { trades: 8, winRate: winRate - 0.05, avgReturn: 0.005, sharpeRatio: 0.8 },
        VOLATILE: { trades: 6, winRate: winRate - 0.1, avgReturn: 0.01, sharpeRatio: 0.6 },
        BREAKOUT: { trades: 4, winRate: winRate + 0.15, avgReturn: 0.03, sharpeRatio: 2.0 },
        EVENT: { trades: 3, winRate: 0.5, avgReturn: 0, sharpeRatio: 0 },
        QUIET: { trades: 5, winRate: winRate, avgReturn: 0.003, sharpeRatio: 0.4 },
      },
    };
  }
}

// Export utilities for external use
export { KellyCriterion, CorrelationOptimizer, ThompsonSampler };
