// ============================================================
// Layer 1: Observation Engine — WebSocket client for Arena
// OBSERVE ONLY — No trading actions
// ============================================================

import { io, Socket } from 'socket.io-client';
import {
  ArenaBotTradeEvent,
  ArenaLeaderboardEvent,
  ArenaTournamentEvent,
  ArenaEvolutionEvent,
  ObservedTrade,
  EnrichedTrade,
  LeaderboardEntry,
  ObservationSnapshot,
} from './types';
import { RingBuffer } from './event-buffer';
import { BotFingerprinter } from './bot-fingerprinter';
import { PriceHistoryManager, classifyRegime } from './indicators';
import { ShapleyAttributor } from './shapley';
import { BehaviorClusterEngine } from './clustering';
import { PatternDiscoveryEngine } from './pattern-discovery';

export interface ObservationEngineConfig {
  arenaUrl: string;         // e.g., 'http://localhost:3000'
  tradeBufferSize: number;  // max trades in ring buffer
  snapshotIntervalMs: number;
  clusteringIntervalMs: number;
  logLevel: 'quiet' | 'normal' | 'verbose';
}

const DEFAULT_CONFIG: ObservationEngineConfig = {
  arenaUrl: 'http://localhost:3000',
  tradeBufferSize: 10000,
  snapshotIntervalMs: 30000,     // snapshot every 30s
  clusteringIntervalMs: 120000,  // re-cluster every 2 min
  logLevel: 'normal',
};

export class ObservationEngine {
  private config: ObservationEngineConfig;
  private socket: Socket | null = null;
  private connected = false;
  private sequenceCounter = 0;

  // Layer 1: Raw observation
  private tradeBuffer: RingBuffer<ObservedTrade>;
  private fingerprinter: BotFingerprinter;
  private priceHistory: PriceHistoryManager;

  // Layer 2: Pattern extraction
  private shapley: ShapleyAttributor;
  private clusterEngine: BehaviorClusterEngine;
  private patternEngine: PatternDiscoveryEngine;

  // Leaderboard state
  private latestLeaderboard: LeaderboardEntry[] = [];
  private tournamentState: {
    id: string;
    status: string;
    round: number;
    totalRounds: number;
  } | null = null;

  // Timers
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private clusteringTimer: ReturnType<typeof setInterval> | null = null;

  // Snapshot history
  private snapshots: RingBuffer<ObservationSnapshot>;

  // Dedup: arena emits trade on both 'arena:bot:trade' and 'continuous:trade'
  private recentTradeHashes: Set<string> = new Set();
  private dedupWindowMs = 2000;

  // Stats
  private startTime = 0;
  private totalTradesReceived = 0;
  private dedupCount = 0;
  private leaderboardUpdates = 0;

  constructor(config: Partial<ObservationEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.tradeBuffer = new RingBuffer<ObservedTrade>(this.config.tradeBufferSize);
    this.fingerprinter = new BotFingerprinter();
    this.priceHistory = new PriceHistoryManager(200, 60000); // 1-min candles

    this.shapley = new ShapleyAttributor(this.fingerprinter);
    this.clusterEngine = new BehaviorClusterEngine(this.fingerprinter);
    this.patternEngine = new PatternDiscoveryEngine(5000);

    this.snapshots = new RingBuffer<ObservationSnapshot>(100);
  }

  /** Start the observation engine */
  async start(): Promise<void> {
    this.startTime = Date.now();
    this.log('='.repeat(60));
    this.log('SUPERIOR TRADING BOT — OBSERVATION ENGINE v1.0');
    this.log('Mode: OBSERVE ONLY — No trading actions');
    this.log(`Arena: ${this.config.arenaUrl}`);
    this.log('='.repeat(60));

    await this.connectToArena();
    this.startPeriodicTasks();
  }

  /** Stop the observation engine */
  async stop(): Promise<void> {
    this.log('Shutting down observation engine...');

    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.clusteringTimer) clearInterval(this.clusteringTimer);

    if (this.socket) {
      this.socket.emit('arena:unsubscribe');
      this.socket.disconnect();
      this.socket = null;
    }

    this.connected = false;
    this.log('Observation engine stopped.');
  }

  // ============================================================
  // WebSocket Connection
  // ============================================================

  private async connectToArena(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log(`Connecting to Arena at ${this.config.arenaUrl}...`);

      this.socket = io(this.config.arenaUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.log(`Connected to Arena (socket ID: ${this.socket!.id})`);

        // Subscribe to arena events
        this.socket!.emit('arena:subscribe');
        this.log('Subscribed to arena events');

        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this.log(`Disconnected from Arena: ${reason}`);
      });

      this.socket.on('reconnect', (attemptNumber: number) => {
        this.log(`Reconnected after ${attemptNumber} attempts`);
        this.socket!.emit('arena:subscribe');
      });

      this.socket.on('connect_error', (error) => {
        if (!this.connected) {
          this.log(`Connection error: ${error.message} — retrying...`);
        }
      });

      // --- Arena Event Handlers ---

      this.socket.on('arena:bot:trade', (event: ArenaBotTradeEvent) => {
        this.handleTrade(event);
      });

      this.socket.on('arena:leaderboard', (event: ArenaLeaderboardEvent) => {
        this.handleLeaderboard(event);
      });

      this.socket.on('arena:tournament', (event: ArenaTournamentEvent) => {
        this.handleTournament(event);
      });

      this.socket.on('arena:evolution', (event: ArenaEvolutionEvent) => {
        this.handleEvolution(event);
      });

      // Also listen for continuous arena events
      this.socket.on('continuous:trade', (event: ArenaBotTradeEvent) => {
        this.handleTrade(event);
      });

      // Timeout after 15s
      setTimeout(() => {
        if (!this.connected) {
          this.log('Connection timeout — will keep retrying in background');
          resolve(); // Don't reject, let reconnection handle it
        }
      }, 15000);
    });
  }

  // ============================================================
  // Event Handlers
  // ============================================================

  private handleTrade(event: ArenaBotTradeEvent): void {
    const now = Date.now();

    // Dedup: same bot+symbol+side+quantity+price within 2s = duplicate
    const hash = `${event.botId}|${event.side}|${event.quantity}|${event.price}|${event.timestamp}`;
    if (this.recentTradeHashes.has(hash)) {
      this.dedupCount++;
      return;
    }
    this.recentTradeHashes.add(hash);
    setTimeout(() => this.recentTradeHashes.delete(hash), this.dedupWindowMs);

    this.totalTradesReceived++;

    const observed: ObservedTrade = {
      ...event,
      observedAt: now,
      sequenceNum: this.sequenceCounter++,
      latencyMs: now - new Date(event.timestamp).getTime(),
    };

    // Layer 1: Buffer and fingerprint
    this.tradeBuffer.push(observed);
    this.fingerprinter.ingest(observed);

    // Update price history
    this.priceHistory.tick(event.symbol, event.price, now);

    // Layer 2: Enrich with indicators and feed to pattern engine
    const indicators = this.priceHistory.computeIndicators(event.symbol);
    const regime = indicators ? classifyRegime(indicators) : 'ranging';

    if (indicators) {
      const enriched: EnrichedTrade = {
        ...observed,
        indicators,
        marketRegime: regime,
      };

      this.patternEngine.ingest(enriched);
      this.shapley.recordContext(observed, indicators, regime);
    }

    if (this.config.logLevel === 'verbose') {
      const dir = event.side === 'buy' ? '\x1b[32mBUY\x1b[0m' : '\x1b[31mSELL\x1b[0m';
      const pnlStr = event.pnl !== 0 ? ` P&L: $${event.pnl.toFixed(2)}` : '';
      this.log(
        `[TRADE] ${event.botName} (${event.groupName}) ${dir} ${event.quantity}x ${event.symbol} @ $${event.price.toFixed(4)}${pnlStr} | ${event.reason}`
      );
    }
  }

  private handleLeaderboard(event: ArenaLeaderboardEvent): void {
    this.latestLeaderboard = event.entries;
    this.leaderboardUpdates++;

    if (this.config.logLevel === 'verbose') {
      this.log(`[LEADERBOARD] Round ${event.roundNumber} — ${event.entries.length} entries`);
      const top3 = event.entries.slice(0, 3);
      for (const entry of top3) {
        this.log(
          `  #${entry.rank} ${entry.botName} (${entry.groupName}) — ` +
          `P&L: ${entry.totalPnLPercent.toFixed(2)}% | ` +
          `Sharpe: ${entry.sharpeRatio.toFixed(2)} | ` +
          `Win: ${(entry.winRate * 100).toFixed(0)}% | ` +
          `Fitness: ${entry.fitness.toFixed(1)}`
        );
      }
    }
  }

  private handleTournament(event: ArenaTournamentEvent): void {
    this.tournamentState = {
      id: event.tournamentId,
      status: event.type,
      round: event.round || 0,
      totalRounds: event.totalRounds || 0,
    };

    this.log(`[TOURNAMENT] ${event.type.toUpperCase()} — Tournament ${event.tournamentId.slice(0, 8)}` +
      (event.round ? ` Round ${event.round}/${event.totalRounds}` : ''));
  }

  private handleEvolution(event: ArenaEvolutionEvent): void {
    this.log(`[EVOLUTION] ${event.type.toUpperCase()} — Generation ${event.generation}`);
    if (event.type === 'complete' && event.results) {
      for (const result of event.results) {
        this.log(
          `  ${result.groupName}: ${result.elites.length} elites, ${result.offspring.length} offspring, ` +
          `fitness ${result.avgFitnessBefore.toFixed(1)} → ${result.avgFitnessAfter.toFixed(1)}`
        );
      }
    }
  }

  // ============================================================
  // Periodic Tasks
  // ============================================================

  private startPeriodicTasks(): void {
    // Periodic snapshot
    this.snapshotTimer = setInterval(() => {
      this.takeSnapshot();
    }, this.config.snapshotIntervalMs);

    // Periodic clustering
    this.clusteringTimer = setInterval(() => {
      this.runClustering();
    }, this.config.clusteringIntervalMs);
  }

  private takeSnapshot(): void {
    const now = Date.now();
    const uptimeMs = now - this.startTime;
    const uptimeMin = uptimeMs / 60000;

    // Trades per minute (last 5 minutes)
    const recentWindow = 5 * 60000;
    const recentTrades = this.tradeBuffer.filter(
      t => t.observedAt > now - recentWindow
    );
    const tradesPerMinute = recentTrades.length / Math.min(uptimeMin, 5);

    // Top and bottom performers from leaderboard
    const sorted = [...this.latestLeaderboard].sort((a, b) => b.totalPnL - a.totalPnL);
    const topPerformers = sorted.slice(0, 5).map(e => ({
      botId: e.botId,
      botName: e.botName,
      pnl: e.totalPnL,
    }));
    const bottomPerformers = sorted.slice(-5).map(e => ({
      botId: e.botId,
      botName: e.botName,
      pnl: e.totalPnL,
    }));

    // Indicator summary
    const indicatorSummary = new Map<string, any>();
    for (const symbol of this.priceHistory.symbols()) {
      const ind = this.priceHistory.computeIndicators(symbol);
      if (ind) indicatorSummary.set(symbol, ind);
    }

    const snapshot: ObservationSnapshot = {
      timestamp: now,
      activeBots: this.fingerprinter.trackedBotIds().length,
      totalTradesObserved: this.totalTradesReceived,
      tradesPerMinute,
      topPerformers,
      bottomPerformers,
      activePatterns: this.patternEngine.getHighConfidencePatterns(),
      clusteringSummary: null, // filled on clustering runs
      indicatorSummary,
    };

    this.snapshots.push(snapshot);

    if (this.config.logLevel !== 'quiet') {
      this.log('');
      this.log(`--- SNAPSHOT (uptime: ${uptimeMin.toFixed(1)}min) ---`);
      this.log(`  Connected: ${this.connected} | Bots tracked: ${snapshot.activeBots}`);
      this.log(`  Total trades: ${snapshot.totalTradesObserved} (${this.dedupCount} dupes filtered) | Rate: ${tradesPerMinute.toFixed(1)}/min`);
      this.log(`  Patterns discovered: ${this.patternEngine.getPatterns().length} (${snapshot.activePatterns.length} high-confidence)`);

      if (topPerformers.length > 0) {
        this.log(`  Top: ${topPerformers[0].botName} ($${topPerformers[0].pnl.toFixed(2)})`);
      }

      // Show Shapley attributions
      const attrs = this.shapley.computeAllAttributions();
      if (attrs.length > 0) {
        const best = attrs[0];
        this.log(`  Best Shapley: ${this.fingerprinter.getFingerprint(best.botId)?.botName || best.botId} ` +
          `(signal: ${best.contributions.signalQuality.toFixed(2)}, ` +
          `timing: ${best.contributions.timing.toFixed(2)}, ` +
          `regime: ${best.contributions.regimeAlignment.toFixed(2)})`);
      }

      // Show symbols being tracked
      const symbols = this.priceHistory.symbols();
      if (symbols.length > 0) {
        this.log(`  Symbols tracked: ${symbols.join(', ')}`);
      }
      this.log('');
    }
  }

  private runClustering(): void {
    const result = this.clusterEngine.cluster();

    if (result.clusters.length > 0 && this.config.logLevel !== 'quiet') {
      this.log('--- BEHAVIORAL CLUSTERS ---');
      for (const cluster of result.clusters) {
        const memberNames = cluster.memberBotIds
          .map(id => this.fingerprinter.getFingerprint(id)?.botName || id.slice(0, 8))
          .join(', ');
        this.log(
          `  Cluster "${cluster.label}" (${cluster.memberBotIds.length} bots): ${memberNames}`
        );
        this.log(
          `    Strategy: ${cluster.dominantStrategy} | Avg P&L: $${cluster.avgFitness.toFixed(2)}`
        );
      }
      if (result.noise.length > 0) {
        this.log(`  Noise (unclustered): ${result.noise.length} bots`);
      }
      this.log(`  Silhouette score: ${result.silhouetteScore.toFixed(3)}`);
      this.log('');
    }

    // Store in latest snapshot
    const latestSnapshot = this.snapshots.latest();
    if (latestSnapshot) {
      latestSnapshot.clusteringSummary = result;
    }
  }

  // ============================================================
  // Public Query API
  // ============================================================

  /** Get current connection status */
  get status(): { connected: boolean; uptime: number; trades: number; bots: number } {
    return {
      connected: this.connected,
      uptime: Date.now() - this.startTime,
      trades: this.totalTradesReceived,
      bots: this.fingerprinter.trackedBotIds().length,
    };
  }

  /** Get fingerprint for a specific bot */
  getBotFingerprint(botId: string) {
    return this.fingerprinter.getFingerprint(botId);
  }

  /** Get all bot fingerprints */
  getAllFingerprints() {
    return this.fingerprinter.getAllFingerprints();
  }

  /** Get latest leaderboard */
  getLeaderboard() {
    return this.latestLeaderboard;
  }

  /** Get discovered patterns */
  getPatterns() {
    return this.patternEngine.getPatterns();
  }

  /** Get Shapley attributions */
  getAttributions() {
    return this.shapley.computeAllAttributions();
  }

  /** Get latest snapshot */
  getLatestSnapshot() {
    return this.snapshots.latest();
  }

  /** Get snapshot history */
  getSnapshots() {
    return this.snapshots.toArray();
  }

  /** Get recent trades */
  getRecentTrades(count: number = 50) {
    return this.tradeBuffer.recent(count);
  }

  /** Get indicator state for a symbol */
  getIndicators(symbol: string) {
    return this.priceHistory.computeIndicators(symbol);
  }

  /** Run clustering on demand */
  runClusteringNow() {
    return this.clusterEngine.cluster();
  }

  // ============================================================
  // Logging
  // ============================================================

  private log(message: string): void {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[${ts}] ${message}`);
  }
}
