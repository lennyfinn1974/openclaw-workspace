'use client';

import { useEffect, useState } from 'react';
import { useTradingStore, selectCurrentQuote } from '@/stores/tradingStore';
import { getOrderBook } from '@/services/api';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import type { OrderBook as OrderBookType } from '@/types/trading';

export function OrderBook() {
  const { selectedSymbol, updateOrderBook } = useTradingStore();
  const quote = useTradingStore(selectCurrentQuote);
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchOrderBook = async () => {
      setIsLoading(true);
      try {
        const data = await getOrderBook(selectedSymbol, 10);
        setOrderBook(data);
        updateOrderBook(selectedSymbol, data);
      } catch (error) {
        console.error('Failed to fetch order book:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 500);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const maxSize = Math.max(
    ...(orderBook?.bids.map((b) => b.size) || [0]),
    ...(orderBook?.asks.map((a) => a.size) || [0])
  );

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Order Book</h3>
          {orderBook && (
            <div className="text-xs text-gray-400">
              Spread: {formatCurrency(orderBook.spread)} ({orderBook.spreadPercent.toFixed(3)}%)
            </div>
          )}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading && !orderBook ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : (
          <>
            {/* Asks (Sells) - Reversed to show lowest at bottom */}
            <div className="flex-1 overflow-y-auto flex flex-col-reverse">
              {orderBook?.asks.slice().reverse().map((level, idx) => {
                const sizePercent = (level.size / maxSize) * 100;
                let cumulative = 0;
                for (let i = 0; i <= idx; i++) {
                  cumulative += orderBook.asks[orderBook.asks.length - 1 - i]?.size || 0;
                }

                return (
                  <div
                    key={`ask-${idx}`}
                    className="grid grid-cols-3 px-4 py-1 text-sm relative hover:bg-gray-800/50"
                  >
                    <div
                      className="absolute inset-0 bg-red-500/10"
                      style={{ width: `${sizePercent}%`, right: 0, left: 'auto' }}
                    />
                    <div className="text-red-400 relative z-10">
                      {formatCurrency(level.price)}
                    </div>
                    <div className="text-right text-gray-300 relative z-10">
                      {formatNumber(level.size, 0)}
                    </div>
                    <div className="text-right text-gray-500 relative z-10">
                      {formatNumber(cumulative, 0)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Spread / Last Price */}
            <div className="px-4 py-2 bg-gray-900/50 border-y border-gray-800">
              <div className="flex items-center justify-center gap-4">
                <span
                  className={cn(
                    'text-xl font-semibold',
                    quote && quote.change >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {formatCurrency(quote?.last || 0)}
                </span>
                {quote && (
                  <span
                    className={cn(
                      'text-sm',
                      quote.change >= 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {quote.change >= 0 ? '+' : ''}
                    {formatCurrency(quote.change)} ({quote.changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>

            {/* Bids (Buys) */}
            <div className="flex-1 overflow-y-auto">
              {orderBook?.bids.map((level, idx) => {
                const sizePercent = (level.size / maxSize) * 100;
                let cumulative = 0;
                for (let i = 0; i <= idx; i++) {
                  cumulative += orderBook.bids[i]?.size || 0;
                }

                return (
                  <div
                    key={`bid-${idx}`}
                    className="grid grid-cols-3 px-4 py-1 text-sm relative hover:bg-gray-800/50"
                  >
                    <div
                      className="absolute inset-0 bg-green-500/10"
                      style={{ width: `${sizePercent}%`, right: 0, left: 'auto' }}
                    />
                    <div className="text-green-400 relative z-10">
                      {formatCurrency(level.price)}
                    </div>
                    <div className="text-right text-gray-300 relative z-10">
                      {formatNumber(level.size, 0)}
                    </div>
                    <div className="text-right text-gray-500 relative z-10">
                      {formatNumber(cumulative, 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
