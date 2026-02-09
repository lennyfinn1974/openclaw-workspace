import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import {
  ManagedStrategy,
  StrategyDNA,
  StrategyPerformance,
  StrategyTransition,
  LifecycleStage,
  StrategyCreator,
  BehavioralVector,
  ArenaBotTradeEvent,
} from '../types';
import { StateStore } from '../utils/StateStore';

// Capital allocation limits by stage
const CAPITAL_LIMITS: Record<LifecycleStage, number> = {
  BIRTH: 0,
  PAPER_TRADING: 0,
  INCUBATION: 0.02,
  GROWTH: 0.08,
  MATURITY: 0.15,
  DECAY: 0, // dynamically set to half of current
  RETIRED: 0,
};

// Rolling window sizes
const PNL_HISTORY_LIMIT = 500;
const EQUITY_CURVE_LIMIT = 500;
const RECENT_SHARPE_WINDOW = 100;

function emptyPerformance(): StrategyPerformance {
  return {
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    winRate: 0,
    peakWinRate: 0,
    tradeCount: 0,
    recentSharpe100: 0,
    profitFactor: 0,
    pnlHistory: [],
    equityCurve: [0],
  };
}

function emptyBehavior(): BehavioralVector {
  return {
    avgHoldingPeriod: 0,
    tradeFrequency: 0,
    directionBias: 0,
    regimePreference: [0, 0, 0, 0, 0, 0],
    entryPatternCluster: 0,
    volatilityAffinity: 0,
  };
}

export class StrategyLifecycle extends EventEmitter {
  private store: StateStore;
  private strategies: Map<string, ManagedStrategy> = new Map();
  private transitionLog: StrategyTransition[] = [];
  private generation = 0;

  constructor(store: StateStore) {
    super();
    this.store = store;
  }

  initialize(): void {
    const saved = this.store.getStrategies();
    for (const s of saved) {
      this.strategies.set(s.id, s);
    }
    this.generation = this.store.getGeneration();
    console.log(`[Lifecycle] Initialized with ${this.strategies.size} strategies, generation ${this.generation}`);
  }

  addStrategy(dna: StrategyDNA, createdBy: StrategyCreator, parentIds: string[] = []): ManagedStrategy {
    const strategy: ManagedStrategy = {
      id: uuid(),
      dna,
      stage: 'BIRTH',
      birthGeneration: this.generation,
      tradeCount: 0,
      metrics: emptyPerformance(),
      capitalAllocation: 0,
      noveltyScore: 0,
      behavioralFingerprint: emptyBehavior(),
      createdBy,
      parentIds,
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };

    // Immediately transition to PAPER_TRADING
    strategy.stage = 'PAPER_TRADING';

    this.strategies.set(strategy.id, strategy);
    this.persist();
    this.emit('strategy:added', strategy);

    console.log(`[Lifecycle] New strategy ${strategy.id.slice(0, 8)} (${createdBy}) → PAPER_TRADING`);
    return strategy;
  }

  recordTrade(strategyId: string, trade: ArenaBotTradeEvent): void {
    const strategy = this.strategies.get(strategyId);
    if (!strategy || strategy.stage === 'RETIRED') return;

    const m = strategy.metrics;
    m.tradeCount++;
    strategy.tradeCount++;

    // Update P&L history
    m.pnlHistory.push(trade.pnl);
    if (m.pnlHistory.length > PNL_HISTORY_LIMIT) m.pnlHistory.shift();

    // Update equity curve
    const lastEquity = m.equityCurve[m.equityCurve.length - 1] || 0;
    m.equityCurve.push(lastEquity + trade.pnl);
    if (m.equityCurve.length > EQUITY_CURVE_LIMIT) m.equityCurve.shift();

    // Recalculate metrics
    this.recalculateMetrics(strategy);
    strategy.lastUpdatedAt = Date.now();

    // Check for transitions
    const transition = this.checkTransition(strategy);
    if (transition) {
      this.applyTransition(strategy, transition);
    }

    this.persist();
  }

  private recalculateMetrics(strategy: ManagedStrategy): void {
    const m = strategy.metrics;
    const pnls = m.pnlHistory;

    if (pnls.length === 0) return;

    // Total return
    m.totalReturn = pnls.reduce((sum, p) => sum + p, 0);

    // Win rate
    const wins = pnls.filter(p => p > 0).length;
    m.winRate = pnls.length > 0 ? wins / pnls.length : 0;
    m.peakWinRate = Math.max(m.peakWinRate, m.winRate);

    // Profit factor
    const grossProfit = pnls.filter(p => p > 0).reduce((s, p) => s + p, 0);
    const grossLoss = Math.abs(pnls.filter(p => p < 0).reduce((s, p) => s + p, 0));
    m.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    // Sharpe ratio (annualized approximation)
    const mean = pnls.reduce((s, p) => s + p, 0) / pnls.length;
    const variance = pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    m.sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

    // Recent Sharpe (last 100 trades)
    const recent = pnls.slice(-RECENT_SHARPE_WINDOW);
    if (recent.length >= 20) {
      const rMean = recent.reduce((s, p) => s + p, 0) / recent.length;
      const rVar = recent.reduce((s, p) => s + (p - rMean) ** 2, 0) / recent.length;
      const rStd = Math.sqrt(rVar);
      m.recentSharpe100 = rStd > 0 ? (rMean / rStd) * Math.sqrt(252) : 0;
    }

    // Max drawdown from equity curve
    const curve = m.equityCurve;
    let peak = curve[0];
    let maxDD = 0;
    for (const val of curve) {
      if (val > peak) peak = val;
      const dd = (peak - val) / Math.max(Math.abs(peak), 1);
      if (dd > maxDD) maxDD = dd;
    }
    m.maxDrawdown = maxDD;
  }

  private checkTransition(strategy: ManagedStrategy): StrategyTransition | null {
    const m = strategy.metrics;
    const stage = strategy.stage;

    switch (stage) {
      case 'PAPER_TRADING': {
        if (m.tradeCount >= 50) {
          if (m.profitFactor >= 1.0) {
            return { strategyId: strategy.id, from: stage, to: 'INCUBATION', reason: `Profitable after 50 trades (PF=${m.profitFactor.toFixed(2)})`, timestamp: Date.now() };
          } else if (m.profitFactor < 0.7) {
            return { strategyId: strategy.id, from: stage, to: 'RETIRED', reason: `Unprofitable paper trading (PF=${m.profitFactor.toFixed(2)})`, timestamp: Date.now() };
          }
        }
        break;
      }

      case 'INCUBATION': {
        if (m.tradeCount >= 200) {
          if (m.sharpeRatio > 0.5) {
            return { strategyId: strategy.id, from: stage, to: 'GROWTH', reason: `Strong Sharpe after incubation (${m.sharpeRatio.toFixed(2)})`, timestamp: Date.now() };
          } else if (m.sharpeRatio < 0) {
            return { strategyId: strategy.id, from: stage, to: 'RETIRED', reason: `Negative Sharpe after incubation (${m.sharpeRatio.toFixed(2)})`, timestamp: Date.now() };
          }
        }
        break;
      }

      case 'GROWTH': {
        if (m.tradeCount >= 500 && m.sharpeRatio > 0.3) {
          return { strategyId: strategy.id, from: stage, to: 'MATURITY', reason: `Sustained performance (Sharpe=${m.sharpeRatio.toFixed(2)}, trades=${m.tradeCount})`, timestamp: Date.now() };
        }
        // Check for decay: Sharpe < 0 for recent 100 trades
        if (m.recentSharpe100 < 0 && m.tradeCount >= 100) {
          return { strategyId: strategy.id, from: stage, to: 'DECAY', reason: `Recent Sharpe collapsed (${m.recentSharpe100.toFixed(2)})`, timestamp: Date.now() };
        }
        break;
      }

      case 'MATURITY': {
        // Win rate dropped >15% from peak
        if (m.peakWinRate > 0 && (m.peakWinRate - m.winRate) > 0.15) {
          return { strategyId: strategy.id, from: stage, to: 'DECAY', reason: `Win rate decay: ${(m.peakWinRate * 100).toFixed(1)}% → ${(m.winRate * 100).toFixed(1)}%`, timestamp: Date.now() };
        }
        // Recent Sharpe collapse
        if (m.recentSharpe100 < 0 && m.tradeCount >= 100) {
          return { strategyId: strategy.id, from: stage, to: 'DECAY', reason: `Recent Sharpe collapsed (${m.recentSharpe100.toFixed(2)})`, timestamp: Date.now() };
        }
        break;
      }

      case 'DECAY': {
        // 200-trade review window
        const recentPnls = m.pnlHistory.slice(-200);
        if (recentPnls.length >= 200) {
          const recentMean = recentPnls.reduce((s, p) => s + p, 0) / recentPnls.length;
          const recentVar = recentPnls.reduce((s, p) => s + (p - recentMean) ** 2, 0) / recentPnls.length;
          const recentStd = Math.sqrt(recentVar);
          const recentSharpe = recentStd > 0 ? (recentMean / recentStd) * Math.sqrt(252) : 0;

          if (recentSharpe > 0.3) {
            return { strategyId: strategy.id, from: stage, to: 'GROWTH', reason: `Recovery in decay review (Sharpe=${recentSharpe.toFixed(2)})`, timestamp: Date.now() };
          } else {
            return { strategyId: strategy.id, from: stage, to: 'RETIRED', reason: `No recovery after 200-trade review`, timestamp: Date.now() };
          }
        }
        break;
      }
    }

    return null;
  }

  private applyTransition(strategy: ManagedStrategy, transition: StrategyTransition): void {
    const oldStage = strategy.stage;
    strategy.stage = transition.to;
    strategy.lastUpdatedAt = Date.now();

    // Update capital allocation
    if (transition.to === 'DECAY') {
      strategy.capitalAllocation = strategy.capitalAllocation * 0.5;
    } else if (transition.to === 'RETIRED') {
      strategy.capitalAllocation = 0;
      strategy.retiredReason = transition.reason;
      // Move to archive
      this.store.addToArchive({ ...strategy });
    } else {
      strategy.capitalAllocation = CAPITAL_LIMITS[transition.to];
    }

    this.transitionLog.push(transition);

    const eventType = this.isPromotion(oldStage, transition.to) ? 'strategy:promoted' :
                      transition.to === 'RETIRED' ? 'strategy:retired' : 'strategy:demoted';
    this.emit(eventType, { strategy, transition });
    this.emit('allocation:changed', this.getAllocationMap());

    console.log(`[Lifecycle] ${strategy.id.slice(0, 8)}: ${oldStage} → ${transition.to} (${transition.reason})`);
  }

  private isPromotion(from: LifecycleStage, to: LifecycleStage): boolean {
    const order: LifecycleStage[] = ['BIRTH', 'PAPER_TRADING', 'INCUBATION', 'GROWTH', 'MATURITY'];
    return order.indexOf(to) > order.indexOf(from);
  }

  evaluateTransitions(): StrategyTransition[] {
    const transitions: StrategyTransition[] = [];
    for (const strategy of this.strategies.values()) {
      if (strategy.stage === 'RETIRED') continue;
      const t = this.checkTransition(strategy);
      if (t) {
        this.applyTransition(strategy, t);
        transitions.push(t);
      }
    }
    if (transitions.length > 0) this.persist();
    return transitions;
  }

  retire(strategyId: string, reason: string): void {
    const strategy = this.strategies.get(strategyId);
    if (!strategy || strategy.stage === 'RETIRED') return;

    const transition: StrategyTransition = {
      strategyId,
      from: strategy.stage,
      to: 'RETIRED',
      reason,
      timestamp: Date.now(),
    };
    this.applyTransition(strategy, transition);
    this.persist();
  }

  resurrect(strategyId: string): ManagedStrategy | null {
    const archived = this.store.getArchive().find(s => s.id === strategyId);
    if (!archived) return null;

    const resurrected: ManagedStrategy = {
      ...archived,
      stage: 'PAPER_TRADING',
      capitalAllocation: 0,
      retiredReason: undefined,
      createdBy: 'resurrection',
      metrics: emptyPerformance(),
      lastUpdatedAt: Date.now(),
    };

    this.strategies.set(resurrected.id, resurrected);
    this.persist();
    this.emit('strategy:resurrected', resurrected);

    console.log(`[Lifecycle] Resurrected ${strategyId.slice(0, 8)} → PAPER_TRADING`);
    return resurrected;
  }

  getStrategy(id: string): ManagedStrategy | undefined {
    return this.strategies.get(id);
  }

  getActiveStrategies(): ManagedStrategy[] {
    return Array.from(this.strategies.values()).filter(s => s.stage !== 'RETIRED');
  }

  getRetiredArchive(): ManagedStrategy[] {
    return this.store.getArchive();
  }

  getAllStrategies(): ManagedStrategy[] {
    return Array.from(this.strategies.values());
  }

  getAllocationMap(): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of this.strategies.values()) {
      if (s.capitalAllocation > 0) {
        map.set(s.id, s.capitalAllocation);
      }
    }
    return map;
  }

  getTransitionLog(): StrategyTransition[] {
    return [...this.transitionLog];
  }

  setGeneration(gen: number): void {
    this.generation = gen;
    this.store.setGeneration(gen);
  }

  getGeneration(): number {
    return this.generation;
  }

  updateNoveltyScore(strategyId: string, score: number): void {
    const s = this.strategies.get(strategyId);
    if (s) {
      s.noveltyScore = score;
      s.lastUpdatedAt = Date.now();
    }
  }

  updateBehavior(strategyId: string, behavior: BehavioralVector): void {
    const s = this.strategies.get(strategyId);
    if (s) {
      s.behavioralFingerprint = behavior;
      s.lastUpdatedAt = Date.now();
    }
  }

  getPopulationSize(): number {
    return this.getActiveStrategies().length;
  }

  private persist(): void {
    this.store.setStrategies(Array.from(this.strategies.values()));
    this.store.markDirty();
  }
}
