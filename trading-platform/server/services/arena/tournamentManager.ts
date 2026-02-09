// Tournament Manager - Lifecycle management for bot trading tournaments
// Enhanced with advanced genetics, personality system, and evolution analytics
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type {
  Tournament, TournamentRound, Bot, BotGroupName, LeaderboardEntry,
  LeaderboardSnapshot, EvolutionResult, ArenaTournamentEvent, FitnessScores,
  BOT_GROUPS, BOT_NAMES, StrategyDNA, AdvancedEvolutionConfig,
  BotPersonality, HallOfFameEntry, GenerationAnalytics, PopulationDiversityMetrics,
} from './types';
import { BOT_GROUPS as GROUPS, BOT_NAMES as NAMES } from './types';
import { randomDNA } from './dnaFactory';
import { BotEngine } from './botEngine';
import {
  evolveGroup, calculateFitness, calculateSharpeRatio,
  calculateMaxDrawdown, calculateWinRate, calculateConsistency,
} from './geneticAlgorithm';
import { synthesizeMasterBot, saveMasterBot, synthesizeAdvanced, synthesizeRegimeAware, performanceAttribution } from './masterBotSynthesis';
import type { SynthesisMethod } from './masterBotSynthesis';
import { evolveGroupAdvanced, DEFAULT_ADVANCED_CONFIG } from './advancedGenetics';
import { applyFitnessSharing, speciateBots, calculatePopulationDiversity } from './populationDiversity';
import { buildPersonality, getPersonalityDistribution, getPersonalitySummaries, getPersonalityTitle, breedingCompatibility } from './botPersonality';
import { HallOfFame, buildGenerationAnalytics, saveGenerationAnalytics, getGenerationAnalyticsHistory, getEvolutionSummary } from './evolutionAnalytics';
import { getAllSessionsStatus, getSymbolSession, getGSTTime } from './marketTiming';
import type { MarketDataSimulator } from '../marketDataSimulator';

export class TournamentManager extends EventEmitter {
  private db: Database.Database;
  private botEngine: BotEngine;
  private marketData: MarketDataSimulator;
  private currentTournament: Tournament | null = null;
  private roundTimer: NodeJS.Timeout | null = null;
  private roundStartedAt: number = 0;         // ms timestamp when current round started
  private roundElapsedBeforePause: number = 0; // ms elapsed before pause
  private equitySnapshotTimer: NodeJS.Timeout | null = null;
  private generation = 0;
  private bots: Bot[] = [];
  private hallOfFame: HallOfFame;
  private evolutionConfig: AdvancedEvolutionConfig = { ...DEFAULT_ADVANCED_CONFIG };

  constructor(db: Database.Database, marketData: MarketDataSimulator) {
    super();
    this.db = db;
    this.marketData = marketData;
    this.botEngine = new BotEngine(db, marketData);

    this.hallOfFame = new HallOfFame(db);

    // Forward bot trade events
    this.botEngine.on('trade', (event) => {
      this.emit('bot:trade', event);
    });

    // Load or create bots
    this.initializeBots();
  }

  getBotEngine(): BotEngine {
    return this.botEngine;
  }

  getCurrentTournament(): Tournament | null {
    return this.currentTournament;
  }

  getGeneration(): number {
    return this.generation;
  }

  getBots(): Bot[] {
    return this.bots;
  }

  getBotsByGroup(groupName: BotGroupName): Bot[] {
    return this.bots.filter(b => b.groupName === groupName);
  }

  getBot(botId: string): Bot | undefined {
    return this.bots.find(b => b.id === botId);
  }

  private initializeBots(): void {
    // Check if bots exist in DB
    const existingBots = this.db.prepare('SELECT * FROM bots').all() as Record<string, unknown>[];

    if (existingBots.length > 0) {
      this.bots = existingBots.map(row => ({
        id: row.id as string,
        name: row.name as string,
        groupName: row.group_name as BotGroupName,
        symbol: row.symbol as string,
        dna: JSON.parse(row.dna as string),
        generation: row.generation as number,
        parentIds: JSON.parse(row.parent_ids as string),
        createdAt: row.created_at as string,
      }));
      this.generation = Math.max(...this.bots.map(b => b.generation), 0);
    } else {
      // Create initial bots
      this.createInitialBots();
    }

    this.botEngine.setBots(this.bots);
  }

  private createInitialBots(): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO bots (id, name, group_name, symbol, dna, generation, parent_ids)
      VALUES (?, ?, ?, ?, ?, 0, '[]')
    `);

    for (const [groupName, groupConfig] of Object.entries(GROUPS)) {
      const names = NAMES[groupName as BotGroupName];
      for (let i = 0; i < groupConfig.symbols.length; i++) {
        const bot: Bot = {
          id: uuidv4(),
          name: names[i],
          groupName: groupName as BotGroupName,
          symbol: groupConfig.symbols[i],
          dna: randomDNA(),
          generation: 0,
          parentIds: [],
          createdAt: new Date().toISOString(),
        };

        insertStmt.run(bot.id, bot.name, bot.groupName, bot.symbol, JSON.stringify(bot.dna));

        // Save initial DNA to history
        this.db.prepare('INSERT INTO dna_history (bot_id, generation, dna, fitness) VALUES (?, 0, ?, 0)')
          .run(bot.id, JSON.stringify(bot.dna));

        this.bots.push(bot);
      }
    }

    console.log(`[TournamentManager] Created ${this.bots.length} initial bots`);
  }

  // ===================== TOURNAMENT LIFECYCLE =====================

  createTournament(options: { totalRounds?: number; roundDurationMs?: number } = {}): Tournament {
    const tournament: Tournament = {
      id: uuidv4(),
      name: `Gen ${this.generation} Tournament`,
      generation: this.generation,
      status: 'pending',
      currentRound: 0,
      totalRounds: options.totalRounds || 10,
      roundDurationMs: options.roundDurationMs || 300000, // 5 min default
      createdAt: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO tournaments (id, name, generation, status, current_round, total_rounds, round_duration_ms)
      VALUES (?, ?, ?, 'pending', 0, ?, ?)
    `).run(tournament.id, tournament.name, tournament.generation, tournament.totalRounds, tournament.roundDurationMs);

    this.currentTournament = tournament;
    return tournament;
  }

  async startTournament(): Promise<void> {
    if (!this.currentTournament) {
      this.createTournament();
    }

    const t = this.currentTournament!;
    t.status = 'running';
    t.startedAt = new Date().toISOString();
    t.currentRound = 1;

    this.db.prepare('UPDATE tournaments SET status = ?, started_at = ?, current_round = 1 WHERE id = ?')
      .run('running', t.startedAt, t.id);

    this.emit('tournament', {
      type: 'start',
      tournamentId: t.id,
      totalRounds: t.totalRounds,
    } as ArenaTournamentEvent);

    // Start first round
    await this.startRound(1);
  }

  private async startRound(roundNumber: number): Promise<void> {
    const t = this.currentTournament!;
    const roundId = uuidv4();

    this.db.prepare(`
      INSERT OR REPLACE INTO tournament_rounds (id, tournament_id, round_number, status, started_at)
      VALUES (?, ?, ?, 'running', datetime('now'))
    `).run(roundId, t.id, roundNumber);

    this.emit('tournament', {
      type: 'round_start',
      tournamentId: t.id,
      round: roundNumber,
      totalRounds: t.totalRounds,
    } as ArenaTournamentEvent);

    // Start bot engine (carries over capital from previous round)
    if (roundNumber === 1) {
      this.botEngine.start(t.id);
    } else {
      this.botEngine.resume();
    }

    // Track round timing for accurate pause/resume
    this.roundStartedAt = Date.now();
    this.roundElapsedBeforePause = 0;

    // Set timer for round end
    this.roundTimer = setTimeout(() => {
      this.endRound(roundNumber);
    }, t.roundDurationMs);

    // Start equity curve snapshots (every 30s)
    this.startEquitySnapshots();
  }

  private endRound(roundNumber: number): void {
    const t = this.currentTournament!;

    // Stop bot trading
    this.botEngine.pause();

    // Force close all positions
    this.botEngine.forceCloseAll();

    // Update round status
    this.db.prepare(`
      UPDATE tournament_rounds SET status = 'completed', completed_at = datetime('now')
      WHERE tournament_id = ? AND round_number = ?
    `).run(t.id, roundNumber);

    // Snapshot leaderboard
    const leaderboard = this.calculateLeaderboard();
    const snapshotId = uuidv4();
    this.db.prepare(`
      INSERT INTO leaderboard_snapshots (id, tournament_id, round_number, entries)
      VALUES (?, ?, ?, ?)
    `).run(snapshotId, t.id, roundNumber, JSON.stringify(leaderboard));

    this.emit('leaderboard', {
      tournamentId: t.id,
      roundNumber,
      entries: leaderboard,
    });

    this.emit('tournament', {
      type: 'round_end',
      tournamentId: t.id,
      round: roundNumber,
      totalRounds: t.totalRounds,
    } as ArenaTournamentEvent);

    // Check if tournament is complete
    if (roundNumber >= t.totalRounds) {
      this.completeTournament();
    } else {
      // Start next round (capital carries over)
      t.currentRound = roundNumber + 1;
      this.db.prepare('UPDATE tournaments SET current_round = ? WHERE id = ?')
        .run(t.currentRound, t.id);
      this.startRound(roundNumber + 1);
    }
  }

  private completeTournament(): void {
    const t = this.currentTournament!;
    t.status = 'completed';
    t.completedAt = new Date().toISOString();

    this.botEngine.stop();
    this.stopEquitySnapshots();

    this.db.prepare('UPDATE tournaments SET status = ?, completed_at = ? WHERE id = ?')
      .run('completed', t.completedAt, t.id);

    // Final equity snapshot
    this.takeEquitySnapshot();

    this.emit('tournament', {
      type: 'complete',
      tournamentId: t.id,
    } as ArenaTournamentEvent);
  }

  pauseTournament(): void {
    if (!this.currentTournament || this.currentTournament.status !== 'running') return;

    this.currentTournament.status = 'paused';
    this.db.prepare('UPDATE tournaments SET status = ? WHERE id = ?')
      .run('paused', this.currentTournament.id);

    this.botEngine.pause();
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    // Track how much time elapsed before pause for accurate resume
    this.roundElapsedBeforePause += Date.now() - this.roundStartedAt;

    this.stopEquitySnapshots();

    this.emit('tournament', { type: 'pause', tournamentId: this.currentTournament.id });
  }

  resumeTournament(): void {
    if (!this.currentTournament || this.currentTournament.status !== 'paused') return;

    this.currentTournament.status = 'running';
    this.db.prepare('UPDATE tournaments SET status = ? WHERE id = ?')
      .run('running', this.currentTournament.id);

    this.botEngine.resume();

    // Calculate actual remaining time based on tracked elapsed time
    const remainingMs = Math.max(1000, this.currentTournament.roundDurationMs - this.roundElapsedBeforePause);
    this.roundStartedAt = Date.now();

    this.roundTimer = setTimeout(() => {
      this.endRound(this.currentTournament!.currentRound);
    }, remainingMs);

    this.startEquitySnapshots();

    this.emit('tournament', { type: 'resume', tournamentId: this.currentTournament.id });
  }

  stopTournament(): void {
    if (!this.currentTournament) return;

    this.botEngine.stop();
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    this.stopEquitySnapshots();

    this.currentTournament.status = 'completed';
    this.currentTournament.completedAt = new Date().toISOString();
    this.db.prepare('UPDATE tournaments SET status = ?, completed_at = ? WHERE id = ?')
      .run('completed', this.currentTournament.completedAt, this.currentTournament.id);

    this.emit('tournament', { type: 'complete', tournamentId: this.currentTournament.id });
  }

  // ===================== LEADERBOARD =====================

  calculateLeaderboard(): LeaderboardEntry[] {
    if (!this.currentTournament) return [];

    const entries: LeaderboardEntry[] = [];
    const te = this.botEngine.getTradingEngine();

    for (const bot of this.bots) {
      const portfolio = te.getPortfolio(bot.id, this.currentTournament.id);
      const trades = te.getTrades(bot.id, this.currentTournament.id, 1000);

      const tradePnLs = trades.filter(t => t.side === 'sell').map(t => t.pnl);
      const totalPnL = portfolio?.totalPnL || 0;
      const totalPnLPercent = portfolio?.totalPnLPercent || 0;

      const sharpeRatio = calculateSharpeRatio(tradePnLs);
      const winRate = calculateWinRate(tradePnLs);
      const maxDrawdown = calculateMaxDrawdown(
        tradePnLs.reduce<number[]>((curve, pnl, i) => {
          curve.push((curve[i - 1] || 5000) + pnl);
          return curve;
        }, [])
      );
      const consistency = calculateConsistency(tradePnLs);

      const fitness = calculateFitness({
        totalPnLPercent,
        sharpeRatio,
        winRate,
        maxDrawdown,
        totalTrades: trades.length,
        consistency,
      });

      entries.push({
        rank: 0,
        botId: bot.id,
        botName: bot.name,
        groupName: bot.groupName,
        symbol: bot.symbol,
        totalPnL,
        totalPnLPercent,
        sharpeRatio,
        winRate,
        maxDrawdown,
        totalTrades: trades.length,
        fitness: fitness.composite,
      });
    }

    // Sort by fitness and assign ranks
    entries.sort((a, b) => b.fitness - a.fitness);
    entries.forEach((e, i) => { e.rank = i + 1; });

    return entries;
  }

  getLeaderboardHistory(tournamentId: string): LeaderboardSnapshot[] {
    const rows = this.db.prepare(
      'SELECT * FROM leaderboard_snapshots WHERE tournament_id = ? ORDER BY round_number'
    ).all(tournamentId) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as string,
      tournamentId: row.tournament_id as string,
      roundNumber: row.round_number as number,
      entries: JSON.parse(row.entries as string),
      timestamp: row.timestamp as string,
    }));
  }

  // ===================== EVOLUTION =====================

  triggerEvolution(): EvolutionResult[] {
    const leaderboard = this.calculateLeaderboard();
    const fitnessMap = new Map<string, number>();
    for (const entry of leaderboard) {
      fitnessMap.set(entry.botId, entry.fitness);
    }

    const results: EvolutionResult[] = [];

    for (const groupName of ['Alpha', 'Beta', 'Gamma'] as BotGroupName[]) {
      const groupBots = this.bots.filter(b => b.groupName === groupName);
      const avgFitnessBefore = groupBots.reduce((sum, b) => sum + (fitnessMap.get(b.id) || 0), 0) / groupBots.length;

      const { survivors, offspring, replacedIds } = evolveGroup(groupBots, fitnessMap);

      // Update replaced bots with new DNA
      const newGeneration = this.generation + 1;
      const offspringIds: string[] = [];

      for (let i = 0; i < replacedIds.length; i++) {
        const botIdx = this.bots.findIndex(b => b.id === replacedIds[i]);
        if (botIdx === -1) continue;

        const bot = this.bots[botIdx];
        const newDNA = offspring[i];

        // Update bot
        bot.dna = newDNA;
        bot.generation = newGeneration;
        bot.parentIds = survivors.map(s => s.id);

        // Update in DB
        this.db.prepare('UPDATE bots SET dna = ?, generation = ?, parent_ids = ? WHERE id = ?')
          .run(JSON.stringify(newDNA), newGeneration, JSON.stringify(bot.parentIds), bot.id);

        // Save DNA history
        this.db.prepare('INSERT INTO dna_history (bot_id, generation, dna, fitness) VALUES (?, ?, ?, ?)')
          .run(bot.id, newGeneration, JSON.stringify(newDNA), 0);

        offspringIds.push(bot.id);
      }

      // Update elite bots generation
      for (const elite of survivors) {
        elite.generation = newGeneration;
        this.db.prepare('UPDATE bots SET generation = ? WHERE id = ?')
          .run(newGeneration, elite.id);

        // Save DNA history for elites too
        this.db.prepare('INSERT INTO dna_history (bot_id, generation, dna, fitness) VALUES (?, ?, ?, ?)')
          .run(elite.id, newGeneration, JSON.stringify(elite.dna), fitnessMap.get(elite.id) || 0);
      }

      const avgFitnessAfter = groupBots.reduce((sum, b) => sum + (fitnessMap.get(b.id) || 0), 0) / groupBots.length;

      results.push({
        generation: newGeneration,
        groupName,
        elites: survivors.map(s => s.id),
        offspring: offspringIds,
        replaced: replacedIds,
        avgFitnessBefore,
        avgFitnessAfter,
        timestamp: new Date().toISOString(),
      });
    }

    this.generation++;
    this.botEngine.setBots(this.bots);
    this.currentTournament = null; // Reset for new tournament

    this.emit('evolution', { type: 'complete', generation: this.generation, results });

    return results;
  }

  // ===================== MASTER BOT =====================

  synthesizeMasterBot(): { masterBot: any; sourceBots: string[] } {
    const leaderboard = this.calculateLeaderboard();

    // Take top 3 bots across all groups
    const top3 = leaderboard.slice(0, 3);
    const topBots = top3.map(entry => {
      const bot = this.bots.find(b => b.id === entry.botId)!;
      return { dna: bot.dna, fitness: entry.fitness };
    });

    const masterBot = synthesizeMasterBot(topBots, this.generation);
    masterBot.sourceBotIds = top3.map(e => e.botId);
    saveMasterBot(this.db, masterBot, masterBot.sourceBotIds);

    return {
      masterBot,
      sourceBots: top3.map(e => e.botName),
    };
  }

  // ===================== STATUS =====================

  getStatus(): {
    isRunning: boolean;
    generation: number;
    tournament: Tournament | null;
    totalBots: number;
    totalTrades: number;
    topBot: LeaderboardEntry | null;
    groups: { name: BotGroupName; assetClass: string; botCount: number; avgPnL: number }[];
    marketSessions: Record<string, unknown>;
    localTime: string;
    dataFeed: { botId: string; botName: string; symbol: string; group: BotGroupName; isLive: boolean; canTrade: boolean; sessionName: string; price: number }[];
  } {
    const leaderboard = this.currentTournament ? this.calculateLeaderboard() : [];
    const te = this.botEngine.getTradingEngine();

    let totalTrades = 0;
    if (this.currentTournament) {
      const tradeCount = this.db.prepare(
        'SELECT COUNT(*) as count FROM bot_trades WHERE tournament_id = ?'
      ).get(this.currentTournament.id) as { count: number } | undefined;
      totalTrades = tradeCount?.count || 0;
    }

    const groups = (['Alpha', 'Beta', 'Gamma'] as BotGroupName[]).map(name => {
      const groupBots = this.bots.filter(b => b.groupName === name);
      const groupEntries = leaderboard.filter(e => e.groupName === name);
      const avgPnL = groupEntries.length > 0
        ? groupEntries.reduce((sum, e) => sum + e.totalPnLPercent, 0) / groupEntries.length
        : 0;
      return {
        name,
        assetClass: GROUPS[name].assetClass,
        botCount: groupBots.length,
        avgPnL,
      };
    });

    // Market session and data feed status
    const sessions = getAllSessionsStatus();
    const dataFeed = this.bots.map(b => {
      const session = getSymbolSession(b.symbol, b.groupName);
      return {
        botId: b.id,
        botName: b.name,
        symbol: b.symbol,
        group: b.groupName,
        isLive: this.marketData.isLive(b.symbol),
        canTrade: session.canTrade,
        sessionName: session.sessionName,
        price: this.marketData.getArenaPrice(b.symbol),
      };
    });

    return {
      isRunning: this.currentTournament?.status === 'running',
      generation: this.generation,
      tournament: this.currentTournament,
      totalBots: this.bots.length,
      totalTrades,
      topBot: leaderboard[0] || null,
      groups,
      marketSessions: sessions,
      localTime: getGSTTime().formatted,
      dataFeed,
    };
  }

  // Get DNA history for a bot
  getDNAHistory(botId: string): { generation: number; dna: StrategyDNA; fitness: number; timestamp: string }[] {
    const rows = this.db.prepare(
      'SELECT * FROM dna_history WHERE bot_id = ? ORDER BY generation'
    ).all(botId) as Record<string, unknown>[];

    return rows.map(row => ({
      generation: row.generation as number,
      dna: JSON.parse(row.dna as string),
      fitness: row.fitness as number,
      timestamp: row.timestamp as string,
    }));
  }

  // Get tournament history
  getTournamentHistory(limit: number = 10): Tournament[] {
    const rows = this.db.prepare(
      'SELECT * FROM tournaments ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      generation: row.generation as number,
      status: row.status as Tournament['status'],
      currentRound: row.current_round as number,
      totalRounds: row.total_rounds as number,
      roundDurationMs: row.round_duration_ms as number,
      startedAt: row.started_at as string | undefined,
      completedAt: row.completed_at as string | undefined,
      createdAt: row.created_at as string,
    }));
  }

  // ===================== EQUITY CURVE SNAPSHOTS =====================

  private startEquitySnapshots(): void {
    this.stopEquitySnapshots();
    this.equitySnapshotTimer = setInterval(() => {
      this.takeEquitySnapshot();
    }, 30000); // Every 30 seconds
  }

  private stopEquitySnapshots(): void {
    if (this.equitySnapshotTimer) {
      clearInterval(this.equitySnapshotTimer);
      this.equitySnapshotTimer = null;
    }
  }

  private takeEquitySnapshot(): void {
    if (!this.currentTournament) return;
    const te = this.botEngine.getTradingEngine();
    const t = this.currentTournament;
    const timestamp = new Date().toISOString();

    const insertStmt = this.db.prepare(`
      INSERT INTO bot_equity_snapshots (bot_id, tournament_id, round_number, total_value, cash, position_value, pnl_percent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAll = this.db.transaction(() => {
      for (const bot of this.bots) {
        const portfolio = te.getPortfolio(bot.id, t.id);
        if (!portfolio) continue;
        const positionValue = portfolio.totalValue - portfolio.cash;
        insertStmt.run(
          bot.id, t.id, t.currentRound,
          portfolio.totalValue, portfolio.cash, positionValue,
          portfolio.totalPnLPercent, timestamp
        );
      }
    });

    try {
      insertAll();
    } catch (error) {
      console.error('[TournamentManager] Equity snapshot error:', (error as Error).message);
    }
  }

  getEquityCurve(botId: string, tournamentId?: string): { timestamp: string; totalValue: number; cash: number; positionValue: number; pnlPercent: number; round: number }[] {
    const tid = tournamentId || this.currentTournament?.id;
    if (!tid) return [];

    const rows = this.db.prepare(
      'SELECT * FROM bot_equity_snapshots WHERE bot_id = ? AND tournament_id = ? ORDER BY timestamp'
    ).all(botId, tid) as Record<string, unknown>[];

    return rows.map(row => ({
      timestamp: row.timestamp as string,
      totalValue: row.total_value as number,
      cash: row.cash as number,
      positionValue: row.position_value as number,
      pnlPercent: row.pnl_percent as number,
      round: row.round_number as number,
    }));
  }

  getAllEquityCurves(tournamentId?: string): { botId: string; botName: string; groupName: string; snapshots: { timestamp: string; totalValue: number; pnlPercent: number }[] }[] {
    const tid = tournamentId || this.currentTournament?.id;
    if (!tid) return [];

    const rows = this.db.prepare(
      'SELECT bot_id, total_value, pnl_percent, timestamp FROM bot_equity_snapshots WHERE tournament_id = ? ORDER BY timestamp'
    ).all(tid) as Record<string, unknown>[];

    const byBot = new Map<string, { timestamp: string; totalValue: number; pnlPercent: number }[]>();
    for (const row of rows) {
      const botId = row.bot_id as string;
      if (!byBot.has(botId)) byBot.set(botId, []);
      byBot.get(botId)!.push({
        timestamp: row.timestamp as string,
        totalValue: row.total_value as number,
        pnlPercent: row.pnl_percent as number,
      });
    }

    return this.bots.map(bot => ({
      botId: bot.id,
      botName: bot.name,
      groupName: bot.groupName,
      snapshots: byBot.get(bot.id) || [],
    }));
  }

  // ===================== BOT COMPARISON =====================

  compareBots(botIds: string[]): { bots: { id: string; name: string; groupName: string; symbol: string; generation: number; dna: StrategyDNA; fitness: number }[] } {
    const leaderboard = this.currentTournament ? this.calculateLeaderboard() : [];
    const fitnessMap = new Map(leaderboard.map(e => [e.botId, e.fitness]));

    const bots = botIds
      .map(id => this.bots.find(b => b.id === id))
      .filter((b): b is Bot => !!b)
      .map(bot => ({
        id: bot.id,
        name: bot.name,
        groupName: bot.groupName,
        symbol: bot.symbol,
        generation: bot.generation,
        dna: bot.dna,
        fitness: fitnessMap.get(bot.id) || 0,
      }));

    return { bots };
  }

  // ===================== GENERATION STATS =====================

  getGenerationStats(): { generation: number; avgFitness: number; topFitness: number; botCount: number; timestamp: string }[] {
    const rows = this.db.prepare(`
      SELECT generation, AVG(fitness) as avg_fitness, MAX(fitness) as top_fitness, COUNT(*) as bot_count, MIN(timestamp) as timestamp
      FROM dna_history
      GROUP BY generation
      ORDER BY generation
    `).all() as Record<string, unknown>[];

    return rows.map(row => ({
      generation: row.generation as number,
      avgFitness: Number((row.avg_fitness as number).toFixed(4)),
      topFitness: Number((row.top_fitness as number).toFixed(4)),
      botCount: row.bot_count as number,
      timestamp: row.timestamp as string,
    }));
  }

  getBotPerformanceHistory(botId: string): { generation: number; fitness: number; dna: StrategyDNA; timestamp: string }[] {
    return this.getDNAHistory(botId);
  }

  // ===================== TOURNAMENT RECOVERY =====================

  recoverTournament(): boolean {
    const runningTournament = this.db.prepare(
      "SELECT * FROM tournaments WHERE status IN ('running', 'paused') ORDER BY created_at DESC LIMIT 1"
    ).get() as Record<string, unknown> | undefined;

    if (!runningTournament) return false;

    this.currentTournament = {
      id: runningTournament.id as string,
      name: runningTournament.name as string,
      generation: runningTournament.generation as number,
      status: 'paused', // Always recover as paused so user can resume manually
      currentRound: runningTournament.current_round as number,
      totalRounds: runningTournament.total_rounds as number,
      roundDurationMs: runningTournament.round_duration_ms as number,
      startedAt: runningTournament.started_at as string | undefined,
      completedAt: undefined,
      createdAt: runningTournament.created_at as string,
    };

    // Mark as paused in DB if it was running
    if (runningTournament.status === 'running') {
      this.db.prepare('UPDATE tournaments SET status = ? WHERE id = ?')
        .run('paused', this.currentTournament.id);
    }

    console.log(`[TournamentManager] Recovered tournament ${this.currentTournament.name} (round ${this.currentTournament.currentRound}/${this.currentTournament.totalRounds})`);
    return true;
  }

  // ===================== ADVANCED EVOLUTION =====================

  // Get/set evolution configuration
  getEvolutionConfig(): AdvancedEvolutionConfig {
    return { ...this.evolutionConfig };
  }

  setEvolutionConfig(config: Partial<AdvancedEvolutionConfig>): AdvancedEvolutionConfig {
    this.evolutionConfig = { ...this.evolutionConfig, ...config };
    return this.evolutionConfig;
  }

  // Advanced evolution with configurable operators and analytics
  triggerAdvancedEvolution(): {
    results: EvolutionResult[];
    analytics: GenerationAnalytics[];
    hallOfFameInductions: HallOfFameEntry[];
  } {
    const leaderboard = this.calculateLeaderboard();
    const fitnessMap = new Map<string, number>();
    const fitnessScoresMap = new Map<string, FitnessScores>();

    for (const entry of leaderboard) {
      fitnessMap.set(entry.botId, entry.fitness);
      fitnessScoresMap.set(entry.botId, {
        totalPnLPercent: entry.totalPnLPercent,
        sharpeRatio: entry.sharpeRatio,
        winRate: entry.winRate,
        maxDrawdownPenalty: 1 - entry.maxDrawdown,
        tradeFrequency: Math.min(1, entry.totalTrades / 20),
        consistency: 0.5, // estimated
        composite: entry.fitness,
      });
    }

    const results: EvolutionResult[] = [];
    const analytics: GenerationAnalytics[] = [];
    const hallOfFameInductions: HallOfFameEntry[] = [];
    const config = this.evolutionConfig;

    // Apply fitness sharing if diversity weight > 0
    let effectiveFitnessMap = fitnessMap;
    if (config.diversityWeight > 0) {
      const sharedFitness = applyFitnessSharing(this.bots, fitnessMap, config.nicheRadius);
      effectiveFitnessMap = new Map<string, number>();
      for (const bot of this.bots) {
        const raw = fitnessMap.get(bot.id) || 0;
        const shared = sharedFitness.get(bot.id) || 0;
        // Blend raw and shared fitness
        effectiveFitnessMap.set(bot.id, raw * (1 - config.diversityWeight) + shared * config.diversityWeight);
      }
    }

    for (const groupName of ['Alpha', 'Beta', 'Gamma'] as BotGroupName[]) {
      const groupBots = this.bots.filter(b => b.groupName === groupName);
      const avgFitnessBefore = groupBots.reduce((sum, b) => sum + (fitnessMap.get(b.id) || 0), 0) / groupBots.length;

      // Use advanced evolution
      const { survivors, offspring, replacedIds, effectiveMutationRate } =
        evolveGroupAdvanced(groupBots, effectiveFitnessMap, this.generation, config);

      // Update replaced bots with new DNA
      const newGeneration = this.generation + 1;
      const offspringIds: string[] = [];

      for (let i = 0; i < replacedIds.length; i++) {
        const botIdx = this.bots.findIndex(b => b.id === replacedIds[i]);
        if (botIdx === -1) continue;

        const bot = this.bots[botIdx];
        const newDNA = offspring[i];

        bot.dna = newDNA;
        bot.generation = newGeneration;
        bot.parentIds = survivors.map(s => s.id);

        this.db.prepare('UPDATE bots SET dna = ?, generation = ?, parent_ids = ? WHERE id = ?')
          .run(JSON.stringify(newDNA), newGeneration, JSON.stringify(bot.parentIds), bot.id);

        this.db.prepare('INSERT INTO dna_history (bot_id, generation, dna, fitness) VALUES (?, ?, ?, ?)')
          .run(bot.id, newGeneration, JSON.stringify(newDNA), 0);

        offspringIds.push(bot.id);
      }

      // Update elite bots
      for (const elite of survivors) {
        elite.generation = newGeneration;
        this.db.prepare('UPDATE bots SET generation = ? WHERE id = ?')
          .run(newGeneration, elite.id);
        this.db.prepare('INSERT INTO dna_history (bot_id, generation, dna, fitness) VALUES (?, ?, ?, ?)')
          .run(elite.id, newGeneration, JSON.stringify(elite.dna), fitnessMap.get(elite.id) || 0);
      }

      const avgFitnessAfter = groupBots.reduce((sum, b) => sum + (fitnessMap.get(b.id) || 0), 0) / groupBots.length;

      results.push({
        generation: newGeneration,
        groupName,
        elites: survivors.map(s => s.id),
        offspring: offspringIds,
        replaced: replacedIds,
        avgFitnessBefore,
        avgFitnessAfter,
        timestamp: new Date().toISOString(),
      });

      // Build and save analytics for this group
      const genAnalytics = buildGenerationAnalytics(
        groupBots, groupName, fitnessMap, fitnessScoresMap,
        newGeneration, { ...config, mutationRate: effectiveMutationRate },
      );
      saveGenerationAnalytics(this.db, genAnalytics);
      analytics.push(genAnalytics);
    }

    // Hall of Fame: check if any current bots qualify
    for (const entry of leaderboard) {
      if (this.hallOfFame.shouldInduct(entry.fitness)) {
        const bot = this.bots.find(b => b.id === entry.botId);
        if (!bot || !this.currentTournament) continue;

        const inducted = this.hallOfFame.induct(bot, entry.fitness, this.currentTournament.id, {
          totalPnLPercent: entry.totalPnLPercent,
          sharpeRatio: entry.sharpeRatio,
          winRate: entry.winRate,
          maxDrawdown: entry.maxDrawdown,
          totalTrades: entry.totalTrades,
        });
        hallOfFameInductions.push(inducted);
      }
    }

    // Save personality history for all bots
    this.savePersonalityHistory(this.generation + 1);

    // Save evolution config history
    this.saveEvolutionConfigHistory(this.generation + 1, results);

    this.generation++;
    this.botEngine.setBots(this.bots);
    this.currentTournament = null;

    this.emit('evolution', {
      type: 'complete',
      generation: this.generation,
      results,
      analytics,
      hallOfFameInductions,
    });

    return { results, analytics, hallOfFameInductions };
  }

  // ===================== PERSONALITY SYSTEM =====================

  // Get personality for a single bot
  getBotPersonality(botId: string): BotPersonality | null {
    const bot = this.bots.find(b => b.id === botId);
    if (!bot) return null;
    return buildPersonality(bot.dna);
  }

  // Get personalities for all bots
  getAllPersonalities(): { botId: string; botName: string; groupName: BotGroupName; personality: BotPersonality }[] {
    return this.bots.map(bot => ({
      botId: bot.id,
      botName: bot.name,
      groupName: bot.groupName,
      personality: buildPersonality(bot.dna),
    }));
  }

  // Get personality distribution across all bots
  getPersonalityDistribution(): Record<string, number> {
    return getPersonalityDistribution(this.bots);
  }

  // Get breeding compatibility between two bots
  getBreedingCompatibility(botId1: string, botId2: string): number {
    const bot1 = this.bots.find(b => b.id === botId1);
    const bot2 = this.bots.find(b => b.id === botId2);
    if (!bot1 || !bot2) return 0;
    return breedingCompatibility(bot1, bot2);
  }

  // Save personality snapshot for current generation
  private savePersonalityHistory(generation: number): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO personality_history (bot_id, generation, archetype, traits, dominant_signals)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const bot of this.bots) {
      const personality = buildPersonality(bot.dna);
      insertStmt.run(
        bot.id,
        generation,
        personality.archetype,
        JSON.stringify(personality.traits),
        JSON.stringify(personality.dominantSignals),
      );
    }
  }

  // Get personality evolution history for a bot
  getPersonalityHistory(botId: string): { generation: number; archetype: string; traits: any; timestamp: string }[] {
    const rows = this.db.prepare(
      'SELECT * FROM personality_history WHERE bot_id = ? ORDER BY generation'
    ).all(botId) as Record<string, unknown>[];

    return rows.map(row => ({
      generation: row.generation as number,
      archetype: row.archetype as string,
      traits: JSON.parse(row.traits as string),
      timestamp: row.timestamp as string,
    }));
  }

  // ===================== HALL OF FAME =====================

  getHallOfFame(limit: number = 50): HallOfFameEntry[] {
    return this.hallOfFame.getAll(limit);
  }

  getHallOfFameByGroup(groupName: BotGroupName): HallOfFameEntry[] {
    return this.hallOfFame.getByGroup(groupName);
  }

  getBestEverBot(): HallOfFameEntry | null {
    return this.hallOfFame.getBest();
  }

  // ===================== ANALYTICS =====================

  getGenerationAnalytics(groupName?: BotGroupName, limit?: number): GenerationAnalytics[] {
    return getGenerationAnalyticsHistory(this.db, groupName, limit);
  }

  getEvolutionSummary(): ReturnType<typeof getEvolutionSummary> {
    return getEvolutionSummary(this.db);
  }

  // ===================== ADVANCED MASTER BOT =====================

  synthesizeAdvancedMasterBot(method: SynthesisMethod = 'weighted_average'): {
    masterBot: any;
    sourceBots: string[];
    method: SynthesisMethod;
    attribution?: ReturnType<typeof performanceAttribution>;
    regimeProfiles?: any;
  } {
    const leaderboard = this.calculateLeaderboard();
    const fitnessScoresMap = new Map<string, FitnessScores>();

    for (const entry of leaderboard) {
      fitnessScoresMap.set(entry.botId, {
        totalPnLPercent: entry.totalPnLPercent,
        sharpeRatio: entry.sharpeRatio,
        winRate: entry.winRate,
        maxDrawdownPenalty: 1 - entry.maxDrawdown,
        tradeFrequency: Math.min(1, entry.totalTrades / 20),
        consistency: 0.5,
        composite: entry.fitness,
      });
    }

    // Take top 5 bots (increased from 3 for better synthesis)
    const topN = leaderboard.slice(0, 5);
    const topBots = topN.map(entry => {
      const bot = this.bots.find(b => b.id === entry.botId)!;
      return {
        dna: bot.dna,
        fitness: entry.fitness,
        fitnessScores: fitnessScoresMap.get(bot.id),
        personality: buildPersonality(bot.dna),
      };
    });

    let masterBot: any;
    let regimeProfiles: any = undefined;

    if (method === 'regime_aware') {
      const result = synthesizeRegimeAware(topBots, this.generation);
      masterBot = result.masterBot;
      regimeProfiles = result.regimeProfiles;
    } else {
      masterBot = synthesizeAdvanced(topBots, this.generation, method);
    }

    masterBot.sourceBotIds = topN.map(e => e.botId);
    saveMasterBot(this.db, masterBot, masterBot.sourceBotIds);

    // Performance attribution
    const attribution = performanceAttribution(masterBot.dna, topBots);

    return {
      masterBot,
      sourceBots: topN.map(e => e.botName),
      method,
      attribution,
      regimeProfiles,
    };
  }

  // ===================== EVOLUTION CONFIG PERSISTENCE =====================

  private saveEvolutionConfigHistory(generation: number, results: EvolutionResult[]): void {
    const avgImprovement = results.reduce((sum, r) => sum + (r.avgFitnessAfter - r.avgFitnessBefore), 0) / results.length;

    this.db.prepare(`
      INSERT INTO evolution_config_history (id, generation, config, avg_fitness_improvement, diversity_change)
      VALUES (?, ?, ?, ?, 0)
    `).run(uuidv4(), generation, JSON.stringify(this.evolutionConfig), avgImprovement);
  }
}
