'use client';

import { useEffect, useRef, useState } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import { useArenaWebSocket } from '@/hooks/useArenaWebSocket';
import { getArenaStatus, getBots, getLeaderboard, getMasterBot } from '@/services/arenaApi';

import { ArenaHeader } from './ArenaHeader';
import { TournamentControls } from './TournamentControls';
import { TournamentTimer } from './TournamentTimer';
import { ContinuousControls } from './ContinuousControls';
import { ArenaStats } from './ArenaStats';
import { GroupCard } from './GroupCard';
import { Leaderboard } from './Leaderboard';
import { ArenaActivityFeed } from './ArenaActivityFeed';
import { EvolutionPanel } from './EvolutionPanel';
import { MasterBotPanel } from './MasterBotPanel';
import { BotDetailView } from './BotDetailView';
import { GroupDetailPanel } from './GroupDetailPanel';

import type { BotGroupName } from '@/types/arena';
import { Loader2 } from 'lucide-react';

export function ArenaDashboard() {
  const view = useArenaStore(s => s.view);
  const bots = useArenaStore(s => s.bots);
  const error = useArenaStore(s => s.error);
  const isLoading = useArenaStore(s => s.isLoading);

  const loadedRef = useRef(false);

  // Connect arena WebSocket
  useArenaWebSocket();

  // Load initial data (once)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const { setLoading, setStatus, setBots, setLeaderboard, setTournament, setMasterBot, setError } = useArenaStore.getState();

    const loadData = async () => {
      setLoading(true);
      try {
        const [status, botsData, leaderboard, masterBot] = await Promise.all([
          getArenaStatus(),
          getBots(),
          getLeaderboard().catch(() => []),
          getMasterBot().catch(() => null),
        ]);
        setStatus(status);
        setBots(botsData);
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
          useArenaStore.getState().setLeaderboard(leaderboard);
          useArenaStore.getState().setStatus(status);
          if (status.tournament) useArenaStore.getState().setTournament(status.tournament);
        } catch {}
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Error toast auto-dismiss
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => useArenaStore.getState().setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Bot detail view
  if (view === 'bot-detail') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
        <BotDetailView />
      </div>
    );
  }

  // Group detail view
  if (view === 'group-detail') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
        <GroupDetailPanel />
      </div>
    );
  }

  // Loading state
  if (isLoading && bots.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <span className="text-sm text-gray-500">Loading Arena...</span>
        </div>
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

      {/* Continuous Arena Controls */}
      <ContinuousControls />

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
