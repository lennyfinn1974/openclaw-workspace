import { EventEmitter } from 'events';
import { MessageRouter } from '../ipc/MessageRouter';
import { ArenaDataCollector } from '../arena/ArenaDataCollector';
import { ClusteringResult, BotEmbedding, Archetype } from '../types/intelligence';

export class PatternCoordinator extends EventEmitter {
  private router: MessageRouter;
  private collector: ArenaDataCollector;
  private latestClustering: ClusteringResult | null = null;
  private clusterIntervalMs = 300000; // 5 minutes
  private clusterTimer: NodeJS.Timeout | null = null;
  private lastRunTimestamp = 0;

  constructor(router: MessageRouter, collector: ArenaDataCollector) {
    super();
    this.router = router;
    this.collector = collector;
  }

  start(): void {
    // Initial clustering after a delay to collect data
    setTimeout(() => this.runClustering(), 10000);

    this.clusterTimer = setInterval(() => {
      this.runClustering();
    }, this.clusterIntervalMs);
  }

  async runClustering(): Promise<void> {
    const botIds = this.collector.getBotIds();
    console.log(`[Patterns] Clustering check: ${botIds.length} bots`);
    if (botIds.length < 3) return;

    try {
      // Step 1: Extract features — require only 1 trade per bot
      const botTrades: Record<string, any[]> = {};
      for (const botId of botIds) {
        const trades = this.collector.getBotTrades(botId);
        if (trades.length >= 1) {
          botTrades[botId] = trades.map(t => ({
            direction: t.direction,
            quantity: t.quantity,
            price: t.price,
            timestamp: t.timestamp,
            regime: t.regime,
            pnl: t.outcome?.pnl || 0,
            holdingPeriodMinutes: t.outcome?.holdingPeriodMinutes || 0,
            confidence: t.confidence,
            indicators: t.indicators
          }));
        }
      }

      const botCount = Object.keys(botTrades).length;
      console.log(`[Patterns] ${botCount} bots have trades for clustering`);
      if (botCount < 3) return;

      const featureResult = await this.router.send('patterns:extract_features', { botTrades });
      const features = featureResult.features;

      if (!features || Object.keys(features).length < 3) return;

      // Step 2: UMAP + HDBSCAN
      const clusterResult = await this.router.send('patterns:cluster', {
        features,
        nNeighbors: 5,
        minDist: 0.1,
        minClusterSize: 3
      });

      // Build ClusteringResult
      const archetypes: Archetype[] = (clusterResult.archetypes || []).map((a: any) => ({
        id: a.id,
        label: a.label,
        memberBotIds: a.memberBotIds,
        centroid5D: a.centroid5D,
        dominantTraits: a.dominantTraits || [],
        avgPerformance: 0
      }));

      const embeddings: BotEmbedding[] = [];
      const assignments = clusterResult.assignments || {};
      for (const [botId, data] of Object.entries(assignments) as [string, any][]) {
        embeddings.push({
          botId,
          coords5D: data.coords5D,
          archetypeId: data.archetypeId,
          archetypeDistance: data.distance
        });
      }

      this.latestClustering = {
        archetypes,
        embeddings,
        noise: clusterResult.noise || [],
        timestamp: Date.now(),
        silhouetteScore: clusterResult.silhouetteScore || 0
      };

      this.lastRunTimestamp = Date.now();
      console.log(`[Patterns] Clustering complete: ${archetypes.length} archetypes, ${embeddings.length} embeddings, silhouette=${this.latestClustering.silhouetteScore.toFixed(3)}`);
      this.emit('clustered', this.latestClustering);
    } catch (err: any) {
      console.error(`[Patterns] Clustering error: ${err.message || err}`);
      this.emit('error', err);
    }
  }

  getLatestClustering(): ClusteringResult | null {
    return this.latestClustering;
  }

  getArchetypes(): Archetype[] {
    return this.latestClustering?.archetypes || [];
  }

  getEmbeddings(): BotEmbedding[] {
    return this.latestClustering?.embeddings || [];
  }

  getLastRunTimestamp(): number {
    return this.lastRunTimestamp;
  }

  stop(): void {
    if (this.clusterTimer) {
      clearInterval(this.clusterTimer);
      this.clusterTimer = null;
    }
  }
}
