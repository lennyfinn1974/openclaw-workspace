// Phase 5: Autonomous Evolution & Anti-Fragility — Type Definitions
// Re-exports arena types and defines Phase 5 specific interfaces

// ===================== RE-EXPORTED ARENA TYPES =====================
// These mirror the trading-platform arena types to avoid direct import dependency

export type BotGroupName = 'Alpha' | 'Beta' | 'Gamma';
export type TournamentStatus = 'pending' | 'running' | 'paused' | 'completed';

export interface EntrySignalWeights {
  rsiOversold: number;
  rsiOverbought: number;
  macdCrossover: number;
  macdDivergence: number;
  maCrossover: number;
  ictOrderBlockBounce: number;
  ictFvgFill: number;
  breakOfStructure: number;
  changeOfCharacter: number;
  liquiditySweep: number;
  volumeSpike: number;
  meanReversion: number;
  momentumBreakout: number;
}

export interface IndicatorParams {
  rsiPeriod: number;
  rsiOversoldThreshold: number;
  rsiOverboughtThreshold: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  maFastPeriod: number;
  maSlowPeriod: number;
  maType: number;
  obLookback: number;
  fvgLookback: number;
  volumeSpikeMultiplier: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
}

export interface PositionSizingParams {
  riskPerTrade: number;
  maxPositionPercent: number;
  maxOpenPositions: number;
  kellyFraction: number;
  pyramidEnabled: number;
  pyramidMaxAdds: number;
}

export interface ExitStrategyParams {
  stopLossAtr: number;
  takeProfitAtr: number;
  trailingStopEnabled: number;
  trailingStopAtr: number;
  timeStopBars: number;
  partialExitEnabled: number;
  partialExitPercent: number;
  partialExitAtr: number;
}

export interface RegimeFilterParams {
  trendFollowBias: number;
  volatilityPreference: number;
  sessionPreference: number;
  correlationAwareness: number;
}

export interface TimingParams {
  preferredTimeframe: number;
  decisionIntervalMs: number;
  entryPatience: number;
}

export interface StrategyDNA {
  entrySignals: EntrySignalWeights;
  indicatorParams: IndicatorParams;
  positionSizing: PositionSizingParams;
  exitStrategy: ExitStrategyParams;
  regimeFilter: RegimeFilterParams;
  timing: TimingParams;
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

export interface ArenaStatus {
  isRunning: boolean;
  generation: number;
  tournament: {
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
  } | null;
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

// ===================== PHASE 5 TYPES =====================

export type LifecycleStage =
  | 'BIRTH'
  | 'PAPER_TRADING'
  | 'INCUBATION'
  | 'GROWTH'
  | 'MATURITY'
  | 'DECAY'
  | 'RETIRED';

export type StrategyCreator =
  | 'random'
  | 'adversarial'
  | 'crossover'
  | 'mutation'
  | 'nmf'
  | 'resurrection';

export interface BehavioralVector {
  avgHoldingPeriod: number;       // normalized 0-1
  tradeFrequency: number;         // normalized 0-1
  directionBias: number;          // -1 (short) to 1 (long)
  regimePreference: number[];     // 6 values for 6 regimes
  entryPatternCluster: number;    // normalized 0-1
  volatilityAffinity: number;     // normalized 0-1
}

export interface StrategyPerformance {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  peakWinRate: number;
  tradeCount: number;
  recentSharpe100: number;
  profitFactor: number;
  pnlHistory: number[];          // rolling window of trade P&Ls
  equityCurve: number[];         // rolling equity snapshots
}

export interface ManagedStrategy {
  id: string;
  dna: StrategyDNA;
  stage: LifecycleStage;
  birthGeneration: number;
  tradeCount: number;
  metrics: StrategyPerformance;
  capitalAllocation: number;      // 0-1 fraction
  noveltyScore: number;
  behavioralFingerprint: BehavioralVector;
  createdBy: StrategyCreator;
  retiredReason?: string;
  parentIds: string[];
  createdAt: number;
  lastUpdatedAt: number;
}

export interface StrategyTransition {
  strategyId: string;
  from: LifecycleStage;
  to: LifecycleStage;
  reason: string;
  timestamp: number;
}

export interface CompetitorThreat {
  botId: string;
  botName: string;
  winsAgainstUs: number;
  totalMatchups: number;
  dominanceScore: number;         // 0-1
  dnaFingerprint: number[];
  weaknesses: string[];
}

export type ChaosHedgeType = 'volatility_long' | 'tail_hedge' | 'regime_straddle';

export interface ChaosHedge {
  type: ChaosHedgeType;
  allocation: number;
  dna: StrategyDNA;
  triggerCondition: string;
  active: boolean;
  lifetimePnL: number;
}

export interface MetaParameters {
  mutationRate: number;           // 0.05-0.30
  selectionPressure: number;      // 2-7 tournament size
  noveltyWeight: number;          // 0.1-0.5 in combined fitness
  explorationRate: number;        // 0.1-0.4 epsilon-greedy
  retirementThreshold: number;    // Sharpe threshold
  populationSize: number;         // 10-50 active strategies
  lastTuned: number;
  tuningHistory: MetaTuningEntry[];
}

export interface MetaTuningEntry {
  params: Omit<MetaParameters, 'tuningHistory' | 'lastTuned'>;
  fitness: number;
  timestamp: number;
}

export interface ArenaSnapshot {
  leaderboard: LeaderboardEntry[];
  botTrades: Map<string, ArenaBotTradeEvent[]>;
  currentGeneration: number;
  timestamp: number;
}

export interface CompetitiveStatus {
  rank: number;
  pnl: number;
  activeStrategies: number;
  retiredStrategies: number;
  generation: number;
  chaosIndex: number;
  topThreat: string | null;
  metaLearningInsights: string[];
  uptime: number;
}

// ===================== STATE STORE TYPES =====================

export interface Phase5State {
  strategies: ManagedStrategy[];
  archive: ManagedStrategy[];
  noveltyArchive: BehavioralVector[];
  metaParams: MetaParameters;
  threats: CompetitorThreat[];
  hedges: ChaosHedge[];
  generation: number;
  lastSaved: number;
}
