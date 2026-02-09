/**
 * Strategy Validation Pipeline
 * Layer 3: Strategy Synthesis
 *
 * Every synthesized strategy must pass a validation gauntlet:
 * 1. Structural Validation — well-formed, generates trades, reasonable frequency
 * 2. Walk-Forward Backtest — chronological split, anti-overfitting
 * 3. Regime Stress Test — profitable in >= 2 regimes, no catastrophic loss
 * 4. Paper Trading Gate — zero-capital burn-in tracking
 *
 * Phase 1: ANALYSIS ONLY — no strategies receive real capital.
 */

import { EventEmitter } from 'events';
import {
  ValidationResult, ValidationStage, WalkForwardResult, WalkForwardFold,
  RegimeStressResult, StrategyNode, StrategyLifecycle, StrategyMetrics
} from '../types/synthesis';
import { ObservationEvent, IndicatorSnapshot, MarketRegime } from '../types/core';
import { ExpressionTree } from './ExpressionTree';

// ===================== VALIDATION CONFIG =====================

interface ValidatorConfig {
  minTradeCount: number;           // minimum trades to be valid
  maxTradeCount: number;           // maximum trades per day
  walkForwardFolds: number;        // number of chronological folds
  minProfitableFolds: number;      // folds that must be profitable
  maxRegimeLoss: number;           // max loss allowed in any single regime
  minProfitableRegimes: number;    // regimes that must be profitable
  paperTradingHours: number;       // burn-in period
  degradationThreshold: number;    // min out-of-sample / in-sample ratio
}

const DEFAULT_CONFIG: ValidatorConfig = {
  minTradeCount: 5,
  maxTradeCount: 50,
  walkForwardFolds: 5,
  minProfitableFolds: 3,
  maxRegimeLoss: 0.05,
  minProfitableRegimes: 2,
  paperTradingHours: 24,
  degradationThreshold: 0.5,
};

const REGIMES: MarketRegime[] = ['TRENDING', 'RANGING', 'VOLATILE', 'BREAKOUT', 'EVENT', 'QUIET'];

// ===================== STRATEGY VALIDATOR =====================

export class StrategyValidator extends EventEmitter {
  private config: ValidatorConfig;
  private treeEngine: ExpressionTree;
  private validationHistory: Map<string, ValidationResult[]> = new Map();
  private lifecycles: Map<string, StrategyLifecycle> = new Map();
  private paperTradingActive: Map<string, PaperTradingState> = new Map();

  constructor(config: Partial<ValidatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.treeEngine = new ExpressionTree();
  }

  // ===================== FULL VALIDATION PIPELINE =====================

  /**
   * Run full validation pipeline on a strategy.
   * Returns final result with pass/fail and all stage details.
   */
  async validateStrategy(
    strategyId: string,
    tree: StrategyNode,
    historicalData: ObservationEvent[]
  ): Promise<{ passed: boolean; results: ValidationResult[] }> {
    const results: ValidationResult[] = [];

    // Stage 1: Structural Validation
    const structuralResult = this.validateStructure(strategyId, tree, historicalData);
    results.push(structuralResult);
    if (!structuralResult.passed) {
      this.emit('validation:failed', { strategyId, stage: 'structural', reason: structuralResult.details });
      return { passed: false, results };
    }

    // Stage 2: Walk-Forward Backtest
    const walkForwardResult = this.walkForwardTest(strategyId, tree, historicalData);
    results.push(walkForwardResult);
    if (!walkForwardResult.passed) {
      this.emit('validation:failed', { strategyId, stage: 'walk_forward', reason: walkForwardResult.details });
      return { passed: false, results };
    }

    // Stage 3: Regime Stress Test
    const regimeResult = this.regimeStressTest(strategyId, tree, historicalData);
    results.push(regimeResult);
    if (!regimeResult.passed) {
      this.emit('validation:failed', { strategyId, stage: 'regime_stress', reason: regimeResult.details });
      return { passed: false, results };
    }

    // Stage 4: Approved for paper trading
    const approvalResult: ValidationResult = {
      strategyId,
      stage: 'approved',
      passed: true,
      score: this.calculateOverallScore(results),
      details: { message: 'Strategy passed all validation stages' },
      testedAt: Date.now(),
    };
    results.push(approvalResult);

    // Initialize lifecycle tracking
    this.initializeLifecycle(strategyId, results);

    // Start paper trading tracking
    this.startPaperTrading(strategyId, tree);

    this.validationHistory.set(strategyId, results);
    this.emit('validation:complete', { strategyId, passed: true, score: approvalResult.score });

    return { passed: true, results };
  }

  // ===================== STAGE 1: STRUCTURAL VALIDATION =====================

  private validateStructure(
    strategyId: string,
    tree: StrategyNode,
    data: ObservationEvent[]
  ): ValidationResult {
    const issues: string[] = [];

    // Check tree validity
    if (!this.treeEngine.isValid(tree)) {
      issues.push('Tree structure is invalid');
    }

    // Check depth and complexity
    const depth = this.treeEngine.getDepth(tree);
    const nodeCount = this.treeEngine.countNodes(tree);
    if (depth > 7) issues.push(`Tree too deep: ${depth} > 7`);
    if (nodeCount > 63) issues.push(`Too many nodes: ${nodeCount} > 63`);

    // Check it generates trades (not always-hold)
    const sampleTrades = this.countGeneratedTrades(tree, data.slice(0, 100));
    if (sampleTrades < this.config.minTradeCount) {
      issues.push(`Too few trades: ${sampleTrades} < ${this.config.minTradeCount}`);
    }

    // Check trade frequency is reasonable
    const hoursSpan = data.length > 1
      ? (data[data.length - 1].timestamp - data[0].timestamp) / (1000 * 60 * 60)
      : 1;
    const dailyRate = (sampleTrades / Math.max(hoursSpan, 1)) * 24;
    if (dailyRate > this.config.maxTradeCount) {
      issues.push(`Too many trades per day: ${dailyRate.toFixed(0)} > ${this.config.maxTradeCount}`);
    }

    // Check tree has both entry and exit logic
    const hasAction = this.treeEngine.getAllNodes(tree).some(n => n.type === 'action');
    if (!hasAction) issues.push('No action nodes found in tree');

    const passed = issues.length === 0;
    return {
      strategyId,
      stage: 'structural',
      passed,
      score: passed ? 1.0 : 0,
      details: {
        issues,
        depth,
        nodeCount,
        sampleTrades,
        dailyRate: dailyRate.toFixed(1),
      },
      testedAt: Date.now(),
    };
  }

  private countGeneratedTrades(tree: StrategyNode, data: ObservationEvent[]): number {
    let trades = 0;
    let lastAction = 'HOLD';

    for (const event of data) {
      const indicators: IndicatorSnapshot = event.enrichmentMetadata?.indicators || {
        rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
        volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
      };
      const regime: MarketRegime = (event as any).enrichment?.marketRegime || 'RANGING';

      const result = this.treeEngine.evaluate(tree, indicators, regime);
      if (result.action !== lastAction && result.action !== 'HOLD') {
        trades++;
        lastAction = result.action;
      }
    }

    return trades;
  }

  // ===================== STAGE 2: WALK-FORWARD BACKTEST =====================

  private walkForwardTest(
    strategyId: string,
    tree: StrategyNode,
    data: ObservationEvent[]
  ): ValidationResult {
    const numFolds = this.config.walkForwardFolds;
    const foldSize = Math.floor(data.length / numFolds);

    if (foldSize < 20) {
      return {
        strategyId,
        stage: 'walk_forward',
        passed: false,
        score: 0,
        details: { reason: 'Insufficient data for walk-forward test' },
        testedAt: Date.now(),
      };
    }

    const folds: WalkForwardFold[] = [];
    let profitableFolds = 0;

    for (let i = 0; i < numFolds - 1; i++) {
      const trainStart = 0;
      const trainEnd = (i + 1) * foldSize;
      const testStart = trainEnd;
      const testEnd = Math.min(testStart + foldSize, data.length);

      const trainData = data.slice(trainStart, trainEnd);
      const testData = data.slice(testStart, testEnd);

      const inSampleReturn = this.simulateReturn(tree, trainData);
      const outOfSampleReturn = this.simulateReturn(tree, testData);
      const inSampleSharpe = this.simulateSharpe(tree, trainData);
      const outOfSampleSharpe = this.simulateSharpe(tree, testData);
      const tradeCount = this.countGeneratedTrades(tree, testData);

      if (outOfSampleReturn > 0) profitableFolds++;

      folds.push({
        foldIndex: i,
        trainStart: trainData[0]?.timestamp || 0,
        trainEnd: trainData[trainData.length - 1]?.timestamp || 0,
        testStart: testData[0]?.timestamp || 0,
        testEnd: testData[testData.length - 1]?.timestamp || 0,
        inSampleReturn,
        outOfSampleReturn,
        inSampleSharpe,
        outOfSampleSharpe,
        tradeCount,
      });
    }

    const avgInSample = folds.reduce((s, f) => s + f.inSampleReturn, 0) / folds.length;
    const avgOutOfSample = folds.reduce((s, f) => s + f.outOfSampleReturn, 0) / folds.length;
    const degradationRatio = avgInSample !== 0 ? avgOutOfSample / avgInSample : 0;

    const passed = profitableFolds >= this.config.minProfitableFolds &&
      degradationRatio >= this.config.degradationThreshold;

    const walkForwardResult: WalkForwardResult = {
      folds,
      avgInSampleReturn: avgInSample,
      avgOutOfSampleReturn: avgOutOfSample,
      degradationRatio,
      profitableFolds,
      totalFolds: numFolds - 1,
      passed,
    };

    return {
      strategyId,
      stage: 'walk_forward',
      passed,
      score: passed ? Math.min(1, degradationRatio) : 0,
      details: walkForwardResult as unknown as Record<string, unknown>,
      testedAt: Date.now(),
    };
  }

  // ===================== STAGE 3: REGIME STRESS TEST =====================

  private regimeStressTest(
    strategyId: string,
    tree: StrategyNode,
    data: ObservationEvent[]
  ): ValidationResult {
    const regimeResults: Record<string, {
      return: number;
      maxDrawdown: number;
      tradeCount: number;
      winRate: number;
      passed: boolean;
    }> = {};

    let maxLossInAnyRegime = 0;
    let profitableRegimes = 0;

    for (const regime of REGIMES) {
      const regimeData = data.filter(e => {
        const r = (e as any).enrichment?.marketRegime || e.enrichmentMetadata?.indicators?.trendStrength;
        return r === regime;
      });

      if (regimeData.length < 5) {
        regimeResults[regime] = {
          return: 0, maxDrawdown: 0, tradeCount: 0, winRate: 0, passed: true,
        };
        continue;
      }

      const ret = this.simulateReturn(tree, regimeData);
      const trades = this.simulateTradesDetailed(tree, regimeData);
      const wins = trades.filter(t => t > 0).length;
      const maxDD = this.calculateMaxDrawdown(trades);

      const passed = ret > -this.config.maxRegimeLoss;
      if (ret > 0) profitableRegimes++;
      if (ret < 0) maxLossInAnyRegime = Math.max(maxLossInAnyRegime, Math.abs(ret));

      regimeResults[regime] = {
        return: ret,
        maxDrawdown: maxDD,
        tradeCount: trades.length,
        winRate: trades.length > 0 ? wins / trades.length : 0,
        passed,
      };
    }

    const overallPassed = maxLossInAnyRegime <= this.config.maxRegimeLoss &&
      profitableRegimes >= this.config.minProfitableRegimes;

    const stressResult: RegimeStressResult = {
      regimeResults,
      maxLossInAnyRegime,
      profitableRegimes,
      passed: overallPassed,
    };

    return {
      strategyId,
      stage: 'regime_stress',
      passed: overallPassed,
      score: overallPassed ? profitableRegimes / REGIMES.length : 0,
      details: stressResult as unknown as Record<string, unknown>,
      testedAt: Date.now(),
    };
  }

  // ===================== PAPER TRADING =====================

  private startPaperTrading(strategyId: string, tree: StrategyNode): void {
    this.paperTradingActive.set(strategyId, {
      strategyId,
      tree,
      startTime: Date.now(),
      virtualEquity: 10000,
      peakEquity: 10000,
      trades: [],
      position: 'flat',
      entryPrice: 0,
    });
  }

  /**
   * Process a new market event through all paper-trading strategies.
   */
  processPaperTrade(event: ObservationEvent): void {
    for (const [strategyId, state] of this.paperTradingActive) {
      const indicators: IndicatorSnapshot = event.enrichmentMetadata?.indicators || {
        rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
        volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
      };
      const regime: MarketRegime = (event as any).enrichment?.marketRegime || 'RANGING';
      const price = (event.payload as any).price || 0;

      const signal = this.treeEngine.evaluate(state.tree, indicators, regime);

      if (signal.action === 'BUY' && state.position !== 'long') {
        if (state.position === 'short') {
          const pnl = state.entryPrice - price;
          state.virtualEquity += pnl;
          state.trades.push(pnl);
        }
        state.position = 'long';
        state.entryPrice = price;
      } else if (signal.action === 'SELL' && state.position !== 'short') {
        if (state.position === 'long') {
          const pnl = price - state.entryPrice;
          state.virtualEquity += pnl;
          state.trades.push(pnl);
        }
        state.position = 'short';
        state.entryPrice = price;
      } else if (signal.action === 'CLOSE' && state.position !== 'flat') {
        const pnl = state.position === 'long'
          ? price - state.entryPrice
          : state.entryPrice - price;
        state.virtualEquity += pnl;
        state.trades.push(pnl);
        state.position = 'flat';
      }

      state.peakEquity = Math.max(state.peakEquity, state.virtualEquity);
    }
  }

  /**
   * Get paper trading results for a strategy.
   */
  getPaperTradingResults(strategyId: string): PaperTradingResult | null {
    const state = this.paperTradingActive.get(strategyId);
    if (!state) return null;

    const elapsed = (Date.now() - state.startTime) / (1000 * 60 * 60); // hours
    const maxDD = state.peakEquity > 0
      ? (state.peakEquity - state.virtualEquity) / state.peakEquity
      : 0;

    return {
      strategyId,
      elapsedHours: elapsed,
      virtualEquity: state.virtualEquity,
      totalReturn: (state.virtualEquity - 10000) / 10000,
      maxDrawdown: maxDD,
      tradeCount: state.trades.length,
      winRate: state.trades.length > 0
        ? state.trades.filter(t => t > 0).length / state.trades.length
        : 0,
      ready: elapsed >= this.config.paperTradingHours,
    };
  }

  // ===================== SIMULATION HELPERS =====================

  private simulateReturn(tree: StrategyNode, data: ObservationEvent[]): number {
    let equity = 10000;
    let position: 'long' | 'short' | 'flat' = 'flat';
    let entryPrice = 0;

    for (const event of data) {
      const price = (event.payload as any).price || 0;
      if (!price) continue;

      const indicators: IndicatorSnapshot = event.enrichmentMetadata?.indicators || {
        rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
        volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
      };
      const regime: MarketRegime = (event as any).enrichment?.marketRegime || 'RANGING';
      const signal = this.treeEngine.evaluate(tree, indicators, regime);

      if (signal.action === 'BUY' && position !== 'long') {
        if (position === 'short') equity += entryPrice - price;
        position = 'long';
        entryPrice = price;
      } else if (signal.action === 'SELL' && position !== 'short') {
        if (position === 'long') equity += price - entryPrice;
        position = 'short';
        entryPrice = price;
      } else if (signal.action === 'CLOSE' && position !== 'flat') {
        if (position === 'long') equity += price - entryPrice;
        else if (position === 'short') equity += entryPrice - price;
        position = 'flat';
      }
    }

    return (equity - 10000) / 10000;
  }

  private simulateSharpe(tree: StrategyNode, data: ObservationEvent[]): number {
    const trades = this.simulateTradesDetailed(tree, data);
    if (trades.length < 2) return 0;
    const mean = trades.reduce((a, b) => a + b, 0) / trades.length;
    const variance = trades.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / trades.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
  }

  private simulateTradesDetailed(tree: StrategyNode, data: ObservationEvent[]): number[] {
    const trades: number[] = [];
    let position: 'long' | 'short' | 'flat' = 'flat';
    let entryPrice = 0;

    for (const event of data) {
      const price = (event.payload as any).price || 0;
      if (!price) continue;

      const indicators: IndicatorSnapshot = event.enrichmentMetadata?.indicators || {
        rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
        volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
      };
      const regime: MarketRegime = (event as any).enrichment?.marketRegime || 'RANGING';
      const signal = this.treeEngine.evaluate(tree, indicators, regime);

      if (signal.action === 'BUY' && position !== 'long') {
        if (position === 'short') trades.push(entryPrice - price);
        position = 'long';
        entryPrice = price;
      } else if (signal.action === 'SELL' && position !== 'short') {
        if (position === 'long') trades.push(price - entryPrice);
        position = 'short';
        entryPrice = price;
      } else if (signal.action === 'CLOSE' && position !== 'flat') {
        if (position === 'long') trades.push(price - entryPrice);
        else if (position === 'short') trades.push(entryPrice - price);
        position = 'flat';
      }
    }

    return trades;
  }

  private calculateMaxDrawdown(trades: number[]): number {
    let equity = 0;
    let peak = 0;
    let maxDD = 0;

    for (const t of trades) {
      equity += t;
      peak = Math.max(peak, equity);
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      maxDD = Math.max(maxDD, dd);
    }

    return maxDD;
  }

  private calculateOverallScore(results: ValidationResult[]): number {
    return results.reduce((sum, r) => sum + r.score, 0) / Math.max(results.length, 1);
  }

  private initializeLifecycle(strategyId: string, results: ValidationResult[]): void {
    this.lifecycles.set(strategyId, {
      strategyId,
      stage: 'paper_trading',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      promotionHistory: [{
        from: 'birth',
        to: 'paper_trading',
        at: Date.now(),
        reason: 'Passed all validation stages',
      }],
      currentAllocation: 0, // Phase 1: no capital
      lifetimeReturn: 0,
      validationResults: results,
    });
  }

  // ===================== PUBLIC API =====================

  getValidationHistory(strategyId: string): ValidationResult[] {
    return this.validationHistory.get(strategyId) || [];
  }

  getLifecycle(strategyId: string): StrategyLifecycle | undefined {
    return this.lifecycles.get(strategyId);
  }

  getAllLifecycles(): StrategyLifecycle[] {
    return [...this.lifecycles.values()];
  }

  getActivePaperTrading(): string[] {
    return [...this.paperTradingActive.keys()];
  }

  getStats(): {
    totalValidated: number;
    totalApproved: number;
    totalRejected: number;
    activePaperTrading: number;
  } {
    let approved = 0;
    let rejected = 0;

    for (const results of this.validationHistory.values()) {
      const final = results[results.length - 1];
      if (final?.stage === 'approved') approved++;
      else rejected++;
    }

    return {
      totalValidated: this.validationHistory.size,
      totalApproved: approved,
      totalRejected: rejected,
      activePaperTrading: this.paperTradingActive.size,
    };
  }
}

// ===================== INTERNAL TYPES =====================

interface PaperTradingState {
  strategyId: string;
  tree: StrategyNode;
  startTime: number;
  virtualEquity: number;
  peakEquity: number;
  trades: number[];
  position: 'long' | 'short' | 'flat';
  entryPrice: number;
}

interface PaperTradingResult {
  strategyId: string;
  elapsedHours: number;
  virtualEquity: number;
  totalReturn: number;
  maxDrawdown: number;
  tradeCount: number;
  winRate: number;
  ready: boolean;
}

export default StrategyValidator;
