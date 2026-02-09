'use client';

import { useEffect, useRef, useState } from 'react';
import { useArenaStore } from '@/stores/arenaStore';
import type { Bot, LeaderboardEntry } from '@/types/arena';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface BotCardProps {
  bot: Bot;
  entry?: LeaderboardEntry;
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const h = 16;
  const w = 48;
  const step = w / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BotCard({ bot, entry }: BotCardProps) {
  const setSelectedBotId = useArenaStore(s => s.setSelectedBotId);
  const activityFeed = useArenaStore(s => s.activityFeed);
  const tournament = useArenaStore(s => s.tournament);

  const pnl = entry?.totalPnLPercent || 0;
  const rank = entry?.rank;
  const fitness = entry?.fitness ?? 0;

  // Track P&L history for sparkline
  const pnlHistoryRef = useRef<number[]>([0]);
  useEffect(() => {
    if (entry) {
      const history = pnlHistoryRef.current;
      if (history[history.length - 1] !== entry.totalPnLPercent) {
        history.push(entry.totalPnLPercent);
        if (history.length > 12) history.shift();
      }
    }
  }, [entry?.totalPnLPercent]);

  // Detect recent trade for flash animation
  const [flashClass, setFlashClass] = useState('');
  const lastTradeRef = useRef<string | null>(null);
  useEffect(() => {
    const recentTrade = activityFeed.find(e => e.botId === bot.id);
    if (recentTrade && recentTrade.timestamp !== lastTradeRef.current) {
      lastTradeRef.current = recentTrade.timestamp;
      setFlashClass(recentTrade.side === 'buy' ? 'animate-trade-buy' : 'animate-trade-sell');
      const t = setTimeout(() => setFlashClass(''), 800);
      return () => clearTimeout(t);
    }
  }, [activityFeed, bot.id]);

  const rankColor = rank === 1 ? 'text-amber-400 animate-crown-shimmer'
    : rank === 2 ? 'text-gray-300'
    : rank === 3 ? 'text-amber-700'
    : 'text-gray-500';

  const pnlColor = pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-400';
  const sparkColor = pnl >= 0 ? '#22c55e' : '#ef4444';
  const isLive = tournament?.status === 'running';

  return (
    <button
      onClick={() => setSelectedBotId(bot.id)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all text-left group ${flashClass}`}
    >
      {rank && (
        <span className={`text-xs font-bold w-5 text-center ${rankColor}`}>
          #{rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-white truncate">{bot.name}</span>
          {isLive && (
            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        <div className="text-[10px] text-gray-500">{bot.symbol}</div>
      </div>

      {/* Sparkline */}
      <MiniSparkline values={pnlHistoryRef.current} color={sparkColor} />

      {/* P&L + fitness */}
      <div className="text-right">
        <div className={`text-xs font-mono font-medium ${pnlColor} flex items-center justify-end gap-0.5`}>
          {pnl > 0 ? <TrendingUp className="w-3 h-3" /> :
           pnl < 0 ? <TrendingDown className="w-3 h-3" /> :
           <Minus className="w-3 h-3" />}
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
        </div>
        {/* Micro fitness bar */}
        <div className="w-12 h-1 bg-gray-700 rounded-full mt-0.5 overflow-hidden">
          <div
            className="h-full bg-purple-500/70 rounded-full animate-fitness-fill"
            style={{ width: `${fitness * 100}%` }}
          />
        </div>
      </div>
    </button>
  );
}
