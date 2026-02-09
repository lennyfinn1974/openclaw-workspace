// ============================================================
// Superior Trading Bot — Layer 1-2 Type Definitions
// OBSERVE ONLY — No trading actions
// ============================================================

// --- Arena Event Types (mirroring trading-platform) ---

export type BotGroupName = 'Alpha' | 'Beta' | 'Gamma';
export type TradeSide = 'buy' | 'sell';

export interface ArenaBotTradeEvent {
  botId: string;
  botName: string;
  groupName: BotGroupName;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  reason: string;
  pnl: number;
  timestamp: string;
}

export interface LeaderboardEntry {
  rank: number;
  botId: string;
  botName: string;
  groupName: BotGroupName;
  symbol: string;
  totalPnL: number;
  totalPnLPercent: number;
  sharpeRatio: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  fitness: number;
}

export interface ArenaLeaderboardEvent {
  tournamentId: string;
  roundNumber: number;
  entries: LeaderboardEntry[];
}

export interface ArenaTournamentEvent {
  type: 'start' | 'round_start' | 'round_end' | 'pause' | 'resume' | 'complete';
  tournamentId: string;
  round?: number;
  totalRounds?: number;
}

export interface ArenaEvolutionEvent {
  type: 'start' | 'complete';
  generation: number;
  results?: EvolutionResult[];
}

export interface EvolutionResult {
  generation: number;
  groupName: BotGroupName;
  elites: string[];
  offspring: string[];
  replaced: string[];
  avgFitnessBefore: number;
  avgFitnessAfter: number;
  timestamp: string;
}

// --- Observation Engine Types ---

export interface ObservedTrade extends ArenaBotTradeEvent {
  observedAt: number;       // unix ms when we received it
  sequenceNum: number;      // monotonic counter
  latencyMs: number;        // time since trade timestamp
}

export interface BotFingerprint {
  botId: string;
  botName: string;
  groupName: BotGroupName;
  symbol: string;

  // Trade statistics
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  avgTradeSize: number;
  avgTradeInterval: number; // ms between trades
  tradeIntervalStdDev: number;

  // P&L tracking
  totalPnL: number;
  winCount: number;
  lossCount: number;
  avgWin: number;
  avgLoss: number;
  winRate: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  // Behavioral traits
  aggressiveness: number;   // trade frequency relative to avg
  conviction: number;       // avg position size relative to max
  contrarian: number;       // % of trades against recent trend
  momentumBias: number;     // correlation of trade direction with price movement

  // Strategy signal distribution
  reasonDistribution: Map<string, number>;

  // Timing patterns
  avgHoldDurationMs: number;
  preferredSessionHours: number[];

  // Last updated
  lastTradeAt: number;
  firstTradeAt: number;
}

export interface EventBuffer<T> {
  capacity: number;
  items: T[];
  head: number;
  count: number;
}

// --- Pattern Extraction Types (Layer 2) ---

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface IndicatorState {
  symbol: string;
  timestamp: number;

  // RSI
  rsi14: number;
  rsiSlope: number;

  // MACD
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  macdCrossover: 'bullish' | 'bearish' | 'none';

  // Bollinger Bands
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbWidth: number;
  bbPercentB: number;

  // Simple moving averages
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;

  // Volatility
  atr14: number;
  volatilityRank: number;  // 0-1, relative to history
}

export interface EnrichedTrade extends ObservedTrade {
  indicators: IndicatorState;
  marketRegime: MarketRegime;
}

export type MarketRegime = 'trending_up' | 'trending_down' | 'ranging' | 'volatile' | 'quiet';

// --- Shapley Value Attribution ---

export interface ShapleyAttribution {
  botId: string;
  period: string;
  contributions: {
    signalQuality: number;    // how good are the entry signals
    timing: number;           // how well-timed are entries
    sizing: number;           // position sizing contribution
    exitQuality: number;      // how good are exits
    regimeAlignment: number;  // trading with/against regime
  };
  totalShapley: number;
  marginalContribution: number;  // added value vs random
  rank: number;
}

// --- Behavioral Clustering ---

export interface BotBehaviorVector {
  botId: string;
  features: number[];  // normalized feature vector for clustering
  featureNames: string[];
}

export interface BehaviorCluster {
  clusterId: number;
  label: string;
  memberBotIds: string[];
  centroid: number[];
  radius: number;
  dominantStrategy: string;
  avgFitness: number;
}

export interface ClusteringResult {
  clusters: BehaviorCluster[];
  noise: string[];           // unclustered bot IDs
  silhouetteScore: number;
  timestamp: number;
}

// --- Pattern Discovery ---

export interface TradePattern {
  patternId: string;
  name: string;
  description: string;
  frequency: number;          // occurrences per hour
  profitability: number;      // avg P&L when pattern occurs
  confidence: number;         // 0-1
  involvedBots: string[];
  triggerConditions: {
    regime: MarketRegime[];
    indicatorRanges: Partial<Record<keyof IndicatorState, [number, number]>>;
    timeOfDay?: [number, number];
  };
  discoveredAt: number;
  sampleCount: number;
}

export interface ObservationSnapshot {
  timestamp: number;
  activeBots: number;
  totalTradesObserved: number;
  tradesPerMinute: number;
  topPerformers: Array<{ botId: string; botName: string; pnl: number }>;
  bottomPerformers: Array<{ botId: string; botName: string; pnl: number }>;
  activePatterns: TradePattern[];
  clusteringSummary: ClusteringResult | null;
  indicatorSummary: Map<string, IndicatorState>;
}
