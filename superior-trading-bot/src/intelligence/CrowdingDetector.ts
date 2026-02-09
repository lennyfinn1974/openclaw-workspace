/**
 * Crowding Detection Engine
 * Layer 4: Competitive Intelligence
 *
 * Detects when multiple bots converge on the same trade, creating
 * crowding risk. Classifies bots as "smart money" (consistently early)
 * vs "dumb money" (consistently late) to inform strategy decisions.
 *
 * Strategic responses to crowding:
 * - 60%+ bots buying → reduce long exposure (mean reversion pressure)
 * - Crowding collapses rapidly → fade the unwind (profit from panicked exits)
 * - Track smart money vs dumb money for signal quality
 */

import { EventEmitter } from 'events';
import {
  CrowdingAlert, CrowdingSeverity, SmartMoneyScore, CrowdingSnapshot
} from '../types/synthesis';
import { ObservationEvent, TradeDirection } from '../types/core';

// ===================== CONFIG =====================

interface CrowdingConfig {
  windowMinutes: number;         // time window for crowding detection
  mildThreshold: number;         // imbalance ratio for mild crowding
  moderateThreshold: number;     // imbalance ratio for moderate
  severeThreshold: number;       // imbalance ratio for severe
  extremeThreshold: number;      // imbalance ratio for extreme
  minBotsForCrowding: number;    // minimum bots involved
  smartMoneyLookback: number;    // trades to look back for smart money scoring
  decayHalfLife: number;         // minutes before crowding signals decay
  updateInterval: number;        // ms between crowding recalculations
}

const DEFAULT_CONFIG: CrowdingConfig = {
  windowMinutes: 5,
  mildThreshold: 0.55,
  moderateThreshold: 0.65,
  severeThreshold: 0.75,
  extremeThreshold: 0.85,
  minBotsForCrowding: 3,
  smartMoneyLookback: 200,
  decayHalfLife: 15,
  updateInterval: 5000,
};

let alertIdCounter = 0;

// ===================== CROWDING DETECTOR =====================

export class CrowdingDetector extends EventEmitter {
  private config: CrowdingConfig;
  private recentTrades: RecentTrade[] = [];
  private activeAlerts: Map<string, CrowdingAlert> = new Map();
  private smartMoneyScores: Map<string, SmartMoneyScore> = new Map();
  private tradeOutcomes: Map<string, TradeOutcomeRecord[]> = new Map();
  private alertHistory: CrowdingAlert[] = [];
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CrowdingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===================== LIFECYCLE =====================

  start(): void {
    this.updateTimer = setInterval(() => {
      this.recalculate();
    }, this.config.updateInterval);
  }

  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  // ===================== EVENT PROCESSING =====================

  /**
   * Process a new trade event for crowding analysis.
   */
  processTrade(event: ObservationEvent): void {
    const payload = event.payload as any;
    const botId = payload.botId || (event as any).botId;
    const direction = payload.direction || payload.side;
    const symbol = payload.symbol;
    const price = payload.price;

    if (!botId || !direction || !symbol) return;

    this.recentTrades.push({
      botId,
      direction: direction as TradeDirection,
      symbol,
      price,
      timestamp: event.timestamp,
      pnl: payload.pnl,
    });

    // Trim old trades outside the window
    const cutoff = Date.now() - this.config.windowMinutes * 60 * 1000;
    this.recentTrades = this.recentTrades.filter(t => t.timestamp > cutoff);

    // Track outcome for smart money scoring
    if (payload.pnl !== undefined) {
      if (!this.tradeOutcomes.has(botId)) {
        this.tradeOutcomes.set(botId, []);
      }
      this.tradeOutcomes.get(botId)!.push({
        timestamp: event.timestamp,
        direction: direction as TradeDirection,
        symbol,
        pnl: payload.pnl,
        wasFirst: this.wasFirstMover(botId, symbol, direction as TradeDirection, event.timestamp),
      });
    }

    // Immediate check
    this.detectCrowding(symbol);
  }

  // ===================== CROWDING DETECTION =====================

  private recalculate(): void {
    // Trim old trades
    const cutoff = Date.now() - this.config.windowMinutes * 60 * 1000;
    this.recentTrades = this.recentTrades.filter(t => t.timestamp > cutoff);

    // Get all active symbols
    const symbols = new Set(this.recentTrades.map(t => t.symbol));

    for (const symbol of symbols) {
      this.detectCrowding(symbol);
    }

    // Decay old alerts
    this.decayAlerts();

    // Update smart money scores periodically
    this.updateSmartMoneyScores();
  }

  private detectCrowding(symbol: string): void {
    const cutoff = Date.now() - this.config.windowMinutes * 60 * 1000;
    const symbolTrades = this.recentTrades.filter(
      t => t.symbol === symbol && t.timestamp > cutoff
    );

    if (symbolTrades.length < this.config.minBotsForCrowding) return;

    // Count unique bots per direction
    const buyBots = new Set(symbolTrades.filter(t => t.direction === 'buy').map(t => t.botId));
    const sellBots = new Set(symbolTrades.filter(t => t.direction === 'sell').map(t => t.botId));
    const totalBots = new Set(symbolTrades.map(t => t.botId)).size;

    if (totalBots < this.config.minBotsForCrowding) return;

    const buyCount = buyBots.size;
    const sellCount = sellBots.size;
    const imbalance = Math.abs(buyCount - sellCount) / totalBots;

    // Classify severity
    const severity = this.classifySeverity(imbalance);
    if (severity === 'none') {
      // Clear alert if exists
      this.activeAlerts.delete(symbol);
      return;
    }

    // Determine dominant direction
    const direction: TradeDirection = buyCount > sellCount ? 'buy' : 'sell';
    const involvedBots = [...(direction === 'buy' ? buyBots : sellBots)];

    // Classify smart vs dumb money
    const smartMoney = involvedBots.filter(b => this.isSmartMoney(b));
    const dumbMoney = involvedBots.filter(b => this.isDumbMoney(b));

    // Recommendation
    const recommendation = this.generateRecommendation(severity, smartMoney.length, dumbMoney.length, involvedBots.length);

    // Estimate reversal probability
    const reversalProb = this.estimateReversalProbability(imbalance, smartMoney.length, involvedBots.length);

    const alert: CrowdingAlert = {
      id: `crowd_${++alertIdCounter}`,
      symbol,
      direction,
      severity,
      imbalanceRatio: imbalance,
      botsInvolved: involvedBots,
      smartMoneyBots: smartMoney,
      dumbMoneyBots: dumbMoney,
      recommendation,
      estimatedReversalProb: reversalProb,
      detectedAt: Date.now(),
      windowMinutes: this.config.windowMinutes,
    };

    const existing = this.activeAlerts.get(symbol);
    const isNew = !existing || existing.severity !== severity;

    this.activeAlerts.set(symbol, alert);

    if (isNew) {
      this.alertHistory.push(alert);
      this.emit('crowding:detected', alert);
    }
  }

  private classifySeverity(imbalance: number): CrowdingSeverity {
    if (imbalance >= this.config.extremeThreshold) return 'extreme';
    if (imbalance >= this.config.severeThreshold) return 'severe';
    if (imbalance >= this.config.moderateThreshold) return 'moderate';
    if (imbalance >= this.config.mildThreshold) return 'mild';
    return 'none';
  }

  private generateRecommendation(
    severity: CrowdingSeverity,
    smartMoneyCount: number,
    dumbMoneyCount: number,
    totalBots: number
  ): CrowdingAlert['recommendation'] {
    // If smart money is heavily involved, follow them
    if (smartMoneyCount > totalBots * 0.5 && severity !== 'extreme') {
      return 'FOLLOW_SMART_MONEY';
    }

    // If mostly dumb money, fade the trade
    if (dumbMoneyCount > totalBots * 0.5) {
      return 'FADE';
    }

    // Extreme crowding — always avoid
    if (severity === 'extreme' || severity === 'severe') {
      return 'FADE';
    }

    // Moderate — avoid
    if (severity === 'moderate') {
      return 'AVOID';
    }

    return 'NEUTRAL';
  }

  private estimateReversalProbability(
    imbalance: number,
    smartMoneyCount: number,
    totalBots: number
  ): number {
    // Higher imbalance → higher reversal probability
    let prob = imbalance * 0.6;

    // Smart money involvement reduces reversal probability
    const smartRatio = smartMoneyCount / Math.max(totalBots, 1);
    prob *= (1 - smartRatio * 0.3);

    return Math.min(0.95, Math.max(0, prob));
  }

  private decayAlerts(): void {
    const now = Date.now();

    for (const [symbol, alert] of this.activeAlerts) {
      const ageMinutes = (now - alert.detectedAt) / (1000 * 60);
      if (ageMinutes > this.config.decayHalfLife * 2) {
        this.activeAlerts.delete(symbol);
        this.emit('crowding:expired', alert);
      }
    }
  }

  // ===================== SMART MONEY SCORING =====================

  private updateSmartMoneyScores(): void {
    for (const [botId, outcomes] of this.tradeOutcomes) {
      const recent = outcomes.slice(-this.config.smartMoneyLookback);
      if (recent.length < 10) continue;

      // Early mover score: how often this bot enters profitable trades first
      const earlyMoverScore = this.calculateEarlyMoverScore(recent);

      // Contrarian score: how often bets against crowd successfully
      const contrarianScore = this.calculateContrarianScore(botId, recent);

      // Exit timing score
      const exitTimingScore = this.calculateExitTimingScore(recent);

      const overallScore = earlyMoverScore * 0.4 + contrarianScore * 0.3 + exitTimingScore * 0.3;
      const classification: SmartMoneyScore['classification'] =
        overallScore > 0.6 ? 'smart_money' :
        overallScore < 0.4 ? 'dumb_money' : 'neutral';

      this.smartMoneyScores.set(botId, {
        botId,
        earlyMoverScore,
        contrarianScore,
        exitTimingScore,
        overallScore,
        classification,
        sampleSize: recent.length,
      });
    }
  }

  private calculateEarlyMoverScore(outcomes: TradeOutcomeRecord[]): number {
    const firstMoves = outcomes.filter(o => o.wasFirst);
    if (firstMoves.length === 0) return 0.5;

    const profitableFirstMoves = firstMoves.filter(o => o.pnl > 0).length;
    return profitableFirstMoves / firstMoves.length;
  }

  private calculateContrarianScore(botId: string, outcomes: TradeOutcomeRecord[]): number {
    let contrarianWins = 0;
    let contrarianTotal = 0;

    for (const outcome of outcomes) {
      // Check if this trade was against the crowd at the time
      const crowdDirection = this.getCrowdDirectionAtTime(outcome.symbol, outcome.timestamp);
      if (crowdDirection && crowdDirection !== outcome.direction) {
        contrarianTotal++;
        if (outcome.pnl > 0) contrarianWins++;
      }
    }

    return contrarianTotal > 0 ? contrarianWins / contrarianTotal : 0.5;
  }

  private calculateExitTimingScore(outcomes: TradeOutcomeRecord[]): number {
    // Approximate: profitable trades indicate good exit timing
    const profitable = outcomes.filter(o => o.pnl > 0).length;
    return profitable / Math.max(outcomes.length, 1);
  }

  private wasFirstMover(botId: string, symbol: string, direction: TradeDirection, timestamp: number): boolean {
    const window = 60 * 1000; // 1-minute window
    const priorTrades = this.recentTrades.filter(
      t => t.symbol === symbol && t.direction === direction &&
        t.timestamp < timestamp && t.timestamp > timestamp - window
    );
    return priorTrades.length === 0;
  }

  private getCrowdDirectionAtTime(symbol: string, timestamp: number): TradeDirection | null {
    const window = this.config.windowMinutes * 60 * 1000;
    const trades = this.recentTrades.filter(
      t => t.symbol === symbol &&
        t.timestamp > timestamp - window &&
        t.timestamp < timestamp
    );

    if (trades.length < this.config.minBotsForCrowding) return null;

    const buys = trades.filter(t => t.direction === 'buy').length;
    const sells = trades.filter(t => t.direction === 'sell').length;

    if (buys > sells * 1.5) return 'buy';
    if (sells > buys * 1.5) return 'sell';
    return null;
  }

  private isSmartMoney(botId: string): boolean {
    const score = this.smartMoneyScores.get(botId);
    return score?.classification === 'smart_money' || false;
  }

  private isDumbMoney(botId: string): boolean {
    const score = this.smartMoneyScores.get(botId);
    return score?.classification === 'dumb_money' || false;
  }

  // ===================== SNAPSHOT =====================

  /**
   * Get current crowding snapshot across all symbols.
   */
  getSnapshot(): CrowdingSnapshot {
    const cutoff = Date.now() - this.config.windowMinutes * 60 * 1000;
    const activeTrades = this.recentTrades.filter(t => t.timestamp > cutoff);

    const symbols: CrowdingSnapshot['symbols'] = {};
    const symbolSet = new Set(activeTrades.map(t => t.symbol));

    for (const symbol of symbolSet) {
      const trades = activeTrades.filter(t => t.symbol === symbol);
      const buyers = [...new Set(trades.filter(t => t.direction === 'buy').map(t => t.botId))];
      const sellers = [...new Set(trades.filter(t => t.direction === 'sell').map(t => t.botId))];

      const buyPressure = buyers.length;
      const sellPressure = sellers.length;
      const total = buyPressure + sellPressure;
      const imbalance = total > 0 ? Math.abs(buyPressure - sellPressure) / total : 0;

      symbols[symbol] = {
        buyPressure,
        sellPressure,
        netPressure: buyPressure - sellPressure,
        uniqueBuyers: buyers,
        uniqueSellers: sellers,
        imbalance,
        trend: 'stable', // simplified
      };
    }

    // Overall level
    const alerts = [...this.activeAlerts.values()];
    let overallLevel: CrowdingSeverity = 'none';
    if (alerts.some(a => a.severity === 'extreme')) overallLevel = 'extreme';
    else if (alerts.some(a => a.severity === 'severe')) overallLevel = 'severe';
    else if (alerts.some(a => a.severity === 'moderate')) overallLevel = 'moderate';
    else if (alerts.some(a => a.severity === 'mild')) overallLevel = 'mild';

    return {
      timestamp: Date.now(),
      symbols,
      overallCrowdingLevel: overallLevel,
    };
  }

  // ===================== PUBLIC API =====================

  getActiveAlerts(): CrowdingAlert[] {
    return [...this.activeAlerts.values()];
  }

  getAlert(symbol: string): CrowdingAlert | undefined {
    return this.activeAlerts.get(symbol);
  }

  getSmartMoneyScores(): SmartMoneyScore[] {
    return [...this.smartMoneyScores.values()];
  }

  getSmartMoneyBots(): string[] {
    return [...this.smartMoneyScores.values()]
      .filter(s => s.classification === 'smart_money')
      .map(s => s.botId);
  }

  getAlertHistory(): CrowdingAlert[] {
    return [...this.alertHistory];
  }

  getStats(): {
    activeAlerts: number;
    totalAlerts: number;
    trackedBots: number;
    smartMoneyBots: number;
    dumbMoneyBots: number;
    recentTradesInWindow: number;
  } {
    return {
      activeAlerts: this.activeAlerts.size,
      totalAlerts: this.alertHistory.length,
      trackedBots: this.tradeOutcomes.size,
      smartMoneyBots: this.getSmartMoneyBots().length,
      dumbMoneyBots: [...this.smartMoneyScores.values()].filter(s => s.classification === 'dumb_money').length,
      recentTradesInWindow: this.recentTrades.length,
    };
  }
}

// ===================== INTERNAL TYPES =====================

interface RecentTrade {
  botId: string;
  direction: TradeDirection;
  symbol: string;
  price: number;
  timestamp: number;
  pnl?: number;
}

interface TradeOutcomeRecord {
  timestamp: number;
  direction: TradeDirection;
  symbol: string;
  pnl: number;
  wasFirst: boolean;
}

export default CrowdingDetector;
