'use client';

import { useArenaStore } from '@/stores/arenaStore';
import { BarChart3, Users, Trophy, TrendingUp } from 'lucide-react';

export function ArenaStats() {
  const status = useArenaStore(s => s.status);
  const leaderboard = useArenaStore(s => s.leaderboard);

  const totalTrades = status?.totalTrades || 0;
  const bestReturn = leaderboard.length > 0 ? Math.max(...leaderboard.map(e => e.totalPnLPercent)) : 0;
  const worstReturn = leaderboard.length > 0 ? Math.min(...leaderboard.map(e => e.totalPnLPercent)) : 0;
  const avgReturn = leaderboard.length > 0 ? leaderboard.reduce((s, e) => s + e.totalPnLPercent, 0) / leaderboard.length : 0;

  const stats = [
    { label: 'Total Bots', value: status?.totalBots || 21, icon: Users, color: 'text-blue-400' },
    { label: 'Total Trades', value: totalTrades, icon: BarChart3, color: 'text-cyan-400' },
    { label: 'Best Return', value: `${bestReturn >= 0 ? '+' : ''}${bestReturn.toFixed(1)}%`, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Top Bot', value: leaderboard[0]?.botName || '-', icon: Trophy, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-[#0f0f0f] rounded-xl border border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
          <div className="text-lg font-bold text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}
