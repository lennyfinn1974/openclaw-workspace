'use client';

import { useArenaStore } from '@/stores/arenaStore';
import type { Bot, LeaderboardEntry } from '@/types/arena';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BotCardProps {
  bot: Bot;
  entry?: LeaderboardEntry;
}

export function BotCard({ bot, entry }: BotCardProps) {
  const setSelectedBotId = useArenaStore(s => s.setSelectedBotId);
  const pnl = entry?.totalPnLPercent || 0;
  const rank = entry?.rank;

  const rankColor = rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-700' : 'text-gray-500';
  const pnlColor = pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <button
      onClick={() => setSelectedBotId(bot.id)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-left"
    >
      {rank && (
        <span className={`text-xs font-bold w-5 text-center ${rankColor}`}>
          #{rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white truncate">{bot.name}</div>
        <div className="text-[10px] text-gray-500">{bot.symbol}</div>
      </div>
      <div className={`text-xs font-mono font-medium ${pnlColor} flex items-center gap-0.5`}>
        {pnl > 0 ? <TrendingUp className="w-3 h-3" /> :
         pnl < 0 ? <TrendingDown className="w-3 h-3" /> :
         <Minus className="w-3 h-3" />}
        {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
      </div>
    </button>
  );
}
