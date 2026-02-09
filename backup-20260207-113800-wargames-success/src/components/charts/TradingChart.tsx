'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, LineStyle, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { useShallow } from 'zustand/react/shallow';
import { useTradingStore } from '@/stores/tradingStore';
import { getCandles, getIctAnalysis } from '@/services/api';
import type { Timeframe, OrderBlock, FairValueGap, OHLCV } from '@/types/trading';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '1D', value: '1d' },
];

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const {
    selectedSymbol,
    selectedTimeframe,
    setSelectedTimeframe,
    updateCandles,
    ictAnalysis,
    setIctAnalysis,
  } = useTradingStore();

  // Use memoized selector to prevent infinite re-renders
  const candles = useTradingStore(
    useShallow((state) => {
      const symbolCandles = state.candles.get(state.selectedSymbol);
      return symbolCandles?.get(state.selectedTimeframe) ?? [];
    })
  );

  const [showOrderBlocks, setShowOrderBlocks] = useState(true);
  const [showFVGs, setShowFVGs] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0f0f0f' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Volume series (v5 API)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6366f1',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Load candles when symbol/timeframe changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [candleData, ictData] = await Promise.all([
          getCandles(selectedSymbol, selectedTimeframe),
          getIctAnalysis(selectedSymbol, selectedTimeframe).catch(() => null),
        ]);

        updateCandles(selectedSymbol, selectedTimeframe, candleData);
        if (ictData) {
          setIctAnalysis(ictData);
        }
      } catch (error) {
        console.error('Failed to load chart data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedSymbol, selectedTimeframe]);

  // Update chart data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles.length) return;

    // Sort candles by time to ensure proper ordering for lightweight-charts
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    const candleData: CandlestickData<Time>[] = sortedCandles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = sortedCandles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Draw ICT markers
    if (chartRef.current && showOrderBlocks) {
      drawOrderBlocks(ictAnalysis.orderBlocks);
    }
    if (chartRef.current && showFVGs) {
      drawFVGs(ictAnalysis.fairValueGaps);
    }
  }, [candles, ictAnalysis, showOrderBlocks, showFVGs]);

  const drawOrderBlocks = (orderBlocks: OrderBlock[]) => {
    // Remove existing markers - for now we'll use price lines
    // In production you'd use custom drawing primitives
    if (!candleSeriesRef.current) return;

    orderBlocks.forEach((ob) => {
      if (ob.mitigated) return;

      candleSeriesRef.current?.createPriceLine({
        price: ob.type === 'bullish' ? ob.low : ob.high,
        color: ob.type === 'bullish' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: ob.type === 'bullish' ? 'Bull OB' : 'Bear OB',
      });
    });
  };

  const drawFVGs = (fvgs: FairValueGap[]) => {
    if (!candleSeriesRef.current) return;

    fvgs.forEach((fvg) => {
      if (fvg.filled) return;

      candleSeriesRef.current?.createPriceLine({
        price: fvg.midpoint,
        color: fvg.type === 'bullish' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: 'FVG',
      });
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] rounded-lg border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-white">{selectedSymbol}</span>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={`px-3 py-1 text-sm rounded ${
                  selectedTimeframe === tf.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* ICT Toggles */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showOrderBlocks}
              onChange={(e) => setShowOrderBlocks(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            Order Blocks
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showFVGs}
              onChange={(e) => setShowFVGs(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            FVGs
          </label>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      {/* Market Structure Info */}
      {ictAnalysis.marketStructure && (
        <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-4 text-sm">
          <span className="text-gray-400">Market Structure:</span>
          <span
            className={`font-medium ${
              ictAnalysis.marketStructure.trend === 'bullish'
                ? 'text-green-500'
                : ictAnalysis.marketStructure.trend === 'bearish'
                ? 'text-red-500'
                : 'text-yellow-500'
            }`}
          >
            {ictAnalysis.marketStructure.trend.toUpperCase()}
          </span>
          {ictAnalysis.marketStructure.breakOfStructure && (
            <span className="text-indigo-400">
              BOS: {ictAnalysis.marketStructure.breakOfStructure.type}
            </span>
          )}
          {ictAnalysis.marketStructure.changeOfCharacter && (
            <span className="text-orange-400">
              CHoCH: {ictAnalysis.marketStructure.changeOfCharacter.type}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
