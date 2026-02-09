// Phase 2: Intelligence & Learning System Types

// ── Market Regime (matches Phase 1) ──
export type MarketRegime =
  | 'TRENDING_UP' | 'TRENDING_DOWN'
  | 'RANGING' | 'VOLATILE'
  | 'BREAKOUT_UP' | 'BREAKOUT_DOWN'
  | 'EVENT_DRIVEN' | 'QUIET';

export const ALL_REGIMES: MarketRegime[] = [
  'TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE',
  'BREAKOUT_UP', 'BREAKOUT_DOWN', 'EVENT_DRIVEN', 'QUIET'
];

// ── Indicator Snapshot (matches Phase 1) ──
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

// ── Arena Trade (from REST/Socket.IO) ──
export interface ArenaTrade {
  id: string;
  botId: string;
  symbol: string;
  direction: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  regime: MarketRegime;
  confidence?: number;
  indicators?: IndicatorSnapshot;
  outcome?: TradeOutcome;
}

export interface TradeOutcome {
  pnl: number;
  pnlPercentage: number;
  holdingPeriodMinutes: number;
  maxAdverseExcursion: number;
  maxFavorableExcursion: number;
  isWinner: boolean;
}

// ── Arena Bot DNA ──
export interface BotDNA {
  botId: string;
  genes: number[];
  generation: number;
  parentIds?: string[];
  mutationType?: 'mutation' | 'crossover';
}

// ── Arena Leaderboard Entry ──
export interface LeaderboardEntry {
  botId: string;
  rank: number;
  fitness: number;
  pnl: number;
  winRate: number;
  sharpe: number;
  drawdown: number;
  tradeCount: number;
}

// ── Shapley Attribution ──
export interface ShapleyAttribution {
  tradeId: string;
  botId: string;
  totalReturn: number;
  regimeContribution: number;
  timingContribution: number;
  directionContribution: number;
  sizingContribution: number;
  returnIfRandomEntry: number;
  returnIfMedianSize: number;
  returnIfOppositeDirection: number;
  timestamp: number;
}

export interface BotAttributionSummary {
  botId: string;
  tradeCount: number;
  avgRegimeContribution: number;
  avgTimingContribution: number;
  avgDirectionContribution: number;
  avgSizingContribution: number;
  dominantFactor: 'regime' | 'timing' | 'direction' | 'sizing';
  lastUpdated: number;
}

// ── Behavioral Feature Vector (20D) ──
export interface BehavioralFeatures {
  botId: string;
  // Trade frequency & timing
  tradeFrequency: number;         // trades per hour
  avgHoldingPeriod: number;       // minutes
  holdingPeriodStdDev: number;
  // Direction
  directionBias: number;          // -1 (all sell) to +1 (all buy)
  directionSwitchRate: number;    // how often direction changes
  // Size
  avgPositionSize: number;
  positionSizeVariance: number;
  // Regime preferences
  trendingUpAffinity: number;     // % of trades in trending up
  trendingDownAffinity: number;
  rangingAffinity: number;
  volatileAffinity: number;
  // Indicator entry patterns
  avgEntryRSI: number;
  avgEntryBBPosition: number;
  avgEntryMACDHist: number;
  avgEntryTrendStrength: number;
  // Performance
  winRate: number;
  avgReturn: number;
  sharpeProxy: number;
  maxDrawdown: number;
  // Confidence usage
  avgConfidence: number;
}

// ── Pattern Clustering / Archetypes ──
export interface BotEmbedding {
  botId: string;
  coords5D: [number, number, number, number, number];
  archetypeId: number;
  archetypeDistance: number;
}

export interface Archetype {
  id: number;
  label: string;
  memberBotIds: string[];
  centroid5D: [number, number, number, number, number];
  dominantTraits: string[];
  avgPerformance: number;
}

export interface ClusteringResult {
  archetypes: Archetype[];
  embeddings: BotEmbedding[];
  noise: string[];           // bots that don't fit any cluster
  timestamp: number;
  silhouetteScore: number;
}

// ── Competitive Intelligence ──
export interface BotPrediction {
  botId: string;
  symbol: string;
  buyProb: number;
  sellProb: number;
  holdProb: number;
  predictedAction: 'buy' | 'sell' | 'hold';
  confidence: number;
  modelAccuracy: number;
  timestamp: number;
}

export interface CrowdingAlert {
  symbol: string;
  direction: 'buy' | 'sell';
  convergenceRatio: number;  // fraction of bots converging
  botIds: string[];
  pValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  windowMinutes: number;
  timestamp: number;
}

export interface NicheCell {
  archetypeId: number;
  regime: MarketRegime;
  classification: 'underexploited' | 'overcrowded' | 'unexplored' | 'balanced';
  botCount: number;
  avgPerformance: number;
  opportunityScore: number;
}

export interface NicheMap {
  cells: NicheCell[];
  timestamp: number;
}

// ── Strategy Fingerprint ──
export interface StrategyFingerprint {
  botId: string;
  avgHoldingPeriod: number;
  tradeFrequency: number;
  preferredRegimes: MarketRegime[];
  directionBias: number;
  performanceByRegime: Record<MarketRegime, RegimePerformance>;
  archetypeId?: number;
  tradeCount: number;
  lastUpdated: number;
}

export interface RegimePerformance {
  winRate: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  tradeCount: number;
}

// ── Regime Matrix ──
export interface RegimeMatrixCell {
  archetypeId: number;
  regime: MarketRegime;
  avgReturn: number;
  winRate: number;
  tradeCount: number;
  sharpe: number;
}

export interface RegimeMatrix {
  cells: RegimeMatrixCell[];
  archetypeCount: number;
  regimeCount: number;
  timestamp: number;
}

// ── Intelligence Status ──
export interface IntelligenceStatus {
  uptime: number;
  arenaConnected: boolean;
  pythonBridgeConnected: boolean;
  totalTradesProcessed: number;
  lastAttributionRun: number | null;
  lastClusteringRun: number | null;
  lastPredictionRun: number | null;
  activeCrowdingAlerts: number;
  archetypeCount: number;
  botCount: number;
}
