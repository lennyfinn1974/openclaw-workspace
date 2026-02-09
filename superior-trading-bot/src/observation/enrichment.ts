// Indicator Enrichment Pipeline - adds technical context to raw trades
// Critical for attribution analysis and strategy synthesis

import { IndicatorSnapshot, TradeEvent, MarketRegime } from '../types/observation';

export interface EnrichmentStats {
  enrichedCount: number;
  failedCount: number;
  averageEnrichmentTime: number;
}

export class IndicatorEnrichment {
  private stats: EnrichmentStats = {
    enrichedCount: 0,
    failedCount: 0,
    averageEnrichmentTime: 0
  };
  private isRunning: boolean = false;
  
  /**
   * Start enrichment pipeline
   */
  start(): void {
    this.isRunning = true;
    console.log('🧬 Indicator Enrichment Pipeline started');
  }
  
  /**
   * Stop enrichment pipeline
   */
  stop(): void {
    this.isRunning = false;
    console.log('🛑 Indicator Enrichment Pipeline stopped');
  }
  
  /**
   * Enrich a trade event with full indicator context
   * This is where we reconstruct the market state at trade time
   */
  async enrichTradeEvent(trade: TradeEvent, marketData: any): Promise<TradeEvent> {
    const startTime = Date.now();
    
    try {
      // Calculate indicators from market data
      const indicators = await this.calculateIndicators(trade.symbol, marketData);
      
      // Classify market regime
      const regime = this.classifyRegime(indicators, marketData);
      
      // Create enriched trade
      const enrichedTrade: TradeEvent = {
        ...trade,
        preTradeIndicators: indicators,
        regime: regime
      };
      
      // Update stats
      const enrichmentTime = Date.now() - startTime;
      this.updateStats(true, enrichmentTime);
      
      return enrichedTrade;
      
    } catch (error) {
      console.error('Failed to enrich trade:', error);
      this.updateStats(false, Date.now() - startTime);
      
      // Return trade with default indicators
      return {
        ...trade,
        preTradeIndicators: this.getDefaultIndicators(),
        regime: 'RANGING'
      };
    }
  }
  
  /**
   * Calculate full indicator snapshot from market data
   */
  private async calculateIndicators(symbol: string, marketData: any): Promise<IndicatorSnapshot> {
    // In a real implementation, this would fetch OHLCV data and calculate indicators
    // For now, we'll use mock calculations or extract from arena data if available
    
    const prices = marketData.prices || [];
    const volumes = marketData.volumes || [];
    
    return {
      rsi14: this.calculateRSI(prices, 14),
      macdHist: this.calculateMACDHist(prices),
      bbPosition: this.calculateBollingerPosition(prices, 20, 2),
      atr14: this.calculateATR(marketData.highs, marketData.lows, prices, 14),
      volumeRatio: this.calculateVolumeRatio(volumes, 20),
      trendStrength: this.calculateADX(marketData.highs, marketData.lows, prices, 14),
      priceVsMA50: this.calculateMADeviation(prices, 50),
      priceVsMA200: this.calculateMADeviation(prices, 200)
    };
  }
  
  /**
   * Classify market regime based on indicators
   */
  private classifyRegime(indicators: IndicatorSnapshot, marketData: any): MarketRegime {
    const { rsi14, atr14, trendStrength, priceVsMA50, priceVsMA200 } = indicators;
    
    // High volatility
    if (atr14 > 0.03) {
      return 'VOLATILE';
    }
    
    // Strong trend
    if (trendStrength > 25) {
      if (priceVsMA50 > 0.02 && priceVsMA200 > 0.02) {
        return 'TRENDING_UP';
      } else if (priceVsMA50 < -0.02 && priceVsMA200 < -0.02) {
        return 'TRENDING_DOWN';
      }
    }
    
    // Potential breakout
    if (rsi14 > 70 && priceVsMA50 > 0.01) {
      return 'BREAKOUT_UP';
    } else if (rsi14 < 30 && priceVsMA50 < -0.01) {
      return 'BREAKOUT_DOWN';
    }
    
    // Low volatility
    if (atr14 < 0.005) {
      return 'QUIET';
    }
    
    // Default to ranging
    return 'RANGING';
  }
  
  /**
   * RSI Calculation (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  /**
   * MACD Histogram calculation
   */
  private calculateMACDHist(prices: number[]): number {
    if (prices.length < 26) return 0;
    
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Simplified histogram (would need signal line for full calculation)
    return macd * 1000; // Scale for visibility
  }
  
  /**
   * Bollinger Band Position (0=lower band, 1=upper band, 0.5=middle)
   */
  private calculateBollingerPosition(prices: number[], period: number, stdDevs: number): number {
    if (prices.length < period) return 0.5;
    
    const sma = this.calculateSMA(prices, period);
    const stdDev = this.calculateStdDev(prices, period);
    const currentPrice = prices[prices.length - 1];
    
    const upperBand = sma + (stdDevs * stdDev);
    const lowerBand = sma - (stdDevs * stdDev);
    
    return (currentPrice - lowerBand) / (upperBand - lowerBand);
  }
  
  /**
   * Average True Range calculation
   */
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1) return 0.01;
    
    let trSum = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1] || closes[i];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trSum += tr;
    }
    
    return trSum / period;
  }
  
  /**
   * Volume ratio calculation
   */
  private calculateVolumeRatio(volumes: number[], period: number): number {
    if (volumes.length < period + 1) return 1;
    
    const avgVolume = this.calculateSMA(volumes, period);
    const currentVolume = volumes[volumes.length - 1];
    
    return currentVolume / avgVolume;
  }
  
  /**
   * ADX calculation (simplified)
   */
  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
    // Simplified ADX - would need full +DI/-DI calculation in production
    if (highs.length < period + 1) return 20;
    
    let dmSum = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const dm = Math.abs((highs[i] - lows[i]) / closes[i]);
      dmSum += dm;
    }
    
    return (dmSum / period) * 100;
  }
  
  /**
   * Moving average deviation calculation
   */
  private calculateMADeviation(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const ma = this.calculateSMA(prices, period);
    const currentPrice = prices[prices.length - 1];
    
    return (currentPrice - ma) / ma;
  }
  
  // Helper functions
  
  private calculateSMA(values: number[], period: number): number {
    const start = Math.max(0, values.length - period);
    const sum = values.slice(start).reduce((a, b) => a + b, 0);
    return sum / Math.min(period, values.length);
  }
  
  private calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
      ema = (values[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  private calculateStdDev(values: number[], period: number): number {
    const start = Math.max(0, values.length - period);
    const subset = values.slice(start);
    const mean = subset.reduce((a, b) => a + b, 0) / subset.length;
    const variance = subset.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / subset.length;
    return Math.sqrt(variance);
  }
  
  private getDefaultIndicators(): IndicatorSnapshot {
    return {
      rsi14: 50,
      macdHist: 0,
      bbPosition: 0.5,
      atr14: 0.01,
      volumeRatio: 1,
      trendStrength: 20,
      priceVsMA50: 0,
      priceVsMA200: 0
    };
  }
  
  private updateStats(success: boolean, enrichmentTime: number): void {
    if (success) {
      this.stats.enrichedCount++;
    } else {
      this.stats.failedCount++;
    }
    
    // Update average enrichment time
    const totalOperations = this.stats.enrichedCount + this.stats.failedCount;
    this.stats.averageEnrichmentTime = 
      ((this.stats.averageEnrichmentTime * (totalOperations - 1)) + enrichmentTime) / totalOperations;
  }
  
  getStats(): EnrichmentStats {
    return { ...this.stats };
  }
}