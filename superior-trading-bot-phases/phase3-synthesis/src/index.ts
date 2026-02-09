/**
 * PHASE 3: Strategy Synthesis & Paper Trading — Main Orchestrator
 *
 * Connects all engines into a unified pipeline:
 *   Arena API → GP Evolution → NMF Factor Analysis → Adversarial Generation
 *                    ↓                    ↓                    ↓
 *            Strategy Lifecycle → Paper Trading Engine → Validation
 *                    ↓
 *            Express/Socket.IO Dashboard API
 *
 * Pulls Phase 2 pattern data from the Arena WebSocket and feeds it into
 * the synthesis pipeline. Results are tracked through the full lifecycle.
 */

import { EventEmitter } from 'events';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import {
  Phase3Config, Phase3Status, ObservationEvent, DNASnapshot,
  LifecycleStage, StrategyNode,
} from './types';
import { GPEngine } from './genetic/gp-engine';
import { NMFFactorEngine } from './nmf/factor-engine';
import { AdversarialEngine } from './adversarial/adversarial-engine';
import { PaperTradingEngine } from './paper-trading/paper-engine';
import { StrategyLifecycleManager } from './lifecycle/strategy-lifecycle';

// ===================== DEFAULT CONFIG =====================

const DEFAULT_CONFIG: Phase3Config = {
  gp: {
    populationSize: 120, maxGenerations: 500, tournamentSize: 5,
    elitismCount: 5, crossoverRate: 0.7, mutationRate: 0.2, reproductionRate: 0.1,
    maxTreeDepth: 7, maxTreeNodes: 63, parsimonyPressure: 0.001,
    fitnessThreshold: 0.8, stagnationLimit: 20, diversityThreshold: 0.3,
    islandCount: 3, migrationInterval: 5, migrationRate: 0.05,
  },
  nmf: {
    numFactors: 5, maxIterations: 200, convergenceThreshold: 1e-4,
    regularization: 0.01, initMethod: 'random', temporalDecay: 0.95,
  },
  adversarial: {
    targetBotCount: 5, lookbackPeriods: 200,
    exploitThreshold: 0.3, maxStrategiesPerTarget: 3, sharedWeaknessBonus: 1.5,
  },
  paperTrading: {
    initialCapital: 100000, maxPositionPct: 0.1, maxDailyDrawdown: 0.05,
    slippageModel: { baseSlippageBps: 2, volatilityMultiplier: 1.5, sizeImpactFactor: 0.5, spreadBps: 5 },
    latencyModel: { baseLatencyMs: 50, jitterMs: 20, spikeProb: 0.02, spikeMultiplier: 10 },
    commissionRate: 0.001, marginRequirement: 0.5,
  },
  lifecycle: {
    incubationGenerations: 10, paperTradingMinHours: 4, paperTradingMinTrades: 20,
    validationMinScore: 0.6, maxActiveStrategies: 30, retirementThreshold: 0.2,
    decayHalfLifeHours: 48, healthCheckIntervalMs: 60000,
  },
  arenaApiUrl: 'http://localhost:8101',
  apiPort: 9003,
  synthesisIntervalMs: 15000,
};

// ===================== PHASE 3 ORCHESTRATOR =====================

export class Phase3Orchestrator extends EventEmitter {
  private config: Phase3Config;
  private gp: GPEngine;
  private nmf: NMFFactorEngine;
  private adversarial: AdversarialEngine;
  private paper: PaperTradingEngine;
  private lifecycle: StrategyLifecycleManager;

  private arenaSocket: ClientSocket | null = null;
  private eventBuffer: ObservationEvent[] = [];
  private synthesisTimer: NodeJS.Timeout | null = null;
  private generation = 0;
  private isActive = false;
  private startTime = 0;

  // Stats
  private totalGenerated = 0;
  private totalRetired = 0;

  constructor(config: Partial<Phase3Config> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.gp = new GPEngine(this.config.gp);
    this.nmf = new NMFFactorEngine(this.config.nmf);
    this.adversarial = new AdversarialEngine(this.config.adversarial);
    this.paper = new PaperTradingEngine(this.config.paperTrading);
    this.lifecycle = new StrategyLifecycleManager(this.config.lifecycle);

    this.wireEvents();
  }

  private wireEvents(): void {
    this.gp.on('generation:complete', stats => this.emit('gp:generation', stats));
    this.gp.on('evolution:converged', data => this.emit('gp:converged', data));
    this.gp.on('migration:complete', data => this.emit('gp:migration', data));
    this.nmf.on('nmf:complete', data => this.emit('nmf:complete', data));
    this.nmf.on('synthesis:complete', data => this.emit('nmf:synthesis', data));
    this.adversarial.on('adversarial:generated', data => this.emit('adversarial:generated', data));
    this.paper.on('order:filled', data => this.emit('paper:order', data));
    this.paper.on('position:closed', data => this.emit('paper:close', data));
    this.paper.on('strategy:halted', data => this.emit('paper:halted', data));
    this.lifecycle.on('lifecycle:birth', data => this.emit('lifecycle:birth', data));
    this.lifecycle.on('lifecycle:promoted', data => this.emit('lifecycle:promoted', data));
    this.lifecycle.on('lifecycle:retired', data => { this.totalRetired++; this.emit('lifecycle:retired', data); });
  }

  // ===================== STARTUP =====================

  async start(): Promise<void> {
    console.log('[Phase3] Starting Strategy Synthesis & Paper Trading Engine...');
    this.isActive = true;
    this.startTime = Date.now();

    // Initialize GP population
    this.gp.initializePopulation();
    console.log(`[Phase3] GP initialized: ${this.config.gp.islandCount} islands, ${this.config.gp.populationSize} individuals`);

    // Start lifecycle health checks
    this.lifecycle.startHealthChecks();

    // Connect to Arena WebSocket
    this.connectToArena();

    // Start synthesis loop
    this.synthesisTimer = setInterval(() => {
      this.runSynthesisCycle().catch(err => {
        console.error('[Phase3] Synthesis cycle error:', err.message);
      });
    }, this.config.synthesisIntervalMs);

    // Start API server
    await this.startAPI();

    // Run initial cycle
    await this.runSynthesisCycle();

    console.log('[Phase3] Phase 3 Synthesis Engine ONLINE');
    console.log(`[Phase3] Dashboard: http://localhost:${this.config.apiPort}`);
  }

  async stop(): Promise<void> {
    console.log('[Phase3] Stopping...');
    this.isActive = false;

    if (this.synthesisTimer) { clearInterval(this.synthesisTimer); this.synthesisTimer = null; }
    this.lifecycle.stopHealthChecks();
    if (this.arenaSocket) { this.arenaSocket.disconnect(); this.arenaSocket = null; }

    console.log('[Phase3] Stopped.');
  }

  // ===================== ARENA CONNECTION (Socket.IO) =====================

  private connectToArena(): void {
    try {
      this.arenaSocket = ioClient(this.config.arenaApiUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 5000,
        reconnectionAttempts: Infinity,
      });

      this.arenaSocket.on('connect', () => {
        console.log(`[Phase3] Connected to Arena Socket.IO (id: ${this.arenaSocket?.id})`);
        // Subscribe to the arena room
        this.arenaSocket?.emit('arena:subscribe');
      });

      // Arena trade events — bots executing trades
      this.arenaSocket.on('arena:bot:trade', (data: Record<string, unknown>) => {
        console.log(`[Phase3] Arena trade: ${data.botName} ${data.side} ${data.symbol} @ ${data.price}`);
        const event = this.parseArenaTrade(data);
        if (event) this.bufferEvent(event);
      });

      // Continuous arena trade events
      this.arenaSocket.on('continuous:trade', (data: Record<string, unknown>) => {
        console.log(`[Phase3] Continuous trade received`);
        const event = this.parseArenaTrade(data);
        if (event) this.bufferEvent(event);
      });

      // Leaderboard updates — extract fitness/ranking data for GP training
      this.arenaSocket.on('arena:leaderboard', (data: Record<string, unknown>) => {
        const event = this.parseLeaderboard(data);
        if (event) this.bufferEvent(event);
      });

      // Tournament round events — extract bot performance per round
      this.arenaSocket.on('arena:tournament', (data: Record<string, unknown>) => {
        const event = this.parseTournament(data);
        if (event) this.bufferEvent(event);
      });

      // Evolution events — generation changes, mutations
      this.arenaSocket.on('arena:evolution', (data: Record<string, unknown>) => {
        const event = this.parseEvolution(data);
        if (event) this.bufferEvent(event);
      });

      this.arenaSocket.on('disconnect', (reason: string) => {
        console.log(`[Phase3] Arena Socket.IO disconnected: ${reason}`);
      });

      this.arenaSocket.on('connect_error', (err: Error) => {
        console.log(`[Phase3] Arena Socket.IO connect error: ${err.message}`);
      });
    } catch {
      console.log('[Phase3] Could not connect to Arena, running in offline mode');
    }
  }

  private bufferEvent(event: ObservationEvent): void {
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > 5000) {
      this.eventBuffer = this.eventBuffer.slice(-3000);
    }
    this.paper.processEvent(event);
  }

  private parseArenaTrade(msg: Record<string, unknown>): ObservationEvent | null {
    const now = Date.now();
    const price = (msg.price as number) || 0;
    if (price <= 0) return null;

    return {
      id: `evt_${now}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: (msg.timestamp as number) || now,
      source: 'arena_bot',
      eventType: 'trade',
      payload: {
        botId: (msg.botId as string) || (msg.botName as string) || 'unknown',
        symbol: (msg.symbol as string) || (msg.groupName as string) || 'BTC/USD',
        direction: ((msg.side as string) || 'buy') as 'buy' | 'sell',
        quantity: (msg.quantity as number) || (msg.size as number) || 1,
        price,
        pnl: (msg.pnl as number) || 0,
        timestamp: (msg.timestamp as number) || now,
        regime: ((msg.regime as string) || 'RANGING') as import('./types').MarketRegime,
        preTradeIndicators: (msg.indicators as import('./types').IndicatorSnapshot) || {
          rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
          volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
        },
      },
      enrichmentMetadata: msg.indicators ? {
        processingTime: 0,
        indicators: msg.indicators as import('./types').IndicatorSnapshot,
      } : undefined,
    };
  }

  private parseLeaderboard(msg: Record<string, unknown>): ObservationEvent | null {
    const now = Date.now();
    const entries = (msg.entries || msg.bots) as Array<Record<string, unknown>> | undefined;
    if (!entries || entries.length === 0) return null;

    return {
      id: `evt_${now}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now,
      source: 'arena_bot',
      eventType: 'fitness_change',
      payload: {
        type: 'leaderboard',
        roundNumber: msg.roundNumber,
        tournamentId: msg.tournamentId,
        bots: entries.map((b, i) => ({
          botId: b.botId || b.id || b.name,
          botName: b.botName || b.name,
          fitness: b.fitness || b.score || b.totalPnl || 0,
          totalPnl: b.totalPnl || b.pnl || 0,
          winRate: b.winRate || 0,
          sharpeRatio: b.sharpeRatio || 0,
          rank: b.rank || i + 1,
        })),
      },
    };
  }

  private parseTournament(msg: Record<string, unknown>): ObservationEvent | null {
    const now = Date.now();
    const type = msg.type as string;
    // Only buffer round_end events which contain performance data
    if (type !== 'round_end' && type !== 'complete') return null;

    return {
      id: `evt_${now}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now,
      source: 'arena_bot',
      eventType: 'fitness_change',
      payload: {
        type: 'tournament_round',
        round: msg.round,
        tournamentId: msg.tournamentId,
        ...msg,
      },
    };
  }

  private parseEvolution(msg: Record<string, unknown>): ObservationEvent | null {
    const now = Date.now();
    return {
      id: `evt_${now}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now,
      source: 'arena_bot',
      eventType: 'dna_mutation',
      payload: {
        type: 'evolution',
        generation: msg.generation,
        botId: msg.botId,
        ...msg,
      },
    };
  }

  // ===================== SYNTHESIS CYCLE =====================

  async runSynthesisCycle(): Promise<void> {
    if (!this.isActive) return;
    this.generation++;
    const cycleStart = Date.now();

    // Phase A: GP Evolution
    this.gp.setTrainingData(this.eventBuffer);
    const gpStats = await this.gp.evolveGeneration();
    const gpBest = this.gp.getBest();

    if (gpBest && gpBest.fitness > 0.3) {
      this.registerStrategy(gpBest.id, gpBest.tree, 'gp', gpBest.metrics);
      this.totalGenerated++;
    }

    // Phase B: NMF synthesis (every 10 generations)
    if (this.generation % 10 === 0) {
      await this.runNMFSynthesis();
    }

    // Phase C: Adversarial generation (every 5 generations)
    if (this.generation % 5 === 0) {
      await this.runAdversarialGeneration();
    }

    // Phase D: Update paper trading strategies with latest results
    this.updatePaperStrategies();

    // Phase E: Promote from GP hall of fame every 20 generations
    if (this.generation % 20 === 0) {
      for (const elite of this.gp.getHallOfFame().slice(0, 3)) {
        this.registerStrategy(elite.id + '_hof', elite.tree, 'gp', elite.metrics);
        this.totalGenerated++;
      }
    }

    const cycleDuration = Date.now() - cycleStart;
    this.emit('cycle:complete', {
      generation: this.generation, duration: cycleDuration,
      gpBest: gpBest?.fitness || 0,
      active: this.lifecycle.getActiveStrategies().length,
      paperTrading: this.paper.getActiveStrategies().length,
    });
  }

  private async runNMFSynthesis(): Promise<void> {
    const snapshots = this.extractDNASnapshots();
    if (snapshots.length < 5) return;

    try {
      this.nmf.decompose(snapshots);
      const combos = this.nmf.synthesizeStrategies(snapshots, 5);

      for (const combo of combos) {
        if (combo.expectedFitness > 0.3 && combo.noveltyScore > 0.2) {
          const tree = this.nmf.dnaToExpressionTree(combo.synthesizedDNA);
          this.registerStrategy(combo.id, tree, 'nmf');
          this.gp.injectIndividual(tree, 'nmf_inspired');
          this.totalGenerated++;
        }
      }
    } catch (err) {
      console.error('[Phase3] NMF error:', (err as Error).message);
    }
  }

  private async runAdversarialGeneration(): Promise<void> {
    const topBots = this.identifyTopBots();
    if (topBots.length === 0) return;

    const strategies = this.adversarial.generateCounterStrategies(topBots);
    for (const s of strategies) {
      if (s.confidence > 0.5 && s.simulatedReturn > 0) {
        this.registerStrategy(s.id, s.entryConditions, 'adversarial');
        this.gp.injectIndividual(s.entryConditions, 'adversarial');
        this.totalGenerated++;
      }
    }
  }

  private registerStrategy(id: string, tree: StrategyNode, source: 'gp' | 'nmf' | 'adversarial', metrics?: import('./types').StrategyMetrics): void {
    this.lifecycle.birth(id, tree, source, this.generation);

    if (metrics) {
      this.lifecycle.updateIncubationMetrics(id, metrics, this.generation);
    }

    // If promoted to PAPER, register with paper trading engine
    const lc = this.lifecycle.getStrategy(id);
    if (lc && lc.stage === 'PAPER') {
      this.paper.registerStrategy(id, tree);
    }
  }

  private updatePaperStrategies(): void {
    const paperStrategies = this.lifecycle.getByStage('PAPER');
    for (const lc of paperStrategies) {
      const result = this.paper.getResult(lc.strategyId);
      if (result) {
        this.lifecycle.updatePaperMetrics(lc.strategyId, result);
      }

      // Register in paper engine if not already
      if (!this.paper.getActiveStrategies().includes(lc.strategyId)) {
        this.paper.registerStrategy(lc.strategyId, lc.tree);
      }
    }
  }

  // ===================== DATA EXTRACTION =====================

  private extractDNASnapshots(): DNASnapshot[] {
    const snaps = new Map<string, DNASnapshot>();
    for (const event of this.eventBuffer) {
      if (event.eventType === 'dna_mutation') {
        const p = event.payload as Record<string, unknown>;
        const botId = (p.botId as string) || '';
        if (!botId) continue;
        let s = snaps.get(botId);
        if (!s) {
          s = { botId, genes: new Array(50).fill(0.5), fitness: 0, timestamp: event.timestamp, rank: 0 };
          snaps.set(botId, s);
        }
        const gi = p.geneIndex as number;
        const nv = p.newValue as number;
        if (gi !== undefined && nv !== undefined) { s.genes[gi] = nv; s.timestamp = event.timestamp; }
      }
      if (event.eventType === 'fitness_change') {
        const p = event.payload as Record<string, unknown>;
        const botId = (p.botId as string) || '';
        if (!botId) continue;
        let s = snaps.get(botId);
        if (!s) { s = { botId, genes: new Array(50).fill(0.5), fitness: 0, timestamp: event.timestamp, rank: 0 }; snaps.set(botId, s); }
        s.fitness = (p.newFitness as number) || 0;
      }
    }
    return [...snaps.values()];
  }

  private identifyTopBots(): { botId: string; trades: ObservationEvent[] }[] {
    const botTrades = new Map<string, ObservationEvent[]>();
    for (const e of this.eventBuffer) {
      if (e.eventType !== 'trade') continue;
      const botId = (e.payload as Record<string, unknown>).botId as string;
      if (!botId) continue;
      if (!botTrades.has(botId)) botTrades.set(botId, []);
      botTrades.get(botId)!.push(e);
    }
    const scores: { botId: string; score: number; trades: ObservationEvent[] }[] = [];
    for (const [botId, trades] of botTrades) {
      const total = trades.reduce((s, t) => s + ((t.payload as Record<string, unknown>).pnl as number || 0), 0);
      scores.push({ botId, score: total, trades });
    }
    return scores.sort((a, b) => b.score - a.score)
      .slice(0, this.config.adversarial.targetBotCount)
      .map(b => ({ botId: b.botId, trades: b.trades }));
  }

  // ===================== API SERVER =====================

  private async startAPI(): Promise<void> {
    const app = express();
    app.use(cors());
    app.use(express.json());

    const server = createServer(app);
    const io = new SocketIOServer(server, { cors: { origin: '*' } });

    // REST endpoints
    app.get('/health', (_, res) => res.json({ status: 'ok', uptime: Date.now() - this.startTime }));

    app.get('/api/status', (_, res) => res.json(this.getStatus()));

    app.get('/api/gp/stats', (_, res) => res.json(this.gp.getStats()));

    app.get('/api/gp/hall-of-fame', (_, res) => {
      const hof = this.gp.getHallOfFame().map(ind => ({
        id: ind.id, fitness: ind.fitness, adjustedFitness: ind.adjustedFitness,
        generation: ind.generation, createdBy: ind.createdBy, island: ind.island,
        nodeCount: ind.nodeCount, depth: ind.depth,
        metrics: { totalReturn: ind.metrics.totalReturn, sharpeRatio: ind.metrics.sharpeRatio,
          winRate: ind.metrics.winRate, maxDrawdown: ind.metrics.maxDrawdown },
      }));
      res.json(hof);
    });

    app.get('/api/nmf/factors', (_, res) => res.json(this.nmf.getFactors()));

    app.get('/api/nmf/stats', (_, res) => res.json(this.nmf.getStats()));

    app.get('/api/adversarial/stats', (_, res) => res.json(this.adversarial.getStats()));

    app.get('/api/adversarial/strategies', (_, res) => res.json(this.adversarial.getStrategies()));

    app.get('/api/paper/stats', (_, res) => res.json(this.paper.getStats()));

    app.get('/api/paper/portfolios', (_, res) => {
      const results: Record<string, unknown>[] = [];
      for (const id of this.paper.getActiveStrategies()) {
        const snap = this.paper.getSnapshot(id);
        if (snap) results.push({ strategyId: id, ...snap });
      }
      res.json(results);
    });

    app.get('/api/paper/:strategyId', (req, res) => {
      const result = this.paper.getResult(req.params.strategyId);
      if (!result) return res.status(404).json({ error: 'Not found' });
      res.json(result);
    });

    app.get('/api/lifecycle/stats', (_, res) => res.json(this.lifecycle.getStats()));

    app.get('/api/lifecycle/strategies', (_, res) => {
      const active = this.lifecycle.getActiveStrategies().map(lc => ({
        strategyId: lc.strategyId, stage: lc.stage, source: lc.source,
        healthScore: lc.healthScore, createdAt: lc.createdAt,
        generation: lc.generation, lifetimeReturn: lc.lifetimeReturn,
        validationScore: lc.validationScore,
        promotions: lc.promotionHistory.length,
      }));
      res.json(active);
    });

    app.get('/api/lifecycle/:stage', (req, res) => {
      const stage = req.params.stage.toUpperCase() as LifecycleStage;
      const strategies = this.lifecycle.getByStage(stage);
      res.json(strategies.map(lc => ({
        strategyId: lc.strategyId, stage: lc.stage, healthScore: lc.healthScore,
        source: lc.source, createdAt: lc.createdAt,
      })));
    });

    app.get('/api/events/count', (_, res) => res.json({ count: this.eventBuffer.length }));

    // WebSocket for real-time updates
    io.on('connection', (socket) => {
      console.log(`[Phase3] Dashboard client connected: ${socket.id}`);
      socket.emit('status', this.getStatus());

      socket.on('disconnect', () => {
        console.log(`[Phase3] Dashboard client disconnected: ${socket.id}`);
      });
    });

    // Forward events to dashboard clients
    const forwardEvents = [
      'gp:generation', 'gp:converged', 'gp:migration',
      'nmf:complete', 'nmf:synthesis',
      'adversarial:generated',
      'paper:order', 'paper:close', 'paper:halted',
      'lifecycle:birth', 'lifecycle:promoted', 'lifecycle:retired',
      'cycle:complete',
    ];
    for (const event of forwardEvents) {
      this.on(event, (data) => io.emit(event, data));
    }

    return new Promise((resolve) => {
      server.listen(this.config.apiPort, () => {
        console.log(`[Phase3] API server listening on port ${this.config.apiPort}`);
        resolve();
      });
    });
  }

  // ===================== PUBLIC API =====================

  getStatus(): Phase3Status {
    return {
      active: this.isActive,
      uptime: Date.now() - this.startTime,
      generation: this.generation,
      gpStats: this.gp.getStats(),
      nmfFactors: this.nmf.getFactors().length,
      adversarialStrategies: this.adversarial.getStrategies().length,
      paperTradingActive: this.paper.getActiveStrategies().length,
      lifecycleCounts: this.lifecycle.getCountByStage(),
      totalStrategiesGenerated: this.totalGenerated,
      totalStrategiesRetired: this.totalRetired,
      bestStrategyFitness: this.gp.getBest()?.fitness || 0,
    };
  }

  getGP(): GPEngine { return this.gp; }
  getNMF(): NMFFactorEngine { return this.nmf; }
  getAdversarial(): AdversarialEngine { return this.adversarial; }
  getPaper(): PaperTradingEngine { return this.paper; }
  getLifecycle(): StrategyLifecycleManager { return this.lifecycle; }
}

// ===================== CLI ENTRY POINT =====================

if (require.main === module) {
  const orchestrator = new Phase3Orchestrator();

  process.on('SIGINT', async () => {
    console.log('\n[Phase3] Shutting down...');
    await orchestrator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await orchestrator.stop();
    process.exit(0);
  });

  orchestrator.start().catch((err) => {
    console.error('[Phase3] Fatal error:', err);
    process.exit(1);
  });
}

export default Phase3Orchestrator;
