/**
 * Performance Monitor
 *
 * Real-time equity curve (sampled every 10s)
 * Trade-by-trade P&L log
 * Rolling metrics: win rate, Sharpe ratio, max drawdown
 * Leaderboard comparison: merges our stats into 21-bot leaderboard → 22-entry ranking
 * Emits PerformanceSnapshot events
 */

import { EventEmitter } from 'events';
import {
  PerformanceSnapshot, LeaderboardComparison, FillReport,
  TradingMode, BotSummary
} from './types';
import { ExecutionEngine } from './execution-engine';
import { RiskGovernor } from './risk-governor';
import { ArenaConnector, LeaderboardEntry } from './arena-connector';

// ===================== PERFORMANCE MONITOR =====================

export class PerformanceMonitor extends EventEmitter {
  private engine: ExecutionEngine;
  private riskGovernor: RiskGovernor;
  private arena: ArenaConnector;

  private equityCurve: { timestamp: number; equity: number }[] = [];
  private tradePnLLog: { timestamp: number; pnl: number; symbol: string; strategyId: string }[] = [];
  private sampleIntervalMs: number;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;

  // Rolling metrics
  private wins = 0;
  private losses = 0;
  private returns: number[] = [];
  private peakEquity: number;
  private maxDrawdown = 0;
  private initialCapital: number;

  // Our bot identity for leaderboard
  private ourBotId = 'phase4-live-trader';
  private ourBotName = 'Phase4 Live Trader';

  constructor(config: {
    engine: ExecutionEngine;
    riskGovernor: RiskGovernor;
    arena: ArenaConnector;
    initialCapital?: number;
    sampleIntervalMs?: number;
  }) {
    super();
    this.engine = config.engine;
    this.riskGovernor = config.riskGovernor;
    this.arena = config.arena;
    this.initialCapital = config.initialCapital || 5000;
    this.peakEquity = this.initialCapital;
    this.sampleIntervalMs = config.sampleIntervalMs || 10000;
  }

  // ===================== LIFECYCLE =====================

  start(): void {
    // Listen for trade fills
    this.engine.on('trade:executed', (fill: FillReport) => {
      this.recordTrade(fill);
    });

    // Sample equity periodically
    this.sampleTimer = setInterval(() => {
      this.sampleEquity();
    }, this.sampleIntervalMs);

    // Initial sample
    this.sampleEquity();
    console.log(`[PERF] Monitor started (sample every ${this.sampleIntervalMs / 1000}s)`);
    this.emit('started');
  }

  stop(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    this.emit('stopped');
  }

  // ===================== RECORDING =====================

  private recordTrade(fill: FillReport): void {
    if (fill.pnl !== undefined) {
      this.tradePnLLog.push({
        timestamp: fill.timestamp,
        pnl: fill.pnl,
        symbol: fill.symbol,
        strategyId: fill.strategyId,
      });
      if (this.tradePnLLog.length > 5000) this.tradePnLLog.shift();

      if (fill.pnl > 0) this.wins++;
      else this.losses++;

      // Record return for Sharpe
      const tradeReturn = fill.value > 0 ? fill.pnl / fill.value : 0;
      this.returns.push(tradeReturn);
      if (this.returns.length > 1000) this.returns.shift();
    }
  }

  private sampleEquity(): void {
    const equity = this.engine.getEquity();
    this.equityCurve.push({ timestamp: Date.now(), equity });
    if (this.equityCurve.length > 50000) this.equityCurve.shift();

    // Update peak and max drawdown
    this.peakEquity = Math.max(this.peakEquity, equity);
    if (this.peakEquity > 0) {
      const dd = (this.peakEquity - equity) / this.peakEquity;
      this.maxDrawdown = Math.max(this.maxDrawdown, dd);
    }

    // Emit snapshot
    const snapshot = this.getSnapshot();
    this.emit('snapshot', snapshot);
  }

  // ===================== METRICS =====================

  getSnapshot(): PerformanceSnapshot {
    const equity = this.engine.getEquity();
    const totalPnL = this.engine.getTotalPnL() + this.engine.getUnrealizedPnL();
    const riskState = this.riskGovernor.getRiskState();
    const totalTrades = this.wins + this.losses;

    return {
      timestamp: Date.now(),
      equity,
      totalPnL,
      totalPnLPercent: this.initialCapital > 0 ? totalPnL / this.initialCapital : 0,
      dailyPnL: riskState.dailyPnL,
      dailyPnLPercent: riskState.dailyPnLPercent,
      totalTrades,
      winRate: totalTrades > 0 ? this.wins / totalTrades : 0,
      sharpeRatio: this.calculateSharpe(),
      maxDrawdown: this.maxDrawdown,
      drawdownFromPeak: riskState.drawdownFromPeak,
      openPositions: this.engine.getOpenPositionCount(),
      mode: this.engine.getMode(),
      killSwitchActive: this.engine.getKillSwitchState().active,
    };
  }

  private calculateSharpe(): number {
    if (this.returns.length < 10) return 0;
    const mean = this.returns.reduce((a, b) => a + b, 0) / this.returns.length;
    const variance = this.returns.reduce((a, b) => a + (b - mean) ** 2, 0) / this.returns.length;
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return (mean / std) * Math.sqrt(252); // Annualized
  }

  // ===================== LEADERBOARD =====================

  getLeaderboard(): LeaderboardComparison[] {
    const arenaLeaderboard = this.arena.getLeaderboard();

    // Build 22-entry comparison
    const entries: LeaderboardComparison[] = arenaLeaderboard.map(entry => ({
      rank: entry.rank,
      totalEntries: arenaLeaderboard.length + 1,
      botId: entry.botId,
      botName: entry.botName,
      totalPnL: entry.totalPnL,
      totalPnLPercent: entry.totalPnLPercent,
      sharpeRatio: entry.sharpeRatio,
      winRate: entry.winRate / 100,
      maxDrawdown: entry.maxDrawdown,
      totalTrades: entry.totalTrades,
      fitness: entry.fitness,
      isOurBot: false,
    }));

    // Add our bot
    const snapshot = this.getSnapshot();
    const totalTrades = this.wins + this.losses;
    entries.push({
      rank: 0, // will be recomputed
      totalEntries: entries.length + 1,
      botId: this.ourBotId,
      botName: this.ourBotName,
      totalPnL: snapshot.totalPnL,
      totalPnLPercent: snapshot.totalPnLPercent * 100,
      sharpeRatio: snapshot.sharpeRatio,
      winRate: snapshot.winRate,
      maxDrawdown: snapshot.maxDrawdown,
      totalTrades,
      fitness: this.calculateFitness(snapshot),
      isOurBot: true,
    });

    // Re-rank by fitness
    entries.sort((a, b) => b.fitness - a.fitness);
    entries.forEach((e, i) => {
      e.rank = i + 1;
      e.totalEntries = entries.length;
    });

    return entries;
  }

  private calculateFitness(snapshot: PerformanceSnapshot): number {
    // Fitness = weighted combination of metrics (matching arena formula)
    const pnlScore = Math.tanh(snapshot.totalPnLPercent * 10); // -1 to 1
    const sharpeScore = Math.tanh(snapshot.sharpeRatio / 2);
    const winRateScore = snapshot.winRate * 2 - 1;
    const drawdownPenalty = snapshot.maxDrawdown * 2;

    return (pnlScore * 0.3 + sharpeScore * 0.3 + winRateScore * 0.2 - drawdownPenalty * 0.2 + 1) / 2;
  }

  // ===================== GETTERS =====================

  getEquityCurve(): { timestamp: number; equity: number }[] {
    return this.equityCurve;
  }

  getTradePnLLog(): { timestamp: number; pnl: number; symbol: string; strategyId: string }[] {
    return this.tradePnLLog;
  }

  getWinRate(): number {
    const total = this.wins + this.losses;
    return total > 0 ? this.wins / total : 0;
  }

  getMaxDrawdown(): number {
    return this.maxDrawdown;
  }
}
