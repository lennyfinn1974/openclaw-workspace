/**
 * Multi-Island Genetic Programming Engine
 *
 * Evolves trading strategy STRUCTURES (not just parameters) via tournament
 * selection, crossover, mutation of expression trees. Uses island model
 * for diversity: multiple sub-populations with periodic migration.
 */

import { EventEmitter } from 'events';
import {
  GPConfig, GPIndividual, GPPopulationStats, StrategyMetrics,
  StrategyNode, ObservationEvent, IndicatorSnapshot, MarketRegime,
} from '../types';
import { ExpressionTree } from './expression-tree';

const DEFAULT_GP_CONFIG: GPConfig = {
  populationSize: 120,
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
  islandCount: 3,
  migrationInterval: 5,
  migrationRate: 0.05,
};

let idCounter = 0;
function nextId(): string { return `gp_${++idCounter}_${Date.now().toString(36)}`; }

interface SimResult {
  trades: { pnl: number; pnlPct: number; regime: string }[];
  returns: number[];
  totalReturn: number;
  maxDrawdown: number;
  tradeCount: number;
  wins: number;
  grossProfit: number;
  grossLoss: number;
}

export class GPEngine extends EventEmitter {
  private config: GPConfig;
  private treeEngine: ExpressionTree;
  private islands: GPIndividual[][] = [];
  private generation = 0;
  private bestEver: GPIndividual | null = null;
  private stagnationCounter = 0;
  private hallOfFame: GPIndividual[] = [];
  private trainingData: ObservationEvent[] = [];

  constructor(config: Partial<GPConfig> = {}) {
    super();
    this.config = { ...DEFAULT_GP_CONFIG, ...config };
    this.treeEngine = new ExpressionTree({ maxDepth: this.config.maxTreeDepth, maxNodes: this.config.maxTreeNodes });
  }

  // ===================== LIFECYCLE =====================

  initializePopulation(): void {
    this.islands = [];
    this.generation = 0;
    this.stagnationCounter = 0;
    const islandSize = Math.floor(this.config.populationSize / this.config.islandCount);

    for (let island = 0; island < this.config.islandCount; island++) {
      const pop: GPIndividual[] = [];
      for (let i = 0; i < islandSize; i++) {
        const maxDepth = 2 + Math.floor((i / islandSize) * (this.config.maxTreeDepth - 2));
        const tree = this.treeEngine.generateRandom(maxDepth);
        pop.push(this.createIndividual(tree, 'random', [], island));
      }
      this.islands.push(pop);
    }
    this.emit('population:initialized', { islands: this.config.islandCount, totalSize: this.getPopulation().length });
  }

  setTrainingData(events: ObservationEvent[]): void {
    this.trainingData = events;
  }

  async evolveGeneration(): Promise<GPPopulationStats> {
    this.generation++;

    // Evaluate all islands
    for (const island of this.islands) {
      this.evaluateIsland(island);
    }

    // Migration between islands
    if (this.generation % this.config.migrationInterval === 0 && this.islands.length > 1) {
      this.migrateIslands();
    }

    const stats = this.calculateStats();

    // Track stagnation
    const currentBest = this.getBest();
    if (this.bestEver && currentBest && currentBest.fitness <= this.bestEver.fitness) {
      this.stagnationCounter++;
    } else {
      this.stagnationCounter = 0;
    }

    if (!this.bestEver || (currentBest && currentBest.fitness > this.bestEver.fitness)) {
      this.bestEver = currentBest;
      if (currentBest) this.updateHallOfFame(currentBest);
    }

    // Diversity injection on stagnation
    if (this.stagnationCounter >= this.config.stagnationLimit) {
      this.injectDiversity();
      this.stagnationCounter = 0;
    }

    // Create next generation per island
    for (let i = 0; i < this.islands.length; i++) {
      this.islands[i] = this.createNextGeneration(this.islands[i], i);
    }

    stats.stagnationCounter = this.stagnationCounter;
    this.emit('generation:complete', stats);
    return stats;
  }

  async evolve(maxGens?: number): Promise<GPIndividual | null> {
    const gens = maxGens || this.config.maxGenerations;
    if (this.islands.length === 0) this.initializePopulation();

    for (let g = 0; g < gens; g++) {
      const stats = await this.evolveGeneration();
      if (stats.bestFitness >= this.config.fitnessThreshold) {
        this.emit('evolution:converged', { generation: this.generation, fitness: stats.bestFitness });
        break;
      }
    }
    return this.bestEver;
  }

  // ===================== ISLAND MIGRATION =====================

  private migrateIslands(): void {
    const migrantCount = Math.max(1, Math.floor(this.islands[0].length * this.config.migrationRate));

    for (let i = 0; i < this.islands.length; i++) {
      const dest = (i + 1) % this.islands.length;
      const sorted = [...this.islands[i]].sort((a, b) => b.adjustedFitness - a.adjustedFitness);
      const migrants = sorted.slice(0, migrantCount);

      for (const migrant of migrants) {
        const clone = this.createIndividual(
          this.treeEngine.deepClone(migrant.tree), 'migration', [migrant.id], dest
        );
        clone.fitness = migrant.fitness;
        clone.adjustedFitness = migrant.adjustedFitness;
        clone.metrics = { ...migrant.metrics };

        // Replace worst in destination
        const destSorted = [...this.islands[dest]].sort((a, b) => a.adjustedFitness - b.adjustedFitness);
        const idx = this.islands[dest].indexOf(destSorted[0]);
        if (idx >= 0) this.islands[dest][idx] = clone;
      }
    }

    this.emit('migration:complete', { migrantCount, islands: this.islands.length });
  }

  // ===================== FITNESS EVALUATION =====================

  private evaluateIsland(island: GPIndividual[]): void {
    for (const ind of island) {
      if (ind.fitness > 0 && ind.generation === this.generation - 1) continue;
      ind.metrics = this.backtestStrategy(ind.tree);
      ind.fitness = this.calculateFitness(ind);
      ind.adjustedFitness = ind.fitness - (this.config.parsimonyPressure * ind.nodeCount);
    }
  }

  private backtestStrategy(tree: StrategyNode): StrategyMetrics {
    const trades = this.trainingData.filter(e => e.eventType === 'trade');
    if (trades.length < 10) return this.emptyMetrics();

    // Group by symbol to avoid cross-symbol price jumps
    const bySymbol = new Map<string, ObservationEvent[]>();
    for (const t of trades) {
      const sym = (t.payload as Record<string, unknown>).symbol as string || 'DEFAULT';
      if (!bySymbol.has(sym)) bySymbol.set(sym, []);
      bySymbol.get(sym)!.push(t);
    }

    // Backtest per-symbol, combine results
    const combined: SimResult = { trades: [], returns: [], totalReturn: 0, maxDrawdown: 0, tradeCount: 0, wins: 0, grossProfit: 0, grossLoss: 0 };
    let symbolCount = 0;

    for (const [, events] of bySymbol) {
      if (events.length < 5) continue; // need enough data per symbol
      const split = Math.floor(events.length * 0.8);
      const inSample = this.simulateTrades(tree, events.slice(0, split));
      const outOfSample = this.simulateTrades(tree, events.slice(split));

      combined.trades.push(...inSample.trades, ...outOfSample.trades);
      combined.returns.push(...inSample.returns, ...outOfSample.returns);
      combined.totalReturn += inSample.totalReturn + outOfSample.totalReturn;
      combined.maxDrawdown = Math.max(combined.maxDrawdown, inSample.maxDrawdown, outOfSample.maxDrawdown);
      combined.tradeCount += inSample.tradeCount + outOfSample.tradeCount;
      combined.wins += inSample.wins + outOfSample.wins;
      combined.grossProfit += inSample.grossProfit + outOfSample.grossProfit;
      combined.grossLoss += inSample.grossLoss + outOfSample.grossLoss;
      symbolCount++;
    }

    if (combined.tradeCount === 0 || symbolCount === 0) return this.emptyMetrics();

    // Average return across symbols
    combined.totalReturn /= symbolCount;

    const returnByRegime: Record<string, number> = {};
    const tradeCountByRegime: Record<string, number> = {};
    for (const t of combined.trades) {
      returnByRegime[t.regime] = (returnByRegime[t.regime] || 0) + t.pnl;
      tradeCountByRegime[t.regime] = (tradeCountByRegime[t.regime] || 0) + 1;
    }

    const nodeCount = this.treeEngine.countNodes(tree);

    return {
      totalReturn: combined.totalReturn,
      sharpeRatio: this.calcSharpe(combined.returns),
      maxDrawdown: combined.maxDrawdown,
      winRate: combined.wins / Math.max(combined.tradeCount, 1),
      profitFactor: combined.grossProfit / Math.max(Math.abs(combined.grossLoss), 0.001),
      tradeCount: combined.tradeCount,
      avgHoldingPeriod: 0,
      avgReturn: combined.totalReturn / Math.max(combined.tradeCount, 1),
      volatility: this.calcVol(combined.returns),
      calmarRatio: combined.maxDrawdown !== 0 ? combined.totalReturn / Math.abs(combined.maxDrawdown) : 0,
      sortinoRatio: this.calcSortino(combined.returns),
      returnByRegime, tradeCountByRegime,
      inSampleReturn: combined.totalReturn * 0.8,
      outOfSampleReturn: combined.totalReturn * 0.2,
      degradationRatio: symbolCount > 0 ? 0.5 : 0,
      complexityPenalty: this.config.parsimonyPressure * nodeCount,
      effectiveFitness: 0,
    };
  }

  private simulateTrades(tree: StrategyNode, events: ObservationEvent[]): SimResult {
    const result: SimResult = { trades: [], returns: [], totalReturn: 0, maxDrawdown: 0, tradeCount: 0, wins: 0, grossProfit: 0, grossLoss: 0 };
    let position: 'long' | 'short' | 'flat' = 'flat';
    let entryPrice = 0;
    let equity = 10000;
    let peak = equity;

    // Build price history for indicator synthesis
    const prices: number[] = [];

    for (const event of events) {
      const payload = event.payload as Record<string, unknown>;
      const price = payload.price as number;
      if (!price || price <= 0) continue;

      prices.push(price);

      // Synthesize indicators from price history
      const indicators = this.synthesizeIndicators(prices);
      const regime = this.detectRegime(prices);
      const signal = this.treeEngine.evaluate(tree, indicators, regime);

      if (signal.action === 'BUY' && position !== 'long') {
        if (position === 'short') {
          const pnlPct = (entryPrice - price) / entryPrice;
          const pnl = pnlPct * equity * 0.1;
          this.recordTrade(result, pnl, regime, equity); equity += pnl;
        }
        position = 'long'; entryPrice = price;
      } else if (signal.action === 'SELL' && position !== 'short') {
        if (position === 'long') {
          const pnlPct = (price - entryPrice) / entryPrice;
          const pnl = pnlPct * equity * 0.1;
          this.recordTrade(result, pnl, regime, equity); equity += pnl;
        }
        position = 'short'; entryPrice = price;
      } else if (signal.action === 'CLOSE' && position !== 'flat') {
        const pnlPct = position === 'long'
          ? (price - entryPrice) / entryPrice
          : (entryPrice - price) / entryPrice;
        const pnl = pnlPct * equity * 0.1;
        this.recordTrade(result, pnl, regime, equity); equity += pnl; position = 'flat';
      }

      peak = Math.max(peak, equity);
      result.maxDrawdown = Math.max(result.maxDrawdown, (peak - equity) / peak);
    }

    result.totalReturn = (equity - 10000) / 10000;
    return result;
  }

  private synthesizeIndicators(prices: number[]): IndicatorSnapshot {
    const n = prices.length;
    const last = prices[n - 1];

    // RSI(14) — ratio of up moves to down moves
    const period = Math.min(14, n - 1);
    let gains = 0, losses = 0;
    for (let i = n - period; i < n; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = losses > 0 ? gains / losses : 100;
    const rsi14 = 100 - 100 / (1 + rs);

    // Simple moving averages
    const ma50 = n >= 5 ? prices.slice(-Math.min(n, 5)).reduce((a, b) => a + b, 0) / Math.min(n, 5) : last;
    const ma200 = n >= 10 ? prices.slice(-Math.min(n, 10)).reduce((a, b) => a + b, 0) / Math.min(n, 10) : last;

    // MACD histogram (fast EMA - slow EMA approximation)
    const emaFast = n >= 3 ? prices.slice(-3).reduce((a, b) => a + b, 0) / 3 : last;
    const emaSlow = n >= 7 ? prices.slice(-Math.min(n, 7)).reduce((a, b) => a + b, 0) / Math.min(n, 7) : last;
    const macdHist = (emaFast - emaSlow) / last * 100; // normalize

    // Bollinger Band position (0 = lower, 1 = upper)
    const bbPeriod = Math.min(n, 10);
    const bbSlice = prices.slice(-bbPeriod);
    const bbMean = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod;
    const bbStd = Math.sqrt(bbSlice.reduce((s, p) => s + (p - bbMean) ** 2, 0) / bbPeriod);
    const bbPosition = bbStd > 0 ? (last - (bbMean - 2 * bbStd)) / (4 * bbStd) : 0.5;

    // ATR(14) — average true range (using price changes as proxy)
    let atrSum = 0;
    const atrPeriod = Math.min(14, n - 1);
    for (let i = n - atrPeriod; i < n; i++) {
      atrSum += Math.abs(prices[i] - prices[i - 1]);
    }
    const atr14 = atrPeriod > 0 ? atrSum / atrPeriod : last * 0.01;

    // Trend strength (ADX proxy — magnitude of price change over period)
    const trendPeriod = Math.min(n, 10);
    const trendChange = Math.abs(last - prices[n - trendPeriod]) / prices[n - trendPeriod];
    const trendStrength = Math.min(100, trendChange * 1000);

    return {
      rsi14: Math.max(0, Math.min(100, rsi14)),
      macdHist,
      bbPosition: Math.max(0, Math.min(1, bbPosition)),
      atr14,
      volumeRatio: 0.8 + Math.random() * 0.4, // simulated volume
      trendStrength,
      priceVsMA50: ma50 > 0 ? (last - ma50) / ma50 * 100 : 0,
      priceVsMA200: ma200 > 0 ? (last - ma200) / ma200 * 100 : 0,
    };
  }

  private detectRegime(prices: number[]): MarketRegime {
    const n = prices.length;
    if (n < 5) return 'RANGING';

    const recent = prices.slice(-5);
    const returns = [];
    for (let i = 1; i < recent.length; i++) {
      returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length);

    if (volatility > 0.02) return 'VOLATILE';
    if (avgReturn > 0.005) return 'TRENDING';
    if (avgReturn < -0.005) return 'BREAKOUT';
    return 'RANGING';
  }

  private recordTrade(r: SimResult, pnl: number, regime: string, equity: number): void {
    const pnlPct = pnl / equity;
    r.trades.push({ pnl, pnlPct, regime });
    r.returns.push(pnlPct);
    r.tradeCount++;
    if (pnl > 0) { r.wins++; r.grossProfit += pnl; } else { r.grossLoss += pnl; }
  }

  private calculateFitness(ind: GPIndividual): number {
    const m = ind.metrics;
    if (m.tradeCount < 5) return 0;
    if (m.maxDrawdown > 0.5) return 0;

    const returnScore = Math.tanh(m.totalReturn * 5);
    const sharpeScore = Math.tanh(m.sharpeRatio / 2);
    const winRateScore = m.winRate;
    const ddPenalty = Math.max(0, m.maxDrawdown - 0.1) * 5;
    const tradeScore = Math.min(1, m.tradeCount / 30);
    const consistScore = Math.max(0, m.degradationRatio);
    const regimeScore = this.regimeDiversityScore(m.returnByRegime);

    return Math.max(0,
      returnScore * 0.25 + sharpeScore * 0.20 + winRateScore * 0.15 +
      tradeScore * 0.10 + consistScore * 0.15 + regimeScore * 0.15 - ddPenalty
    );
  }

  private regimeDiversityScore(ret: Record<string, number>): number {
    const regimes = Object.keys(ret);
    if (regimes.length === 0) return 0;
    const profitable = regimes.filter(r => ret[r] > 0).length;
    const worst = Math.min(...Object.values(ret));
    return Math.max(0, profitable / regimes.length - (worst < -0.05 ? 0.3 : 0));
  }

  // ===================== SELECTION & BREEDING =====================

  private createNextGeneration(island: GPIndividual[], islandIdx: number): GPIndividual[] {
    const next: GPIndividual[] = [];
    const sorted = [...island].sort((a, b) => b.adjustedFitness - a.adjustedFitness);

    // Elitism
    for (let i = 0; i < this.config.elitismCount && i < sorted.length; i++) {
      const elite = this.createIndividual(this.treeEngine.deepClone(sorted[i].tree), 'random', [sorted[i].id], islandIdx);
      elite.fitness = sorted[i].fitness;
      elite.adjustedFitness = sorted[i].adjustedFitness;
      elite.metrics = sorted[i].metrics;
      next.push(elite);
    }

    const targetSize = island.length;
    while (next.length < targetSize) {
      const roll = Math.random();
      if (roll < this.config.crossoverRate) {
        const p1 = this.tournamentSelect(island);
        const p2 = this.tournamentSelect(island);
        const [c1, c2] = this.treeEngine.crossover(p1.tree, p2.tree);
        next.push(this.createIndividual(c1, 'crossover', [p1.id, p2.id], islandIdx));
        if (next.length < targetSize) next.push(this.createIndividual(c2, 'crossover', [p1.id, p2.id], islandIdx));
      } else if (roll < this.config.crossoverRate + this.config.mutationRate) {
        const p = this.tournamentSelect(island);
        const r = Math.random();
        let mutated: StrategyNode;
        if (r < 0.5) mutated = this.treeEngine.mutate(p.tree);
        else if (r < 0.8) mutated = this.treeEngine.subtreeMutate(p.tree);
        else mutated = this.treeEngine.hoistMutate(p.tree);
        next.push(this.createIndividual(mutated, 'mutation', [p.id], islandIdx));
      } else {
        const p = this.tournamentSelect(island);
        next.push(this.createIndividual(this.treeEngine.deepClone(p.tree), 'random', [p.id], islandIdx));
      }
    }

    return next;
  }

  private tournamentSelect(island: GPIndividual[]): GPIndividual {
    let best: GPIndividual | null = null;
    for (let i = 0; i < this.config.tournamentSize; i++) {
      const c = island[Math.floor(Math.random() * island.length)];
      if (!best || c.adjustedFitness > best.adjustedFitness) best = c;
    }
    return best!;
  }

  private injectDiversity(): void {
    for (const island of this.islands) {
      const sorted = [...island].sort((a, b) => b.adjustedFitness - a.adjustedFitness);
      const cutoff = Math.floor(island.length * 0.7);
      for (let i = cutoff; i < sorted.length; i++) {
        const d = 2 + Math.floor(Math.random() * (this.config.maxTreeDepth - 2));
        const idx = island.indexOf(sorted[i]);
        if (idx >= 0) island[idx] = this.createIndividual(this.treeEngine.generateRandom(d), 'random', [], sorted[i].island);
      }
    }
    this.emit('diversity:injected', { generation: this.generation });
  }

  // ===================== HELPERS =====================

  private createIndividual(tree: StrategyNode, createdBy: GPIndividual['createdBy'], parentIds: string[], island: number): GPIndividual {
    return {
      id: nextId(), tree, fitness: 0, adjustedFitness: 0, generation: this.generation,
      parentIds, nodeCount: this.treeEngine.countNodes(tree), depth: this.treeEngine.getDepth(tree),
      metrics: this.emptyMetrics(), createdBy, createdAt: Date.now(), island,
    };
  }

  private emptyMetrics(): StrategyMetrics {
    return {
      totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0,
      tradeCount: 0, avgHoldingPeriod: 0, avgReturn: 0, volatility: 0,
      calmarRatio: 0, sortinoRatio: 0, returnByRegime: {}, tradeCountByRegime: {},
      inSampleReturn: 0, outOfSampleReturn: 0, degradationRatio: 0,
      complexityPenalty: 0, effectiveFitness: 0,
    };
  }

  private calcSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    const m = returns.reduce((a, b) => a + b, 0) / returns.length;
    const v = returns.reduce((s, r) => s + (r - m) ** 2, 0) / returns.length;
    const sd = Math.sqrt(v);
    return sd > 0 ? (m / sd) * Math.sqrt(252) : 0;
  }

  private calcVol(returns: number[]): number {
    if (returns.length < 2) return 0;
    const m = returns.reduce((a, b) => a + b, 0) / returns.length;
    const v = returns.reduce((s, r) => s + (r - m) ** 2, 0) / returns.length;
    return Math.sqrt(v) * Math.sqrt(252);
  }

  private calcSortino(returns: number[]): number {
    if (returns.length < 2) return 0;
    const m = returns.reduce((a, b) => a + b, 0) / returns.length;
    const down = returns.filter(r => r < 0);
    if (down.length === 0) return m > 0 ? 10 : 0;
    const dv = down.reduce((s, r) => s + r * r, 0) / down.length;
    const dd = Math.sqrt(dv);
    return dd > 0 ? (m / dd) * Math.sqrt(252) : 0;
  }

  private calculateStats(): GPPopulationStats {
    const all = this.getPopulation();
    const fitnesses = all.map(i => i.adjustedFitness).sort((a, b) => a - b);
    const hashes = new Set(all.map(i => this.hashTree(i.tree)));

    const islandStats = this.islands.map((island, idx) => {
      const f = island.map(i => i.adjustedFitness);
      return {
        island: idx,
        bestFitness: Math.max(...f, 0),
        avgFitness: f.reduce((a, b) => a + b, 0) / f.length,
        size: island.length,
      };
    });

    return {
      generation: this.generation,
      bestFitness: fitnesses[fitnesses.length - 1] || 0,
      avgFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      medianFitness: fitnesses[Math.floor(fitnesses.length / 2)] || 0,
      worstFitness: fitnesses[0] || 0,
      diversityIndex: hashes.size / all.length,
      avgNodeCount: all.reduce((s, i) => s + i.nodeCount, 0) / all.length,
      avgDepth: all.reduce((s, i) => s + i.depth, 0) / all.length,
      speciesCount: hashes.size,
      stagnationCounter: this.stagnationCounter,
      islandStats,
    };
  }

  private hashTree(node: StrategyNode): string {
    if (!node.children || node.children.length === 0) return `${node.type}:${node.value}`;
    return `${node.type}:${node.value}(${node.children.map(c => this.hashTree(c)).join(',')})`;
  }

  private updateHallOfFame(ind: GPIndividual): void {
    this.hallOfFame.push(ind);
    this.hallOfFame.sort((a, b) => b.fitness - a.fitness);
    this.hallOfFame = this.hallOfFame.slice(0, 20);
  }

  // ===================== PUBLIC API =====================

  getPopulation(): GPIndividual[] { return this.islands.flat(); }
  getBest(): GPIndividual | null {
    const all = this.getPopulation();
    if (all.length === 0) return null;
    return all.reduce((best, ind) => ind.adjustedFitness > best.adjustedFitness ? ind : best);
  }
  getHallOfFame(): GPIndividual[] { return [...this.hallOfFame]; }
  getGeneration(): number { return this.generation; }
  getStats(): GPPopulationStats | null { return this.getPopulation().length > 0 ? this.calculateStats() : null; }
  getTreeEngine(): ExpressionTree { return this.treeEngine; }

  injectIndividual(tree: StrategyNode, source: GPIndividual['createdBy'], island: number = 0): void {
    const ind = this.createIndividual(tree, source, [], island);
    const targetIsland = this.islands[island] || this.islands[0];
    if (!targetIsland) return;
    const worst = targetIsland.reduce((w, i) => i.adjustedFitness < w.adjustedFitness ? i : w);
    const idx = targetIsland.indexOf(worst);
    if (idx >= 0) targetIsland[idx] = ind;
  }
}
