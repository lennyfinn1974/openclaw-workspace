// ============================================================
// Pattern Discovery — Finds recurring profitable trade patterns
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import {
  TradePattern,
  EnrichedTrade,
  MarketRegime,
  IndicatorState,
} from './types';
import { RingBuffer } from './event-buffer';

interface PatternCandidate {
  regime: MarketRegime;
  rsiRange: [number, number];
  macdSignal: 'bullish' | 'bearish' | 'none';
  bbZone: 'upper' | 'middle' | 'lower';
  side: 'buy' | 'sell';
  trades: EnrichedTrade[];
  totalPnL: number;
}

export class PatternDiscoveryEngine {
  private enrichedBuffer: RingBuffer<EnrichedTrade>;
  private discoveredPatterns: Map<string, TradePattern> = new Map();
  private candidates: Map<string, PatternCandidate> = new Map();

  // Minimum trades to consider a pattern significant
  private minOccurrences = 5;
  private minConfidence = 0.55;

  constructor(bufferSize: number = 5000) {
    this.enrichedBuffer = new RingBuffer<EnrichedTrade>(bufferSize);
  }

  /** Ingest an enriched (indicator-annotated) trade */
  ingest(trade: EnrichedTrade): void {
    this.enrichedBuffer.push(trade);

    // Classify this trade into a pattern bucket
    const key = this.classifyTrade(trade);
    if (!key) return;

    let candidate = this.candidates.get(key);
    if (!candidate) {
      candidate = {
        regime: trade.marketRegime,
        rsiRange: this.rsiRange(trade.indicators.rsi14),
        macdSignal: trade.indicators.macdCrossover,
        bbZone: this.bbZone(trade.indicators.bbPercentB),
        side: trade.side,
        trades: [],
        totalPnL: 0,
      };
      this.candidates.set(key, candidate);
    }

    candidate.trades.push(trade);
    candidate.totalPnL += trade.pnl;

    // Check if candidate qualifies as a pattern
    this.evaluateCandidate(key, candidate);
  }

  /** Classify a trade into a pattern bucket key */
  private classifyTrade(trade: EnrichedTrade): string | null {
    const { indicators, marketRegime, side } = trade;
    if (!indicators) return null;

    const rsiR = this.rsiRangeKey(indicators.rsi14);
    const macdSig = indicators.macdCrossover;
    const bbZ = this.bbZone(indicators.bbPercentB);

    return `${marketRegime}|${rsiR}|${macdSig}|${bbZ}|${side}`;
  }

  private rsiRange(rsi: number): [number, number] {
    if (rsi < 30) return [0, 30];
    if (rsi < 45) return [30, 45];
    if (rsi < 55) return [45, 55];
    if (rsi < 70) return [55, 70];
    return [70, 100];
  }

  private rsiRangeKey(rsi: number): string {
    const [lo, hi] = this.rsiRange(rsi);
    return `rsi${lo}-${hi}`;
  }

  private bbZone(percentB: number): 'upper' | 'middle' | 'lower' {
    if (isNaN(percentB)) return 'middle';
    if (percentB < 0.25) return 'lower';
    if (percentB > 0.75) return 'upper';
    return 'middle';
  }

  /** Check if a candidate pattern meets criteria for discovery */
  private evaluateCandidate(key: string, candidate: PatternCandidate): void {
    if (candidate.trades.length < this.minOccurrences) return;

    const wins = candidate.trades.filter(t => t.pnl > 0).length;
    const confidence = wins / candidate.trades.length;

    if (confidence < this.minConfidence) return;

    // Calculate frequency (occurrences per hour)
    const trades = candidate.trades;
    const spanMs = trades[trades.length - 1].observedAt - trades[0].observedAt;
    const frequency = spanMs > 0 ? (trades.length / (spanMs / 3600000)) : 0;

    const profitability = candidate.totalPnL / candidate.trades.length;

    // Build or update pattern
    const existingId = this.findExistingPattern(key);
    const patternId = existingId || uuidv4();

    const rsiR = this.rsiRange(candidate.trades[0].indicators.rsi14);

    const pattern: TradePattern = {
      patternId,
      name: this.generatePatternName(candidate),
      description: this.generateDescription(candidate, confidence, profitability),
      frequency,
      profitability,
      confidence,
      involvedBots: [...new Set(candidate.trades.map(t => t.botId))],
      triggerConditions: {
        regime: [candidate.regime],
        indicatorRanges: {
          rsi14: rsiR,
          bbPercentB: candidate.bbZone === 'lower' ? [0, 0.25]
            : candidate.bbZone === 'upper' ? [0.75, 1]
            : [0.25, 0.75],
        },
      },
      discoveredAt: Date.now(),
      sampleCount: candidate.trades.length,
    };

    this.discoveredPatterns.set(patternId, pattern);
  }

  private findExistingPattern(candidateKey: string): string | null {
    for (const [id, pattern] of this.discoveredPatterns) {
      // Match by similar trigger conditions
      if (pattern.name.includes(candidateKey.split('|')[0])) return id;
    }
    return null;
  }

  private generatePatternName(candidate: PatternCandidate): string {
    const parts: string[] = [];

    // Regime
    parts.push(candidate.regime.replace('_', '-'));

    // RSI state
    const rsi = candidate.rsiRange;
    if (rsi[1] <= 30) parts.push('oversold');
    else if (rsi[0] >= 70) parts.push('overbought');

    // MACD
    if (candidate.macdSignal !== 'none') {
      parts.push(`macd-${candidate.macdSignal}`);
    }

    // BB zone
    parts.push(`bb-${candidate.bbZone}`);

    // Direction
    parts.push(candidate.side);

    return parts.join('-');
  }

  private generateDescription(
    candidate: PatternCandidate,
    confidence: number,
    profitability: number
  ): string {
    const dir = candidate.side === 'buy' ? 'long' : 'short';
    const regime = candidate.regime.replace('_', ' ');
    const pnlStr = profitability >= 0 ? `+$${profitability.toFixed(2)}` : `-$${Math.abs(profitability).toFixed(2)}`;

    return `${dir} entries during ${regime} markets with RSI ${candidate.rsiRange[0]}-${candidate.rsiRange[1]}, ` +
      `MACD ${candidate.macdSignal}, BB ${candidate.bbZone}. ` +
      `Avg P&L: ${pnlStr}, Confidence: ${(confidence * 100).toFixed(1)}%, ` +
      `Observed ${candidate.trades.length} times across ${new Set(candidate.trades.map(t => t.botId)).size} bots.`;
  }

  /** Get all discovered patterns sorted by confidence × profitability */
  getPatterns(): TradePattern[] {
    return [...this.discoveredPatterns.values()]
      .sort((a, b) => (b.confidence * b.profitability) - (a.confidence * a.profitability));
  }

  /** Get patterns for a specific market regime */
  getPatternsForRegime(regime: MarketRegime): TradePattern[] {
    return this.getPatterns().filter(p =>
      p.triggerConditions.regime.includes(regime)
    );
  }

  /** Get high-confidence patterns (>70% confidence, positive profitability) */
  getHighConfidencePatterns(): TradePattern[] {
    return this.getPatterns().filter(p =>
      p.confidence > 0.7 && p.profitability > 0
    );
  }

  /** Get number of enriched trades in buffer */
  get tradeCount(): number {
    return this.enrichedBuffer.count;
  }

  /** Get all enriched trades in a time window */
  getTradesInWindow(fromMs: number, toMs: number): EnrichedTrade[] {
    return this.enrichedBuffer.window(fromMs, toMs, t => t.observedAt);
  }
}
