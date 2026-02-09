// Arena Types - Frontend mirror of server arena types

export type BotGroupName = 'Alpha' | 'Beta' | 'Gamma';
export type TournamentStatus = 'pending' | 'running' | 'paused' | 'completed';
export type RoundStatus = 'pending' | 'running' | 'completed';

// ===================== STRATEGY DNA =====================

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

export interface StrategyDNA {
  entrySignals: EntrySignalWeights;
  indicatorParams: Record<string, number>;
  positionSizing: Record<string, number>;
  exitStrategy: Record<string, number>;
  regimeFilter: Record<string, number>;
  timing: Record<string, number>;
}

// ===================== BOT =====================

export interface Bot {
  id: string;
  name: string;
  groupName: BotGroupName;
  symbol: string;
  dna: StrategyDNA;
  generation: number;
  parentIds: string[];
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

// ===================== EVOLUTION =====================

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
  totalPnLPercent: number;
  sharpeRatio: number;
  winRate: number;
  maxDrawdownPenalty: number;
  tradeFrequency: number;
  consistency: number;
  composite: number;
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
