// Core observation types for Superior Trading Bot Layer 1

export interface ObservationEvent {
  timestamp: number;
  source: 'arena_bot' | 'market' | 'regime' | 'self';
  botId?: string;
  eventType: 'trade' | 'position_update' | 'fitness_change' | 'dna_mutation';
  payload: TradeEvent | PositionSnapshot | FitnessUpdate | DNAChange;
}

export interface TradeEvent {
  botId: string;
  symbol: string;
  direction: 'buy' | 'sell';
  quantity: number;
  price: number;
  regime: MarketRegime;
  preTradeIndicators: IndicatorSnapshot;
  outcome?: TradeOutcome; // filled retroactively
}

export interface IndicatorSnapshot {
  rsi14: number;
  macdHist: number;
  bbPosition: number; // 0=lower band, 1=upper band
  atr14: number;
  volumeRatio: number; // vs 20-period avg
  trendStrength: number; // ADX
  priceVsMA50: number; // % deviation
  priceVsMA200: number;
}

export interface TradeOutcome {
  realizedPnL: number;
  duration: number; // milliseconds
  maxAdverseExcursion: number;
  maxFavorableExcursion: number;
  exitReason: 'stop' | 'target' | 'timeout' | 'signal_exit';
}

export interface PositionSnapshot {
  botId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  duration: number;
}

export interface FitnessUpdate {
  botId: string;
  newFitness: number;
  previousFitness: number;
  performanceWindow: string; // '1h', '24h', 'session'
}

export interface DNAChange {
  botId: string;
  geneIndex: number;
  oldValue: number;
  newValue: number;
  mutationType: 'random' | 'crossover' | 'selection_pressure';
}

export type MarketRegime = 
  | 'TRENDING_UP' 
  | 'TRENDING_DOWN' 
  | 'RANGING' 
  | 'VOLATILE' 
  | 'BREAKOUT_UP' 
  | 'BREAKOUT_DOWN' 
  | 'EVENT_DRIVEN' 
  | 'QUIET';

export interface AttributedOutcome {
  tradeId: string;
  totalReturn: number;
  
  // Decomposition (should sum to ~totalReturn)
  regimeContribution: number;
  timingContribution: number;
  directionContribution: number;
  sizingContribution: number;
  
  // Counterfactuals
  returnIfRandomEntry: number;
  returnIfMedianSize: number;
  returnIfOppositeDirection: number;
}

export interface RingBufferOptions {
  maxEvents: number;
  enableTimeQueries: boolean;
  compressionThreshold?: number;
}