// Bot Strategy Evaluator - Converts DNA + market data into buy/sell signals
import type { StrategyDNA } from './types';
import type { OHLCV } from '../../../src/types/trading';
import { TechnicalAnalysis } from '../technicalAnalysis';

export interface SignalResult {
  action: 'buy' | 'sell' | 'hold';
  strength: number;    // 0-1
  reason: string;
  entryPrice: number;
  quantity: number;
}

const ta = new TechnicalAnalysis();
const TIMEFRAMES = ['1m', '5m', '15m', '1h'] as const;

export class BotStrategyEvaluator {

  evaluate(params: {
    dna: StrategyDNA;
    symbol: string;
    candles: OHLCV[];
    currentPrice: number;
    cash: number;
    currentPosition: number; // current quantity held
    portfolioValue: number;
  }): SignalResult {
    const { dna, symbol, candles, currentPrice, cash, currentPosition, portfolioValue } = params;

    if (candles.length < 30) {
      return { action: 'hold', strength: 0, reason: 'Insufficient data', entryPrice: 0, quantity: 0 };
    }

    // Calculate all indicators
    const rsiValues = ta.calculateRSI(candles, Math.round(dna.indicatorParams.rsiPeriod));
    const macdValues = ta.calculateMACD(
      candles,
      Math.round(dna.indicatorParams.macdFast),
      Math.round(dna.indicatorParams.macdSlow),
      Math.round(dna.indicatorParams.macdSignal)
    );
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const maFast = dna.indicatorParams.maType < 0.5
      ? ta.calculateSMA(closes, Math.round(dna.indicatorParams.maFastPeriod))
      : ta.calculateEMA(closes, Math.round(dna.indicatorParams.maFastPeriod));
    const maSlow = dna.indicatorParams.maType < 0.5
      ? ta.calculateSMA(closes, Math.round(dna.indicatorParams.maSlowPeriod))
      : ta.calculateEMA(closes, Math.round(dna.indicatorParams.maSlowPeriod));

    // ICT analysis
    const orderBlocks = ta.findOrderBlocks(candles, Math.round(dna.indicatorParams.obLookback));
    const fvgs = ta.findFairValueGaps(candles, Math.round(dna.indicatorParams.fvgLookback));
    const structure = ta.analyzeMarketStructure(candles);

    // Latest values
    const latestRsi = rsiValues[rsiValues.length - 1];
    const latestMacd = macdValues[macdValues.length - 1];
    const latestMaFast = maFast[maFast.length - 1];
    const latestMaSlow = maSlow[maSlow.length - 1];
    const prevMaFast = maFast[maFast.length - 2];
    const prevMaSlow = maSlow[maSlow.length - 2];
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const lastVol = volumes[volumes.length - 1];

    // ============ COMPUTE ENTRY SIGNALS ============
    let buyScore = 0;
    let sellScore = 0;
    const reasons: string[] = [];
    const w = dna.entrySignals;

    // RSI
    if (latestRsi.value < dna.indicatorParams.rsiOversoldThreshold) {
      buyScore += w.rsiOversold;
      reasons.push('RSI oversold');
    }
    if (latestRsi.value > dna.indicatorParams.rsiOverboughtThreshold) {
      sellScore += w.rsiOverbought;
      reasons.push('RSI overbought');
    }

    // MACD crossover
    if (latestMacd.crossover === 'bullish') {
      buyScore += w.macdCrossover;
      reasons.push('MACD bullish crossover');
    }
    if (latestMacd.crossover === 'bearish') {
      sellScore += w.macdCrossover;
      reasons.push('MACD bearish crossover');
    }

    // MACD divergence (histogram direction)
    if (latestMacd.histogram > 0 && latestMacd.histogram > (macdValues[macdValues.length - 2]?.histogram || 0)) {
      buyScore += w.macdDivergence * 0.5;
    }
    if (latestMacd.histogram < 0 && latestMacd.histogram < (macdValues[macdValues.length - 2]?.histogram || 0)) {
      sellScore += w.macdDivergence * 0.5;
    }

    // MA crossover
    if (prevMaFast <= prevMaSlow && latestMaFast > latestMaSlow) {
      buyScore += w.maCrossover;
      reasons.push('MA bullish crossover');
    }
    if (prevMaFast >= prevMaSlow && latestMaFast < latestMaSlow) {
      sellScore += w.maCrossover;
      reasons.push('MA bearish crossover');
    }

    // ICT Order Block bounce
    for (const ob of orderBlocks) {
      if (ob.type === 'bullish' && !ob.mitigated && currentPrice >= ob.low && currentPrice <= ob.high) {
        buyScore += w.ictOrderBlockBounce;
        reasons.push('Bullish OB bounce');
        break;
      }
      if (ob.type === 'bearish' && !ob.mitigated && currentPrice >= ob.low && currentPrice <= ob.high) {
        sellScore += w.ictOrderBlockBounce;
        reasons.push('Bearish OB bounce');
        break;
      }
    }

    // ICT FVG fill
    for (const fvg of fvgs) {
      if (fvg.type === 'bullish' && currentPrice <= fvg.midpoint && !fvg.filled) {
        buyScore += w.ictFvgFill;
        reasons.push('Bullish FVG fill');
        break;
      }
      if (fvg.type === 'bearish' && currentPrice >= fvg.midpoint && !fvg.filled) {
        sellScore += w.ictFvgFill;
        reasons.push('Bearish FVG fill');
        break;
      }
    }

    // Break of Structure
    if (structure.breakOfStructure) {
      if (structure.breakOfStructure.type === 'bullish') {
        buyScore += w.breakOfStructure;
        reasons.push('Bullish BOS');
      } else {
        sellScore += w.breakOfStructure;
        reasons.push('Bearish BOS');
      }
    }

    // Change of Character
    if (structure.changeOfCharacter) {
      if (structure.changeOfCharacter.type === 'bullish') {
        buyScore += w.changeOfCharacter;
        reasons.push('Bullish CHoCH');
      } else {
        sellScore += w.changeOfCharacter;
        reasons.push('Bearish CHoCH');
      }
    }

    // Volume spike
    if (lastVol > avgVol * dna.indicatorParams.volumeSpikeMultiplier) {
      const volSignal = currentPrice > closes[closes.length - 2] ? 'buy' : 'sell';
      if (volSignal === 'buy') buyScore += w.volumeSpike;
      else sellScore += w.volumeSpike;
      reasons.push('Volume spike');
    }

    // Mean reversion
    const sma20 = ta.calculateSMA(closes, 20);
    const latestSma20 = sma20[sma20.length - 1];
    if (latestSma20 > 0) {
      const deviation = (currentPrice - latestSma20) / latestSma20;
      if (deviation < -0.02) { buyScore += w.meanReversion * Math.min(Math.abs(deviation) * 20, 1); reasons.push('Mean reversion buy'); }
      if (deviation > 0.02) { sellScore += w.meanReversion * Math.min(Math.abs(deviation) * 20, 1); reasons.push('Mean reversion sell'); }
    }

    // Momentum breakout
    const high20 = Math.max(...candles.slice(-20).map(c => c.high));
    const low20 = Math.min(...candles.slice(-20).map(c => c.low));
    if (currentPrice > high20 * 0.998) { buyScore += w.momentumBreakout; reasons.push('Momentum breakout up'); }
    if (currentPrice < low20 * 1.002) { sellScore += w.momentumBreakout; reasons.push('Momentum breakout down'); }

    // ============ REGIME FILTER ============
    const rf = dna.regimeFilter;
    if (rf.trendFollowBias > 0) {
      // Trend-following: amplify signals in trend direction
      if (structure.trend === 'bullish') { buyScore *= (1 + rf.trendFollowBias * 0.3); sellScore *= (1 - rf.trendFollowBias * 0.2); }
      if (structure.trend === 'bearish') { sellScore *= (1 + rf.trendFollowBias * 0.3); buyScore *= (1 - rf.trendFollowBias * 0.2); }
    } else {
      // Counter-trend
      if (structure.trend === 'bullish') { sellScore *= (1 + Math.abs(rf.trendFollowBias) * 0.2); }
      if (structure.trend === 'bearish') { buyScore *= (1 + Math.abs(rf.trendFollowBias) * 0.2); }
    }

    // ============ DECISION ============
    const threshold = 0.05 + dna.timing.entryPatience * 0.10; // range 0.05-0.15 (aggressive for testing)

    // Check max open positions
    const maxPositions = Math.round(dna.positionSizing.maxOpenPositions);
    const hasPosition = currentPosition > 0;

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;

    if (buyScore > sellScore && buyScore > threshold && !hasPosition) {
      action = 'buy';
      strength = Math.min(buyScore, 1);
    } else if (sellScore > buyScore && sellScore > threshold && hasPosition) {
      action = 'sell';
      strength = Math.min(sellScore, 1);
    } else if (hasPosition) {
      // Check exit conditions
      const position = currentPosition;
      const exitResult = this.checkExitConditions(dna, candles, currentPrice);
      if (exitResult) {
        action = 'sell';
        strength = exitResult.strength;
        reasons.push(exitResult.reason);
      }
    }

    // ============ POSITION SIZING ============
    let quantity = 0;
    if (action === 'buy') {
      const riskAmount = portfolioValue * dna.positionSizing.riskPerTrade;
      const maxPositionValue = portfolioValue * dna.positionSizing.maxPositionPercent;
      const positionValue = Math.min(riskAmount / 0.02, maxPositionValue, cash * 0.95); // risk/2% stop or max position
      quantity = Math.max(0, Math.floor(positionValue / currentPrice));
      if (quantity === 0 && positionValue > 0) {
        // For expensive assets (BTC, etc.), allow fractional quantities
        quantity = Number((positionValue / currentPrice).toFixed(6));
      }
    } else if (action === 'sell') {
      quantity = currentPosition;
      // Partial exit?
      if (dna.exitStrategy.partialExitEnabled > 0.5 && strength < 0.7) {
        quantity = Number((currentPosition * dna.exitStrategy.partialExitPercent).toFixed(4));
      }
    }

    if (quantity <= 0) action = 'hold';

    return {
      action,
      strength,
      reason: reasons.slice(0, 3).join(', ') || 'No signal',
      entryPrice: currentPrice,
      quantity,
    };
  }

  private checkExitConditions(dna: StrategyDNA, candles: OHLCV[], currentPrice: number): { strength: number; reason: string } | null {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // ATR calculation (14-period)
    let atrSum = 0;
    for (let i = 1; i < Math.min(15, candles.length); i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      atrSum += tr;
    }
    const atr = atrSum / 14;

    // Time stop (bars since entry - simplified, check recent trend)
    const recentTrend = (closes[closes.length - 1] - closes[closes.length - Math.min(10, closes.length)]) / closes[closes.length - Math.min(10, closes.length)];
    if (Math.abs(recentTrend) < 0.01) { // loosened for testing (was 0.001 + timeStopBars check)
      return { strength: 0.4, reason: 'Time stop - low movement' };
    }

    // Trailing stop concept
    if (dna.exitStrategy.trailingStopEnabled > 0.5) {
      const recentHigh = Math.max(...highs.slice(-10));
      const dropFromHigh = (recentHigh - currentPrice) / recentHigh;
      if (dropFromHigh > dna.exitStrategy.trailingStopAtr * atr / currentPrice) {
        return { strength: 0.8, reason: 'Trailing stop hit' };
      }
    }

    // Forced profit-taking / stop-loss (testing: any 1% move triggers exit)
    const entryApprox = closes[Math.max(0, closes.length - 20)];
    const pctMove = Math.abs(currentPrice - entryApprox) / entryApprox;
    if (pctMove > 0.01) {
      return { strength: 0.6, reason: `Price moved ${(pctMove * 100).toFixed(1)}% from recent` };
    }

    return null;
  }
}
