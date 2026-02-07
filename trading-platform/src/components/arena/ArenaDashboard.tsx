'use client';

import { useEffect } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import { useArenaWebSocket } from '@/hooks/useArenaWebSocket';
import { getArenaStatus, getBots, getLeaderboard, getMasterBot } from '@/services/arenaApi';

import { ArenaHeader } from './ArenaHeader';
import { TournamentControls } from './TournamentControls';
import { TournamentTimer } from './TournamentTimer';
import { ArenaStats } from './ArenaStats';
import { GroupCard } from './GroupCard';
import { Leaderboard } from './Leaderboard';
import { ArenaActivityFeed } from './ArenaActivityFeed';
import { EvolutionPanel } from './EvolutionPanel';
import { MasterBotPanel } from './MasterBotPanel';
import { BotDetailView } from './BotDetailView';
import { GroupDetailPanel } from './GroupDetailPanel';

import type { BotGroupName } from '@/types/arena';

export function ArenaDashboard() {
  const {
    view, setBots, setStatus, setLeaderboard, setMasterBot,
    setLoading, setTournament, setError, error,
  } = useArenaStore();

  // Connect arena WebSocket
  useArenaWebSocket();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [status, bots, leaderboard, masterBot] = await Promise.all([
          getArenaStatus(),
          getBots(),
          getLeaderboard().catch(() => []),
          getMasterBot().catch(() => null),
        ]);
        setStatus(status);
        setBots(bots);
        setLeaderboard(leaderboard);
        if (status.tournament) setTournament(status.tournament);
        setMasterBot(masterBot);
      } catch (e) {
        setError((e as Error).message);
      }
      setLoading(false);
    };

    loadData();

    // Refresh leaderboard every 10 seconds when tournament running
    const interval = setInterval(async () => {
      const state = useArenaStore.getState();
      if (state.tournament?.status === 'running') {
        try {
          const [leaderboard, status] = await Promise.all([
            getLeaderboard(),
            getArenaStatus(),
          ]);
          setLeaderboard(leaderboard);
          setStatus(status);
          if (status.tournament) setTournament(status.tournament);
        } catch {}
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Error toast
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Render based on view
  if (view === 'bot-detail') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
        <BotDetailView />
      </div>
    );
  }

  if (view === 'group-detail') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
        <GroupDetailPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 space-y-4">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-900/80 text-red-200 px-4 py-2 rounded-lg text-sm border border-red-700">
          {error}
        </div>
      )}

      {/* Header */}
      <ArenaHeader />

      {/* Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <TournamentControls />
        <TournamentTimer />
      </div>

      {/* Stats */}
      <ArenaStats />

      {/* Main Grid: 3 Groups + Leaderboard + Activity */}
      <div className="grid grid-cols-12 gap-4">
        {/* 3 Group Cards */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          {(['Alpha', 'Beta', 'Gamma'] as BotGroupName[]).map(name => (
            <GroupCard key={name} groupName={name} />
          ))}
        </div>

        {/* Leaderboard */}
        <div className="col-span-12 lg:col-span-5">
          <Leaderboard />
        </div>

        {/* Activity Feed */}
        <div className="col-span-12 lg:col-span-4">
          <ArenaActivityFeed />
        </div>
      </div>

      {/* Bottom Row: Evolution + Master Bot */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6">
          <EvolutionPanel />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <MasterBotPanel />
        </div>
      </div>
    </div>
  );
}
