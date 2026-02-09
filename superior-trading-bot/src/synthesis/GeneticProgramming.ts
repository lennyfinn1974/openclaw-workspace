/**
 * Genetic Programming Engine - Strategy Evolution via Expression Trees
 * Layer 3: Strategy Synthesis
 *
 * Evolves trading strategy STRUCTURES (not just parameters) through
 * tournament selection, crossover, and mutation of expression trees.
 * Uses parsimony pressure to prevent bloat.
 */

import { EventEmitter } from 'events';
import {
  GPConfig, GPIndividual, GPPopulationStats, StrategyMetrics,
  StrategyNode, TreeEvalResult, ActionType
} from '../types/synthesis';
import { IndicatorSnapshot, MarketRegime, TradeEvent, ObservationEvent } from '../types/core';
import { ExpressionTree } from './ExpressionTree';

// ===================== DEFAULT CONFIG =====================

const DEFAULT_GP_CONFIG: GPConfig = {
  populationSize: 100,
  maxGenerations: 500,
  tournamentSize: 5,
  elitismCount: 5,
  crossoverRate: 0.7,
  mutationRate: 0.2,
  reproductionRate: 0.1,
  maxTreeDepth: 7,
  maxTreeNodes: 63,
  parsimonyPressure: 0.001,
  fitnessThreshold: 0.8,
  stagnationLimit: 20,
  diversityThreshold: 0.3,
};

let individualIdCounter = 0;
function nextIndividualId(): string {
  return `gp_${++individualIdCounter}_${Date.now().toString(36)}`;
}

// ===================== GENETIC PROGRAMMING ENGINE =====================

export class GeneticProgramming extends EventEmitter {
  private config: GPConfig;
  private treeEngine: ExpressionTree;
  private population: GPIndividual[] = [];
  private generation: number = 0;
  private bestEver: GPIndividual | null = null;
  private stagnationCounter: number = 0;
  private hallOfFame: GPIndividual[] = [];

  // Historical data for backtesting
  private trainingData: ObservationEvent[] = [];
  private regimeHistory: { timestamp: number; regime: MarketRegime }[] = [];

  constructor(config: Partial<GPConfig> = {}) {
    super();
    this.config = { ...DEFAULT_GP_CONFIG, ...config };
    this.treeEngine = new ExpressionTree({
      maxDepth: this.config.maxTreeDepth,
      maxNodes: this.config.maxTreeNodes,
    });
  }

  // ===================== LIFECYCLE =====================

  /**
   * Initialize population with ramped half-and-half method.
   */
  initializePopulation(): void {
    this.population = [];
    this.generation = 0;
    this.stagnationCounter = 0;

    for (let i = 0; i < this.config.populationSize; i++) {
      // Vary max depth across population for diversity
      const maxDepth = 2 + Math.floor((i / this.config.populationSize) * (this.config.maxTreeDepth - 2));
      const tree = this.treeEngine.generateRandom(maxDepth);

      this.population.push(this.createIndividual(tree, 'random'));
    }

    this.emit('population:initialized', { size: this.population.length });
  }

  /**
   * Set training data for fitness evaluation via backtesting.
   */
  setTrainingData(events: ObservationEvent[], regimes: { timestamp: number; regime: MarketRegime }[]): void {
    this.trainingData = events;
    this.regimeHistory = regimes;
  }

  /**
   * Run one generation of evolution.
   */
  async evolveGeneration(): Promise<GPPopulationStats> {
    this.generation++;

    // Step 1: Evaluate fitness for all individuals
    await this.evaluatePopulation();

    // Step 2: Record stats
    const stats = this.calculateStats();

    // Step 3: Check for stagnation
    if (this.bestEver && stats.bestFitness <= this.bestEver.fitness) {
      this.stagnationCounter++;
    } else {
      this.stagnationCounter = 0;
    }

    // Step 4: Update best ever
    const currentBest = this.getBestIndividual();
    if (!this.bestEver || (currentBest && currentBest.fitness > this.bestEver.fitness)) {
      this.bestEver = currentBest;
      this.updateHallOfFame(currentBest!);
    }

    // Step 5: Handle stagnation with diversity injection
    if (this.stagnationCounter >= this.config.stagnationLimit) {
      this.injectDiversity();
      this.stagnationCounter = 0;
    }

    // Step 6: Create next generation
    const nextGen = this.createNextGeneration();
    this.population = nextGen;

    // Step 7: Emit stats
    stats.stagnationCounter = this.stagnationCounter;
    this.emit('generation:complete', stats);

    return stats;
  }

  /**
   * Run evolution for multiple generations or until fitness threshold.
   */
  async evolve(maxGenerations?: number): Promise<GPIndividual | null> {
    const gens = maxGenerations || this.config.maxGenerations;

    if (this.population.length === 0) {
      this.initializePopulation();
    }

    for (let g = 0; g < gens; g++) {
      const stats = await this.evolveGeneration();

      // Check termination conditions
      if (stats.bestFitness >= this.config.fitnessThreshold) {
        this.emit('evolution:converged', { generation: this.generation, fitness: stats.bestFitness });
        break;
      }
    }

    return this.bestEver;
  }

  // ===================== FITNESS EVALUATION =====================

  private async evaluatePopulation(): Promise<void> {
    for (const individual of this.population) {
      if (individual.fitness > 0 && individual.generation === this.generation - 1) {
        continue; // Skip already-evaluated individuals (elites)
      }

      individual.metrics = this.backtestStrategy(individual.tree);
      individual.fitness = this.calculateFitness(individual);
      individual.adjustedFitness = individual.fitness - (
        this.config.parsimonyPressure * individual.nodeCount
      );
    }
  }

  /**
   * Backtest a strategy tree against historical data.
   * Walk-forward validation: train on first 80%, test on last 20%.
   */
  private backtestStrategy(tree: StrategyNode): StrategyMetrics {
    const trades = this.trainingData.filter(e => e.eventType === 'trade');

    if (trades.length < 20) {
      return this.emptyMetrics();
    }

    // Split data for walk-forward
    const splitPoint = Math.floor(trades.length * 0.8);
    const inSampleTrades = trades.slice(0, splitPoint);
    const outOfSampleTrades = trades.slice(splitPoint);

    const inSampleResult = this.simulateTrades(tree, inSampleTrades);
    const outOfSampleResult = this.simulateTrades(tree, outOfSampleTrades);

    // Regime breakdown
    const returnByRegime: Record<string, number> = {};
    const tradeCountByRegime: Record<string, number> = {};

    for (const trade of inSampleResult.trades) {
      const regime = trade.regime || 'UNKNOWN';
      returnByRegime[regime] = (returnByRegime[regime] || 0) + trade.pnl;
      tradeCountByRegime[regime] = (tradeCountByRegime[regime] || 0) + 1;
    }

    const nodeCount = this.treeEngine.countNodes(tree);
    const complexityPenalty = this.config.parsimonyPressure * nodeCount;

    const degradationRatio = inSampleResult.totalReturn !== 0
      ? outOfSampleResult.totalReturn / inSampleResult.totalReturn
      : 0;

    return {
      totalReturn: inSampleResult.totalReturn + outOfSampleResult.totalReturn,
      sharpeRatio: this.calculateSharpe(inSampleResult.returns),
      maxDrawdown: inSampleResult.maxDrawdown,
      winRate: inSampleResult.wins / Math.max(inSampleResult.tradeCount, 1),
      profitFactor: inSampleResult.grossProfit / Math.max(Math.abs(inSampleResult.grossLoss), 0.001),
      tradeCount: inSampleResult.tradeCount,
      avgHoldingPeriod: 0, // simplified
      avgReturn: inSampleResult.totalReturn / Math.max(inSampleResult.tradeCount, 1),
      volatility: this.calculateVolatility(inSampleResult.returns),
      calmarRatio: inSampleResult.maxDrawdown !== 0
        ? inSampleResult.totalReturn / Math.abs(inSampleResult.maxDrawdown)
        : 0,
      sortinoRatio: this.calculateSortino(inSampleResult.returns),
      returnByRegime,
      tradeCountByRegime,
      inSampleReturn: inSampleResult.totalReturn,
      outOfSampleReturn: outOfSampleResult.totalReturn,
      degradationRatio,
      complexityPenalty,
      effectiveFitness: 0, // calculated after
    };
  }

  private simulateTrades(tree: StrategyNode, events: ObservationEvent[]): SimulationResult {
    const result: SimulationResult = {
      trades: [],
      returns: [],
      totalReturn: 0,
      maxDrawdown: 0,
      tradeCount: 0,
      wins: 0,
      grossProfit: 0,
      grossLoss: 0,
    };

    let position: 'long' | 'short' | 'flat' = 'flat';
    let entryPrice = 0;
    let equity = 10000; // virtual starting equity
    let peakEquity = equity;

    for (const event of events) {
      const payload = event.payload as any;
      if (!payload.price) continue;

      // Get indicators from enrichment or create defaults
      const indicators: IndicatorSnapshot = event.enrichmentMetadata?.indicators || {
        rsi14: 50, macdHist: 0, bbPosition: 0.5, atr14: 1,
        volumeRatio: 1, trendStrength: 20, priceVsMA50: 0, priceVsMA200: 0,
      };

      const regime = (event as any).enrichment?.marketRegime || 'RANGING';

      // Evaluate strategy
      const signal = this.treeEngine.evaluate(tree, indicators, regime);

      // Execute based on signal
      if (signal.action === 'BUY' && position !== 'long') {
        if (position === 'short') {
          // Close short
          const pnl = entryPrice - payload.price;
          this.recordTrade(result, pnl, regime, equity);
          equity += pnl;
        }
        position = 'long';
        entryPrice = payload.price;
      } else if (signal.action === 'SELL' && position !== 'short') {
        if (position === 'long') {
          // Close long
          const pnl = payload.price - entryPrice;
          this.recordTrade(result, pnl, regime, equity);
          equity += pnl;
        }
        position = 'short';
        entryPrice = payload.price;
      } else if (signal.action === 'CLOSE' && position !== 'flat') {
        const pnl = position === 'long'
          ? payload.price - entryPrice
          : entryPrice - payload.price;
        this.recordTrade(result, pnl, regime, equity);
        equity += pnl;
        position = 'flat';
      }

      // Track drawdown
      peakEquity = Math.max(peakEquity, equity);
      const drawdown = (peakEquity - equity) / peakEquity;
      result.maxDrawdown = Math.max(result.maxDrawdown, drawdown);
    }

    result.totalReturn = (equity - 10000) / 10000;

    return result;
  }

  private recordTrade(
    result: SimulationResult,
    pnl: number,
    regime: string,
    equity: number
  ): void {
    const pnlPct = pnl / equity;
    result.trades.push({ pnl, pnlPct, regime });
    result.returns.push(pnlPct);
    result.tradeCount++;
    if (pnl > 0) {
      result.wins++;
      result.grossProfit += pnl;
    } else {
      result.grossLoss += pnl;
    }
  }

  /**
   * Multi-objective fitness: combine return, risk, consistency, and simplicity.
   */
  private calculateFitness(individual: GPIndividual): number {
    const m = individual.metrics;

    // Reject strategies that don't trade
    if (m.tradeCount < 5) return 0;

    // Reject strategies with extreme drawdown
    if (m.maxDrawdown > 0.5) return 0;

    // Multi-objective scoring
    const returnScore = Math.tanh(m.totalReturn * 5);                  // [-1, 1]
    const sharpeScore = Math.tanh(m.sharpeRatio / 2);                  // [-1, 1]
    const winRateScore = m.winRate;                                     // [0, 1]
    const drawdownPenalty = Math.max(0, m.maxDrawdown - 0.1) * 5;     // penalty above 10%
    const tradeCountScore = Math.min(1, m.tradeCount / 30);           // [0, 1] reward activity
    const consistencyScore = Math.max(0, m.degradationRatio);         // out/in sample ratio
    const regimeScore = this.regimeDiversityScore(m.returnByRegime);  // [0, 1]

    // Weighted combination
    const fitness = (
      returnScore * 0.25 +
      sharpeScore * 0.20 +
      winRateScore * 0.15 +
      tradeCountScore * 0.10 +
      consistencyScore * 0.15 +
      regimeScore * 0.15 -
      drawdownPenalty
    );

    return Math.max(0, fitness);
  }

  private regimeDiversityScore(returnByRegime: Record<string, number>): number {
    const regimes = Object.keys(returnByRegime);
    if (regimes.length === 0) return 0;

    const profitableRegimes = regimes.filter(r => returnByRegime[r] > 0).length;
    const diversityRatio = profitableRegimes / Math.max(regimes.length, 1);

    // Penalize catastrophic loss in any single regime
    const worstRegime = Math.min(...Object.values(returnByRegime));
    const catastrophePenalty = worstRegime < -0.05 ? 0.3 : 0;

    return Math.max(0, diversityRatio - catastrophePenalty);
  }

  // ===================== SELECTION & BREEDING =====================

  private createNextGeneration(): GPIndividual[] {
    const nextGen: GPIndividual[] = [];

    // Elitism: carry over best individuals
    const sorted = [...this.population].sort((a, b) => b.adjustedFitness - a.adjustedFitness);
    for (let i = 0; i < this.config.elitismCount && i < sorted.length; i++) {
      const elite = this.treeEngine.deepClone(sorted[i].tree);
      const individual = this.createIndividual(elite, 'random');
      individual.fitness = sorted[i].fitness;
      individual.adjustedFitness = sorted[i].adjustedFitness;
      individual.metrics = sorted[i].metrics;
      individual.parentIds = [sorted[i].id];
      nextGen.push(individual);
    }

    // Fill rest of population
    while (nextGen.length < this.config.populationSize) {
      const roll = Math.random();

      if (roll < this.config.crossoverRate) {
        // Crossover
        const parent1 = this.tournamentSelect();
        const parent2 = this.tournamentSelect();
        const [child1Tree, child2Tree] = this.treeEngine.crossover(parent1.tree, parent2.tree);

        nextGen.push(this.createIndividual(child1Tree, 'crossover', [parent1.id, parent2.id]));
        if (nextGen.length < this.config.populationSize) {
          nextGen.push(this.createIndividual(child2Tree, 'crossover', [parent1.id, parent2.id]));
        }
      } else if (roll < this.config.crossoverRate + this.config.mutationRate) {
        // Mutation
        const parent = this.tournamentSelect();
        const mutationType = Math.random();

        let mutatedTree: StrategyNode;
        if (mutationType < 0.5) {
          mutatedTree = this.treeEngine.mutate(parent.tree);
        } else if (mutationType < 0.8) {
          mutatedTree = this.treeEngine.subtreeMutate(parent.tree);
        } else {
          mutatedTree = this.treeEngine.hoistMutate(parent.tree);
        }

        nextGen.push(this.createIndividual(mutatedTree, 'mutation', [parent.id]));
      } else {
        // Reproduction (copy)
        const parent = this.tournamentSelect();
        nextGen.push(this.createIndividual(
          this.treeEngine.deepClone(parent.tree), 'random', [parent.id]
        ));
      }
    }

    return nextGen;
  }

  /**
   * Tournament selection: pick best from random subset.
   */
  private tournamentSelect(): GPIndividual {
    let best: GPIndividual | null = null;

    for (let i = 0; i < this.config.tournamentSize; i++) {
      const candidate = this.population[Math.floor(Math.random() * this.population.length)];
      if (!best || candidate.adjustedFitness > best.adjustedFitness) {
        best = candidate;
      }
    }

    return best!;
  }

  /**
   * Inject diversity when evolution stagnates.
   */
  private injectDiversity(): void {
    // Replace bottom 30% of population with fresh random individuals
    const sorted = [...this.population].sort((a, b) => b.adjustedFitness - a.adjustedFitness);
    const cutoff = Math.floor(this.config.populationSize * 0.7);

    for (let i = cutoff; i < sorted.length; i++) {
      const depth = 2 + Math.floor(Math.random() * (this.config.maxTreeDepth - 2));
      sorted[i] = this.createIndividual(
        this.treeEngine.generateRandom(depth), 'random'
      );
    }

    this.population = sorted;
    this.emit('diversity:injected', { replaced: sorted.length - cutoff });
  }

  // ===================== HELPER METHODS =====================

  private createIndividual(
    tree: StrategyNode,
    createdBy: GPIndividual['createdBy'],
    parentIds: string[] = []
  ): GPIndividual {
    return {
      id: nextIndividualId(),
      tree,
      fitness: 0,
      adjustedFitness: 0,
      generation: this.generation,
      parentIds,
      nodeCount: this.treeEngine.countNodes(tree),
      depth: this.treeEngine.getDepth(tree),
      metrics: this.emptyMetrics(),
      createdBy,
      createdAt: Date.now(),
    };
  }

  private emptyMetrics(): StrategyMetrics {
    return {
      totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0,
      profitFactor: 0, tradeCount: 0, avgHoldingPeriod: 0, avgReturn: 0,
      volatility: 0, calmarRatio: 0, sortinoRatio: 0,
      returnByRegime: {}, tradeCountByRegime: {},
      inSampleReturn: 0, outOfSampleReturn: 0, degradationRatio: 0,
      complexityPenalty: 0, effectiveFitness: 0,
    };
  }

  private calculateSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0; // annualized
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252);
  }

  private calculateSortino(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const downside = returns.filter(r => r < 0);
    if (downside.length === 0) return mean > 0 ? 10 : 0; // cap at 10
    const downsideVar = downside.reduce((sum, r) => sum + r * r, 0) / downside.length;
    const downsideDev = Math.sqrt(downsideVar);
    return downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(252) : 0;
  }

  private calculateStats(): GPPopulationStats {
    const fitnesses = this.population.map(i => i.adjustedFitness).sort((a, b) => a - b);

    // Diversity: ratio of unique tree structures
    const treeHashes = new Set(this.population.map(i => this.hashTree(i.tree)));
    const diversityIndex = treeHashes.size / this.population.length;

    return {
      generation: this.generation,
      bestFitness: fitnesses[fitnesses.length - 1] || 0,
      avgFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      medianFitness: fitnesses[Math.floor(fitnesses.length / 2)] || 0,
      worstFitness: fitnesses[0] || 0,
      diversityIndex,
      avgNodeCount: this.population.reduce((sum, i) => sum + i.nodeCount, 0) / this.population.length,
      avgDepth: this.population.reduce((sum, i) => sum + i.depth, 0) / this.population.length,
      speciesCount: treeHashes.size,
      stagnationCounter: this.stagnationCounter,
    };
  }

  /**
   * Quick structural hash for diversity measurement.
   */
  private hashTree(node: StrategyNode): string {
    if (!node.children || node.children.length === 0) {
      return `${node.type}:${node.value}`;
    }
    const childHashes = node.children.map(c => this.hashTree(c)).join(',');
    return `${node.type}:${node.value}(${childHashes})`;
  }

  private getBestIndividual(): GPIndividual | null {
    if (this.population.length === 0) return null;
    return this.population.reduce((best, ind) =>
      ind.adjustedFitness > best.adjustedFitness ? ind : best
    );
  }

  private updateHallOfFame(individual: GPIndividual): void {
    this.hallOfFame.push(individual);
    // Keep top 20
    this.hallOfFame.sort((a, b) => b.fitness - a.fitness);
    this.hallOfFame = this.hallOfFame.slice(0, 20);
  }

  // ===================== PUBLIC API =====================

  getPopulation(): GPIndividual[] {
    return [...this.population];
  }

  getBest(): GPIndividual | null {
    return this.bestEver;
  }

  getHallOfFame(): GPIndividual[] {
    return [...this.hallOfFame];
  }

  getGeneration(): number {
    return this.generation;
  }

  getStats(): GPPopulationStats | null {
    if (this.population.length === 0) return null;
    return this.calculateStats();
  }

  /**
   * Inject an externally-created individual (e.g., from NMF or adversarial generation).
   */
  injectIndividual(tree: StrategyNode, source: GPIndividual['createdBy']): void {
    const individual = this.createIndividual(tree, source);
    // Replace worst individual
    const worst = this.population.reduce((w, i) =>
      i.adjustedFitness < w.adjustedFitness ? i : w
    );
    const idx = this.population.indexOf(worst);
    if (idx >= 0) {
      this.population[idx] = individual;
    }
  }
}

// ===================== INTERNAL TYPES =====================

interface SimulationResult {
  trades: { pnl: number; pnlPct: number; regime: string }[];
  returns: number[];
  totalReturn: number;
  maxDrawdown: number;
  tradeCount: number;
  wins: number;
  grossProfit: number;
  grossLoss: number;
}

export default GeneticProgramming;
