'use client';

import { useState, useEffect } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import { Timer } from 'lucide-react';

export function TournamentTimer() {
  const tournament = useArenaStore(s => s.tournament);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!tournament || tournament.status !== 'running') {
      setTimeLeft(0);
      return;
    }

    // Approximate time left in current round
    setTimeLeft(tournament.roundDurationMs / 1000);

    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [tournament?.status, tournament?.currentRound]);

  if (!tournament || tournament.status !== 'running') return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
      <Timer className="w-4 h-4 text-cyan-400" />
      <span className="text-sm font-mono text-white">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
