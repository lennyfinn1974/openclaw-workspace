/**
 * Technical Indicator Calculator for Event Enrichment
 * Uses SimpleIndicators implementation for reliable calculation
 */

import { SimpleIndicators } from './SimpleIndicators';
import { IndicatorSnapshot } from '../types/core';

interface OHLCVData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class IndicatorCalculator {
  private ohlcvData: Map<string, OHLCVData[]> = new Map();
  private readonly maxHistoryLength = 250; // Keep enough for longest indicator (200 MA)

  /**
   * Add new OHLCV data point for a symbol
   */
  addOHLCV(symbol: string, data: OHLCVData): void {
    if (!this.ohlcvData.has(symbol)) {
      this.ohlcvData.set(symbol, []);
    }

    const history = this.ohlcvData.get(symbol)!;
    history.push(data);

    // Trim history to max length
    if (history.length > this.maxHistoryLength) {
      history.splice(0, history.length - this.maxHistoryLength);
    }
  }

  /**
   * Calculate indicator snapshot for a symbol at current time
   */
  calculateSnapshot(symbol: string, currentPrice: number): IndicatorSnapshot | null {
    const history = this.ohlcvData.get(symbol);
    
    if (!history || history.length < 5) {
      // Not enough data for reliable indicators
      return null;
    }

    try {
      return SimpleIndicators.calculateSnapshot(history, currentPrice);
    } catch (error) {
      console.error('Error calculating indicators for', symbol, error);
      return null;
    }
  }

  /**
   * Get historical indicator values for backtesting
   */
  getHistoricalSnapshot(symbol: string, timestamp: number): IndicatorSnapshot | null {
    const history = this.ohlcvData.get(symbol);
    if (!history) return null;

    // Find the data point closest to the timestamp
    const dataIndex = history.findIndex(d => d.timestamp >= timestamp);
    if (dataIndex < 5) return null; // Not enough history

    // Calculate indicators using data up to that point
    const relevantHistory = history.slice(0, dataIndex + 1);
    const price = relevantHistory[relevantHistory.length - 1].close;
    
    try {
      return SimpleIndicators.calculateSnapshot(relevantHistory, price);
    } catch (error) {
      console.error('Error calculating historical indicators for', symbol, error);
      return null;
    }
  }

  /**
   * Get current market state summary
   */
  getMarketSummary(symbol: string): {
    price: number;
    trend: 'bullish' | 'bearish' | 'sideways';
    volatility: 'low' | 'medium' | 'high';
    volume: 'low' | 'normal' | 'high';
  } | null {
    const currentPrice = this.getCurrentPrice(symbol);
    const snapshot = this.calculateSnapshot(symbol, currentPrice);
    if (!snapshot) return null;

    // Determine trend
    let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    if (snapshot.priceVsMA50 > 2 && snapshot.priceVsMA200 > 0) {
      trend = 'bullish';
    } else if (snapshot.priceVsMA50 < -2 && snapshot.priceVsMA200 < 0) {
      trend = 'bearish';
    }

    // Determine volatility (based on ATR and BB position extremes)
    let volatility: 'low' | 'medium' | 'high' = 'medium';
    if (snapshot.atr14 < 0.01 && snapshot.bbPosition > 0.2 && snapshot.bbPosition < 0.8) {
      volatility = 'low';
    } else if (snapshot.atr14 > 0.03 || snapshot.bbPosition < 0.1 || snapshot.bbPosition > 0.9) {
      volatility = 'high';
    }

    // Determine volume
    let volume: 'low' | 'normal' | 'high' = 'normal';
    if (snapshot.volumeRatio < 0.7) {
      volume = 'low';
    } else if (snapshot.volumeRatio > 1.5) {
      volume = 'high';
    }

    return {
      price: currentPrice,
      trend,
      volatility,
      volume
    };
  }

  private getCurrentPrice(symbol: string): number {
    const history = this.ohlcvData.get(symbol);
    if (!history || history.length === 0) return 0;
    return history[history.length - 1].close;
  }

  /**
   * Clear old data for memory management
   */
  cleanup(): void {
    for (const [symbol, history] of this.ohlcvData) {
      if (history.length > this.maxHistoryLength) {
        history.splice(0, history.length - this.maxHistoryLength);
      }
    }
  }
}