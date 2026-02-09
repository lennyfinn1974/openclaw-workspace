/**
 * Gradient Boost Bot Behavior Predictor (XGBoost-style)
 * Layer 4: Competitive Intelligence
 *
 * Indicator-conditioned prediction using gradient boosted decision trees.
 * Input: Current indicator snapshot (8 features) + bot behavioral fingerprint (12 features)
 * Output: Probability of buy/sell/hold
 *
 * Uses TensorFlow.js for lightweight tree-based ensemble.
 * Retrains every 100 trades with exponential sample weighting.
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import {
  GradientBoostModel, DecisionTreeNode, ActionProbability, PredictedAction
} from '../types/synthesis';
import { IndicatorSnapshot, ObservationEvent, StrategyFingerprint } from '../types/core';

// ===================== CONFIG =====================

interface GBConfig {
  numTrees: number;
  maxDepth: number;
  learningRate: number;
  minSamplesLeaf: number;
  subsampleRate: number;
  retrainInterval: number;
  minTrainingSize: number;
  sampleDecayFactor: number;
  hiddenUnits: number[];
  epochs: number;
  batchSize: number;
}

const DEFAULT_CONFIG: GBConfig = {
  numTrees: 10,
  maxDepth: 4,
  learningRate: 0.1,
  minSamplesLeaf: 5,
  subsampleRate: 0.8,
  retrainInterval: 100,
  minTrainingSize: 30,
  sampleDecayFactor: 0.99,
  hiddenUnits: [32, 16],
  epochs: 50,
  batchSize: 16,
};

// Feature count: 8 indicators + 5 behavioral + 3 contextual = 16
const NUM_FEATURES = 16;
const NUM_CLASSES = 3; // buy, sell, hold

// ===================== GRADIENT BOOST PREDICTOR =====================

export class GradientBoostPredictor extends EventEmitter {
  private config: GBConfig;
  private models: Map<string, tf.Sequential> = new Map();
  private trainingData: Map<string, TrainingSample[]> = new Map();
  private predictionAccuracy: Map<string, { correct: number; total: number }> = new Map();
  private featureImportance: Map<string, number[]> = new Map();
  private tradesSinceRetrain: Map<string, number> = new Map();
  private disposed = false;

  constructor(config: Partial<GBConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===================== MODEL BUILDING =====================

  /**
   * Build and train a TF.js neural network as a gradient boost approximation.
   * Using neural nets because TF.js doesn't have native gradient boost trees,
   * but the architecture mimics tree-like decision boundaries with ReLU activations.
   */
  private buildModel(): tf.Sequential {
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      units: this.config.hiddenUnits[0],
      activation: 'relu',
      inputShape: [NUM_FEATURES],
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Hidden layers (tree-like decision boundaries via deep ReLU)
    for (let i = 1; i < this.config.hiddenUnits.length; i++) {
      model.add(tf.layers.dense({
        units: this.config.hiddenUnits[i],
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
      }));
      model.add(tf.layers.dropout({ rate: 0.1 }));
    }

    // Output: 3 classes (buy, sell, hold)
    model.add(tf.layers.dense({
      units: NUM_CLASSES,
      activation: 'softmax',
    }));

    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  // ===================== TRAINING =====================

  /**
   * Add a training sample from observed bot behavior.
   */
  addTrainingSample(
    botId: string,
    indicators: IndicatorSnapshot,
    fingerprint: Partial<StrategyFingerprint>,
    action: PredictedAction
  ): void {
    if (this.disposed) return;

    const features = this.extractFeatures(indicators, fingerprint);
    const label = this.actionToLabel(action);

    if (!this.trainingData.has(botId)) {
      this.trainingData.set(botId, []);
    }

    this.trainingData.get(botId)!.push({
      features,
      label,
      timestamp: Date.now(),
      weight: 1.0,
    });

    // Track trades since last retrain
    const count = (this.tradesSinceRetrain.get(botId) || 0) + 1;
    this.tradesSinceRetrain.set(botId, count);

    // Auto-retrain when enough new data
    if (count >= this.config.retrainInterval) {
      this.retrain(botId).catch(err => this.emit('error', err));
      this.tradesSinceRetrain.set(botId, 0);
    }
  }

  /**
   * Train/retrain model for a specific bot.
   */
  async retrain(botId: string): Promise<{ accuracy: number; loss: number } | null> {
    if (this.disposed) return null;

    const samples = this.trainingData.get(botId);
    if (!samples || samples.length < this.config.minTrainingSize) {
      return null;
    }

    // Apply exponential decay weights to older samples
    this.applyDecayWeights(samples);

    // Subsample for training
    const subsample = this.subsample(samples);

    // Prepare tensors
    const features = subsample.map(s => s.features);
    const labels = subsample.map(s => s.label);
    const weights = subsample.map(s => s.weight);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);
    const sampleWeights = tf.tensor1d(weights);

    // Build or reuse model
    let model = this.models.get(botId);
    if (!model) {
      model = this.buildModel();
      this.models.set(botId, model);
    }

    // Train
    const result = await model.fit(xs, ys, {
      epochs: this.config.epochs,
      batchSize: Math.min(this.config.batchSize, subsample.length),
      sampleWeight: sampleWeights,
      validationSplit: 0.2,
      verbose: 0,
    });

    // Cleanup tensors
    xs.dispose();
    ys.dispose();
    sampleWeights.dispose();

    const lastEpoch = result.history;
    const accuracy = (lastEpoch.val_acc as number[])?.[lastEpoch.val_acc!.length - 1] || 0;
    const loss = (lastEpoch.val_loss as number[])?.[lastEpoch.val_loss!.length - 1] || Infinity;

    // Calculate feature importance via permutation
    this.calculateFeatureImportance(botId, model, subsample);

    this.emit('model:retrained', { botId, accuracy, loss, samples: subsample.length });

    return { accuracy, loss };
  }

  // ===================== PREDICTION =====================

  /**
   * Predict next action for a bot given current market conditions.
   */
  predict(
    botId: string,
    indicators: IndicatorSnapshot,
    fingerprint: Partial<StrategyFingerprint>
  ): ActionProbability {
    if (this.disposed) return { buy: 1/3, sell: 1/3, hold: 1/3 };

    const model = this.models.get(botId);
    if (!model) return { buy: 1/3, sell: 1/3, hold: 1/3 };

    const features = this.extractFeatures(indicators, fingerprint);
    const input = tf.tensor2d([features]);

    const prediction = model.predict(input) as tf.Tensor;
    const probs = prediction.dataSync();

    input.dispose();
    prediction.dispose();

    return {
      buy: probs[0] || 1/3,
      sell: probs[1] || 1/3,
      hold: probs[2] || 1/3,
    };
  }

  /**
   * Get the most likely action with confidence.
   */
  predictBestAction(
    botId: string,
    indicators: IndicatorSnapshot,
    fingerprint: Partial<StrategyFingerprint>
  ): { action: PredictedAction; confidence: number } {
    const probs = this.predict(botId, indicators, fingerprint);
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

  // ===================== FEATURE EXTRACTION =====================

  /**
   * Extract 16 features from indicators + behavioral fingerprint.
   */
  private extractFeatures(
    indicators: IndicatorSnapshot,
    fingerprint: Partial<StrategyFingerprint>
  ): number[] {
    return [
      // 8 indicator features (normalized)
      indicators.rsi14 / 100,
      Math.tanh(indicators.macdHist),
      indicators.bbPosition,
      Math.min(indicators.atr14 / 5, 1),
      Math.min(indicators.volumeRatio / 5, 1),
      indicators.trendStrength / 100,
      Math.tanh(indicators.priceVsMA50 / 10),
      Math.tanh(indicators.priceVsMA200 / 10),

      // 5 behavioral features
      Math.min((fingerprint.tradeFrequency || 1) / 20, 1),
      (fingerprint.directionBias || 0 + 1) / 2, // normalize to [0, 1]
      Math.min((fingerprint.avgHoldingPeriod || 60000) / (24 * 60 * 60 * 1000), 1),
      fingerprint.preferredRegimes?.includes('TRENDING') ? 1 : 0,
      fingerprint.preferredRegimes?.includes('VOLATILE') ? 1 : 0,

      // 3 contextual features
      new Date().getHours() / 24,             // time of day
      new Date().getDay() / 7,                // day of week
      this.getRecentMomentum(fingerprint),     // recent performance trend
    ];
  }

  private getRecentMomentum(fingerprint: Partial<StrategyFingerprint>): number {
    // Use performance map if available
    if (!fingerprint.performanceByRegime) return 0.5;
    let totalReturn = 0;
    let count = 0;
    for (const [, perf] of fingerprint.performanceByRegime) {
      totalReturn += perf.avgReturn || 0;
      count++;
    }
    return count > 0 ? Math.tanh(totalReturn / count) * 0.5 + 0.5 : 0.5;
  }

  private actionToLabel(action: PredictedAction): number[] {
    switch (action) {
      case 'buy': return [1, 0, 0];
      case 'sell': return [0, 1, 0];
      case 'hold': return [0, 0, 1];
      default: return [0, 0, 1];
    }
  }

  // ===================== FEATURE IMPORTANCE =====================

  private calculateFeatureImportance(
    botId: string,
    model: tf.Sequential,
    samples: TrainingSample[]
  ): void {
    if (samples.length < 10) return;

    const featureNames = [
      'rsi14', 'macdHist', 'bbPosition', 'atr14',
      'volumeRatio', 'trendStrength', 'priceVsMA50', 'priceVsMA200',
      'tradeFrequency', 'directionBias', 'avgHoldingPeriod',
      'prefTrending', 'prefVolatile',
      'timeOfDay', 'dayOfWeek', 'recentMomentum',
    ];

    const importance: number[] = new Array(NUM_FEATURES).fill(0);

    // Permutation importance: for each feature, shuffle it and measure accuracy drop
    const basePreds = this.batchPredict(model, samples.map(s => s.features));
    const baseAccuracy = this.measureAccuracy(basePreds, samples.map(s => s.label));

    for (let f = 0; f < NUM_FEATURES; f++) {
      // Create permuted features
      const permuted = samples.map(s => [...s.features]);
      const values = permuted.map(row => row[f]);

      // Shuffle this feature
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
      permuted.forEach((row, i) => { row[f] = values[i]; });

      const permPreds = this.batchPredict(model, permuted);
      const permAccuracy = this.measureAccuracy(permPreds, samples.map(s => s.label));

      importance[f] = Math.max(0, baseAccuracy - permAccuracy);
    }

    // Normalize
    const total = importance.reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (let i = 0; i < importance.length; i++) {
        importance[i] /= total;
      }
    }

    this.featureImportance.set(botId, importance);
  }

  private batchPredict(model: tf.Sequential, features: number[][]): number[][] {
    const input = tf.tensor2d(features);
    const predictions = model.predict(input) as tf.Tensor;
    const result = predictions.arraySync() as number[][];
    input.dispose();
    predictions.dispose();
    return result;
  }

  private measureAccuracy(predictions: number[][], labels: number[][]): number {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const predClass = predictions[i].indexOf(Math.max(...predictions[i]));
      const trueClass = labels[i].indexOf(Math.max(...labels[i]));
      if (predClass === trueClass) correct++;
    }
    return correct / predictions.length;
  }

  // ===================== DATA MANAGEMENT =====================

  private applyDecayWeights(samples: TrainingSample[]): void {
    const now = Date.now();
    for (const sample of samples) {
      const ageMs = now - sample.timestamp;
      const ageSteps = ageMs / (1000 * 60 * 5); // 5-minute steps
      sample.weight = Math.pow(this.config.sampleDecayFactor, ageSteps);
    }
  }

  private subsample(samples: TrainingSample[]): TrainingSample[] {
    const count = Math.floor(samples.length * this.config.subsampleRate);
    const shuffled = [...samples].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // ===================== CLEANUP =====================

  /**
   * Dispose all TF.js models to free memory.
   */
  dispose(): void {
    this.disposed = true;
    for (const [botId, model] of this.models) {
      model.dispose();
    }
    this.models.clear();
  }

  // ===================== PUBLIC API =====================

  getFeatureImportance(botId: string): Record<string, number> | null {
    const imp = this.featureImportance.get(botId);
    if (!imp) return null;

    const featureNames = [
      'rsi14', 'macdHist', 'bbPosition', 'atr14',
      'volumeRatio', 'trendStrength', 'priceVsMA50', 'priceVsMA200',
      'tradeFrequency', 'directionBias', 'avgHoldingPeriod',
      'prefTrending', 'prefVolatile',
      'timeOfDay', 'dayOfWeek', 'recentMomentum',
    ];

    const result: Record<string, number> = {};
    featureNames.forEach((name, i) => {
      result[name] = imp[i] || 0;
    });
    return result;
  }

  getModelInfo(botId: string): {
    hasModel: boolean;
    trainingSize: number;
    tradesSinceRetrain: number;
  } {
    return {
      hasModel: this.models.has(botId),
      trainingSize: this.trainingData.get(botId)?.length || 0,
      tradesSinceRetrain: this.tradesSinceRetrain.get(botId) || 0,
    };
  }

  getTrackedBots(): string[] {
    return [...this.trainingData.keys()];
  }

  getStats(): {
    botsModeled: number;
    totalTrainingSamples: number;
    modelsActive: number;
  } {
    let totalSamples = 0;
    for (const samples of this.trainingData.values()) {
      totalSamples += samples.length;
    }
    return {
      botsModeled: this.trainingData.size,
      totalTrainingSamples: totalSamples,
      modelsActive: this.models.size,
    };
  }
}

// ===================== INTERNAL TYPES =====================

interface TrainingSample {
  features: number[];
  label: number[];
  timestamp: number;
  weight: number;
}

export default GradientBoostPredictor;
