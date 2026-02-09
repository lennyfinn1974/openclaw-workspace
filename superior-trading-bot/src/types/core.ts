/**
 * Core Types for Superior Trading Bot Layer 1 - Observation Engine
 * Based on 7-Layer Meta-Cognitive Trading System Architecture
 */

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'BREAKOUT' | 'EVENT' | 'QUIET';
export type TradeDirection = 'buy' | 'sell';
export type EventSource = 'arena_bot' | 'market' | 'regime' | 'self';
export type EventType = 'trade' | 'position_update' | 'fitness_change' | 'dna_mutation';

export interface IndicatorSnapshot {
  rsi14: number;           // RSI with 14-period
  macdHist: number;        // MACD Histogram
  bbPosition: number;      // Bollinger Bands position (0=lower, 1=upper)
  atr14: number;          // Average True Range 14-period
  volumeRatio: number;     // Volume vs 20-period average
  trendStrength: number;   // ADX trend strength
  priceVsMA50: number;    // % deviation from 50-period MA
  priceVsMA200: number;   // % deviation from 200-period MA
}

export interface TradeOutcome {
  pnl: number;                    // Profit/Loss in base currency
  pnlPercentage: number;          // P&L as percentage
  holdingPeriodMinutes: number;   // Duration of trade
  maxAdverseExcursion: number;    // Worst drawdown during trade
  maxFavorableExcursion: number;  // Best profit during trade
  isWinner: boolean;              // Final outcome
}

export interface TradeEvent {
  botId: string;
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  price: number;
  timestamp: number;
  regime: MarketRegime;
  preTradeIndicators: IndicatorSnapshot;
  outcome?: TradeOutcome;  // Filled retroactively
  confidence?: number;     // Bot's confidence level (if available)
}

export interface PositionSnapshot {
  botId: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  unrealizedPnL: number;
  timestamp: number;
}

export interface FitnessUpdate {
  botId: string;
  newFitness: number;
  oldFitness: number;
  rankChange: number;
  timestamp: number;
}

export interface DNAChange {
  botId: string;
  geneIndex: number;
  oldValue: number;
  newValue: number;
  mutationType: 'mutation' | 'crossover';
  timestamp: number;
}

export interface ObservationEvent {
  id: string;              // Unique event ID
  timestamp: number;       // Unix timestamp in milliseconds
  source: EventSource;
  eventType: EventType;
  payload: TradeEvent | PositionSnapshot | FitnessUpdate | DNAChange;
  enrichmentMetadata?: {
    processingTime: number;
    indicators: IndicatorSnapshot;
    marketContext?: {
      spread: number;
      depth: number;
      volatilityState: string;
    };
  };
}

export interface AttributedOutcome {
  tradeId: string;
  totalReturn: number;
  
  // Shapley Value Decomposition
  regimeContribution: number;     // What % came from regime
  timingContribution: number;     // Entry/exit timing quality
  directionContribution: number;  // Long vs short correctness
  sizingContribution: number;     // Position size optimality
  
  // Counterfactuals for attribution
  returnIfRandomEntry: number;    // Same direction, random timing
  returnIfMedianSize: number;     // Same trade, median position size
  returnIfOppositeDirection: number;
}

export interface StrategyFingerprint {
  botId: string;
  
  // Behavioral Signature (computed from trade history)
  avgHoldingPeriod: number;
  tradeFrequency: number;           // Trades per hour
  preferredRegimes: MarketRegime[];
  directionBias: number;            // -1 (always short) to +1 (always long)
  sizingBehavior: 'fixed' | 'kelly' | 'volatility_scaled' | 'confidence_scaled';
  
  // Performance by Regime
  performanceByRegime: Map<MarketRegime, {
    winRate: number;
    avgReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
  }>;
  
  // Clustering Assignment
  archetypeId?: number;           // Strategy cluster ID
  archetypeDistance?: number;     // Distance to cluster centroid
}

export interface RingBufferQuery {
  startTime?: number;
  endTime?: number;
  source?: EventSource;
  eventType?: EventType;
  botId?: string;
  symbol?: string;
  limit?: number;
}

export interface RingBufferStats {
  totalEvents: number;
  oldestEvent: number;    // Timestamp
  newestEvent: number;    // Timestamp
  eventsByType: Record<EventType, number>;
  eventsBySource: Record<EventSource, number>;
  bufferUtilization: number;  // Percentage full
}