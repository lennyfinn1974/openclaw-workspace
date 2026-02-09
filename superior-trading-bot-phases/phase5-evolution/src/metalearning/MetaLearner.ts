import { EventEmitter } from 'events';
import {
  MetaParameters,
  MetaTuningEntry,
  ManagedStrategy,
  CompetitorThreat,
} from '../types';
import { StateStore } from '../utils/StateStore';

const TUNING_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_HISTORY = 100;

// Parameter ranges
const PARAM_RANGES: Record<string, [number, number]> = {
  mutationRate: [0.05, 0.30],
  selectionPressure: [2, 7],
  noveltyWeight: [0.1, 0.5],
  explorationRate: [0.1, 0.4],
  retirementThreshold: [-1.0, 0.0],
  populationSize: [10, 50],
};

// Perturbation step sizes (fraction of range)
const PERTURBATION_SCALE = 0.1;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export class MetaLearner extends EventEmitter {
  private store: StateStore;
  private params: MetaParameters;
  private tuningTimer: ReturnType<typeof setInterval> | null = null;
  private previousFitness: number | null = null;
  private pendingPerturbation: { parameter: string; oldValue: number; newValue: number } | null = null;

  constructor(store: StateStore) {
    super();
    this.store = store;
    this.params = store.getMetaParams();
  }

  initialize(): void {
    this.params = this.store.getMetaParams();
    console.log(`[MetaLearner] Initialized — mutation=${this.params.mutationRate.toFixed(3)}, noveltyW=${this.params.noveltyWeight.toFixed(3)}, popSize=${this.params.populationSize}`);
  }

  getCurrentParams(): MetaParameters {
    return { ...this.params };
  }

  startTuningLoop(
    getStrategies: () => ManagedStrategy[],
    getThreats: () => CompetitorThreat[],
    getDiversityScore: () => number,
  ): void {
    this.tuningTimer = setInterval(() => {
      this.adapt(getStrategies(), getThreats(), getDiversityScore());
    }, TUNING_INTERVAL);
    console.log('[MetaLearner] Tuning loop started (10m interval)');
  }

  stopTuningLoop(): void {
    if (this.tuningTimer) {
      clearInterval(this.tuningTimer);
      this.tuningTimer = null;
    }
  }

  evaluatePerformance(strategies: ManagedStrategy[], threats: CompetitorThreat[], diversityScore: number): number {
    if (strategies.length === 0) return 0;

    // Component 1: Average strategy fitness (Sharpe-based)
    const avgSharpe = strategies.reduce((s, st) => s + st.metrics.sharpeRatio, 0) / strategies.length;
    const sharpeScore = clamp((avgSharpe + 1) / 3, 0, 1); // map [-1, 2] to [0, 1]

    // Component 2: Diversity score (from novelty search)
    const diversityComponent = clamp(diversityScore, 0, 1);

    // Component 3: Retirement rate (lower is better — strategies survive longer)
    const activeCount = strategies.filter(s => s.stage !== 'RETIRED').length;
    const survivalRate = strategies.length > 0 ? activeCount / strategies.length : 0;

    // Component 4: Competitive rank (lower threat dominance is better)
    const avgDominance = threats.length > 0
      ? threats.reduce((s, t) => s + t.dominanceScore, 0) / threats.length
      : 0;
    const competitiveScore = 1 - clamp(avgDominance, 0, 1);

    // Weighted composite
    const fitness = 0.35 * sharpeScore + 0.25 * diversityComponent + 0.20 * survivalRate + 0.20 * competitiveScore;

    return fitness;
  }

  perturbParameter(): { parameter: string; oldValue: number; newValue: number } {
    // Pick a random parameter to perturb
    const paramNames = Object.keys(PARAM_RANGES);
    const paramName = paramNames[Math.floor(Math.random() * paramNames.length)];
    const [min, max] = PARAM_RANGES[paramName];
    const range = max - min;
    const step = range * PERTURBATION_SCALE;

    const oldValue = (this.params as unknown as Record<string, number>)[paramName];
    const delta = (Math.random() - 0.5) * 2 * step;
    let newValue = clamp(oldValue + delta, min, max);

    // Round populationSize and selectionPressure to integers
    if (paramName === 'populationSize' || paramName === 'selectionPressure') {
      newValue = Math.round(newValue);
    }

    // Apply the perturbation
    (this.params as unknown as Record<string, number>)[paramName] = newValue;
    this.store.setMetaParams(this.params);

    return { parameter: paramName, oldValue, newValue };
  }

  adapt(strategies: ManagedStrategy[], threats: CompetitorThreat[], diversityScore: number): void {
    const currentFitness = this.evaluatePerformance(strategies, threats, diversityScore);

    // If we have a pending perturbation, evaluate it
    if (this.pendingPerturbation && this.previousFitness !== null) {
      if (currentFitness >= this.previousFitness) {
        // Keep the change
        console.log(`[MetaLearner] ${this.pendingPerturbation.parameter}: ${this.pendingPerturbation.oldValue.toFixed(3)} → ${this.pendingPerturbation.newValue.toFixed(3)} (fitness +${(currentFitness - this.previousFitness).toFixed(4)})`);
      } else {
        // Revert
        (this.params as unknown as Record<string, number>)[this.pendingPerturbation.parameter] = this.pendingPerturbation.oldValue;
        this.store.setMetaParams(this.params);
        console.log(`[MetaLearner] Reverted ${this.pendingPerturbation.parameter} (fitness -${(this.previousFitness - currentFitness).toFixed(4)})`);
      }
    }

    // Record history
    const entry: MetaTuningEntry = {
      params: {
        mutationRate: this.params.mutationRate,
        selectionPressure: this.params.selectionPressure,
        noveltyWeight: this.params.noveltyWeight,
        explorationRate: this.params.explorationRate,
        retirementThreshold: this.params.retirementThreshold,
        populationSize: this.params.populationSize,
      },
      fitness: currentFitness,
      timestamp: Date.now(),
    };
    this.params.tuningHistory.push(entry);
    if (this.params.tuningHistory.length > MAX_HISTORY) {
      this.params.tuningHistory.shift();
    }
    this.params.lastTuned = Date.now();

    // Apply new perturbation for next evaluation
    this.previousFitness = currentFitness;
    this.pendingPerturbation = this.perturbParameter();

    this.emit('tuned', {
      fitness: currentFitness,
      perturbation: this.pendingPerturbation,
    });
  }

  getInsights(): string[] {
    const insights: string[] = [];
    const history = this.params.tuningHistory;

    if (history.length < 3) {
      insights.push('Insufficient tuning history for insights');
      return insights;
    }

    // Fitness trend
    const recentFitness = history.slice(-5).map(h => h.fitness);
    const avgRecent = recentFitness.reduce((s, f) => s + f, 0) / recentFitness.length;
    const olderFitness = history.slice(-10, -5).map(h => h.fitness);
    if (olderFitness.length > 0) {
      const avgOlder = olderFitness.reduce((s, f) => s + f, 0) / olderFitness.length;
      if (avgRecent > avgOlder + 0.02) {
        insights.push(`Fitness improving: ${avgOlder.toFixed(3)} → ${avgRecent.toFixed(3)}`);
      } else if (avgRecent < avgOlder - 0.02) {
        insights.push(`Fitness declining: ${avgOlder.toFixed(3)} → ${avgRecent.toFixed(3)}`);
      } else {
        insights.push(`Fitness stable at ${avgRecent.toFixed(3)}`);
      }
    }

    // Parameter trend analysis
    if (history.length >= 5) {
      const latest = history[history.length - 1].params;
      const earlier = history[Math.max(0, history.length - 10)].params;

      if (latest.mutationRate > earlier.mutationRate + 0.03) {
        insights.push('Mutation rate trending up — system may be stagnating');
      }
      if (latest.noveltyWeight > earlier.noveltyWeight + 0.05) {
        insights.push('Novelty weight increasing — diversity pressure rising');
      }
      if (latest.explorationRate > earlier.explorationRate + 0.05) {
        insights.push('Exploration rate increasing — search broadening');
      }
    }

    // Current parameter summary
    insights.push(`Current params: mutation=${this.params.mutationRate.toFixed(3)}, novelty=${this.params.noveltyWeight.toFixed(3)}, explore=${this.params.explorationRate.toFixed(3)}`);

    return insights;
  }

  getTuningHistory(): MetaTuningEntry[] {
    return [...this.params.tuningHistory];
  }
}
