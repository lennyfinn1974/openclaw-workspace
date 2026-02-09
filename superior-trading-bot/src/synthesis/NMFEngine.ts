/**
 * Non-negative Matrix Factorization (NMF) Engine
 * Layer 3: Strategy Synthesis
 *
 * Decomposes bot DNA matrices into latent factors that represent
 * abstract strategy principles. Each factor is interpretable as
 * a "part" that combines additively (why NMF > PCA for DNA).
 *
 * DNA Matrix (21 bots x 50 genes) → W (21 x k) × H (k x 50)
 * - W: how much each bot uses each factor
 * - H: what genes each factor activates
 */

import { EventEmitter } from 'events';
import { Matrix } from 'ml-matrix';
import {
  NMFConfig, NMFResult, LatentFactor, DNASnapshot, FactorCombination
} from '../types/synthesis';

// ===================== DEFAULT CONFIG =====================

const DEFAULT_NMF_CONFIG: NMFConfig = {
  numFactors: 5,
  maxIterations: 200,
  convergenceThreshold: 1e-4,
  regularization: 0.01,
  initMethod: 'random',
};

// ===================== GENE NAMES (50-gene DNA) =====================

const GENE_NAMES: string[] = [
  'rsi_period', 'rsi_overbought', 'rsi_oversold', 'rsi_weight',
  'macd_fast', 'macd_slow', 'macd_signal', 'macd_weight',
  'bb_period', 'bb_stddev', 'bb_weight',
  'ema_fast', 'ema_slow', 'ema_weight',
  'atr_period', 'atr_multiplier', 'stop_loss_atr', 'take_profit_atr',
  'volume_threshold', 'volume_weight',
  'trend_period', 'trend_threshold', 'trend_weight',
  'momentum_period', 'momentum_weight',
  'position_size_base', 'position_size_scale', 'max_position_pct',
  'risk_per_trade', 'max_daily_risk', 'max_drawdown_limit',
  'entry_threshold', 'exit_threshold', 'signal_combination',
  'regime_sensitivity', 'regime_adaptation_speed',
  'hold_period_min', 'hold_period_max',
  'profit_target_pct', 'trailing_stop_pct',
  'reentry_delay', 'max_trades_per_day',
  'volatility_filter', 'correlation_filter',
  'mean_reversion_speed', 'trend_following_speed',
  'contrarian_bias', 'momentum_bias',
  'time_decay_factor', 'confidence_threshold',
];

let factorCombinationId = 0;

// ===================== NMF ENGINE =====================

export class NMFEngine extends EventEmitter {
  private config: NMFConfig;
  private latestResult: NMFResult | null = null;
  private dnaHistory: DNASnapshot[][] = []; // snapshots over time
  private factorEvolution: Map<number, { timestamp: number; fitness: number }[]> = new Map();

  constructor(config: Partial<NMFConfig> = {}) {
    super();
    this.config = { ...DEFAULT_NMF_CONFIG, ...config };
  }

  // ===================== CORE NMF ALGORITHM =====================

  /**
   * Perform NMF decomposition on bot DNA matrix.
   * Uses multiplicative update rules (Lee & Seung, 2001).
   */
  decompose(dnaSnapshots: DNASnapshot[]): NMFResult {
    if (dnaSnapshots.length < 2) {
      throw new Error('Need at least 2 bot DNA snapshots for NMF');
    }

    // Build DNA matrix: bots x genes
    const V = this.buildDNAMatrix(dnaSnapshots);
    const [m, n] = [V.rows, V.columns]; // m=bots, n=genes
    const k = Math.min(this.config.numFactors, m, n);

    // Initialize W and H
    let [W, H] = this.initializeMatrices(V, m, n, k);

    let prevError = Infinity;
    let iterations = 0;
    let converged = false;

    // Multiplicative Update Rules with regularization
    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      iterations = iter + 1;

      // Update H: H = H * (W^T * V) / (W^T * W * H + lambda * H)
      const WtV = W.transpose().mmul(V);
      const WtWH = W.transpose().mmul(W).mmul(H);
      const regH = Matrix.mul(H, this.config.regularization);

      for (let i = 0; i < k; i++) {
        for (let j = 0; j < n; j++) {
          const numerator = WtV.get(i, j);
          const denominator = WtWH.get(i, j) + regH.get(i, j) + 1e-10;
          H.set(i, j, H.get(i, j) * (numerator / denominator));
        }
      }

      // Update W: W = W * (V * H^T) / (W * H * H^T + lambda * W)
      const VHt = V.mmul(H.transpose());
      const WHHt = W.mmul(H).mmul(H.transpose());
      const regW = Matrix.mul(W, this.config.regularization);

      for (let i = 0; i < m; i++) {
        for (let j = 0; j < k; j++) {
          const numerator = VHt.get(i, j);
          const denominator = WHHt.get(i, j) + regW.get(i, j) + 1e-10;
          W.set(i, j, W.get(i, j) * (numerator / denominator));
        }
      }

      // Calculate reconstruction error
      const reconstruction = W.mmul(H);
      const diff = Matrix.sub(V, reconstruction);
      const error = diff.to2DArray().reduce((sum, row) =>
        sum + row.reduce((rSum, val) => rSum + val * val, 0), 0
      );

      // Check convergence
      if (Math.abs(prevError - error) / (prevError + 1e-10) < this.config.convergenceThreshold) {
        converged = true;
        break;
      }
      prevError = error;
    }

    // Build factor descriptions
    const factors = this.interpretFactors(W, H, dnaSnapshots);

    const result: NMFResult = {
      W: W.to2DArray(),
      H: H.to2DArray(),
      factors,
      reconstructionError: prevError,
      iterations,
      converged,
    };

    this.latestResult = result;
    this.dnaHistory.push(dnaSnapshots);
    this.emit('nmf:complete', {
      factors: factors.length,
      error: prevError,
      converged,
      iterations,
    });

    return result;
  }

  // ===================== MATRIX INITIALIZATION =====================

  private buildDNAMatrix(snapshots: DNASnapshot[]): Matrix {
    const maxGenes = Math.max(...snapshots.map(s => s.genes.length));
    const data: number[][] = [];

    for (const snapshot of snapshots) {
      const row = [...snapshot.genes];
      // Pad with zeros if needed
      while (row.length < maxGenes) row.push(0);
      // Ensure non-negative (NMF requirement)
      data.push(row.map(v => Math.max(0, v)));
    }

    return new Matrix(data);
  }

  private initializeMatrices(V: Matrix, m: number, n: number, k: number): [Matrix, Matrix] {
    switch (this.config.initMethod) {
      case 'nndsvd':
        return this.nndsvdInit(V, m, n, k);
      case 'nndsvda':
        return this.nndsvdaInit(V, m, n, k);
      default:
        return this.randomInit(m, n, k);
    }
  }

  private randomInit(m: number, n: number, k: number): [Matrix, Matrix] {
    const wData: number[][] = [];
    const hData: number[][] = [];

    for (let i = 0; i < m; i++) {
      wData.push(Array.from({ length: k }, () => Math.random()));
    }
    for (let i = 0; i < k; i++) {
      hData.push(Array.from({ length: n }, () => Math.random()));
    }

    return [new Matrix(wData), new Matrix(hData)];
  }

  /**
   * Non-negative Double SVD initialization.
   * Better starting point than random, faster convergence.
   */
  private nndsvdInit(V: Matrix, m: number, n: number, k: number): [Matrix, Matrix] {
    // Simplified NNDSVD: use SVD and take absolute values
    const svd = new (Matrix as any).SVD(V, { autoTranspose: true });

    if (!svd || !svd.leftSingularVectors) {
      return this.randomInit(m, n, k);
    }

    const U = svd.leftSingularVectors;
    const S = svd.diagonal;
    const Vt = svd.rightSingularVectors;

    const W = Matrix.zeros(m, k);
    const H = Matrix.zeros(k, n);

    for (let j = 0; j < k; j++) {
      if (j >= S.length) break;

      const sqrtS = Math.sqrt(S[j]);
      for (let i = 0; i < m; i++) {
        W.set(i, j, Math.abs(U.get(i, j)) * sqrtS);
      }
      for (let i = 0; i < n; i++) {
        H.set(j, i, Math.abs(Vt.get(j, i)) * sqrtS);
      }
    }

    return [W, H];
  }

  private nndsvdaInit(V: Matrix, m: number, n: number, k: number): [Matrix, Matrix] {
    const [W, H] = this.nndsvdInit(V, m, n, k);
    const avg = V.mean();

    // Replace zeros with small random values based on average
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < k; j++) {
        if (W.get(i, j) === 0) W.set(i, j, avg * Math.random() * 0.01);
      }
    }
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < n; j++) {
        if (H.get(i, j) === 0) H.set(i, j, avg * Math.random() * 0.01);
      }
    }

    return [W, H];
  }

  // ===================== FACTOR INTERPRETATION =====================

  private interpretFactors(W: Matrix, H: Matrix, snapshots: DNASnapshot[]): LatentFactor[] {
    const k = H.rows;
    const factors: LatentFactor[] = [];

    for (let f = 0; f < k; f++) {
      // Top genes for this factor
      const geneLoadings = H.getRow(f);
      const indexedLoadings = geneLoadings.map((loading, index) => ({
        index,
        loading,
        name: GENE_NAMES[index] || `gene_${index}`,
      }));
      indexedLoadings.sort((a, b) => b.loading - a.loading);
      const topGenes = indexedLoadings.slice(0, 10);

      // Bot weights for this factor
      const botWeights = snapshots.map((snapshot, i) => ({
        botId: snapshot.botId,
        weight: W.get(i, f),
      }));
      botWeights.sort((a, b) => b.weight - a.weight);

      // Correlate factor weights with fitness
      const weights = snapshots.map((_, i) => W.get(i, f));
      const fitnesses = snapshots.map(s => s.fitness);
      const correlation = this.pearsonCorrelation(weights, fitnesses);

      // Auto-generate factor name
      const name = this.generateFactorName(topGenes, correlation);
      const interpretation = this.generateFactorInterpretation(topGenes, botWeights, correlation);

      factors.push({
        id: f,
        name,
        geneLoadings,
        topGenes,
        botWeights,
        correlationWithFitness: correlation,
        interpretation,
      });
    }

    return factors;
  }

  private generateFactorName(
    topGenes: { index: number; loading: number; name: string }[],
    fitnessCorrelation: number
  ): string {
    const primary = topGenes[0]?.name || 'unknown';
    const secondary = topGenes[1]?.name || '';

    const categories = this.categorizeGenes(topGenes.slice(0, 5).map(g => g.name));
    const prefix = fitnessCorrelation > 0.3 ? 'Alpha' : fitnessCorrelation < -0.3 ? 'Anti' : 'Neutral';

    if (categories.has('risk')) return `${prefix}-Risk-${categories.has('momentum') ? 'Momentum' : 'Management'}`;
    if (categories.has('trend')) return `${prefix}-Trend-Following`;
    if (categories.has('mean_reversion')) return `${prefix}-Mean-Reversion`;
    if (categories.has('timing')) return `${prefix}-Timing`;
    if (categories.has('sizing')) return `${prefix}-Position-Sizing`;

    return `${prefix}-Factor-${primary.split('_')[0]}`;
  }

  private generateFactorInterpretation(
    topGenes: { index: number; loading: number; name: string }[],
    botWeights: { botId: string; weight: number }[],
    fitnessCorrelation: number
  ): string {
    const geneList = topGenes.slice(0, 3).map(g => g.name).join(', ');
    const topBots = botWeights.slice(0, 3).map(b => b.botId).join(', ');
    const corrDesc = fitnessCorrelation > 0.3 ? 'positively' : fitnessCorrelation < -0.3 ? 'negatively' : 'weakly';

    return `Dominated by genes [${geneList}]. Most used by bots [${topBots}]. ` +
      `${corrDesc} correlated with fitness (r=${fitnessCorrelation.toFixed(3)}).`;
  }

  private categorizeGenes(geneNames: string[]): Set<string> {
    const categories = new Set<string>();
    for (const name of geneNames) {
      if (name.includes('risk') || name.includes('stop') || name.includes('drawdown')) categories.add('risk');
      if (name.includes('trend') || name.includes('ema') || name.includes('momentum')) categories.add('trend');
      if (name.includes('reversion') || name.includes('contrarian') || name.includes('mean')) categories.add('mean_reversion');
      if (name.includes('hold') || name.includes('delay') || name.includes('entry') || name.includes('exit')) categories.add('timing');
      if (name.includes('size') || name.includes('position') || name.includes('kelly')) categories.add('sizing');
      if (name.includes('momentum') || name.includes('roc')) categories.add('momentum');
    }
    return categories;
  }

  // ===================== STRATEGY SYNTHESIS FROM FACTORS =====================

  /**
   * Generate novel DNA combinations by manipulating latent factors.
   * Three methods: amplification, novel combination, gap filling.
   */
  synthesizeStrategies(dnaSnapshots: DNASnapshot[], count: number = 5): FactorCombination[] {
    if (!this.latestResult) {
      this.decompose(dnaSnapshots);
    }
    if (!this.latestResult) return [];

    const { W, H, factors } = this.latestResult;
    const combinations: FactorCombination[] = [];
    const k = factors.length;

    // Method 1: Amplify high-fitness factors
    const amplified = this.amplifyWinningFactors(W, H, factors, dnaSnapshots, Math.ceil(count * 0.4));
    combinations.push(...amplified);

    // Method 2: Novel combinations of factors not seen together
    const novel = this.createNovelCombinations(W, H, factors, dnaSnapshots, Math.ceil(count * 0.3));
    combinations.push(...novel);

    // Method 3: Fill gaps in factor space
    const gapFilled = this.fillFactorGaps(W, H, factors, dnaSnapshots, Math.ceil(count * 0.3));
    combinations.push(...gapFilled);

    this.emit('synthesis:complete', { count: combinations.length });
    return combinations;
  }

  /**
   * Method A: Amplify factors correlated with high fitness.
   */
  private amplifyWinningFactors(
    W: number[][], H: number[][], factors: LatentFactor[],
    snapshots: DNASnapshot[], count: number
  ): FactorCombination[] {
    const results: FactorCombination[] = [];
    const k = factors.length;

    // Sort factors by fitness correlation
    const sorted = [...factors].sort((a, b) =>
      b.correlationWithFitness - a.correlationWithFitness
    );

    for (let i = 0; i < count; i++) {
      const weights = new Array(k).fill(0);

      // Amplify top factors, suppress low-fitness factors
      for (let f = 0; f < k; f++) {
        const factor = sorted[f];
        if (factor.correlationWithFitness > 0.1) {
          // Amplify: base weight * (1 + correlation) * random perturbation
          weights[factor.id] = (1 + factor.correlationWithFitness) * (0.8 + Math.random() * 0.4);
        } else if (factor.correlationWithFitness < -0.1) {
          // Suppress: small weight
          weights[factor.id] = 0.1 * Math.random();
        } else {
          // Neutral: moderate weight
          weights[factor.id] = 0.5 * Math.random();
        }
      }

      const dna = this.factorWeightsToGenes(weights, H);
      const novelty = this.calculateNovelty(dna, snapshots);
      const expectedFitness = this.predictFitness(weights, factors);

      results.push({
        id: `nmf_amp_${++factorCombinationId}`,
        factorWeights: weights,
        synthesizedDNA: dna,
        noveltyScore: novelty,
        expectedFitness,
        source: 'amplification',
      });
    }

    return results;
  }

  /**
   * Method B: Create combinations of factors that haven't been combined.
   */
  private createNovelCombinations(
    W: number[][], H: number[][], factors: LatentFactor[],
    snapshots: DNASnapshot[], count: number
  ): FactorCombination[] {
    const results: FactorCombination[] = [];
    const k = factors.length;

    // Find which factor pairs are rare in current population
    const pairFrequency = new Map<string, number>();
    for (const botWeights of W) {
      const activeFactors = botWeights
        .map((w, i) => ({ i, w }))
        .filter(x => x.w > 0.3)
        .map(x => x.i);

      for (let a = 0; a < activeFactors.length; a++) {
        for (let b = a + 1; b < activeFactors.length; b++) {
          const key = `${activeFactors[a]}-${activeFactors[b]}`;
          pairFrequency.set(key, (pairFrequency.get(key) || 0) + 1);
        }
      }
    }

    // Find rare combinations
    const allPairs: { a: number; b: number; freq: number }[] = [];
    for (let a = 0; a < k; a++) {
      for (let b = a + 1; b < k; b++) {
        const key = `${a}-${b}`;
        allPairs.push({ a, b, freq: pairFrequency.get(key) || 0 });
      }
    }
    allPairs.sort((x, y) => x.freq - y.freq); // rarest first

    for (let i = 0; i < Math.min(count, allPairs.length); i++) {
      const pair = allPairs[i];
      const weights = new Array(k).fill(0.1);
      weights[pair.a] = 0.7 + Math.random() * 0.3;
      weights[pair.b] = 0.7 + Math.random() * 0.3;

      const dna = this.factorWeightsToGenes(weights, H);
      const novelty = this.calculateNovelty(dna, snapshots);
      const expectedFitness = this.predictFitness(weights, factors);

      results.push({
        id: `nmf_novel_${++factorCombinationId}`,
        factorWeights: weights,
        synthesizedDNA: dna,
        noveltyScore: novelty,
        expectedFitness,
        source: 'novel_combination',
      });
    }

    return results;
  }

  /**
   * Method C: Fill gaps in factor space where no bots exist.
   */
  private fillFactorGaps(
    W: number[][], H: number[][], factors: LatentFactor[],
    snapshots: DNASnapshot[], count: number
  ): FactorCombination[] {
    const results: FactorCombination[] = [];
    const k = factors.length;

    // Find regions in factor space with no bots
    // Use simple grid search in k-dimensional space
    for (let i = 0; i < count; i++) {
      // Generate random point in factor space
      const candidate = new Array(k).fill(0).map(() => Math.random());

      // Check distance to all existing bots
      let minDist = Infinity;
      for (const botWeights of W) {
        const dist = this.euclideanDistance(candidate, botWeights);
        minDist = Math.min(minDist, dist);
      }

      // Only use if far enough from existing bots (novelty)
      if (minDist > 0.3) {
        const dna = this.factorWeightsToGenes(candidate, H);
        const novelty = this.calculateNovelty(dna, snapshots);
        const expectedFitness = this.predictFitness(candidate, factors);

        results.push({
          id: `nmf_gap_${++factorCombinationId}`,
          factorWeights: candidate,
          synthesizedDNA: dna,
          noveltyScore: novelty,
          expectedFitness,
          source: 'gap_filling',
        });
      }
    }

    return results;
  }

  // ===================== UTILITY METHODS =====================

  /**
   * Convert factor weights back to gene values: genes = weights × H
   */
  private factorWeightsToGenes(weights: number[], H: number[][]): number[] {
    const numGenes = H[0]?.length || 0;
    const genes = new Array(numGenes).fill(0);

    for (let g = 0; g < numGenes; g++) {
      for (let f = 0; f < weights.length; f++) {
        genes[g] += weights[f] * (H[f]?.[g] || 0);
      }
      genes[g] = Math.max(0, genes[g]); // ensure non-negative
    }

    return genes;
  }

  /**
   * Calculate how novel a DNA vector is compared to existing bots.
   */
  private calculateNovelty(dna: number[], snapshots: DNASnapshot[]): number {
    if (snapshots.length === 0) return 1;

    let totalDist = 0;
    for (const snapshot of snapshots) {
      totalDist += this.euclideanDistance(dna, snapshot.genes);
    }
    const avgDist = totalDist / snapshots.length;

    // Normalize: 0 = identical to average, 1 = very different
    return Math.min(1, avgDist / 10);
  }

  /**
   * Predict fitness based on factor-fitness correlations.
   */
  private predictFitness(weights: number[], factors: LatentFactor[]): number {
    let predicted = 0;
    for (let f = 0; f < factors.length; f++) {
      predicted += weights[f] * factors[f].correlationWithFitness;
    }
    return Math.tanh(predicted); // normalize to [-1, 1]
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let covXY = 0, varX = 0, varY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      covXY += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }

    const denom = Math.sqrt(varX * varY);
    return denom > 0 ? covXY / denom : 0;
  }

  // ===================== PUBLIC API =====================

  getLatestResult(): NMFResult | null {
    return this.latestResult;
  }

  getFactors(): LatentFactor[] {
    return this.latestResult?.factors || [];
  }

  getFactorEvolution(): Map<number, { timestamp: number; fitness: number }[]> {
    return this.factorEvolution;
  }

  getStats(): {
    hasResult: boolean;
    factors: number;
    reconstructionError: number;
    converged: boolean;
    historySnapshots: number;
  } {
    return {
      hasResult: this.latestResult !== null,
      factors: this.latestResult?.factors.length || 0,
      reconstructionError: this.latestResult?.reconstructionError || 0,
      converged: this.latestResult?.converged || false,
      historySnapshots: this.dnaHistory.length,
    };
  }
}

export default NMFEngine;
