/**
 * Risk Governor (from Layer 6)
 *
 * Circuit breakers with veto power.
 * Max 5% daily drawdown.
 * Position-level, strategy-level, and portfolio-level protection.
 *
 * Phase 4: ENFORCEMENT MODE — vetoes block real trades.
 */

import { EventEmitter } from 'events';
import {
  CircuitBreaker, CircuitBreakerLevel, CircuitBreakerState,
  RiskVeto, RiskState, RiskLimits, MarketRegime
} from './types';

// ===================== CIRCUIT BREAKER ENGINE =====================

class CircuitBreakerEngine {
  private breakers: Map<string, CircuitBreaker> = new Map();

  add(breaker: CircuitBreaker): void {
    this.breakers.set(breaker.id, breaker);
  }

  remove(id: string): void {
    this.breakers.delete(id);
  }

  get(id: string): CircuitBreaker | undefined {
    return this.breakers.get(id);
  }

  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  getByLevel(level: CircuitBreakerLevel): CircuitBreaker[] {
    return this.getAll().filter(b => b.level === level);
  }

  update(id: string, newValue: number): RiskVeto | null {
    const breaker = this.breakers.get(id);
    if (!breaker) return null;

    breaker.currentValue = newValue;

    switch (breaker.state) {
      case 'closed':
        if (newValue >= breaker.tripThreshold) {
          return this.trip(breaker);
        }
        break;
      case 'open':
        if (breaker.lastTripped &&
          Date.now() - breaker.lastTripped > breaker.cooldownMs) {
          breaker.state = 'half_open';
        }
        break;
      case 'half_open':
        if (newValue < breaker.resetThreshold) {
          breaker.state = 'closed';
        } else if (newValue >= breaker.tripThreshold) {
          return this.trip(breaker);
        }
        break;
    }

    this.breakers.set(id, breaker);
    return null;
  }

  private trip(breaker: CircuitBreaker): RiskVeto {
    breaker.state = 'open';
    breaker.tripCount += 1;
    breaker.lastTripped = Date.now();
    this.breakers.set(breaker.id, breaker);

    return {
      id: `veto-${Date.now()}-${breaker.id}`,
      timestamp: Date.now(),
      reason: `Circuit breaker tripped: ${breaker.description}`,
      severity: breaker.level === 'portfolio' ? 'emergency' : 'block',
      proposedAction: `Halt ${breaker.level}-level activity for ${breaker.targetId}`,
      vetoedBy: breaker.id,
      details: {
        breakerLevel: breaker.level,
        targetId: breaker.targetId,
        currentValue: breaker.currentValue,
        threshold: breaker.tripThreshold,
        tripCount: breaker.tripCount,
      },
    };
  }

  reset(id: string): void {
    const breaker = this.breakers.get(id);
    if (breaker) {
      breaker.state = 'closed';
      breaker.currentValue = 0;
      this.breakers.set(id, breaker);
    }
  }
}

// ===================== DRAWDOWN TRACKER =====================

class DrawdownTracker {
  private peakEquity: number;
  private currentEquity: number;
  private dailyStartEquity: number;
  private weeklyStartEquity: number;
  private dailyPnL: number = 0;
  private weeklyPnL: number = 0;
  private lastDailyReset: number;
  private lastWeeklyReset: number;
  private equityHistory: { timestamp: number; equity: number }[] = [];

  constructor(initialEquity: number) {
    this.peakEquity = initialEquity;
    this.currentEquity = initialEquity;
    this.dailyStartEquity = initialEquity;
    this.weeklyStartEquity = initialEquity;
    this.lastDailyReset = this.startOfDay();
    this.lastWeeklyReset = this.startOfWeek();
  }

  updateEquity(equity: number): void {
    const now = Date.now();
    if (this.startOfDay() > this.lastDailyReset) {
      this.dailyStartEquity = this.currentEquity;
      this.dailyPnL = 0;
      this.lastDailyReset = this.startOfDay();
    }
    if (this.startOfWeek() > this.lastWeeklyReset) {
      this.weeklyStartEquity = this.currentEquity;
      this.weeklyPnL = 0;
      this.lastWeeklyReset = this.startOfWeek();
    }

    this.currentEquity = equity;
    this.peakEquity = Math.max(this.peakEquity, equity);
    this.dailyPnL = equity - this.dailyStartEquity;
    this.weeklyPnL = equity - this.weeklyStartEquity;

    this.equityHistory.push({ timestamp: now, equity });
    if (this.equityHistory.length > 10000) this.equityHistory.shift();
  }

  getDrawdownFromPeak(): number {
    if (this.peakEquity === 0) return 0;
    return (this.peakEquity - this.currentEquity) / this.peakEquity;
  }

  getDailyDrawdown(): number {
    if (this.dailyStartEquity === 0) return 0;
    return Math.max(0, -this.dailyPnL / this.dailyStartEquity);
  }

  getWeeklyDrawdown(): number {
    if (this.weeklyStartEquity === 0) return 0;
    return Math.max(0, -this.weeklyPnL / this.weeklyStartEquity);
  }

  getDailyPnL(): number { return this.dailyPnL; }
  getDailyPnLPercent(): number {
    return this.dailyStartEquity > 0 ? this.dailyPnL / this.dailyStartEquity : 0;
  }
  getWeeklyPnL(): number { return this.weeklyPnL; }
  getWeeklyPnLPercent(): number {
    return this.weeklyStartEquity > 0 ? this.weeklyPnL / this.weeklyStartEquity : 0;
  }
  getPeakEquity(): number { return this.peakEquity; }
  getCurrentEquity(): number { return this.currentEquity; }
  getEquityHistory(): { timestamp: number; equity: number }[] {
    return this.equityHistory;
  }

  private startOfDay(): number {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  private startOfWeek(): number {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0); return d.getTime();
  }
}

// ===================== RISK GOVERNOR =====================

export class RiskGovernor extends EventEmitter {
  private circuitBreakers = new CircuitBreakerEngine();
  private drawdownTracker: DrawdownTracker;
  private limits: RiskLimits;
  private vetoes: RiskVeto[] = [];
  private openPositions: number = 0;
  private totalExposure: number = 0;
  private correlationRisk: number = 0;
  private currentRegime: MarketRegime = 'QUIET';
  private checkIntervalMs: number;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private isActive: boolean = false;

  constructor(config: {
    initialEquity?: number;
    limits?: Partial<RiskLimits>;
    checkIntervalMs?: number;
  } = {}) {
    super();
    this.drawdownTracker = new DrawdownTracker(config.initialEquity || 5000);
    this.limits = {
      maxDailyDrawdown: 0.05,
      maxWeeklyDrawdown: 0.10,
      maxSingleTradeRisk: 0.02,
      maxOpenPositions: 10,
      maxCorrelationExposure: 0.7,
      maxSectorExposure: 0.3,
      emergencyShutdownThreshold: 0.08,
      ...config.limits,
    };
    this.checkIntervalMs = config.checkIntervalMs || 5000;
    this.initializeCircuitBreakers();
  }

  // ===================== LIFECYCLE =====================

  start(): void {
    this.isActive = true;
    this.checkTimer = setInterval(() => {
      this.runRiskChecks();
    }, this.checkIntervalMs);
    this.emit('started');
  }

  stop(): void {
    this.isActive = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.emit('stopped');
  }

  // ===================== CIRCUIT BREAKERS =====================

  private initializeCircuitBreakers(): void {
    this.circuitBreakers.add({
      id: 'portfolio-daily-dd', level: 'portfolio', targetId: 'portfolio',
      state: 'closed', tripThreshold: this.limits.maxDailyDrawdown,
      resetThreshold: this.limits.maxDailyDrawdown * 0.5, currentValue: 0,
      tripCount: 0, lastTripped: null, cooldownMs: 3600000,
      description: `Daily drawdown exceeds ${(this.limits.maxDailyDrawdown * 100).toFixed(1)}%`,
    });

    this.circuitBreakers.add({
      id: 'portfolio-weekly-dd', level: 'portfolio', targetId: 'portfolio',
      state: 'closed', tripThreshold: this.limits.maxWeeklyDrawdown,
      resetThreshold: this.limits.maxWeeklyDrawdown * 0.5, currentValue: 0,
      tripCount: 0, lastTripped: null, cooldownMs: 14400000,
      description: `Weekly drawdown exceeds ${(this.limits.maxWeeklyDrawdown * 100).toFixed(1)}%`,
    });

    this.circuitBreakers.add({
      id: 'portfolio-emergency', level: 'portfolio', targetId: 'portfolio',
      state: 'closed', tripThreshold: this.limits.emergencyShutdownThreshold,
      resetThreshold: this.limits.emergencyShutdownThreshold * 0.3, currentValue: 0,
      tripCount: 0, lastTripped: null, cooldownMs: 86400000,
      description: `EMERGENCY: Drawdown from peak exceeds ${(this.limits.emergencyShutdownThreshold * 100).toFixed(1)}%`,
    });

    this.circuitBreakers.add({
      id: 'position-count', level: 'position', targetId: 'all-positions',
      state: 'closed', tripThreshold: this.limits.maxOpenPositions,
      resetThreshold: this.limits.maxOpenPositions * 0.7, currentValue: 0,
      tripCount: 0, lastTripped: null, cooldownMs: 300000,
      description: `Open positions exceed ${this.limits.maxOpenPositions}`,
    });

    this.circuitBreakers.add({
      id: 'strategy-correlation', level: 'strategy', targetId: 'all-strategies',
      state: 'closed', tripThreshold: this.limits.maxCorrelationExposure,
      resetThreshold: this.limits.maxCorrelationExposure * 0.6, currentValue: 0,
      tripCount: 0, lastTripped: null, cooldownMs: 600000,
      description: `Portfolio correlation risk exceeds ${(this.limits.maxCorrelationExposure * 100).toFixed(1)}%`,
    });

    this.circuitBreakers.add({
      id: 'strategy-single-trade', level: 'strategy', targetId: 'single-trade',
      state: 'closed', tripThreshold: this.limits.maxSingleTradeRisk,
      resetThreshold: this.limits.maxSingleTradeRisk * 0.5, currentValue: 0,
      tripCount: 0, lastTripped: null, cooldownMs: 60000,
      description: `Single trade risk exceeds ${(this.limits.maxSingleTradeRisk * 100).toFixed(1)}%`,
    });
  }

  // ===================== RISK CHECKS =====================

  private runRiskChecks(): void {
    const vetoes: RiskVeto[] = [];

    const v1 = this.circuitBreakers.update('portfolio-daily-dd', this.drawdownTracker.getDailyDrawdown());
    if (v1) vetoes.push(v1);
    const v2 = this.circuitBreakers.update('portfolio-weekly-dd', this.drawdownTracker.getWeeklyDrawdown());
    if (v2) vetoes.push(v2);
    const v3 = this.circuitBreakers.update('portfolio-emergency', this.drawdownTracker.getDrawdownFromPeak());
    if (v3) vetoes.push(v3);
    const v4 = this.circuitBreakers.update('position-count', this.openPositions);
    if (v4) vetoes.push(v4);
    const v5 = this.circuitBreakers.update('strategy-correlation', this.correlationRisk);
    if (v5) vetoes.push(v5);

    for (const veto of vetoes) {
      this.vetoes.push(veto);
      if (this.vetoes.length > 500) this.vetoes.shift();
      this.emit('veto', veto);
    }

    this.emit('risk:update', this.getRiskState());
  }

  // ===================== VETO EVALUATION =====================

  evaluateTrade(proposal: {
    strategyId: string;
    symbol: string;
    direction: 'buy' | 'sell';
    size: number;
    riskAmount: number;
    estimatedCorrelation?: number;
  }): RiskVeto | null {
    const equity = this.drawdownTracker.getCurrentEquity();

    const tradeRisk = equity > 0 ? proposal.riskAmount / equity : 1;
    if (tradeRisk > this.limits.maxSingleTradeRisk) {
      const veto: RiskVeto = {
        id: `veto-trade-${Date.now()}`,
        timestamp: Date.now(),
        reason: `Single trade risk ${(tradeRisk * 100).toFixed(2)}% exceeds limit ${(this.limits.maxSingleTradeRisk * 100).toFixed(1)}%`,
        severity: 'block',
        proposedAction: `Block ${proposal.direction} ${proposal.size} ${proposal.symbol}`,
        vetoedBy: 'strategy-single-trade',
        details: { ...proposal, tradeRisk },
      };
      this.vetoes.push(veto);
      this.emit('veto', veto);
      return veto;
    }

    const portfolioBreakers = this.circuitBreakers.getByLevel('portfolio');
    for (const breaker of portfolioBreakers) {
      if (breaker.state === 'open') {
        const veto: RiskVeto = {
          id: `veto-portfolio-${Date.now()}`,
          timestamp: Date.now(),
          reason: `Portfolio circuit breaker active: ${breaker.description}`,
          severity: 'emergency',
          proposedAction: `Block all new trades until breaker resets`,
          vetoedBy: breaker.id,
          details: { breaker, proposal },
        };
        this.vetoes.push(veto);
        this.emit('veto', veto);
        return veto;
      }
    }

    if (this.openPositions >= this.limits.maxOpenPositions) {
      const veto: RiskVeto = {
        id: `veto-positions-${Date.now()}`,
        timestamp: Date.now(),
        reason: `Max open positions (${this.limits.maxOpenPositions}) reached`,
        severity: 'block',
        proposedAction: `Block new position until existing position closes`,
        vetoedBy: 'position-count',
        details: { openPositions: this.openPositions, proposal },
      };
      this.vetoes.push(veto);
      this.emit('veto', veto);
      return veto;
    }

    return null;
  }

  // ===================== STATE UPDATES =====================

  updateEquity(equity: number): void { this.drawdownTracker.updateEquity(equity); }
  setOpenPositions(count: number): void { this.openPositions = count; }
  setTotalExposure(exposure: number): void { this.totalExposure = exposure; }
  setCorrelationRisk(risk: number): void { this.correlationRisk = risk; }
  setRegime(regime: MarketRegime): void { this.currentRegime = regime; }

  // ===================== GETTERS =====================

  getRiskState(): RiskState {
    return {
      dailyPnL: this.drawdownTracker.getDailyPnL(),
      dailyPnLPercent: this.drawdownTracker.getDailyPnLPercent(),
      weeklyPnL: this.drawdownTracker.getWeeklyPnL(),
      weeklyPnLPercent: this.drawdownTracker.getWeeklyPnLPercent(),
      openPositions: this.openPositions,
      maxOpenPositions: this.limits.maxOpenPositions,
      totalExposure: this.totalExposure,
      maxExposure: this.drawdownTracker.getCurrentEquity(),
      correlationRisk: this.correlationRisk,
      activeCircuitBreakers: this.circuitBreakers.getAll(),
      recentVetoes: this.vetoes.slice(-20),
      drawdownFromPeak: this.drawdownTracker.getDrawdownFromPeak(),
      peakEquity: this.drawdownTracker.getPeakEquity(),
      currentEquity: this.drawdownTracker.getCurrentEquity(),
    };
  }

  getLimits(): RiskLimits { return { ...this.limits }; }
  getVetoes(): RiskVeto[] { return this.vetoes; }
  getCircuitBreakers(): CircuitBreaker[] { return this.circuitBreakers.getAll(); }
  getEquityHistory(): { timestamp: number; equity: number }[] {
    return this.drawdownTracker.getEquityHistory();
  }
  isAnyBreakerOpen(): boolean {
    return this.circuitBreakers.getAll().some(b => b.state === 'open');
  }
  resetBreaker(id: string): void {
    this.circuitBreakers.reset(id);
    this.emit('breaker:reset', { id });
  }
}

export { DrawdownTracker };
