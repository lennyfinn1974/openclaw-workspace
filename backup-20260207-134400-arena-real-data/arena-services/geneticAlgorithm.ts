// Genetic Algorithm - Tournament selection, crossover, mutation, elitism
import type { StrategyDNA, Bot, BotGroupName, FitnessScores, LeaderboardEntry } from './types';
import { clampDNA, dnaToArray, arrayToDNA } from './dnaFactory';

// ===================== FITNESS CALCULATION =====================

export function calculateFitness(entry: {
  totalPnLPercent: number;
  sharpeRatio: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  consistency: number;
}): FitnessScores {
  // Normalize components to 0-1 range
  const pnlScore = Math.max(0, Math.min(1, (entry.totalPnLPercent + 20) / 40)); // -20% to +20% -> 0-1
  const sharpeScore = Math.max(0, Math.min(1, (entry.sharpeRatio + 1) / 4));     // -1 to 3 -> 0-1
  const winRateScore = entry.winRate;                                             // already 0-1
  const drawdownPenalty = Math.max(0, 1 - entry.maxDrawdown * 5);                 // 20% DD -> 0
  const tradeFreq = Math.max(0, Math.min(1, entry.totalTrades / 20));            // 0-20 trades -> 0-1
  const consistencyScore = entry.consistency;                                     // already 0-1

  const composite =
    pnlScore * 0.30 +
    sharpeScore * 0.25 +
    winRateScore * 0.15 +
    drawdownPenalty * 0.15 +
    tradeFreq * 0.10 +
    consistencyScore * 0.05;

  return {
    totalPnLPercent: pnlScore,
    sharpeRatio: sharpeScore,
    winRate: winRateScore,
    maxDrawdownPenalty: drawdownPenalty,
    tradeFrequency: tradeFreq,
    consistency: consistencyScore,
    composite: Number(composite.toFixed(4)),
  };
}

// Calculate Sharpe ratio from trade returns
export function calculateSharpeRatio(tradePnLs: number[], riskFreeRate: number = 0): number {
  if (tradePnLs.length < 2) return 0;
  const mean = tradePnLs.reduce((a, b) => a + b, 0) / tradePnLs.length;
  const variance = tradePnLs.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (tradePnLs.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return Number(((mean - riskFreeRate) / stdDev).toFixed(4));
}

// Calculate max drawdown from equity curve
export function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const equity of equityCurve) {
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return Number(maxDD.toFixed(4));
}

// Calculate win rate from trades
export function calculateWinRate(tradePnLs: number[]): number {
  if (tradePnLs.length === 0) return 0.5;
  const wins = tradePnLs.filter(p => p > 0).length;
  return Number((wins / tradePnLs.length).toFixed(4));
}

// Calculate consistency (inverse of return variance)
export function calculateConsistency(tradePnLs: number[]): number {
  if (tradePnLs.length < 2) return 0.5;
  const mean = tradePnLs.reduce((a, b) => a + b, 0) / tradePnLs.length;
  const variance = tradePnLs.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / tradePnLs.length;
  // Lower variance = higher consistency
  return Number(Math.max(0, Math.min(1, 1 / (1 + variance * 100))).toFixed(4));
}

// ===================== GENETIC OPERATORS =====================

// Tournament selection: pick 3 random, return fittest
function tournamentSelect(population: { bot: Bot; fitness: number }[]): Bot {
  const candidates: typeof population[number][] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * population.length);
    candidates.push(population[idx]);
  }
  candidates.sort((a, b) => b.fitness - a.fitness);
  return candidates[0].bot;
}

// Uniform crossover at gene-group level
function crossover(parent1: StrategyDNA, parent2: StrategyDNA): StrategyDNA {
  const categories = ['entrySignals', 'indicatorParams', 'positionSizing', 'exitStrategy', 'regimeFilter', 'timing'] as const;

  const child: Record<string, unknown> = {};
  for (const cat of categories) {
    // 50% chance to take from each parent at the category level
    if (Math.random() < 0.5) {
      child[cat] = { ...(parent1[cat] as unknown as Record<string, number>) };
    } else {
      child[cat] = { ...(parent2[cat] as unknown as Record<string, number>) };
    }

    // Within the selected category, do gene-level crossover with 30% probability
    const catGenes = child[cat] as Record<string, number>;
    const otherParent = child[cat] === parent1[cat] ? parent2 : parent1;
    const otherGenes = otherParent[cat] as unknown as Record<string, number>;
    for (const gene of Object.keys(catGenes)) {
      if (Math.random() < 0.3) {
        catGenes[gene] = otherGenes[gene];
      }
    }
  }

  return child as unknown as StrategyDNA;
}

// Gaussian mutation with configurable strength
function mutate(dna: StrategyDNA, mutationRate: number = 0.1, mutationStrength: number = 0.15): StrategyDNA {
  const arr = dnaToArray(dna);
  const mutated = arr.map(gene => {
    if (Math.random() < mutationRate) {
      const mutation = gene * mutationStrength * (Math.random() * 2 - 1);
      return gene + mutation;
    }
    return gene;
  });
  return clampDNA(arrayToDNA(mutated));
}

// ===================== EVOLUTION =====================

export interface EvolutionConfig {
  eliteCount: number;       // how many top bots survive unchanged (default 2)
  mutationRate: number;      // probability of mutating each gene (default 0.1)
  mutationStrength: number;  // magnitude of mutation (default 0.15)
}

const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  eliteCount: 2,
  mutationRate: 0.1,
  mutationStrength: 0.15,
};

// Evolve a group of bots based on fitness
export function evolveGroup(
  bots: Bot[],
  fitnessMap: Map<string, number>, // botId -> fitness score
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): {
  survivors: Bot[];           // elite bots (unchanged)
  offspring: StrategyDNA[];   // new DNA for replacement bots
  replacedIds: string[];      // IDs of bots that were replaced
} {
  // Sort by fitness (highest first)
  const ranked = [...bots]
    .map(bot => ({ bot, fitness: fitnessMap.get(bot.id) || 0 }))
    .sort((a, b) => b.fitness - a.fitness);

  // Elites survive unchanged
  const survivors = ranked.slice(0, config.eliteCount).map(r => r.bot);
  const replacedIds = ranked.slice(config.eliteCount).map(r => r.bot.id);

  // Generate offspring from tournament selection + crossover + mutation
  const offspring: StrategyDNA[] = [];
  for (let i = 0; i < replacedIds.length; i++) {
    const parent1 = tournamentSelect(ranked);
    const parent2 = tournamentSelect(ranked);
    let childDNA = crossover(parent1.dna, parent2.dna);
    childDNA = mutate(childDNA, config.mutationRate, config.mutationStrength);
    offspring.push(childDNA);
  }

  return { survivors, offspring, replacedIds };
}
