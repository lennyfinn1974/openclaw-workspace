import { EventEmitter } from 'events';
import { ArenaTrade, LeaderboardEntry, BotDNA, MarketRegime } from '../types/intelligence';

export class ArenaRestClient extends EventEmitter {
  private baseUrl: string;
  private pollIntervalMs: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastTradeTimestamp = 0;

  constructor(opts?: { baseUrl?: string; pollIntervalMs?: number }) {
    super();
    this.baseUrl = opts?.baseUrl || 'http://localhost:8101';
    this.pollIntervalMs = opts?.pollIntervalMs || 5000;
  }

  async start(): Promise<void> {
    // Verify connection
    await this.fetchHealth();
    this.startPolling();
  }

  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollNewTrades();
        await this.pollLeaderboard();
      } catch (err: any) {
        this.emit('error', err);
      }
    }, this.pollIntervalMs);
  }

  async fetchHealth(): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/health`);
    if (!resp.ok) throw new Error(`Arena health check failed: ${resp.status}`);
    return resp.json();
  }

  async fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/leaderboard`);
      if (!resp.ok) return [];
      const data = await resp.json();
      return this.normalizeLeaderboard(data);
    } catch {
      return [];
    }
  }

  async fetchBotTrades(botId: string, limit = 100): Promise<ArenaTrade[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/bots/${botId}/trades?limit=${limit}`);
      if (!resp.ok) return [];
      const data = await resp.json();
      return this.normalizeTrades(data);
    } catch {
      return [];
    }
  }

  async fetchAllBots(): Promise<string[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/bots`);
      if (!resp.ok) return [];
      const data = await resp.json();
      if (Array.isArray(data)) {
        return data.map((b: any) => b.id || b.botId || b);
      }
      return [];
    } catch {
      return [];
    }
  }

  async fetchRecentTrades(limit = 50): Promise<ArenaTrade[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/trades/recent?limit=${limit}`);
      if (!resp.ok) return [];
      const data = await resp.json();
      return this.normalizeTrades(data);
    } catch {
      return [];
    }
  }

  async fetchBotDNA(botId: string): Promise<BotDNA | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/bots/${botId}/dna`);
      if (!resp.ok) return null;
      return resp.json() as Promise<BotDNA>;
    } catch {
      return null;
    }
  }

  private async pollNewTrades(): Promise<void> {
    const trades = await this.fetchRecentTrades(20);
    const newTrades = trades.filter(t => t.timestamp > this.lastTradeTimestamp);
    if (newTrades.length > 0) {
      this.lastTradeTimestamp = Math.max(...newTrades.map(t => t.timestamp));
      for (const trade of newTrades) {
        this.emit('trade', trade);
      }
    }
  }

  private async pollLeaderboard(): Promise<void> {
    const entries = await this.fetchLeaderboard();
    if (entries.length > 0) {
      this.emit('leaderboard', entries);
    }
  }

  private normalizeTrades(data: any): ArenaTrade[] {
    const items = Array.isArray(data) ? data : (data?.trades || data?.data || []);
    return items.map((t: any) => ({
      id: t.id || t.tradeId || `${t.botId}-${t.timestamp}`,
      botId: t.botId || t.bot_id,
      symbol: t.symbol || t.pair || 'UNKNOWN',
      direction: (t.direction || t.action || t.side || 'buy').toLowerCase() as 'buy' | 'sell',
      quantity: t.quantity || t.amount || t.size || 0,
      price: t.price || 0,
      timestamp: t.timestamp || Date.now(),
      regime: (t.regime || t.market_regime || 'RANGING') as MarketRegime,
      confidence: t.confidence,
      indicators: t.indicators || t.preTradeIndicators || undefined,
      outcome: t.outcome || undefined
    }));
  }

  private normalizeLeaderboard(data: any): LeaderboardEntry[] {
    const items = Array.isArray(data) ? data : (data?.leaderboard || data?.data || []);
    return items.map((e: any, i: number) => ({
      botId: e.botId || e.bot_id || e.id,
      rank: e.rank || i + 1,
      fitness: e.fitness || 0,
      pnl: e.pnl || e.totalPnl || 0,
      winRate: e.winRate || e.win_rate || 0,
      sharpe: e.sharpe || e.sharpeRatio || 0,
      drawdown: e.drawdown || e.maxDrawdown || 0,
      tradeCount: e.tradeCount || e.trade_count || e.trades || 0
    }));
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
