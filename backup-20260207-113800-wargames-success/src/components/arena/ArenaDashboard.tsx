'use client';

import { useEffect, useState } from 'react';
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
import { EvolutionTimeline } from './EvolutionTimeline';
import { MasterBotPanel } from './MasterBotPanel';
import { BotDetailView } from './BotDetailView';
import { GroupDetailPanel } from './GroupDetailPanel';
import { BattleGrid } from './BattleGrid';
import { GroupBattle } from './GroupBattle';
import { TournamentBracket } from './TournamentBracket';
import { DNAComparisonView } from './DNAComparisonView';
import { DNAHeatmap } from './DNAHeatmap';

import type { BotGroupName } from '@/types/arena';
import { LayoutGrid, Trophy, Dna, Swords, Loader2 } from 'lucide-react';

type DashboardTab = 'overview' | 'battle' | 'leaderboard' | 'evolution';

export function ArenaDashboard() {
  const {
    view, bots, compareBotIds, setBots, setStatus, setLeaderboard, setMasterBot,
    setLoading, setTournament, setError, error, isLoading, setCompareBotIds,
  } = useArenaStore();

  const [tab, setTab] = useState<DashboardTab>('overview');

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

  // DNA comparison view
  if (view === 'dna-compare' && compareBotIds.length >= 2) {
    const compareBots = bots.filter(b => compareBotIds.includes(b.id));
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dna className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">DNA Comparison</h2>
            <span className="text-xs text-gray-500">{compareBots.length} bots</span>
          </div>
          <button
            onClick={() => setCompareBotIds([])}
            className="px-3 py-1.5 text-xs bg-gray-800 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DNAComparisonView bots={compareBots} />
          <DNAHeatmap bots={compareBots} />
        </div>
      </div>
    );
  }

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

  const tabs: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutGrid },
    { key: 'battle', label: 'Battle', icon: Swords },
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { key: 'evolution', label: 'Evolution', icon: Dna },
  ];

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

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === key
                ? 'text-white border-amber-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <>
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
        </>
      )}

      {tab === 'battle' && (
        <>
          {/* Battle Grid: all 21 bots in real-time */}
          <BattleGrid />

          {/* Tournament Bracket + Group Battle */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-7">
              <TournamentBracket />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <GroupBattle />
            </div>
          </div>

          {/* Activity Feed */}
          <ArenaActivityFeed />
        </>
      )}

      {tab === 'leaderboard' && (
        <>
          <Leaderboard />
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <GroupBattle />
            </div>
            <div className="col-span-12 lg:col-span-6">
              <ArenaActivityFeed />
            </div>
          </div>
        </>
      )}

      {tab === 'evolution' && (
        <>
          {/* Evolution Timeline Chart */}
          <EvolutionTimeline />

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <EvolutionPanel />
            </div>
            <div className="col-span-12 lg:col-span-6">
              <MasterBotPanel />
            </div>
          </div>

          {/* DNA Heatmap of all bots */}
          <DNAHeatmap bots={bots} />
        </>
      )}
    </div>
  );
}
