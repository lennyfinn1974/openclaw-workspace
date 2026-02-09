/**
 * Arena Connector
 *
 * Connects to the live 21-bot Wargames Arena on localhost:8101 via Socket.IO.
 * Subscribes to the 'arena' room and forwards all events to the dashboard.
 * Handles reconnection, status tracking, and event normalization.
 */

import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { ObservationEvent, BotSummary, MarketRegime } from './types';

// ===================== ARENA EVENT TYPES =====================

interface ArenaBotTradeEvent {
  botId: string;
  botName: string;
  groupName: 'Alpha' | 'Beta' | 'Gamma';
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  reason: string;
  pnl: number;
  timestamp: string;
}

interface LeaderboardEntry {
  rank: number;
  botId: string;
  botName: string;
  groupName: 'Alpha' | 'Beta' | 'Gamma';
  symbol: string;
  totalPnL: number;
  totalPnLPercent: number;
  sharpeRatio: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  fitness: number;
}

interface ArenaLeaderboardEvent {
  tournamentId: string;
  roundNumber: number;
  entries: LeaderboardEntry[];
}

interface ArenaTournamentEvent {
  type: 'start' | 'round_start' | 'round_end' | 'pause' | 'resume' | 'complete';
  tournamentId: string;
  round?: number;
  totalRounds?: number;
}

interface ArenaEvolutionEvent {
  type: 'start' | 'complete';
  generation: number;
  results?: any[];
}

interface ArenaStatus {
  isRunning: boolean;
  generation: number;
  tournament: any;
  totalBots: number;
  totalTrades: number;
  topBot: LeaderboardEntry | null;
  groups: { name: string; assetClass: string; botCount: number; avgPnL: number }[];
  marketSessions: Record<string, {
    state: string;
    canTrade: boolean;
    sessionName: string;
    volatilityMultiplier: number;
  }>;
  localTime: string;
  dataFeed: {
    botId: string;
    botName: string;
    symbol: string;
    group: string;
    isLive: boolean;
    canTrade: boolean;
    sessionName: string;
    price: number;
  }[];
}

// ===================== ARENA CONNECTOR =====================

export class ArenaConnector extends EventEmitter {
  private socket: Socket | null = null;
  private arenaUrl: string;
  private connected = false;
  private subscribed = false;
  private reconnectAttempts = 0;
  private arenaStatus: ArenaStatus | null = null;
  private leaderboard: LeaderboardEntry[] = [];
  private tradeCount = 0;
  private eventCounter = 0;

  constructor(arenaUrl: string = 'http://localhost:8101') {
    super();
    this.arenaUrl = arenaUrl;
  }

  // ===================== LIFECYCLE =====================

  connect(): void {
    console.log(`[ARENA] Connecting to live arena at ${this.arenaUrl}...`);

    this.socket = io(this.arenaUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.emit('arena:unsubscribe');
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.subscribed = false;
    console.log('[ARENA] Disconnected from arena');
  }

  // ===================== EVENT HANDLERS =====================

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection lifecycle
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[ARENA] Connected to live arena');

      // Subscribe to arena room
      this.socket!.emit('arena:subscribe');
      this.subscribed = true;
      console.log('[ARENA] Subscribed to arena events');

      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.subscribed = false;
      console.log(`[ARENA] Disconnected: ${reason}`);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= 3) {
        console.log(`[ARENA] Connection attempt ${this.reconnectAttempts} failed: ${error.message}`);
      }
    });

    // Arena status (sent on subscribe)
    this.socket.on('arena:status', (status: ArenaStatus) => {
      this.arenaStatus = status;
      console.log(`[ARENA] Status: ${status.totalBots} bots, gen ${status.generation}, ${status.isRunning ? 'RUNNING' : 'PAUSED'}`);

      // Initialize bots from data feed
      if (status.dataFeed) {
        for (const bot of status.dataFeed) {
          const entry = status.topBot && status.topBot.botId === bot.botId ? status.topBot : null;
          this.emit('bot', this.toBotSummary(bot, entry));
        }
      }

      this.emit('arena:status', status);
    });

    // Bot trades
    this.socket.on('arena:bot:trade', (event: ArenaBotTradeEvent) => {
      this.tradeCount++;
      const obsEvent = this.toObservationEvent('trade', event, {
        botId: event.botId,
        botName: event.botName,
        symbol: event.symbol,
        direction: event.side,
        quantity: event.quantity,
        price: event.price,
        reason: event.reason,
        pnl: event.pnl,
        group: event.groupName,
      });
      this.emit('event', obsEvent);
      this.emit('trade', event);
    });

    // Continuous arena trades (same format)
    this.socket.on('continuous:trade', (event: ArenaBotTradeEvent) => {
      this.tradeCount++;
      const obsEvent = this.toObservationEvent('trade', event, {
        botId: event.botId,
        botName: event.botName,
        symbol: event.symbol,
        direction: event.side,
        quantity: event.quantity,
        price: event.price,
        reason: event.reason,
        pnl: event.pnl,
        group: event.groupName,
        source: 'continuous',
      });
      this.emit('event', obsEvent);
      this.emit('trade', event);
    });

    // Leaderboard
    this.socket.on('arena:leaderboard', (event: ArenaLeaderboardEvent) => {
      this.leaderboard = event.entries || [];
      const obsEvent = this.toObservationEvent('fitness_change', event, {
        tournamentId: event.tournamentId,
        round: event.roundNumber,
        entries: (event.entries || []).length,
        topBot: event.entries?.[0]?.botName || 'N/A',
      });
      this.emit('event', obsEvent);
      this.emit('leaderboard', event);

      // Update bots from leaderboard
      if (event.entries) {
        for (const entry of event.entries) {
          this.emit('bot', {
            botId: entry.botName,
            fitness: entry.fitness,
            rank: entry.rank,
            trades: entry.totalTrades,
            winRate: entry.winRate / 100, // Convert from percentage
            pnl: entry.totalPnL,
            strategy: entry.groupName,
            regime: this.detectRegime(),
          } as BotSummary);
        }
      }
    });

    // Tournament events
    this.socket.on('arena:tournament', (event: ArenaTournamentEvent) => {
      const obsEvent = this.toObservationEvent('position_update', event, {
        tournamentType: event.type,
        tournamentId: event.tournamentId,
        round: event.round,
      });
      this.emit('event', obsEvent);
      this.emit('tournament', event);
      console.log(`[ARENA] Tournament: ${event.type}${event.round ? ` round ${event.round}` : ''}`);
    });

    this.socket.on('continuous:tournament', (event: any) => {
      this.emit('event', this.toObservationEvent('position_update', event, {
        type: 'continuous_tournament',
        ...event,
      }));
    });

    // Evolution events
    this.socket.on('arena:evolution', (event: ArenaEvolutionEvent) => {
      const obsEvent = this.toObservationEvent('dna_mutation', event, {
        evolutionType: event.type,
        generation: event.generation,
        results: event.results?.length || 0,
      });
      this.emit('event', obsEvent);
      this.emit('evolution', event);
      console.log(`[ARENA] Evolution ${event.type}: gen ${event.generation}`);
    });

    this.socket.on('continuous:evolution_triggered', (event: any) => {
      const obsEvent = this.toObservationEvent('dna_mutation', event, {
        type: 'auto_evolution',
        group: event.groupName,
        generation: event.generation,
        reason: event.reason,
      });
      this.emit('event', obsEvent);
      console.log(`[ARENA] Auto-evolution: ${event.groupName} gen ${event.generation}`);
    });

    // Market session events
    this.socket.on('continuous:market_open', (event: any) => {
      this.emit('event', this.toObservationEvent('position_update', event, {
        type: 'market_open',
        group: event.groupName,
        session: event.sessionName,
        volatility: event.volatilityMultiplier,
      }));
      console.log(`[ARENA] Market OPEN: ${event.groupName} — ${event.sessionName}`);
    });

    this.socket.on('continuous:market_close', (event: any) => {
      this.emit('event', this.toObservationEvent('position_update', event, {
        type: 'market_close',
        group: event.groupName,
        session: event.sessionName,
      }));
      console.log(`[ARENA] Market CLOSE: ${event.groupName} — ${event.sessionName}`);
    });

    // Continuous arena lifecycle
    this.socket.on('continuous:started', () => {
      console.log('[ARENA] Continuous arena started');
      this.emit('event', this.toObservationEvent('position_update', {}, {
        type: 'continuous_started',
      }));
    });

    this.socket.on('continuous:stopped', () => {
      console.log('[ARENA] Continuous arena stopped');
    });

    // Also listen for raw quote data for market awareness
    this.socket.on('quote', (quote: any) => {
      this.emit('quote', quote);
    });
  }

  // ===================== HELPERS =====================

  private toObservationEvent(
    eventType: string,
    raw: any,
    payload: any
  ): ObservationEvent {
    this.eventCounter++;
    return {
      id: `arena-${this.eventCounter}`,
      timestamp: Date.now(),
      source: 'arena_bot',
      eventType: eventType as any,
      payload,
    };
  }

  private toBotSummary(
    feedEntry: ArenaStatus['dataFeed'][0],
    leaderEntry: LeaderboardEntry | null
  ): BotSummary {
    return {
      botId: feedEntry.botName,
      fitness: leaderEntry?.fitness || 0.5,
      rank: leaderEntry?.rank || 0,
      trades: leaderEntry?.totalTrades || 0,
      winRate: leaderEntry ? leaderEntry.winRate / 100 : 0.5,
      pnl: leaderEntry?.totalPnL || 0,
      strategy: feedEntry.group,
      regime: this.detectRegime(),
    };
  }

  private detectRegime(): MarketRegime {
    // Simple regime detection from arena status
    if (!this.arenaStatus) return 'QUIET';
    const sessions = this.arenaStatus.marketSessions;
    const openCount = Object.values(sessions).filter(s => s.canTrade).length;
    if (openCount === 0) return 'QUIET';
    const avgVol = Object.values(sessions)
      .filter(s => s.canTrade)
      .reduce((sum, s) => sum + s.volatilityMultiplier, 0) / openCount;
    if (avgVol > 1.2) return 'VOLATILE';
    if (avgVol > 0.9) return 'TRENDING';
    return 'RANGING';
  }

  // ===================== GETTERS =====================

  isConnected(): boolean { return this.connected; }
  isSubscribed(): boolean { return this.subscribed; }
  getArenaStatus(): ArenaStatus | null { return this.arenaStatus; }
  getLeaderboard(): LeaderboardEntry[] { return this.leaderboard; }
  getTradeCount(): number { return this.tradeCount; }
  getReconnectAttempts(): number { return this.reconnectAttempts; }
}
