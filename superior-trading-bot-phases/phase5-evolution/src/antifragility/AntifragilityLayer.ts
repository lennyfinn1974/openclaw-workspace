import { EventEmitter } from 'events';
import {
  ChaosHedge,
  ChaosHedgeType,
  ArenaSnapshot,
  StrategyDNA,
  LeaderboardEntry,
} from '../types';
import { StateStore } from '../utils/StateStore';

const BASE_HEDGE_ALLOCATION = 0.01; // 1% per hedge type (3% total)
const BOOSTED_HEDGE_ALLOCATION = 0.0167; // ~5% total when chaos high
const CHAOS_BOOST_THRESHOLD = 0.7;
const REBALANCE_INTERVAL = 5 * 60 * 1000; // 5 minutes

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class AntifragilityLayer extends EventEmitter {
  private store: StateStore;
  private hedges: ChaosHedge[] = [];
  private chaosIndex = 0;
  private rebalanceTimer: ReturnType<typeof setInterval> | null = null;
  private previousLeaderboard: LeaderboardEntry[] = [];
  private volatilityHistory: number[] = [];

  constructor(store: StateStore) {
    super();
    this.store = store;
  }

  initialize(): void {
    const saved = this.store.getHedges();
    if (saved.length === 3) {
      this.hedges = saved;
      console.log(`[Antifragility] Loaded 3 hedges (total alloc=${(this.getTotalAllocation() * 100).toFixed(1)}%)`);
    } else {
      this.hedges = this.initializeHedges();
      this.store.setHedges(this.hedges);
      console.log('[Antifragility] Created 3 new hedges');
    }
  }

  initializeHedges(): ChaosHedge[] {
    return [
      {
        type: 'volatility_long',
        allocation: BASE_HEDGE_ALLOCATION,
        dna: this.createVolatilityLongDNA(),
        triggerCondition: 'volatility_spike > 1.5x average',
        active: true,
        lifetimePnL: 0,
      },
      {
        type: 'tail_hedge',
        allocation: BASE_HEDGE_ALLOCATION,
        dna: this.createTailHedgeDNA(),
        triggerCondition: 'RSI < 20 OR RSI > 80 (extreme reversal)',
        active: true,
        lifetimePnL: 0,
      },
      {
        type: 'regime_straddle',
        allocation: BASE_HEDGE_ALLOCATION,
        dna: this.createRegimeStraddleDNA(),
        triggerCondition: 'regime_change_count > 3 in last hour',
        active: true,
        lifetimePnL: 0,
      },
    ];
  }

  private createVolatilityLongDNA(): StrategyDNA {
    return {
      entrySignals: {
        rsiOversold: 0.2,
        rsiOverbought: 0.2,
        macdCrossover: 0.3,
        macdDivergence: 0.2,
        maCrossover: 0.2,
        ictOrderBlockBounce: 0.1,
        ictFvgFill: 0.1,
        breakOfStructure: 0.6,
        changeOfCharacter: 0.5,
        liquiditySweep: 0.3,
        volumeSpike: 0.9,       // high weight on volume spikes
        meanReversion: 0.1,
        momentumBreakout: 0.8,  // high weight on breakouts
      },
      indicatorParams: {
        rsiPeriod: 14,
        rsiOversoldThreshold: 25,
        rsiOverboughtThreshold: 75,
        macdFast: 8,
        macdSlow: 21,
        macdSignal: 9,
        maFastPeriod: 10,
        maSlowPeriod: 30,
        maType: 1,
        obLookback: 40,
        fvgLookback: 40,
        volumeSpikeMultiplier: 2.5, // high multiplier for vol detection
        bollingerPeriod: 20,
        bollingerStdDev: 2.5,
      },
      positionSizing: {
        riskPerTrade: 0.02,
        maxPositionPercent: 0.3,
        maxOpenPositions: 3,
        kellyFraction: 0.3,
        pyramidEnabled: 1,
        pyramidMaxAdds: 2,
      },
      exitStrategy: {
        stopLossAtr: 2.5,     // wide stops for vol plays
        takeProfitAtr: 4.0,   // wide targets
        trailingStopEnabled: 1,
        trailingStopAtr: 1.5,
        timeStopBars: 40,
        partialExitEnabled: 1,
        partialExitPercent: 0.5,
        partialExitAtr: 2.0,
      },
      regimeFilter: {
        trendFollowBias: 0.5,
        volatilityPreference: 0.9, // loves high volatility
        sessionPreference: 0.3,
        correlationAwareness: 0.5,
      },
      timing: {
        preferredTimeframe: 1,     // 5m
        decisionIntervalMs: 15000,
        entryPatience: 0.3,        // aggressive entry
      },
    };
  }

  private createTailHedgeDNA(): StrategyDNA {
    return {
      entrySignals: {
        rsiOversold: 0.9,       // extreme RSI signals
        rsiOverbought: 0.9,
        macdCrossover: 0.2,
        macdDivergence: 0.5,
        maCrossover: 0.2,
        ictOrderBlockBounce: 0.3,
        ictFvgFill: 0.3,
        breakOfStructure: 0.4,
        changeOfCharacter: 0.6,
        liquiditySweep: 0.5,
        volumeSpike: 0.4,
        meanReversion: 0.9,    // high mean reversion
        momentumBreakout: 0.1,
      },
      indicatorParams: {
        rsiPeriod: 10,
        rsiOversoldThreshold: 20, // extreme thresholds
        rsiOverboughtThreshold: 80,
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        maFastPeriod: 10,
        maSlowPeriod: 40,
        maType: 1,
        obLookback: 50,
        fvgLookback: 50,
        volumeSpikeMultiplier: 2.0,
        bollingerPeriod: 20,
        bollingerStdDev: 3.0, // wide Bollinger for extremes
      },
      positionSizing: {
        riskPerTrade: 0.015,
        maxPositionPercent: 0.2,
        maxOpenPositions: 2,
        kellyFraction: 0.2,
        pyramidEnabled: 0,
        pyramidMaxAdds: 1,
      },
      exitStrategy: {
        stopLossAtr: 1.5,
        takeProfitAtr: 4.5,   // very wide take profit for tail events
        trailingStopEnabled: 0,
        trailingStopAtr: 1.0,
        timeStopBars: 20,
        partialExitEnabled: 1,
        partialExitPercent: 0.5,
        partialExitAtr: 2.5,
      },
      regimeFilter: {
        trendFollowBias: -0.7, // counter-trend for tail catches
        volatilityPreference: 0.8,
        sessionPreference: 0.2,
        correlationAwareness: 0.7,
      },
      timing: {
        preferredTimeframe: 2,     // 15m
        decisionIntervalMs: 30000,
        entryPatience: 0.7,        // patient — waits for extremes
      },
    };
  }

  private createRegimeStraddleDNA(): StrategyDNA {
    return {
      entrySignals: {
        rsiOversold: 0.4,
        rsiOverbought: 0.4,
        macdCrossover: 0.5,
        macdDivergence: 0.4,
        maCrossover: 0.5,
        ictOrderBlockBounce: 0.3,
        ictFvgFill: 0.3,
        breakOfStructure: 0.5,
        changeOfCharacter: 0.5,
        liquiditySweep: 0.3,
        volumeSpike: 0.4,
        meanReversion: 0.4,
        momentumBreakout: 0.4,   // balanced signals
      },
      indicatorParams: {
        rsiPeriod: 14,
        rsiOversoldThreshold: 30,
        rsiOverboughtThreshold: 70,
        macdFast: 10,
        macdSlow: 25,
        macdSignal: 9,
        maFastPeriod: 12,
        maSlowPeriod: 40,
        maType: 1,
        obLookback: 40,
        fvgLookback: 40,
        volumeSpikeMultiplier: 2.0,
        bollingerPeriod: 20,
        bollingerStdDev: 2.0,
      },
      positionSizing: {
        riskPerTrade: 0.01,
        maxPositionPercent: 0.15,
        maxOpenPositions: 3,
        kellyFraction: 0.2,
        pyramidEnabled: 0,
        pyramidMaxAdds: 1,
      },
      exitStrategy: {
        stopLossAtr: 1.5,
        takeProfitAtr: 2.5,
        trailingStopEnabled: 1,
        trailingStopAtr: 1.0,
        timeStopBars: 25,
        partialExitEnabled: 1,
        partialExitPercent: 0.4,
        partialExitAtr: 1.5,
      },
      regimeFilter: {
        trendFollowBias: 0,       // neutral — straddles all regimes
        volatilityPreference: 0.5,
        sessionPreference: 0.5,
        correlationAwareness: 0.8, // high awareness to detect regime shifts
      },
      timing: {
        preferredTimeframe: 1,
        decisionIntervalMs: 20000,
        entryPatience: 0.5,
      },
    };
  }

  updateChaosIndex(snapshot: ArenaSnapshot): number {
    // Composite chaos index from 3 signals

    // 1. Leaderboard turbulence: how much ranks changed since last snapshot
    let rankTurbulence = 0;
    if (this.previousLeaderboard.length > 0 && snapshot.leaderboard.length > 0) {
      const prevRanks = new Map(this.previousLeaderboard.map(e => [e.botId, e.rank]));
      let totalRankChange = 0;
      let count = 0;
      for (const entry of snapshot.leaderboard) {
        const prevRank = prevRanks.get(entry.botId);
        if (prevRank !== undefined) {
          totalRankChange += Math.abs(entry.rank - prevRank);
          count++;
        }
      }
      // Normalize: max possible average change ~ 10 positions
      rankTurbulence = count > 0 ? Math.min(1, (totalRankChange / count) / 10) : 0;
    }
    this.previousLeaderboard = snapshot.leaderboard;

    // 2. P&L volatility across all bots
    let pnlVolatility = 0;
    const allPnls: number[] = [];
    for (const [, trades] of snapshot.botTrades) {
      const recent = trades.slice(-10);
      for (const t of recent) {
        allPnls.push(t.pnl);
      }
    }
    if (allPnls.length > 5) {
      const mean = allPnls.reduce((s, p) => s + p, 0) / allPnls.length;
      const variance = allPnls.reduce((s, p) => s + (p - mean) ** 2, 0) / allPnls.length;
      const vol = Math.sqrt(variance);
      this.volatilityHistory.push(vol);
      if (this.volatilityHistory.length > 100) this.volatilityHistory.shift();

      // Percentile of current vol vs history
      const sorted = [...this.volatilityHistory].sort((a, b) => a - b);
      const percentileIdx = sorted.findIndex(v => v >= vol);
      pnlVolatility = sorted.length > 0 ? percentileIdx / sorted.length : 0;
    }

    // 3. Loss count: how many bots are in negative territory
    const totalBots = snapshot.leaderboard.length;
    const losingBots = snapshot.leaderboard.filter(e => e.totalPnL < 0).length;
    const lossRatio = totalBots > 0 ? losingBots / totalBots : 0;

    // Weighted chaos index
    this.chaosIndex = 0.4 * rankTurbulence + 0.35 * pnlVolatility + 0.25 * lossRatio;

    this.emit('chaos:updated', this.chaosIndex);
    return this.chaosIndex;
  }

  rebalanceHedges(chaosIndex: number): void {
    const targetAllocation = chaosIndex > CHAOS_BOOST_THRESHOLD
      ? BOOSTED_HEDGE_ALLOCATION
      : BASE_HEDGE_ALLOCATION;

    for (const hedge of this.hedges) {
      hedge.allocation = targetAllocation;
    }

    this.store.setHedges(this.hedges);

    if (chaosIndex > CHAOS_BOOST_THRESHOLD) {
      console.log(`[Antifragility] CHAOS BOOST: index=${chaosIndex.toFixed(2)}, hedge allocation → ${(targetAllocation * 300).toFixed(1)}%`);
    }
  }

  startRebalanceLoop(getSnapshot: () => ArenaSnapshot): void {
    this.rebalanceTimer = setInterval(() => {
      const snapshot = getSnapshot();
      if (snapshot.leaderboard.length > 0) {
        const chaos = this.updateChaosIndex(snapshot);
        this.rebalanceHedges(chaos);
      }
    }, REBALANCE_INTERVAL);
    console.log('[Antifragility] Rebalance loop started (5m interval)');
  }

  stopRebalanceLoop(): void {
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
      this.rebalanceTimer = null;
    }
  }

  recordHedgePnL(hedgeType: ChaosHedgeType, pnl: number): void {
    const hedge = this.hedges.find(h => h.type === hedgeType);
    if (hedge) {
      hedge.lifetimePnL += pnl;
      this.store.setHedges(this.hedges);
    }
  }

  getChaosIndex(): number {
    return this.chaosIndex;
  }

  getHedges(): ChaosHedge[] {
    return [...this.hedges];
  }

  getHedgePerformance(): { type: string; pnl: number; allocation: number }[] {
    return this.hedges.map(h => ({
      type: h.type,
      pnl: h.lifetimePnL,
      allocation: h.allocation,
    }));
  }

  getTotalAllocation(): number {
    return this.hedges.reduce((s, h) => s + h.allocation, 0);
  }

  getHedgeDNAs(): { type: ChaosHedgeType; dna: StrategyDNA }[] {
    return this.hedges.map(h => ({ type: h.type, dna: h.dna }));
  }
}
