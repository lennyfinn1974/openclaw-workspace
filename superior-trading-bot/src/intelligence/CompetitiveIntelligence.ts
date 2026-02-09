/**
 * Competitive Intelligence Engine - Layer 4 Orchestrator
 * Coordinates Markov prediction, gradient boost prediction,
 * crowding detection, and niche discovery into a unified
 * competitive awareness system.
 *
 * Phase 1: ANALYSIS ONLY — observes and predicts, does not trade.
 */

import { EventEmitter } from 'events';
import {
  CompetitiveIntelConfig, CompetitiveIntelStatus, BotPrediction,
  ActionProbability, PredictedAction, CrowdingAlert, NicheMap
} from '../types/synthesis';
import { ObservationEvent, IndicatorSnapshot, MarketRegime, StrategyFingerprint } from '../types/core';
import { MarkovPredictor } from './MarkovPredictor';
import { GradientBoostPredictor } from './GradientBoostPredictor';
import { CrowdingDetector } from './CrowdingDetector';
import { NicheDiscovery } from './NicheDiscovery';

// ===================== DEFAULT CONFIG =====================

const DEFAULT_CONFIG: CompetitiveIntelConfig = {
  predictionUpdateInterval: 10000,    // 10 seconds
  crowdingWindowMinutes: 5,
  nicheUpdateInterval: 60000,          // 1 minute
  markovOrder: 2,
  minTradesForPrediction: 10,
  smartMoneyThreshold: 0.6,
  retrainInterval: 100,
};

// ===================== COMPETITIVE INTELLIGENCE ENGINE =====================

export class CompetitiveIntelligence extends EventEmitter {
  private config: CompetitiveIntelConfig;
  private markov: MarkovPredictor;
  private gradientBoost: GradientBoostPredictor;
  private crowdingDetector: CrowdingDetector;
  private nicheDiscovery: NicheDiscovery;

  private isActive = false;
  private predictionsGenerated = 0;
  private predictionCache: Map<string, BotPrediction> = new Map();

  // Ensemble weight learning
  private ensembleWeights: Map<string, { markov: number; gradientBoost: number; dnaBased: number }> = new Map();
  private ensembleAccuracy: Map<string, { markov: number; gb: number; ensemble: number; total: number }> = new Map();

  constructor(config: Partial<CompetitiveIntelConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.markov = new MarkovPredictor({ order: this.config.markovOrder });
    this.gradientBoost = new GradientBoostPredictor({
      retrainInterval: this.config.retrainInterval,
    });
    this.crowdingDetector = new CrowdingDetector({
      windowMinutes: this.config.crowdingWindowMinutes,
    });
    this.nicheDiscovery = new NicheDiscovery();

    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    this.crowdingDetector.on('crowding:detected', (alert: CrowdingAlert) => {
      this.emit('crowding:detected', alert);
    });
    this.crowdingDetector.on('crowding:expired', (alert: CrowdingAlert) => {
      this.emit('crowding:expired', alert);
    });
    this.nicheDiscovery.on('niche:updated', (stats: any) => {
      this.emit('niche:updated', stats);
    });
    this.gradientBoost.on('model:retrained', (info: any) => {
      this.emit('model:retrained', info);
    });
  }

  // ===================== LIFECYCLE =====================

  async start(historicalData?: ObservationEvent[]): Promise<void> {
    this.emit('status', 'Starting Competitive Intelligence Engine - Layer 4');

    // Initialize Markov chains from historical data
    if (historicalData) {
      this.initializeFromHistory(historicalData);
    }

    // Start subsystems
    this.crowdingDetector.start();
    this.nicheDiscovery.start();

    this.isActive = true;
    this.emit('status', 'Competitive Intelligence Engine online');
  }

  async stop(): Promise<void> {
    this.emit('status', 'Stopping Competitive Intelligence Engine...');

    this.crowdingDetector.stop();
    this.nicheDiscovery.stop();
    this.gradientBoost.dispose();

    this.isActive = false;
    this.emit('status', 'Competitive Intelligence Engine stopped');
  }

  // ===================== EVENT PROCESSING =====================

  /**
   * Process a new observation event through all intelligence subsystems.
   */
  processEvent(event: ObservationEvent): void {
    if (!this.isActive) return;

    // Feed to Markov predictor
    this.markov.processEvent(event);

    // Feed to crowding detector
    if (event.eventType === 'trade') {
      this.crowdingDetector.processTrade(event);
      this.nicheDiscovery.processTrade(event);

      // Add training sample for gradient boost
      const payload = event.payload as any;
      const botId = payload.botId || (event as any).botId;
      const direction = payload.direction || payload.side;

      if (botId && direction) {
        const indicators: IndicatorSnapshot = event.enrichmentMetadata?.indicators || {
          rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
          volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
        };

        const fingerprint: Partial<StrategyFingerprint> = {
          botId,
          tradeFrequency: 1,
          directionBias: 0,
          avgHoldingPeriod: 60000,
          preferredRegimes: [],
        };

        this.gradientBoost.addTrainingSample(
          botId, indicators, fingerprint, direction as PredictedAction
        );

        // Validate previous predictions
        this.validatePrediction(botId, direction as PredictedAction);
      }
    }
  }

  /**
   * Initialize models from historical data.
   */
  private initializeFromHistory(data: ObservationEvent[]): void {
    // Group by bot
    const botEvents = new Map<string, ObservationEvent[]>();
    for (const event of data) {
      const botId = (event.payload as any).botId || (event as any).botId;
      if (!botId) continue;
      if (!botEvents.has(botId)) botEvents.set(botId, []);
      botEvents.get(botId)!.push(event);
    }

    // Initialize Markov chains
    for (const [botId, events] of botEvents) {
      this.markov.initializeFromHistory(botId, events);
    }
  }

  // ===================== PREDICTION =====================

  /**
   * Generate ensemble prediction for a bot.
   * Combines Markov chain + gradient boost predictions.
   */
  predictBot(
    botId: string,
    currentIndicators: IndicatorSnapshot,
    fingerprint: Partial<StrategyFingerprint>
  ): BotPrediction {
    // Get individual model predictions
    const markovPrediction = this.markov.predict(botId);
    const gbPrediction = this.gradientBoost.predict(botId, currentIndicators, fingerprint);

    // Ensemble weights (learned or default)
    const weights = this.ensembleWeights.get(botId) || {
      markov: 0.4,
      gradientBoost: 0.5,
      dnaBased: 0.1,
    };

    // DNA-based prediction (placeholder — would use actual DNA if available)
    const dnaPrediction: ActionProbability = { buy: 1/3, sell: 1/3, hold: 1/3 };

    // Weighted ensemble
    const ensemble: ActionProbability = {
      buy: markovPrediction.buy * weights.markov +
           gbPrediction.buy * weights.gradientBoost +
           dnaPrediction.buy * weights.dnaBased,
      sell: markovPrediction.sell * weights.markov +
            gbPrediction.sell * weights.gradientBoost +
            dnaPrediction.sell * weights.dnaBased,
      hold: markovPrediction.hold * weights.markov +
            gbPrediction.hold * weights.gradientBoost +
            dnaPrediction.hold * weights.dnaBased,
    };

    // Normalize
    const total = ensemble.buy + ensemble.sell + ensemble.hold;
    if (total > 0) {
      ensemble.buy /= total;
      ensemble.sell /= total;
      ensemble.hold /= total;
    }

    // Find best action
    const entries: [PredictedAction, number][] = [
      ['buy', ensemble.buy],
      ['sell', ensemble.sell],
      ['hold', ensemble.hold],
    ];
    entries.sort((a, b) => b[1] - a[1]);

    const prediction: BotPrediction = {
      botId,
      timestamp: Date.now(),
      nextLikelyAction: entries[0][0],
      confidence: entries[0][1],
      predictedSymbol: fingerprint.botId || 'unknown', // simplified
      reasoning: this.generateReasoning(entries[0][0], markovPrediction, gbPrediction, weights),
      markovPrediction,
      gradientBoostPrediction: gbPrediction,
      dnaBasedPrediction: dnaPrediction,
      ensembleWeights: weights,
    };

    this.predictionCache.set(botId, prediction);
    this.predictionsGenerated++;

    return prediction;
  }

  /**
   * Predict all tracked bots at once.
   */
  predictAllBots(
    currentIndicators: IndicatorSnapshot
  ): Map<string, BotPrediction> {
    const predictions = new Map<string, BotPrediction>();
    const trackedBots = this.markov.getTrackedBots();

    for (const botId of trackedBots) {
      const fingerprint: Partial<StrategyFingerprint> = {
        botId,
        tradeFrequency: 1,
        directionBias: 0,
        avgHoldingPeriod: 60000,
        preferredRegimes: [],
      };

      predictions.set(botId, this.predictBot(botId, currentIndicators, fingerprint));
    }

    return predictions;
  }

  // ===================== ENSEMBLE WEIGHT LEARNING =====================

  private validatePrediction(botId: string, actualAction: PredictedAction): void {
    const cached = this.predictionCache.get(botId);
    if (!cached) return;

    // Track accuracy for each model
    if (!this.ensembleAccuracy.has(botId)) {
      this.ensembleAccuracy.set(botId, { markov: 0, gb: 0, ensemble: 0, total: 0 });
    }

    const acc = this.ensembleAccuracy.get(botId)!;
    acc.total++;

    // Check Markov prediction
    const markovBest = this.getBestAction(cached.markovPrediction);
    if (markovBest === actualAction) acc.markov++;

    // Check gradient boost prediction
    const gbBest = this.getBestAction(cached.gradientBoostPrediction);
    if (gbBest === actualAction) acc.gb++;

    // Check ensemble
    if (cached.nextLikelyAction === actualAction) acc.ensemble++;

    // Update ensemble weights every 50 predictions
    if (acc.total % 50 === 0 && acc.total >= 50) {
      this.updateEnsembleWeights(botId, acc);
    }
  }

  private updateEnsembleWeights(
    botId: string,
    accuracy: { markov: number; gb: number; ensemble: number; total: number }
  ): void {
    const markovAcc = accuracy.markov / accuracy.total;
    const gbAcc = accuracy.gb / accuracy.total;
    const total = markovAcc + gbAcc + 0.1; // small base for DNA

    this.ensembleWeights.set(botId, {
      markov: markovAcc / total,
      gradientBoost: gbAcc / total,
      dnaBased: 0.1 / total,
    });
  }

  private getBestAction(probs: ActionProbability): PredictedAction {
    if (probs.buy >= probs.sell && probs.buy >= probs.hold) return 'buy';
    if (probs.sell >= probs.hold) return 'sell';
    return 'hold';
  }

  private generateReasoning(
    action: PredictedAction,
    markov: ActionProbability,
    gb: ActionProbability,
    weights: { markov: number; gradientBoost: number; dnaBased: number }
  ): string {
    const parts: string[] = [];

    const markovBest = this.getBestAction(markov);
    parts.push(`Markov(${(weights.markov * 100).toFixed(0)}%): ${markovBest} (${(markov[markovBest] * 100).toFixed(0)}%)`);

    const gbBest = this.getBestAction(gb);
    parts.push(`GB(${(weights.gradientBoost * 100).toFixed(0)}%): ${gbBest} (${(gb[gbBest] * 100).toFixed(0)}%)`);

    const agreement = markovBest === gbBest ? 'Models AGREE' : 'Models DISAGREE';

    return `${agreement} → ${action.toUpperCase()}. ${parts.join(', ')}`;
  }

  // ===================== FINGERPRINT UPDATES =====================

  /**
   * Update niche discovery with latest fingerprints.
   */
  updateFingerprints(fingerprints: StrategyFingerprint[]): void {
    this.nicheDiscovery.updateFingerprints(fingerprints);
  }

  // ===================== PUBLIC API =====================

  getStatus(): CompetitiveIntelStatus {
    const crowdingStats = this.crowdingDetector.getStats();
    const nicheStats = this.nicheDiscovery.getStats();

    return {
      active: this.isActive,
      botsTracked: this.markov.getTrackedBots().length,
      predictionsGenerated: this.predictionsGenerated,
      predictionAccuracy: this.getOverallPredictionAccuracy(),
      crowdingAlerts: crowdingStats.totalAlerts,
      activeCrowdingAlerts: crowdingStats.activeAlerts,
      nichesDiscovered: nicheStats.totalNiches,
      underexploitedNiches: nicheStats.underexploited,
      smartMoneyBots: this.crowdingDetector.getSmartMoneyBots(),
      lastUpdateAt: Date.now(),
    };
  }

  private getOverallPredictionAccuracy(): number {
    let totalCorrect = 0;
    let totalPredictions = 0;

    for (const acc of this.ensembleAccuracy.values()) {
      totalCorrect += acc.ensemble;
      totalPredictions += acc.total;
    }

    return totalPredictions > 0 ? totalCorrect / totalPredictions : 0;
  }

  getCrowdingAlerts(): CrowdingAlert[] {
    return this.crowdingDetector.getActiveAlerts();
  }

  getCrowdingSnapshot() {
    return this.crowdingDetector.getSnapshot();
  }

  getNicheMap(): NicheMap | null {
    return this.nicheDiscovery.getLatestMap();
  }

  getSmartMoneyBots(): string[] {
    return this.crowdingDetector.getSmartMoneyBots();
  }

  getPrediction(botId: string): BotPrediction | undefined {
    return this.predictionCache.get(botId);
  }

  getAllPredictions(): Map<string, BotPrediction> {
    return new Map(this.predictionCache);
  }

  getMarkovEngine(): MarkovPredictor { return this.markov; }
  getGradientBoostEngine(): GradientBoostPredictor { return this.gradientBoost; }
  getCrowdingEngine(): CrowdingDetector { return this.crowdingDetector; }
  getNicheEngine(): NicheDiscovery { return this.nicheDiscovery; }
}

export default CompetitiveIntelligence;
