// Advanced Genetic Operators - Multi-point crossover, BLX-alpha, SBX,
// advanced selection, polynomial/Cauchy mutation, adaptive rates
import type {
  StrategyDNA, Bot, CrossoverMethod, SelectionMethod, MutationMethod,
  AdvancedEvolutionConfig, FitnessScores,
} from './types';
import { dnaToArray, arrayToDNA, clampDNA, randomDNA } from './dnaFactory';

// ===================== SELECTION OPERATORS =====================

// Tournament selection with configurable size
export function tournamentSelect(
  population: { bot: Bot; fitness: number }[],
  tournamentSize: number = 3,
): Bot {
  const candidates: typeof population[number][] = [];
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    candidates.push(population[idx]);
  }
  candidates.sort((a, b) => b.fitness - a.fitness);
  return candidates[0].bot;
}

// Roulette wheel (fitness-proportionate) selection
export function rouletteSelect(
  population: { bot: Bot; fitness: number }[],
): Bot {
  // Shift fitness to positive (minimum fitness = small positive)
  const minFit = Math.min(...population.map(p => p.fitness));
  const shifted = population.map(p => ({
    ...p,
    adjustedFitness: p.fitness - minFit + 0.01,
  }));
  const totalFitness = shifted.reduce((sum, p) => sum + p.adjustedFitness, 0);

  let spin = Math.random() * totalFitness;
  for (const individual of shifted) {
    spin -= individual.adjustedFitness;
    if (spin <= 0) return individual.bot;
  }
  return shifted[shifted.length - 1].bot;
}

// Rank-based selection (linear ranking)
export function rankSelect(
  population: { bot: Bot; fitness: number }[],
): Bot {
  const sorted = [...population].sort((a, b) => a.fitness - b.fitness);
  const n = sorted.length;
  // Linear ranking: P(i) = (2*(i+1)) / (n*(n+1))
  const totalRank = (n * (n + 1)) / 2;
  let spin = Math.random() * totalRank;

  for (let i = 0; i < n; i++) {
    spin -= (i + 1);
    if (spin <= 0) return sorted[i].bot;
  }
  return sorted[n - 1].bot;
}

// Stochastic Universal Sampling - selects multiple parents at once
export function stochasticUniversalSampling(
  population: { bot: Bot; fitness: number }[],
  count: number,
): Bot[] {
  const minFit = Math.min(...population.map(p => p.fitness));
  const shifted = population.map(p => ({
    ...p,
    adjustedFitness: p.fitness - minFit + 0.01,
  }));
  const totalFitness = shifted.reduce((sum, p) => sum + p.adjustedFitness, 0);
  const step = totalFitness / count;
  let pointer = Math.random() * step;
  const selected: Bot[] = [];

  let cumulative = 0;
  let idx = 0;
  for (let i = 0; i < count; i++) {
    while (cumulative + shifted[idx].adjustedFitness < pointer && idx < shifted.length - 1) {
      cumulative += shifted[idx].adjustedFitness;
      idx++;
    }
    selected.push(shifted[idx].bot);
    pointer += step;
  }

  return selected;
}

// Unified selection dispatcher
export function selectParent(
  population: { bot: Bot; fitness: number }[],
  method: SelectionMethod,
  tournamentSize: number = 3,
): Bot {
  switch (method) {
    case 'tournament': return tournamentSelect(population, tournamentSize);
    case 'roulette': return rouletteSelect(population);
    case 'rank': return rankSelect(population);
    case 'sus': {
      const selected = stochasticUniversalSampling(population, 1);
      return selected[0];
    }
    default: return tournamentSelect(population, tournamentSize);
  }
}

// ===================== CROSSOVER OPERATORS =====================

// Uniform crossover (existing, at gene level)
export function uniformCrossover(parent1: StrategyDNA, parent2: StrategyDNA): StrategyDNA {
  const arr1 = dnaToArray(parent1);
  const arr2 = dnaToArray(parent2);
  const child = arr1.map((g, i) => Math.random() < 0.5 ? g : arr2[i]);
  return clampDNA(arrayToDNA(child));
}

// Multi-point crossover (2 or 3 crossover points)
export function multipointCrossover(
  parent1: StrategyDNA,
  parent2: StrategyDNA,
  points: number = 2,
): StrategyDNA {
  const arr1 = dnaToArray(parent1);
  const arr2 = dnaToArray(parent2);
  const len = arr1.length;

  // Generate sorted crossover points
  const crossPoints: number[] = [];
  while (crossPoints.length < points) {
    const pt = 1 + Math.floor(Math.random() * (len - 1));
    if (!crossPoints.includes(pt)) crossPoints.push(pt);
  }
  crossPoints.sort((a, b) => a - b);

  const child: number[] = new Array(len);
  let useParent1 = true;
  let pointIdx = 0;

  for (let i = 0; i < len; i++) {
    if (pointIdx < crossPoints.length && i >= crossPoints[pointIdx]) {
      useParent1 = !useParent1;
      pointIdx++;
    }
    child[i] = useParent1 ? arr1[i] : arr2[i];
  }

  return clampDNA(arrayToDNA(child));
}

// BLX-alpha (Blend Crossover) - explores between and beyond parents
export function blxAlphaCrossover(
  parent1: StrategyDNA,
  parent2: StrategyDNA,
  alpha: number = 0.3,
): StrategyDNA {
  const arr1 = dnaToArray(parent1);
  const arr2 = dnaToArray(parent2);

  const child = arr1.map((g1, i) => {
    const g2 = arr2[i];
    const lo = Math.min(g1, g2);
    const hi = Math.max(g1, g2);
    const range = hi - lo;
    const expandedLo = lo - alpha * range;
    const expandedHi = hi + alpha * range;
    return expandedLo + Math.random() * (expandedHi - expandedLo);
  });

  return clampDNA(arrayToDNA(child));
}

// Simulated Binary Crossover (SBX) - mimics single-point crossover in binary space
export function sbxCrossover(
  parent1: StrategyDNA,
  parent2: StrategyDNA,
  eta: number = 10, // distribution index (higher = children closer to parents)
): StrategyDNA {
  const arr1 = dnaToArray(parent1);
  const arr2 = dnaToArray(parent2);

  const child = arr1.map((g1, i) => {
    const g2 = arr2[i];
    if (Math.abs(g1 - g2) < 1e-14) return g1;

    const u = Math.random();
    let beta: number;
    if (u <= 0.5) {
      beta = Math.pow(2 * u, 1 / (eta + 1));
    } else {
      beta = Math.pow(1 / (2 * (1 - u)), 1 / (eta + 1));
    }

    // Produce one child (randomly pick which combination)
    if (Math.random() < 0.5) {
      return 0.5 * ((1 + beta) * g1 + (1 - beta) * g2);
    } else {
      return 0.5 * ((1 - beta) * g1 + (1 + beta) * g2);
    }
  });

  return clampDNA(arrayToDNA(child));
}

// Unified crossover dispatcher
export function crossover(
  parent1: StrategyDNA,
  parent2: StrategyDNA,
  method: CrossoverMethod,
  config?: { sbxEta?: number; blxAlpha?: number },
): StrategyDNA {
  switch (method) {
    case 'uniform': return uniformCrossover(parent1, parent2);
    case 'multipoint': return multipointCrossover(parent1, parent2, 2);
    case 'blx_alpha': return blxAlphaCrossover(parent1, parent2, config?.blxAlpha ?? 0.3);
    case 'sbx': return sbxCrossover(parent1, parent2, config?.sbxEta ?? 10);
    default: return uniformCrossover(parent1, parent2);
  }
}

// ===================== MUTATION OPERATORS =====================

// Gaussian mutation (existing)
export function gaussianMutate(
  dna: StrategyDNA,
  rate: number = 0.1,
  strength: number = 0.15,
): StrategyDNA {
  const arr = dnaToArray(dna);
  const mutated = arr.map(gene => {
    if (Math.random() < rate) {
      const noise = gene * strength * (Math.random() * 2 - 1);
      return gene + noise;
    }
    return gene;
  });
  return clampDNA(arrayToDNA(mutated));
}

// Polynomial mutation (used in NSGA-II, good for real-valued genes)
export function polynomialMutate(
  dna: StrategyDNA,
  rate: number = 0.1,
  eta: number = 20, // distribution index (higher = smaller perturbation)
): StrategyDNA {
  const arr = dnaToArray(dna);
  const mutated = arr.map(gene => {
    if (Math.random() < rate) {
      const u = Math.random();
      let delta: number;
      if (u < 0.5) {
        delta = Math.pow(2 * u, 1 / (eta + 1)) - 1;
      } else {
        delta = 1 - Math.pow(2 * (1 - u), 1 / (eta + 1));
      }
      return gene + delta * Math.abs(gene) * 0.3;
    }
    return gene;
  });
  return clampDNA(arrayToDNA(mutated));
}

// Cauchy mutation (heavy-tailed, good for escaping local optima)
export function cauchyMutate(
  dna: StrategyDNA,
  rate: number = 0.1,
  scale: number = 0.1,
): StrategyDNA {
  const arr = dnaToArray(dna);
  const mutated = arr.map(gene => {
    if (Math.random() < rate) {
      // Cauchy distribution via inverse CDF
      const u = Math.random();
      const cauchyNoise = scale * Math.tan(Math.PI * (u - 0.5));
      // Clip extreme values
      const clippedNoise = Math.max(-gene * 0.5, Math.min(gene * 0.5, cauchyNoise));
      return gene + clippedNoise;
    }
    return gene;
  });
  return clampDNA(arrayToDNA(mutated));
}

// Adaptive mutation: rate decays each generation, strength varies by gene importance
export function adaptiveMutate(
  dna: StrategyDNA,
  generation: number,
  config: {
    initialRate: number;
    decayFactor: number;
    minRate: number;
    strength: number;
  },
): StrategyDNA {
  // Exponential decay of mutation rate
  const effectiveRate = Math.max(
    config.minRate,
    config.initialRate * Math.pow(config.decayFactor, generation),
  );

  // Mix of Gaussian and Cauchy: mostly Gaussian, occasional Cauchy for exploration
  const arr = dnaToArray(dna);
  const mutated = arr.map(gene => {
    if (Math.random() < effectiveRate) {
      if (Math.random() < 0.8) {
        // Gaussian (exploitation)
        return gene + gene * config.strength * (Math.random() * 2 - 1);
      } else {
        // Cauchy (exploration)
        const u = Math.random();
        const cauchyNoise = config.strength * 0.5 * Math.tan(Math.PI * (u - 0.5));
        return gene + Math.max(-gene * 0.3, Math.min(gene * 0.3, cauchyNoise));
      }
    }
    return gene;
  });

  return clampDNA(arrayToDNA(mutated));
}

// Unified mutation dispatcher
export function mutate(
  dna: StrategyDNA,
  method: MutationMethod,
  config: {
    rate: number;
    strength: number;
    generation?: number;
    decayFactor?: number;
    minRate?: number;
    polynomialEta?: number;
    cauchyScale?: number;
  },
): StrategyDNA {
  switch (method) {
    case 'gaussian':
      return gaussianMutate(dna, config.rate, config.strength);
    case 'polynomial':
      return polynomialMutate(dna, config.rate, config.polynomialEta ?? 20);
    case 'cauchy':
      return cauchyMutate(dna, config.rate, config.cauchyScale ?? 0.1);
    case 'adaptive':
      return adaptiveMutate(dna, config.generation ?? 0, {
        initialRate: config.rate,
        decayFactor: config.decayFactor ?? 0.95,
        minRate: config.minRate ?? 0.02,
        strength: config.strength,
      });
    default:
      return gaussianMutate(dna, config.rate, config.strength);
  }
}

// ===================== ADVANCED EVOLUTION =====================

export const DEFAULT_ADVANCED_CONFIG: AdvancedEvolutionConfig = {
  eliteCount: 2,
  mutationRate: 0.12,
  mutationStrength: 0.15,
  crossoverMethod: 'blx_alpha',
  selectionMethod: 'tournament',
  mutationMethod: 'adaptive',
  adaptiveMutationDecay: 0.95,
  minMutationRate: 0.02,
  diversityWeight: 0.15,
  immigrationRate: 0.05,
  nicheRadius: 0.3,
  useMultiObjective: false,
  sbxEta: 10,
  blxAlpha: 0.3,
};

// Evolve a group using advanced operators
export function evolveGroupAdvanced(
  bots: Bot[],
  fitnessMap: Map<string, number>,
  generation: number,
  config: AdvancedEvolutionConfig = DEFAULT_ADVANCED_CONFIG,
): {
  survivors: Bot[];
  offspring: StrategyDNA[];
  replacedIds: string[];
  effectiveMutationRate: number;
} {
  // Sort by fitness
  const ranked = [...bots]
    .map(bot => ({ bot, fitness: fitnessMap.get(bot.id) || 0 }))
    .sort((a, b) => b.fitness - a.fitness);

  // Elites survive unchanged
  const survivors = ranked.slice(0, config.eliteCount).map(r => r.bot);
  const replacedIds = ranked.slice(config.eliteCount).map(r => r.bot.id);

  // Calculate effective mutation rate with adaptive decay
  const effectiveMutationRate = config.mutationMethod === 'adaptive'
    ? Math.max(config.minMutationRate, config.mutationRate * Math.pow(config.adaptiveMutationDecay, generation))
    : config.mutationRate;

  // Generate offspring
  const offspring: StrategyDNA[] = [];
  const immigrantCount = Math.max(0, Math.floor(replacedIds.length * config.immigrationRate));
  const breedCount = replacedIds.length - immigrantCount;

  // Breed offspring via selection + crossover + mutation
  for (let i = 0; i < breedCount; i++) {
    const parent1 = selectParent(ranked, config.selectionMethod);
    const parent2 = selectParent(ranked, config.selectionMethod);

    let childDNA = crossover(parent1.dna, parent2.dna, config.crossoverMethod, {
      sbxEta: config.sbxEta,
      blxAlpha: config.blxAlpha,
    });

    childDNA = mutate(childDNA, config.mutationMethod, {
      rate: effectiveMutationRate,
      strength: config.mutationStrength,
      generation,
      decayFactor: config.adaptiveMutationDecay,
      minRate: config.minMutationRate,
    });

    offspring.push(childDNA);
  }

  // Immigration: random individuals for diversity
  for (let i = 0; i < immigrantCount; i++) {
    offspring.push(randomDNA());
  }

  return { survivors, offspring, replacedIds, effectiveMutationRate };
}
