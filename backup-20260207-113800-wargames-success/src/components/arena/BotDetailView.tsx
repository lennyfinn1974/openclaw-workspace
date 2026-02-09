'use client';

import { useEffect, useState } from 'react';
import { useArenaStore, selectBotById } from '@/stores/arenaStore';
import { DNAVisualization } from './DNAVisualization';
import { getBotPortfolio, getBotTrades, getBotDNAHistory } from '@/services/arenaApi';
import type { BotPortfolio, BotTrade } from '@/types/arena';
import { ArrowLeft, Wallet, History, Dna, TrendingUp, TrendingDown } from 'lucide-react';

export function BotDetailView() {
  const { selectedBotId, setView, setSelectedBotId } = useArenaStore();
  const bot = useArenaStore(state => state.bots.find(b => b.id === selectedBotId));
  const leaderboardEntry = useArenaStore(state => state.leaderboard.find(e => e.botId === selectedBotId));

  const [portfolio, setPortfolio] = useState<BotPortfolio | null>(null);
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [tab, setTab] = useState<'dna' | 'trades' | 'portfolio'>('dna');

  useEffect(() => {
    if (!selectedBotId) return;
    getBotPortfolio(selectedBotId).then(setPortfolio).catch(() => {});
    getBotTrades(selectedBotId, 100).then(setTrades).catch(() => {});
  }, [selectedBotId]);

  if (!bot) return null;

  const handleBack = () => {
    setSelectedBotId(null);
    setView('dashboard');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleBack} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">{bot.name}</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{bot.groupName} Group</span>
            <span>|</span>
            <span>{bot.symbol}</span>
            <span>|</span>
            <span>Gen {bot.generation}</span>
          </div>
        </div>

        {leaderboardEntry && (
          <div className="ml-auto flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500">Rank</div>
              <div className="text-lg font-bold text-amber-400">#{leaderboardEntry.rank}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">P&L</div>
              <div className={`text-lg font-bold ${leaderboardEntry.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {leaderboardEntry.totalPnLPercent >= 0 ? '+' : ''}{leaderboardEntry.totalPnLPercent.toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Fitness</div>
              <div className="text-lg font-bold text-purple-400">{(leaderboardEntry.fitness * 100).toFixed(0)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {([
          { key: 'dna', label: 'DNA', icon: Dna },
          { key: 'trades', label: 'Trades', icon: History },
          { key: 'portfolio', label: 'Portfolio', icon: Wallet },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key ? 'text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'dna' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DNAVisualization dna={bot.dna} label="Entry Signal Weights" />
          <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 p-4">
            <div className="text-xs font-bold text-white mb-3">Key Parameters</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'RSI Period', value: Math.round(bot.dna.indicatorParams.rsiPeriod) },
                { label: 'MACD Fast/Slow', value: `${Math.round(bot.dna.indicatorParams.macdFast)}/${Math.round(bot.dna.indicatorParams.macdSlow)}` },
                { label: 'Risk/Trade', value: `${(bot.dna.positionSizing.riskPerTrade * 100).toFixed(1)}%` },
                { label: 'Max Position', value: `${(bot.dna.positionSizing.maxPositionPercent * 100).toFixed(0)}%` },
                { label: 'Stop Loss ATR', value: bot.dna.exitStrategy.stopLossAtr.toFixed(1) },
                { label: 'Take Profit ATR', value: bot.dna.exitStrategy.takeProfitAtr.toFixed(1) },
                { label: 'Trend Bias', value: bot.dna.regimeFilter.trendFollowBias.toFixed(2) },
                { label: 'Decision Interval', value: `${(bot.dna.timing.decisionIntervalMs / 1000).toFixed(0)}s` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between bg-gray-800/50 rounded px-2 py-1.5">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-200 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'trades' && (
        <div className="bg-[#0f0f0f] rounded-xl border border-gray-800 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f0f0f]">
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left px-3 py-2">Time</th>
                  <th className="text-left px-3 py-2">Side</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Price</th>
                  <th className="text-right px-3 py-2">P&L</th>
                  <th className="text-left px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr key={trade.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-gray-400">
                      {new Date(trade.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                    </td>
                    <td className={`px-3 py-2 ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.side.toUpperCase()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 font-mono">{trade.quantity.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-300 font-mono">${trade.price.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${trade.pnl > 0 ? 'text-green-400' : trade.pnl < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {trade.pnl !== 0 ? `${trade.pnl > 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">{trade.reason}</td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">No trades yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'portfolio' && portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Cash', value: `$${portfolio.cash.toFixed(2)}`, color: 'text-white' },
            { label: 'Total Value', value: `$${portfolio.totalValue.toFixed(2)}`, color: 'text-white' },
            { label: 'Total P&L', value: `$${portfolio.totalPnL.toFixed(2)}`, color: portfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'P&L %', value: `${portfolio.totalPnLPercent >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(2)}%`, color: portfolio.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0f0f0f] rounded-xl border border-gray-800 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'portfolio' && !portfolio && (
        <div className="text-center py-8 text-gray-500 text-sm">No portfolio data. Start a tournament first.</div>
      )}
    </div>
  );
}
