/**
 * Phase 4: Live Trading — Unified Type Definitions
 *
 * Extends Layer 5-7 types with execution engine types:
 * TradingMode, OrderLifecycleState, TradeProposal, ExecutionOrder,
 * FillReport, PerformanceSnapshot, LeaderboardComparison, StrategySignal, Phase4Config
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
  alpha: number;
  beta: number;
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnL: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  kellyFraction: number;
  winRate: number;
  avgWinSize: number;
  avgLossSize: number;
  currentAllocation: number;
  targetAllocation: number;
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
  matrix: number[][];
  lastUpdated: number;
  sampleSize: number;
}

// ===================== LAYER 6: RISK GOVERNOR TYPES =====================

export type CircuitBreakerLevel = 'position' | 'strategy' | 'portfolio';
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreaker {
  id: string;
  level: CircuitBreakerLevel;
  targetId: string;
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
  vetoedBy: string;
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
  maxDailyDrawdown: number;
  maxWeeklyDrawdown: number;
  maxSingleTradeRisk: number;
  maxOpenPositions: number;
  maxCorrelationExposure: number;
  maxSectorExposure: number;
  emergencyShutdownThreshold: number;
}

// ===================== LAYER 7: DASHBOARD TYPES =====================

export interface LayerStatus {
  id: number;
  name: string;
  status: 'online' | 'offline' | 'degraded' | 'not_implemented';
  health: number;
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

// ===================== PHASE 4: EXECUTION ENGINE TYPES =====================

export type TradingMode = 'paper' | 'live';

export type OrderLifecycleState =
  | 'sizing'
  | 'slippage_estimate'
  | 'risk_check'
  | 'executing'
  | 'filled'
  | 'rejected'
  | 'vetoed'
  | 'cancelled';

export interface StrategySignal {
  id: string;
  timestamp: number;
  strategyId: string;
  strategyName: string;
  symbol: string;
  direction: TradeDirection;
  strength: number;       // 0-1 signal confidence
  reason: string;
  regime: MarketRegime;
  metadata?: Record<string, any>;
}

export interface TradeProposal {
  id: string;
  timestamp: number;
  signal: StrategySignal;
  suggestedSize: number;   // shares
  estimatedPrice: number;
  estimatedValue: number;
  kellyFraction: number;
  allocationWeight: number;
}

export interface ExecutionOrder {
  id: string;
  timestamp: number;
  proposal: TradeProposal;
  lifecycleState: OrderLifecycleState;
  mode: TradingMode;
  // Sizing
  quantity: number;
  // Slippage
  estimatedFillPrice: number;
  estimatedSlippageBps: number;
  // Risk
  riskAmount: number;
  riskPercent: number;
  riskApproved: boolean;
  vetoReason?: string;
  // Fill
  fillPrice?: number;
  fillTimestamp?: number;
  actualSlippageBps?: number;
}

export interface FillReport {
  orderId: string;
  timestamp: number;
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  fillPrice: number;
  estimatedPrice: number;
  slippageBps: number;
  mode: TradingMode;
  strategyId: string;
  value: number;
  pnl?: number;
}

export interface Position {
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  strategyId: string;
  openedAt: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  equity: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  drawdownFromPeak: number;
  openPositions: number;
  mode: TradingMode;
  killSwitchActive: boolean;
}

export interface LeaderboardComparison {
  rank: number;
  totalEntries: number;
  botId: string;
  botName: string;
  totalPnL: number;
  totalPnLPercent: number;
  sharpeRatio: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  fitness: number;
  isOurBot: boolean;
}

export interface Phase4Config {
  mode: TradingMode;
  arenaUrl: string;
  dashboardPort: number;
  initialCapital: number;
  maxRiskPerTrade: number;
  maxDailyDrawdown: number;
  maxWeeklyDrawdown: number;
  emergencyDrawdown: number;
  maxOpenPositions: number;
  maxCorrelation: number;
  signalIntervalMs: number;
  rebalanceIntervalMs: number;
  riskCheckIntervalMs: number;
  equitySampleIntervalMs: number;
  killSwitchConsecutiveLosses: number;
  killSwitchDrawdownPercent: number;
}

export interface KillSwitchState {
  active: boolean;
  reason: string | null;
  triggeredAt: number | null;
  consecutiveLosses: number;
  drawdownPercent: number;
}
