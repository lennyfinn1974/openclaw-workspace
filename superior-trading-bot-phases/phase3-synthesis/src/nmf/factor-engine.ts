/**
 * NMF Factor Analysis Engine — Decomposes bot DNA into latent strategy factors.
 *
 * DNA Matrix (21 bots x 50 genes) → W (21 x k) × H (k x 50)
 * Uses multiplicative update rules (Lee & Seung, 2001) with:
 * - Temporal decay weighting for recent snapshots
 * - Factor trend tracking (strengthening/weakening over time)
 * - Three synthesis modes: amplification, novel combination, gap filling
 */

import { EventEmitter } from 'events';
import { Matrix } from 'ml-matrix';
import {
  NMFConfig, NMFResult, LatentFactor, DNASnapshot,
  FactorCombination, StrategyNode,
} from '../types';

const DEFAULT_CONFIG: NMFConfig = {
  numFactors: 5,
  maxIterations: 200,
  convergenceThreshold: 1e-4,
  regularization: 0.01,
  initMethod: 'random',
  temporalDecay: 0.95,
};

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

let comboId = 0;

export class NMFFactorEngine extends EventEmitter {
  private config: NMFConfig;
  private latestResult: NMFResult | null = null;
  private snapshotHistory: DNASnapshot[][] = [];
  private factorTrends: Map<number, { timestamp: number; correlation: number }[]> = new Map();

  constructor(config: Partial<NMFConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===================== CORE NMF =====================

  decompose(snapshots: DNASnapshot[]): NMFResult {
    if (snapshots.length < 2) throw new Error('Need >= 2 snapshots for NMF');

    const V = this.buildMatrix(snapshots);
    const [m, n] = [V.rows, V.columns];
    const k = Math.min(this.config.numFactors, m, n);

    let [W, H] = this.initMatrices(m, n, k);
    let prevErr = Infinity;
    let iterations = 0;
    let converged = false;

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      iterations = iter + 1;

      // Update H: H *= (W^T V) / (W^T W H + λH)
      const WtV = W.transpose().mmul(V);
      const WtWH = W.transpose().mmul(W).mmul(H);

      for (let i = 0; i < k; i++) {
        for (let j = 0; j < n; j++) {
          const num = WtV.get(i, j);
          const den = WtWH.get(i, j) + this.config.regularization * H.get(i, j) + 1e-10;
          H.set(i, j, H.get(i, j) * (num / den));
        }
      }

      // Update W: W *= (V H^T) / (W H H^T + λW)
      const VHt = V.mmul(H.transpose());
      const WHHt = W.mmul(H).mmul(H.transpose());

      for (let i = 0; i < m; i++) {
        for (let j = 0; j < k; j++) {
          const num = VHt.get(i, j);
          const den = WHHt.get(i, j) + this.config.regularization * W.get(i, j) + 1e-10;
          W.set(i, j, W.get(i, j) * (num / den));
        }
      }

      // Reconstruction error
      const diff = Matrix.sub(V, W.mmul(H));
      const err = diff.to2DArray().reduce((s, row) => s + row.reduce((rs, v) => rs + v * v, 0), 0);

      if (Math.abs(prevErr - err) / (prevErr + 1e-10) < this.config.convergenceThreshold) {
        converged = true;
        break;
      }
      prevErr = err;
    }

    const factors = this.interpretFactors(W, H, snapshots);
    this.updateTrends(factors);

    const result: NMFResult = {
      W: W.to2DArray(), H: H.to2DArray(), factors,
      reconstructionError: prevErr, iterations, converged,
    };

    this.latestResult = result;
    this.snapshotHistory.push(snapshots);
    this.emit('nmf:complete', { factors: factors.length, error: prevErr, converged, iterations });
    return result;
  }

  // ===================== MATRIX INIT =====================

  private buildMatrix(snapshots: DNASnapshot[]): Matrix {
    const maxGenes = Math.max(...snapshots.map(s => s.genes.length));
    const data: number[][] = snapshots.map(s => {
      const row = [...s.genes];
      while (row.length < maxGenes) row.push(0);
      return row.map(v => Math.max(0, v));
    });
    return new Matrix(data);
  }

  private initMatrices(m: number, n: number, k: number): [Matrix, Matrix] {
    const wData = Array.from({ length: m }, () => Array.from({ length: k }, () => Math.random()));
    const hData = Array.from({ length: k }, () => Array.from({ length: n }, () => Math.random()));
    return [new Matrix(wData), new Matrix(hData)];
  }

  // ===================== FACTOR INTERPRETATION =====================

  private interpretFactors(W: Matrix, H: Matrix, snapshots: DNASnapshot[]): LatentFactor[] {
    const k = H.rows;
    const factors: LatentFactor[] = [];

    for (let f = 0; f < k; f++) {
      const loadings = H.getRow(f);
      const indexed = loadings.map((l, i) => ({ index: i, loading: l, name: GENE_NAMES[i] || `gene_${i}` }));
      indexed.sort((a, b) => b.loading - a.loading);
      const topGenes = indexed.slice(0, 10);

      const botWeights = snapshots.map((s, i) => ({ botId: s.botId, weight: W.get(i, f) }));
      botWeights.sort((a, b) => b.weight - a.weight);

      const weights = snapshots.map((_, i) => W.get(i, f));
      const fitnesses = snapshots.map(s => s.fitness);
      const corr = this.pearson(weights, fitnesses);

      const name = this.nameFromGenes(topGenes, corr);
      const interpretation = this.interpretFactor(topGenes, botWeights, corr);
      const trend = this.computeTrend(f);

      factors.push({ id: f, name, geneLoadings: loadings, topGenes, botWeights, correlationWithFitness: corr, interpretation, trend });
    }

    return factors;
  }

  private nameFromGenes(top: { name: string }[], corr: number): string {
    const cats = new Set<string>();
    for (const { name } of top.slice(0, 5)) {
      if (name.includes('risk') || name.includes('stop') || name.includes('drawdown')) cats.add('Risk');
      if (name.includes('trend') || name.includes('ema') || name.includes('momentum')) cats.add('Trend');
      if (name.includes('reversion') || name.includes('contrarian')) cats.add('MeanReversion');
      if (name.includes('hold') || name.includes('delay') || name.includes('entry')) cats.add('Timing');
      if (name.includes('size') || name.includes('position')) cats.add('Sizing');
    }
    const prefix = corr > 0.3 ? 'Alpha' : corr < -0.3 ? 'Anti' : 'Neutral';
    const cat = [...cats][0] || top[0]?.name.split('_')[0] || 'Unknown';
    return `${prefix}-${cat}`;
  }

  private interpretFactor(top: { name: string }[], bots: { botId: string }[], corr: number): string {
    const genes = top.slice(0, 3).map(g => g.name).join(', ');
    const topBots = bots.slice(0, 3).map(b => b.botId).join(', ');
    const desc = corr > 0.3 ? 'positively' : corr < -0.3 ? 'negatively' : 'weakly';
    return `Dominated by [${genes}]. Used by [${topBots}]. ${desc} correlated with fitness (r=${corr.toFixed(3)}).`;
  }

  private computeTrend(factorId: number): 'strengthening' | 'stable' | 'weakening' {
    const history = this.factorTrends.get(factorId);
    if (!history || history.length < 2) return 'stable';
    const recent = history.slice(-5);
    const first = recent[0].correlation;
    const last = recent[recent.length - 1].correlation;
    const delta = last - first;
    if (delta > 0.05) return 'strengthening';
    if (delta < -0.05) return 'weakening';
    return 'stable';
  }

  private updateTrends(factors: LatentFactor[]): void {
    const now = Date.now();
    for (const f of factors) {
      if (!this.factorTrends.has(f.id)) this.factorTrends.set(f.id, []);
      this.factorTrends.get(f.id)!.push({ timestamp: now, correlation: f.correlationWithFitness });
      // Keep last 50 snapshots
      const arr = this.factorTrends.get(f.id)!;
      if (arr.length > 50) this.factorTrends.set(f.id, arr.slice(-50));
    }
  }

  // ===================== STRATEGY SYNTHESIS =====================

  synthesizeStrategies(snapshots: DNASnapshot[], count: number = 5): FactorCombination[] {
    if (!this.latestResult) this.decompose(snapshots);
    if (!this.latestResult) return [];

    const { W, H, factors } = this.latestResult;
    const results: FactorCombination[] = [];

    // Method 1: Amplify winning factors (40%)
    results.push(...this.amplifyWinners(W, H, factors, snapshots, Math.ceil(count * 0.3)));

    // Method 2: Novel factor combinations (30%)
    results.push(...this.novelCombinations(W, H, factors, snapshots, Math.ceil(count * 0.25)));

    // Method 3: Fill gaps in factor space (15%)
    results.push(...this.fillGaps(W, H, factors, snapshots, Math.ceil(count * 0.2)));

    // Method 4: Temporal blends — combine current winners with historical winners (15%)
    results.push(...this.temporalBlends(W, H, factors, snapshots, Math.ceil(count * 0.25)));

    this.emit('synthesis:complete', { count: results.length });
    return results;
  }

  private amplifyWinners(W: number[][], H: number[][], factors: LatentFactor[], snaps: DNASnapshot[], count: number): FactorCombination[] {
    const results: FactorCombination[] = [];
    const sorted = [...factors].sort((a, b) => b.correlationWithFitness - a.correlationWithFitness);

    for (let i = 0; i < count; i++) {
      const weights = new Array(factors.length).fill(0);
      for (const f of sorted) {
        if (f.correlationWithFitness > 0.1) {
          weights[f.id] = (1 + f.correlationWithFitness) * (0.8 + Math.random() * 0.4);
        } else if (f.correlationWithFitness < -0.1) {
          weights[f.id] = 0.1 * Math.random();
        } else {
          weights[f.id] = 0.5 * Math.random();
        }
      }
      const dna = this.weightsToDNA(weights, H);
      results.push({
        id: `nmf_amp_${++comboId}`, factorWeights: weights, synthesizedDNA: dna,
        noveltyScore: this.novelty(dna, snaps), expectedFitness: this.predictFitness(weights, factors),
        source: 'amplification',
      });
    }
    return results;
  }

  private novelCombinations(W: number[][], H: number[][], factors: LatentFactor[], snaps: DNASnapshot[], count: number): FactorCombination[] {
    const results: FactorCombination[] = [];
    const k = factors.length;

    // Find rare pairs
    const pairFreq = new Map<string, number>();
    for (const bw of W) {
      const active = bw.map((w, i) => ({ i, w })).filter(x => x.w > 0.3).map(x => x.i);
      for (let a = 0; a < active.length; a++) {
        for (let b = a + 1; b < active.length; b++) {
          const key = `${active[a]}-${active[b]}`;
          pairFreq.set(key, (pairFreq.get(key) || 0) + 1);
        }
      }
    }

    const pairs: { a: number; b: number; freq: number }[] = [];
    for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
      pairs.push({ a, b, freq: pairFreq.get(`${a}-${b}`) || 0 });
    }
    pairs.sort((x, y) => x.freq - y.freq);

    for (let i = 0; i < Math.min(count, pairs.length); i++) {
      const p = pairs[i];
      const weights = new Array(k).fill(0.1);
      weights[p.a] = 0.7 + Math.random() * 0.3;
      weights[p.b] = 0.7 + Math.random() * 0.3;
      const dna = this.weightsToDNA(weights, H);
      results.push({
        id: `nmf_novel_${++comboId}`, factorWeights: weights, synthesizedDNA: dna,
        noveltyScore: this.novelty(dna, snaps), expectedFitness: this.predictFitness(weights, factors),
        source: 'novel_combination',
      });
    }
    return results;
  }

  private fillGaps(W: number[][], H: number[][], factors: LatentFactor[], snaps: DNASnapshot[], count: number): FactorCombination[] {
    const results: FactorCombination[] = [];
    const k = factors.length;

    for (let i = 0; i < count * 3; i++) {
      const candidate = Array.from({ length: k }, () => Math.random());
      let minDist = Infinity;
      for (const bw of W) {
        const d = this.eucDist(candidate, bw);
        if (d < minDist) minDist = d;
      }
      if (minDist > 0.3) {
        const dna = this.weightsToDNA(candidate, H);
        results.push({
          id: `nmf_gap_${++comboId}`, factorWeights: candidate, synthesizedDNA: dna,
          noveltyScore: this.novelty(dna, snaps), expectedFitness: this.predictFitness(candidate, factors),
          source: 'gap_filling',
        });
        if (results.length >= count) break;
      }
    }
    return results;
  }

  private temporalBlends(W: number[][], H: number[][], factors: LatentFactor[], snaps: DNASnapshot[], count: number): FactorCombination[] {
    const results: FactorCombination[] = [];
    if (this.snapshotHistory.length < 2) return results;

    const k = factors.length;
    const prevSnaps = this.snapshotHistory[this.snapshotHistory.length - 2];
    const currSnaps = snaps;

    for (let i = 0; i < count; i++) {
      // Blend current top bot DNA with historical top bot DNA
      const currTop = [...currSnaps].sort((a, b) => b.fitness - a.fitness)[0];
      const prevTop = [...prevSnaps].sort((a, b) => b.fitness - a.fitness)[Math.floor(Math.random() * Math.min(3, prevSnaps.length))];
      if (!currTop || !prevTop) continue;

      const blend = Math.random() * 0.4 + 0.3; // 30-70% blend
      const dna = currTop.genes.map((g, idx) => {
        const pg = prevTop.genes[idx] ?? g;
        return Math.max(0, g * blend + pg * (1 - blend));
      });

      // Approximate factor weights from DNA
      const weights = new Array(k).fill(0.5);
      for (let f = 0; f < k; f++) {
        weights[f] = factors[f].correlationWithFitness > 0 ? 0.6 + Math.random() * 0.4 : 0.2 * Math.random();
      }

      results.push({
        id: `nmf_blend_${++comboId}`, factorWeights: weights, synthesizedDNA: dna,
        noveltyScore: this.novelty(dna, snaps), expectedFitness: this.predictFitness(weights, factors),
        source: 'temporal_blend',
      });
    }
    return results;
  }

  // ===================== DNA → EXPRESSION TREE =====================

  dnaToExpressionTree(dna: number[]): StrategyNode {
    const rsiThreshold = 20 + (dna[2] ?? 0.5) * 40;
    const trendWeight = dna[22] ?? 0.5;
    const entryThreshold = dna[31] ?? 0.5;
    const ts = Date.now().toString(36);

    return {
      id: `nmf_tree_${ts}`, type: 'logical', value: 'IF_THEN_ELSE',
      children: [
        {
          id: `nmf_and_${ts}`, type: 'logical', value: 'AND',
          children: [
            {
              id: `nmf_rsi_${ts}`, type: 'comparator', value: 'LT',
              children: [
                { id: `nmf_ri_${ts}`, type: 'indicator', value: 'RSI', params: { period: Math.round((dna[0] ?? 0.5) * 20 + 5) } },
                { id: `nmf_rv_${ts}`, type: 'constant', value: String(Math.round(rsiThreshold)) },
              ],
            },
            {
              id: `nmf_tr_${ts}`, type: 'comparator', value: trendWeight > 0.5 ? 'GT' : 'LT',
              children: [
                { id: `nmf_ti_${ts}`, type: 'indicator', value: 'TREND_STRENGTH' },
                { id: `nmf_tv_${ts}`, type: 'constant', value: String(Math.round(15 + trendWeight * 20)) },
              ],
            },
          ],
        },
        { id: `nmf_buy_${ts}`, type: 'action', value: 'BUY', params: { confidence: Math.round(entryThreshold * 100) / 100 } },
        {
          id: `nmf_else_${ts}`, type: 'logical', value: 'IF_THEN_ELSE',
          children: [
            {
              id: `nmf_rh_${ts}`, type: 'comparator', value: 'GT',
              children: [
                { id: `nmf_r2_${ts}`, type: 'indicator', value: 'RSI' },
                { id: `nmf_r2v_${ts}`, type: 'constant', value: String(Math.round(100 - rsiThreshold)) },
              ],
            },
            { id: `nmf_sell_${ts}`, type: 'action', value: 'SELL', params: { confidence: Math.round(entryThreshold * 100) / 100 } },
            { id: `nmf_hold_${ts}`, type: 'action', value: 'HOLD', params: { confidence: 0.3 } },
          ],
        },
      ],
    };
  }

  // ===================== UTILITIES =====================

  private weightsToDNA(weights: number[], H: number[][]): number[] {
    const numGenes = H[0]?.length || 0;
    const genes = new Array(numGenes).fill(0);
    for (let g = 0; g < numGenes; g++) {
      for (let f = 0; f < weights.length; f++) {
        genes[g] += weights[f] * (H[f]?.[g] || 0);
      }
      genes[g] = Math.max(0, genes[g]);
    }
    return genes;
  }

  private novelty(dna: number[], snaps: DNASnapshot[]): number {
    if (snaps.length === 0) return 1;
    let total = 0;
    for (const s of snaps) total += this.eucDist(dna, s.genes);
    return Math.min(1, (total / snaps.length) / 10);
  }

  private predictFitness(weights: number[], factors: LatentFactor[]): number {
    let pred = 0;
    for (let f = 0; f < factors.length; f++) pred += weights[f] * factors[f].correlationWithFitness;
    return Math.tanh(pred);
  }

  private eucDist(a: number[], b: number[]): number {
    let s = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) s += (a[i] - b[i]) ** 2;
    return Math.sqrt(s);
  }

  private pearson(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    let cov = 0, vx = 0, vy = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx, dy = y[i] - my;
      cov += dx * dy; vx += dx * dx; vy += dy * dy;
    }
    const d = Math.sqrt(vx * vy);
    return d > 0 ? cov / d : 0;
  }

  // ===================== PUBLIC API =====================

  getLatestResult(): NMFResult | null { return this.latestResult; }
  getFactors(): LatentFactor[] { return this.latestResult?.factors || []; }
  getFactorTrends(): Map<number, { timestamp: number; correlation: number }[]> { return this.factorTrends; }

  getStats() {
    return {
      hasResult: !!this.latestResult,
      factors: this.latestResult?.factors.length || 0,
      reconstructionError: this.latestResult?.reconstructionError || 0,
      converged: this.latestResult?.converged || false,
      historySnapshots: this.snapshotHistory.length,
    };
  }
}
