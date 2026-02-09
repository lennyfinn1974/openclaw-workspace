/**
 * Simple Technical Indicator Calculator
 * Implements basic indicators without external dependencies
 */

import { IndicatorSnapshot } from '../types/core';

interface OHLCVData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class SimpleIndicators {
  /**
   * Calculate Simple Moving Average
   */
  static sma(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1] || 0;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Calculate Exponential Moving Average
   */
  static ema(values: number[], period: number): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];
    
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
      ema = (values[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  static rsi(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    const changes = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);

    const avgGain = this.sma(gains, period);
    const avgLoss = this.sma(losses, period);

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD
   */
  static macd(closes: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { macd: number; signal: number; histogram: number } {
    if (closes.length < slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const fastEma = this.ema(closes, fastPeriod);
    const slowEma = this.ema(closes, slowPeriod);
    const macdLine = fastEma - slowEma;

    // For signal line, we'd need historical MACD values
    // Simplified: using current MACD as signal for now
    const signal = macdLine * 0.9; // Simplified signal
    const histogram = macdLine - signal;

    return { macd: macdLine, signal, histogram };
  }

  /**
   * Calculate Bollinger Bands
   */
  static bollingerBands(closes: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number } {
    if (closes.length < period) {
      const price = closes[closes.length - 1] || 0;
      return { upper: price, middle: price, lower: price };
    }

    const slice = closes.slice(-period);
    const middle = this.sma(slice, period);
    
    // Calculate standard deviation
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: middle + (standardDeviation * stdDev),
      middle,
      lower: middle - (standardDeviation * stdDev)
    };
  }

  /**
   * Calculate Average True Range (ATR)
   */
  static atr(ohlcData: OHLCVData[], period: number = 14): number {
    if (ohlcData.length < 2) return 0.01;

    const trueRanges = [];
    for (let i = 1; i < ohlcData.length; i++) {
      const high = ohlcData[i].high;
      const low = ohlcData[i].low;
      const prevClose = ohlcData[i - 1].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.sma(trueRanges, Math.min(period, trueRanges.length));
  }

  /**
   * Calculate a simplified ADX (trend strength)
   */
  static adx(ohlcData: OHLCVData[], period: number = 14): number {
    if (ohlcData.length < period) return 25;

    // Simplified ADX calculation
    let upMoves = 0;
    let downMoves = 0;

    for (let i = 1; i < Math.min(ohlcData.length, period + 1); i++) {
      const move = ohlcData[i].close - ohlcData[i - 1].close;
      if (move > 0) upMoves++;
      else if (move < 0) downMoves++;
    }

    // Return trend strength as percentage
    const totalMoves = upMoves + downMoves;
    if (totalMoves === 0) return 25;

    return Math.max(upMoves, downMoves) / totalMoves * 100;
  }

  /**
   * Calculate full indicator snapshot
   */
  static calculateSnapshot(ohlcData: OHLCVData[], currentPrice: number): IndicatorSnapshot {
    if (ohlcData.length < 5) {
      // Return default values if not enough data
      return {
        rsi14: 50,
        macdHist: 0,
        bbPosition: 0.5,
        atr14: 0.01,
        volumeRatio: 1,
        trendStrength: 25,
        priceVsMA50: 0,
        priceVsMA200: 0
      };
    }

    const closes = ohlcData.map(d => d.close);
    const volumes = ohlcData.map(d => d.volume);

    // Calculate indicators
    const rsi14 = this.rsi(closes, 14);
    const macd = this.macd(closes);
    const bb = this.bollingerBands(closes);
    const atr14 = this.atr(ohlcData);
    const adxValue = this.adx(ohlcData);

    // Calculate moving averages
    const ma50 = this.sma(closes, Math.min(50, closes.length));
    const ma200 = this.sma(closes, Math.min(200, closes.length));

    // Volume ratio
    const avgVolume = this.sma(volumes, Math.min(20, volumes.length));
    const currentVolume = volumes[volumes.length - 1] || 1;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

    // Bollinger Band position
    const bbPosition = bb.upper !== bb.lower ? 
      (currentPrice - bb.lower) / (bb.upper - bb.lower) : 0.5;

    // Price vs MA percentages
    const priceVsMA50 = ma50 > 0 ? ((currentPrice - ma50) / ma50) * 100 : 0;
    const priceVsMA200 = ma200 > 0 ? ((currentPrice - ma200) / ma200) * 100 : 0;

    return {
      rsi14: Math.round(rsi14 * 100) / 100,
      macdHist: Math.round(macd.histogram * 10000) / 10000,
      bbPosition: Math.round(Math.min(Math.max(bbPosition, 0), 1) * 100) / 100,
      atr14: Math.round(atr14 * 10000) / 10000,
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      trendStrength: Math.round(adxValue * 100) / 100,
      priceVsMA50: Math.round(priceVsMA50 * 100) / 100,
      priceVsMA200: Math.round(priceVsMA200 * 100) / 100
    };
  }
}