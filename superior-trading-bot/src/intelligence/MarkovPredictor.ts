/**
 * Markov Chain Bot Behavior Predictor
 * Layer 4: Competitive Intelligence
 *
 * Models each bot's trade sequence as a 2nd-order Markov chain.
 * Captures patterns like "after two consecutive buys, 70% chance of hold."
 *
 * Input: Bot trade history as action sequences [buy, hold, sell, buy, ...]
 * Output: Probability distribution over next action
 */

import { EventEmitter } from 'events';
import {
  MarkovState, ActionProbability, PredictedAction
} from '../types/synthesis';
import { ObservationEvent } from '../types/core';

// ===================== CONFIG =====================

interface MarkovConfig {
  order: number;            // 1 or 2 (2nd order captures more complex patterns)
  smoothingAlpha: number;   // Laplace smoothing to avoid zero probabilities
  decayFactor: number;      // exponential decay for older transitions
  minTransitions: number;   // minimum transitions before making predictions
  maxHistoryLength: number; // cap on stored history per bot
}

const DEFAULT_CONFIG: MarkovConfig = {
  order: 2,
  smoothingAlpha: 0.1,
  decayFactor: 0.995,
  minTransitions: 10,
  maxHistoryLength: 500,
};

// ===================== MARKOV PREDICTOR =====================

export class MarkovPredictor extends EventEmitter {
  private config: MarkovConfig;
  private botStates: Map<string, MarkovState> = new Map();
  private predictionAccuracy: Map<string, { correct: number; total: number }> = new Map();

  constructor(config: Partial<MarkovConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===================== STATE MANAGEMENT =====================

  /**
   * Process a new trade event and update the Markov model for that bot.
   */
  processEvent(event: ObservationEvent): void {
    const botId = (event.payload as any).botId || (event as any).botId;
    if (!botId) return;

    const action = this.extractAction(event);
    if (!action) return;

    let state = this.botStates.get(botId);
    if (!state) {
      state = this.initializeState(botId);
      this.botStates.set(botId, state);
    }

    // Check prediction accuracy before updating
    this.checkPrediction(botId, action);

    // Update transition matrix
    this.updateTransitions(state, action);

    // Append to history
    state.stateHistory.push(action);
    if (state.stateHistory.length > this.config.maxHistoryLength) {
      state.stateHistory = state.stateHistory.slice(-this.config.maxHistoryLength);
    }

    state.lastUpdated = Date.now();
  }

  /**
   * Bulk initialize from historical trade data.
   */
  initializeFromHistory(botId: string, events: ObservationEvent[]): void {
    let state = this.botStates.get(botId);
    if (!state) {
      state = this.initializeState(botId);
      this.botStates.set(botId, state);
    }

    for (const event of events) {
      const action = this.extractAction(event);
      if (!action) continue;

      this.updateTransitions(state, action);
      state.stateHistory.push(action);
    }

    // Trim history
    if (state.stateHistory.length > this.config.maxHistoryLength) {
      state.stateHistory = state.stateHistory.slice(-this.config.maxHistoryLength);
    }

    state.lastUpdated = Date.now();
  }

  // ===================== PREDICTION =====================

  /**
   * Predict the next action for a bot.
   */
  predict(botId: string): ActionProbability {
    const state = this.botStates.get(botId);
    if (!state || state.totalTransitions < this.config.minTransitions) {
      return this.uniformProbability();
    }

    const currentState = this.getCurrentStateKey(state);
    const transition = state.transitionMatrix.get(currentState);

    if (!transition) {
      // Fall back to 1st order if 2nd order state not seen
      if (this.config.order === 2) {
        return this.predictFirstOrder(state);
      }
      return this.uniformProbability();
    }

    return this.applySmoothing(transition);
  }

  /**
   * Get the most likely next action.
   */
  predictBestAction(botId: string): { action: PredictedAction; confidence: number } {
    const probs = this.predict(botId);
    const entries: [PredictedAction, number][] = [
      ['buy', probs.buy],
      ['sell', probs.sell],
      ['hold', probs.hold],
    ];

    entries.sort((a, b) => b[1] - a[1]);
    return {
      action: entries[0][0],
      confidence: entries[0][1],
    };
  }

  /**
   * Predict N steps ahead using chain multiplication.
   */
  predictMultiStep(botId: string, steps: number): ActionProbability[] {
    const predictions: ActionProbability[] = [];
    const state = this.botStates.get(botId);

    if (!state || state.totalTransitions < this.config.minTransitions) {
      for (let i = 0; i < steps; i++) {
        predictions.push(this.uniformProbability());
      }
      return predictions;
    }

    // Simulate forward
    const simHistory = [...state.stateHistory];

    for (let step = 0; step < steps; step++) {
      const stateKey = this.buildStateKey(simHistory.slice(-this.config.order));
      const transition = state.transitionMatrix.get(stateKey);
      const probs = transition ? this.applySmoothing(transition) : this.uniformProbability();

      predictions.push(probs);

      // Sample most likely action for next step
      const nextAction = probs.buy >= probs.sell && probs.buy >= probs.hold ? 'buy'
        : probs.sell >= probs.hold ? 'sell' : 'hold';
      simHistory.push(nextAction as PredictedAction);
    }

    return predictions;
  }

  // ===================== TRANSITION MATRIX =====================

  private updateTransitions(state: MarkovState, newAction: PredictedAction): void {
    const history = state.stateHistory;
    if (history.length < this.config.order) {
      return; // need enough history for the order
    }

    const stateKey = this.getCurrentStateKey(state);

    // Apply decay to existing transitions
    this.applyDecay(state);

    // Get or create transition entry
    let transition = state.transitionMatrix.get(stateKey);
    if (!transition) {
      transition = { buy: 0, sell: 0, hold: 0 };
      state.transitionMatrix.set(stateKey, transition);
    }

    // Increment count for observed action
    transition[newAction] += 1;
    state.totalTransitions++;
  }

  private applyDecay(state: MarkovState): void {
    // Apply exponential decay every 100 transitions
    if (state.totalTransitions % 100 !== 0) return;

    for (const [key, transition] of state.transitionMatrix) {
      transition.buy *= this.config.decayFactor;
      transition.sell *= this.config.decayFactor;
      transition.hold *= this.config.decayFactor;

      // Remove very small entries
      const total = transition.buy + transition.sell + transition.hold;
      if (total < 0.01) {
        state.transitionMatrix.delete(key);
      }
    }
  }

  private getCurrentStateKey(state: MarkovState): string {
    return this.buildStateKey(state.stateHistory.slice(-this.config.order));
  }

  private buildStateKey(actions: PredictedAction[]): string {
    return actions.join('→');
  }

  private predictFirstOrder(state: MarkovState): ActionProbability {
    if (state.stateHistory.length === 0) return this.uniformProbability();

    const lastAction = state.stateHistory[state.stateHistory.length - 1];
    const stateKey = lastAction;
    const transition = state.transitionMatrix.get(stateKey);

    if (!transition) return this.uniformProbability();
    return this.applySmoothing(transition);
  }

  // ===================== SMOOTHING & NORMALIZATION =====================

  private applySmoothing(transition: ActionProbability): ActionProbability {
    const alpha = this.config.smoothingAlpha;
    const total = transition.buy + transition.sell + transition.hold + 3 * alpha;

    return {
      buy: (transition.buy + alpha) / total,
      sell: (transition.sell + alpha) / total,
      hold: (transition.hold + alpha) / total,
    };
  }

  private uniformProbability(): ActionProbability {
    return { buy: 1 / 3, sell: 1 / 3, hold: 1 / 3 };
  }

  // ===================== ACCURACY TRACKING =====================

  private checkPrediction(botId: string, actualAction: PredictedAction): void {
    const state = this.botStates.get(botId);
    if (!state || state.totalTransitions < this.config.minTransitions) return;

    const predicted = this.predictBestAction(botId);

    if (!this.predictionAccuracy.has(botId)) {
      this.predictionAccuracy.set(botId, { correct: 0, total: 0 });
    }

    const acc = this.predictionAccuracy.get(botId)!;
    acc.total++;
    if (predicted.action === actualAction) {
      acc.correct++;
    }
  }

  // ===================== HELPER =====================

  private extractAction(event: ObservationEvent): PredictedAction | null {
    if (event.eventType !== 'trade') return null;

    const payload = event.payload as any;
    const direction = payload.direction || payload.side;

    if (direction === 'buy') return 'buy';
    if (direction === 'sell') return 'sell';
    return null; // skip unrecognized
  }

  private initializeState(botId: string): MarkovState {
    return {
      botId,
      order: this.config.order,
      transitionMatrix: new Map(),
      stateHistory: [],
      totalTransitions: 0,
      lastUpdated: Date.now(),
    };
  }

  // ===================== PUBLIC API =====================

  getState(botId: string): MarkovState | undefined {
    return this.botStates.get(botId);
  }

  getTrackedBots(): string[] {
    return [...this.botStates.keys()];
  }

  getAccuracy(botId: string): number {
    const acc = this.predictionAccuracy.get(botId);
    if (!acc || acc.total === 0) return 0;
    return acc.correct / acc.total;
  }

  getOverallAccuracy(): number {
    let totalCorrect = 0;
    let totalPredictions = 0;

    for (const acc of this.predictionAccuracy.values()) {
      totalCorrect += acc.correct;
      totalPredictions += acc.total;
    }

    return totalPredictions > 0 ? totalCorrect / totalPredictions : 0;
  }

  /**
   * Get transition probabilities as a readable matrix.
   */
  getTransitionMatrix(botId: string): Record<string, ActionProbability> | null {
    const state = this.botStates.get(botId);
    if (!state) return null;

    const result: Record<string, ActionProbability> = {};
    for (const [key, transition] of state.transitionMatrix) {
      result[key] = this.applySmoothing(transition);
    }
    return result;
  }

  getStats(): {
    botsTracked: number;
    totalTransitions: number;
    avgAccuracy: number;
    avgHistoryLength: number;
  } {
    let totalTransitions = 0;
    let totalHistory = 0;

    for (const state of this.botStates.values()) {
      totalTransitions += state.totalTransitions;
      totalHistory += state.stateHistory.length;
    }

    return {
      botsTracked: this.botStates.size,
      totalTransitions,
      avgAccuracy: this.getOverallAccuracy(),
      avgHistoryLength: this.botStates.size > 0 ? totalHistory / this.botStates.size : 0,
    };
  }
}

export default MarkovPredictor;
