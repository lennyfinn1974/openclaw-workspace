// ============================================================
// Behavioral Clustering — UMAP dimensionality reduction + HDBSCAN
// Pure TypeScript implementation (no native deps)
// ============================================================

import { BehaviorCluster, ClusteringResult, BotBehaviorVector } from './types';
import { BotFingerprinter } from './bot-fingerprinter';

// ============================================================
// UMAP — Simplified 2D projection via t-SNE-like neighbor graph
// Full UMAP requires nearest neighbor descent; we use a simpler
// spectral-inspired approach suitable for 21 bots
// ============================================================

/** Euclidean distance between two vectors */
function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/** Normalize features to [0, 1] per dimension */
function normalizeFeatures(vectors: number[][]): { normalized: number[][]; mins: number[]; maxs: number[] } {
  if (vectors.length === 0) return { normalized: [], mins: [], maxs: [] };

  const dims = vectors[0].length;
  const mins = new Array(dims).fill(Infinity);
  const maxs = new Array(dims).fill(-Infinity);

  for (const v of vectors) {
    for (let d = 0; d < dims; d++) {
      if (v[d] < mins[d]) mins[d] = v[d];
      if (v[d] > maxs[d]) maxs[d] = v[d];
    }
  }

  const normalized = vectors.map(v =>
    v.map((val, d) => {
      const range = maxs[d] - mins[d];
      return range > 0 ? (val - mins[d]) / range : 0.5;
    })
  );

  return { normalized, mins, maxs };
}

/**
 * Simplified UMAP-like 2D embedding via force-directed layout
 * with neighbor-graph edge weights.
 *
 * For 21 points this converges quickly and gives meaningful structure.
 */
export function projectToUMAP(
  vectors: number[][],
  targetDim: number = 2,
  nNeighbors: number = 5,
  iterations: number = 200
): number[][] {
  const n = vectors.length;
  if (n <= targetDim) {
    return vectors.map(v => v.slice(0, targetDim));
  }

  const { normalized } = normalizeFeatures(vectors);

  // Compute pairwise distances
  const distances: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclidean(normalized[i], normalized[j]);
      distances[i][j] = d;
      distances[j][i] = d;
    }
  }

  // Build k-nearest neighbor graph with fuzzy set weights
  const weights: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const neighbors = Array.from({ length: n }, (_, j) => j)
      .filter(j => j !== i)
      .sort((a, b) => distances[i][a] - distances[i][b])
      .slice(0, nNeighbors);

    const sigma = distances[i][neighbors[Math.min(nNeighbors - 1, neighbors.length - 1)]] || 1;

    for (const j of neighbors) {
      const w = Math.exp(-Math.max(0, distances[i][j] - distances[i][neighbors[0]]) / sigma);
      weights[i][j] = Math.max(weights[i][j], w);
      weights[j][i] = Math.max(weights[j][i], w);
    }
  }

  // Symmetrize: w_ij = w_ij + w_ji - w_ij * w_ji
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sym = weights[i][j] + weights[j][i] - weights[i][j] * weights[j][i];
      weights[i][j] = sym;
      weights[j][i] = sym;
    }
  }

  // Initialize embedding randomly (seeded for reproducibility)
  let seed = 42;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const embedding: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: targetDim }, () => (rng() - 0.5) * 10)
  );

  // Force-directed optimization
  const learningRate = 1.0;
  const repulsionStrength = 0.5;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = learningRate * (1 - iter / iterations);

    for (let i = 0; i < n; i++) {
      const grad = new Array(targetDim).fill(0);

      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const delta: number[] = [];
        let embDist = 0;
        for (let d = 0; d < targetDim; d++) {
          const diff = embedding[i][d] - embedding[j][d];
          delta.push(diff);
          embDist += diff * diff;
        }
        embDist = Math.sqrt(embDist) + 1e-8;

        const attraction = weights[i][j];
        const repulsion = repulsionStrength / (1 + embDist * embDist);

        for (let d = 0; d < targetDim; d++) {
          // Attract connected points, repel all
          grad[d] += (-attraction * delta[d] / embDist) + (repulsion * delta[d] / embDist);
        }
      }

      for (let d = 0; d < targetDim; d++) {
        embedding[i][d] += alpha * grad[d];
      }
    }
  }

  return embedding;
}

// ============================================================
// HDBSCAN — Hierarchical Density-Based Spatial Clustering
// Simplified for small N (21 bots)
// ============================================================

interface HDBSCANOptions {
  minClusterSize: number;  // min points to form a cluster
  minSamples: number;      // density estimation parameter
}

/**
 * Simplified HDBSCAN clustering.
 *
 * For 21 points, we use core distance + mutual reachability to build
 * a minimum spanning tree, then extract clusters by cutting at density
 * valleys.
 */
export function hdbscan(
  points: number[][],
  options: HDBSCANOptions = { minClusterSize: 3, minSamples: 2 }
): { labels: number[]; probabilities: number[] } {
  const n = points.length;
  if (n < options.minClusterSize) {
    return { labels: new Array(n).fill(-1), probabilities: new Array(n).fill(0) };
  }

  // Step 1: Core distances (distance to kth nearest neighbor)
  const { minSamples } = options;
  const pairDists: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclidean(points[i], points[j]);
      pairDists[i][j] = d;
      pairDists[j][i] = d;
    }
  }

  const coreDistances: number[] = [];
  for (let i = 0; i < n; i++) {
    const sorted = pairDists[i].filter((_, j) => j !== i).sort((a, b) => a - b);
    coreDistances.push(sorted[Math.min(minSamples - 1, sorted.length - 1)] || 0);
  }

  // Step 2: Mutual reachability distances
  const mrd: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.max(coreDistances[i], coreDistances[j], pairDists[i][j]);
      mrd[i][j] = d;
      mrd[j][i] = d;
    }
  }

  // Step 3: Build MST using Prim's algorithm
  const inMST = new Array(n).fill(false);
  const minEdge = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  minEdge[0] = 0;

  interface MSTEdge { from: number; to: number; weight: number }
  const mstEdges: MSTEdge[] = [];

  for (let step = 0; step < n; step++) {
    // Find minimum weight vertex not in MST
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!inMST[i] && (u === -1 || minEdge[i] < minEdge[u])) {
        u = i;
      }
    }
    inMST[u] = true;

    if (parent[u] !== -1) {
      mstEdges.push({ from: parent[u], to: u, weight: mrd[parent[u]][u] });
    }

    for (let v = 0; v < n; v++) {
      if (!inMST[v] && mrd[u][v] < minEdge[v]) {
        minEdge[v] = mrd[u][v];
        parent[v] = u;
      }
    }
  }

  // Step 4: Sort MST edges by weight and extract clusters
  mstEdges.sort((a, b) => a.weight - b.weight);

  // Use Union-Find to build hierarchy
  const uf = new UnionFind(n);
  const clusterSizes: Map<number, number> = new Map();
  for (let i = 0; i < n; i++) clusterSizes.set(i, 1);

  const labels = new Array(n).fill(-1);
  let nextCluster = 0;

  // Process edges from shortest to longest
  // When a merge creates a cluster >= minClusterSize, assign it
  for (const edge of mstEdges) {
    const rootA = uf.find(edge.from);
    const rootB = uf.find(edge.to);
    if (rootA === rootB) continue;

    const sizeA = clusterSizes.get(rootA) || 1;
    const sizeB = clusterSizes.get(rootB) || 1;

    uf.union(edge.from, edge.to);
    const newRoot = uf.find(edge.from);
    clusterSizes.set(newRoot, sizeA + sizeB);
  }

  // Extract clusters: use density-based cut
  // Simpler approach for small N: use k-means-like partitioning on the MST
  // Find natural gaps in the MST edge weights
  if (mstEdges.length >= 2) {
    const edgeWeights = mstEdges.map(e => e.weight);
    const meanWeight = edgeWeights.reduce((a, b) => a + b, 0) / edgeWeights.length;
    const stdWeight = Math.sqrt(
      edgeWeights.reduce((s, w) => s + (w - meanWeight) ** 2, 0) / edgeWeights.length
    );
    const cutThreshold = meanWeight + stdWeight * 0.5;

    // Reset union-find and build clusters only with short edges
    const uf2 = new UnionFind(n);
    for (const edge of mstEdges) {
      if (edge.weight <= cutThreshold) {
        uf2.union(edge.from, edge.to);
      }
    }

    // Assign cluster labels
    const rootToCluster = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const root = uf2.find(i);
      if (!rootToCluster.has(root)) {
        // Check cluster size
        let size = 0;
        for (let j = 0; j < n; j++) {
          if (uf2.find(j) === root) size++;
        }
        if (size >= options.minClusterSize) {
          rootToCluster.set(root, nextCluster++);
        } else {
          rootToCluster.set(root, -1); // noise
        }
      }
      labels[i] = rootToCluster.get(root) ?? -1;
    }
  }

  // Compute membership probabilities (simplified: based on distance to cluster centroid)
  const probabilities = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (labels[i] >= 0) {
      probabilities[i] = 1.0; // simplified: full membership if in cluster
    }
  }

  return { labels, probabilities };
}

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }
}

// ============================================================
// Behavior Clustering Orchestrator
// ============================================================

export class BehaviorClusterEngine {
  private fingerprinter: BotFingerprinter;

  constructor(fingerprinter: BotFingerprinter) {
    this.fingerprinter = fingerprinter;
  }

  /** Run full clustering pipeline */
  cluster(): ClusteringResult {
    const botIds = this.fingerprinter.trackedBotIds();
    const vectors: { botId: string; features: number[] }[] = [];

    for (const botId of botIds) {
      const v = this.fingerprinter.toBehaviorVector(botId);
      if (v) vectors.push({ botId, features: v });
    }

    if (vectors.length < 3) {
      return {
        clusters: [],
        noise: vectors.map(v => v.botId),
        silhouetteScore: 0,
        timestamp: Date.now(),
      };
    }

    // Project to 2D for clustering
    const rawFeatures = vectors.map(v => v.features);
    const embedding2D = projectToUMAP(rawFeatures, 2, Math.min(5, vectors.length - 1));

    // Cluster in 2D space
    const { labels } = hdbscan(embedding2D, {
      minClusterSize: Math.max(2, Math.floor(vectors.length / 7)),
      minSamples: 2,
    });

    // Build cluster objects
    const clusterMap = new Map<number, string[]>();
    const noise: string[] = [];

    for (let i = 0; i < labels.length; i++) {
      if (labels[i] === -1) {
        noise.push(vectors[i].botId);
      } else {
        const members = clusterMap.get(labels[i]) || [];
        members.push(vectors[i].botId);
        clusterMap.set(labels[i], members);
      }
    }

    const clusters: BehaviorCluster[] = [];
    for (const [clusterId, memberBotIds] of clusterMap) {
      // Compute centroid
      const memberFeatures = memberBotIds.map(id => {
        const idx = vectors.findIndex(v => v.botId === id);
        return vectors[idx].features;
      });

      const dims = memberFeatures[0].length;
      const centroid = new Array(dims).fill(0);
      for (const f of memberFeatures) {
        for (let d = 0; d < dims; d++) centroid[d] += f[d];
      }
      for (let d = 0; d < dims; d++) centroid[d] /= memberFeatures.length;

      // Compute radius
      const radius = Math.max(
        ...memberFeatures.map(f => euclidean(f, centroid))
      );

      // Determine dominant strategy by most common reason
      const reasonCounts = new Map<string, number>();
      for (const botId of memberBotIds) {
        const fp = this.fingerprinter.getFingerprint(botId);
        if (fp) {
          for (const [reason, count] of fp.reasonDistribution) {
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + count);
          }
        }
      }
      let dominantStrategy = 'mixed';
      let maxCount = 0;
      for (const [reason, count] of reasonCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominantStrategy = reason;
        }
      }

      // Average fitness from fingerprint P&L
      const avgFitness = memberBotIds.reduce((sum, id) => {
        const fp = this.fingerprinter.getFingerprint(id);
        return sum + (fp ? fp.totalPnL : 0);
      }, 0) / memberBotIds.length;

      // Label the cluster
      const label = this.labelCluster(centroid);

      clusters.push({
        clusterId,
        label,
        memberBotIds,
        centroid,
        radius,
        dominantStrategy,
        avgFitness,
      });
    }

    // Compute silhouette score
    const silhouetteScore = this.computeSilhouette(rawFeatures, labels);

    return {
      clusters,
      noise,
      silhouetteScore,
      timestamp: Date.now(),
    };
  }

  /** Generate a human-readable label for a cluster based on its centroid */
  private labelCluster(centroid: number[]): string {
    const names = BotFingerprinter.featureNames();
    // Find the two most dominant features
    const indexed = centroid.map((v, i) => ({ name: names[i], value: v }));
    indexed.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const top = indexed[0];
    const second = indexed[1];

    // Map to descriptive labels
    const labelMap: Record<string, string> = {
      winRate: 'Winners',
      profitFactor: 'Profitable',
      aggressiveness: 'Aggressive',
      conviction: 'Convicted',
      contrarian: 'Contrarian',
      momentumBias: 'Momentum',
      buyRatio: 'Bullish',
      tradeFrequency: 'Active',
      regularity: 'Systematic',
    };

    return `${labelMap[top.name] || top.name}-${labelMap[second.name] || second.name}`;
  }

  /** Compute average silhouette coefficient */
  private computeSilhouette(features: number[][], labels: number[]): number {
    const n = features.length;
    if (n < 2) return 0;

    const uniqueLabels = [...new Set(labels.filter(l => l >= 0))];
    if (uniqueLabels.length < 2) return 0;

    let totalSilhouette = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      if (labels[i] === -1) continue;

      // a(i) = average distance to same cluster
      let sumA = 0;
      let countA = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i && labels[j] === labels[i]) {
          sumA += euclidean(features[i], features[j]);
          countA++;
        }
      }
      const a = countA > 0 ? sumA / countA : 0;

      // b(i) = minimum average distance to other clusters
      let b = Infinity;
      for (const cl of uniqueLabels) {
        if (cl === labels[i]) continue;
        let sumB = 0;
        let countB = 0;
        for (let j = 0; j < n; j++) {
          if (labels[j] === cl) {
            sumB += euclidean(features[i], features[j]);
            countB++;
          }
        }
        if (countB > 0) {
          b = Math.min(b, sumB / countB);
        }
      }

      const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
      totalSilhouette += s;
      count++;
    }

    return count > 0 ? totalSilhouette / count : 0;
  }
}
