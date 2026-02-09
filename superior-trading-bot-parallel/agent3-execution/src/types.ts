/**
 * Shared Types for Layers 5-7
 * Compatible with the Layer 1-4 core types from superior-trading-bot
 */

// ===================== MARKET & EVENT TYPES =====================

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'BREAKOUT' | 'EVENT' | 'QUIET';
export type TradeDirection = 'buy' | 'sell';
export type EventSource = 'arena_bot' | 'market' | 'regime' | 'self' | 'allocator' | 'risk_governor';
export type EventType = 'trade' | 'position_update' | 'fitness_change' | 'dna_mutation' |
  'allocation_update' | 'risk_veto' | 'circuit_breaker' | 'kelly_update' | 'pattern_discovered';

export interface IndicatorSnapshot {
  rsi14: number;
  macdHist: number;
  bbPosition: number;
  atr14: number;
  volumeRatio: number;
  trendStrength: number;
  priceVsMA50: number;
  priceVsMA200: number;
}

export interface TradeOutcome {
  pnl: number;
  pnlPercentage: number;
  holdingPeriodMinutes: number;
  maxAdverseExcursion: number;
  maxFavorableExcursion: number;
  isWinner: boolean;
}

export interface ObservationEvent {
  id: string;
  timestamp: number;
  source: EventSource;
  eventType: EventType;
  payload: any;
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

// ===================== LAYER 5: CAPITAL ALLOCATOR TYPES =====================

export interface StrategyArm {
  id: string;
  name: string;
  // Beta distribution parameters (Thompson Sampling)
  alpha: number;  // successes + 1
  beta: number;   // failures + 1
  // Performance tracking
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnL: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  // Kelly criterion
  kellyFraction: number;
  winRate: number;
  avgWinSize: number;
  avgLossSize: number;
  // Allocation
  currentAllocation: number;  // 0-1
  targetAllocation: number;
  // Regime performance
  performanceByRegime: Record<MarketRegime, RegimePerformance>;
}

export interface RegimePerformance {
  trades: number;
  winRate: number;
  avgReturn: number;
  sharpeRatio: number;
}

export interface AllocationDecision {
  timestamp: number;
  allocations: Map<string, number>;
  totalCapital: number;
  method: 'thompson_sampling' | 'kelly' | 'correlation_optimized';
  confidence: number;
  regime: MarketRegime;
}

export interface CorrelationMatrix {
  strategyIds: string[];
  matrix: number[][];  // NxN correlation matrix
  lastUpdated: number;
  sampleSize: number;
}

// ===================== LAYER 6: RISK GOVERNOR TYPES =====================

export type CircuitBreakerLevel = 'position' | 'strategy' | 'portfolio';
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreaker {
  id: string;
  level: CircuitBreakerLevel;
  targetId: string;  // position/strategy/portfolio ID
  state: CircuitBreakerState;
  tripThreshold: number;
  resetThreshold: number;
  currentValue: number;
  tripCount: number;
  lastTripped: number | null;
  cooldownMs: number;
  description: string;
}

export interface RiskVeto {
  id: string;
  timestamp: number;
  reason: string;
  severity: 'warning' | 'block' | 'emergency';
  proposedAction: string;
  vetoedBy: string;  // Which circuit breaker
  details: Record<string, any>;
}

export interface RiskState {
  dailyPnL: number;
  dailyPnLPercent: number;
  weeklyPnL: number;
  weeklyPnLPercent: number;
  openPositions: number;
  maxOpenPositions: number;
  totalExposure: number;
  maxExposure: number;
  correlationRisk: number;
  activeCircuitBreakers: CircuitBreaker[];
  recentVetoes: RiskVeto[];
  drawdownFromPeak: number;
  peakEquity: number;
  currentEquity: number;
}

export interface RiskLimits {
  maxDailyDrawdown: number;      // 0.05 = 5%
  maxWeeklyDrawdown: number;     // 0.10 = 10%
  maxSingleTradeRisk: number;    // 0.02 = 2%
  maxOpenPositions: number;
  maxCorrelationExposure: number;
  maxSectorExposure: number;
  emergencyShutdownThreshold: number;  // 0.08 = 8%
}

// ===================== LAYER 7: DASHBOARD TYPES =====================

export interface LayerStatus {
  id: number;
  name: string;
  status: 'online' | 'offline' | 'degraded' | 'not_implemented';
  health: number;  // 0-100
  eventsProcessed: number;
  lastEvent: number | null;
  details: Record<string, any>;
}

export interface DashboardState {
  layers: LayerStatus[];
  capitalAllocator: {
    arms: StrategyArm[];
    totalCapital: number;
    lastAllocation: AllocationDecision | null;
    correlationMatrix: CorrelationMatrix | null;
  };
  riskGovernor: RiskState;
  eventStream: ObservationEvent[];
  patterns: PatternSummary[];
  botIntelligence: BotSummary[];
  uptime: number;
  startTime: number;
}

export interface PatternSummary {
  id: string;
  type: string;
  confidence: number;
  frequency: number;
  profitability: number;
  lastSeen: number;
  description: string;
}

export interface BotSummary {
  botId: string;
  fitness: number;
  rank: number;
  trades: number;
  winRate: number;
  pnl: number;
  strategy: string;
  regime: MarketRegime;
}
