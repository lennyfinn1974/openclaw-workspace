'use client';

import { useState } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import {
  startTournament, pauseTournament, resumeTournament,
  stopTournament, triggerEvolution, synthesizeMasterBot,
} from '@/services/arenaApi';
import { Play, Pause, Square, Zap, Brain, Loader2 } from 'lucide-react';

export function TournamentControls() {
  const { tournament, setTournament, setLeaderboard, setMasterBot, setBots, setError } = useArenaStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading('start');
    try {
      const result = await startTournament();
      setTournament(result.tournament);
    } catch (e) { setError((e as Error).message); }
    setLoading(null);
  };

  const handlePause = async () => {
    setLoading('pause');
    try {
      await pauseTournament();
      if (tournament) setTournament({ ...tournament, status: 'paused' });
    } catch (e) { setError((e as Error).message); }
    setLoading(null);
  };

  const handleResume = async () => {
    setLoading('resume');
    try {
      await resumeTournament();
      if (tournament) setTournament({ ...tournament, status: 'running' });
    } catch (e) { setError((e as Error).message); }
    setLoading(null);
  };

  const handleStop = async () => {
    setLoading('stop');
    try {
      await stopTournament();
      if (tournament) setTournament({ ...tournament, status: 'completed' });
    } catch (e) { setError((e as Error).message); }
    setLoading(null);
  };

  const handleEvolve = async () => {
    setLoading('evolve');
    try {
      const result = await triggerEvolution();
      useArenaStore.getState().setEvolutionHistory(result.results);
      // Refresh bots
      const { getBots } = await import('@/services/arenaApi');
      const bots = await getBots();
      setBots(bots);
    } catch (e) { setError((e as Error).message); }
    setLoading(null);
  };

  const handleSynthesize = async () => {
    setLoading('synthesize');
    try {
      const result = await synthesizeMasterBot();
      setMasterBot(result.masterBot);
    } catch (e) { setError((e as Error).message); }
    setLoading(null);
  };

  const isRunning = tournament?.status === 'running';
  const isPaused = tournament?.status === 'paused';
  const isComplete = tournament?.status === 'completed';
  const canEvolve = !isRunning && !isPaused;

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, color: string, disabled: boolean, key: string) => (
    <button
      key={key}
      onClick={onClick}
      disabled={disabled || loading !== null}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'}
        ${color}`}
    >
      {loading === key ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!isRunning && !isPaused && btn('Start Tournament', <Play className="w-4 h-4" />, handleStart, 'bg-green-600 text-white', false, 'start')}
      {isRunning && btn('Pause', <Pause className="w-4 h-4" />, handlePause, 'bg-yellow-600 text-white', false, 'pause')}
      {isPaused && btn('Resume', <Play className="w-4 h-4" />, handleResume, 'bg-green-600 text-white', false, 'resume')}
      {(isRunning || isPaused) && btn('Stop', <Square className="w-4 h-4" />, handleStop, 'bg-red-600 text-white', false, 'stop')}
      {btn('Evolve', <Zap className="w-4 h-4" />, handleEvolve, 'bg-purple-600 text-white', !canEvolve, 'evolve')}
      {btn('Synthesize Master', <Brain className="w-4 h-4" />, handleSynthesize, 'bg-amber-600 text-white', isRunning || isPaused, 'synthesize')}
    </div>
  );
}
