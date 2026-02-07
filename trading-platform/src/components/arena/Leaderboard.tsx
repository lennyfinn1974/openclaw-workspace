'use client';

import { useState } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import type { BotGroupName } from '@/types/arena';
import { Trophy, GitCompare, X, Check } from 'lucide-react';

type SortKey = 'rank' | 'totalPnLPercent' | 'sharpeRatio' | 'winRate' | 'maxDrawdown' | 'fitness';

export function Leaderboard() {
  const leaderboard = useArenaStore(s => s.leaderboard);
  const setSelectedBotId = useArenaStore(s => s.setSelectedBotId);
  const setCompareBotIds = useArenaStore(s => s.setCompareBotIds);
  const [sortBy, setSortBy] = useState<SortKey>('rank');
  const [filterGroup, setFilterGroup] = useState<BotGroupName | 'all'>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

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

  const toggleSelect = (botId: string) => {
    setSelected(prev =>
      prev.includes(botId)
        ? prev.filter(id => id !== botId)
        : prev.length < 3 ? [...prev, botId] : prev
    );
  };

  const handleCompare = () => {
    if (selected.length >= 2) {
      setCompareBotIds(selected);
      setCompareMode(false);
      setSelected([]);
    }
  };

  const cancelCompare = () => {
    setCompareMode(false);
    setSelected([]);
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
        <div className="flex items-center gap-2">
          {/* Compare mode toggle */}
          {compareMode ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-purple-400">{selected.length}/3 selected</span>
              <button
                onClick={handleCompare}
                disabled={selected.length < 2}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded ${
                  selected.length >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Check className="w-3 h-3" /> Compare
              </button>
              <button onClick={cancelCompare} className="p-1 text-gray-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCompareMode(true)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-purple-400 transition-colors rounded hover:bg-purple-500/10"
            >
              <GitCompare className="w-3 h-3" /> Compare DNA
            </button>
          )}

          {/* Group filter */}
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
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto arena-scrollbar">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0f0f0f]">
            <tr className="border-b border-gray-800">
              {compareMode && <th className="w-8 px-2 py-2" />}
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
            {sorted.map(entry => {
              const isSelected = selected.includes(entry.botId);
              return (
                <tr
                  key={entry.botId}
                  onClick={() => compareMode ? toggleSelect(entry.botId) : setSelectedBotId(entry.botId)}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors
                    ${isSelected ? 'bg-purple-500/10 ring-1 ring-inset ring-purple-500/30' : ''}`}
                >
                  {compareMode && (
                    <td className="px-2 py-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-600'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </td>
                  )}
                  <td className="text-right px-2 py-2 text-gray-400">
                    {entry.rank <= 3 ? (
                      <span className={`font-bold ${
                        entry.rank === 1 ? 'text-amber-400 animate-crown-shimmer' : entry.rank === 2 ? 'text-gray-300' : 'text-amber-700'
                      }`}>
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
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={compareMode ? 9 : 8} className="text-center py-8 text-gray-500">No data yet. Start a tournament!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
