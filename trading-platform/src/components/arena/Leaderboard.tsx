'use client';

import { useState } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import type { LeaderboardEntry, BotGroupName } from '@/types/arena';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

type SortKey = 'rank' | 'totalPnLPercent' | 'sharpeRatio' | 'winRate' | 'maxDrawdown' | 'fitness';

export function Leaderboard() {
  const { leaderboard, setSelectedBotId } = useArenaStore();
  const [sortBy, setSortBy] = useState<SortKey>('rank');
  const [filterGroup, setFilterGroup] = useState<BotGroupName | 'all'>('all');

  const filtered = filterGroup === 'all'
    ? leaderboard
    : leaderboard.filter(e => e.groupName === filterGroup);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'rank') return a.rank - b.rank;
    if (sortBy === 'maxDrawdown') return a.maxDrawdown - b.maxDrawdown;
    return (b[sortBy] as number) - (a[sortBy] as number);
  });

  const groupColors: Record<BotGroupName, string> = {
    Alpha: 'text-blue-400',
    Beta: 'text-green-400',
    Gamma: 'text-amber-400',
  };

  const headerBtn = (label: string, key: SortKey) => (
    <th
      key={key}
      onClick={() => setSortBy(key)}
      className={`text-right px-2 py-2 font-medium cursor-pointer hover:text-white transition-colors
        ${sortBy === key ? 'text-white' : 'text-gray-500'}`}
    >
      {label}
    </th>
  );

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Leaderboard</span>
        </div>
        <div className="flex gap-1">
          {(['all', 'Alpha', 'Beta', 'Gamma'] as const).map(g => (
            <button
              key={g}
              onClick={() => setFilterGroup(g)}
              className={`px-2 py-1 text-xs rounded ${filterGroup === g ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {g === 'all' ? 'All' : g}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0f0f0f]">
            <tr className="border-b border-gray-800">
              {headerBtn('#', 'rank')}
              <th className="text-left px-2 py-2 text-gray-500 font-medium">Bot</th>
              <th className="text-left px-2 py-2 text-gray-500 font-medium">Group</th>
              {headerBtn('P&L %', 'totalPnLPercent')}
              {headerBtn('Sharpe', 'sharpeRatio')}
              {headerBtn('Win%', 'winRate')}
              {headerBtn('Max DD', 'maxDrawdown')}
              {headerBtn('Fitness', 'fitness')}
            </tr>
          </thead>
          <tbody>
            {sorted.map(entry => (
              <tr
                key={entry.botId}
                onClick={() => setSelectedBotId(entry.botId)}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
              >
                <td className="text-right px-2 py-2 text-gray-400">
                  {entry.rank <= 3 ? (
                    <span className={entry.rank === 1 ? 'text-amber-400 font-bold' : entry.rank === 2 ? 'text-gray-300' : 'text-amber-700'}>
                      {entry.rank}
                    </span>
                  ) : entry.rank}
                </td>
                <td className="px-2 py-2">
                  <div className="text-white font-medium">{entry.botName}</div>
                  <div className="text-gray-500 text-[10px]">{entry.symbol}</div>
                </td>
                <td className={`px-2 py-2 ${groupColors[entry.groupName]}`}>{entry.groupName}</td>
                <td className={`text-right px-2 py-2 font-mono ${entry.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.totalPnLPercent >= 0 ? '+' : ''}{entry.totalPnLPercent.toFixed(2)}%
                </td>
                <td className="text-right px-2 py-2 font-mono text-gray-300">{entry.sharpeRatio.toFixed(2)}</td>
                <td className="text-right px-2 py-2 font-mono text-gray-300">{(entry.winRate * 100).toFixed(0)}%</td>
                <td className="text-right px-2 py-2 font-mono text-red-400">{(entry.maxDrawdown * 100).toFixed(1)}%</td>
                <td className="text-right px-2 py-2 font-mono text-purple-400 font-medium">{(entry.fitness * 100).toFixed(0)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">No data yet. Start a tournament!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
