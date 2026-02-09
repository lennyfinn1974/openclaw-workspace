// Yahoo Finance adapter for stock market data
// Free real-time quotes and historical data

import type {
  BrokerAdapter,
  FetchResult,
  MarketQuote,
  CandleData,
  DataSource,
  YahooChartResult,
} from './types';
import {
  RateLimiter,
  fetchWithTimeout,
  fetchWithRetry,
  validateSymbol,
  sanitizeSymbol,
  getYahooInterval,
  formatPrice,
  logMarketData,
  classifyError,
  YAHOO_USER_AGENT,
} from './utils';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com';

// Rate limit: ~2000 requests/hour (conservative estimate)
const rateLimiter = new RateLimiter({
  maxRequests: 100,      // 100 requests
  windowMs: 60 * 1000,   // per minute
  retryAfterMs: 1000,
});

export class YahooFinanceAdapter implements BrokerAdapter {
  name: DataSource = 'yahoo';
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

    const cleanSymbol = sanitizeSymbol(symbol);

    try {
      const url = `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=1d&range=1d&includePrePost=true`;

      const response = await fetchWithRetry(
        () => fetchWithTimeout(url, {
          headers: {
            'User-Agent': YAHOO_USER_AGENT,
            'Accept': 'application/json',
          },
        }, 10000),
        2,
        500
      );

      if (!response.ok) {
        throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
      }

      const data: YahooChartResult = await response.json();

      if (data.chart.error) {
        throw new Error(`Yahoo API error: ${data.chart.error.description}`);
      }

      const result = data.chart.result?.[0];
      if (!result) {
        throw new Error(`No data found for symbol: ${cleanSymbol}`);
      }

      const meta = result.meta;
      const quote = result.indicators.quote[0];
      const lastIdx = quote.close.length - 1;

      // Get last valid price
      let lastPrice = meta.regularMarketPrice;
      if (!lastPrice && quote.close[lastIdx] !== null) {
        lastPrice = quote.close[lastIdx];
      }

      const change = lastPrice - meta.previousClose;
      const changePercent = meta.previousClose > 0
        ? (change / meta.previousClose) * 100
        : 0;

      // Estimate bid/ask from last price (Yahoo doesn't provide real bid/ask for free)
      const spreadBps = 2; // 2 basis points estimate
      const spreadFactor = spreadBps / 10000;

      const marketQuote: MarketQuote = {
        symbol: cleanSymbol,
        bid: formatPrice(lastPrice * (1 - spreadFactor)),
        bidSize: 100, // Estimated
        ask: formatPrice(lastPrice * (1 + spreadFactor)),
        askSize: 100, // Estimated
        last: formatPrice(lastPrice),
        lastSize: 100, // Estimated
        volume: meta.regularMarketVolume || 0,
        change: formatPrice(change),
        changePercent: Number(changePercent.toFixed(2)),
        high: formatPrice(meta.regularMarketDayHigh || lastPrice),
        low: formatPrice(meta.regularMarketDayLow || lastPrice),
        open: formatPrice(meta.regularMarketOpen || lastPrice),
        previousClose: formatPrice(meta.previousClose || lastPrice),
        timestamp: new Date(),
      };

      logMarketData('yahoo', 'quote', { symbol: cleanSymbol, price: lastPrice });

      return {
        success: true,
        data: marketQuote,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = classifyError(err);

      logMarketData('yahoo', 'error', {
        symbol: cleanSymbol,
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

    const cleanSymbol = sanitizeSymbol(symbol);
    const { interval, range } = getYahooInterval(timeframe);

    try {
      const url = `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=${interval}&range=${range}&includePrePost=false`;

      const response = await fetchWithRetry(
        () => fetchWithTimeout(url, {
          headers: {
            'User-Agent': YAHOO_USER_AGENT,
            'Accept': 'application/json',
          },
        }, 15000),
        2,
        500
      );

      if (!response.ok) {
        throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
      }

      const data: YahooChartResult = await response.json();

      if (data.chart.error) {
        throw new Error(`Yahoo API error: ${data.chart.error.description}`);
      }

      const result = data.chart.result?.[0];
      if (!result || !result.timestamp) {
        throw new Error(`No candle data found for symbol: ${cleanSymbol}`);
      }

      const { timestamp, indicators } = result;
      const quote = indicators.quote[0];

      const candles: CandleData[] = [];
      const startIdx = Math.max(0, timestamp.length - limit);

      for (let i = startIdx; i < timestamp.length; i++) {
        // Skip candles with null values
        if (
          quote.open[i] === null ||
          quote.high[i] === null ||
          quote.low[i] === null ||
          quote.close[i] === null
        ) {
          continue;
        }

        candles.push({
          time: timestamp[i],
          open: formatPrice(quote.open[i]),
          high: formatPrice(quote.high[i]),
          low: formatPrice(quote.low[i]),
          close: formatPrice(quote.close[i]),
          volume: quote.volume[i] || 0,
        });
      }

      logMarketData('yahoo', 'candles', {
        symbol: cleanSymbol,
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

      logMarketData('yahoo', 'error', {
        symbol: cleanSymbol,
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
      const result = await this.getQuote('AAPL');
      const healthy = result.success;
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
export const yahooFinance = new YahooFinanceAdapter();
