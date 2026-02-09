'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { getTrades } from '@/services/api';
import { formatCurrency, formatTime, cn, getSideColor } from '@/lib/utils';
import { History } from 'lucide-react';

export function TradeHistory() {
  const { trades, setTrades, selectedSymbol } = useTradingStore();

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const data = await getTrades(undefined, 50);
        setTrades(data);
      } catch (error) {
        console.error('Failed to load trades:', error);
      }
    };

    loadTrades();
  }, []);

  const filteredTrades = trades.filter((t) => !selectedSymbol || t.symbol === selectedSymbol);

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <History className="w-4 h-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-white">Trade History</h3>
      </div>

      <div className="overflow-x-auto flex-1">
        {filteredTrades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No trades yet
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800 sticky top-0 bg-[#0f0f0f]">
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-4 py-2 font-medium">Symbol</th>
                <th className="text-left px-4 py-2 font-medium">Side</th>
                <th className="text-right px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 text-sm"
                >
                  <td className="px-4 py-2 text-gray-400">{formatTime(trade.timestamp)}</td>
                  <td className="px-4 py-2 text-white font-medium">{trade.symbol}</td>
                  <td className={cn('px-4 py-2 uppercase font-medium', getSideColor(trade.side))}>
                    {trade.side}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">{trade.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-300">
                    {formatCurrency(trade.price)}
                  </td>
                  <td className="px-4 py-2 text-right text-white">
                    {formatCurrency(trade.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
