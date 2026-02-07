// Master Bot Synthesis - Creates a master bot from top performers across all groups
// Supports weighted average, ensemble (best-per-category), and regime-aware synthesis
import { v4 as uuidv4 } from 'uuid';
import type { StrategyDNA, MasterBot, LeaderboardEntry, FitnessScores, BotPersonality } from './types';
import { dnaToArray, arrayToDNA, clampDNA, getAllGeneRanges } from './dnaFactory';
import { buildPersonality } from './botPersonality';
import type Database from 'better-sqlite3';

export type SynthesisMethod = 'weighted_average' | 'ensemble' | 'regime_aware';

interface SynthesisSource {
  dna: StrategyDNA;
  fitness: number;
  fitnessScores?: FitnessScores;
  personality?: BotPersonality;
}

// ===================== WEIGHTED AVERAGE (ORIGINAL) =====================

// Synthesize master bot from top N bots using fitness-weighted average
export function synthesizeMasterBot(
  topBots: SynthesisSource[],
  generation: number,
): MasterBot {
  if (topBots.length === 0) {
    throw new Error('No bots to synthesize');
  }

  // Normalize fitness scores to weights that sum to 1
  const totalFitness = topBots.reduce((sum, b) => sum + Math.max(b.fitness, 0.01), 0);
  const weights = topBots.map(b => Math.max(b.fitness, 0.01) / totalFitness);

  // Compute weighted average of all DNA genes
  const dnaArrays = topBots.map(b => dnaToArray(b.dna));
  const geneCount = dnaArrays[0].length;
  const avgGenes: number[] = new Array(geneCount).fill(0);

  for (let g = 0; g < geneCount; g++) {
    for (let b = 0; b < topBots.length; b++) {
      avgGenes[g] += dnaArrays[b][g] * weights[b];
    }
  }

  const masterDNA = clampDNA(arrayToDNA(avgGenes));

  return {
    id: uuidv4(),
    dna: masterDNA,
    sourceBotIds: [], // Filled by caller
    sourceWeights: weights.map(w => Number(w.toFixed(4))),
    generation,
    synthesizedAt: new Date().toISOString(),
  };
}

// ===================== ENSEMBLE SYNTHESIS =====================

// Pick the best bot's genes for each DNA category based on category-specific fitness
export function synthesizeEnsemble(
  topBots: SynthesisSource[],
  generation: number,
): MasterBot {
  if (topBots.length === 0) throw new Error('No bots to synthesize');

  const categories = ['entrySignals', 'indicatorParams', 'positionSizing', 'exitStrategy', 'regimeFilter', 'timing'] as const;

  // Score each bot per category based on which fitness components that category most affects
  const categoryFitnessWeights: Record<string, (keyof FitnessScores)[]> = {
    entrySignals: ['winRate', 'totalPnLPercent'],
    indicatorParams: ['winRate', 'sharpeRatio'],
    positionSizing: ['totalPnLPercent', 'maxDrawdownPenalty'],
    exitStrategy: ['maxDrawdownPenalty', 'sharpeRatio'],
    regimeFilter: ['consistency', 'sharpeRatio'],
    timing: ['tradeFrequency', 'consistency'],
  };

  const masterDNA: Record<string, unknown> = {};

  for (const cat of categories) {
    let bestBot = topBots[0];
    let bestScore = -Infinity;

    for (const bot of topBots) {
      if (!bot.fitnessScores) {
        // Fallback to overall fitness
        if (bot.fitness > bestScore) { bestScore = bot.fitness; bestBot = bot; }
        continue;
      }

      const relevantComponents = categoryFitnessWeights[cat];
      const score = relevantComponents.reduce((sum, comp) =>
        sum + (bot.fitnessScores![comp] || 0), 0,
      ) / relevantComponents.length;

      if (score > bestScore) {
        bestScore = score;
        bestBot = bot;
      }
    }

    masterDNA[cat] = { ...(bestBot.dna[cat] as unknown as Record<string, number>) };
  }

  const dna = clampDNA(masterDNA as unknown as StrategyDNA);
  const weights = topBots.map(() => Number((1 / topBots.length).toFixed(4)));

  return {
    id: uuidv4(),
    dna,
    sourceBotIds: [],
    sourceWeights: weights,
    generation,
    synthesizedAt: new Date().toISOString(),
  };
}

// ===================== REGIME-AWARE SYNTHESIS =====================

// Create 3 master DNA profiles: bull, bear, sideways — weighted by regime fitness
export function synthesizeRegimeAware(
  topBots: SynthesisSource[],
  generation: number,
): {
  masterBot: MasterBot;
  regimeProfiles: {
    bull: StrategyDNA;
    bear: StrategyDNA;
    sideways: StrategyDNA;
  };
} {
  if (topBots.length === 0) throw new Error('No bots to synthesize');

  // Classify bots by their regime preference
  const bullBots = topBots.filter(b => b.dna.regimeFilter.trendFollowBias > 0.2);
  const bearBots = topBots.filter(b => b.dna.regimeFilter.trendFollowBias < -0.2);
  const sidewaysBots = topBots.filter(b => Math.abs(b.dna.regimeFilter.trendFollowBias) <= 0.2);

  // Ensure each group has at least one bot (fallback to all)
  const ensureBots = (group: SynthesisSource[]) =>
    group.length > 0 ? group : topBots;

  const bullProfile = synthesizeWeightedAverage(ensureBots(bullBots));
  const bearProfile = synthesizeWeightedAverage(ensureBots(bearBots));
  const sidewaysProfile = synthesizeWeightedAverage(ensureBots(sidewaysBots));

  // Default master is the overall weighted average
  const masterBot = synthesizeMasterBot(topBots, generation);

  return {
    masterBot,
    regimeProfiles: {
      bull: bullProfile,
      bear: bearProfile,
      sideways: sidewaysProfile,
    },
  };
}

function synthesizeWeightedAverage(bots: SynthesisSource[]): StrategyDNA {
  const totalFitness = bots.reduce((sum, b) => sum + Math.max(b.fitness, 0.01), 0);
  const weights = bots.map(b => Math.max(b.fitness, 0.01) / totalFitness);

  const dnaArrays = bots.map(b => dnaToArray(b.dna));
  const geneCount = dnaArrays[0].length;
  const avgGenes: number[] = new Array(geneCount).fill(0);

  for (let g = 0; g < geneCount; g++) {
    for (let b = 0; b < bots.length; b++) {
      avgGenes[g] += dnaArrays[b][g] * weights[b];
    }
  }

  return clampDNA(arrayToDNA(avgGenes));
}

// ===================== PERFORMANCE ATTRIBUTION =====================

// Analyze which genes in the master bot contribute most to its synthesized fitness
export function performanceAttribution(
  masterDNA: StrategyDNA,
  sources: SynthesisSource[],
): { gene: string; contribution: number; sourceAgreement: number }[] {
  const allRanges = getAllGeneRanges();
  const results: { gene: string; contribution: number; sourceAgreement: number }[] = [];

  for (const [category, genes] of Object.entries(allRanges)) {
    for (const [geneName, [min, max]] of Object.entries(genes)) {
      const masterValue = (masterDNA as any)[category][geneName] as number;
      const range = max - min;
      if (range === 0) continue;

      // How much each source's gene value agrees with the master
      const sourceValues = sources.map(s => (s.dna as any)[category][geneName] as number);
      const sourceAgreement = sourceValues.reduce((sum, sv) => {
        const diff = Math.abs(sv - masterValue) / range;
        return sum + (1 - diff);
      }, 0) / sources.length;

      // Contribution = normalized master value * source agreement * source avg fitness
      const avgFitness = sources.reduce((sum, s) => sum + s.fitness, 0) / sources.length;
      const normalizedValue = (masterValue - min) / range;
      const contribution = normalizedValue * sourceAgreement * avgFitness;

      results.push({
        gene: `${category}.${geneName}`,
        contribution: Number(contribution.toFixed(4)),
        sourceAgreement: Number(sourceAgreement.toFixed(4)),
      });
    }
  }

  results.sort((a, b) => b.contribution - a.contribution);
  return results;
}

// ===================== UNIFIED SYNTHESIS =====================

// Synthesize with configurable method
export function synthesizeAdvanced(
  topBots: SynthesisSource[],
  generation: number,
  method: SynthesisMethod = 'weighted_average',
): MasterBot {
  switch (method) {
    case 'weighted_average': return synthesizeMasterBot(topBots, generation);
    case 'ensemble': return synthesizeEnsemble(topBots, generation);
    case 'regime_aware': return synthesizeRegimeAware(topBots, generation).masterBot;
    default: return synthesizeMasterBot(topBots, generation);
  }
}

// Store master bot in database
export function saveMasterBot(db: Database.Database, masterBot: MasterBot, sourceBotIds: string[]): void {
  db.prepare(`
    INSERT INTO master_bot_syntheses (id, dna, source_bot_ids, source_weights, generation, synthesized_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    masterBot.id,
    JSON.stringify(masterBot.dna),
    JSON.stringify(sourceBotIds),
    JSON.stringify(masterBot.sourceWeights),
    masterBot.generation,
    masterBot.synthesizedAt,
  );
}

// Get latest master bot from database
export function getLatestMasterBot(db: Database.Database): MasterBot | null {
  const row = db.prepare('SELECT * FROM master_bot_syntheses ORDER BY synthesized_at DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    dna: JSON.parse(row.dna as string),
    sourceBotIds: JSON.parse(row.source_bot_ids as string),
    sourceWeights: JSON.parse(row.source_weights as string),
    generation: row.generation as number,
    synthesizedAt: row.synthesized_at as string,
  };
}

// Get all master bot syntheses
export function getMasterBotHistory(db: Database.Database, limit: number = 10): MasterBot[] {
  const rows = db.prepare('SELECT * FROM master_bot_syntheses ORDER BY synthesized_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];

  return rows.map(row => ({
    id: row.id as string,
    dna: JSON.parse(row.dna as string),
    sourceBotIds: JSON.parse(row.source_bot_ids as string),
    sourceWeights: JSON.parse(row.source_weights as string),
    generation: row.generation as number,
    synthesizedAt: row.synthesized_at as string,
  }));
}
