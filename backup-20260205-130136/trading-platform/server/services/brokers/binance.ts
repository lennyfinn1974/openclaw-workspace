// Binance adapter for cryptocurrency market data
// Real-time prices, candles, and order book data

import type {
  BrokerAdapter,
  FetchResult,
  MarketQuote,
  CandleData,
  OrderBookData,
  DataSource,
  BinanceTicker,
  BinanceKline,
  BinanceOrderBook,
} from './types';
import {
  RateLimiter,
  fetchWithTimeout,
  fetchWithRetry,
  validateSymbol,
  getBinanceSymbol,
  getBinanceInterval,
  formatPrice,
  calculateSpread,
  logMarketData,
  classifyError,
} from './utils';

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

// Binance rate limits: 1200 requests/minute for most endpoints
const rateLimiter = new RateLimiter({
  maxRequests: 500,       // Conservative: 500 requests
  windowMs: 60 * 1000,    // per minute
  retryAfterMs: 500,
});

export class BinanceAdapter implements BrokerAdapter {
  name: DataSource = 'binance';
  private lastHealthCheck: { healthy: boolean; timestamp: number } | null = null;
  private healthCheckInterval = 60000; // 1 minute

  async getQuote(symbol: string): Promise<FetchResult<MarketQuote>> {
    const startTime = Date.now();

    if (!validateSymbol(symbol)) {
      return {
        success: false,
        error: `Invalid symbol: ${symbol}`,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

    if (!rateLimiter.consumeToken()) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

    const binanceSymbol = getBinanceSymbol(symbol);

    try {
      const url = `${BINANCE_BASE_URL}/ticker/24hr?symbol=${binanceSymbol}`;

      const response = await fetchWithRetry(
        () => fetchWithTimeout(url, {
          headers: { 'Accept': 'application/json' },
        }, 10000),
        2,
        500
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error: ${response.status} - ${errorText}`);
      }

      const data: BinanceTicker = await response.json();

      const lastPrice = parseFloat(data.lastPrice);
      const bidPrice = parseFloat(data.bidPrice);
      const askPrice = parseFloat(data.askPrice);
      const { spread, spreadPercent } = calculateSpread(bidPrice, askPrice);

      const marketQuote: MarketQuote = {
        symbol: symbol.toUpperCase(),
        bid: formatPrice(bidPrice),
        bidSize: parseInt(data.bidQty) || 0,
        ask: formatPrice(askPrice),
        askSize: parseInt(data.askQty) || 0,
        last: formatPrice(lastPrice),
        lastSize: 0, // Not provided in ticker
        volume: parseFloat(data.volume) || 0,
        change: formatPrice(parseFloat(data.priceChange)),
        changePercent: Number(parseFloat(data.priceChangePercent).toFixed(2)),
        high: formatPrice(parseFloat(data.highPrice)),
        low: formatPrice(parseFloat(data.lowPrice)),
        open: formatPrice(parseFloat(data.openPrice)),
        previousClose: formatPrice(parseFloat(data.openPrice)), // Binance uses open as prev close
        timestamp: new Date(),
      };

      logMarketData('binance', 'quote', { symbol: binanceSymbol, price: lastPrice });

      return {
        success: true,
        data: marketQuote,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = classifyError(err);

      logMarketData('binance', 'error', {
        symbol: binanceSymbol,
        error: err.message,
        type: errorType,
      });

      return {
        success: false,
        error: err.message,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async getCandles(symbol: string, timeframe: string, limit: number): Promise<FetchResult<CandleData[]>> {
    const startTime = Date.now();

    if (!validateSymbol(symbol)) {
      return {
        success: false,
        error: `Invalid symbol: ${symbol}`,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

    if (!rateLimiter.consumeToken()) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

    const binanceSymbol = getBinanceSymbol(symbol);
    const interval = getBinanceInterval(timeframe);
    const candleLimit = Math.min(limit, 1000); // Binance max is 1000

    try {
      const url = `${BINANCE_BASE_URL}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${candleLimit}`;

      const response = await fetchWithRetry(
        () => fetchWithTimeout(url, {
          headers: { 'Accept': 'application/json' },
        }, 15000),
        2,
        500
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error: ${response.status} - ${errorText}`);
      }

      const data: BinanceKline[] = await response.json();

      const candles: CandleData[] = data.map((kline) => ({
        time: Math.floor(kline[0] / 1000), // Convert ms to seconds
        open: formatPrice(parseFloat(kline[1])),
        high: formatPrice(parseFloat(kline[2])),
        low: formatPrice(parseFloat(kline[3])),
        close: formatPrice(parseFloat(kline[4])),
        volume: parseFloat(kline[5]),
      }));

      logMarketData('binance', 'candles', {
        symbol: binanceSymbol,
        timeframe,
        count: candles.length,
      });

      return {
        success: true,
        data: candles,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = classifyError(err);

      logMarketData('binance', 'error', {
        symbol: binanceSymbol,
        error: err.message,
        type: errorType,
      });

      return {
        success: false,
        error: err.message,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async getOrderBook(symbol: string, levels: number = 10): Promise<FetchResult<OrderBookData>> {
    const startTime = Date.now();

    if (!validateSymbol(symbol)) {
      return {
        success: false,
        error: `Invalid symbol: ${symbol}`,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

    if (!rateLimiter.consumeToken()) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

    const binanceSymbol = getBinanceSymbol(symbol);
    // Binance depth limits: 5, 10, 20, 50, 100, 500, 1000, 5000
    const depthLimit = Math.min(Math.max(levels, 5), 100);

    try {
      const url = `${BINANCE_BASE_URL}/depth?symbol=${binanceSymbol}&limit=${depthLimit}`;

      const response = await fetchWithRetry(
        () => fetchWithTimeout(url, {
          headers: { 'Accept': 'application/json' },
        }, 10000),
        2,
        500
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error: ${response.status} - ${errorText}`);
      }

      const data: BinanceOrderBook = await response.json();

      const bids = data.bids.slice(0, levels).map(([price, size]) => ({
        price: formatPrice(parseFloat(price)),
        size: parseFloat(size),
        orders: 1, // Binance doesn't provide order count
      }));

      const asks = data.asks.slice(0, levels).map(([price, size]) => ({
        price: formatPrice(parseFloat(price)),
        size: parseFloat(size),
        orders: 1,
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 0;
      const { spread, spreadPercent } = calculateSpread(bestBid, bestAsk);

      const orderBook: OrderBookData = {
        symbol: symbol.toUpperCase(),
        bids,
        asks,
        spread,
        spreadPercent,
        timestamp: new Date(),
      };

      logMarketData('binance', 'orderbook', {
        symbol: binanceSymbol,
        levels: bids.length,
        spread,
      });

      return {
        success: true,
        data: orderBook,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = classifyError(err);

      logMarketData('binance', 'error', {
        symbol: binanceSymbol,
        error: err.message,
        type: errorType,
      });

      return {
        success: false,
        error: err.message,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    // Cache health check for 1 minute
    if (
      this.lastHealthCheck &&
      Date.now() - this.lastHealthCheck.timestamp < this.healthCheckInterval
    ) {
      return this.lastHealthCheck.healthy;
    }

    try {
      // Use ping endpoint for health check
      const response = await fetchWithTimeout(
        `${BINANCE_BASE_URL}/ping`,
        { headers: { 'Accept': 'application/json' } },
        5000
      );
      const healthy = response.ok;
      this.lastHealthCheck = { healthy, timestamp: Date.now() };
      return healthy;
    } catch {
      this.lastHealthCheck = { healthy: false, timestamp: Date.now() };
      return false;
    }
  }

  getRemainingRequests(): number {
    return rateLimiter.getRemainingTokens();
  }
}

// Singleton instance
export const binance = new BinanceAdapter();
