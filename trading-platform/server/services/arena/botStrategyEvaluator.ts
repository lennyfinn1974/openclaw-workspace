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
    avgEntryPrice?: number;  // actual avg cost from position
    portfolioValue: number;
  }): SignalResult {
    const { dna, symbol, candles, currentPrice, cash, currentPosition, avgEntryPrice, portfolioValue } = params;

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
    const threshold = 0.3 + dna.timing.entryPatience * 0.4; // range 0.3-0.7
    const hasPosition = currentPosition > 0;

    const netBuy = buyScore - sellScore;   // positive = bullish consensus
    const netSell = sellScore - buyScore;  // positive = bearish consensus

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let strength = 0;

    if (netBuy > threshold && !hasPosition) {
      // Entry: genuine directional consensus required (contradictions cancel)
      action = 'buy';
      strength = Math.min(netBuy / (threshold + 0.5), 1);
    } else if (hasPosition) {
      // Signal-based exit: sell if net bearish signal exceeds entry threshold
      const signalExitThreshold = threshold * 0.75;
      if (netSell > signalExitThreshold) {
        action = 'sell';
        strength = Math.min(netSell / (threshold + 0.5), 1);
        reasons.unshift('Signal-based exit');
      } else {
        // ATR-based exit: stop loss, take profit, trailing stop
        const exitResult = this.checkExitConditions(dna, candles, currentPrice, avgEntryPrice);
        if (exitResult) {
          action = 'sell';
          strength = exitResult.strength;
          reasons.unshift(exitResult.reason);
        }
      }
    }

    // ============ POSITION SIZING ============
    let quantity = 0;
    if (action === 'buy') {
      const riskAmount = portfolioValue * dna.positionSizing.riskPerTrade;
      const maxPositionValue = portfolioValue * dna.positionSizing.maxPositionPercent;
      const atrForSizing = this.calculateATR(candles);
      const stopPercent = Math.max(0.005, (dna.exitStrategy.stopLossAtr * atrForSizing) / currentPrice);
      const positionValue = Math.min(riskAmount / stopPercent, maxPositionValue, cash * 0.95);
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

  private checkExitConditions(dna: StrategyDNA, candles: OHLCV[], currentPrice: number, avgEntryPrice?: number): { strength: number; reason: string } | null {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);

    const atr = this.calculateATR(candles);
    if (atr <= 0) return null;

    // Use actual entry price if available, otherwise approximate
    const entryApprox = avgEntryPrice && avgEntryPrice > 0 ? avgEntryPrice : closes[closes.length - 2];

    // Stop loss: exit if price dropped below entry by stopLossAtr * ATR
    const stopDist = dna.exitStrategy.stopLossAtr * atr;
    if (currentPrice < entryApprox - stopDist) {
      return { strength: 0.9, reason: `Stop loss (${(stopDist / entryApprox * 100).toFixed(1)}% ATR)` };
    }

    // Take profit: exit if price rose above entry by takeProfitAtr * ATR
    const tpDist = dna.exitStrategy.takeProfitAtr * atr;
    if (currentPrice > entryApprox + tpDist) {
      return { strength: 0.8, reason: `Take profit (${(tpDist / entryApprox * 100).toFixed(1)}% ATR)` };
    }

    // Trailing stop: exit if price dropped from recent high by trailingStopAtr * ATR
    if (dna.exitStrategy.trailingStopEnabled > 0.5) {
      const recentHigh = Math.max(...highs.slice(-10));
      const dropFromHigh = recentHigh - currentPrice;
      if (dropFromHigh > dna.exitStrategy.trailingStopAtr * atr) {
        return { strength: 0.8, reason: 'Trailing stop hit' };
      }
    }

    return null;
  }

  private calculateATR(candles: OHLCV[]): number {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    const periods = Math.min(15, candles.length);
    if (periods < 2) return 0;
    let atrSum = 0;
    for (let i = 1; i < periods; i++) {
      atrSum += Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
    }
    return atrSum / Math.max(periods - 1, 1);
  }
}
