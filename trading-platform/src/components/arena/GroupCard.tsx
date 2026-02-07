'use client';

import { useMemo } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import type { BotGroupName } from '@/types/arena';
import { BotCard } from './BotCard';
import { BarChart3 } from 'lucide-react';

const GROUP_COLORS: Record<BotGroupName, string> = {
  Alpha: 'border-blue-500/30 bg-blue-950/20',
  Beta: 'border-green-500/30 bg-green-950/20',
  Gamma: 'border-amber-500/30 bg-amber-950/20',
};

const GROUP_LABELS: Record<BotGroupName, { color: string; label: string }> = {
  Alpha: { color: 'text-blue-400', label: 'FX' },
  Beta: { color: 'text-green-400', label: 'Stocks' },
  Gamma: { color: 'text-amber-400', label: 'Commodities' },
};

interface GroupCardProps {
  groupName: BotGroupName;
}

export function GroupCard({ groupName }: GroupCardProps) {
  const allBots = useArenaStore(s => s.bots);
  const leaderboard = useArenaStore(s => s.leaderboard);
  const setSelectedGroupName = useArenaStore(s => s.setSelectedGroupName);

  const bots = useMemo(() => allBots.filter(b => b.groupName === groupName), [allBots, groupName]);
  const entries = useMemo(() => leaderboard.filter(e => e.groupName === groupName), [leaderboard, groupName]);

  const entryMap = useMemo(() => new Map(entries.map(e => [e.botId, e])), [entries]);
  const avgPnL = entries.length > 0 ? entries.reduce((sum, e) => sum + e.totalPnLPercent, 0) / entries.length : 0;
  const { color, label } = GROUP_LABELS[groupName];

  return (
    <div className={`rounded-xl border p-3 ${GROUP_COLORS[groupName]}`}>
      <button
        onClick={() => setSelectedGroupName(groupName)}
        className="w-full flex items-center justify-between mb-2 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-bold text-white">{groupName}</span>
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        <div className={`text-xs font-mono ${avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Avg: {avgPnL >= 0 ? '+' : ''}{avgPnL.toFixed(1)}%
        </div>
      </button>

      <div className="space-y-1">
        {bots.map(bot => (
          <BotCard key={bot.id} bot={bot} entry={entryMap.get(bot.id)} />
        ))}
      </div>
    </div>
  );
}
