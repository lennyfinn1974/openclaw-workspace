'use client';

import { useEffect, useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getPortfolio, getPositions, getMarketSession, getQuotes } from '@/services/api';
import { TradingChart } from '@/components/charts/TradingChart';
import { OrderEntry } from '@/components/trading/OrderEntry';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { OrderBook } from '@/components/orderbook/OrderBook';
import { Watchlist } from '@/components/common/Watchlist';
import { TradeHistory } from '@/components/trading/TradeHistory';
import { OrdersTable } from '@/components/trading/OrdersTable';
import { IndicatorsPanel } from '@/components/analysis/IndicatorsPanel';
import {
  Activity,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

export default function TradingPlatform() {
  const {
    setPortfolio,
    setPositions,
    setMarketSession,
    setKillZone,
    updateQuote,
    isConnected,
    positions,
    setSelectedSymbol,
  } = useTradingStore();

  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'trades'>('positions');

  // Initialize WebSocket connection
  useWebSocket();

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [portfolio, positionsData, session, quotes] = await Promise.all([
          getPortfolio(),
          getPositions(),
          getMarketSession(),
          getQuotes(),
        ]);

        setPortfolio(portfolio);
        setPositions(positionsData);
        setMarketSession(session.session as 'regular' | 'pre_market' | 'after_hours' | 'closed');
        setKillZone(session.killZone);
        quotes.forEach((q) => updateQuote(q));
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();

    // Refresh market session every minute
    const interval = setInterval(async () => {
      try {
        const session = await getMarketSession();
        setMarketSession(session.session as 'regular' | 'pre_market' | 'after_hours' | 'closed');
        setKillZone(session.killZone);
      } catch (error) {
        console.error('Failed to update market session:', error);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="bg-[#0f0f0f] border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-500" />
              <h1 className="text-xl font-bold">TradeSim Pro</h1>
            </div>
            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-800 rounded">
              Paper Trading
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-500">Disconnected</span>
                </>
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {/* Portfolio Overview */}
        <div className="mb-4">
          <PortfolioOverview />
        </div>

        {/* Main Trading Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Sidebar - Watchlist */}
          <div className="col-span-12 lg:col-span-2 h-[600px]">
            <Watchlist />
          </div>

          {/* Center - Chart */}
          <div className="col-span-12 lg:col-span-6 h-[600px]">
            <TradingChart />
          </div>

          {/* Right Side - Order Book + Order Entry */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="h-[300px]">
              <OrderBook />
            </div>
            <OrderEntry />
          </div>
        </div>

        {/* Bottom Section - Indicators + Tables */}
        <div className="grid grid-cols-12 gap-4 mt-4">
          {/* Indicators Panel */}
          <div className="col-span-12 lg:col-span-3">
            <IndicatorsPanel />
          </div>

          {/* Positions/Orders/Trades Tabs */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-[#0f0f0f] rounded-lg border border-gray-800">
              {/* Tab Header */}
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab('positions')}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'positions'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Positions
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'orders'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Orders
                </button>
                <button
                  onClick={() => setActiveTab('trades')}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'trades'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Trade History
                </button>
              </div>

              {/* Tab Content */}
              <div className="h-[300px] overflow-hidden">
                {activeTab === 'positions' && (
                  <PositionsTableInner positions={positions} setSelectedSymbol={setSelectedSymbol} />
                )}
                {activeTab === 'orders' && <OrdersTable />}
                {activeTab === 'trades' && <TradeHistory />}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0f0f0f] border-t border-gray-800 px-4 py-2 mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>TradeSim Pro - Paper Trading Platform</span>
          <span>Data simulated for educational purposes only</span>
        </div>
      </footer>
    </div>
  );
}

// Inner positions table without the card wrapper for tabs
function PositionsTableInner({
  positions,
  setSelectedSymbol
}: {
  positions: {
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number
  }[];
  setSelectedSymbol: (symbol: string) => void;
}) {
  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No open positions
      </div>
    );
  }

  return (
    <div className="overflow-x-auto h-full">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800 sticky top-0 bg-[#0f0f0f]">
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
              className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors text-sm"
            >
              <td className="px-4 py-3">
                <span className="font-medium text-white">{position.symbol}</span>
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{position.quantity}</td>
              <td className="px-4 py-3 text-right text-gray-300">
                ${position.avgCost.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                ${position.currentPrice.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-white">
                ${position.marketValue.toFixed(2)}
              </td>
              <td
                className={`px-4 py-3 text-right ${
                  position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                ${position.unrealizedPnL.toFixed(2)}
              </td>
              <td
                className={`px-4 py-3 text-right ${
                  position.unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {position.unrealizedPnLPercent >= 0 ? '+' : ''}
                {position.unrealizedPnLPercent.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
