import { EventEmitter } from 'events';
import { ArenaRestClient } from './ArenaRestClient';
import { ArenaSocketClient } from './ArenaSocketClient';
import { ArenaTrade, LeaderboardEntry } from '../types/intelligence';

export class ArenaDataCollector extends EventEmitter {
  private rest: ArenaRestClient;
  private socket: ArenaSocketClient;
  private tradeHistory = new Map<string, ArenaTrade[]>(); // botId -> trades
  private allTrades: ArenaTrade[] = [];
  private leaderboard: LeaderboardEntry[] = [];
  private seenTradeIds = new Set<string>();
  private maxTradesPerBot = 500;
  private maxTotalTrades = 10000;

  constructor(opts?: { arenaUrl?: string; pollIntervalMs?: number }) {
    super();
    const url = opts?.arenaUrl || 'http://localhost:8101';
    this.rest = new ArenaRestClient({ baseUrl: url, pollIntervalMs: opts?.pollIntervalMs });
    this.socket = new ArenaSocketClient(url);
  }

  async start(): Promise<void> {
    // Wire up events from both sources — deduplicate by trade ID
    this.socket.on('trade', (trade: ArenaTrade) => this.ingestTrade(trade));
    this.rest.on('trade', (trade: ArenaTrade) => this.ingestTrade(trade));

    this.socket.on('leaderboard', (lb: LeaderboardEntry[]) => {
      this.leaderboard = lb;
      this.emit('leaderboard', lb);
    });
    this.rest.on('leaderboard', (lb: LeaderboardEntry[]) => {
      this.leaderboard = lb;
      this.emit('leaderboard', lb);
    });

    // Try Socket.IO first, fall back to REST-only
    try {
      await this.socket.start();
    } catch (err) {
      console.error('[ArenaDataCollector] Socket.IO failed, using REST polling only');
    }

    try {
      await this.rest.start();
    } catch (err) {
      console.error('[ArenaDataCollector] REST polling start failed:', (err as Error).message);
    }

    // Bootstrap: fetch existing trade history
    await this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      const bots = await this.rest.fetchAllBots();
      for (const botId of bots) {
        const trades = await this.rest.fetchBotTrades(botId, this.maxTradesPerBot);
        for (const trade of trades) {
          this.ingestTrade(trade);
        }
      }
      const lb = await this.rest.fetchLeaderboard();
      if (lb.length > 0) {
        this.leaderboard = lb;
        this.emit('leaderboard', lb);
      }
    } catch (err) {
      console.error('[ArenaDataCollector] Bootstrap failed:', (err as Error).message);
    }
  }

  private ingestTrade(trade: ArenaTrade): void {
    if (this.seenTradeIds.has(trade.id)) return;
    this.seenTradeIds.add(trade.id);

    // Per-bot history
    if (!this.tradeHistory.has(trade.botId)) {
      this.tradeHistory.set(trade.botId, []);
    }
    const botTrades = this.tradeHistory.get(trade.botId)!;
    botTrades.push(trade);
    if (botTrades.length > this.maxTradesPerBot) {
      botTrades.shift();
    }

    // Global history
    this.allTrades.push(trade);
    if (this.allTrades.length > this.maxTotalTrades) {
      const removed = this.allTrades.shift()!;
      this.seenTradeIds.delete(removed.id);
    }

    this.emit('trade', trade);
  }

  getBotTrades(botId: string): ArenaTrade[] {
    return this.tradeHistory.get(botId) || [];
  }

  getAllTrades(): ArenaTrade[] {
    return this.allTrades;
  }

  getRecentTrades(n: number): ArenaTrade[] {
    return this.allTrades.slice(-n);
  }

  getBotIds(): string[] {
    return Array.from(this.tradeHistory.keys());
  }

  getLeaderboard(): LeaderboardEntry[] {
    return this.leaderboard;
  }

  getTradeCount(): number {
    return this.allTrades.length;
  }

  isConnected(): boolean {
    return this.socket.isConnected();
  }

  stop(): void {
    this.rest.stop();
    this.socket.stop();
  }
}
