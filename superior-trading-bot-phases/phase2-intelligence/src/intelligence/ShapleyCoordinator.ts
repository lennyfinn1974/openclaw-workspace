import { EventEmitter } from 'events';
import { MessageRouter } from '../ipc/MessageRouter';
import { ArenaDataCollector } from '../arena/ArenaDataCollector';
import { ShapleyAttribution, BotAttributionSummary, ArenaTrade } from '../types/intelligence';

export class ShapleyCoordinator extends EventEmitter {
  private router: MessageRouter;
  private collector: ArenaDataCollector;
  private attributions = new Map<string, ShapleyAttribution[]>(); // botId -> attributions
  private summaries = new Map<string, BotAttributionSummary>();
  private pendingTrades: ArenaTrade[] = [];
  private batchSize = 20;
  private batchIntervalMs = 30000;
  private batchTimer: NodeJS.Timeout | null = null;
  private lastRunTimestamp = 0;

  constructor(router: MessageRouter, collector: ArenaDataCollector) {
    super();
    this.router = router;
    this.collector = collector;
  }

  start(): void {
    this.collector.on('trade', (trade: ArenaTrade) => {
      if (trade.outcome) {
        this.pendingTrades.push(trade);
        if (this.pendingTrades.length >= this.batchSize) {
          this.processBatch();
        }
      }
    });

    this.batchTimer = setInterval(() => {
      if (this.pendingTrades.length > 0) {
        this.processBatch();
      }
    }, this.batchIntervalMs);
  }

  async processBatch(): Promise<void> {
    if (this.pendingTrades.length === 0) return;

    const batch = this.pendingTrades.splice(0, this.batchSize);
    const allTrades = this.collector.getAllTrades();

    try {
      const payload = {
        trades: batch.map(t => ({
          id: t.id,
          botId: t.botId,
          symbol: t.symbol,
          direction: t.direction,
          quantity: t.quantity,
          price: t.price,
          timestamp: t.timestamp,
          regime: t.regime,
          pnl: t.outcome?.pnl || 0,
          pnlPercentage: t.outcome?.pnlPercentage || 0,
          holdingPeriodMinutes: t.outcome?.holdingPeriodMinutes || 0,
          indicators: t.indicators || {
            rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 0,
            volumeRatio: 1, trendStrength: 0, priceVsMA50: 0, priceVsMA200: 0
          }
        })),
        permutations: 100
      };

      const result = await this.router.send('shapley:batch', payload);
      const attributionResults: ShapleyAttribution[] = result.attributions || [];

      for (const attr of attributionResults) {
        if (!this.attributions.has(attr.botId)) {
          this.attributions.set(attr.botId, []);
        }
        const botAttrs = this.attributions.get(attr.botId)!;
        botAttrs.push(attr);
        // Keep last 200 per bot
        if (botAttrs.length > 200) botAttrs.shift();

        this.updateSummary(attr.botId);
      }

      this.lastRunTimestamp = Date.now();
      this.emit('batch_complete', attributionResults);
    } catch (err) {
      this.emit('error', err);
    }
  }

  private updateSummary(botId: string): void {
    const attrs = this.attributions.get(botId);
    if (!attrs || attrs.length === 0) return;

    const n = attrs.length;
    const avgRegime = attrs.reduce((s, a) => s + a.regimeContribution, 0) / n;
    const avgTiming = attrs.reduce((s, a) => s + a.timingContribution, 0) / n;
    const avgDirection = attrs.reduce((s, a) => s + a.directionContribution, 0) / n;
    const avgSizing = attrs.reduce((s, a) => s + a.sizingContribution, 0) / n;

    const factors = [
      { name: 'regime' as const, val: Math.abs(avgRegime) },
      { name: 'timing' as const, val: Math.abs(avgTiming) },
      { name: 'direction' as const, val: Math.abs(avgDirection) },
      { name: 'sizing' as const, val: Math.abs(avgSizing) }
    ];
    const dominant = factors.sort((a, b) => b.val - a.val)[0].name;

    this.summaries.set(botId, {
      botId,
      tradeCount: n,
      avgRegimeContribution: avgRegime,
      avgTimingContribution: avgTiming,
      avgDirectionContribution: avgDirection,
      avgSizingContribution: avgSizing,
      dominantFactor: dominant,
      lastUpdated: Date.now()
    });
  }

  getAttribution(botId: string): ShapleyAttribution[] {
    return this.attributions.get(botId) || [];
  }

  getSummary(botId: string): BotAttributionSummary | undefined {
    return this.summaries.get(botId);
  }

  getAllSummaries(): BotAttributionSummary[] {
    return Array.from(this.summaries.values());
  }

  getLastRunTimestamp(): number {
    return this.lastRunTimestamp;
  }

  stop(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
