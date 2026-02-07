// Zustand Store for Arena State Management
import { create } from 'zustand';
import type {
  Bot,
  BotGroup,
  BotGroupName,
  Tournament,
  LeaderboardEntry,
  BotTrade,
  EvolutionResult,
  MasterBot,
  ArenaStatus,
  ArenaBotTradeEvent,
  BotPortfolio,
  BotPosition,
} from '@/types/arena';

type ArenaView = 'dashboard' | 'bot-detail' | 'group-detail' | 'dna-compare';

interface ArenaState {
  // Data
  bots: Bot[];
  tournament: Tournament | null;
  leaderboard: LeaderboardEntry[];
  activityFeed: ArenaBotTradeEvent[];
  evolutionHistory: EvolutionResult[];
  masterBot: MasterBot | null;
  status: ArenaStatus | null;

  // Selected bot/group for detail views
  selectedBotId: string | null;
  selectedGroupName: BotGroupName | null;
  compareBotIds: string[];

  // UI
  view: ArenaView;
  isLoading: boolean;
  error: string | null;

  // Actions
  setBots: (bots: Bot[]) => void;
  setTournament: (tournament: Tournament | null) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  addActivityEvent: (event: ArenaBotTradeEvent) => void;
  setActivityFeed: (events: ArenaBotTradeEvent[]) => void;
  setEvolutionHistory: (results: EvolutionResult[]) => void;
  setMasterBot: (masterBot: MasterBot | null) => void;
  setStatus: (status: ArenaStatus) => void;
  setSelectedBotId: (botId: string | null) => void;
  setSelectedGroupName: (groupName: BotGroupName | null) => void;
  setCompareBotIds: (botIds: string[]) => void;
  setView: (view: ArenaView) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateTournamentRound: (round: number) => void;
}

export const useArenaStore = create<ArenaState>()((set) => ({
  // Initial state
  bots: [],
  tournament: null,
  leaderboard: [],
  activityFeed: [],
  evolutionHistory: [],
  masterBot: null,
  status: null,
  selectedBotId: null,
  selectedGroupName: null,
  compareBotIds: [],
  view: 'dashboard',
  isLoading: false,
  error: null,

  // Actions
  setBots: (bots) => set({ bots }),

  setTournament: (tournament) => set({ tournament }),

  setLeaderboard: (entries) => set({ leaderboard: entries }),

  addActivityEvent: (event) =>
    set((state) => ({
      activityFeed: [event, ...state.activityFeed].slice(0, 200),
    })),

  setActivityFeed: (events) => set({ activityFeed: events }),

  setEvolutionHistory: (results) => set({ evolutionHistory: results }),

  setMasterBot: (masterBot) => set({ masterBot }),

  setStatus: (status) => set({ status }),

  setSelectedBotId: (botId) => set({ selectedBotId: botId, view: botId ? 'bot-detail' : 'dashboard' }),

  setSelectedGroupName: (groupName) => set({ selectedGroupName: groupName, view: groupName ? 'group-detail' : 'dashboard' }),

  setCompareBotIds: (botIds) => set({ compareBotIds: botIds, view: botIds.length > 0 ? 'dna-compare' : 'dashboard' }),

  setView: (view) => set({ view }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  updateTournamentRound: (round) =>
    set((state) => ({
      tournament: state.tournament ? { ...state.tournament, currentRound: round } : null,
    })),
}));

// Selectors
export const selectBotsByGroup = (groupName: BotGroupName) => (state: ArenaState) =>
  state.bots.filter((b) => b.groupName === groupName);

export const selectBotById = (botId: string) => (state: ArenaState) =>
  state.bots.find((b) => b.id === botId);

export const selectLeaderboardByGroup = (groupName: BotGroupName) => (state: ArenaState) =>
  state.leaderboard.filter((e) => e.groupName === groupName);

export const selectTopBot = (state: ArenaState) =>
  state.leaderboard.length > 0 ? state.leaderboard[0] : null;

export const selectGroupStats = (state: ArenaState) => {
  const groups: Record<BotGroupName, { avgPnL: number; botCount: number }> = {
    Alpha: { avgPnL: 0, botCount: 0 },
    Beta: { avgPnL: 0, botCount: 0 },
    Gamma: { avgPnL: 0, botCount: 0 },
  };

  for (const entry of state.leaderboard) {
    groups[entry.groupName].avgPnL += entry.totalPnLPercent;
    groups[entry.groupName].botCount++;
  }

  for (const g of Object.values(groups)) {
    if (g.botCount > 0) g.avgPnL /= g.botCount;
  }

  return groups;
};
