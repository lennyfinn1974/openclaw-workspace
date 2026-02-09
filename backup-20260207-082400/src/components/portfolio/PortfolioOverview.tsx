'use client';

import { useTradingStore } from '@/stores/tradingStore';
import { formatCurrency, formatPercent, cn, getPnLColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Wallet, PieChart } from 'lucide-react';

export function PortfolioOverview() {
  const { portfolio, positions, marketSession, killZone } = useTradingStore();

  if (!portfolio) {
    return (
      <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-800 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Value',
      value: formatCurrency(portfolio.totalValue),
      icon: DollarSign,
      color: 'text-white',
    },
    {
      label: 'Cash',
      value: formatCurrency(portfolio.cash),
      icon: Wallet,
      color: 'text-blue-400',
    },
    {
      label: 'Day P&L',
      value: `${formatCurrency(portfolio.dayPnL)} (${formatPercent(portfolio.dayPnLPercent)})`,
      icon: portfolio.dayPnL >= 0 ? TrendingUp : TrendingDown,
      color: getPnLColor(portfolio.dayPnL),
    },
    {
      label: 'Total P&L',
      value: `${formatCurrency(portfolio.totalPnL)} (${formatPercent(portfolio.totalPnLPercent)})`,
      icon: portfolio.totalPnL >= 0 ? TrendingUp : TrendingDown,
      color: getPnLColor(portfolio.totalPnL),
    },
  ];

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 p-4">
      {/* Header with Market Session */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Portfolio</h3>
        <div className="flex items-center gap-3">
          {/* Kill Zone Indicator */}
          {killZone.active && (
            <span className="px-2 py-1 text-xs font-medium bg-orange-600/20 text-orange-400 rounded">
              {killZone.zone} Kill Zone
            </span>
          )}
          {/* Market Session */}
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded',
              marketSession === 'regular'
                ? 'bg-green-600/20 text-green-400'
                : marketSession === 'pre_market'
                ? 'bg-yellow-600/20 text-yellow-400'
                : marketSession === 'after_hours'
                ? 'bg-purple-600/20 text-purple-400'
                : 'bg-gray-600/20 text-gray-400'
            )}
          >
            {marketSession === 'regular'
              ? 'Market Open'
              : marketSession === 'pre_market'
              ? 'Pre-Market'
              : marketSession === 'after_hours'
              ? 'After Hours'
              : 'Market Closed'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-900/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <stat.icon className="w-4 h-4" />
              {stat.label}
            </div>
            <div className={cn('text-lg font-semibold', stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Position Summary */}
      {positions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <PieChart className="w-4 h-4" />
            Positions ({positions.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {positions.slice(0, 6).map((pos) => (
              <div
                key={pos.symbol}
                className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1"
              >
                <span className="text-sm font-medium text-white">{pos.symbol}</span>
                <span className={cn('text-xs', getPnLColor(pos.unrealizedPnL))}>
                  {formatPercent(pos.unrealizedPnLPercent)}
                </span>
              </div>
            ))}
            {positions.length > 6 && (
              <span className="text-sm text-gray-500">+{positions.length - 6} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
