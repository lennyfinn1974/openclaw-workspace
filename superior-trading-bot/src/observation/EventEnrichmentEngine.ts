/**
 * Event Enrichment Engine
 * Enriches raw observation events with indicator snapshots and market context
 */

import { ObservationEvent, TradeEvent, IndicatorSnapshot } from '../types/core';
import { IndicatorCalculator } from './IndicatorCalculator';

interface MarketContext {
  spread: number;
  depth: number;
  volatilityState: 'low' | 'medium' | 'high';
  liquidityState: 'thin' | 'normal' | 'thick';
}

export class EventEnrichmentEngine {
  private indicatorCalculator: IndicatorCalculator;
  private marketData: Map<string, {
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
    lastUpdate: number;
  }> = new Map();

  constructor() {
    this.indicatorCalculator = new IndicatorCalculator();
  }

  /**
   * Enrich observation event with indicators and market context
   */
  async enrichEvent(event: ObservationEvent): Promise<ObservationEvent> {
    const startTime = Date.now();

    try {
      const enrichedEvent = { ...event };

      // Enrich trade events with indicator snapshots
      if (event.eventType === 'trade') {
        const tradePayload = event.payload as TradeEvent;
        await this.enrichTradeEvent(tradePayload, enrichedEvent);
      }

      // Add enrichment metadata
      enrichedEvent.enrichmentMetadata = {
        processingTime: Date.now() - startTime,
        indicators: this.getIndicatorSnapshot(this.extractSymbol(event)),
        marketContext: this.getMarketContext(this.extractSymbol(event))
      };

      return enrichedEvent;

    } catch (error) {
      console.error('❌ Error enriching event:', error);
      
      // Return original event with error metadata
      return {
        ...event,
        enrichmentMetadata: {
          processingTime: Date.now() - startTime,
          indicators: this.getDefaultIndicatorSnapshot(),
          marketContext: undefined
        }
      };
    }
  }

  /**
   * Update market data for a symbol (bid/ask, sizes)
   */
  updateMarketData(symbol: string, bid: number, ask: number, bidSize: number = 0, askSize: number = 0): void {
    this.marketData.set(symbol, {
      bid,
      ask,
      bidSize,
      askSize,
      lastUpdate: Date.now()
    });

    // Add to indicator calculator as OHLCV (using mid price)
    const midPrice = (bid + ask) / 2;
    this.indicatorCalculator.addOHLCV(symbol, {
      open: midPrice,
      high: Math.max(bid, ask),
      low: Math.min(bid, ask),
      close: midPrice,
      volume: bidSize + askSize,
      timestamp: Date.now()
    });
  }

  /**
   * Add OHLCV data for indicator calculation
   */
  addOHLCVData(symbol: string, open: number, high: number, low: number, close: number, volume: number): void {
    this.indicatorCalculator.addOHLCV(symbol, {
      open,
      high,
      low,
      close,
      volume,
      timestamp: Date.now()
    });
  }

  /**
   * Get current indicator snapshot for a symbol
   */
  getIndicatorSnapshot(symbol: string | null): IndicatorSnapshot {
    if (!symbol) return this.getDefaultIndicatorSnapshot();

    const marketData = this.marketData.get(symbol);
    if (!marketData) return this.getDefaultIndicatorSnapshot();

    const currentPrice = (marketData.bid + marketData.ask) / 2;
    const snapshot = this.indicatorCalculator.calculateSnapshot(symbol, currentPrice);
    
    return snapshot || this.getDefaultIndicatorSnapshot();
  }

  /**
   * Get market context for a symbol
   */
  getMarketContext(symbol: string | null): MarketContext | undefined {
    if (!symbol) return undefined;

    const data = this.marketData.get(symbol);
    if (!data) return undefined;

    const spread = data.ask - data.bid;
    const midPrice = (data.bid + data.ask) / 2;
    const relativeSpread = (spread / midPrice) * 100;

    // Determine volatility state based on spread and indicator data
    let volatilityState: 'low' | 'medium' | 'high' = 'medium';
    const indicators = this.getIndicatorSnapshot(symbol);
    
    if (relativeSpread < 0.05 && indicators.atr14 < 0.01) {
      volatilityState = 'low';
    } else if (relativeSpread > 0.2 || indicators.atr14 > 0.03) {
      volatilityState = 'high';
    }

    // Determine liquidity state
    let liquidityState: 'thin' | 'normal' | 'thick' = 'normal';
    const totalSize = data.bidSize + data.askSize;
    
    if (totalSize < 100) {
      liquidityState = 'thin';
    } else if (totalSize > 1000) {
      liquidityState = 'thick';
    }

    return {
      spread: Math.round(spread * 100000) / 100000,
      depth: totalSize,
      volatilityState,
      liquidityState
    };
  }

  /**
   * Get market summary for dashboard
   */
  getMarketSummary(symbol: string): any {
    return this.indicatorCalculator.getMarketSummary(symbol);
  }

  /**
   * Cleanup old data to prevent memory leaks
   */
  cleanup(): void {
    this.indicatorCalculator.cleanup();
    
    // Remove stale market data (older than 1 hour)
    const cutoff = Date.now() - (60 * 60 * 1000);
    for (const [symbol, data] of this.marketData) {
      if (data.lastUpdate < cutoff) {
        this.marketData.delete(symbol);
      }
    }
  }

  // Private methods

  private async enrichTradeEvent(tradePayload: TradeEvent, enrichedEvent: ObservationEvent): Promise<void> {
    const symbol = tradePayload.symbol;
    const snapshot = this.getIndicatorSnapshot(symbol);
    
    // Update the trade's indicator snapshot
    if (snapshot) {
      (enrichedEvent.payload as TradeEvent).preTradeIndicators = snapshot;
    }

    // Detect market regime based on indicators
    (enrichedEvent.payload as TradeEvent).regime = this.detectMarketRegime(snapshot);
  }

  private detectMarketRegime(indicators: IndicatorSnapshot): import('../types/core').MarketRegime {
    // Enhanced regime detection based on multiple indicators
    const { rsi14, macdHist, bbPosition, atr14, trendStrength, priceVsMA50, priceVsMA200 } = indicators;

    // High volatility regime
    if (atr14 > 0.03 || (bbPosition < 0.1 || bbPosition > 0.9)) {
      return 'VOLATILE';
    }

    // Trending regime
    if (trendStrength > 40 && Math.abs(priceVsMA50) > 3) {
      return 'TRENDING';
    }

    // Breakout regime
    if ((rsi14 > 70 && bbPosition > 0.8 && macdHist > 0) || 
        (rsi14 < 30 && bbPosition < 0.2 && macdHist < 0)) {
      return 'BREAKOUT';
    }

    // Quiet regime
    if (atr14 < 0.005 && bbPosition > 0.3 && bbPosition < 0.7 && trendStrength < 20) {
      return 'QUIET';
    }

    // Event regime (high volume with mixed signals)
    if (indicators.volumeRatio > 2 && Math.abs(macdHist) > 0.001) {
      return 'EVENT';
    }

    // Default to ranging
    return 'RANGING';
  }

  private extractSymbol(event: ObservationEvent): string | null {
    switch (event.eventType) {
      case 'trade':
        return (event.payload as TradeEvent).symbol;
      case 'position_update':
        return (event.payload as any).symbol;
      default:
        return null;
    }
  }

  private getDefaultIndicatorSnapshot(): IndicatorSnapshot {
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
}