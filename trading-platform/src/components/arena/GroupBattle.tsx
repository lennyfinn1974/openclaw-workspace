'use client';

import { useArenaStore, selectGroupStats, selectLeaderboardByGroup } from '@/stores/arenaStore';
import type { BotGroupName } from '@/types/arena';
import { Shield, Trophy, Target } from 'lucide-react';

const GROUP_COLORS: Record<BotGroupName, { bg: string; text: string; bar: string; ring: string }> = {
  Alpha: { bg: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500', ring: 'ring-blue-500/40' },
  Beta: { bg: 'bg-green-500/20', text: 'text-green-400', bar: 'bg-green-500', ring: 'ring-green-500/40' },
  Gamma: { bg: 'bg-amber-500/20', text: 'text-amber-400', bar: 'bg-amber-500', ring: 'ring-amber-500/40' },
};

const GROUP_LABELS: Record<BotGroupName, string> = { Alpha: 'FX', Beta: 'Stocks', Gamma: 'Commodities' };

interface MetricBarProps {
  label: string;
  groups: { name: BotGroupName; value: number }[];
  format: (v: number) => string;
  higherIsBetter?: boolean;
}

function MetricBar({ label, groups, format, higherIsBetter = true }: MetricBarProps) {
  const maxAbs = Math.max(...groups.map(g => Math.abs(g.value)), 0.01);

  // Determine winner
  const sorted = [...groups].sort((a, b) => higherIsBetter ? b.value - a.value : a.value - b.value);
  const winnerId = sorted[0]?.name;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-gray-500 font-medium">{label}</div>
      {groups.map(({ name, value }) => {
        const width = Math.min((Math.abs(value) / maxAbs) * 100, 100);
        const isWinner = name === winnerId;
        const colors = GROUP_COLORS[name];
        return (
          <div key={name} className="flex items-center gap-2">
            <span className={`text-[9px] w-8 ${colors.text} font-medium`}>{name}</span>
            <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-700 ${colors.bar} ${isWinner ? 'opacity-100' : 'opacity-50'}`}
                style={{ width: `${Math.max(width, 2)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-2 text-[9px] font-mono text-white/80">
                {format(value)}
              </span>
            </div>
            {isWinner && <Trophy className="w-3 h-3 text-amber-400" />}
          </div>
        );
      })}
    </div>
  );
}

export function GroupBattle() {
  const groupStats = useArenaStore(selectGroupStats);
  const alphaEntries = useArenaStore(selectLeaderboardByGroup('Alpha'));
  const betaEntries = useArenaStore(selectLeaderboardByGroup('Beta'));
  const gammaEntries = useArenaStore(selectLeaderboardByGroup('Gamma'));

  const entriesByGroup: Record<BotGroupName, typeof alphaEntries> = {
    Alpha: alphaEntries,
    Beta: betaEntries,
    Gamma: gammaEntries,
  };

  const groupNames: BotGroupName[] = ['Alpha', 'Beta', 'Gamma'];

  // Compute aggregate metrics per group
  const metrics = groupNames.map(name => {
    const entries = entriesByGroup[name];
    const avgPnL = entries.length > 0 ? entries.reduce((s, e) => s + e.totalPnLPercent, 0) / entries.length : 0;
    const avgSharpe = entries.length > 0 ? entries.reduce((s, e) => s + e.sharpeRatio, 0) / entries.length : 0;
    const avgWinRate = entries.length > 0 ? entries.reduce((s, e) => s + e.winRate, 0) / entries.length : 0;
    const avgFitness = entries.length > 0 ? entries.reduce((s, e) => s + e.fitness, 0) / entries.length : 0;
    const totalTrades = entries.reduce((s, e) => s + e.totalTrades, 0);
    const bestBot = entries.length > 0 ? entries.reduce((best, e) => e.fitness > best.fitness ? e : best) : null;
    const worstBot = entries.length > 0 ? entries.reduce((worst, e) => e.fitness < worst.fitness ? e : worst) : null;
    return { name, avgPnL, avgSharpe, avgWinRate, avgFitness, totalTrades, bestBot, worstBot };
  });

  // Group fitness ranking
  const ranked = [...metrics].sort((a, b) => b.avgFitness - a.avgFitness);

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-white">Group Battle</span>
        <span className="text-xs text-gray-500">Alpha vs Beta vs Gamma</span>
      </div>

      {/* Group ranking badges */}
      <div className="flex gap-2 mb-4">
        {ranked.map((g, i) => {
          const colors = GROUP_COLORS[g.name];
          const medal = i === 0 ? 'ring-2 ring-amber-500/60' : i === 1 ? 'ring-1 ring-gray-500/40' : 'ring-1 ring-amber-800/30';
          return (
            <div key={g.name} className={`flex-1 rounded-lg ${colors.bg} p-2.5 ${medal} text-center`}>
              <div className={`text-xs font-bold ${colors.text}`}>{g.name}</div>
              <div className="text-[9px] text-gray-500">{GROUP_LABELS[g.name]}</div>
              <div className="text-lg font-bold text-white mt-1">{(g.avgFitness * 100).toFixed(0)}</div>
              <div className="text-[8px] text-gray-500">Group Fitness</div>
              {g.bestBot && (
                <div className="mt-1.5 text-[8px]">
                  <span className="text-gray-500">MVP: </span>
                  <span className="text-white font-medium">{g.bestBot.botName}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Metric comparison bars */}
      <div className="space-y-3">
        <MetricBar
          label="Average P&L %"
          groups={groupNames.map(n => ({ name: n, value: metrics.find(m => m.name === n)!.avgPnL }))}
          format={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
        />
        <MetricBar
          label="Average Sharpe Ratio"
          groups={groupNames.map(n => ({ name: n, value: metrics.find(m => m.name === n)!.avgSharpe }))}
          format={v => v.toFixed(2)}
        />
        <MetricBar
          label="Average Win Rate"
          groups={groupNames.map(n => ({ name: n, value: metrics.find(m => m.name === n)!.avgWinRate * 100 }))}
          format={v => `${v.toFixed(0)}%`}
        />
        <MetricBar
          label="Total Trades"
          groups={groupNames.map(n => ({ name: n, value: metrics.find(m => m.name === n)!.totalTrades }))}
          format={v => String(Math.round(v))}
        />
      </div>
    </div>
  );
}
