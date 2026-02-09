import { EventEmitter } from 'events';
import {
  ArenaSnapshot,
  CompetitorThreat,
  StrategyDNA,
  ManagedStrategy,
  LeaderboardEntry,
  ArenaBotTradeEvent,
  EntrySignalWeights,
  RegimeFilterParams,
} from '../types';
import { StrategyLifecycle } from '../lifecycle/StrategyLifecycle';
import { StateStore } from '../utils/StateStore';

const THREAT_ASSESSMENT_INTERVAL = 60000; // 60 seconds
const TOP_THREATS_COUNT = 3;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class RedQueenEngine extends EventEmitter {
  private lifecycle: StrategyLifecycle;
  private store: StateStore;
  private threats: CompetitorThreat[] = [];
  private assessmentTimer: ReturnType<typeof setInterval> | null = null;
  private generationProgress: { generation: number; avgFitness: number }[] = [];

  constructor(lifecycle: StrategyLifecycle, store: StateStore) {
    super();
    this.lifecycle = lifecycle;
    this.store = store;
  }

  initialize(): void {
    this.threats = this.store.getThreats();
    console.log(`[RedQueen] Initialized with ${this.threats.length} tracked threats`);
  }

  startAssessmentLoop(getSnapshot: () => ArenaSnapshot): void {
    this.assessmentTimer = setInterval(() => {
      const snapshot = getSnapshot();
      if (snapshot.leaderboard.length > 0) {
        this.runAssessment(snapshot);
      }
    }, THREAT_ASSESSMENT_INTERVAL);
    console.log('[RedQueen] Assessment loop started (60s interval)');
  }

  stopAssessmentLoop(): void {
    if (this.assessmentTimer) {
      clearInterval(this.assessmentTimer);
      this.assessmentTimer = null;
    }
  }

  private runAssessment(snapshot: ArenaSnapshot): void {
    const threats = this.assessThreats(snapshot);
    this.threats = threats;
    this.store.setThreats(threats);

    // Generate counter-strategies for top threats
    const topThreats = threats.slice(0, TOP_THREATS_COUNT);
    for (const threat of topThreats) {
      if (threat.dominanceScore > 0.6) {
        const counterDNA = this.generateCounterDNA(threat);
        this.lifecycle.addStrategy(counterDNA, 'adversarial', []);
        console.log(`[RedQueen] Generated counter-strategy for ${threat.botName} (dominance=${threat.dominanceScore.toFixed(2)})`);
      }
    }

    this.trackArmRaceProgress(snapshot);
    this.emit('assessment:complete', { threats: threats.length, countersGenerated: topThreats.filter(t => t.dominanceScore > 0.6).length });
  }

  assessThreats(snapshot: ArenaSnapshot): CompetitorThreat[] {
    const ourStrategies = this.lifecycle.getActiveStrategies();
    if (ourStrategies.length === 0 || snapshot.leaderboard.length === 0) return [];

    // Our average performance
    const ourAvgSharpe = ourStrategies.reduce((s, st) => s + st.metrics.sharpeRatio, 0) / ourStrategies.length;
    const ourAvgReturn = ourStrategies.reduce((s, st) => s + st.metrics.totalReturn, 0) / ourStrategies.length;

    const threats: CompetitorThreat[] = snapshot.leaderboard.map(entry => {
      // Compare each arena bot against our portfolio
      const trades = snapshot.botTrades.get(entry.botId) || [];
      const winsAgainstUs = this.countWinsAgainstUs(entry, ourStrategies);
      const totalMatchups = ourStrategies.length;
      const dominanceScore = totalMatchups > 0 ? winsAgainstUs / totalMatchups : 0;

      // Extract DNA fingerprint from their trading patterns
      const dnaFingerprint = this.extractFingerprint(trades);

      // Identify weaknesses
      const weaknesses = this.identifyWeaknesses(entry, trades);

      return {
        botId: entry.botId,
        botName: entry.botName,
        winsAgainstUs,
        totalMatchups,
        dominanceScore,
        dnaFingerprint,
        weaknesses,
      };
    });

    // Sort by dominance
    threats.sort((a, b) => b.dominanceScore - a.dominanceScore);
    return threats;
  }

  private countWinsAgainstUs(entry: LeaderboardEntry, ourStrategies: ManagedStrategy[]): number {
    let wins = 0;
    for (const strategy of ourStrategies) {
      // A bot "wins" against our strategy if it has better Sharpe AND better return
      if (entry.sharpeRatio > strategy.metrics.sharpeRatio &&
          entry.totalPnLPercent > strategy.metrics.totalReturn) {
        wins++;
      }
    }
    return wins;
  }

  private extractFingerprint(trades: ArenaBotTradeEvent[]): number[] {
    if (trades.length === 0) return [0, 0, 0, 0, 0];

    // Simple behavioral fingerprint from trades
    const buys = trades.filter(t => t.side === 'buy').length;
    const buyRatio = buys / trades.length;
    const avgPnl = trades.reduce((s, t) => s + t.pnl, 0) / trades.length;
    const winRate = trades.filter(t => t.pnl > 0).length / trades.length;

    // Trade frequency
    const timestamps = trades.map(t => new Date(t.timestamp).getTime());
    const span = timestamps.length > 1
      ? timestamps[timestamps.length - 1] - timestamps[0]
      : 60000;
    const frequency = span > 0 ? trades.length / (span / 60000) : 0;

    // Volatility of P&L
    const pnlMean = avgPnl;
    const pnlVar = trades.reduce((s, t) => s + (t.pnl - pnlMean) ** 2, 0) / trades.length;

    return [buyRatio, avgPnl, winRate, Math.min(1, frequency / 5), Math.sqrt(pnlVar)];
  }

  private identifyWeaknesses(entry: LeaderboardEntry, trades: ArenaBotTradeEvent[]): string[] {
    const weaknesses: string[] = [];

    if (entry.maxDrawdown > 0.15) weaknesses.push('high_drawdown');
    if (entry.winRate < 0.45) weaknesses.push('low_win_rate');
    if (entry.sharpeRatio < 0.5) weaknesses.push('low_sharpe');

    // Check for regime vulnerability
    if (trades.length > 20) {
      const recentTrades = trades.slice(-20);
      const recentPnl = recentTrades.reduce((s, t) => s + t.pnl, 0);
      if (recentPnl < 0) weaknesses.push('recent_underperformance');
    }

    // Check directional bias vulnerability
    if (trades.length > 10) {
      const buys = trades.filter(t => t.side === 'buy').length;
      const buyRatio = buys / trades.length;
      if (buyRatio > 0.8) weaknesses.push('long_biased');
      if (buyRatio < 0.2) weaknesses.push('short_biased');
    }

    if (entry.totalTrades < 30) weaknesses.push('small_sample');

    return weaknesses;
  }

  generateCounterDNA(threat: CompetitorThreat): StrategyDNA {
    // Create adversarial DNA that exploits identified weaknesses
    const baseSignals = this.createBaseSignals();
    const baseIndicators = this.createBaseIndicators();
    const basePositionSizing = this.createBasePositionSizing();
    const baseExit = this.createBaseExit();
    const baseTiming = this.createBaseTiming();

    let regimeFilter: RegimeFilterParams = {
      trendFollowBias: randomInRange(-0.5, 0.5),
      volatilityPreference: randomInRange(0.3, 0.7),
      sessionPreference: randomInRange(0.2, 0.8),
      correlationAwareness: randomInRange(0.3, 0.8),
    };

    // Exploit weaknesses
    for (const weakness of threat.weaknesses) {
      switch (weakness) {
        case 'high_drawdown':
          // Counter: tight risk, smaller positions
          basePositionSizing.riskPerTrade = randomInRange(0.005, 0.015);
          basePositionSizing.maxPositionPercent = randomInRange(0.1, 0.2);
          baseExit.stopLossAtr = randomInRange(0.5, 1.2);
          break;
        case 'low_win_rate':
          // Counter: high win-rate setup — mean reversion with tight targets
          baseSignals.meanReversion = randomInRange(0.7, 1.0);
          baseSignals.momentumBreakout = randomInRange(0, 0.2);
          baseExit.takeProfitAtr = randomInRange(1.0, 1.8);
          break;
        case 'long_biased':
          // Counter: short-biased or neutral
          regimeFilter.trendFollowBias = randomInRange(-1, -0.3);
          baseSignals.rsiOverbought = randomInRange(0.7, 1.0);
          break;
        case 'short_biased':
          // Counter: long-biased
          regimeFilter.trendFollowBias = randomInRange(0.3, 1);
          baseSignals.rsiOversold = randomInRange(0.7, 1.0);
          break;
        case 'recent_underperformance':
          // Momentum against them — aggressively trend-follow
          baseSignals.momentumBreakout = randomInRange(0.6, 1.0);
          baseSignals.maCrossover = randomInRange(0.5, 0.9);
          regimeFilter.trendFollowBias = randomInRange(0.5, 1.0);
          break;
        case 'low_sharpe':
          // Counter: high consistency
          basePositionSizing.riskPerTrade = randomInRange(0.005, 0.01);
          baseExit.trailingStopEnabled = 1;
          baseExit.trailingStopAtr = randomInRange(0.5, 1.0);
          break;
      }
    }

    // If fingerprint shows momentum bias, generate mean-reversion counter
    if (threat.dnaFingerprint.length > 0) {
      const buyRatio = threat.dnaFingerprint[0];
      if (buyRatio > 0.7) {
        baseSignals.meanReversion = Math.max(baseSignals.meanReversion, 0.6);
        baseSignals.rsiOverbought = Math.max(baseSignals.rsiOverbought, 0.5);
      } else if (buyRatio < 0.3) {
        baseSignals.meanReversion = Math.max(baseSignals.meanReversion, 0.6);
        baseSignals.rsiOversold = Math.max(baseSignals.rsiOversold, 0.5);
      }
    }

    return {
      entrySignals: baseSignals,
      indicatorParams: baseIndicators,
      positionSizing: basePositionSizing,
      exitStrategy: baseExit,
      regimeFilter,
      timing: baseTiming,
    };
  }

  private createBaseSignals(): EntrySignalWeights {
    return {
      rsiOversold: randomInRange(0.1, 0.5),
      rsiOverbought: randomInRange(0.1, 0.5),
      macdCrossover: randomInRange(0.1, 0.5),
      macdDivergence: randomInRange(0.1, 0.4),
      maCrossover: randomInRange(0.1, 0.5),
      ictOrderBlockBounce: randomInRange(0, 0.4),
      ictFvgFill: randomInRange(0, 0.4),
      breakOfStructure: randomInRange(0.1, 0.4),
      changeOfCharacter: randomInRange(0, 0.3),
      liquiditySweep: randomInRange(0, 0.3),
      volumeSpike: randomInRange(0.1, 0.5),
      meanReversion: randomInRange(0.1, 0.5),
      momentumBreakout: randomInRange(0.1, 0.5),
    };
  }

  private createBaseIndicators() {
    return {
      rsiPeriod: Math.round(randomInRange(7, 21)),
      rsiOversoldThreshold: Math.round(randomInRange(20, 35)),
      rsiOverboughtThreshold: Math.round(randomInRange(65, 80)),
      macdFast: Math.round(randomInRange(8, 15)),
      macdSlow: Math.round(randomInRange(20, 30)),
      macdSignal: Math.round(randomInRange(7, 12)),
      maFastPeriod: Math.round(randomInRange(8, 20)),
      maSlowPeriod: Math.round(randomInRange(30, 60)),
      maType: Math.round(Math.random()),
      obLookback: Math.round(randomInRange(30, 60)),
      fvgLookback: Math.round(randomInRange(30, 60)),
      volumeSpikeMultiplier: randomInRange(1.5, 2.5),
      bollingerPeriod: Math.round(randomInRange(15, 25)),
      bollingerStdDev: randomInRange(1.5, 2.5),
    };
  }

  private createBasePositionSizing() {
    return {
      riskPerTrade: randomInRange(0.01, 0.03),
      maxPositionPercent: randomInRange(0.15, 0.35),
      maxOpenPositions: Math.round(randomInRange(1, 4)),
      kellyFraction: randomInRange(0.15, 0.35),
      pyramidEnabled: Math.round(Math.random()),
      pyramidMaxAdds: Math.round(randomInRange(1, 2)),
    };
  }

  private createBaseExit() {
    return {
      stopLossAtr: randomInRange(1.0, 2.0),
      takeProfitAtr: randomInRange(1.5, 3.5),
      trailingStopEnabled: Math.round(Math.random()),
      trailingStopAtr: randomInRange(0.7, 1.5),
      timeStopBars: Math.round(randomInRange(10, 30)),
      partialExitEnabled: Math.round(Math.random()),
      partialExitPercent: randomInRange(0.3, 0.6),
      partialExitAtr: randomInRange(1.0, 2.0),
    };
  }

  private createBaseTiming() {
    return {
      preferredTimeframe: Math.round(randomInRange(0, 3)),
      decisionIntervalMs: Math.round(randomInRange(10000, 45000)),
      entryPatience: randomInRange(0.2, 0.8),
    };
  }

  trackArmRaceProgress(snapshot: ArenaSnapshot): void {
    const ourStrategies = this.lifecycle.getActiveStrategies();
    if (ourStrategies.length === 0) return;

    const avgFitness = ourStrategies.reduce((s, st) => s + st.metrics.sharpeRatio, 0) / ourStrategies.length;
    this.generationProgress.push({
      generation: snapshot.currentGeneration,
      avgFitness,
    });

    // Keep last 100 entries
    if (this.generationProgress.length > 100) {
      this.generationProgress.shift();
    }

    this.emit('progress:updated', { generation: snapshot.currentGeneration, avgFitness });
  }

  getThreats(): CompetitorThreat[] {
    return [...this.threats];
  }

  getArmRaceProgress(): { generation: number; avgFitness: number }[] {
    return [...this.generationProgress];
  }

  generateRandomDNA(): StrategyDNA {
    return {
      entrySignals: this.createBaseSignals(),
      indicatorParams: this.createBaseIndicators(),
      positionSizing: this.createBasePositionSizing(),
      exitStrategy: this.createBaseExit(),
      regimeFilter: {
        trendFollowBias: randomInRange(-1, 1),
        volatilityPreference: randomInRange(0, 1),
        sessionPreference: randomInRange(0, 1),
        correlationAwareness: randomInRange(0, 1),
      },
      timing: this.createBaseTiming(),
    };
  }
}
