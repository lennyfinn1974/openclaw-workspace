// Technical Analysis Service - ICT Methodology, Qullamaggie Setups, and Classic Indicators
import type {
  OHLCV,
  RSI,
  MACD,
  MovingAverage,
  OrderBlock,
  FairValueGap,
  MarketStructure,
  QullamagieSetup,
  QullamSetupType,
  LiquidityLevel,
} from '../../src/types/trading';
import { v4 as uuidv4 } from 'uuid';

export class TechnicalAnalysis {
  // ===================== CLASSIC INDICATORS =====================

  calculateSMA(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  calculateEMA(data: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        result.push(data[0]);
      } else if (i < period - 1) {
        // Use SMA for initial values
        const sum = data.slice(0, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / (i + 1));
      } else if (i === period - 1) {
        const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      } else {
        result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
      }
    }
    return result;
  }

  calculateRSI(candles: OHLCV[], period: number = 14): RSI[] {
    const results: RSI[] = [];
    const closes = candles.map(c => c.close);
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    for (let i = 0; i < candles.length; i++) {
      if (i < period) {
        results.push({ value: 50, overbought: false, oversold: false });
        continue;
      }

      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      results.push({
        value: Number(rsi.toFixed(2)),
        overbought: rsi > 70,
        oversold: rsi < 30,
      });
    }

    return results;
  }

  calculateMACD(candles: OHLCV[], fast: number = 12, slow: number = 26, signal: number = 9): MACD[] {
    const closes = candles.map(c => c.close);
    const emaFast = this.calculateEMA(closes, fast);
    const emaSlow = this.calculateEMA(closes, slow);

    const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
    const signalLine = this.calculateEMA(macdLine, signal);

    const results: MACD[] = [];
    for (let i = 0; i < candles.length; i++) {
      const histogram = macdLine[i] - signalLine[i];
      let crossover: 'bullish' | 'bearish' | undefined;

      if (i > 0) {
        const prevHistogram = macdLine[i - 1] - signalLine[i - 1];
        if (prevHistogram < 0 && histogram >= 0) crossover = 'bullish';
        if (prevHistogram > 0 && histogram <= 0) crossover = 'bearish';
      }

      results.push({
        macd: Number(macdLine[i].toFixed(4)),
        signal: Number(signalLine[i].toFixed(4)),
        histogram: Number(histogram.toFixed(4)),
        crossover,
      });
    }

    return results;
  }

  calculateMovingAverages(candles: OHLCV[]): { sma: MovingAverage[]; ema: MovingAverage[] } {
    const closes = candles.map(c => c.close);
    const periods = [9, 20, 50, 100, 200];

    const sma: MovingAverage[] = periods.map(period => ({
      period,
      type: 'sma',
      value: Number(this.calculateSMA(closes, period).slice(-1)[0]?.toFixed(2)) || 0,
    }));

    const ema: MovingAverage[] = periods.map(period => ({
      period,
      type: 'ema',
      value: Number(this.calculateEMA(closes, period).slice(-1)[0]?.toFixed(2)) || 0,
    }));

    return { sma, ema };
  }

  // ===================== ICT METHODOLOGY =====================

  findOrderBlocks(candles: OHLCV[], lookback: number = 50): OrderBlock[] {
    const orderBlocks: OrderBlock[] = [];
    const relevantCandles = candles.slice(-lookback);

    for (let i = 2; i < relevantCandles.length - 1; i++) {
      const prev2 = relevantCandles[i - 2];
      const prev1 = relevantCandles[i - 1];
      const current = relevantCandles[i];
      const next = relevantCandles[i + 1];

      // Bullish Order Block: Down move followed by strong up move
      if (prev1.close < prev1.open && // Previous candle was bearish
          current.close > current.open && // Current candle is bullish
          current.close > prev1.high && // Current candle closes above previous high
          next.low > prev1.low) { // Next candle doesn't revisit

        orderBlocks.push({
          id: uuidv4(),
          type: 'bullish',
          high: prev1.high,
          low: prev1.low,
          startTime: prev1.time,
          mitigated: false,
          strength: this.calculateOBStrength(prev1, current),
        });
      }

      // Bearish Order Block: Up move followed by strong down move
      if (prev1.close > prev1.open && // Previous candle was bullish
          current.close < current.open && // Current candle is bearish
          current.close < prev1.low && // Current candle closes below previous low
          next.high < prev1.high) { // Next candle doesn't revisit

        orderBlocks.push({
          id: uuidv4(),
          type: 'bearish',
          high: prev1.high,
          low: prev1.low,
          startTime: prev1.time,
          mitigated: false,
          strength: this.calculateOBStrength(prev1, current),
        });
      }
    }

    // Check for mitigation
    const currentPrice = candles[candles.length - 1]?.close || 0;
    for (const ob of orderBlocks) {
      if (ob.type === 'bullish' && currentPrice < ob.low) {
        ob.mitigated = true;
      }
      if (ob.type === 'bearish' && currentPrice > ob.high) {
        ob.mitigated = true;
      }
    }

    return orderBlocks.slice(-10); // Return last 10 OBs
  }

  private calculateOBStrength(ob: OHLCV, impulse: OHLCV): number {
    const obRange = Math.abs(ob.high - ob.low);
    const impulseRange = Math.abs(impulse.high - impulse.low);
    const volumeRatio = impulse.volume / ob.volume;

    // Strength based on impulse size relative to OB and volume
    const rangeScore = Math.min(impulseRange / obRange, 3) / 3;
    const volumeScore = Math.min(volumeRatio, 2) / 2;

    return Number(((rangeScore * 0.6 + volumeScore * 0.4) * 100).toFixed(0));
  }

  findFairValueGaps(candles: OHLCV[], lookback: number = 50): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    const relevantCandles = candles.slice(-lookback);

    for (let i = 2; i < relevantCandles.length; i++) {
      const candle1 = relevantCandles[i - 2];
      const candle3 = relevantCandles[i];

      // Bullish FVG: Gap between candle1 high and candle3 low
      if (candle3.low > candle1.high) {
        const fvg: FairValueGap = {
          id: uuidv4(),
          type: 'bullish',
          high: candle3.low,
          low: candle1.high,
          midpoint: (candle3.low + candle1.high) / 2,
          time: relevantCandles[i - 1].time,
          filled: false,
          fillPercent: 0,
        };
        fvgs.push(fvg);
      }

      // Bearish FVG: Gap between candle1 low and candle3 high
      if (candle3.high < candle1.low) {
        const fvg: FairValueGap = {
          id: uuidv4(),
          type: 'bearish',
          high: candle1.low,
          low: candle3.high,
          midpoint: (candle1.low + candle3.high) / 2,
          time: relevantCandles[i - 1].time,
          filled: false,
          fillPercent: 0,
        };
        fvgs.push(fvg);
      }
    }

    // Check fill status
    const currentPrice = candles[candles.length - 1]?.close || 0;
    for (const fvg of fvgs) {
      const gapSize = fvg.high - fvg.low;
      if (fvg.type === 'bullish') {
        if (currentPrice <= fvg.low) {
          fvg.filled = true;
          fvg.fillPercent = 100;
        } else if (currentPrice < fvg.high) {
          fvg.fillPercent = ((fvg.high - currentPrice) / gapSize) * 100;
        }
      } else {
        if (currentPrice >= fvg.high) {
          fvg.filled = true;
          fvg.fillPercent = 100;
        } else if (currentPrice > fvg.low) {
          fvg.fillPercent = ((currentPrice - fvg.low) / gapSize) * 100;
        }
      }
    }

    return fvgs.filter(f => !f.filled).slice(-10);
  }

  findLiquidityLevels(candles: OHLCV[], lookback: number = 100): LiquidityLevel[] {
    const levels: LiquidityLevel[] = [];
    const relevantCandles = candles.slice(-lookback);

    // Find swing highs (sell-side liquidity)
    for (let i = 2; i < relevantCandles.length - 2; i++) {
      const isSwingHigh = relevantCandles[i].high > relevantCandles[i - 1].high &&
                          relevantCandles[i].high > relevantCandles[i - 2].high &&
                          relevantCandles[i].high > relevantCandles[i + 1].high &&
                          relevantCandles[i].high > relevantCandles[i + 2].high;

      if (isSwingHigh) {
        levels.push({
          price: relevantCandles[i].high,
          type: 'sell_side',
          strength: this.calculateLiquidityStrength(relevantCandles, i, 'high'),
          swept: false,
        });
      }

      const isSwingLow = relevantCandles[i].low < relevantCandles[i - 1].low &&
                         relevantCandles[i].low < relevantCandles[i - 2].low &&
                         relevantCandles[i].low < relevantCandles[i + 1].low &&
                         relevantCandles[i].low < relevantCandles[i + 2].low;

      if (isSwingLow) {
        levels.push({
          price: relevantCandles[i].low,
          type: 'buy_side',
          strength: this.calculateLiquidityStrength(relevantCandles, i, 'low'),
          swept: false,
        });
      }
    }

    // Check if levels have been swept
    const recent = candles.slice(-5);
    for (const level of levels) {
      for (const candle of recent) {
        if (level.type === 'sell_side' && candle.high > level.price) {
          level.swept = true;
        }
        if (level.type === 'buy_side' && candle.low < level.price) {
          level.swept = true;
        }
      }
    }

    return levels.filter(l => !l.swept).slice(-10);
  }

  private calculateLiquidityStrength(candles: OHLCV[], index: number, field: 'high' | 'low'): number {
    // Strength based on how many times price tested this level
    let tests = 0;
    const targetPrice = candles[index][field];
    const tolerance = targetPrice * 0.002;

    for (const candle of candles) {
      if (Math.abs(candle[field] - targetPrice) < tolerance) {
        tests++;
      }
    }

    return Math.min(tests * 20, 100);
  }

  analyzeMarketStructure(candles: OHLCV[]): MarketStructure {
    const swingHighs: { price: number; time: number }[] = [];
    const swingLows: { price: number; time: number }[] = [];

    // Find swing points
    for (let i = 5; i < candles.length - 5; i++) {
      const isHigh = candles.slice(i - 5, i).every(c => c.high <= candles[i].high) &&
                     candles.slice(i + 1, i + 6).every(c => c.high <= candles[i].high);
      const isLow = candles.slice(i - 5, i).every(c => c.low >= candles[i].low) &&
                    candles.slice(i + 1, i + 6).every(c => c.low >= candles[i].low);

      if (isHigh) swingHighs.push({ price: candles[i].high, time: candles[i].time });
      if (isLow) swingLows.push({ price: candles[i].low, time: candles[i].time });
    }

    // Determine trend
    let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const recentHighs = swingHighs.slice(-3);
      const recentLows = swingLows.slice(-3);

      const higherHighs = recentHighs.every((h, i) => i === 0 || h.price >= recentHighs[i - 1].price);
      const higherLows = recentLows.every((l, i) => i === 0 || l.price >= recentLows[i - 1].price);
      const lowerHighs = recentHighs.every((h, i) => i === 0 || h.price <= recentHighs[i - 1].price);
      const lowerLows = recentLows.every((l, i) => i === 0 || l.price <= recentLows[i - 1].price);

      if (higherHighs && higherLows) trend = 'bullish';
      else if (lowerHighs && lowerLows) trend = 'bearish';
    }

    // Detect BOS and CHoCH
    let breakOfStructure: { price: number; time: number; type: 'bullish' | 'bearish' } | undefined;
    let changeOfCharacter: { price: number; time: number; type: 'bullish' | 'bearish' } | undefined;

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const lastCandle = candles[candles.length - 1];
      const prevHigh = swingHighs[swingHighs.length - 2];
      const prevLow = swingLows[swingLows.length - 2];

      // Break of Structure
      if (lastCandle.close > prevHigh.price) {
        breakOfStructure = { price: prevHigh.price, time: lastCandle.time, type: 'bullish' };
      }
      if (lastCandle.close < prevLow.price) {
        breakOfStructure = { price: prevLow.price, time: lastCandle.time, type: 'bearish' };
      }

      // Change of Character (trend reversal signal)
      if (trend === 'bearish' && lastCandle.close > swingHighs[swingHighs.length - 1].price) {
        changeOfCharacter = { price: swingHighs[swingHighs.length - 1].price, time: lastCandle.time, type: 'bullish' };
      }
      if (trend === 'bullish' && lastCandle.close < swingLows[swingLows.length - 1].price) {
        changeOfCharacter = { price: swingLows[swingLows.length - 1].price, time: lastCandle.time, type: 'bearish' };
      }
    }

    return {
      trend,
      swingHighs: swingHighs.slice(-5),
      swingLows: swingLows.slice(-5),
      breakOfStructure,
      changeOfCharacter,
    };
  }

  // ===================== QULLAMAGGIE SETUPS =====================

  findQullamagieSetups(candles: OHLCV[], symbol: string): QullamagieSetup[] {
    const setups: QullamagieSetup[] = [];

    // Need at least 60 days of data
    if (candles.length < 60) return setups;

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const highs = candles.map(c => c.high);

    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    const currentPrice = closes[closes.length - 1];
    const recentHigh = Math.max(...highs.slice(-20));
    const consolidationRange = (recentHigh - Math.min(...candles.slice(-20).map(c => c.low))) / recentHigh;

    // Common Breakout Pattern
    const isAbove20SMA = currentPrice > sma20[sma20.length - 1];
    const isAbove50SMA = currentPrice > sma50[sma50.length - 1];
    const isTightConsolidation = consolidationRange < 0.15;
    const isPriceNearHigh = (currentPrice / recentHigh) > 0.95;

    if (isAbove20SMA && isAbove50SMA && isTightConsolidation && isPriceNearHigh) {
      const pivotPrice = recentHigh;
      const stopLoss = Math.min(...candles.slice(-5).map(c => c.low));
      const riskPercent = (pivotPrice - stopLoss) / pivotPrice;

      if (riskPercent > 0.02 && riskPercent < 0.10) {
        setups.push({
          id: uuidv4(),
          symbol,
          type: 'common_breakout',
          pivotPrice,
          stopLoss,
          riskPercent: Number((riskPercent * 100).toFixed(2)),
          volumeRatio: volumes[volumes.length - 1] / avgVolume,
          consolidationDays: this.countConsolidationDays(candles),
          relativeStrength: this.calculateRelativeStrength(candles),
          score: this.calculateSetupScore('common_breakout', candles),
          timestamp: new Date(),
        });
      }
    }

    // Episodic Pivot (Gap up on news/earnings)
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    const gapPercent = (lastCandle.open - prevCandle.close) / prevCandle.close;
    const volumeSpike = lastCandle.volume / avgVolume;

    if (gapPercent > 0.05 && volumeSpike > 2) {
      setups.push({
        id: uuidv4(),
        symbol,
        type: 'episodic_pivot',
        pivotPrice: lastCandle.high,
        stopLoss: lastCandle.low,
        riskPercent: Number(((lastCandle.high - lastCandle.low) / lastCandle.high * 100).toFixed(2)),
        volumeRatio: volumeSpike,
        consolidationDays: 0,
        relativeStrength: this.calculateRelativeStrength(candles),
        score: this.calculateSetupScore('episodic_pivot', candles),
        timestamp: new Date(),
      });
    }

    return setups;
  }

  private countConsolidationDays(candles: OHLCV[]): number {
    let days = 0;
    const recentHigh = Math.max(...candles.slice(-60).map(c => c.high));

    for (let i = candles.length - 1; i >= Math.max(0, candles.length - 60); i--) {
      const range = (candles[i].high - candles[i].low) / candles[i].close;
      if (range < 0.03 && candles[i].high < recentHigh * 1.02) {
        days++;
      } else {
        break;
      }
    }

    return days;
  }

  private calculateRelativeStrength(candles: OHLCV[]): number {
    // Simplified RS calculation (would compare to SPY in production)
    const returns20d = (candles[candles.length - 1].close - candles[candles.length - 20].close) / candles[candles.length - 20].close;
    const returns60d = candles.length >= 60
      ? (candles[candles.length - 1].close - candles[candles.length - 60].close) / candles[candles.length - 60].close
      : returns20d;

    // Score from 0-100
    return Math.min(100, Math.max(0, (returns20d * 200 + returns60d * 100 + 50)));
  }

  private calculateSetupScore(type: QullamSetupType, candles: OHLCV[]): number {
    let score = 50;

    const volumes = candles.map(c => c.volume);
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const recentVolume = volumes[volumes.length - 1];

    // Volume confirmation
    if (recentVolume > avgVolume * 1.5) score += 15;
    if (recentVolume > avgVolume * 2) score += 10;

    // Price action confirmation
    const closes = candles.map(c => c.close);
    const sma20 = this.calculateSMA(closes, 20);
    const currentPrice = closes[closes.length - 1];

    if (currentPrice > sma20[sma20.length - 1]) score += 10;
    if (currentPrice > sma20[sma20.length - 1] * 1.02) score += 5;

    // Relative strength
    score += this.calculateRelativeStrength(candles) * 0.1;

    return Math.min(100, Math.round(score));
  }

  // ===================== POSITION SIZING =====================

  calculatePositionSize(params: {
    portfolioValue: number;
    riskPercent: number;
    entryPrice: number;
    stopLoss: number;
  }): {
    shares: number;
    positionValue: number;
    riskAmount: number;
    maxLoss: number;
  } {
    const { portfolioValue, riskPercent, entryPrice, stopLoss } = params;

    const riskAmount = portfolioValue * (riskPercent / 100);
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const shares = Math.floor(riskAmount / riskPerShare);
    const positionValue = shares * entryPrice;
    const maxLoss = shares * riskPerShare;

    return {
      shares,
      positionValue: Number(positionValue.toFixed(2)),
      riskAmount: Number(riskAmount.toFixed(2)),
      maxLoss: Number(maxLoss.toFixed(2)),
    };
  }
}
