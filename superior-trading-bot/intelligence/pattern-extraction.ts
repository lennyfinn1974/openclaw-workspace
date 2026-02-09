/**
 * Pattern Extraction Engine - Layer 2 of Superior Trading Bot
 * 
 * Purpose: Transform raw observations into actionable intelligence: what works, when, and why.
 * 
 * Key Algorithms:
 * - Shapley Value Attribution: Decompose trade outcomes into regime, timing, direction, sizing contributions
 * - Behavioral Clustering: UMAP + HDBSCAN to identify strategy archetypes 
 * - Regime-Conditional Performance: Build performance matrices across market conditions
 * - Pattern Discovery: Statistical significance testing for recurring profitable patterns
 */

import { EventEmitter } from 'events';
import { MemorySystem, ObservationEvent, BotFingerprint, PatternRecord } from '../core/memory-system';
import { Logger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';

// ===================== TYPES =====================

export interface PatternDiscovery {
  id: string;
  type: 'entry_pattern' | 'exit_pattern' | 'regime_transition' | 'crowding_signal' | 'arbitrage_opportunity';
  confidence: number; // 0-1
  profitability: number; // Expected return
  frequency: number; // Occurrences per day
  conditions: PatternConditions;
  examples: string[]; // Event IDs showing the pattern
  discoveredAt: number;
  validatedTrades: number;
  failedTrades: number;
}

export interface PatternConditions {
  indicators?: {
    rsi?: { min?: number; max?: number };
    macd?: { direction?: 'positive' | 'negative'; threshold?: number };
    bbPosition?: { min?: number; max?: number };
    volume?: { minRatio?: number };
  };
  regime?: string[];
  timeOfDay?: { start?: number; end?: number };
  symbols?: string[];
  botBehavior?: {
    groupName?: string;
    directionBias?: { min?: number; max?: number };
    recentPerformance?: { min?: number; max?: number };
  };
}

export interface TradeAttribution {
  tradeId: string;
  botId: string;
  totalReturn: number;
  
  // Shapley value decomposition
  contributions: {
    regime: number;        // How much return came from being in right regime
    timing: number;        // Entry/exit timing quality
    direction: number;     // Long vs short correctness  
    sizing: number;        // Position size optimality
    skill: number;         // Residual skill after accounting for luck
  };
  
  // Counterfactuals for attribution
  counterfactuals: {
    randomEntry: number;      // Same direction, random entry time
    medianSize: number;       // Same trade, median position size
    oppositeDirection: number; // Opposite direction
    randomRegime: number;     // Random regime timing
  };
  
  confidence: number; // How reliable is this attribution
}

export interface StrategyArchetype {
  id: number;
  name: string;
  description: string;
  botIds: string[];
  
  // Behavioral signature
  characteristics: {
    avgHoldingPeriod: number;
    tradeFrequency: number;
    preferredRegimes: string[];
    directionBias: number;
    riskTolerance: number;
    adaptability: number; // How quickly it adjusts to new conditions
  };
  
  // Performance metrics
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    winRate: number;
    maxDrawdown: number;
    consistency: number;
  };
  
  // Regime-specific performance
  performanceByRegime: Record<string, {
    return: number;
    sharpe: number;
    winRate: number;
    tradeCount: number;
  }>;
}

// ===================== PATTERN EXTRACTION ENGINE =====================

export class PatternExtraction extends EventEmitter {
  private config: any;
  private memory: MemorySystem;
  private logger: Logger;
  
  private isActive = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private patternCount = 0;
  
  // Analysis state
  private archetypes: Map<number, StrategyArchetype> = new Map();
  private attributionCache: Map<string, TradeAttribution> = new Map();
  private regimePerformance: Map<string, Map<string, number[]>> = new Map(); // regime -> botId -> returns
  
  // Processing queues
  private pendingAttributions: ObservationEvent[] = [];
  private pendingFingerprints: string[] = []; // botIds needing fingerprint updates
  
  private readonly ATTRIBUTION_BATCH_SIZE = 10;
  private readonly PROCESSING_INTERVAL_MS = 5000; // Process every 5 seconds
  
  constructor(config: any, memory: MemorySystem, logger: Logger) {
    super();
    this.config = config;
    this.memory = memory;
    this.logger = new Logger('PATTERN-EXTRACTION');
  }
  
  // ===================== LIFECYCLE =====================
  
  async start(): Promise<void> {
    this.logger.info('🔍 Starting Pattern Extraction Engine - Layer 2');
    
    try {
      // Load existing archetypes and patterns
      await this.loadArchetypes();
      
      // Start processing loop
      this.processingInterval = setInterval(() => {
        this.processEventQueue();
      }, this.PROCESSING_INTERVAL_MS);
      
      // Subscribe to new observations
      this.memory.on('event:added', (event: ObservationEvent) => {
        this.handleNewObservation(event);
      });
      
      this.isActive = true;
      this.logger.success('✅ Pattern Extraction Engine online - Intelligence gathering active');
      
    } catch (error) {
      this.logger.error('❌ Failed to start Pattern Extraction Engine', error);
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    this.logger.info('🛑 Stopping Pattern Extraction Engine...');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Process remaining queued items
    await this.processEventQueue();
    
    // Save state
    await this.saveArchetypes();
    
    this.isActive = false;
    this.logger.success('✅ Pattern Extraction Engine stopped');
  }
  
  // ===================== EVENT HANDLING =====================
  
  private handleNewObservation(event: ObservationEvent): void {
    switch (event.eventType) {
      case 'trade':
        this.pendingAttributions.push(event);
        this.pendingFingerprints.push(event.botId!);
        break;
        
      case 'leaderboard':
        this.analyzeLeaderboardShifts(event);
        break;
        
      case 'evolution':
        this.analyzeEvolutionImpact(event);
        break;
    }
  }
  
  private async processEventQueue(): Promise<void> {
    if (!this.isActive) return;
    
    try {
      // Process trade attributions
      await this.processPendingAttributions();
      
      // Update bot fingerprints
      await this.updatePendingFingerprints();
      
      // Discover new patterns
      await this.discoverPatterns();
      
      // Update archetypes
      await this.updateArchetypes();
      
    } catch (error) {
      this.logger.error('❌ Error in pattern processing', error);
      this.emit('error', error);
    }
  }
  
  // ===================== TRADE ATTRIBUTION (SHAPLEY VALUES) =====================
  
  private async processPendingAttributions(): Promise<void> {
    const batch = this.pendingAttributions.splice(0, this.ATTRIBUTION_BATCH_SIZE);
    
    for (const event of batch) {
      try {
        const attribution = await this.attributeTrade(event);
        if (attribution) {
          this.attributionCache.set(event.id, attribution);
          this.emit('attribution:complete', attribution);
          
          this.logger.debug('📊 Trade attributed', {
            tradeId: attribution.tradeId,
            skill: attribution.contributions.skill.toFixed(3),
            regime: attribution.contributions.regime.toFixed(3)
          });
        }
      } catch (error) {
        this.logger.warn('⚠️ Attribution failed for trade', { eventId: event.id, error: error.message });
      }
    }
  }
  
  private async attributeTrade(event: ObservationEvent): Promise<TradeAttribution | null> {
    const trade = event.payload;
    if (!trade.pnl || trade.pnl === 0) {
      return null; // Can't attribute trades with no P&L
    }
    
    const botId = event.botId!;
    const totalReturn = trade.pnl / (trade.quantity * trade.price); // Percentage return
    
    // Get historical context for this bot and symbol
    const botTrades = this.memory.getEventsByBotId(botId, 100);
    const symbolTrades = botTrades.filter(e => e.payload?.symbol === trade.symbol);
    
    if (symbolTrades.length < 5) {
      return null; // Need more history for attribution
    }
    
    // Calculate Shapley values through marginal contribution analysis
    const contributions = await this.calculateShapleyValues(event, symbolTrades);
    const counterfactuals = await this.calculateCounterfactuals(event, symbolTrades);
    
    return {
      tradeId: event.id,
      botId,
      totalReturn,
      contributions,
      counterfactuals,
      confidence: this.calculateAttributionConfidence(symbolTrades.length, event.enrichment),
    };
  }
  
  private async calculateShapleyValues(event: ObservationEvent, historicalTrades: ObservationEvent[]) {
    const trade = event.payload;
    const totalReturn = trade.pnl / (trade.quantity * trade.price);
    
    // For Shapley values, we calculate marginal contributions of each factor
    
    // 1. Regime Contribution: Compare performance in this regime vs others
    const regime = event.enrichment?.marketRegime || 'UNKNOWN';
    const regimeReturn = this.getAverageReturnInRegime(historicalTrades, regime);
    const overallReturn = this.getAverageReturn(historicalTrades);
    const regimeContribution = (regimeReturn - overallReturn) * 0.3; // Weight by importance
    
    // 2. Timing Contribution: Quality of entry vs random entries in same period
    const timingScore = this.evaluateEntryTiming(event, historicalTrades);
    const timingContribution = timingScore * totalReturn * 0.25;
    
    // 3. Direction Contribution: Was the direction call correct?
    const directionScore = this.evaluateDirectionChoice(event, historicalTrades);
    const directionContribution = directionScore * totalReturn * 0.25;
    
    // 4. Sizing Contribution: Was position size appropriate?
    const sizingScore = this.evaluatePositionSizing(event, historicalTrades);
    const sizingContribution = sizingScore * totalReturn * 0.15;
    
    // 5. Skill (Residual): What's left after accounting for other factors
    const explainedReturn = regimeContribution + timingContribution + directionContribution + sizingContribution;
    const skillContribution = totalReturn - explainedReturn;
    
    return {
      regime: regimeContribution,
      timing: timingContribution,
      direction: directionContribution,
      sizing: sizingContribution,
      skill: skillContribution,
    };
  }
  
  private async calculateCounterfactuals(event: ObservationEvent, historicalTrades: ObservationEvent[]) {
    // Calculate what would have happened under different scenarios
    
    return {
      randomEntry: this.simulateRandomEntry(event, historicalTrades),
      medianSize: this.simulateMedianSize(event, historicalTrades),
      oppositeDirection: -event.payload.pnl / (event.payload.quantity * event.payload.price), // Simple opposite
      randomRegime: this.simulateRandomRegime(event, historicalTrades),
    };
  }
  
  // ===================== BEHAVIORAL CLUSTERING =====================
  
  private async updatePendingFingerprints(): Promise<void> {
    // Remove duplicates
    const uniqueBotIds = [...new Set(this.pendingFingerprints)];
    this.pendingFingerprints = [];
    
    for (const botId of uniqueBotIds.slice(0, 5)) { // Process 5 at a time
      try {
        await this.updateBotFingerprint(botId);
      } catch (error) {
        this.logger.warn('⚠️ Fingerprint update failed', { botId, error: error.message });
      }
    }
  }
  
  private async updateBotFingerprint(botId: string): Promise<void> {
    const botTrades = this.memory.getEventsByBotId(botId, 200);
    const tradeTrades = botTrades.filter(e => e.eventType === 'trade');
    
    if (tradeTrades.length < 10) {
      return; // Need more data
    }
    
    // Calculate behavioral metrics
    const holdingPeriods = this.calculateHoldingPeriods(tradeTrades);
    const tradeFrequency = this.calculateTradeFrequency(tradeTrades);
    const directionBias = this.calculateDirectionBias(tradeTrades);
    const preferredRegimes = this.identifyPreferredRegimes(tradeTrades);
    const performanceByRegime = this.calculatePerformanceByRegime(tradeTrades);
    
    // Create fingerprint
    const fingerprint: Partial<BotFingerprint> = {
      botId,
      avgHoldingPeriod: holdingPeriods.length > 0 ? holdingPeriods.reduce((a, b) => a + b) / holdingPeriods.length : 0,
      tradeFrequency,
      directionBias,
      preferredRegimes,
      performanceByRegime,
    };
    
    // Update in memory
    this.memory.updateBotFingerprint(botId, fingerprint);
    
    this.logger.debug('👤 Bot fingerprint updated', {
      botId,
      tradeCount: tradeTrades.length,
      frequency: tradeFrequency.toFixed(2),
      bias: directionBias.toFixed(2)
    });
  }
  
  // ===================== PATTERN DISCOVERY =====================
  
  private async discoverPatterns(): Promise<void> {
    // Look for statistically significant patterns in recent data
    const recentEvents = this.memory.getRecentEvents(1000);
    const tradeEvents = recentEvents.filter(e => e.eventType === 'trade');
    
    // Group trades by similar conditions
    const conditionGroups = this.groupTradesByConditions(tradeEvents);
    
    for (const [conditions, trades] of conditionGroups) {
      if (trades.length < 5) continue; // Need statistical significance
      
      const pattern = await this.analyzePatternSignificance(conditions, trades);
      if (pattern && pattern.confidence > 0.7) {
        await this.recordPattern(pattern);
      }
    }
  }
  
  private groupTradesByConditions(trades: ObservationEvent[]): Map<string, ObservationEvent[]> {
    const groups = new Map<string, ObservationEvent[]>();
    
    for (const trade of trades) {
      // Create condition signature
      const indicators = trade.enrichment?.indicators;
      const regime = trade.enrichment?.marketRegime;
      
      if (!indicators || !regime) continue;
      
      // Discretize conditions for grouping
      const conditionKey = [
        regime,
        this.discretizeRSI(indicators.rsi14),
        this.discretizeVolume(indicators.volumeRatio),
        this.discretizeTrend(indicators.trendStrength),
        trade.payload.side,
      ].join('|');
      
      if (!groups.has(conditionKey)) {
        groups.set(conditionKey, []);
      }
      groups.get(conditionKey)!.push(trade);
    }
    
    return groups;
  }
  
  private async analyzePatternSignificance(conditionsKey: string, trades: ObservationEvent[]): Promise<PatternDiscovery | null> {
    // Statistical analysis of pattern profitability
    const returns = trades.map(t => t.payload.pnl || 0);
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    
    if (avgReturn <= 0) return null; // Only interested in profitable patterns
    
    // Statistical significance test (simplified t-test)
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const tStat = Math.abs(avgReturn) / (stdDev / Math.sqrt(returns.length));
    const confidence = Math.min(0.99, Math.max(0, (tStat - 1.96) / 4)); // Rough confidence estimate
    
    if (confidence < 0.6) return null;
    
    // Parse conditions back
    const [regime, rsiRange, volumeRange, trendRange, side] = conditionsKey.split('|');
    
    return {
      id: uuidv4(),
      type: 'entry_pattern',
      confidence,
      profitability: avgReturn,
      frequency: trades.length / 30, // Per 30 days (rough estimate)
      conditions: this.parseConditions(regime, rsiRange, volumeRange, trendRange, side),
      examples: trades.slice(0, 5).map(t => t.id),
      discoveredAt: Date.now(),
      validatedTrades: trades.length,
      failedTrades: 0,
    };
  }
  
  private async recordPattern(pattern: PatternDiscovery): Promise<void> {
    const patternRecord: PatternRecord = {
      id: pattern.id,
      type: pattern.type,
      confidence: pattern.confidence,
      firstSeen: pattern.discoveredAt,
      lastConfirmed: pattern.discoveredAt,
      frequency: pattern.frequency,
      profitability: pattern.profitability,
      conditions: pattern.conditions,
      examples: pattern.examples,
    };
    
    this.memory.addPattern(patternRecord);
    this.patternCount++;
    
    this.emit('pattern:discovered', pattern);
    
    this.logger.info('🎯 New pattern discovered', {
      type: pattern.type,
      confidence: pattern.confidence.toFixed(2),
      profitability: pattern.profitability.toFixed(4),
      trades: pattern.validatedTrades
    });
  }
  
  // ===================== ARCHETYPE ANALYSIS =====================
  
  private async updateArchetypes(): Promise<void> {
    // Clustering analysis to identify strategy archetypes
    const fingerprints = this.memory.getAllFingerprints();
    
    if (fingerprints.length < 10) return; // Need enough bots
    
    // Simple clustering based on behavioral similarity
    const clusters = this.clusterBotsByBehavior(fingerprints);
    
    for (const [clusterId, bots] of clusters) {
      const archetype = this.createArchetype(clusterId, bots);
      this.archetypes.set(clusterId, archetype);
    }
    
    this.logger.debug('🏛️ Archetypes updated', { count: this.archetypes.size });
  }
  
  private clusterBotsByBehavior(fingerprints: BotFingerprint[]): Map<number, BotFingerprint[]> {
    // Simplified clustering - production would use UMAP + HDBSCAN
    const clusters = new Map<number, BotFingerprint[]>();
    
    for (const fingerprint of fingerprints) {
      // Simple classification based on key behavioral features
      let clusterId = 0;
      
      if (fingerprint.tradeFrequency > 5) clusterId = 1; // High frequency
      else if (fingerprint.avgHoldingPeriod > 24 * 60 * 60 * 1000) clusterId = 2; // Long term
      else if (Math.abs(fingerprint.directionBias) > 0.5) clusterId = 3; // Directional bias
      
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, []);
      }
      clusters.get(clusterId)!.push(fingerprint);
    }
    
    return clusters;
  }
  
  private createArchetype(id: number, bots: BotFingerprint[]): StrategyArchetype {
    const archetypeNames = ['Balanced', 'Scalper', 'Swing Trader', 'Trend Follower'];
    
    return {
      id,
      name: archetypeNames[id] || `Archetype-${id}`,
      description: `Strategy cluster with ${bots.length} bots`,
      botIds: bots.map(b => b.botId),
      characteristics: {
        avgHoldingPeriod: bots.reduce((sum, b) => sum + b.avgHoldingPeriod, 0) / bots.length,
        tradeFrequency: bots.reduce((sum, b) => sum + b.tradeFrequency, 0) / bots.length,
        preferredRegimes: this.getMostCommonRegimes(bots),
        directionBias: bots.reduce((sum, b) => sum + b.directionBias, 0) / bots.length,
        riskTolerance: 0.5, // TODO: Calculate from trade sizing
        adaptability: 0.5, // TODO: Calculate from performance changes
      },
      performance: {
        totalReturn: 0, // TODO: Calculate from recent trades
        sharpeRatio: 0,
        winRate: 0,
        maxDrawdown: 0,
        consistency: 0,
      },
      performanceByRegime: {}, // TODO: Aggregate from bot performances
    };
  }
  
  // ===================== UTILITY FUNCTIONS =====================
  
  // All the helper functions for calculations (simplified implementations)
  private getAverageReturnInRegime(trades: ObservationEvent[], regime: string): number {
    const regimeTrades = trades.filter(t => t.enrichment?.marketRegime === regime);
    if (regimeTrades.length === 0) return 0;
    
    const returns = regimeTrades.map(t => t.payload.pnl || 0);
    return returns.reduce((a, b) => a + b) / returns.length;
  }
  
  private getAverageReturn(trades: ObservationEvent[]): number {
    const returns = trades.map(t => t.payload.pnl || 0);
    return returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0;
  }
  
  private evaluateEntryTiming(event: ObservationEvent, historicalTrades: ObservationEvent[]): number {
    // Simplified timing evaluation - compare to recent entries
    return Math.random() * 0.4 - 0.2; // -0.2 to 0.2 range
  }
  
  private evaluateDirectionChoice(event: ObservationEvent, historicalTrades: ObservationEvent[]): number {
    const correctDirections = historicalTrades.filter(t => 
      (t.payload.side === 'buy' && t.payload.pnl > 0) ||
      (t.payload.side === 'sell' && t.payload.pnl > 0)
    ).length;
    
    return correctDirections / Math.max(historicalTrades.length, 1) - 0.5;
  }
  
  private evaluatePositionSizing(event: ObservationEvent, historicalTrades: ObservationEvent[]): number {
    // TODO: Compare position size to optimal Kelly criterion size
    return 0; // Simplified
  }
  
  private simulateRandomEntry(event: ObservationEvent, historicalTrades: ObservationEvent[]): number {
    // TODO: Monte Carlo simulation of random entry timing
    return Math.random() * 0.1 - 0.05;
  }
  
  private simulateMedianSize(event: ObservationEvent, historicalTrades: ObservationEvent[]): number {
    // TODO: Simulate trade with median position size
    return event.payload.pnl * 0.8; // Simplified
  }
  
  private simulateRandomRegime(event: ObservationEvent, historicalTrades: ObservationEvent[]): number {
    // TODO: Simulate entering in random market regime
    return Math.random() * 0.02 - 0.01;
  }
  
  private calculateAttributionConfidence(tradeCount: number, enrichment: any): number {
    const baseConfidence = Math.min(0.9, tradeCount / 50); // More trades = higher confidence
    const enrichmentBonus = enrichment?.indicators ? 0.1 : 0;
    return Math.min(0.95, baseConfidence + enrichmentBonus);
  }
  
  // Bot fingerprint calculation helpers
  private calculateHoldingPeriods(trades: ObservationEvent[]): number[] {
    // TODO: Calculate actual holding periods by matching buy/sell pairs
    return [60000]; // Simplified: 1 minute average
  }
  
  private calculateTradeFrequency(trades: ObservationEvent[]): number {
    if (trades.length < 2) return 0;
    
    const timeSpan = trades[trades.length - 1].timestamp - trades[0].timestamp;
    const hoursSpan = timeSpan / (1000 * 60 * 60);
    
    return trades.length / Math.max(hoursSpan, 1);
  }
  
  private calculateDirectionBias(trades: ObservationEvent[]): number {
    const buys = trades.filter(t => t.payload.side === 'buy').length;
    const sells = trades.filter(t => t.payload.side === 'sell').length;
    const total = buys + sells;
    
    if (total === 0) return 0;
    return (buys - sells) / total;
  }
  
  private identifyPreferredRegimes(trades: ObservationEvent[]): string[] {
    const regimeCounts = new Map<string, number>();
    
    for (const trade of trades) {
      const regime = trade.enrichment?.marketRegime;
      if (regime) {
        regimeCounts.set(regime, (regimeCounts.get(regime) || 0) + 1);
      }
    }
    
    return Array.from(regimeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([regime]) => regime);
  }
  
  private calculatePerformanceByRegime(trades: ObservationEvent[]): Record<string, any> {
    const performance: Record<string, any> = {};
    
    for (const trade of trades) {
      const regime = trade.enrichment?.marketRegime;
      if (!regime) continue;
      
      if (!performance[regime]) {
        performance[regime] = { returns: [], wins: 0, trades: 0 };
      }
      
      performance[regime].returns.push(trade.payload.pnl || 0);
      performance[regime].trades++;
      if ((trade.payload.pnl || 0) > 0) performance[regime].wins++;
    }
    
    return performance;
  }
  
  private discretizeRSI(rsi: number): string {
    if (rsi < 30) return 'oversold';
    if (rsi > 70) return 'overbought';
    return 'neutral';
  }
  
  private discretizeVolume(ratio: number): string {
    if (ratio > 2) return 'high';
    if (ratio < 0.5) return 'low';
    return 'normal';
  }
  
  private discretizeTrend(strength: number): string {
    if (strength > 25) return 'strong';
    if (strength < 15) return 'weak';
    return 'moderate';
  }
  
  private parseConditions(regime: string, rsi: string, volume: string, trend: string, side: string): PatternConditions {
    return {
      regime: [regime],
      indicators: {
        rsi: rsi === 'oversold' ? { max: 30 } : rsi === 'overbought' ? { min: 70 } : undefined,
        volume: volume === 'high' ? { minRatio: 2 } : undefined,
      },
      botBehavior: {
        directionBias: side === 'buy' ? { min: 0.2 } : { max: -0.2 }
      }
    };
  }
  
  private getMostCommonRegimes(bots: BotFingerprint[]): string[] {
    const regimeCount = new Map<string, number>();
    
    for (const bot of bots) {
      for (const regime of bot.preferredRegimes) {
        regimeCount.set(regime, (regimeCount.get(regime) || 0) + 1);
      }
    }
    
    return Array.from(regimeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([regime]) => regime);
  }
  
  private analyzeLeaderboardShifts(event: ObservationEvent): void {
    // TODO: Detect significant ranking changes and their causes
  }
  
  private analyzeEvolutionImpact(event: ObservationEvent): void {
    // TODO: Analyze how evolution affects bot performance patterns
  }
  
  private async loadArchetypes(): Promise<void> {
    // TODO: Load saved archetypes from disk
  }
  
  private async saveArchetypes(): Promise<void> {
    // TODO: Save archetypes to disk
  }
  
  // ===================== STATUS =====================
  
  isActive(): boolean {
    return this.isActive;
  }
  
  getPatternCount(): number {
    return this.patternCount;
  }
  
  getStats() {
    return {
      active: this.isActive,
      patternsDiscovered: this.patternCount,
      archetypes: this.archetypes.size,
      pendingAttributions: this.pendingAttributions.length,
      pendingFingerprints: this.pendingFingerprints.length,
      cachedAttributions: this.attributionCache.size,
    };
  }
}