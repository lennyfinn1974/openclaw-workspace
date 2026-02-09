'use client';

import { useArenaStore } from '@/stores/arenaStore';
import { Swords, Dna, Trophy } from 'lucide-react';

export function ArenaHeader() {
  const { status, tournament } = useArenaStore();
  const generation = status?.generation || 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Swords className="w-7 h-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Wargames Arena</h1>
          <p className="text-xs text-gray-500">21-Bot Tournament System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
          <Dna className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-gray-300">Gen <span className="text-white font-bold">{generation}</span></span>
        </div>

        {tournament && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            tournament.status === 'running' ? 'bg-green-900/30 text-green-400' :
            tournament.status === 'paused' ? 'bg-yellow-900/30 text-yellow-400' :
            tournament.status === 'completed' ? 'bg-blue-900/30 text-blue-400' :
            'bg-gray-800 text-gray-400'
          }`}>
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-medium">
              {tournament.status === 'running' ? `Round ${tournament.currentRound}/${tournament.totalRounds}` :
               tournament.status === 'paused' ? 'Paused' :
               tournament.status === 'completed' ? 'Complete' : 'Ready'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
