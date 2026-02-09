import { EventEmitter } from 'events';
import {
  ManagedStrategy,
  BehavioralVector,
  ArenaBotTradeEvent,
} from '../types';
import { StateStore } from '../utils/StateStore';

const K_NEIGHBORS = 15;
const ARCHIVE_MAX_SIZE = 200;
const NOVELTY_WEIGHT = 0.3;
const PERFORMANCE_WEIGHT = 0.7;

// Behavioral dimension ranges for normalization
const BEHAVIOR_DIMS = [
  'avgHoldingPeriod',
  'tradeFrequency',
  'directionBias',
  'entryPatternCluster',
  'volatilityAffinity',
] as const;

function behaviorToVector(b: BehavioralVector): number[] {
  return [
    b.avgHoldingPeriod,
    b.tradeFrequency,
    (b.directionBias + 1) / 2, // normalize from [-1,1] to [0,1]
    ...b.regimePreference,
    b.entryPatternCluster,
    b.volatilityAffinity,
  ];
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export class NoveltySearch extends EventEmitter {
  private store: StateStore;
  private archive: BehavioralVector[] = [];
  private noveltyWeight: number;

  constructor(store: StateStore) {
    super();
    this.store = store;
    this.noveltyWeight = NOVELTY_WEIGHT;
  }

  initialize(): void {
    this.archive = this.store.getNoveltyArchive();
    console.log(`[NoveltySearch] Initialized with ${this.archive.length} archived behaviors`);
  }

  setNoveltyWeight(weight: number): void {
    this.noveltyWeight = Math.max(0.1, Math.min(0.5, weight));
  }

  extractBehavior(strategy: ManagedStrategy, trades: ArenaBotTradeEvent[]): BehavioralVector {
    if (trades.length === 0) {
      return strategy.behavioralFingerprint;
    }

    // Average holding period (normalized by max observed)
    // Approximate via inter-trade timing
    let avgHoldingPeriod = 0;
    if (trades.length > 1) {
      const timestamps = trades.map(t => new Date(t.timestamp).getTime());
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      // Normalize to 0-1 (assume max is 1 hour = 3600000ms)
      avgHoldingPeriod = Math.min(1, avgInterval / 3600000);
    }

    // Trade frequency: trades per minute, normalized
    const timeSpan = trades.length > 1
      ? new Date(trades[trades.length - 1].timestamp).getTime() - new Date(trades[0].timestamp).getTime()
      : 60000;
    const tradesPerMinute = timeSpan > 0 ? (trades.length / (timeSpan / 60000)) : 0;
    const tradeFrequency = Math.min(1, tradesPerMinute / 10); // cap at 10 trades/min

    // Direction bias: -1 (all sells) to 1 (all buys)
    const buys = trades.filter(t => t.side === 'buy').length;
    const directionBias = trades.length > 0 ? (2 * buys / trades.length) - 1 : 0;

    // Regime preference: based on DNA regime filters
    const dna = strategy.dna;
    const regimePreference = [
      dna.regimeFilter.trendFollowBias > 0 ? dna.regimeFilter.trendFollowBias : 0,
      dna.regimeFilter.trendFollowBias < 0 ? -dna.regimeFilter.trendFollowBias : 0,
      dna.regimeFilter.volatilityPreference,
      1 - dna.regimeFilter.volatilityPreference,
      dna.regimeFilter.sessionPreference,
      dna.regimeFilter.correlationAwareness,
    ];

    // Entry pattern cluster: dominant signal weight
    const signals = dna.entrySignals;
    const signalValues = Object.values(signals);
    const maxSignal = Math.max(...signalValues);
    const entryPatternCluster = maxSignal;

    // Volatility affinity
    const volatilityAffinity = dna.regimeFilter.volatilityPreference;

    return {
      avgHoldingPeriod,
      tradeFrequency,
      directionBias,
      regimePreference,
      entryPatternCluster,
      volatilityAffinity,
    };
  }

  calculateNovelty(behavior: BehavioralVector, population: BehavioralVector[]): number {
    const bVec = behaviorToVector(behavior);
    const allBehaviors = [...population.map(behaviorToVector), ...this.archive.map(behaviorToVector)];

    if (allBehaviors.length === 0) return 1.0;

    // Calculate distances to all points
    const distances = allBehaviors.map(other => euclideanDistance(bVec, other));

    // Sort and take k nearest
    distances.sort((a, b) => a - b);
    const k = Math.min(K_NEIGHBORS, distances.length);
    const kNearest = distances.slice(0, k);

    // Novelty = mean distance to k-nearest
    const novelty = kNearest.reduce((s, d) => s + d, 0) / k;

    // Normalize (max possible distance in 11D unit space is sqrt(11) ≈ 3.3)
    return Math.min(1, novelty / 3.3);
  }

  adjustFitness(strategies: ManagedStrategy[]): ManagedStrategy[] {
    const behaviors = strategies.map(s => s.behavioralFingerprint);

    for (const strategy of strategies) {
      const noveltyScore = this.calculateNovelty(strategy.behavioralFingerprint, behaviors);
      strategy.noveltyScore = noveltyScore;

      // Combined fitness is calculated by the consumer using:
      // adjustedFitness = PERFORMANCE_WEIGHT * performanceFitness + noveltyWeight * noveltyScore
    }

    this.emit('fitness:adjusted', strategies.length);
    return strategies;
  }

  getAdjustedFitness(strategy: ManagedStrategy): number {
    const perfWeight = 1 - this.noveltyWeight;

    // Normalize performance to 0-1 scale
    // Sharpe-based performance: map [-2, 3] to [0, 1]
    const perfScore = Math.max(0, Math.min(1, (strategy.metrics.sharpeRatio + 2) / 5));

    return perfWeight * perfScore + this.noveltyWeight * strategy.noveltyScore;
  }

  updateArchive(behavior: BehavioralVector): void {
    const novelty = this.calculateNovelty(behavior, []);

    if (this.archive.length < ARCHIVE_MAX_SIZE) {
      this.archive.push(behavior);
    } else {
      // Replace least novel archive member
      let minNovelty = Infinity;
      let minIdx = 0;
      for (let i = 0; i < this.archive.length; i++) {
        const n = this.calculateNovelty(this.archive[i], this.archive.filter((_, j) => j !== i));
        if (n < minNovelty) {
          minNovelty = n;
          minIdx = i;
        }
      }
      if (novelty > minNovelty) {
        this.archive[minIdx] = behavior;
      }
    }

    this.store.setNoveltyArchive(this.archive);
  }

  getDiversityReport(): { dimensions: string[]; spread: number[]; convergenceWarnings: string[] } {
    const dimensions = [...BEHAVIOR_DIMS, 'regime0', 'regime1', 'regime2', 'regime3', 'regime4', 'regime5'];
    const vectors = this.archive.map(behaviorToVector);

    if (vectors.length < 2) {
      return { dimensions, spread: dimensions.map(() => 0), convergenceWarnings: ['Insufficient data'] };
    }

    // Calculate spread (stddev) per dimension
    const spread: number[] = [];
    const warnings: string[] = [];

    for (let d = 0; d < vectors[0].length && d < dimensions.length; d++) {
      const values = vectors.map(v => v[d]);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);
      spread.push(std);

      if (std < 0.05) {
        warnings.push(`${dimensions[d]}: converged (std=${std.toFixed(3)})`);
      }
    }

    return { dimensions, spread, convergenceWarnings: warnings };
  }

  getArchiveSize(): number {
    return this.archive.length;
  }
}
