// Arena API Service - REST client for /api/arena/* endpoints
import type {
  Bot,
  Tournament,
  LeaderboardEntry,
  BotTrade,
  BotPortfolio,
  BotPosition,
  EvolutionResult,
  MasterBot,
  ArenaStatus,
  BotGroupName,
} from '@/types/arena';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8101';

async function fetchArena<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api/arena${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Arena API request failed');
  }
  return response.json();
}

// ===================== STATUS =====================

export async function getArenaStatus(): Promise<ArenaStatus> {
  return fetchArena<ArenaStatus>('/status');
}

export async function getArenaSymbols(): Promise<Record<string, { assetClass: string; symbols: string[] }>> {
  return fetchArena('/symbols');
}

// ===================== TOURNAMENTS =====================

export async function getTournaments(limit: number = 10): Promise<Tournament[]> {
  return fetchArena<Tournament[]>(`/tournaments?limit=${limit}`);
}

export async function getCurrentTournament(): Promise<Tournament | null> {
  return fetchArena<Tournament | null>('/tournament/current');
}

export async function createTournament(params?: { totalRounds?: number; roundDurationMs?: number }): Promise<Tournament> {
  return fetchArena<Tournament>('/tournament/create', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

export async function startTournament(): Promise<{ success: boolean; tournament: Tournament }> {
  return fetchArena('/tournament/start', { method: 'POST' });
}

export async function pauseTournament(): Promise<{ success: boolean }> {
  return fetchArena('/tournament/pause', { method: 'POST' });
}

export async function resumeTournament(): Promise<{ success: boolean }> {
  return fetchArena('/tournament/resume', { method: 'POST' });
}

export async function stopTournament(): Promise<{ success: boolean }> {
  return fetchArena('/tournament/stop', { method: 'POST' });
}

// ===================== BOTS =====================

export async function getBots(): Promise<Bot[]> {
  return fetchArena<Bot[]>('/bots');
}

export async function getBotsByGroup(groupName: BotGroupName): Promise<Bot[]> {
  return fetchArena<Bot[]>(`/bots/group/${groupName}`);
}

export async function getBot(botId: string): Promise<Bot> {
  return fetchArena<Bot>(`/bots/${botId}`);
}

export async function getBotPortfolio(botId: string): Promise<BotPortfolio | null> {
  return fetchArena<BotPortfolio | null>(`/bots/${botId}/portfolio`);
}

export async function getBotPositions(botId: string): Promise<BotPosition[]> {
  return fetchArena<BotPosition[]>(`/bots/${botId}/positions`);
}

export async function getBotTrades(botId: string, limit: number = 50): Promise<BotTrade[]> {
  return fetchArena<BotTrade[]>(`/bots/${botId}/trades?limit=${limit}`);
}

export async function getBotDNAHistory(botId: string): Promise<{ generation: number; dna: any; fitness: number; timestamp: string }[]> {
  return fetchArena(`/bots/${botId}/dna-history`);
}

// ===================== LEADERBOARD =====================

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return fetchArena<LeaderboardEntry[]>('/leaderboard');
}

export async function getLeaderboardByGroup(groupName: BotGroupName): Promise<LeaderboardEntry[]> {
  return fetchArena<LeaderboardEntry[]>(`/leaderboard/group/${groupName}`);
}

export async function getLeaderboardHistory(tournamentId: string): Promise<any[]> {
  return fetchArena(`/leaderboard/history/${tournamentId}`);
}

// ===================== EVOLUTION =====================

export async function triggerEvolution(): Promise<{ success: boolean; generation: number; results: EvolutionResult[] }> {
  return fetchArena('/evolve', { method: 'POST' });
}

// ===================== MASTER BOT =====================

export async function getMasterBot(): Promise<MasterBot | null> {
  return fetchArena<MasterBot | null>('/master-bot');
}

export async function synthesizeMasterBot(): Promise<{ masterBot: MasterBot; sourceBots: string[] }> {
  return fetchArena('/master-bot/synthesize', { method: 'POST' });
}

export async function getMasterBotHistory(limit: number = 10): Promise<MasterBot[]> {
  return fetchArena<MasterBot[]>(`/master-bot/history?limit=${limit}`);
}

// ===================== ACTIVITY =====================

export async function getArenaTrades(limit: number = 100): Promise<BotTrade[]> {
  return fetchArena<BotTrade[]>(`/trades?limit=${limit}`);
}
