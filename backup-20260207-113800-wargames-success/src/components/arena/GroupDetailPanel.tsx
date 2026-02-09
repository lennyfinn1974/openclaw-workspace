'use client';

import { useArenaStore, selectBotsByGroup, selectLeaderboardByGroup } from '@/stores/arenaStore';
import type { BotGroupName } from '@/types/arena';
import { DNAHeatmap } from './DNAHeatmap';
import { ArrowLeft, BarChart3 } from 'lucide-react';

const GROUP_INFO: Record<BotGroupName, { label: string; color: string }> = {
  Alpha: { label: 'FX Pairs', color: 'text-blue-400' },
  Beta: { label: 'Stocks', color: 'text-green-400' },
  Gamma: { label: 'Commodities', color: 'text-amber-400' },
};

export function GroupDetailPanel() {
  const { selectedGroupName, setSelectedGroupName, setView, setSelectedBotId } = useArenaStore();
  if (!selectedGroupName) return null;

  const bots = useArenaStore(selectBotsByGroup(selectedGroupName));
  const entries = useArenaStore(selectLeaderboardByGroup(selectedGroupName));
  const { label, color } = GROUP_INFO[selectedGroupName];

  const handleBack = () => {
    setSelectedGroupName(null);
    setView('dashboard');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={handleBack} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <BarChart3 className={`w-5 h-5 ${color}`} />
        <div>
          <h2 className="text-xl font-bold text-white">{selectedGroupName} Group</h2>
          <p className="text-xs text-gray-500">{label} - {bots.length} Bots</p>
        </div>
      </div>

      {/* Group Leaderboard */}
      <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-bold text-white">Group Leaderboard</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-center px-3 py-2 w-10">#</th>
              <th className="text-left px-3 py-2">Bot</th>
              <th className="text-left px-3 py-2">Symbol</th>
              <th className="text-right px-3 py-2">P&L %</th>
              <th className="text-right px-3 py-2">Sharpe</th>
              <th className="text-right px-3 py-2">Win%</th>
              <th className="text-right px-3 py-2">Trades</th>
              <th className="text-right px-3 py-2">Fitness</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr
                key={entry.botId}
                onClick={() => setSelectedBotId(entry.botId)}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
              >
                <td className="text-center px-3 py-2.5 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2.5 text-white font-medium">{entry.botName}</td>
                <td className="px-3 py-2.5 text-gray-400">{entry.symbol}</td>
                <td className={`text-right px-3 py-2.5 font-mono ${entry.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.totalPnLPercent >= 0 ? '+' : ''}{entry.totalPnLPercent.toFixed(2)}%
                </td>
                <td className="text-right px-3 py-2.5 font-mono text-gray-300">{entry.sharpeRatio.toFixed(2)}</td>
                <td className="text-right px-3 py-2.5 font-mono text-gray-300">{(entry.winRate * 100).toFixed(0)}%</td>
                <td className="text-right px-3 py-2.5 font-mono text-gray-300">{entry.totalTrades}</td>
                <td className="text-right px-3 py-2.5 font-mono text-purple-400">{(entry.fitness * 100).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DNA Heatmap */}
      <DNAHeatmap bots={bots} />
    </div>
  );
}
