import { EventEmitter } from 'events';
import express, { Request, Response } from 'express';
import http from 'http';
import {
  ArenaSnapshot,
  ArenaBotTradeEvent,
  ArenaLeaderboardEvent,
  ArenaEvolutionEvent,
  ArenaTournamentEvent,
  ManagedStrategy,
  CompetitiveStatus,
  LeaderboardEntry,
} from '../types';
import { ArenaClient } from '../utils/ArenaClient';
import { StateStore } from '../utils/StateStore';
import { StrategyLifecycle } from '../lifecycle/StrategyLifecycle';
import { NoveltySearch } from '../novelty/NoveltySearch';
import { RedQueenEngine } from '../red-queen/RedQueenEngine';
import { AntifragilityLayer } from '../antifragility/AntifragilityLayer';
import { MetaLearner } from '../metalearning/MetaLearner';

const DASHBOARD_PORT = 8085;
const STRATEGY_ASSIGNMENT_INTERVAL = 30000; // 30s
const SEED_STRATEGY_COUNT = 10;

export class CompetitiveMode extends EventEmitter {
  private arenaClient: ArenaClient;
  private store: StateStore;
  private lifecycle: StrategyLifecycle;
  private novelty: NoveltySearch;
  private redQueen: RedQueenEngine;
  private antifragility: AntifragilityLayer;
  private metaLearner: MetaLearner;

  private app: express.Application;
  private server: http.Server | null = null;
  private assignmentTimer: ReturnType<typeof setInterval> | null = null;

  private startTime = 0;
  private tradeCount = 0;
  private strategyBotMap: Map<string, string> = new Map(); // strategyId → botId being tracked

  constructor(
    arenaClient: ArenaClient,
    store: StateStore,
    lifecycle: StrategyLifecycle,
    novelty: NoveltySearch,
    redQueen: RedQueenEngine,
    antifragility: AntifragilityLayer,
    metaLearner: MetaLearner,
  ) {
    super();
    this.arenaClient = arenaClient;
    this.store = store;
    this.lifecycle = lifecycle;
    this.novelty = novelty;
    this.redQueen = redQueen;
    this.antifragility = antifragility;
    this.metaLearner = metaLearner;

    this.app = express();
    this.setupRoutes();
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    console.log('[CompetitiveMode] Starting...');

    // Seed initial strategies if none exist
    if (this.lifecycle.getPopulationSize() === 0) {
      this.seedInitialStrategies();
    }

    // Wire arena events
    this.arenaClient.on('trade', (event: ArenaBotTradeEvent) => this.onTrade(event));
    this.arenaClient.on('leaderboard', (event: ArenaLeaderboardEvent) => this.onLeaderboard(event));
    this.arenaClient.on('evolution', (event: ArenaEvolutionEvent) => this.onEvolution(event));
    this.arenaClient.on('tournament', (event: ArenaTournamentEvent) => this.onTournament(event));

    // Start subsystem loops
    const getSnapshot = () => this.arenaClient.getSnapshot();
    this.redQueen.startAssessmentLoop(getSnapshot);
    this.antifragility.startRebalanceLoop(getSnapshot);
    this.metaLearner.startTuningLoop(
      () => this.lifecycle.getActiveStrategies(),
      () => this.redQueen.getThreats(),
      () => {
        const report = this.novelty.getDiversityReport();
        return report.spread.length > 0
          ? report.spread.reduce((s, v) => s + v, 0) / report.spread.length
          : 0;
      },
    );

    // Strategy assignment loop — maps our strategies to arena bots for tracking
    this.assignmentTimer = setInterval(() => {
      this.assignStrategiesToBots();
    }, STRATEGY_ASSIGNMENT_INTERVAL);

    // Start dashboard
    await this.startDashboard();

    console.log('[CompetitiveMode] All systems online');
    this.emit('started');
  }

  async stop(): Promise<void> {
    console.log('[CompetitiveMode] Shutting down...');

    this.redQueen.stopAssessmentLoop();
    this.antifragility.stopRebalanceLoop();
    this.metaLearner.stopTuningLoop();

    if (this.assignmentTimer) {
      clearInterval(this.assignmentTimer);
      this.assignmentTimer = null;
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    this.arenaClient.disconnect();
    this.store.shutdown();

    console.log('[CompetitiveMode] Shutdown complete');
    this.emit('stopped');
  }

  private seedInitialStrategies(): void {
    console.log(`[CompetitiveMode] Seeding ${SEED_STRATEGY_COUNT} initial strategies...`);
    for (let i = 0; i < SEED_STRATEGY_COUNT; i++) {
      const dna = this.redQueen.generateRandomDNA();
      this.lifecycle.addStrategy(dna, 'random');
    }
  }

  private onTrade(event: ArenaBotTradeEvent): void {
    this.tradeCount++;

    // Find strategies mapped to this bot and record the trade
    for (const [strategyId, botId] of this.strategyBotMap) {
      if (botId === event.botId) {
        this.lifecycle.recordTrade(strategyId, event);

        // Update behavioral fingerprint
        const strategy = this.lifecycle.getStrategy(strategyId);
        if (strategy) {
          const trades = this.arenaClient.getBotTrades(botId);
          const behavior = this.novelty.extractBehavior(strategy, trades);
          this.lifecycle.updateBehavior(strategyId, behavior);

          // Update novelty score periodically (every 10 trades)
          if (strategy.tradeCount % 10 === 0) {
            const allBehaviors = this.lifecycle.getActiveStrategies().map(s => s.behavioralFingerprint);
            const noveltyScore = this.novelty.calculateNovelty(behavior, allBehaviors);
            this.lifecycle.updateNoveltyScore(strategyId, noveltyScore);
            this.novelty.updateArchive(behavior);
          }
        }
      }
    }

    this.emit('trade', event);
  }

  private onLeaderboard(event: ArenaLeaderboardEvent): void {
    // Update novelty fitness adjustments
    const strategies = this.lifecycle.getActiveStrategies();
    this.novelty.adjustFitness(strategies);
    this.emit('leaderboard', event);
  }

  private onEvolution(event: ArenaEvolutionEvent): void {
    if (event.type === 'complete') {
      this.lifecycle.setGeneration(event.generation);
      console.log(`[CompetitiveMode] Arena generation ${event.generation} complete`);

      // Trigger lifecycle transitions
      const transitions = this.lifecycle.evaluateTransitions();
      if (transitions.length > 0) {
        console.log(`[CompetitiveMode] ${transitions.length} strategy transitions this generation`);
      }

      // Re-assign strategies to bots after evolution
      this.assignStrategiesToBots();
    }
    this.emit('evolution', event);
  }

  private onTournament(event: ArenaTournamentEvent): void {
    this.emit('tournament', event);
  }

  private assignStrategiesToBots(): void {
    const strategies = this.lifecycle.getActiveStrategies();
    const leaderboard = this.arenaClient.getLeaderboard();

    if (strategies.length === 0 || leaderboard.length === 0) return;

    // Simple assignment: map each strategy to the arena bot with the most similar DNA
    // For now, round-robin assign strategies to top arena bots
    this.strategyBotMap.clear();

    for (let i = 0; i < strategies.length; i++) {
      const bot = leaderboard[i % leaderboard.length];
      this.strategyBotMap.set(strategies[i].id, bot.botId);
    }
  }

  selectStrategy(regime: string, snapshot: ArenaSnapshot): ManagedStrategy | null {
    const active = this.lifecycle.getActiveStrategies()
      .filter(s => s.stage === 'MATURITY' || s.stage === 'GROWTH');

    if (active.length === 0) return null;

    const metaParams = this.metaLearner.getCurrentParams();

    // Epsilon-greedy selection
    if (Math.random() < metaParams.explorationRate) {
      // Explore: pick random active strategy
      return active[Math.floor(Math.random() * active.length)];
    }

    // Exploit: pick best by adjusted fitness
    let bestStrategy = active[0];
    let bestFitness = -Infinity;
    for (const strategy of active) {
      const fitness = this.novelty.getAdjustedFitness(strategy);
      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  getCompetitiveStatus(): CompetitiveStatus {
    const strategies = this.lifecycle.getActiveStrategies();
    const allStrategies = this.lifecycle.getAllStrategies();
    const retired = allStrategies.filter(s => s.stage === 'RETIRED');

    // Estimate rank vs arena
    const leaderboard = this.arenaClient.getLeaderboard();
    const ourAvgPnl = strategies.length > 0
      ? strategies.reduce((s, st) => s + st.metrics.totalReturn, 0) / strategies.length
      : 0;

    let rank = 1;
    for (const entry of leaderboard) {
      if (entry.totalPnL > ourAvgPnl) rank++;
    }

    return {
      rank,
      pnl: ourAvgPnl,
      activeStrategies: strategies.length,
      retiredStrategies: retired.length,
      generation: this.lifecycle.getGeneration(),
      chaosIndex: this.antifragility.getChaosIndex(),
      topThreat: this.redQueen.getThreats()[0]?.botName || null,
      metaLearningInsights: this.metaLearner.getInsights(),
      uptime: Date.now() - this.startTime,
    };
  }

  // ===================== DASHBOARD HTTP API =====================

  private setupRoutes(): void {
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    this.app.get('/api/status', (_req: Request, res: Response) => {
      res.json(this.getCompetitiveStatus());
    });

    this.app.get('/api/strategies', (_req: Request, res: Response) => {
      const strategies = this.lifecycle.getAllStrategies().map(s => ({
        id: s.id,
        stage: s.stage,
        createdBy: s.createdBy,
        tradeCount: s.tradeCount,
        capitalAllocation: s.capitalAllocation,
        noveltyScore: s.noveltyScore,
        sharpeRatio: s.metrics.sharpeRatio,
        totalReturn: s.metrics.totalReturn,
        winRate: s.metrics.winRate,
        maxDrawdown: s.metrics.maxDrawdown,
        profitFactor: s.metrics.profitFactor,
        createdAt: s.createdAt,
        retiredReason: s.retiredReason,
      }));
      res.json({ count: strategies.length, strategies });
    });

    this.app.get('/api/threats', (_req: Request, res: Response) => {
      res.json({
        threats: this.redQueen.getThreats(),
        armRaceProgress: this.redQueen.getArmRaceProgress(),
      });
    });

    this.app.get('/api/hedges', (_req: Request, res: Response) => {
      res.json({
        chaosIndex: this.antifragility.getChaosIndex(),
        hedges: this.antifragility.getHedgePerformance(),
        totalAllocation: this.antifragility.getTotalAllocation(),
      });
    });

    this.app.get('/api/novelty', (_req: Request, res: Response) => {
      res.json({
        diversityReport: this.novelty.getDiversityReport(),
        archiveSize: this.novelty.getArchiveSize(),
      });
    });

    this.app.get('/api/meta', (_req: Request, res: Response) => {
      res.json({
        currentParams: this.metaLearner.getCurrentParams(),
        insights: this.metaLearner.getInsights(),
        tuningHistory: this.metaLearner.getTuningHistory().slice(-20),
      });
    });

    this.app.get('/api/lifecycle', (_req: Request, res: Response) => {
      const strategies = this.lifecycle.getAllStrategies();
      const stageCounts: Record<string, number> = {};
      for (const s of strategies) {
        stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
      }
      res.json({
        stageCounts,
        totalActive: this.lifecycle.getPopulationSize(),
        totalRetired: this.lifecycle.getRetiredArchive().length,
        allocationMap: Object.fromEntries(this.lifecycle.getAllocationMap()),
        recentTransitions: this.lifecycle.getTransitionLog().slice(-20),
      });
    });

    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        arenaConnected: this.arenaClient.isConnected(),
        uptime: Date.now() - this.startTime,
        tradeCount: this.tradeCount,
        activeStrategies: this.lifecycle.getPopulationSize(),
      });
    });
  }

  private startDashboard(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(DASHBOARD_PORT, () => {
        console.log(`[CompetitiveMode] Dashboard API running on http://localhost:${DASHBOARD_PORT}`);
        resolve();
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[CompetitiveMode] Port ${DASHBOARD_PORT} in use, dashboard disabled`);
          resolve();
        } else {
          console.error('[CompetitiveMode] Dashboard error:', err.message);
          resolve();
        }
      });
    });
  }
}
