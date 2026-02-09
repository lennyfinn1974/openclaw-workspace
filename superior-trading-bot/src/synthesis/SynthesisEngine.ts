/**
 * Strategy Synthesis Engine - Layer 3 Orchestrator
 * Coordinates GP, NMF, and Adversarial generation into a unified
 * strategy creation pipeline.
 *
 * Phase 1: ANALYSIS ONLY — generates and validates strategies
 * but does not execute any real trades.
 */

import { EventEmitter } from 'events';
import {
  SynthesisConfig, SynthesisStatus, GPIndividual, FactorCombination,
  AdversarialStrategy, StrategyNode, DNASnapshot
} from '../types/synthesis';
import { ObservationEvent, StrategyFingerprint, MarketRegime } from '../types/core';
import { GeneticProgramming } from './GeneticProgramming';
import { NMFEngine } from './NMFEngine';
import { AdversarialGenerator } from './AdversarialGenerator';
import { StrategyValidator } from './StrategyValidator';
import { ExpressionTree } from './ExpressionTree';

// ===================== DEFAULT CONFIG =====================

const DEFAULT_SYNTHESIS_CONFIG: Partial<SynthesisConfig> = {
  synthesisInterval: 30000,  // 30 seconds between synthesis cycles
  maxActiveStrategies: 20,
  minValidationScore: 0.5,
  strategyDecayHalfLife: 200,
  gp: {
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
  },
  nmf: {
    numFactors: 5,
    maxIterations: 200,
    convergenceThreshold: 1e-4,
    regularization: 0.01,
    initMethod: 'random',
  },
  adversarial: {
    targetBotCount: 5,
    lookbackPeriods: 200,
    exploitThreshold: 0.3,
    maxStrategiesPerTarget: 3,
  },
};

// ===================== SYNTHESIS ENGINE =====================

export class SynthesisEngine extends EventEmitter {
  private config: SynthesisConfig;
  private gp: GeneticProgramming;
  private nmf: NMFEngine;
  private adversarial: AdversarialGenerator;
  private validator: StrategyValidator;
  private treeEngine: ExpressionTree;

  private isActive = false;
  private synthesisInterval: NodeJS.Timeout | null = null;
  private generation = 0;

  // Strategy tracking
  private approvedStrategies: Map<string, {
    id: string;
    tree: StrategyNode;
    source: string;
    fitness: number;
    createdAt: number;
  }> = new Map();

  private retiredStrategies: string[] = [];

  // Stats
  private totalGenerated = 0;
  private totalValidated = 0;
  private totalApproved = 0;
  private totalRetired = 0;
  private lastSynthesisAt = 0;

  constructor(config: Partial<SynthesisConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SYNTHESIS_CONFIG, ...config } as SynthesisConfig;

    this.gp = new GeneticProgramming(this.config.gp);
    this.nmf = new NMFEngine(this.config.nmf);
    this.adversarial = new AdversarialGenerator(this.config.adversarial);
    this.validator = new StrategyValidator();
    this.treeEngine = new ExpressionTree();

    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    this.gp.on('generation:complete', stats => this.emit('gp:generation', stats));
    this.gp.on('evolution:converged', data => this.emit('gp:converged', data));
    this.nmf.on('nmf:complete', data => this.emit('nmf:complete', data));
    this.nmf.on('synthesis:complete', data => this.emit('nmf:synthesis', data));
    this.adversarial.on('adversarial:generated', data => this.emit('adversarial:generated', data));
    this.validator.on('validation:complete', data => this.emit('validation:complete', data));
    this.validator.on('validation:failed', data => this.emit('validation:failed', data));
  }

  // ===================== LIFECYCLE =====================

  async start(historicalData: ObservationEvent[]): Promise<void> {
    this.emit('status', 'Starting Strategy Synthesis Engine - Layer 3');

    // Initialize GP with training data
    this.gp.setTrainingData(historicalData, []);
    this.gp.initializePopulation();

    this.isActive = true;

    // Start periodic synthesis cycles
    this.synthesisInterval = setInterval(() => {
      this.runSynthesisCycle(historicalData).catch(err => {
        this.emit('error', err);
      });
    }, this.config.synthesisInterval);

    // Run initial cycle
    await this.runSynthesisCycle(historicalData);

    this.emit('status', 'Synthesis Engine online - Strategy generation active');
  }

  async stop(): Promise<void> {
    this.emit('status', 'Stopping Synthesis Engine...');

    if (this.synthesisInterval) {
      clearInterval(this.synthesisInterval);
      this.synthesisInterval = null;
    }

    this.isActive = false;
    this.emit('status', 'Synthesis Engine stopped');
  }

  // ===================== MAIN SYNTHESIS CYCLE =====================

  async runSynthesisCycle(historicalData: ObservationEvent[]): Promise<void> {
    if (!this.isActive) return;

    this.generation++;
    this.lastSynthesisAt = Date.now();
    const cycleStart = Date.now();

    this.emit('cycle:start', { generation: this.generation });

    // Phase A: Evolve GP population (primary strategy generation)
    const gpStats = await this.gp.evolveGeneration();
    const gpBest = this.gp.getBest();

    if (gpBest && gpBest.fitness > this.config.minValidationScore) {
      await this.validateAndApprove(gpBest.id, gpBest.tree, historicalData, 'gp');
      this.totalGenerated++;
    }

    // Phase B: NMF factor synthesis (every 10 generations)
    if (this.generation % 10 === 0) {
      await this.runNMFSynthesis(historicalData);
    }

    // Phase C: Adversarial generation (every 5 generations)
    if (this.generation % 5 === 0) {
      await this.runAdversarialGeneration(historicalData);
    }

    // Phase D: Process paper trading updates
    for (const event of historicalData.slice(-10)) {
      this.validator.processPaperTrade(event);
    }

    // Phase E: Strategy lifecycle management
    this.manageStrategyLifecycles();

    const cycleDuration = Date.now() - cycleStart;
    this.emit('cycle:complete', {
      generation: this.generation,
      duration: cycleDuration,
      gpBestFitness: gpBest?.fitness || 0,
      approvedStrategies: this.approvedStrategies.size,
    });
  }

  // ===================== NMF SYNTHESIS =====================

  private async runNMFSynthesis(historicalData: ObservationEvent[]): Promise<void> {
    // Extract DNA snapshots from arena bot observations
    const dnaSnapshots = this.extractDNASnapshots(historicalData);

    if (dnaSnapshots.length < 5) return;

    // Decompose and synthesize
    const nmfResult = this.nmf.decompose(dnaSnapshots);
    const combinations = this.nmf.synthesizeStrategies(dnaSnapshots, 5);

    this.totalGenerated += combinations.length;

    // Convert NMF combinations to expression trees and validate
    for (const combo of combinations) {
      if (combo.expectedFitness > 0.3 && combo.noveltyScore > 0.2) {
        const tree = this.dnaToExpressionTree(combo.synthesizedDNA);
        await this.validateAndApprove(combo.id, tree, historicalData, 'nmf');

        // Also inject into GP population for further evolution
        this.gp.injectIndividual(tree, 'nmf_inspired');
      }
    }
  }

  // ===================== ADVERSARIAL GENERATION =====================

  private async runAdversarialGeneration(historicalData: ObservationEvent[]): Promise<void> {
    // Get top bots from observations
    const topBots = this.identifyTopBots(historicalData);

    if (topBots.length === 0) return;

    const strategies = this.adversarial.generateCounterStrategies(topBots);
    this.totalGenerated += strategies.length;

    // Validate adversarial strategies
    for (const strategy of strategies) {
      if (strategy.confidence > 0.5 && strategy.simulatedReturn > 0) {
        await this.validateAndApprove(
          strategy.id, strategy.entryConditions, historicalData, 'adversarial'
        );

        // Inject into GP for evolution
        this.gp.injectIndividual(strategy.entryConditions, 'adversarial');
      }
    }
  }

  // ===================== VALIDATION =====================

  private async validateAndApprove(
    id: string,
    tree: StrategyNode,
    data: ObservationEvent[],
    source: string
  ): Promise<boolean> {
    this.totalValidated++;

    const result = await this.validator.validateStrategy(id, tree, data);

    if (result.passed) {
      this.totalApproved++;
      this.approvedStrategies.set(id, {
        id,
        tree,
        source,
        fitness: result.results.reduce((s, r) => s + r.score, 0) / result.results.length,
        createdAt: Date.now(),
      });

      // Enforce max active strategies
      if (this.approvedStrategies.size > this.config.maxActiveStrategies) {
        this.retireWeakestStrategy();
      }

      return true;
    }

    return false;
  }

  // ===================== STRATEGY LIFECYCLE =====================

  private manageStrategyLifecycles(): void {
    const now = Date.now();
    const decayHalfLife = this.config.strategyDecayHalfLife;

    for (const [id, strategy] of this.approvedStrategies) {
      const age = (now - strategy.createdAt) / (1000 * 60 * 60); // hours

      // Check paper trading results
      const paperResults = this.validator.getPaperTradingResults(id);
      if (paperResults) {
        // Age-based decay
        const decayFactor = Math.pow(0.5, age / decayHalfLife);
        const adjustedFitness = strategy.fitness * decayFactor;

        // Retire if fitness too low or paper trading failing
        if (adjustedFitness < 0.1 || (paperResults.ready && paperResults.totalReturn < -0.05)) {
          this.retireStrategy(id, 'Performance decay');
        }
      }
    }
  }

  private retireStrategy(id: string, reason: string): void {
    this.approvedStrategies.delete(id);
    this.retiredStrategies.push(id);
    this.totalRetired++;
    this.emit('strategy:retired', { id, reason });
  }

  private retireWeakestStrategy(): void {
    let weakest: { id: string; fitness: number } | null = null;

    for (const [id, strategy] of this.approvedStrategies) {
      if (!weakest || strategy.fitness < weakest.fitness) {
        weakest = { id, fitness: strategy.fitness };
      }
    }

    if (weakest) {
      this.retireStrategy(weakest.id, 'Population overflow — weakest retired');
    }
  }

  // ===================== DATA EXTRACTION HELPERS =====================

  private extractDNASnapshots(data: ObservationEvent[]): DNASnapshot[] {
    const snapshots = new Map<string, DNASnapshot>();

    for (const event of data) {
      if (event.eventType === 'dna_mutation') {
        const payload = event.payload as any;
        const botId = payload.botId || (event as any).botId;
        if (!botId) continue;

        // Build DNA from mutation events
        let existing = snapshots.get(botId);
        if (!existing) {
          existing = {
            botId,
            genes: new Array(50).fill(0.5),
            fitness: 0,
            timestamp: event.timestamp,
            rank: 0,
          };
          snapshots.set(botId, existing);
        }

        if (payload.geneIndex !== undefined && payload.newValue !== undefined) {
          existing.genes[payload.geneIndex] = payload.newValue;
          existing.timestamp = event.timestamp;
        }
      }

      if (event.eventType === 'fitness_change') {
        const payload = event.payload as any;
        const botId = payload.botId || (event as any).botId;
        if (!botId) continue;

        let existing = snapshots.get(botId);
        if (!existing) {
          existing = {
            botId,
            genes: new Array(50).fill(0.5),
            fitness: 0,
            timestamp: event.timestamp,
            rank: 0,
          };
          snapshots.set(botId, existing);
        }

        existing.fitness = payload.newFitness || 0;
      }
    }

    return [...snapshots.values()];
  }

  private identifyTopBots(data: ObservationEvent[]): {
    botId: string;
    trades: ObservationEvent[];
    fingerprint?: StrategyFingerprint;
  }[] {
    // Group trades by bot
    const botTrades = new Map<string, ObservationEvent[]>();

    for (const event of data) {
      if (event.eventType !== 'trade') continue;
      const botId = (event.payload as any).botId || (event as any).botId;
      if (!botId) continue;

      if (!botTrades.has(botId)) botTrades.set(botId, []);
      botTrades.get(botId)!.push(event);
    }

    // Score bots by total return
    const botScores: { botId: string; score: number; trades: ObservationEvent[] }[] = [];
    for (const [botId, trades] of botTrades) {
      const totalReturn = trades.reduce((sum, t) => sum + ((t.payload as any).pnl || 0), 0);
      botScores.push({ botId, score: totalReturn, trades });
    }

    // Return top N
    return botScores
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.adversarial.targetBotCount)
      .map(b => ({ botId: b.botId, trades: b.trades }));
  }

  /**
   * Convert synthesized DNA values to an expression tree.
   * Maps gene values to tree structure decisions.
   */
  private dnaToExpressionTree(dna: number[]): StrategyNode {
    // Use DNA values to parameterize a template tree
    const rsiThreshold = 20 + dna[2] * 40;  // rsi_oversold gene
    const trendWeight = dna[22] || 0.5;       // trend_weight gene
    const atrMultiplier = 1 + (dna[15] || 0.5) * 3; // atr_multiplier gene
    const entryThreshold = dna[31] || 0.5;    // entry_threshold gene

    // Build a parameterized strategy tree from DNA
    return {
      id: `nmf_tree_${Date.now().toString(36)}`,
      type: 'logical',
      value: 'IF_THEN_ELSE',
      children: [
        // Condition: RSI + Trend combined signal
        {
          id: `nmf_and_${Date.now().toString(36)}`,
          type: 'logical',
          value: 'AND',
          children: [
            {
              id: `nmf_rsi_${Date.now().toString(36)}`,
              type: 'comparator',
              value: 'LT',
              children: [
                { id: `nmf_rsi_ind_${Date.now().toString(36)}`, type: 'indicator', value: 'RSI', params: { period: Math.round(dna[0] * 20 + 5) } },
                { id: `nmf_rsi_val_${Date.now().toString(36)}`, type: 'constant', value: String(Math.round(rsiThreshold)) },
              ],
            },
            {
              id: `nmf_trend_${Date.now().toString(36)}`,
              type: 'comparator',
              value: trendWeight > 0.5 ? 'GT' : 'LT',
              children: [
                { id: `nmf_trend_ind_${Date.now().toString(36)}`, type: 'indicator', value: 'TREND_STRENGTH' },
                { id: `nmf_trend_val_${Date.now().toString(36)}`, type: 'constant', value: String(Math.round(15 + trendWeight * 20)) },
              ],
            },
          ],
        },
        // Then: BUY
        {
          id: `nmf_buy_${Date.now().toString(36)}`,
          type: 'action',
          value: 'BUY',
          params: { confidence: Math.round(entryThreshold * 100) / 100 },
        },
        // Else: check for sell signal
        {
          id: `nmf_else_${Date.now().toString(36)}`,
          type: 'logical',
          value: 'IF_THEN_ELSE',
          children: [
            {
              id: `nmf_rsi_high_${Date.now().toString(36)}`,
              type: 'comparator',
              value: 'GT',
              children: [
                { id: `nmf_rsi2_${Date.now().toString(36)}`, type: 'indicator', value: 'RSI' },
                { id: `nmf_rsi2_val_${Date.now().toString(36)}`, type: 'constant', value: String(Math.round(100 - rsiThreshold)) },
              ],
            },
            { id: `nmf_sell_${Date.now().toString(36)}`, type: 'action', value: 'SELL', params: { confidence: Math.round(entryThreshold * 100) / 100 } },
            { id: `nmf_hold_${Date.now().toString(36)}`, type: 'action', value: 'HOLD', params: { confidence: 0.3 } },
          ],
        },
      ],
    };
  }

  // ===================== PUBLIC API =====================

  getStatus(): SynthesisStatus {
    return {
      active: this.isActive,
      generation: this.generation,
      strategiesGenerated: this.totalGenerated,
      strategiesValidated: this.totalValidated,
      strategiesApproved: this.totalApproved,
      strategiesRetired: this.totalRetired,
      activeStrategies: this.approvedStrategies.size,
      bestStrategyFitness: this.getBestFitness(),
      avgStrategyFitness: this.getAvgFitness(),
      nmfFactorsExtracted: this.nmf.getFactors().length,
      adversarialStrategies: this.adversarial.getGeneratedStrategies().length,
      lastSynthesisAt: this.lastSynthesisAt,
    };
  }

  private getBestFitness(): number {
    let best = 0;
    for (const strategy of this.approvedStrategies.values()) {
      best = Math.max(best, strategy.fitness);
    }
    return best;
  }

  private getAvgFitness(): number {
    if (this.approvedStrategies.size === 0) return 0;
    let total = 0;
    for (const strategy of this.approvedStrategies.values()) {
      total += strategy.fitness;
    }
    return total / this.approvedStrategies.size;
  }

  getApprovedStrategies(): { id: string; source: string; fitness: number }[] {
    return [...this.approvedStrategies.values()].map(s => ({
      id: s.id,
      source: s.source,
      fitness: s.fitness,
    }));
  }

  getGPEngine(): GeneticProgramming { return this.gp; }
  getNMFEngine(): NMFEngine { return this.nmf; }
  getAdversarialEngine(): AdversarialGenerator { return this.adversarial; }
  getValidator(): StrategyValidator { return this.validator; }
}

export default SynthesisEngine;
