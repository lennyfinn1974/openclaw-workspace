// Continuous Arena - Auto-runs tournaments during market hours with profit-driven evolution
// Monitors market sessions, auto-starts tournaments, evolves strategies based on performance
import { EventEmitter } from 'events';
import { TournamentManager } from './tournamentManager';
import { getAllSessionsStatus, getSymbolSession } from './marketTiming';
import type { BotGroupName, Tournament, LeaderboardEntry } from './types';

interface ContinuousConfig {
  minRoundDurationMs: number;      // 5 minutes default
  maxRoundDurationMs: number;      // 30 minutes max
  evolutionTriggerThreshold: number; // Evolve when best bot performance plateaus
  evolutionCooldownMs: number;     // Wait between evolutions
  profitThresholdPercent: number;  // Min profit % to consider "successful"
  maxDrawdownThreshold: number;    // Max drawdown before forced evolution
}

interface GroupSession {
  groupName: BotGroupName;
  isActive: boolean;
  canTrade: boolean;
  sessionName: string;
  volatilityMultiplier: number;
  nextEvolutionCheck: number;
  lastEvolution: number;
  currentTournament?: Tournament;
  performanceHistory: PerformanceSnapshot[];
}

interface PerformanceSnapshot {
  timestamp: number;
  bestProfit: number;
  avgProfit: number;
  totalTrades: number;
  sharpeRatio: number;
  generation: number;
}

export class ContinuousArena extends EventEmitter {
  private tournamentManager: TournamentManager;
  private isRunning = false;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private config: ContinuousConfig;
  private groupSessions = new Map<BotGroupName, GroupSession>();
  private performanceCheckInterval = 60000; // Check every minute
  private lastSessionUpdate = 0;

  constructor(tournamentManager: TournamentManager, config?: Partial<ContinuousConfig>) {
    super();
    this.tournamentManager = tournamentManager;
    this.config = {
      minRoundDurationMs: 5 * 60 * 1000,        // 5 minutes
      maxRoundDurationMs: 30 * 60 * 1000,       // 30 minutes
      evolutionTriggerThreshold: 0.5,           // 0.5% profit improvement needed
      evolutionCooldownMs: 2 * 60 * 60 * 1000,  // 2 hours between evolutions
      profitThresholdPercent: 1.0,              // 1% profit = success
      maxDrawdownThreshold: -5.0,               // -5% max drawdown
      ...config,
    };

    this.initializeGroupSessions();

    // Forward tournament events
    this.tournamentManager.on('tournament', (event) => {
      this.emit('continuous:tournament', event);
    });

    this.tournamentManager.on('bot:trade', (event) => {
      this.emit('continuous:trade', event);
      this.checkGroupPerformance(event.groupName);
    });

    this.tournamentManager.on('evolution', (event) => {
      this.emit('continuous:evolution', event);
      this.updateEvolutionHistory(event.generation);
    });
  }

  private initializeGroupSessions(): void {
    const groups: BotGroupName[] = ['Alpha', 'Beta', 'Gamma'];
    
    for (const groupName of groups) {
      this.groupSessions.set(groupName, {
        groupName,
        isActive: false,
        canTrade: false,
        sessionName: 'Unknown',
        volatilityMultiplier: 1.0,
        nextEvolutionCheck: Date.now() + this.config.evolutionCooldownMs,
        lastEvolution: 0,
        performanceHistory: [],
      });
    }
  }

  // ===================== CONTINUOUS CONTROL =====================

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startMonitoring();
    this.emit('continuous:started');
    
    console.log(`[ContinuousArena] Started - monitoring market sessions and auto-evolution`);
    console.log(`[ContinuousArena] Config:`, {
      minRoundDuration: `${this.config.minRoundDurationMs/1000/60}min`,
      evolutionThreshold: `${this.config.evolutionTriggerThreshold}%`,
      profitThreshold: `${this.config.profitThresholdPercent}%`,
      maxDrawdown: `${this.config.maxDrawdownThreshold}%`,
    });
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stopMonitoring();

    // Pause any active tournaments
    for (const session of this.groupSessions.values()) {
      if (session.currentTournament?.status === 'running') {
        this.tournamentManager.pauseTournament();
      }
    }

    this.emit('continuous:stopped');
    console.log(`[ContinuousArena] Stopped`);
  }

  private startMonitoring(): void {
    if (this.monitoringTimer) return;

    this.monitoringTimer = setInterval(() => {
      this.updateSessionStatus();
      this.checkEvolutionTriggers();
      this.manageTournaments();
    }, this.performanceCheckInterval);

    // Immediate update
    this.updateSessionStatus();
  }

  private stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  // ===================== MARKET SESSION MONITORING =====================

  private updateSessionStatus(): void {
    const now = Date.now();
    const sessions = getAllSessionsStatus();
    
    for (const [groupName, sessionInfo] of Object.entries(sessions)) {
      const group = groupName as BotGroupName;
      const groupSession = this.groupSessions.get(group)!;
      
      const wasActive = groupSession.isActive;
      groupSession.isActive = sessionInfo.canTrade;
      groupSession.canTrade = sessionInfo.canTrade;
      groupSession.sessionName = sessionInfo.sessionName;
      groupSession.volatilityMultiplier = sessionInfo.volatilityMultiplier;

      // Market transition events
      if (!wasActive && sessionInfo.canTrade) {
        this.emit('continuous:market_open', { 
          groupName: group, 
          sessionName: sessionInfo.sessionName,
          volatilityMultiplier: sessionInfo.volatilityMultiplier 
        });
        console.log(`[ContinuousArena] ${group} markets opened - ${sessionInfo.sessionName}`);
      } else if (wasActive && !sessionInfo.canTrade) {
        this.emit('continuous:market_close', { 
          groupName: group, 
          sessionName: sessionInfo.sessionName 
        });
        console.log(`[ContinuousArena] ${group} markets closed`);
      }
    }

    this.lastSessionUpdate = now;
  }

  // ===================== TOURNAMENT MANAGEMENT =====================

  private manageTournaments(): void {
    const currentTournament = this.tournamentManager.getCurrentTournament();
    
    for (const groupSession of this.groupSessions.values()) {
      if (groupSession.canTrade && !currentTournament) {
        // Start new tournament when markets are open
        this.startGroupTournament(groupSession);
      } else if (!groupSession.canTrade && currentTournament?.status === 'running') {
        // Pause tournament when markets close
        this.pauseGroupTournament(groupSession);
      }
    }
  }

  private startGroupTournament(groupSession: GroupSession): void {
    // Calculate dynamic round duration based on volatility
    const baseDuration = this.config.minRoundDurationMs;
    const volatilityAdjustment = groupSession.volatilityMultiplier;
    const roundDuration = Math.min(
      baseDuration * volatilityAdjustment,
      this.config.maxRoundDurationMs
    );

    const tournament = this.tournamentManager.createTournament({
      totalRounds: 999, // Continuous until market closes
      roundDurationMs: Math.floor(roundDuration),
    });

    groupSession.currentTournament = tournament;

    // Start the tournament
    this.tournamentManager.startTournament().catch((error) => {
      console.error(`[ContinuousArena] Failed to start tournament:`, error);
    });

    this.emit('continuous:tournament_started', {
      groupName: groupSession.groupName,
      tournamentId: tournament.id,
      roundDuration: Math.floor(roundDuration / 1000 / 60), // minutes
      sessionName: groupSession.sessionName,
    });

    console.log(`[ContinuousArena] Started ${groupSession.groupName} tournament - ${Math.floor(roundDuration/60/1000)}min rounds`);
  }

  private pauseGroupTournament(groupSession: GroupSession): void {
    if (groupSession.currentTournament) {
      this.tournamentManager.pauseTournament();
      
      this.emit('continuous:tournament_paused', {
        groupName: groupSession.groupName,
        tournamentId: groupSession.currentTournament.id,
      });

      console.log(`[ContinuousArena] Paused ${groupSession.groupName} tournament - markets closed`);
      groupSession.currentTournament = undefined;
    }
  }

  // ===================== PERFORMANCE ANALYSIS =====================

  private checkGroupPerformance(groupName: BotGroupName): void {
    const groupSession = this.groupSessions.get(groupName);
    if (!groupSession) return;

    // Take performance snapshot
    const leaderboard = this.tournamentManager.calculateLeaderboard();
    const groupEntries = leaderboard.filter(e => e.groupName === groupName);
    
    if (groupEntries.length === 0) return;

    const bestProfit = Math.max(...groupEntries.map(e => e.totalPnLPercent));
    const avgProfit = groupEntries.reduce((sum, e) => sum + e.totalPnLPercent, 0) / groupEntries.length;
    const totalTrades = groupEntries.reduce((sum, e) => sum + e.totalTrades, 0);
    const avgSharpe = groupEntries.reduce((sum, e) => sum + e.sharpeRatio, 0) / groupEntries.length;

    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      bestProfit,
      avgProfit,
      totalTrades,
      sharpeRatio: avgSharpe,
      generation: this.tournamentManager.getGeneration(),
    };

    groupSession.performanceHistory.push(snapshot);

    // Keep only last 100 snapshots
    if (groupSession.performanceHistory.length > 100) {
      groupSession.performanceHistory = groupSession.performanceHistory.slice(-100);
    }
  }

  // ===================== AUTO-EVOLUTION =====================

  private checkEvolutionTriggers(): void {
    const now = Date.now();

    for (const groupSession of this.groupSessions.values()) {
      if (now < groupSession.nextEvolutionCheck) continue;
      if (!groupSession.canTrade) continue; // Only evolve during trading hours

      const shouldEvolve = this.shouldTriggerEvolution(groupSession);
      
      if (shouldEvolve) {
        this.triggerGroupEvolution(groupSession);
      } else {
        // Check again in 10 minutes
        groupSession.nextEvolutionCheck = now + (10 * 60 * 1000);
      }
    }
  }

  private shouldTriggerEvolution(groupSession: GroupSession): boolean {
    const history = groupSession.performanceHistory;
    if (history.length < 10) return false; // Need sufficient data

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);

    if (older.length === 0) return false;

    // Performance stagnation check
    const recentAvgProfit = recent.reduce((sum, s) => sum + s.bestProfit, 0) / recent.length;
    const olderAvgProfit = older.reduce((sum, s) => sum + s.bestProfit, 0) / older.length;
    const improvementRate = recentAvgProfit - olderAvgProfit;

    // Maximum drawdown check
    const maxDrawdown = Math.min(...recent.map(s => s.avgProfit));

    // Evolution triggers:
    // 1. Performance plateau (improvement < threshold)
    // 2. Excessive drawdown
    // 3. No profitable strategies
    const evolutionReasons = [];

    if (improvementRate < this.config.evolutionTriggerThreshold) {
      evolutionReasons.push('performance_plateau');
    }

    if (maxDrawdown < this.config.maxDrawdownThreshold) {
      evolutionReasons.push('excessive_drawdown');
    }

    if (recentAvgProfit < this.config.profitThresholdPercent) {
      evolutionReasons.push('insufficient_profit');
    }

    const shouldEvolve = evolutionReasons.length > 0;

    if (shouldEvolve) {
      console.log(`[ContinuousArena] Evolution triggered for ${groupSession.groupName}:`, evolutionReasons);
      console.log(`[ContinuousArena] Recent profit: ${recentAvgProfit.toFixed(2)}%, Max drawdown: ${maxDrawdown.toFixed(2)}%`);
    }

    return shouldEvolve;
  }

  private triggerGroupEvolution(groupSession: GroupSession): void {
    const now = Date.now();
    
    try {
      // Trigger evolution
      const results = this.tournamentManager.triggerEvolution();
      const groupResult = results.find(r => r.groupName === groupSession.groupName);

      groupSession.lastEvolution = now;
      groupSession.nextEvolutionCheck = now + this.config.evolutionCooldownMs;

      // Clear performance history to start fresh measurement
      groupSession.performanceHistory = [];

      this.emit('continuous:evolution_triggered', {
        groupName: groupSession.groupName,
        generation: groupResult?.generation || 0,
        reason: 'auto_trigger',
        avgFitnessBefore: groupResult?.avgFitnessBefore || 0,
        avgFitnessAfter: groupResult?.avgFitnessAfter || 0,
        eliteCount: groupResult?.elites.length || 0,
        offspringCount: groupResult?.offspring.length || 0,
      });

      console.log(`[ContinuousArena] Evolution completed for ${groupSession.groupName} - Gen ${groupResult?.generation}`);

    } catch (error) {
      console.error(`[ContinuousArena] Evolution failed for ${groupSession.groupName}:`, error);
      
      // Retry in 30 minutes
      groupSession.nextEvolutionCheck = now + (30 * 60 * 1000);
    }
  }

  private updateEvolutionHistory(generation: number): void {
    // Update all group sessions
    for (const groupSession of this.groupSessions.values()) {
      if (groupSession.performanceHistory.length > 0) {
        groupSession.performanceHistory[groupSession.performanceHistory.length - 1].generation = generation;
      }
    }
  }

  // ===================== STATUS & METRICS =====================

  getStatus(): {
    isRunning: boolean;
    config: ContinuousConfig;
    groups: {
      name: BotGroupName;
      isActive: boolean;
      canTrade: boolean;
      sessionName: string;
      volatilityMultiplier: number;
      currentTournament?: string;
      nextEvolution: number; // minutes
      performanceSnapshots: number;
      lastBestProfit: number;
      lastAvgProfit: number;
    }[];
    nextUpdateIn: number; // seconds
  } {
    const now = Date.now();
    
    return {
      isRunning: this.isRunning,
      config: this.config,
      groups: Array.from(this.groupSessions.values()).map(session => ({
        name: session.groupName,
        isActive: session.isActive,
        canTrade: session.canTrade,
        sessionName: session.sessionName,
        volatilityMultiplier: session.volatilityMultiplier,
        currentTournament: session.currentTournament?.id,
        nextEvolution: Math.max(0, Math.floor((session.nextEvolutionCheck - now) / 60000)),
        performanceSnapshots: session.performanceHistory.length,
        lastBestProfit: session.performanceHistory.length > 0 
          ? session.performanceHistory[session.performanceHistory.length - 1].bestProfit
          : 0,
        lastAvgProfit: session.performanceHistory.length > 0 
          ? session.performanceHistory[session.performanceHistory.length - 1].avgProfit
          : 0,
      })),
      nextUpdateIn: Math.floor((this.performanceCheckInterval - (now - this.lastSessionUpdate)) / 1000),
    };
  }

  // ===================== CONFIGURATION =====================

  updateConfig(newConfig: Partial<ContinuousConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    this.emit('continuous:config_updated', this.config);
    console.log(`[ContinuousArena] Configuration updated:`, newConfig);
  }

  getConfig(): ContinuousConfig {
    return { ...this.config };
  }

  // Manual evolution trigger
  manualEvolution(groupName?: BotGroupName): void {
    if (groupName) {
      const groupSession = this.groupSessions.get(groupName);
      if (groupSession) {
        this.triggerGroupEvolution(groupSession);
      }
    } else {
      // Trigger evolution for all trading groups
      for (const groupSession of this.groupSessions.values()) {
        if (groupSession.canTrade) {
          this.triggerGroupEvolution(groupSession);
        }
      }
    }
  }

  // Performance history for analysis
  getGroupPerformanceHistory(groupName: BotGroupName, limit = 50): PerformanceSnapshot[] {
    const groupSession = this.groupSessions.get(groupName);
    if (!groupSession) return [];

    return groupSession.performanceHistory.slice(-limit);
  }
}