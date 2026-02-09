'use client';

import { useTradingStore } from '@/stores/tradingStore';
import { formatCurrency, formatPercent, cn, getPnLColor } from '@/lib/utils';
import { Star, Plus, X } from 'lucide-react';
import { useState } from 'react';

export function Watchlist() {
  const { watchlist, setWatchlist, quotes, selectedSymbol, setSelectedSymbol } = useTradingStore();
  const [showAddInput, setShowAddInput] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');

  const handleAddSymbol = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (symbol && !watchlist.includes(symbol)) {
      setWatchlist([...watchlist, symbol]);
    }
    setNewSymbol('');
    setShowAddInput(false);
  };

  const handleRemoveSymbol = (symbol: string) => {
    setWatchlist(watchlist.filter((s) => s !== symbol));
  };

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <h3 className="text-lg font-semibold text-white">Watchlist</h3>
        </div>
        <button
          onClick={() => setShowAddInput(!showAddInput)}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showAddInput && (
        <div className="px-4 py-2 border-b border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
              placeholder="Symbol..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              autoFocus
            />
            <button
              onClick={handleAddSymbol}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Column Headers */}
      <div className="grid grid-cols-4 px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
        <div>Symbol</div>
        <div className="text-right">Price</div>
        <div className="text-right">Change</div>
        <div className="text-right">%</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {watchlist.map((symbol) => {
          const quote = quotes.get(symbol);
          const isSelected = selectedSymbol === symbol;

          return (
            <div
              key={symbol}
              onClick={() => setSelectedSymbol(symbol)}
              className={cn(
                'grid grid-cols-4 px-4 py-2 text-sm cursor-pointer transition-colors group',
                isSelected ? 'bg-indigo-600/20' : 'hover:bg-gray-800/50'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', isSelected ? 'text-indigo-400' : 'text-white')}>
                  {symbol}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSymbol(symbol);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="text-right text-gray-300">
                {quote ? formatCurrency(quote.last) : '—'}
              </div>
              <div className={cn('text-right', getPnLColor(quote?.change || 0))}>
                {quote ? formatCurrency(quote.change) : '—'}
              </div>
              <div className={cn('text-right', getPnLColor(quote?.changePercent || 0))}>
                {quote ? formatPercent(quote.changePercent) : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
