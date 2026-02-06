'use client';

import { useTradingStore } from '@/stores/tradingStore';
import { formatCurrency, formatPercent, formatNumber, cn, getPnLColor } from '@/lib/utils';
import { Package } from 'lucide-react';

export function PositionsTable() {
  const { positions, setSelectedSymbol } = useTradingStore();

  if (positions.length === 0) {
    return (
      <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 p-6">
        <div className="flex flex-col items-center justify-center text-gray-500">
          <Package className="w-12 h-12 mb-2" />
          <p>No open positions</p>
        </div>
      </div>
    );
  }

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Positions</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Total: <span className="text-white">{formatCurrency(totalValue)}</span>
          </span>
          <span className="text-gray-400">
            P&L: <span className={getPnLColor(totalUnrealized)}>{formatCurrency(totalUnrealized)}</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left px-4 py-3 font-medium">Symbol</th>
              <th className="text-right px-4 py-3 font-medium">Qty</th>
              <th className="text-right px-4 py-3 font-medium">Avg Cost</th>
              <th className="text-right px-4 py-3 font-medium">Current</th>
              <th className="text-right px-4 py-3 font-medium">Mkt Value</th>
              <th className="text-right px-4 py-3 font-medium">P&L</th>
              <th className="text-right px-4 py-3 font-medium">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr
                key={position.symbol}
                onClick={() => setSelectedSymbol(position.symbol)}
                className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-white">{position.symbol}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {formatNumber(position.quantity, 0)}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {formatCurrency(position.avgCost)}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {formatCurrency(position.currentPrice)}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  {formatCurrency(position.marketValue)}
                </td>
                <td className={cn('px-4 py-3 text-right', getPnLColor(position.unrealizedPnL))}>
                  {formatCurrency(position.unrealizedPnL)}
                </td>
                <td className={cn('px-4 py-3 text-right', getPnLColor(position.unrealizedPnLPercent))}>
                  {formatPercent(position.unrealizedPnLPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
