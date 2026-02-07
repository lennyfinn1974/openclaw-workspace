'use client';

import { useArenaStore } from '@/stores/arenaStore';
import type { ArenaBotTradeEvent } from '@/types/arena';
import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function ArenaActivityFeed() {
  const { activityFeed } = useArenaStore();

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <Activity className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-bold text-white">Live Activity</span>
        <span className="text-xs text-gray-500 ml-auto">{activityFeed.length} trades</span>
      </div>

      <div className="h-[300px] overflow-y-auto">
        {activityFeed.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Waiting for trades...
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {activityFeed.slice(0, 50).map((event, i) => (
              <TradeEvent key={`${event.botId}-${event.timestamp}-${i}`} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeEvent({ event }: { event: ArenaBotTradeEvent }) {
  const isBuy = event.side === 'buy';
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="px-3 py-2 hover:bg-gray-800/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBuy ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className="text-xs font-medium text-white">{event.botName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isBuy ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {event.side.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">{event.symbol}</span>
        </div>
        <span className="text-[10px] text-gray-500">{time}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-500 truncate max-w-[200px]">{event.reason}</span>
        {event.pnl !== 0 && (
          <span className={`text-[10px] font-mono ${event.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {event.pnl > 0 ? '+' : ''}${event.pnl.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
