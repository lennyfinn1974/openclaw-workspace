import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { ArenaTrade, LeaderboardEntry, MarketRegime } from '../types/intelligence';

export class ArenaSocketClient extends EventEmitter {
  private socket: Socket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private connected = false;

  constructor(url = 'http://localhost:8101') {
    super();
    this.url = url;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.url, {
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        transports: ['websocket', 'polling']
      });

      const connectTimeout = setTimeout(() => {
        reject(new Error('Socket.IO connection timeout'));
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this.emit('disconnected', reason);
      });

      this.socket.on('connect_error', (err) => {
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          clearTimeout(connectTimeout);
          reject(new Error(`Socket.IO failed after ${this.maxReconnectAttempts} attempts`));
        }
      });

      // Arena events
      this.socket.on('trade', (data: any) => {
        const trade = this.normalizeTrade(data);
        if (trade) this.emit('trade', trade);
      });

      this.socket.on('trade:executed', (data: any) => {
        const trade = this.normalizeTrade(data);
        if (trade) this.emit('trade', trade);
      });

      this.socket.on('leaderboard', (data: any) => {
        this.emit('leaderboard', this.normalizeLeaderboard(data));
      });

      this.socket.on('leaderboard:update', (data: any) => {
        this.emit('leaderboard', this.normalizeLeaderboard(data));
      });

      this.socket.on('fitness:update', (data: any) => {
        this.emit('fitness', data);
      });

      this.socket.on('dna:mutation', (data: any) => {
        this.emit('dna_change', data);
      });

      this.socket.on('evolution:cycle', (data: any) => {
        this.emit('evolution', data);
      });

      this.socket.on('regime:change', (data: any) => {
        this.emit('regime_change', data);
      });
    });
  }

  private normalizeTrade(data: any): ArenaTrade | null {
    if (!data) return null;
    return {
      id: data.id || data.tradeId || `${data.botId}-${data.timestamp || Date.now()}`,
      botId: data.botId || data.bot_id,
      symbol: data.symbol || data.pair || 'UNKNOWN',
      direction: (data.direction || data.action || data.side || 'buy').toLowerCase() as 'buy' | 'sell',
      quantity: data.quantity || data.amount || data.size || 0,
      price: data.price || 0,
      timestamp: data.timestamp || Date.now(),
      regime: (data.regime || data.market_regime || 'RANGING') as MarketRegime,
      confidence: data.confidence,
      indicators: data.indicators || data.preTradeIndicators,
      outcome: data.outcome
    };
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

  isConnected(): boolean {
    return this.connected;
  }

  stop(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}
