// ============================================================
// Bot Fingerprinter — Builds behavioral profiles from trade stream
// ============================================================

import { BotFingerprint, ObservedTrade, BotGroupName } from './types';

export class BotFingerprinter {
  private fingerprints: Map<string, BotFingerprint> = new Map();
  private tradeHistory: Map<string, ObservedTrade[]> = new Map();
  private maxTradesPerBot: number;

  // Track consecutive win/loss streaks
  private streaks: Map<string, { current: number; maxWin: number; maxLoss: number }> = new Map();

  constructor(maxTradesPerBot: number = 500) {
    this.maxTradesPerBot = maxTradesPerBot;
  }

  /** Ingest a new observed trade */
  ingest(trade: ObservedTrade): void {
    const { botId } = trade;

    // Store trade
    let trades = this.tradeHistory.get(botId);
    if (!trades) {
      trades = [];
      this.tradeHistory.set(botId, trades);
    }
    trades.push(trade);
    if (trades.length > this.maxTradesPerBot) {
      trades.shift();
    }

    // Update streak tracking
    let streak = this.streaks.get(botId);
    if (!streak) {
      streak = { current: 0, maxWin: 0, maxLoss: 0 };
      this.streaks.set(botId, streak);
    }
    if (trade.pnl > 0) {
      streak.current = streak.current > 0 ? streak.current + 1 : 1;
      streak.maxWin = Math.max(streak.maxWin, streak.current);
    } else if (trade.pnl < 0) {
      streak.current = streak.current < 0 ? streak.current - 1 : -1;
      streak.maxLoss = Math.max(streak.maxLoss, Math.abs(streak.current));
    }

    // Rebuild fingerprint
    this.rebuildFingerprint(botId);
  }

  private rebuildFingerprint(botId: string): void {
    const trades = this.tradeHistory.get(botId);
    if (!trades || trades.length === 0) return;

    const first = trades[0];
    const last = trades[trades.length - 1];

    // Trade direction counts
    let buyCount = 0;
    let sellCount = 0;
    let totalSize = 0;
    let totalPnL = 0;
    let winCount = 0;
    let lossCount = 0;
    let sumWins = 0;
    let sumLosses = 0;

    // Timing
    const intervals: number[] = [];
    const reasonMap = new Map<string, number>();

    for (let i = 0; i < trades.length; i++) {
      const t = trades[i];
      if (t.side === 'buy') buyCount++;
      else sellCount++;

      totalSize += t.quantity * t.price;

      if (t.pnl > 0) {
        winCount++;
        sumWins += t.pnl;
      } else if (t.pnl < 0) {
        lossCount++;
        sumLosses += Math.abs(t.pnl);
      }
      totalPnL += t.pnl;

      // Intervals
      if (i > 0) {
        intervals.push(t.observedAt - trades[i - 1].observedAt);
      }

      // Reason distribution
      const reason = t.reason || 'unknown';
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }

    const avgInterval = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 0;

    const intervalStdDev = intervals.length > 1
      ? Math.sqrt(intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / (intervals.length - 1))
      : 0;

    // Aggressiveness: trades per minute relative to 1 trade/min baseline
    const spanMs = last.observedAt - first.observedAt;
    const tradesPerMin = spanMs > 0 ? (trades.length / (spanMs / 60000)) : 0;
    const aggressiveness = Math.min(tradesPerMin / 1.0, 2.0); // capped at 2x

    // Conviction: avg trade size relative to the bot's largest trade
    const maxTradeSize = Math.max(...trades.map(t => t.quantity * t.price));
    const avgTradeSize = totalSize / trades.length;
    const conviction = maxTradeSize > 0 ? avgTradeSize / maxTradeSize : 0;

    // Contrarian: % trades where side opposes the short-term price movement
    let contrarianCount = 0;
    for (let i = 1; i < trades.length; i++) {
      const priceDelta = trades[i].price - trades[i - 1].price;
      if ((trades[i].side === 'buy' && priceDelta < 0) ||
          (trades[i].side === 'sell' && priceDelta > 0)) {
        contrarianCount++;
      }
    }
    const contrarian = trades.length > 1 ? contrarianCount / (trades.length - 1) : 0.5;

    // Momentum bias: correlation between trade direction (+1 buy, -1 sell) and price change
    const momentumBias = this.computeMomentumBias(trades);

    const streak = this.streaks.get(botId)!;

    const fingerprint: BotFingerprint = {
      botId,
      botName: first.botName,
      groupName: first.groupName,
      symbol: first.symbol,

      totalTrades: trades.length,
      buyCount,
      sellCount,
      avgTradeSize,
      avgTradeInterval: avgInterval,
      tradeIntervalStdDev: intervalStdDev,

      totalPnL,
      winCount,
      lossCount,
      avgWin: winCount > 0 ? sumWins / winCount : 0,
      avgLoss: lossCount > 0 ? sumLosses / lossCount : 0,
      winRate: (winCount + lossCount) > 0 ? winCount / (winCount + lossCount) : 0,
      profitFactor: sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? Infinity : 0,
      maxConsecutiveWins: streak.maxWin,
      maxConsecutiveLosses: streak.maxLoss,

      aggressiveness,
      conviction,
      contrarian,
      momentumBias,

      reasonDistribution: reasonMap,

      avgHoldDurationMs: 0, // Would need position tracking to compute
      preferredSessionHours: this.computePreferredHours(trades),

      lastTradeAt: last.observedAt,
      firstTradeAt: first.observedAt,
    };

    this.fingerprints.set(botId, fingerprint);
  }

  private computeMomentumBias(trades: ObservedTrade[]): number {
    if (trades.length < 3) return 0;

    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 1; i < trades.length; i++) {
      const direction = trades[i].side === 'buy' ? 1 : -1;
      const priceChange = trades[i].price - trades[i - 1].price;
      sumXY += direction * priceChange;
      sumX2 += direction * direction;
      sumY2 += priceChange * priceChange;
    }

    const denom = Math.sqrt(sumX2 * sumY2);
    return denom > 0 ? sumXY / denom : 0;
  }

  private computePreferredHours(trades: ObservedTrade[]): number[] {
    const hourCounts = new Array(24).fill(0);
    for (const t of trades) {
      const hour = new Date(t.timestamp).getUTCHours();
      hourCounts[hour]++;
    }

    // Return hours with above-average activity
    const avg = trades.length / 24;
    const preferred: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > avg * 1.5) preferred.push(h);
    }
    return preferred;
  }

  /** Get fingerprint for a specific bot */
  getFingerprint(botId: string): BotFingerprint | undefined {
    return this.fingerprints.get(botId);
  }

  /** Get all fingerprints */
  getAllFingerprints(): BotFingerprint[] {
    return [...this.fingerprints.values()];
  }

  /** Get fingerprints by group */
  getGroupFingerprints(group: BotGroupName): BotFingerprint[] {
    return this.getAllFingerprints().filter(f => f.groupName === group);
  }

  /** Get trade history for a bot */
  getTrades(botId: string): ObservedTrade[] {
    return this.tradeHistory.get(botId) || [];
  }

  /** Get all tracked bot IDs */
  trackedBotIds(): string[] {
    return [...this.fingerprints.keys()];
  }

  /** Generate a behavioral feature vector for clustering */
  toBehaviorVector(botId: string): number[] | null {
    const fp = this.fingerprints.get(botId);
    if (!fp || fp.totalTrades < 5) return null;

    return [
      fp.winRate,
      fp.profitFactor === Infinity ? 5 : Math.min(fp.profitFactor, 5),
      fp.aggressiveness,
      fp.conviction,
      fp.contrarian,
      fp.momentumBias,
      fp.buyCount / fp.totalTrades,  // buy ratio
      fp.avgTradeInterval > 0 ? 1 / (fp.avgTradeInterval / 60000) : 0, // trades/min
      fp.tradeIntervalStdDev / (fp.avgTradeInterval || 1), // regularity (CV)
    ];
  }

  static featureNames(): string[] {
    return [
      'winRate', 'profitFactor', 'aggressiveness', 'conviction',
      'contrarian', 'momentumBias', 'buyRatio', 'tradeFrequency', 'regularity',
    ];
  }
}
