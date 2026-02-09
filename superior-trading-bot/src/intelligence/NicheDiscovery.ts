/**
 * Niche Discovery Engine
 * Layer 4: Competitive Intelligence
 *
 * Finds strategy-regime combinations that no arena bot currently
 * exploits well. Maps the competitive landscape to identify
 * underexploited niches, overcrowded failures, and unexplored territory.
 *
 * For each (strategy_archetype, regime) pair:
 *   coverage < 2 AND performance > 0 → UNDEREXPLOITED (high priority)
 *   coverage > 5 AND performance < 0 → OVERCROWDED (avoid)
 *   coverage = 0                     → UNEXPLORED (needs validation)
 */

import { EventEmitter } from 'events';
import {
  NicheOpportunity, NicheMap, NicheRecommendation, NicheStatus
} from '../types/synthesis';
import { MarketRegime, ObservationEvent, StrategyFingerprint } from '../types/core';

// ===================== CONFIG =====================

interface NicheConfig {
  updateInterval: number;          // ms between niche map updates
  underexploitedMaxCoverage: number;  // max bots for underexploited
  overcrowdedMinCoverage: number;     // min bots for overcrowded
  minPerformanceSamples: number;      // min trades for performance estimation
  nicheCapacityEstimate: number;      // estimated max bots before crowding
  opportunityDecayHours: number;      // hours before niche opportunities decay
}

const DEFAULT_CONFIG: NicheConfig = {
  updateInterval: 60000,   // every minute
  underexploitedMaxCoverage: 2,
  overcrowdedMinCoverage: 5,
  minPerformanceSamples: 10,
  nicheCapacityEstimate: 4,
  opportunityDecayHours: 24,
};

const REGIMES: MarketRegime[] = ['TRENDING', 'RANGING', 'VOLATILE', 'BREAKOUT', 'EVENT', 'QUIET'];

const ARCHETYPE_NAMES: Record<number, string> = {
  0: 'Balanced',
  1: 'Scalper',
  2: 'Swing Trader',
  3: 'Trend Follower',
  4: 'Mean Reversion',
  5: 'Breakout',
  6: 'Momentum',
  7: 'Contrarian',
};

let nicheIdCounter = 0;

// ===================== NICHE DISCOVERY =====================

export class NicheDiscovery extends EventEmitter {
  private config: NicheConfig;
  private latestMap: NicheMap | null = null;
  private nicheHistory: NicheMap[] = [];
  private updateTimer: NodeJS.Timeout | null = null;

  // Cached data for analysis
  private fingerprints: StrategyFingerprint[] = [];
  private tradesByBotRegime: Map<string, Map<string, TradeRecord[]>> = new Map();

  constructor(config: Partial<NicheConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===================== LIFECYCLE =====================

  start(): void {
    this.updateTimer = setInterval(() => {
      this.updateNicheMap();
    }, this.config.updateInterval);
  }

  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  // ===================== DATA INPUT =====================

  /**
   * Update fingerprints from Layer 2 pattern extraction.
   */
  updateFingerprints(fingerprints: StrategyFingerprint[]): void {
    this.fingerprints = fingerprints;
  }

  /**
   * Process trade events for niche performance estimation.
   */
  processTrade(event: ObservationEvent): void {
    const payload = event.payload as any;
    const botId = payload.botId || (event as any).botId;
    const regime = (event as any).enrichment?.marketRegime ||
      event.enrichmentMetadata?.indicators?.trendStrength || 'RANGING';
    const pnl = payload.pnl || 0;

    if (!botId) return;

    if (!this.tradesByBotRegime.has(botId)) {
      this.tradesByBotRegime.set(botId, new Map());
    }

    const botRegimes = this.tradesByBotRegime.get(botId)!;
    if (!botRegimes.has(regime)) {
      botRegimes.set(regime, []);
    }

    botRegimes.get(regime)!.push({
      pnl,
      timestamp: event.timestamp,
    });

    // Cap stored trades
    const trades = botRegimes.get(regime)!;
    if (trades.length > 200) {
      botRegimes.set(regime, trades.slice(-200));
    }
  }

  // ===================== NICHE MAP GENERATION =====================

  /**
   * Generate the full niche map showing opportunities.
   */
  updateNicheMap(): NicheMap {
    const niches: NicheOpportunity[] = [];
    const archetypeIds = this.getActiveArchetypes();

    for (const archetypeId of archetypeIds) {
      for (const regime of REGIMES) {
        const niche = this.analyzeNiche(archetypeId, regime);
        if (niche) {
          niches.push(niche);
        }
      }
    }

    // Sort by opportunity score
    niches.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(niches);

    const map: NicheMap = {
      timestamp: Date.now(),
      niches,
      totalNiches: niches.length,
      underexploitedCount: niches.filter(n => n.status === 'underexploited').length,
      overcrowdedCount: niches.filter(n => n.status === 'overcrowded').length,
      unexploredCount: niches.filter(n => n.status === 'unexplored').length,
      recommendations,
    };

    this.latestMap = map;
    this.nicheHistory.push(map);

    // Keep history bounded
    if (this.nicheHistory.length > 100) {
      this.nicheHistory = this.nicheHistory.slice(-100);
    }

    this.emit('niche:updated', {
      total: niches.length,
      underexploited: map.underexploitedCount,
      overcrowded: map.overcrowdedCount,
      unexplored: map.unexploredCount,
    });

    return map;
  }

  private analyzeNiche(archetypeId: number, regime: MarketRegime): NicheOpportunity | null {
    // Find bots in this archetype
    const botsInArchetype = this.fingerprints.filter(
      f => f.archetypeId === archetypeId
    );

    // Find bots active in this regime
    const botsActiveInRegime = botsInArchetype.filter(
      f => f.preferredRegimes.includes(regime)
    );

    const coverage = botsActiveInRegime.length;

    // Calculate average performance in this niche
    const avgPerformance = this.calculateNichePerformance(
      botsActiveInRegime.map(b => b.botId), regime
    );

    // Classify niche status
    const status = this.classifyNiche(coverage, avgPerformance);

    // Calculate opportunity score
    const opportunityScore = this.calculateOpportunityScore(status, coverage, avgPerformance);

    // Skip balanced niches (not interesting)
    if (status === 'balanced' && opportunityScore < 0.3) return null;

    const archetypeName = ARCHETYPE_NAMES[archetypeId] || `Archetype-${archetypeId}`;

    return {
      id: `niche_${++nicheIdCounter}`,
      regime,
      archetypeId,
      archetypeName,
      status,
      coverage,
      avgPerformance,
      estimatedCapacity: this.config.nicheCapacityEstimate,
      opportunityScore,
      conditions: `${archetypeName} strategies in ${regime} markets`,
      discoveredAt: Date.now(),
    };
  }

  private classifyNiche(coverage: number, avgPerformance: number): NicheStatus {
    if (coverage === 0) return 'unexplored';
    if (coverage <= this.config.underexploitedMaxCoverage && avgPerformance > 0) return 'underexploited';
    if (coverage >= this.config.overcrowdedMinCoverage && avgPerformance < 0) return 'overcrowded';
    return 'balanced';
  }

  private calculateOpportunityScore(status: NicheStatus, coverage: number, performance: number): number {
    switch (status) {
      case 'underexploited':
        // High priority: few bots, positive performance
        return Math.min(1, 0.5 + Math.abs(performance) * 5 + (1 - coverage / this.config.nicheCapacityEstimate) * 0.3);

      case 'unexplored':
        // Medium priority: unknown territory, needs validation
        return 0.4;

      case 'overcrowded':
        // Negative: too many bots, negative performance → avoid
        return Math.max(0, 0.1 - Math.abs(performance) * 2);

      case 'balanced':
        return 0.2;

      default:
        return 0;
    }
  }

  // ===================== PERFORMANCE CALCULATION =====================

  private calculateNichePerformance(botIds: string[], regime: string): number {
    let totalReturn = 0;
    let totalTrades = 0;

    for (const botId of botIds) {
      const botRegimes = this.tradesByBotRegime.get(botId);
      if (!botRegimes) continue;

      const trades = botRegimes.get(regime);
      if (!trades || trades.length < this.config.minPerformanceSamples) continue;

      const avgReturn = trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length;
      totalReturn += avgReturn;
      totalTrades += trades.length;
    }

    return totalTrades > 0 ? totalReturn / Math.max(botIds.length, 1) : 0;
  }

  // ===================== RECOMMENDATIONS =====================

  private generateRecommendations(niches: NicheOpportunity[]): NicheRecommendation[] {
    const recommendations: NicheRecommendation[] = [];

    // Recommend entering underexploited niches
    const underexploited = niches.filter(n => n.status === 'underexploited');
    for (const niche of underexploited.slice(0, 3)) {
      recommendations.push({
        niche,
        action: 'enter',
        priority: Math.round(niche.opportunityScore * 10),
        reasoning: `Only ${niche.coverage} bots in ${niche.archetypeName}/${niche.regime} with positive avg return (${(niche.avgPerformance * 100).toFixed(2)}%)`,
        estimatedEdge: niche.avgPerformance,
      });
    }

    // Recommend exploring unexplored niches
    const unexplored = niches.filter(n => n.status === 'unexplored');
    for (const niche of unexplored.slice(0, 2)) {
      recommendations.push({
        niche,
        action: 'explore',
        priority: 4,
        reasoning: `No bots trading ${niche.archetypeName} in ${niche.regime} — untapped territory`,
        estimatedEdge: 0,
      });
    }

    // Recommend exiting overcrowded niches
    const overcrowded = niches.filter(n => n.status === 'overcrowded');
    for (const niche of overcrowded.slice(0, 2)) {
      recommendations.push({
        niche,
        action: 'exit',
        priority: 8,
        reasoning: `${niche.coverage} bots crowding ${niche.archetypeName}/${niche.regime} with avg loss (${(niche.avgPerformance * 100).toFixed(2)}%)`,
        estimatedEdge: niche.avgPerformance,
      });
    }

    // Sort by priority
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations;
  }

  // ===================== ARCHETYPE HELPERS =====================

  private getActiveArchetypes(): number[] {
    const archetypes = new Set<number>();

    for (const fp of this.fingerprints) {
      if (fp.archetypeId !== undefined) {
        archetypes.add(fp.archetypeId);
      }
    }

    // Always include base archetypes
    for (let i = 0; i < 5; i++) archetypes.add(i);

    return [...archetypes];
  }

  // ===================== NICHE TRACKING OVER TIME =====================

  /**
   * Track how niches evolve over time.
   */
  getNicheTrend(archetypeId: number, regime: MarketRegime): {
    timestamps: number[];
    coverages: number[];
    performances: number[];
    statuses: NicheStatus[];
  } {
    const timestamps: number[] = [];
    const coverages: number[] = [];
    const performances: number[] = [];
    const statuses: NicheStatus[] = [];

    for (const map of this.nicheHistory) {
      const niche = map.niches.find(
        n => n.archetypeId === archetypeId && n.regime === regime
      );
      if (niche) {
        timestamps.push(map.timestamp);
        coverages.push(niche.coverage);
        performances.push(niche.avgPerformance);
        statuses.push(niche.status);
      }
    }

    return { timestamps, coverages, performances, statuses };
  }

  // ===================== PUBLIC API =====================

  getLatestMap(): NicheMap | null {
    return this.latestMap;
  }

  getUnderexploitedNiches(): NicheOpportunity[] {
    if (!this.latestMap) return [];
    return this.latestMap.niches.filter(n => n.status === 'underexploited');
  }

  getOvercrowdedNiches(): NicheOpportunity[] {
    if (!this.latestMap) return [];
    return this.latestMap.niches.filter(n => n.status === 'overcrowded');
  }

  getRecommendations(): NicheRecommendation[] {
    return this.latestMap?.recommendations || [];
  }

  getStats(): {
    totalNiches: number;
    underexploited: number;
    overcrowded: number;
    unexplored: number;
    balanced: number;
    topOpportunity: string | null;
    mapsGenerated: number;
  } {
    const map = this.latestMap;
    if (!map) {
      return {
        totalNiches: 0, underexploited: 0, overcrowded: 0,
        unexplored: 0, balanced: 0, topOpportunity: null, mapsGenerated: 0,
      };
    }

    const topNiche = map.niches[0];

    return {
      totalNiches: map.totalNiches,
      underexploited: map.underexploitedCount,
      overcrowded: map.overcrowdedCount,
      unexplored: map.unexploredCount,
      balanced: map.niches.filter(n => n.status === 'balanced').length,
      topOpportunity: topNiche
        ? `${topNiche.archetypeName}/${topNiche.regime} (score: ${topNiche.opportunityScore.toFixed(2)})`
        : null,
      mapsGenerated: this.nicheHistory.length,
    };
  }
}

// ===================== INTERNAL TYPES =====================

interface TradeRecord {
  pnl: number;
  timestamp: number;
}

export default NicheDiscovery;
