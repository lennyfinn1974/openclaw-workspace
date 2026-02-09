import { EventEmitter } from 'events';
import { MessageRouter } from '../ipc/MessageRouter';
import { ArenaDataCollector } from '../arena/ArenaDataCollector';
import { PatternCoordinator } from './PatternCoordinator';
import { FingerprintEngine } from './FingerprintEngine';
import {
  BotPrediction, CrowdingAlert, NicheMap, ArenaTrade
} from '../types/intelligence';

export class CompetitiveCoordinator extends EventEmitter {
  private router: MessageRouter;
  private collector: ArenaDataCollector;
  private patterns: PatternCoordinator;
  private fingerprints: FingerprintEngine;

  private predictions = new Map<string, BotPrediction>();
  private crowdingAlerts: CrowdingAlert[] = [];
  private nicheMap: NicheMap | null = null;
  private botTradeCountSinceTraining = new Map<string, number>();
  private retrainThreshold = 100;

  private predictionTimer: NodeJS.Timeout | null = null;
  private crowdingTimer: NodeJS.Timeout | null = null;
  private nicheTimer: NodeJS.Timeout | null = null;
  private lastPredictionTimestamp = 0;

  constructor(
    router: MessageRouter,
    collector: ArenaDataCollector,
    patterns: PatternCoordinator,
    fingerprints: FingerprintEngine
  ) {
    super();
    this.router = router;
    this.collector = collector;
    this.patterns = patterns;
    this.fingerprints = fingerprints;
  }

  start(): void {
    // Track trades for retraining
    this.collector.on('trade', (trade: ArenaTrade) => {
      const count = (this.botTradeCountSinceTraining.get(trade.botId) || 0) + 1;
      this.botTradeCountSinceTraining.set(trade.botId, count);

      if (count >= this.retrainThreshold) {
        this.trainBot(trade.botId);
        this.botTradeCountSinceTraining.set(trade.botId, 0);
      }
    });

    // Periodic predictions every 60 seconds
    this.predictionTimer = setInterval(() => this.runPredictions(), 60000);

    // Crowding detection every 30 seconds
    this.crowdingTimer = setInterval(() => this.detectCrowding(), 30000);

    // Niche analysis every 5 minutes
    this.nicheTimer = setInterval(() => this.analyzeNiches(), 300000);

    // Initial runs after warm-up
    setTimeout(() => this.trainAllBots(), 15000);
    setTimeout(() => this.runPredictions(), 20000);
  }

  async trainBot(botId: string): Promise<void> {
    const trades = this.collector.getBotTrades(botId);
    if (trades.length < 20) return;

    try {
      // Build training features: 20D behavioral + indicator features
      const features: number[][] = [];
      const labels: number[] = [];
      const weights: number[] = [];
      const n = trades.length;

      for (let i = 0; i < n; i++) {
        const t = trades[i];
        const feat = this.buildFeatureVector(t);
        features.push(feat);

        // Label: 0=buy, 1=sell, 2=hold (use next trade's direction, last = hold)
        if (i < n - 1) {
          labels.push(trades[i + 1].direction === 'buy' ? 0 : 1);
        } else {
          labels.push(2);
        }

        // Exponential weight
        weights.push(Math.pow(0.99, n - 1 - i));
      }

      await this.router.send('competitive:train', {
        botId,
        features,
        labels,
        sampleWeights: weights
      });
    } catch (err) {
      this.emit('error', err);
    }
  }

  async trainAllBots(): Promise<void> {
    const botIds = this.collector.getBotIds();
    for (const botId of botIds) {
      await this.trainBot(botId);
    }
  }

  async runPredictions(): Promise<void> {
    const botIds = this.collector.getBotIds();
    if (botIds.length === 0) return;

    try {
      const predictionsInput: Record<string, number[]> = {};
      for (const botId of botIds) {
        const trades = this.collector.getBotTrades(botId);
        if (trades.length > 0) {
          const latestTrade = trades[trades.length - 1];
          predictionsInput[botId] = this.buildFeatureVector(latestTrade);
        }
      }

      if (Object.keys(predictionsInput).length === 0) return;

      const result = await this.router.send('competitive:predict_all', {
        predictions: predictionsInput
      });

      const predictions = result.predictions || {};
      for (const [botId, pred] of Object.entries(predictions) as [string, any][]) {
        if (pred.predicted) {
          this.predictions.set(botId, {
            botId,
            symbol: '',
            buyProb: pred.buyProb,
            sellProb: pred.sellProb,
            holdProb: pred.holdProb,
            predictedAction: pred.predictedAction,
            confidence: pred.confidence,
            modelAccuracy: pred.modelAccuracy || 0,
            timestamp: Date.now()
          });
        }
      }

      this.lastPredictionTimestamp = Date.now();
      this.emit('predictions', Array.from(this.predictions.values()));
    } catch (err) {
      this.emit('error', err);
    }
  }

  async detectCrowding(): Promise<void> {
    const recentTrades = this.collector.getRecentTrades(100);
    if (recentTrades.length < 5) return;

    try {
      const result = await this.router.send('competitive:crowding', {
        recentTrades: recentTrades.map(t => ({
          botId: t.botId,
          symbol: t.symbol,
          direction: t.direction,
          timestamp: t.timestamp
        })),
        windowMinutes: 5,
        thresholdRatio: 0.6,
        totalBots: this.collector.getBotIds().length
      });

      this.crowdingAlerts = (result.alerts || []).map((a: any) => ({
        symbol: a.symbol,
        direction: a.direction,
        convergenceRatio: a.convergenceRatio,
        botIds: a.botIds,
        pValue: a.pValue,
        severity: a.severity,
        windowMinutes: a.windowMinutes,
        timestamp: a.timestamp
      }));

      if (this.crowdingAlerts.length > 0) {
        this.emit('crowding', this.crowdingAlerts);
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  async analyzeNiches(): Promise<void> {
    const clustering = this.patterns.getLatestClustering();
    if (!clustering || clustering.archetypes.length === 0) return;

    try {
      const perfByBotRegime: Record<string, Record<string, any>> = {};
      for (const botId of this.collector.getBotIds()) {
        const fp = this.fingerprints.getFingerprint(botId);
        if (fp) {
          perfByBotRegime[botId] = {};
          for (const [regime, perf] of Object.entries(fp.performanceByRegime)) {
            perfByBotRegime[botId][regime] = {
              avgReturn: perf.avgReturn,
              tradeCount: perf.tradeCount
            };
          }
        }
      }

      const result = await this.router.send('competitive:niches', {
        archetypes: clustering.archetypes.map(a => ({
          id: a.id,
          memberBotIds: a.memberBotIds
        })),
        performanceByBotRegime: perfByBotRegime
      });

      this.nicheMap = {
        cells: result.cells || [],
        timestamp: Date.now()
      };

      this.emit('niches', this.nicheMap);
    } catch (err) {
      this.emit('error', err);
    }
  }

  private buildFeatureVector(trade: ArenaTrade): number[] {
    const ind = trade.indicators || {
      rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 0,
      volumeRatio: 1, trendStrength: 0, priceVsMA50: 0, priceVsMA200: 0
    };

    // 8 indicator features + 12 behavioral features
    const regimeMap: Record<string, number> = {
      'TRENDING_UP': 1, 'TRENDING_DOWN': 2, 'RANGING': 3, 'VOLATILE': 4,
      'BREAKOUT_UP': 5, 'BREAKOUT_DOWN': 6, 'EVENT_DRIVEN': 7, 'QUIET': 8
    };

    return [
      ind.rsi14 / 100,
      ind.macdHist,
      ind.bbPosition,
      ind.atr14,
      ind.volumeRatio,
      ind.trendStrength / 100,
      ind.priceVsMA50,
      ind.priceVsMA200,
      trade.direction === 'buy' ? 1 : 0,
      trade.quantity,
      trade.price,
      trade.confidence || 0.5,
      regimeMap[trade.regime] || 3,
      trade.outcome?.pnl || 0,
      trade.outcome?.pnlPercentage || 0,
      trade.outcome?.holdingPeriodMinutes || 0,
      trade.outcome?.maxAdverseExcursion || 0,
      trade.outcome?.maxFavorableExcursion || 0,
      trade.outcome?.isWinner ? 1 : 0,
      trade.timestamp / 1e12
    ];
  }

  getPredictions(): BotPrediction[] {
    return Array.from(this.predictions.values());
  }

  getCrowdingAlerts(): CrowdingAlert[] {
    return this.crowdingAlerts;
  }

  getNicheMap(): NicheMap | null {
    return this.nicheMap;
  }

  getLastPredictionTimestamp(): number {
    return this.lastPredictionTimestamp;
  }

  stop(): void {
    if (this.predictionTimer) clearInterval(this.predictionTimer);
    if (this.crowdingTimer) clearInterval(this.crowdingTimer);
    if (this.nicheTimer) clearInterval(this.nicheTimer);
  }
}
