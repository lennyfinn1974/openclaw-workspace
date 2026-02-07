'use client';

import { useArenaStore } from '@/stores/arenaStore';
import type { Bot, BotGroupName, LeaderboardEntry, ArenaBotTradeEvent } from '@/types/arena';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

const GROUP_CONFIG: Record<BotGroupName, { label: string; accent: string; bg: string; border: string; glow: string }> = {
  Alpha: { label: 'FX', accent: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  Beta: { label: 'Stocks', accent: 'text-green-400', bg: 'bg-green-500', border: 'border-green-500/30', glow: 'shadow-green-500/20' },
  Gamma: { label: 'Commodities', accent: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
};

interface BotCellProps {
  bot: Bot;
  entry?: LeaderboardEntry;
  recentTrade?: ArenaBotTradeEvent;
  groupConfig: typeof GROUP_CONFIG[BotGroupName];
}

function BotCell({ bot, entry, recentTrade, groupConfig }: BotCellProps) {
  const setSelectedBotId = useArenaStore(s => s.setSelectedBotId);
  const [flash, setFlash] = useState(false);
  const prevPnlRef = useRef(entry?.totalPnLPercent ?? 0);

  const pnl = entry?.totalPnLPercent ?? 0;
  const fitness = entry?.fitness ?? 0;
  const rank = entry?.rank;
  const winRate = entry ? (entry.winRate * 100) : 0;

  // Flash on trade
  useEffect(() => {
    if (recentTrade) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 800);
      return () => clearTimeout(t);
    }
  }, [recentTrade?.timestamp]);

  // Track P&L direction
  const pnlDirection = pnl > prevPnlRef.current ? 'up' : pnl < prevPnlRef.current ? 'down' : 'flat';
  useEffect(() => { prevPnlRef.current = pnl; }, [pnl]);

  const pnlColor = pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-500';
  const barWidth = Math.min(Math.abs(pnl) * 4, 100);
  const barColor = pnl >= 0 ? 'bg-green-500/60' : 'bg-red-500/60';

  const rankBadge = rank === 1 ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
    : rank === 2 ? 'bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/40'
    : rank === 3 ? 'bg-amber-800/20 text-amber-600 ring-1 ring-amber-700/40'
    : 'bg-gray-800/50 text-gray-500';

  return (
    <button
      onClick={() => setSelectedBotId(bot.id)}
      className={`relative w-full rounded-lg border p-2 transition-all duration-300 cursor-pointer text-left
        ${groupConfig.border} bg-gray-900/60 hover:bg-gray-800/80 hover:shadow-lg
        ${flash ? `shadow-lg ${groupConfig.glow} ring-1 ${groupConfig.border}` : ''}`}
    >
      {/* Trade flash overlay */}
      {flash && (
        <div className={`absolute inset-0 rounded-lg ${
          recentTrade?.side === 'buy' ? 'bg-green-500/10' : 'bg-red-500/10'
        } animate-pulse pointer-events-none`} />
      )}

      {/* Top row: rank + name + P&L direction */}
      <div className="flex items-center gap-1.5 mb-1">
        {rank && (
          <span className={`text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded ${rankBadge}`}>
            {rank}
          </span>
        )}
        <span className="text-[10px] font-medium text-white truncate flex-1">{bot.name}</span>
        {pnlDirection === 'up' && <TrendingUp className="w-2.5 h-2.5 text-green-400" />}
        {pnlDirection === 'down' && <TrendingDown className="w-2.5 h-2.5 text-red-400" />}
        {pnlDirection === 'flat' && <Minus className="w-2.5 h-2.5 text-gray-600" />}
      </div>

      {/* Symbol */}
      <div className="text-[8px] text-gray-500 mb-1.5">{bot.symbol}</div>

      {/* P&L bar */}
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden mb-1">
        <div
          className={`absolute top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${barWidth}%`, left: pnl >= 0 ? '50%' : `${50 - barWidth}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[8px] font-mono font-bold ${pnlColor} drop-shadow-sm`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Fitness gauge */}
      <div className="flex items-center gap-1">
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500/70 rounded-full transition-all duration-700"
            style={{ width: `${fitness * 100}%` }}
          />
        </div>
        <span className="text-[7px] text-purple-400 font-mono">{(fitness * 100).toFixed(0)}</span>
      </div>

      {/* Recent trade indicator */}
      {flash && recentTrade && (
        <div className="absolute -top-1 -right-1">
          <Zap className={`w-3 h-3 ${recentTrade.side === 'buy' ? 'text-green-400' : 'text-red-400'} animate-bounce`} />
        </div>
      )}
    </button>
  );
}

function GroupColumn({ groupName }: { groupName: BotGroupName }) {
  const bots = useArenaStore(state => state.bots.filter(b => b.groupName === groupName));
  const entries = useArenaStore(state => state.leaderboard.filter(e => e.groupName === groupName));
  const { activityFeed } = useArenaStore();
  const config = GROUP_CONFIG[groupName];

  const entryMap = new Map(entries.map(e => [e.botId, e]));

  // Get most recent trade per bot (within last 5 seconds)
  const recentTrades = new Map<string, ArenaBotTradeEvent>();
  const now = Date.now();
  for (const event of activityFeed) {
    if (event.groupName === groupName && !recentTrades.has(event.botId)) {
      if (now - new Date(event.timestamp).getTime() < 5000) {
        recentTrades.set(event.botId, event);
      }
    }
  }

  const avgPnL = entries.length > 0
    ? entries.reduce((s, e) => s + e.totalPnLPercent, 0) / entries.length : 0;

  return (
    <div className="space-y-2">
      {/* Group header */}
      <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg border ${config.border} bg-gray-900/40`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.bg}`} />
          <span className={`text-xs font-bold ${config.accent}`}>{groupName}</span>
          <span className="text-[10px] text-gray-500">{config.label}</span>
        </div>
        <span className={`text-[10px] font-mono ${avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {avgPnL >= 0 ? '+' : ''}{avgPnL.toFixed(1)}%
        </span>
      </div>

      {/* Bot cells */}
      <div className="grid grid-cols-1 gap-1.5">
        {bots.map(bot => (
          <BotCell
            key={bot.id}
            bot={bot}
            entry={entryMap.get(bot.id)}
            recentTrade={recentTrades.get(bot.id)}
            groupConfig={config}
          />
        ))}
      </div>
    </div>
  );
}

export function BattleGrid() {
  const { tournament } = useArenaStore();
  const isRunning = tournament?.status === 'running';

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Battle Grid</span>
          <span className="text-xs text-gray-500">21 Bots</span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">LIVE</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['Alpha', 'Beta', 'Gamma'] as BotGroupName[]).map(name => (
          <GroupColumn key={name} groupName={name} />
        ))}
      </div>
    </div>
  );
}
