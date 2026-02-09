/**
 * Phase 3: Strategy Synthesis & Paper Trading — Complete Type System
 *
 * Extends Phase 1-2 types with paper trading, lifecycle management,
 * and enhanced synthesis types.
 */

// ===================== MARKET & INDICATOR TYPES =====================

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'BREAKOUT' | 'EVENT' | 'QUIET';
export type TradeDirection = 'buy' | 'sell';
export type EventSource = 'arena_bot' | 'market' | 'regime' | 'self';
export type EventType = 'trade' | 'position_update' | 'fitness_change' | 'dna_mutation';

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

export interface TradeEvent {
  botId: string;
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  price: number;
  timestamp: number;
  regime: MarketRegime;
  preTradeIndicators: IndicatorSnapshot;
  outcome?: { pnl: number; pnlPercentage: number; holdingPeriodMinutes: number; isWinner: boolean };
  confidence?: number;
}

export interface ObservationEvent {
  id: string;
  timestamp: number;
  source: EventSource;
  eventType: EventType;
  payload: TradeEvent | Record<string, unknown>;
  enrichmentMetadata?: {
    processingTime: number;
    indicators: IndicatorSnapshot;
    marketContext?: { spread: number; depth: number; volatilityState: string };
  };
}

export interface StrategyFingerprint {
  botId: string;
  avgHoldingPeriod: number;
  tradeFrequency: number;
  preferredRegimes: MarketRegime[];
  directionBias: number;
  sizingBehavior: 'fixed' | 'kelly' | 'volatility_scaled' | 'confidence_scaled';
  performanceByRegime: Map<MarketRegime, { winRate: number; avgReturn: number; sharpeRatio: number; maxDrawdown: number }>;
}

// ===================== EXPRESSION TREE TYPES =====================

export type NodeType = 'indicator' | 'operator' | 'comparator' | 'logical' | 'constant' | 'action';

export type IndicatorFunction =
  | 'RSI' | 'MACD_HIST' | 'BB_POSITION' | 'ATR'
  | 'VOLUME_RATIO' | 'TREND_STRENGTH' | 'PRICE_VS_MA50' | 'PRICE_VS_MA200'
  | 'EMA' | 'SMA' | 'STOCH_K' | 'STOCH_D' | 'WILLIAMS_R'
  | 'MOMENTUM' | 'ROC' | 'CCI' | 'MFI';

export type ArithmeticOperator = 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MAX' | 'MIN' | 'ABS' | 'NEG';
export type ComparatorOperator = 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'CROSS_ABOVE' | 'CROSS_BELOW';
export type LogicalOperator = 'AND' | 'OR' | 'NOT' | 'XOR';
export type ActionType = 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';

export interface StrategyNode {
  id: string;
  type: NodeType;
  value: string;
  params?: Record<string, number>;
  children?: StrategyNode[];
  depth?: number;
}

export interface TreeEvalResult {
  action: ActionType;
  confidence: number;
  signalStrength: number;
  nodesEvaluated: number;
}

// ===================== GENETIC PROGRAMMING TYPES =====================

export interface GPConfig {
  populationSize: number;
  maxGenerations: number;
  tournamentSize: number;
  elitismCount: number;
  crossoverRate: number;
  mutationRate: number;
  reproductionRate: number;
  maxTreeDepth: number;
  maxTreeNodes: number;
  parsimonyPressure: number;
  fitnessThreshold: number;
  stagnationLimit: number;
  diversityThreshold: number;
  islandCount: number;
  migrationInterval: number;
  migrationRate: number;
}

export interface GPIndividual {
  id: string;
  tree: StrategyNode;
  fitness: number;
  adjustedFitness: number;
  generation: number;
  parentIds: string[];
  nodeCount: number;
  depth: number;
  metrics: StrategyMetrics;
  createdBy: 'random' | 'crossover' | 'mutation' | 'adversarial' | 'nmf_inspired' | 'migration';
  createdAt: number;
  island: number;
}

export interface StrategyMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  avgHoldingPeriod: number;
  avgReturn: number;
  volatility: number;
  calmarRatio: number;
  sortinoRatio: number;
  returnByRegime: Record<string, number>;
  tradeCountByRegime: Record<string, number>;
  inSampleReturn: number;
  outOfSampleReturn: number;
  degradationRatio: number;
  complexityPenalty: number;
  effectiveFitness: number;
}

export interface GPPopulationStats {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  medianFitness: number;
  worstFitness: number;
  diversityIndex: number;
  avgNodeCount: number;
  avgDepth: number;
  speciesCount: number;
  stagnationCounter: number;
  islandStats?: { island: number; bestFitness: number; avgFitness: number; size: number }[];
}

// ===================== NMF TYPES =====================

export interface NMFConfig {
  numFactors: number;
  maxIterations: number;
  convergenceThreshold: number;
  regularization: number;
  initMethod: 'random' | 'nndsvd';
  temporalDecay: number;
}

export interface NMFResult {
  W: number[][];
  H: number[][];
  factors: LatentFactor[];
  reconstructionError: number;
  iterations: number;
  converged: boolean;
}

export interface LatentFactor {
  id: number;
  name: string;
  geneLoadings: number[];
  topGenes: { index: number; loading: number; name: string }[];
  botWeights: { botId: string; weight: number }[];
  correlationWithFitness: number;
  interpretation: string;
  trend: 'strengthening' | 'stable' | 'weakening';
}

export interface DNASnapshot {
  botId: string;
  genes: number[];
  fitness: number;
  timestamp: number;
  rank: number;
}

export interface FactorCombination {
  id: string;
  factorWeights: number[];
  synthesizedDNA: number[];
  noveltyScore: number;
  expectedFitness: number;
  source: 'amplification' | 'novel_combination' | 'gap_filling' | 'temporal_blend';
}

// ===================== ADVERSARIAL TYPES =====================

export interface AdversarialConfig {
  targetBotCount: number;
  lookbackPeriods: number;
  exploitThreshold: number;
  maxStrategiesPerTarget: number;
  sharedWeaknessBonus: number;
}

export interface BotWeakness {
  botId: string;
  weakness: string;
  regime: MarketRegime;
  conditions: WeaknessConditions;
  severity: number;
  frequency: number;
  expectedEdge: number;
  sampleSize: number;
  confidence: number;
}

export interface WeaknessConditions {
  regime?: MarketRegime;
  indicators?: {
    rsi?: { min?: number; max?: number };
    macd?: { direction?: 'positive' | 'negative'; threshold?: number };
    volume?: { minRatio?: number; maxRatio?: number };
    atr?: { min?: number; max?: number };
    trend?: { min?: number; max?: number };
  };
  volatilityState?: 'low' | 'normal' | 'high' | 'extreme';
  precedingAction?: TradeDirection;
}

export interface AdversarialStrategy {
  id: string;
  targetBotIds: string[];
  weaknessesExploited: BotWeakness[];
  entryConditions: StrategyNode;
  exitConditions: StrategyNode;
  expectedEdge: number;
  simulatedReturn: number;
  confidence: number;
  createdAt: number;
}

// ===================== PAPER TRADING TYPES =====================

export interface PaperTradingConfig {
  initialCapital: number;
  maxPositionPct: number;
  maxDailyDrawdown: number;
  slippageModel: SlippageModelConfig;
  latencyModel: LatencyModelConfig;
  commissionRate: number;
  marginRequirement: number;
}

export interface SlippageModelConfig {
  baseSlippageBps: number;
  volatilityMultiplier: number;
  sizeImpactFactor: number;
  spreadBps: number;
}

export interface LatencyModelConfig {
  baseLatencyMs: number;
  jitterMs: number;
  spikeProb: number;
  spikeMultiplier: number;
}

export interface VirtualOrder {
  id: string;
  strategyId: string;
  symbol: string;
  side: TradeDirection;
  quantity: number;
  requestedPrice: number;
  filledPrice: number;
  slippage: number;
  latencyMs: number;
  commission: number;
  timestamp: number;
  fillTimestamp: number;
}

export interface VirtualPosition {
  strategyId: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  entryTime: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  equity: number;
  cash: number;
  unrealizedPnl: number;
  realizedPnl: number;
  maxDrawdown: number;
  positions: VirtualPosition[];
  tradeCount: number;
}

export interface PaperTradingResult {
  strategyId: string;
  startTime: number;
  endTime: number;
  initialCapital: number;
  finalEquity: number;
  totalReturn: number;
  totalReturnPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  avgSlippage: number;
  avgLatency: number;
  totalCommissions: number;
  equityCurve: { timestamp: number; equity: number }[];
  trades: VirtualOrder[];
}

// ===================== STRATEGY LIFECYCLE TYPES =====================

export type LifecycleStage = 'BIRTH' | 'INCUBATION' | 'PAPER' | 'VALIDATION' | 'LIVE' | 'RETIREMENT';

export interface StrategyLifecycle {
  strategyId: string;
  stage: LifecycleStage;
  tree: StrategyNode;
  source: 'gp' | 'nmf' | 'adversarial' | 'hybrid';

  // Birth metadata
  createdAt: number;
  generation: number;
  parentIds: string[];

  // Performance tracking per stage
  incubationMetrics: StrategyMetrics | null;
  paperMetrics: PaperTradingResult | null;
  validationScore: number;

  // Lifecycle events
  promotionHistory: { from: LifecycleStage; to: LifecycleStage; at: number; reason: string }[];
  lastUpdated: number;

  // Allocation (0 until LIVE)
  currentAllocation: number;
  lifetimeReturn: number;

  // Decay tracking
  decayRate: number;
  healthScore: number;
}

export interface LifecycleConfig {
  incubationGenerations: number;
  paperTradingMinHours: number;
  paperTradingMinTrades: number;
  validationMinScore: number;
  maxActiveStrategies: number;
  retirementThreshold: number;
  decayHalfLifeHours: number;
  healthCheckIntervalMs: number;
}

export interface PromotionCriteria {
  stage: LifecycleStage;
  minFitness: number;
  minTrades: number;
  maxDrawdown: number;
  minWinRate: number;
  minSharpe: number;
  minDegradationRatio: number;
}

// ===================== PHASE 3 ORCHESTRATOR TYPES =====================

export interface Phase3Config {
  gp: GPConfig;
  nmf: NMFConfig;
  adversarial: AdversarialConfig;
  paperTrading: PaperTradingConfig;
  lifecycle: LifecycleConfig;
  arenaApiUrl: string;
  apiPort: number;
  synthesisIntervalMs: number;
}

export interface Phase3Status {
  active: boolean;
  uptime: number;
  generation: number;
  gpStats: GPPopulationStats | null;
  nmfFactors: number;
  adversarialStrategies: number;
  paperTradingActive: number;
  lifecycleCounts: Record<LifecycleStage, number>;
  totalStrategiesGenerated: number;
  totalStrategiesRetired: number;
  bestStrategyFitness: number;
}
