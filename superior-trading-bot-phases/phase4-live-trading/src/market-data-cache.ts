/**
 * Market Data Cache
 *
 * Maintains latest quotes per symbol from Socket.IO `quote` events.
 * Used by ExecutionEngine for slippage estimation and strategy evaluation.
 */

import { EventEmitter } from 'events';

interface CachedQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
  volume?: number;
}

const STALE_THRESHOLD_MS = 60_000; // 60 seconds

export class MarketDataCache extends EventEmitter {
  private quotes: Map<string, CachedQuote> = new Map();
  private priceHistories: Map<string, { price: number; timestamp: number }[]> = new Map();
  private lastHistoryUpdate: Map<string, number> = new Map();
  private maxHistoryLength = 500;
  private historyThrottleMs = 1000; // Only record price history once per second per symbol

  /**
   * Update the cache with a new quote from the arena.
   */
  update(quote: { symbol: string; price: number; bid?: number; ask?: number; volume?: number }): void {
    if (!quote.price || !isFinite(quote.price)) return;

    const now = Date.now();
    const cached: CachedQuote = {
      symbol: quote.symbol,
      price: quote.price,
      bid: quote.bid ?? quote.price * 0.9999,
      ask: quote.ask ?? quote.price * 1.0001,
      timestamp: now,
      volume: quote.volume,
    };

    this.quotes.set(quote.symbol, cached);

    // Track price history (throttled: max once per second per symbol)
    const lastUpdate = this.lastHistoryUpdate.get(quote.symbol) || 0;
    if (now - lastUpdate >= this.historyThrottleMs) {
      let history = this.priceHistories.get(quote.symbol);
      if (!history) {
        history = [];
        this.priceHistories.set(quote.symbol, history);
      }
      history.push({ price: quote.price, timestamp: now });
      if (history.length > this.maxHistoryLength) {
        history.shift();
      }
      this.lastHistoryUpdate.set(quote.symbol, now);
    }

    this.emit('quote:updated', cached);
  }

  /**
   * Update cache from arena bot trade events (uses trade price as quote).
   */
  updateFromTrade(trade: { symbol: string; price: number }): void {
    this.update({ symbol: trade.symbol, price: trade.price });
  }

  /**
   * Get latest price for a symbol. Returns null if no data.
   */
  getPrice(symbol: string): number | null {
    const quote = this.quotes.get(symbol);
    return quote ? quote.price : null;
  }

  /**
   * Get bid-ask spread in basis points.
   */
  getSpread(symbol: string): number | null {
    const quote = this.quotes.get(symbol);
    if (!quote || quote.price === 0) return null;
    return ((quote.ask - quote.bid) / quote.price) * 10000;
  }

  /**
   * Check if a quote is stale (older than threshold).
   */
  isStale(symbol: string): boolean {
    const quote = this.quotes.get(symbol);
    if (!quote) return true;
    return (Date.now() - quote.timestamp) > STALE_THRESHOLD_MS;
  }

  /**
   * Get all symbols with active (non-stale) quotes.
   */
  getActiveSymbols(): string[] {
    const active: string[] = [];
    for (const [symbol] of this.quotes) {
      if (!this.isStale(symbol)) {
        active.push(symbol);
      }
    }
    return active;
  }

  /**
   * Get the full cached quote for a symbol.
   */
  getQuote(symbol: string): CachedQuote | null {
    return this.quotes.get(symbol) || null;
  }

  /**
   * Get recent price history for a symbol.
   */
  getPriceHistory(symbol: string, limit?: number): { price: number; timestamp: number }[] {
    const history = this.priceHistories.get(symbol) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get average price over last N data points.
   */
  getAveragePrice(symbol: string, lookback: number = 20): number | null {
    const history = this.priceHistories.get(symbol);
    if (!history || history.length === 0) return null;
    const slice = history.slice(-lookback);
    return slice.reduce((sum, p) => sum + p.price, 0) / slice.length;
  }

  /**
   * Get price momentum (current vs average of last N).
   */
  getMomentum(symbol: string, lookback: number = 20): number | null {
    const currentPrice = this.getPrice(symbol);
    const avgPrice = this.getAveragePrice(symbol, lookback);
    if (currentPrice === null || avgPrice === null || avgPrice === 0) return null;
    return (currentPrice - avgPrice) / avgPrice;
  }

  /**
   * Get price volatility (standard deviation of returns) over last N points.
   */
  getVolatility(symbol: string, lookback: number = 50): number | null {
    const history = this.priceHistories.get(symbol);
    if (!history || history.length < 3) return null;
    const slice = history.slice(-lookback);

    const returns: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      if (slice[i - 1].price > 0) {
        returns.push((slice[i].price - slice[i - 1].price) / slice[i - 1].price);
      }
    }

    if (returns.length === 0) return null;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Get total number of tracked symbols.
   */
  getSymbolCount(): number {
    return this.quotes.size;
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.quotes.clear();
    this.priceHistories.clear();
  }
}
