// Evolution Analytics - Gene convergence tracking, fitness landscapes,
// Hall of Fame, gene importance, generation statistics
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type {
  Bot, BotGroupName, StrategyDNA, FitnessScores,
  GenerationAnalytics, HallOfFameEntry, GeneConvergence,
  PopulationDiversityMetrics, SpeciesCluster, ParetoFront,
  AdvancedEvolutionConfig, BotPersonality,
} from './types';
import { dnaToArray, getAllGeneRanges } from './dnaFactory';
import { calculateGeneConvergence, calculatePopulationDiversity, speciateBots, buildParetoFront } from './populationDiversity';
import { buildPersonality } from './botPersonality';

// ===================== GENERATION ANALYTICS =====================

export function buildGenerationAnalytics(
  bots: Bot[],
  groupName: BotGroupName,
  fitnessMap: Map<string, number>,
  fitnessScoresMap: Map<string, FitnessScores>,
  generation: number,
  config: AdvancedEvolutionConfig,
): GenerationAnalytics {
  const groupBots = bots.filter(b => b.groupName === groupName);
  const fitnesses = groupBots.map(b => fitnessMap.get(b.id) || 0);

  const avgFitness = fitnesses.length > 0
    ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length : 0;
  const bestFitness = fitnesses.length > 0 ? Math.max(...fitnesses) : 0;
  const worstFitness = fitnesses.length > 0 ? Math.min(...fitnesses) : 0;

  const mean = avgFitness;
  const variance = fitnesses.reduce((sum, f) => sum + (f - mean) ** 2, 0) /
    Math.max(fitnesses.length, 1);
  const fitnessStdDev = Math.sqrt(variance);

  // Species clusters
  const groupFitnessMap = new Map<string, number>();
  for (const bot of groupBots) {
    groupFitnessMap.set(bot.id, fitnessMap.get(bot.id) || 0);
  }
  const speciesClusters = speciateBots(groupBots, groupFitnessMap);

  // Diversity metrics
  const groupFitnessScores = new Map<string, FitnessScores>();
  for (const bot of groupBots) {
    const scores = fitnessScoresMap.get(bot.id);
    if (scores) groupFitnessScores.set(bot.id, scores);
  }
  const diversity = calculatePopulationDiversity(groupBots, groupFitnessScores, generation, speciesClusters);

  // Pareto front
  const paretoFront = buildParetoFront(groupBots, fitnessScoresMap, generation);

  // Gene importance (correlation between gene value and fitness)
  const topGenes = calculateGeneImportance(groupBots, fitnessMap);

  return {
    generation,
    groupName,
    avgFitness: Number(avgFitness.toFixed(4)),
    bestFitness: Number(bestFitness.toFixed(4)),
    worstFitness: Number(worstFitness.toFixed(4)),
    fitnessStdDev: Number(fitnessStdDev.toFixed(4)),
    diversity,
    speciesClusters,
    paretoFront,
    topGenes,
    crossoverMethod: config.crossoverMethod,
    selectionMethod: config.selectionMethod,
    mutationMethod: config.mutationMethod,
    effectiveMutationRate: config.mutationRate,
    timestamp: new Date().toISOString(),
  };
}

// ===================== GENE IMPORTANCE =====================

// Rank genes by their Pearson correlation with fitness
export function calculateGeneImportance(
  bots: Bot[],
  fitnessMap: Map<string, number>,
): { gene: string; importance: number }[] {
  if (bots.length < 3) return [];

  const allRanges = getAllGeneRanges();
  const fitnesses = bots.map(b => fitnessMap.get(b.id) || 0);
  const fitMean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;

  const results: { gene: string; importance: number }[] = [];

  for (const [category, genes] of Object.entries(allRanges)) {
    for (const geneName of Object.keys(genes)) {
      const geneValues = bots.map(bot => {
        const catGenes = (bot.dna as any)[category] as Record<string, number>;
        return catGenes[geneName] ?? 0;
      });

      const geneMean = geneValues.reduce((a, b) => a + b, 0) / geneValues.length;

      // Pearson correlation
      let covSum = 0, geneVarSum = 0, fitVarSum = 0;
      for (let i = 0; i < bots.length; i++) {
        const gDiff = geneValues[i] - geneMean;
        const fDiff = fitnesses[i] - fitMean;
        covSum += gDiff * fDiff;
        geneVarSum += gDiff ** 2;
        fitVarSum += fDiff ** 2;
      }

      const denom = Math.sqrt(geneVarSum * fitVarSum);
      const correlation = denom > 0 ? covSum / denom : 0;

      results.push({
        gene: `${category}.${geneName}`,
        importance: Number(Math.abs(correlation).toFixed(4)),
      });
    }
  }

  // Sort by importance descending
  results.sort((a, b) => b.importance - a.importance);
  return results.slice(0, 15); // top 15 most important genes
}

// ===================== HALL OF FAME =====================

export class HallOfFame {
  private db: Database.Database;
  private maxSize: number;

  constructor(db: Database.Database, maxSize: number = 50) {
    this.db = db;
    this.maxSize = maxSize;
  }

  // Check if a bot qualifies for Hall of Fame induction
  shouldInduct(fitness: number): boolean {
    const current = this.getAll();
    if (current.length < this.maxSize) return true;

    // Must beat the worst current member
    const worstFitness = Math.min(...current.map(e => e.fitness));
    return fitness > worstFitness;
  }

  // Induct a bot into the Hall of Fame
  induct(
    bot: Bot,
    fitness: number,
    tournamentId: string,
    metrics: HallOfFameEntry['metrics'],
  ): HallOfFameEntry {
    const personality = buildPersonality(bot.dna);

    const entry: HallOfFameEntry = {
      id: uuidv4(),
      botId: bot.id,
      botName: bot.name,
      groupName: bot.groupName,
      symbol: bot.symbol,
      dna: bot.dna,
      personality,
      fitness,
      generation: bot.generation,
      tournamentId,
      metrics,
      inductedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO hall_of_fame (id, bot_id, bot_name, group_name, symbol, dna, personality, fitness, generation, tournament_id, metrics, inducted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.botId,
      entry.botName,
      entry.groupName,
      entry.symbol,
      JSON.stringify(entry.dna),
      JSON.stringify(entry.personality),
      entry.fitness,
      entry.generation,
      entry.tournamentId,
      JSON.stringify(entry.metrics),
      entry.inductedAt,
    );

    // Trim if over max size
    this.trim();

    return entry;
  }

  // Get all Hall of Fame entries
  getAll(limit: number = 50): HallOfFameEntry[] {
    const rows = this.db.prepare(
      'SELECT * FROM hall_of_fame ORDER BY fitness DESC LIMIT ?'
    ).all(limit) as Record<string, unknown>[];

    return rows.map(this.rowToEntry);
  }

  // Get top entries by group
  getByGroup(groupName: BotGroupName, limit: number = 10): HallOfFameEntry[] {
    const rows = this.db.prepare(
      'SELECT * FROM hall_of_fame WHERE group_name = ? ORDER BY fitness DESC LIMIT ?'
    ).all(groupName, limit) as Record<string, unknown>[];

    return rows.map(this.rowToEntry);
  }

  // Get best ever bot
  getBest(): HallOfFameEntry | null {
    const row = this.db.prepare(
      'SELECT * FROM hall_of_fame ORDER BY fitness DESC LIMIT 1'
    ).get() as Record<string, unknown> | undefined;

    return row ? this.rowToEntry(row) : null;
  }

  private trim(): void {
    const count = (this.db.prepare('SELECT COUNT(*) as cnt FROM hall_of_fame').get() as { cnt: number }).cnt;
    if (count > this.maxSize) {
      this.db.prepare(`
        DELETE FROM hall_of_fame WHERE id NOT IN (
          SELECT id FROM hall_of_fame ORDER BY fitness DESC LIMIT ?
        )
      `).run(this.maxSize);
    }
  }

  private rowToEntry(row: Record<string, unknown>): HallOfFameEntry {
    return {
      id: row.id as string,
      botId: row.bot_id as string,
      botName: row.bot_name as string,
      groupName: row.group_name as BotGroupName,
      symbol: row.symbol as string,
      dna: JSON.parse(row.dna as string),
      personality: JSON.parse(row.personality as string),
      fitness: row.fitness as number,
      generation: row.generation as number,
      tournamentId: row.tournament_id as string,
      metrics: JSON.parse(row.metrics as string),
      inductedAt: row.inducted_at as string,
    };
  }
}

// ===================== GENERATION STATS PERSISTENCE =====================

export function saveGenerationAnalytics(
  db: Database.Database,
  analytics: GenerationAnalytics,
): void {
  db.prepare(`
    INSERT INTO generation_analytics (id, generation, group_name, avg_fitness, best_fitness, worst_fitness,
      fitness_std_dev, diversity_metrics, species_clusters, pareto_front, top_genes,
      crossover_method, selection_method, mutation_method, effective_mutation_rate, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    analytics.generation,
    analytics.groupName,
    analytics.avgFitness,
    analytics.bestFitness,
    analytics.worstFitness,
    analytics.fitnessStdDev,
    JSON.stringify(analytics.diversity),
    JSON.stringify(analytics.speciesClusters),
    JSON.stringify(analytics.paretoFront),
    JSON.stringify(analytics.topGenes),
    analytics.crossoverMethod,
    analytics.selectionMethod,
    analytics.mutationMethod,
    analytics.effectiveMutationRate,
    analytics.timestamp,
  );
}

export function getGenerationAnalyticsHistory(
  db: Database.Database,
  groupName?: BotGroupName,
  limit: number = 20,
): GenerationAnalytics[] {
  let query = 'SELECT * FROM generation_analytics';
  const params: unknown[] = [];

  if (groupName) {
    query += ' WHERE group_name = ?';
    params.push(groupName);
  }
  query += ' ORDER BY generation DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

  return rows.map(row => ({
    generation: row.generation as number,
    groupName: row.group_name as BotGroupName,
    avgFitness: row.avg_fitness as number,
    bestFitness: row.best_fitness as number,
    worstFitness: row.worst_fitness as number,
    fitnessStdDev: row.fitness_std_dev as number,
    diversity: JSON.parse(row.diversity_metrics as string),
    speciesClusters: JSON.parse(row.species_clusters as string),
    paretoFront: JSON.parse(row.pareto_front as string),
    topGenes: JSON.parse(row.top_genes as string),
    crossoverMethod: row.crossover_method as any,
    selectionMethod: row.selection_method as any,
    mutationMethod: row.mutation_method as any,
    effectiveMutationRate: row.effective_mutation_rate as number,
    timestamp: row.timestamp as string,
  }));
}

// ===================== EVOLUTION SUMMARY =====================

// Get a high-level summary of evolution progress
export function getEvolutionSummary(
  db: Database.Database,
): {
  totalGenerations: number;
  hallOfFameSize: number;
  bestEverFitness: number;
  bestEverBot: string;
  avgFitnessTrend: number[];
  diversityTrend: number[];
  dominantArchetypes: Record<string, number>;
} {
  // Total generations
  const genRow = db.prepare(
    'SELECT MAX(generation) as maxGen FROM generation_analytics'
  ).get() as { maxGen: number | null } | undefined;
  const totalGenerations = genRow?.maxGen || 0;

  // Hall of Fame size
  const hofCount = (db.prepare('SELECT COUNT(*) as cnt FROM hall_of_fame').get() as { cnt: number }).cnt;

  // Best ever
  const bestRow = db.prepare(
    'SELECT * FROM hall_of_fame ORDER BY fitness DESC LIMIT 1'
  ).get() as Record<string, unknown> | undefined;
  const bestEverFitness = (bestRow?.fitness as number) || 0;
  const bestEverBot = (bestRow?.bot_name as string) || 'None';

  // Fitness trend (last 20 generations)
  const fitnessRows = db.prepare(
    'SELECT generation, AVG(avg_fitness) as avg FROM generation_analytics GROUP BY generation ORDER BY generation DESC LIMIT 20'
  ).all() as { generation: number; avg: number }[];
  const avgFitnessTrend = fitnessRows.reverse().map(r => Number(r.avg.toFixed(4)));

  // Diversity trend
  const diversityRows = db.prepare(
    'SELECT generation, diversity_metrics FROM generation_analytics ORDER BY generation DESC LIMIT 20'
  ).all() as { generation: number; diversity_metrics: string }[];
  const diversityTrend = diversityRows.reverse().map(r => {
    const metrics = JSON.parse(r.diversity_metrics) as PopulationDiversityMetrics;
    return metrics.genotypicDiversity;
  });

  // Dominant archetypes from Hall of Fame
  const archetypeRows = db.prepare(
    'SELECT personality FROM hall_of_fame'
  ).all() as { personality: string }[];
  const dominantArchetypes: Record<string, number> = {};
  for (const row of archetypeRows) {
    const personality = JSON.parse(row.personality) as BotPersonality;
    dominantArchetypes[personality.archetype] = (dominantArchetypes[personality.archetype] || 0) + 1;
  }

  return {
    totalGenerations,
    hallOfFameSize: hofCount,
    bestEverFitness,
    bestEverBot,
    avgFitnessTrend,
    diversityTrend,
    dominantArchetypes,
  };
}
