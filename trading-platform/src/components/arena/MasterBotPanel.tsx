'use client';

import { useArenaStore } from '@/stores/arenaStore';
import { DNAVisualization } from './DNAVisualization';
import { Brain } from 'lucide-react';

export function MasterBotPanel() {
  const { masterBot } = useArenaStore();

  if (!masterBot) {
    return (
      <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Master Bot</span>
        </div>
        <div className="text-xs text-gray-500 text-center py-8">
          No master bot yet. Synthesize one after a tournament!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-amber-500/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-white">Master Bot</span>
        <span className="text-xs text-gray-500 ml-auto">Gen {masterBot.generation}</span>
      </div>

      <DNAVisualization dna={masterBot.dna} color="#f59e0b" compact />

      <div className="mt-2 space-y-1">
        <div className="text-xs text-gray-500">Synthesized from:</div>
        <div className="flex flex-wrap gap-1">
          {masterBot.sourceBotIds.map((id, i) => (
            <span key={id} className="text-[10px] px-2 py-0.5 bg-gray-800 rounded text-gray-300">
              Bot {id.slice(0, 6)} ({(masterBot.sourceWeights[i] * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
