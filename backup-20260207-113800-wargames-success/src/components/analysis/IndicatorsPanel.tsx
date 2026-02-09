'use client';

import { useEffect, useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { getIndicators, getQullaSetups } from '@/services/api';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { Activity, TrendingUp, BarChart3, Target } from 'lucide-react';
import type { RSI, MACD, MovingAverage, QullamagieSetup } from '@/types/trading';

export function IndicatorsPanel() {
  const { selectedSymbol, selectedTimeframe, setIndicators, setQullaSetups, qullaSetups } =
    useTradingStore();
  const [rsi, setRsi] = useState<RSI | null>(null);
  const [macd, setMacd] = useState<MACD | null>(null);
  const [ma, setMa] = useState<{ sma: MovingAverage[]; ema: MovingAverage[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadIndicators = async () => {
      setIsLoading(true);
      try {
        const [indicatorData, setupData] = await Promise.all([
          getIndicators(selectedSymbol, selectedTimeframe),
          getQullaSetups(selectedSymbol).catch(() => []),
        ]);

        setRsi(indicatorData.rsi);
        setMacd(indicatorData.macd);
        setMa(indicatorData.movingAverages);
        setIndicators({
          rsi: indicatorData.rsi,
          macd: indicatorData.macd,
          sma: indicatorData.movingAverages.sma,
          ema: indicatorData.movingAverages.ema,
        });
        setQullaSetups(setupData);
      } catch (error) {
        console.error('Failed to load indicators:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadIndicators();
    const interval = setInterval(loadIndicators, 5000);
    return () => clearInterval(interval);
  }, [selectedSymbol, selectedTimeframe]);

  const getRsiColor = (value: number) => {
    if (value >= 70) return 'text-red-400';
    if (value <= 30) return 'text-green-400';
    return 'text-gray-300';
  };

  const getRsiSignal = (rsi: RSI) => {
    if (rsi.overbought) return { text: 'Overbought', color: 'text-red-400 bg-red-600/20' };
    if (rsi.oversold) return { text: 'Oversold', color: 'text-green-400 bg-green-600/20' };
    return { text: 'Neutral', color: 'text-gray-400 bg-gray-600/20' };
  };

  const getMacdSignal = (macd: MACD) => {
    if (macd.crossover === 'bullish') return { text: 'Bullish Cross', color: 'text-green-400' };
    if (macd.crossover === 'bearish') return { text: 'Bearish Cross', color: 'text-red-400' };
    if (macd.histogram > 0) return { text: 'Bullish', color: 'text-green-400' };
    return { text: 'Bearish', color: 'text-red-400' };
  };

  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-indigo-400" />
        <h3 className="text-lg font-semibold text-white">Technical Indicators</h3>
      </div>

      {isLoading && !rsi ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* RSI */}
          {rsi && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">RSI (14)</span>
                <span className={cn('text-xs px-2 py-0.5 rounded', getRsiSignal(rsi).color)}>
                  {getRsiSignal(rsi).text}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn('text-2xl font-bold', getRsiColor(rsi.value))}>
                  {rsi.value.toFixed(1)}
                </span>
                {/* RSI Gauge */}
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      rsi.value >= 70
                        ? 'bg-red-500'
                        : rsi.value <= 30
                        ? 'bg-green-500'
                        : 'bg-indigo-500'
                    )}
                    style={{ width: `${rsi.value}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Oversold (30)</span>
                <span>Overbought (70)</span>
              </div>
            </div>
          )}

          {/* MACD */}
          {macd && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">MACD (12,26,9)</span>
                <span className={cn('text-xs font-medium', getMacdSignal(macd).color)}>
                  {getMacdSignal(macd).text}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">MACD</div>
                  <div className={macd.macd >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {macd.macd.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Signal</div>
                  <div className="text-gray-300">{macd.signal.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Histogram</div>
                  <div className={macd.histogram >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {macd.histogram.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Moving Averages */}
          {ma && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Moving Averages</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {ma.ema.slice(0, 4).map((ema) => (
                  <div key={`ema-${ema.period}`} className="flex justify-between">
                    <span className="text-gray-500">EMA {ema.period}</span>
                    <span className="text-gray-300">{formatCurrency(ema.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Qullamaggie Setups */}
          {qullaSetups.length > 0 && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Qullamaggie Setups</span>
              </div>
              <div className="space-y-2">
                {qullaSetups.map((setup) => (
                  <div
                    key={setup.id}
                    className="p-2 bg-gray-800/50 rounded text-sm border-l-2 border-yellow-500"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium capitalize">
                        {setup.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-yellow-400">Score: {setup.score}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="text-gray-500">
                        Pivot: <span className="text-gray-300">{formatCurrency(setup.pivotPrice)}</span>
                      </div>
                      <div className="text-gray-500">
                        Stop: <span className="text-red-400">{formatCurrency(setup.stopLoss)}</span>
                      </div>
                      <div className="text-gray-500">
                        Risk: <span className="text-yellow-400">{setup.riskPercent}%</span>
                      </div>
                      <div className="text-gray-500">
                        Vol Ratio: <span className="text-gray-300">{setup.volumeRatio.toFixed(1)}x</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
