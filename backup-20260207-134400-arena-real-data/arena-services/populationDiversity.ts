// Population Diversity - Genotypic/phenotypic distance, crowding, speciation, fitness sharing
import { v4 as uuidv4 } from 'uuid';
import type {
  Bot, StrategyDNA, FitnessScores, SpeciesCluster,
  PopulationDiversityMetrics, GeneConvergence, ParetoFront, ParetoMember,
} from './types';
import { dnaToArray, getAllGeneRanges } from './dnaFactory';

// ===================== DISTANCE METRICS =====================

// Euclidean distance between two DNA arrays (normalized to 0-1 per gene)
export function genotypicDistance(dna1: StrategyDNA, dna2: StrategyDNA): number {
  const arr1 = dnaToArray(dna1);
  const arr2 = dnaToArray(dna2);
  const ranges = getFlatRanges();

  let sumSqDiff = 0;
  for (let i = 0; i < arr1.length; i++) {
    const range = ranges[i][1] - ranges[i][0];
    if (range === 0) continue;
    const norm1 = (arr1[i] - ranges[i][0]) / range;
    const norm2 = (arr2[i] - ranges[i][0]) / range;
    sumSqDiff += (norm1 - norm2) ** 2;
  }

  return Math.sqrt(sumSqDiff / arr1.length);
}

// Phenotypic distance (behavioral similarity from fitness components)
export function phenotypicDistance(
  fitness1: FitnessScores,
  fitness2: FitnessScores,
): number {
  const components1 = [
    fitness1.totalPnLPercent, fitness1.sharpeRatio, fitness1.winRate,
    fitness1.maxDrawdownPenalty, fitness1.tradeFrequency, fitness1.consistency,
  ];
  const components2 = [
    fitness2.totalPnLPercent, fitness2.sharpeRatio, fitness2.winRate,
    fitness2.maxDrawdownPenalty, fitness2.tradeFrequency, fitness2.consistency,
  ];

  let sumSqDiff = 0;
  for (let i = 0; i < components1.length; i++) {
    sumSqDiff += (components1[i] - components2[i]) ** 2;
  }
  return Math.sqrt(sumSqDiff / components1.length);
}

// ===================== DIVERSITY METRICS =====================

// Mean pairwise genotypic diversity of a population
export function calculateGenotypicDiversity(bots: Bot[]): number {
  if (bots.length < 2) return 0;
  let totalDist = 0;
  let pairs = 0;

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      totalDist += genotypicDistance(bots[i].dna, bots[j].dna);
      pairs++;
    }
  }

  return pairs > 0 ? Number((totalDist / pairs).toFixed(6)) : 0;
}

// Mean pairwise phenotypic diversity
export function calculatePhenotypicDiversity(
  fitnessScores: Map<string, FitnessScores>,
): number {
  const entries = [...fitnessScores.entries()];
  if (entries.length < 2) return 0;
  let totalDist = 0;
  let pairs = 0;

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      totalDist += phenotypicDistance(entries[i][1], entries[j][1]);
      pairs++;
    }
  }

  return pairs > 0 ? Number((totalDist / pairs).toFixed(6)) : 0;
}

// Per-gene convergence analysis
export function calculateGeneConvergence(bots: Bot[]): GeneConvergence[] {
  if (bots.length === 0) return [];

  const allRanges = getAllGeneRanges();
  const results: GeneConvergence[] = [];

  for (const [category, genes] of Object.entries(allRanges)) {
    for (const [geneName, [min, max]] of Object.entries(genes)) {
      const values = bots.map(bot => {
        const catGenes = (bot.dna as any)[category] as Record<string, number>;
        return catGenes[geneName];
      }).filter(v => v !== undefined);

      if (values.length === 0) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);
      const range = max - min;
      const convergenceRatio = range > 0 ? 1 - (stdDev / range) : 1;

      results.push({
        geneName,
        category,
        mean: Number(mean.toFixed(6)),
        stdDev: Number(stdDev.toFixed(6)),
        min: Math.min(...values),
        max: Math.max(...values),
        convergenceRatio: Number(Math.max(0, Math.min(1, convergenceRatio)).toFixed(4)),
      });
    }
  }

  return results;
}

// Full population diversity metrics
export function calculatePopulationDiversity(
  bots: Bot[],
  fitnessScores: Map<string, FitnessScores>,
  generation: number,
  species: SpeciesCluster[],
): PopulationDiversityMetrics {
  return {
    generation,
    genotypicDiversity: calculateGenotypicDiversity(bots),
    phenotypicDiversity: calculatePhenotypicDiversity(fitnessScores),
    speciesCount: species.length,
    avgSpeciesSize: species.length > 0
      ? Number((bots.length / species.length).toFixed(2))
      : bots.length,
    geneConvergence: calculateGeneConvergence(bots),
    timestamp: new Date().toISOString(),
  };
}

// ===================== FITNESS SHARING =====================

// Shared fitness: reduces fitness of bots that are too similar (niche preservation)
export function applyFitnessSharing(
  bots: Bot[],
  fitnessMap: Map<string, number>,
  nicheRadius: number = 0.3,
): Map<string, number> {
  const sharedFitness = new Map<string, number>();

  for (const bot of bots) {
    const rawFitness = fitnessMap.get(bot.id) || 0;
    let nicheCount = 0;

    for (const other of bots) {
      if (bot.id === other.id) { nicheCount += 1; continue; }
      const dist = genotypicDistance(bot.dna, other.dna);
      if (dist < nicheRadius) {
        // Triangular sharing function
        nicheCount += 1 - (dist / nicheRadius);
      }
    }

    sharedFitness.set(bot.id, rawFitness / Math.max(nicheCount, 1));
  }

  return sharedFitness;
}

// ===================== SPECIATION =====================

// K-means clustering of bots into species by genotype
export function speciateBots(
  bots: Bot[],
  fitnessMap: Map<string, number>,
  targetSpecies: number = 3,
  maxIterations: number = 20,
): SpeciesCluster[] {
  if (bots.length <= targetSpecies) {
    return bots.map(bot => ({
      id: uuidv4(),
      centroid: dnaToArray(bot.dna),
      memberBotIds: [bot.id],
      avgFitness: fitnessMap.get(bot.id) || 0,
      generation: bot.generation,
      diversity: 0,
    }));
  }

  const dnaArrays = bots.map(bot => dnaToArray(bot.dna));

  // Initialize centroids from random bots
  const selectedIndices = new Set<number>();
  while (selectedIndices.size < targetSpecies) {
    selectedIndices.add(Math.floor(Math.random() * bots.length));
  }
  let centroids = [...selectedIndices].map(i => [...dnaArrays[i]]);

  let assignments: number[] = new Array(bots.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each bot to nearest centroid
    const newAssignments = dnaArrays.map(arr => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dist = euclidean(arr, centroids[c]);
        if (dist < minDist) { minDist = dist; bestCluster = c; }
      }
      return bestCluster;
    });

    // Check convergence
    if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) break;
    assignments = newAssignments;

    // Recompute centroids
    centroids = centroids.map((_, c) => {
      const members = dnaArrays.filter((_, i) => assignments[i] === c);
      if (members.length === 0) return centroids[c]; // keep old centroid
      const geneCount = members[0].length;
      const avg = new Array(geneCount).fill(0);
      for (const m of members) {
        for (let g = 0; g < geneCount; g++) avg[g] += m[g];
      }
      return avg.map(v => v / members.length);
    });
  }

  // Build clusters
  const clusters: SpeciesCluster[] = centroids.map((centroid, c) => {
    const memberIds = bots
      .filter((_, i) => assignments[i] === c)
      .map(b => b.id);

    const memberFitnesses = memberIds.map(id => fitnessMap.get(id) || 0);
    const avgFitness = memberFitnesses.length > 0
      ? memberFitnesses.reduce((a, b) => a + b, 0) / memberFitnesses.length : 0;

    const memberBots = bots.filter(b => memberIds.includes(b.id));
    const diversity = memberBots.length > 1 ? calculateGenotypicDiversity(memberBots) : 0;

    return {
      id: uuidv4(),
      centroid,
      memberBotIds: memberIds,
      avgFitness: Number(avgFitness.toFixed(4)),
      generation: Math.max(...memberBots.map(b => b.generation), 0),
      diversity: Number(diversity.toFixed(6)),
    };
  }).filter(c => c.memberBotIds.length > 0);

  return clusters;
}

// ===================== CROWDING DISTANCE =====================

// Crowding distance for NSGA-II diversity preservation
export function calculateCrowdingDistances(
  members: { botId: string; objectives: number[] }[],
): Map<string, number> {
  const distances = new Map<string, number>();
  for (const m of members) distances.set(m.botId, 0);

  if (members.length <= 2) {
    for (const m of members) distances.set(m.botId, Infinity);
    return distances;
  }

  const objCount = members[0].objectives.length;

  for (let obj = 0; obj < objCount; obj++) {
    // Sort by this objective
    const sorted = [...members].sort((a, b) => a.objectives[obj] - b.objectives[obj]);

    // Boundary members get infinite distance
    distances.set(sorted[0].botId, Infinity);
    distances.set(sorted[sorted.length - 1].botId, Infinity);

    const range = sorted[sorted.length - 1].objectives[obj] - sorted[0].objectives[obj];
    if (range === 0) continue;

    for (let i = 1; i < sorted.length - 1; i++) {
      const current = distances.get(sorted[i].botId) || 0;
      if (current === Infinity) continue;
      const contribution = (sorted[i + 1].objectives[obj] - sorted[i - 1].objectives[obj]) / range;
      distances.set(sorted[i].botId, current + contribution);
    }
  }

  return distances;
}

// ===================== PARETO FRONT =====================

// Non-dominated sorting (NSGA-II)
export function nonDominatedSort(
  population: { botId: string; objectives: number[] }[], // all objectives to maximize
): ParetoMember[] {
  const n = population.length;
  const dominationCount = new Array(n).fill(0);
  const dominated: number[][] = Array.from({ length: n }, () => []);
  const ranks = new Array(n).fill(0);

  // Find domination relationships
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dom = dominates(population[i].objectives, population[j].objectives);
      if (dom === 1) {
        dominated[i].push(j);
        dominationCount[j]++;
      } else if (dom === -1) {
        dominated[j].push(i);
        dominationCount[i]++;
      }
    }
  }

  // Assign fronts
  let currentFront = population
    .map((_, i) => i)
    .filter(i => dominationCount[i] === 0);

  let rank = 1;
  while (currentFront.length > 0) {
    const nextFront: number[] = [];
    for (const i of currentFront) {
      ranks[i] = rank;
      for (const j of dominated[i]) {
        dominationCount[j]--;
        if (dominationCount[j] === 0) nextFront.push(j);
      }
    }
    currentFront = nextFront;
    rank++;
  }

  // Calculate crowding distances per rank
  const members = population.map((p, i) => ({
    botId: p.botId,
    objectives: {
      returnScore: p.objectives[0],
      riskScore: p.objectives[1],
      consistencyScore: p.objectives[2],
    },
    rank: ranks[i],
    crowdingDistance: 0,
  }));

  // Per-rank crowding
  const maxRank = Math.max(...ranks);
  for (let r = 1; r <= maxRank; r++) {
    const frontMembers = members
      .filter(m => m.rank === r)
      .map(m => ({
        botId: m.botId,
        objectives: [m.objectives.returnScore, m.objectives.riskScore, m.objectives.consistencyScore],
      }));

    if (frontMembers.length > 0) {
      const crowding = calculateCrowdingDistances(frontMembers);
      for (const m of members) {
        if (m.rank === r) {
          m.crowdingDistance = crowding.get(m.botId) || 0;
        }
      }
    }
  }

  return members;
}

// Calculate hypervolume of Pareto front (2D simplified using contribution)
export function calculateHypervolume(
  front: { objectives: number[] }[],
  referencePoint: number[] = [0, 0, 0],
): number {
  if (front.length === 0) return 0;

  // Simple contribution-based estimate for 3 objectives
  let volume = 0;
  for (const member of front) {
    let contribution = 1;
    for (let i = 0; i < member.objectives.length; i++) {
      contribution *= Math.max(0, member.objectives[i] - referencePoint[i]);
    }
    volume += contribution;
  }

  return Number(volume.toFixed(6));
}

// Build Pareto front for a generation
export function buildParetoFront(
  bots: Bot[],
  fitnessScoresMap: Map<string, FitnessScores>,
  generation: number,
): ParetoFront {
  const population = bots.map(bot => {
    const scores = fitnessScoresMap.get(bot.id);
    return {
      botId: bot.id,
      objectives: [
        scores?.totalPnLPercent || 0,       // return (maximize)
        scores?.maxDrawdownPenalty || 0,     // risk inverted (maximize = less risk)
        scores?.consistency || 0,            // consistency (maximize)
      ],
    };
  });

  const members = nonDominatedSort(population);
  const frontMembers = members.filter(m => m.rank === 1);

  const hypervolume = calculateHypervolume(
    frontMembers.map(m => ({
      objectives: [m.objectives.returnScore, m.objectives.riskScore, m.objectives.consistencyScore],
    })),
  );

  return {
    generation,
    members,
    hypervolume,
  };
}

// ===================== HELPERS =====================

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// Returns 1 if a dominates b, -1 if b dominates a, 0 if neither
function dominates(a: number[], b: number[]): number {
  let aBetter = false;
  let bBetter = false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) aBetter = true;
    if (b[i] > a[i]) bBetter = true;
    if (aBetter && bBetter) return 0;
  }

  if (aBetter && !bBetter) return 1;
  if (bBetter && !aBetter) return -1;
  return 0;
}

// Flatten all gene ranges into a single ordered array matching dnaToArray order
let _flatRangesCache: [number, number][] | null = null;

function getFlatRanges(): [number, number][] {
  if (_flatRangesCache) return _flatRangesCache;

  const allRanges = getAllGeneRanges();
  const flat: [number, number][] = [];
  for (const category of ['entrySignals', 'indicatorParams', 'positionSizing', 'exitStrategy', 'regimeFilter', 'timing']) {
    const genes = allRanges[category];
    for (const [, range] of Object.entries(genes)) {
      flat.push(range as [number, number]);
    }
  }
  _flatRangesCache = flat;
  return flat;
}
