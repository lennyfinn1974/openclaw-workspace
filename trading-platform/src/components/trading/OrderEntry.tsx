'use client';

import { useState, useEffect } from 'react';
import { useTradingStore, selectCurrentQuote } from '@/stores/tradingStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { calculatePositionSize } from '@/services/api';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import type { OrderSide, OrderType } from '@/types/trading';

export function OrderEntry() {
  const { selectedSymbol, portfolio } = useTradingStore();
  const quote = useTradingStore(selectCurrentQuote);
  const { placeOrder: wsPlaceOrder } = useWebSocket();

  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('0.5');
  const [stopLoss, setStopLoss] = useState('');
  const [positionCalc, setPositionCalc] = useState<{
    shares: number;
    positionValue: number;
    riskAmount: number;
    maxLoss: number;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill price from quote
  useEffect(() => {
    if (quote && orderType !== 'market') {
      setPrice(side === 'buy' ? quote.ask.toString() : quote.bid.toString());
    }
  }, [quote, side, orderType]);

  // Calculate position size when parameters change
  useEffect(() => {
    const calcPosition = async () => {
      if (!portfolio || !quote || !stopLoss || !riskPercent) {
        setPositionCalc(null);
        return;
      }

      const entryPrice = orderType === 'market' ? quote.last : parseFloat(price);
      const stopLossPrice = parseFloat(stopLoss);

      if (!entryPrice || !stopLossPrice || entryPrice === stopLossPrice) {
        setPositionCalc(null);
        return;
      }

      try {
        const calc = await calculatePositionSize({
          portfolioValue: portfolio.totalValue,
          riskPercent: parseFloat(riskPercent),
          entryPrice,
          stopLoss: stopLossPrice,
        });
        setPositionCalc(calc);
        setQuantity(calc.shares.toString());
      } catch (err) {
        console.error('Position size calculation failed:', err);
      }
    };

    calcPosition();
  }, [portfolio, quote, stopLoss, riskPercent, orderType, price]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const orderParams = {
        symbol: selectedSymbol,
        side,
        type: orderType,
        quantity: parseInt(quantity, 10),
        price: orderType === 'limit' || orderType === 'stop_limit' ? parseFloat(price) : undefined,
        stopPrice: orderType === 'stop' || orderType === 'stop_limit' ? parseFloat(stopPrice) : undefined,
      };

      const result = await wsPlaceOrder(orderParams);

      if (!result.success) {
        setError(result.error || 'Order placement failed');
      } else {
        // Reset form
        setQuantity('');
        setStopLoss('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedCost = () => {
    const qty = parseInt(quantity, 10) || 0;
    const p = orderType === 'market' ? quote?.last || 0 : parseFloat(price) || 0;
    return qty * p;
  };

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Order Entry</h3>

      {/* Side Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSide('buy')}
          className={cn(
            'flex-1 py-2 rounded font-semibold transition-colors',
            side === 'buy'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          )}
        >
          BUY
        </button>
        <button
          onClick={() => setSide('sell')}
          className={cn(
            'flex-1 py-2 rounded font-semibold transition-colors',
            side === 'sell'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          )}
        >
          SELL
        </button>
      </div>

      {/* Order Type */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Order Type</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as OrderType)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
          <option value="stop_limit">Stop Limit</option>
        </select>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Price Input (for limit orders) */}
        {(orderType === 'limit' || orderType === 'stop_limit') && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Limit Price</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              placeholder="0.00"
            />
          </div>
        )}

        {/* Stop Price (for stop orders) */}
        {(orderType === 'stop' || orderType === 'stop_limit') && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Stop Price</label>
            <input
              type="number"
              step="0.01"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              placeholder="0.00"
            />
          </div>
        )}

        {/* Position Sizing Section */}
        <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-800">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Position Sizing Calculator</h4>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Risk %</label>
              <select
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              >
                <option value="0.25">0.25%</option>
                <option value="0.3">0.30%</option>
                <option value="0.5">0.50%</option>
                <option value="0.75">0.75%</option>
                <option value="1.0">1.00%</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stop Loss</label>
              <input
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                placeholder="Stop price"
              />
            </div>
          </div>

          {positionCalc && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-500">Suggested Shares:</div>
              <div className="text-white font-medium">{positionCalc.shares}</div>
              <div className="text-gray-500">Position Value:</div>
              <div className="text-white">{formatCurrency(positionCalc.positionValue)}</div>
              <div className="text-gray-500">Risk Amount:</div>
              <div className="text-yellow-500">{formatCurrency(positionCalc.riskAmount)}</div>
              <div className="text-gray-500">Max Loss:</div>
              <div className="text-red-500">{formatCurrency(positionCalc.maxLoss)}</div>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
            placeholder="0"
            min="1"
            required
          />
        </div>

        {/* Order Summary */}
        <div className="mb-4 p-3 bg-gray-900 rounded">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Market Price:</span>
            <span className="text-white">{formatCurrency(quote?.last || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Estimated {side === 'buy' ? 'Cost' : 'Proceeds'}:</span>
            <span className="text-white">{formatCurrency(estimatedCost())}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Buying Power:</span>
            <span className="text-white">{formatCurrency(portfolio?.buyingPower || 0)}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !quantity}
          className={cn(
            'w-full py-3 rounded font-semibold transition-colors',
            side === 'buy'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white',
            (isSubmitting || !quantity) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isSubmitting ? 'Placing Order...' : `${side.toUpperCase()} ${selectedSymbol}`}
        </button>
      </form>
    </div>
  );
}
