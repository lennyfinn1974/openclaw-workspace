import { EventEmitter } from 'events';
import {
  ArenaTrade, MarketRegime, ALL_REGIMES,
  StrategyFingerprint, RegimePerformance
} from '../types/intelligence';

const HALF_LIFE_TRADES = 50;
const DECAY_FACTOR = Math.log(2) / HALF_LIFE_TRADES;

export class FingerprintEngine extends EventEmitter {
  private fingerprints = new Map<string, StrategyFingerprint>();
  private botTrades = new Map<string, ArenaTrade[]>();

  processTrade(trade: ArenaTrade): void {
    if (!this.botTrades.has(trade.botId)) {
      this.botTrades.set(trade.botId, []);
    }
    this.botTrades.get(trade.botId)!.push(trade);
    this.updateFingerprint(trade.botId);
  }

  updateFingerprint(botId: string): void {
    const trades = this.botTrades.get(botId);
    if (!trades || trades.length < 2) return;

    const now = Date.now();
    const fp = this.computeFingerprint(botId, trades, now);
    this.fingerprints.set(botId, fp);
    this.emit('updated', fp);
  }

  recomputeAll(): void {
    for (const botId of this.botTrades.keys()) {
      this.updateFingerprint(botId);
    }
  }

  private computeFingerprint(botId: string, trades: ArenaTrade[], now: number): StrategyFingerprint {
    const n = trades.length;

    // Exponential decay weights: most recent trade = weight 1
    const weights = trades.map((_, i) => Math.exp(-DECAY_FACTOR * (n - 1 - i)));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Holding period (estimate from consecutive trade timestamps)
    let holdingPeriods: number[] = [];
    for (let i = 1; i < trades.length; i++) {
      if (trades[i].botId === trades[i - 1].botId) {
        holdingPeriods.push((trades[i].timestamp - trades[i - 1].timestamp) / 60000);
      }
    }
    const avgHolding = holdingPeriods.length > 0
      ? holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length
      : 0;

    // Trade frequency (trades per hour)
    const timeSpanHours = (trades[n - 1].timestamp - trades[0].timestamp) / 3600000;
    const tradeFrequency = timeSpanHours > 0 ? n / timeSpanHours : 0;

    // Direction bias (-1 to +1)
    let buyWeight = 0, sellWeight = 0;
    for (let i = 0; i < n; i++) {
      if (trades[i].direction === 'buy') buyWeight += weights[i];
      else sellWeight += weights[i];
    }
    const directionBias = totalWeight > 0 ? (buyWeight - sellWeight) / totalWeight : 0;

    // Preferred regimes (weighted)
    const regimeCounts = new Map<MarketRegime, number>();
    for (let i = 0; i < n; i++) {
      const r = trades[i].regime;
      regimeCounts.set(r, (regimeCounts.get(r) || 0) + weights[i]);
    }
    const preferredRegimes = Array.from(regimeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([regime]) => regime);

    // Performance by regime
    const performanceByRegime: Record<string, RegimePerformance> = {};
    for (const regime of ALL_REGIMES) {
      const regimeTrades = trades.filter(t => t.regime === regime && t.outcome);
      if (regimeTrades.length === 0) {
        performanceByRegime[regime] = {
          winRate: 0, avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0, tradeCount: 0
        };
        continue;
      }
      const returns = regimeTrades.map(t => t.outcome!.pnlPercentage);
      const wins = regimeTrades.filter(t => t.outcome!.isWinner).length;
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
      );
      const drawdowns = regimeTrades
        .filter(t => t.outcome!.maxAdverseExcursion !== undefined)
        .map(t => t.outcome!.maxAdverseExcursion);
      const maxDD = drawdowns.length > 0 ? Math.max(...drawdowns) : 0;

      performanceByRegime[regime] = {
        winRate: wins / regimeTrades.length,
        avgReturn,
        sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0,
        maxDrawdown: maxDD,
        tradeCount: regimeTrades.length
      };
    }

    return {
      botId,
      avgHoldingPeriod: avgHolding,
      tradeFrequency,
      preferredRegimes,
      directionBias,
      performanceByRegime: performanceByRegime as Record<MarketRegime, RegimePerformance>,
      tradeCount: n,
      lastUpdated: now
    };
  }

  getFingerprint(botId: string): StrategyFingerprint | undefined {
    return this.fingerprints.get(botId);
  }

  getAllFingerprints(): StrategyFingerprint[] {
    return Array.from(this.fingerprints.values());
  }

  getBotCount(): number {
    return this.fingerprints.size;
  }
}
