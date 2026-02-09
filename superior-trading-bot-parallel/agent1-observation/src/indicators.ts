// ============================================================
// Technical Indicator Engine — RSI, MACD, Bollinger Bands
// Pure computation, no side effects
// ============================================================

import { IndicatorState, MarketRegime, OHLCV } from './types';

/** Exponential Moving Average */
export function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** Simple Moving Average */
export function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      result.push(sum / period);
    }
  }
  return result;
}

/** Relative Strength Index */
export function rsi(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) return closes.map(() => NaN);

  const result: number[] = [NaN];
  let avgGain = 0;
  let avgLoss = 0;

  // Initial averages
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
    result.push(NaN);
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + firstRS);

  // Subsequent RSI using smoothed averages
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

/** MACD — returns { macd, signal, histogram } arrays */
export function macd(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine = fastEma.map((f, i) => f - slowEma[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);

  return { macd: macdLine, signal: signalLine, histogram };
}

/** Bollinger Bands */
export function bollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[]; width: number[]; percentB: number[] } {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const width: number[] = [];
  const percentB: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      width.push(NaN);
      percentB.push(NaN);
    } else {
      // Standard deviation over the window
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += (closes[j] - middle[i]) ** 2;
      }
      const stdDev = Math.sqrt(sumSq / period);
      const u = middle[i] + stdDevMultiplier * stdDev;
      const l = middle[i] - stdDevMultiplier * stdDev;
      upper.push(u);
      lower.push(l);
      width.push((u - l) / middle[i]);
      percentB.push(u === l ? 0.5 : (closes[i] - l) / (u - l));
    }
  }

  return { upper, middle, lower, width, percentB };
}

/** Average True Range */
export function atr(candles: OHLCV[], period: number = 14): number[] {
  if (candles.length === 0) return [];
  const trueRanges: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trueRanges.push(Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    ));
  }

  // Use EMA-style smoothing
  return ema(trueRanges, period);
}

/** Detect MACD crossover from the last two values */
export function detectMacdCrossover(
  macdLine: number[],
  signalLine: number[]
): 'bullish' | 'bearish' | 'none' {
  const len = macdLine.length;
  if (len < 2) return 'none';
  const prevDiff = macdLine[len - 2] - signalLine[len - 2];
  const currDiff = macdLine[len - 1] - signalLine[len - 1];
  if (prevDiff <= 0 && currDiff > 0) return 'bullish';
  if (prevDiff >= 0 && currDiff < 0) return 'bearish';
  return 'none';
}

/** Classify market regime from indicators */
export function classifyRegime(indicators: IndicatorState): MarketRegime {
  const { rsi14, macdHistogram, bbWidth, sma20, sma50, volatilityRank } = indicators;

  // High volatility + wide bands = volatile
  if (volatilityRank > 0.8 && bbWidth > 0.04) return 'volatile';

  // Low volatility + narrow bands = quiet
  if (volatilityRank < 0.2 && bbWidth < 0.015) return 'quiet';

  // Strong trend signals
  if (sma20 > sma50 && macdHistogram > 0 && rsi14 > 55) return 'trending_up';
  if (sma20 < sma50 && macdHistogram < 0 && rsi14 < 45) return 'trending_down';

  return 'ranging';
}

// ============================================================
// Price History Manager — maintains per-symbol candle history
// ============================================================

export class PriceHistoryManager {
  private histories: Map<string, OHLCV[]> = new Map();
  private maxCandles: number;
  private currentCandles: Map<string, OHLCV> = new Map();
  private candleIntervalMs: number;

  constructor(maxCandles: number = 200, candleIntervalMs: number = 60000) {
    this.maxCandles = maxCandles;
    this.candleIntervalMs = candleIntervalMs;
  }

  /** Ingest a price tick for a symbol */
  tick(symbol: string, price: number, timestamp: number): void {
    const candleStart = Math.floor(timestamp / this.candleIntervalMs) * this.candleIntervalMs;
    const current = this.currentCandles.get(symbol);

    if (current && current.timestamp === candleStart) {
      // Update current candle
      current.high = Math.max(current.high, price);
      current.low = Math.min(current.low, price);
      current.close = price;
      current.volume++;
    } else {
      // Close previous candle if exists
      if (current) {
        let history = this.histories.get(symbol);
        if (!history) {
          history = [];
          this.histories.set(symbol, history);
        }
        history.push({ ...current });
        if (history.length > this.maxCandles) {
          history.shift();
        }
      }
      // Start new candle
      this.currentCandles.set(symbol, {
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
        timestamp: candleStart,
      });
    }
  }

  /** Get closes for a symbol (including current candle) */
  getCloses(symbol: string): number[] {
    const history = this.histories.get(symbol) || [];
    const current = this.currentCandles.get(symbol);
    const closes = history.map(c => c.close);
    if (current) closes.push(current.close);
    return closes;
  }

  /** Get full candle history for a symbol */
  getCandles(symbol: string): OHLCV[] {
    const history = this.histories.get(symbol) || [];
    const current = this.currentCandles.get(symbol);
    return current ? [...history, { ...current }] : [...history];
  }

  /** Compute full indicator state for a symbol */
  computeIndicators(symbol: string): IndicatorState | null {
    const closes = this.getCloses(symbol);
    const candles = this.getCandles(symbol);

    if (closes.length < 30) return null; // Need enough data

    const rsiValues = rsi(closes, 14);
    const currentRsi = rsiValues[rsiValues.length - 1];
    const prevRsi = rsiValues.length > 1 ? rsiValues[rsiValues.length - 2] : currentRsi;

    const macdResult = macd(closes, 12, 26, 9);
    const bbResult = bollingerBands(closes, 20, 2);
    const atrValues = atr(candles, 14);

    const sma20Values = sma(closes, 20);
    const sma50Values = sma(closes, 50);
    const ema12Values = ema(closes, 12);
    const ema26Values = ema(closes, 26);

    const last = closes.length - 1;

    // Volatility rank: current ATR relative to min/max of history
    const atrHistory = atrValues.filter(v => !isNaN(v));
    const atrMin = Math.min(...atrHistory);
    const atrMax = Math.max(...atrHistory);
    const currentAtr = atrValues[atrValues.length - 1];
    const volRank = atrMax === atrMin ? 0.5 : (currentAtr - atrMin) / (atrMax - atrMin);

    const state: IndicatorState = {
      symbol,
      timestamp: Date.now(),
      rsi14: currentRsi,
      rsiSlope: currentRsi - prevRsi,
      macdLine: macdResult.macd[last],
      macdSignal: macdResult.signal[last],
      macdHistogram: macdResult.histogram[last],
      macdCrossover: detectMacdCrossover(macdResult.macd, macdResult.signal),
      bbUpper: bbResult.upper[last],
      bbMiddle: bbResult.middle[last],
      bbLower: bbResult.lower[last],
      bbWidth: bbResult.width[last],
      bbPercentB: bbResult.percentB[last],
      sma20: sma20Values[last],
      sma50: sma50Values[last] ?? sma20Values[last],
      ema12: ema12Values[last],
      ema26: ema26Values[last],
      atr14: currentAtr,
      volatilityRank: volRank,
    };

    return state;
  }

  /** Get all tracked symbols */
  symbols(): string[] {
    return [...new Set([...this.histories.keys(), ...this.currentCandles.keys()])];
  }
}
