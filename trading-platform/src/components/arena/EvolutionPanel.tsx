'use client';

import { useArenaStore } from '@/stores/arenaStore';
import { Dna, Zap } from 'lucide-react';

export function EvolutionPanel() {
  const { status, evolutionHistory } = useArenaStore();
  const generation = status?.generation || 0;

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Dna className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-bold text-white">Evolution</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Current Generation</span>
          <span className="text-lg font-bold text-purple-400">{generation}</span>
        </div>

        {evolutionHistory.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Last Evolution</div>
            {evolutionHistory.map((result, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-gray-800/50 rounded-lg px-3 py-2">
                <span className="text-gray-300">{result.groupName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">
                    Elites: <span className="text-green-400">{result.elites.length}</span>
                  </span>
                  <span className="text-gray-500">
                    New: <span className="text-cyan-400">{result.offspring.length}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className={result.avgFitnessAfter >= result.avgFitnessBefore ? 'text-green-400' : 'text-red-400'}>
                      {result.avgFitnessAfter > result.avgFitnessBefore ? '+' : ''}
                      {((result.avgFitnessAfter - result.avgFitnessBefore) * 100).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {evolutionHistory.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-4">
            Complete a tournament to evolve bots
          </div>
        )}
      </div>
    </div>
  );
}
