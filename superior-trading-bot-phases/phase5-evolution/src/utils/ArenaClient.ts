import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import {
  ArenaSnapshot,
  ArenaBotTradeEvent,
  ArenaLeaderboardEvent,
  ArenaEvolutionEvent,
  ArenaTournamentEvent,
  ArenaStatus,
  LeaderboardEntry,
} from '../types';

export class ArenaClient extends EventEmitter {
  private socket: Socket | null = null;
  private readonly url: string;
  private leaderboard: LeaderboardEntry[] = [];
  private botTrades: Map<string, ArenaBotTradeEvent[]> = new Map();
  private currentGeneration = 0;
  private arenaStatus: ArenaStatus | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url = 'http://localhost:3000') {
    super();
    this.url = url;
  }

  connect(): void {
    console.log(`[ArenaClient] Connecting to ${this.url}...`);

    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('[ArenaClient] Connected to arena');
      this.connected = true;
      this.socket!.emit('arena:subscribe');
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[ArenaClient] Disconnected: ${reason}`);
      this.connected = false;
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (err) => {
      if (!this.connected) {
        console.log(`[ArenaClient] Connection failed (will retry): ${err.message}`);
      }
    });

    // Arena status on subscribe
    this.socket.on('arena:status', (status: ArenaStatus) => {
      this.arenaStatus = status;
      this.currentGeneration = status.generation;
      this.emit('status', status);
    });

    // Bot trade events
    this.socket.on('arena:bot:trade', (event: ArenaBotTradeEvent) => {
      const trades = this.botTrades.get(event.botId) || [];
      trades.push(event);
      // Keep last 500 trades per bot
      if (trades.length > 500) trades.shift();
      this.botTrades.set(event.botId, trades);
      this.emit('trade', event);
    });

    // Continuous arena trade events (same format)
    this.socket.on('continuous:trade', (event: ArenaBotTradeEvent) => {
      const trades = this.botTrades.get(event.botId) || [];
      trades.push(event);
      if (trades.length > 500) trades.shift();
      this.botTrades.set(event.botId, trades);
      this.emit('trade', event);
    });

    // Leaderboard updates
    this.socket.on('arena:leaderboard', (event: ArenaLeaderboardEvent) => {
      this.leaderboard = event.entries;
      this.emit('leaderboard', event);
    });

    // Evolution events
    this.socket.on('arena:evolution', (event: ArenaEvolutionEvent) => {
      if (event.type === 'complete') {
        this.currentGeneration = event.generation;
      }
      this.emit('evolution', event);
    });

    // Tournament events
    this.socket.on('arena:tournament', (event: ArenaTournamentEvent) => {
      this.emit('tournament', event);
    });

    this.socket.on('continuous:tournament', (event: ArenaTournamentEvent) => {
      this.emit('tournament', event);
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.emit('arena:unsubscribe');
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    console.log('[ArenaClient] Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLeaderboard(): LeaderboardEntry[] {
    return [...this.leaderboard];
  }

  getBotTrades(botId: string): ArenaBotTradeEvent[] {
    return [...(this.botTrades.get(botId) || [])];
  }

  getAllBotTrades(): Map<string, ArenaBotTradeEvent[]> {
    return new Map(this.botTrades);
  }

  getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  getStatus(): ArenaStatus | null {
    return this.arenaStatus;
  }

  getSnapshot(): ArenaSnapshot {
    return {
      leaderboard: this.getLeaderboard(),
      botTrades: this.getAllBotTrades(),
      currentGeneration: this.currentGeneration,
      timestamp: Date.now(),
    };
  }
}
