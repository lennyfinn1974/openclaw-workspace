// Arena Types - 21-Bot Wargames Arena
// 3 Groups x 7 Bots competing in real-time trading tournaments

export type BotGroupName = 'Alpha' | 'Beta' | 'Gamma';
export type TournamentStatus = 'pending' | 'running' | 'paused' | 'completed';
export type RoundStatus = 'pending' | 'running' | 'completed';

// ===================== STRATEGY DNA =====================

export interface EntrySignalWeights {
  rsiOversold: number;       // 0-1: weight for RSI oversold buy signal
  rsiOverbought: number;     // 0-1: weight for RSI overbought sell signal
  macdCrossover: number;     // 0-1: weight for MACD bullish crossover
  macdDivergence: number;    // 0-1: weight for MACD divergence
  maCrossover: number;       // 0-1: weight for MA crossover signal
  ictOrderBlockBounce: number; // 0-1: weight for ICT order block bounce
  ictFvgFill: number;        // 0-1: weight for ICT fair value gap fill
  breakOfStructure: number;  // 0-1: weight for break of structure
  changeOfCharacter: number; // 0-1: weight for change of character
  liquiditySweep: number;    // 0-1: weight for liquidity sweep signal
  volumeSpike: number;       // 0-1: weight for volume spike
  meanReversion: number;     // 0-1: weight for mean reversion
  momentumBreakout: number;  // 0-1: weight for momentum breakout
}

export interface IndicatorParams {
  rsiPeriod: number;         // 5-30
  rsiOversoldThreshold: number; // 15-40
  rsiOverboughtThreshold: number; // 60-85
  macdFast: number;          // 5-20
  macdSlow: number;          // 15-40
  macdSignal: number;        // 5-15
  maFastPeriod: number;      // 5-30
  maSlowPeriod: number;      // 20-100
  maType: number;            // 0=SMA, 1=EMA (rounded)
  obLookback: number;        // 20-80
  fvgLookback: number;       // 20-80
  volumeSpikeMultiplier: number; // 1.2-3.0
  bollingerPeriod: number;   // 10-30
  bollingerStdDev: number;   // 1.0-3.0
}

export interface PositionSizingParams {
  riskPerTrade: number;      // 0.005-0.05 (0.5%-5%)
  maxPositionPercent: number; // 0.1-0.5 (10%-50%)
  maxOpenPositions: number;  // 1-5
  kellyFraction: number;     // 0.1-0.5
  pyramidEnabled: number;    // 0-1 (boolean as float)
  pyramidMaxAdds: number;    // 1-3
}

export interface ExitStrategyParams {
  stopLossAtr: number;       // 0.5-3.0 (ATR multiplier)
  takeProfitAtr: number;     // 1.0-5.0 (ATR multiplier)
  trailingStopEnabled: number; // 0-1 (boolean as float)
  trailingStopAtr: number;   // 0.5-2.0
  timeStopBars: number;      // 5-50
  partialExitEnabled: number; // 0-1
  partialExitPercent: number; // 0.25-0.75
  partialExitAtr: number;    // 0.5-3.0
}

export interface RegimeFilterParams {
  trendFollowBias: number;   // -1 to 1 (-1=counter-trend, 0=neutral, 1=trend-follow)
  volatilityPreference: number; // 0-1 (0=low vol, 1=high vol)
  sessionPreference: number; // 0-1 (0=all sessions, 1=kill zones only)
  correlationAwareness: number; // 0-1
}

export interface TimingParams {
  preferredTimeframe: number; // 0=1m, 1=5m, 2=15m, 3=1h (rounded)
  decisionIntervalMs: number; // 5000-60000
  entryPatience: number;     // 0-1 (0=aggressive, 1=patient)
}

export interface StrategyDNA {
  entrySignals: EntrySignalWeights;
  indicatorParams: IndicatorParams;
  positionSizing: PositionSizingParams;
  exitStrategy: ExitStrategyParams;
  regimeFilter: RegimeFilterParams;
  timing: TimingParams;
}

// ===================== BOT =====================

export interface Bot {
  id: string;
  name: string;
  groupName: BotGroupName;
  symbol: string;
  dna: StrategyDNA;
  generation: number;
  parentIds: string[];        // parent bot IDs (empty for gen 0)
  createdAt: string;
}

export interface BotPortfolio {
  botId: string;
  tournamentId: string;
  cash: number;
  initialBalance: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
}

export interface BotPosition {
  botId: string;
  tournamentId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
}

export interface BotOrder {
  id: string;
  botId: string;
  tournamentId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  reason: string;            // why bot placed this order
  createdAt: string;
  filledAt?: string;
}

export interface BotTrade {
  id: string;
  botId: string;
  tournamentId: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  pnl: number;
  reason: string;
  timestamp: string;
}

// ===================== BOT GROUP =====================

export interface BotGroup {
  name: BotGroupName;
  assetClass: string;
  symbols: string[];
  bots: Bot[];
}

export const BOT_GROUPS: Record<BotGroupName, { assetClass: string; symbols: string[] }> = {
  Alpha: {
    assetClass: 'FX',
    symbols: ['GBP/JPY', 'USD/TRY', 'USD/ZAR', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'],
  },
  Beta: {
    assetClass: 'Stocks',
    symbols: ['NVDA', 'TSLA', 'AMD', 'COIN', 'ROKU', 'PLTR', 'MSTR'],
  },
  Gamma: {
    assetClass: 'Commodities',
    symbols: ['CL=F', 'NG=F', 'BTC', 'SI=F', 'HG=F', 'GC=F', 'LAC'],
  },
};

// Bot name generators per group
export const BOT_NAMES: Record<BotGroupName, string[]> = {
  Alpha: ['Forex Fox', 'Pip Predator', 'Carry Hawk', 'Spread Eagle', 'Cable Crusher', 'Yen Yogi', 'Aussie Ace'],
  Beta: ['Chip Chaser', 'Meme Machine', 'Silicon Shark', 'Coin Cobra', 'Stream Sniper', 'Data Dragon', 'Sat Stacker'],
  Gamma: ['Oil Baron', 'Gas Guzzler', 'Crypto King', 'Silver Surfer', 'Copper Coyote', 'Gold Golem', 'Lithium Lion'],
};

// ===================== TOURNAMENT =====================

export interface Tournament {
  id: string;
  name: string;
  generation: number;
  status: TournamentStatus;
  currentRound: number;
  totalRounds: number;
  roundDurationMs: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface TournamentRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
  status: RoundStatus;
  startedAt?: string;
  completedAt?: string;
}

// ===================== LEADERBOARD =====================

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

export interface LeaderboardSnapshot {
  id: string;
  tournamentId: string;
  roundNumber: number;
  entries: LeaderboardEntry[];
  timestamp: string;
}

// ===================== EVOLUTION =====================

export interface EvolutionResult {
  generation: number;
  groupName: BotGroupName;
  elites: string[];           // bot IDs that survived
  offspring: string[];        // new bot IDs
  replaced: string[];         // bot IDs that were replaced
  avgFitnessBefore: number;
  avgFitnessAfter: number;
  timestamp: string;
}

export interface DNAHistoryEntry {
  botId: string;
  generation: number;
  dna: StrategyDNA;
  fitness: number;
  timestamp: string;
}

// ===================== MASTER BOT =====================

export interface MasterBot {
  id: string;
  dna: StrategyDNA;
  sourceBotIds: string[];
  sourceWeights: number[];
  generation: number;
  synthesizedAt: string;
}

// ===================== FITNESS =====================

export interface FitnessScores {
  totalPnLPercent: number;    // 30% weight
  sharpeRatio: number;        // 25% weight
  winRate: number;            // 15% weight
  maxDrawdownPenalty: number; // 15% weight
  tradeFrequency: number;    // 10% weight
  consistency: number;        // 5% weight
  composite: number;          // weighted total
}

// ===================== ARENA STATUS =====================

export interface ArenaStatus {
  isRunning: boolean;
  generation: number;
  tournament: Tournament | null;
  totalBots: number;
  totalTrades: number;
  topBot: LeaderboardEntry | null;
  groups: {
    name: BotGroupName;
    assetClass: string;
    botCount: number;
    avgPnL: number;
  }[];
}

// ===================== WEBSOCKET EVENTS =====================

export interface ArenaBotTradeEvent {
  botId: string;
  botName: string;
  groupName: BotGroupName;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  reason: string;
  pnl: number;
  timestamp: string;
}

export interface ArenaLeaderboardEvent {
  tournamentId: string;
  roundNumber: number;
  entries: LeaderboardEntry[];
}

export interface ArenaEvolutionEvent {
  type: 'start' | 'complete';
  generation: number;
  results?: EvolutionResult[];
}

export interface ArenaTournamentEvent {
  type: 'start' | 'round_start' | 'round_end' | 'pause' | 'resume' | 'complete';
  tournamentId: string;
  round?: number;
  totalRounds?: number;
}

// ===================== BOT PERSONALITY =====================

export type PersonalityArchetype =
  | 'TrendSurfer'      // High trend-follow bias, momentum breakout, MA crossover
  | 'MeanReverter'     // High mean reversion, RSI oversold/overbought, Bollinger
  | 'Scalper'          // Fast timeframe, short decision interval, tight stops
  | 'SwingTrader'      // Slow timeframe, patient entry, wide stops, high take-profit
  | 'Contrarian'       // Negative trend-follow bias, change of character, counter-trend
  | 'MomentumChaser'   // High momentum breakout, volume spike, aggressive entry
  | 'ValueHunter'      // ICT order blocks, FVG fill, liquidity sweep, patient
  | 'Sentinel';        // High risk aversion, small positions, trailing stops, consistency

export interface PersonalityTraits {
  aggression: number;      // 0-1: position sizing, entry patience (inverse)
  patience: number;        // 0-1: entry patience, decision interval, timeframe
  riskTolerance: number;   // 0-1: risk per trade, max position, stop distance
  adaptability: number;    // 0-1: regime filters, correlation awareness
  conviction: number;      // 0-1: take-profit width, pyramid enabled
  technicalDepth: number;  // 0-1: how many signal types are strongly weighted
}

export interface BotPersonality {
  archetype: PersonalityArchetype;
  traits: PersonalityTraits;
  dominantSignals: string[];  // top 3 strongest entry signal genes
  description: string;        // auto-generated personality description
}

// ===================== ADVANCED EVOLUTION =====================

export type CrossoverMethod = 'uniform' | 'multipoint' | 'blx_alpha' | 'sbx';
export type SelectionMethod = 'tournament' | 'roulette' | 'rank' | 'sus';
export type MutationMethod = 'gaussian' | 'polynomial' | 'cauchy' | 'adaptive';

export interface AdvancedEvolutionConfig {
  eliteCount: number;
  mutationRate: number;
  mutationStrength: number;
  crossoverMethod: CrossoverMethod;
  selectionMethod: SelectionMethod;
  mutationMethod: MutationMethod;
  // Adaptive parameters
  adaptiveMutationDecay: number;  // mutation rate decays by this factor each gen
  minMutationRate: number;
  // Diversity
  diversityWeight: number;        // 0-1: how much diversity affects selection
  immigrationRate: number;        // fraction of population replaced by random each gen
  nicheRadius: number;            // distance threshold for fitness sharing
  // Multi-objective
  useMultiObjective: boolean;     // NSGA-II style
  // SBX specific
  sbxEta: number;                 // distribution index for SBX (2-20)
  // BLX-alpha specific
  blxAlpha: number;               // exploration range (0.0-0.5)
}

export interface SpeciesCluster {
  id: string;
  centroid: number[];         // mean DNA array of species members
  memberBotIds: string[];
  avgFitness: number;
  generation: number;
  diversity: number;          // intra-species diversity
}

export interface PopulationDiversityMetrics {
  generation: number;
  genotypicDiversity: number;     // mean pairwise genotype distance
  phenotypicDiversity: number;    // mean pairwise fitness-component distance
  speciesCount: number;
  avgSpeciesSize: number;
  geneConvergence: GeneConvergence[];  // per-gene convergence
  timestamp: string;
}

export interface GeneConvergence {
  geneName: string;
  category: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  convergenceRatio: number;   // 1 - (stdDev / range), higher = more converged
}

// ===================== MULTI-OBJECTIVE =====================

export interface ParetoFront {
  generation: number;
  members: ParetoMember[];
  hypervolume: number;        // quality metric of the front
}

export interface ParetoMember {
  botId: string;
  objectives: {
    returnScore: number;      // maximize
    riskScore: number;        // minimize (inverted for maximization)
    consistencyScore: number; // maximize
  };
  crowdingDistance: number;
  rank: number;               // Pareto rank (1 = non-dominated)
}

// ===================== HALL OF FAME =====================

export interface HallOfFameEntry {
  id: string;
  botId: string;
  botName: string;
  groupName: BotGroupName;
  symbol: string;
  dna: StrategyDNA;
  personality: BotPersonality;
  fitness: number;
  generation: number;
  tournamentId: string;
  metrics: {
    totalPnLPercent: number;
    sharpeRatio: number;
    winRate: number;
    maxDrawdown: number;
    totalTrades: number;
  };
  inductedAt: string;
}

// ===================== GENERATION ANALYTICS =====================

export interface GenerationAnalytics {
  generation: number;
  groupName: BotGroupName;
  avgFitness: number;
  bestFitness: number;
  worstFitness: number;
  fitnessStdDev: number;
  diversity: PopulationDiversityMetrics;
  speciesClusters: SpeciesCluster[];
  paretoFront: ParetoFront;
  topGenes: { gene: string; importance: number }[];  // ranked by contribution
  crossoverMethod: CrossoverMethod;
  selectionMethod: SelectionMethod;
  mutationMethod: MutationMethod;
  effectiveMutationRate: number;
  timestamp: string;
}

// ===================== EVOLUTION EVENTS (EXTENDED) =====================

export interface ArenaEvolutionDetailEvent extends ArenaEvolutionEvent {
  analytics?: GenerationAnalytics[];
  hallOfFameInductions?: HallOfFameEntry[];
  diversityMetrics?: PopulationDiversityMetrics;
}
