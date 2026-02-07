// EODHD REST Adapter — handles real-time quotes and intraday candles via REST API
// Used for commodity futures (CL, NG, HG) without WebSocket coverage, and as candle source

import type {
  BrokerAdapter,
  DataSource,
  FetchResult,
  MarketQuote,
  CandleData,
  EODHDRealTimeResponse,
  EODHDIntradayBar,
} from './types';
import { RateLimiter, fetchWithTimeout, logMarketData, getEodhdRestSymbol, getEodhdInterval } from './utils';

const EODHD_BASE = 'https://eodhd.com';

export class EODHDRestAdapter implements BrokerAdapter {
  name: DataSource = 'eodhd';
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // EODHD: 1000 req/min, 100K/day. Use conservative limit.
    this.rateLimiter = new RateLimiter({
      maxRequests: 50, // per window — conservative burst limit
      windowMs: 60_000,
      retryAfterMs: 2_000,
    });
  }

  async getQuote(symbol: string): Promise<FetchResult<MarketQuote>> {
    const start = Date.now();
    const restSymbol = getEodhdRestSymbol(symbol);
    if (!restSymbol) {
      return { success: false, error: `No EODHD mapping for ${symbol}`, source: 'eodhd', latencyMs: 0 };
    }

    if (!this.rateLimiter.consumeToken()) {
      return { success: false, error: 'EODHD rate limit exceeded', source: 'eodhd', latencyMs: 0 };
    }

    try {
      const url = `${EODHD_BASE}/api/real-time/${restSymbol}?api_token=${this.apiKey}&fmt=json`;
      const response = await fetchWithTimeout(url, {}, 8000);

      if (!response.ok) {
        return { success: false, error: `EODHD HTTP ${response.status}`, source: 'eodhd', latencyMs: Date.now() - start };
      }

      const data = (await response.json()) as EODHDRealTimeResponse;
      const latencyMs = Date.now() - start;

      const quote: MarketQuote = {
        symbol,
        bid: data.close * 0.9999,
        bidSize: 100,
        ask: data.close * 1.0001,
        askSize: 100,
        last: data.close,
        lastSize: 10,
        volume: data.volume || 0,
        change: data.change || 0,
        changePercent: data.change_p || 0,
        high: data.high || data.close,
        low: data.low || data.close,
        open: data.open || data.close,
        previousClose: data.previousClose || data.close,
        timestamp: new Date(data.timestamp ? data.timestamp * 1000 : Date.now()),
      };

      logMarketData('eodhd-rest', 'quote', { symbol, restSymbol, price: data.close, latencyMs });
      return { success: true, data: quote, source: 'eodhd', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      logMarketData('eodhd-rest', 'quote-error', { symbol, error: (error as Error).message });
      return { success: false, error: (error as Error).message, source: 'eodhd', latencyMs };
    }
  }

  async getCandles(symbol: string, interval: string, limit: number): Promise<FetchResult<CandleData[]>> {
    const start = Date.now();
    const restSymbol = getEodhdRestSymbol(symbol);
    if (!restSymbol) {
      return { success: false, error: `No EODHD mapping for ${symbol}`, source: 'eodhd', latencyMs: 0 };
    }

    if (!this.rateLimiter.consumeToken()) {
      return { success: false, error: 'EODHD rate limit exceeded', source: 'eodhd', latencyMs: 0 };
    }

    try {
      const eodhdInterval = getEodhdInterval(interval);
      const url = `${EODHD_BASE}/api/intraday/${restSymbol}?api_token=${this.apiKey}&fmt=json&interval=${eodhdInterval}`;
      const response = await fetchWithTimeout(url, {}, 10000);

      if (!response.ok) {
        return { success: false, error: `EODHD HTTP ${response.status}`, source: 'eodhd', latencyMs: Date.now() - start };
      }

      const data = (await response.json()) as EODHDIntradayBar[];
      const latencyMs = Date.now() - start;

      if (!Array.isArray(data)) {
        return { success: false, error: 'Invalid EODHD response', source: 'eodhd', latencyMs };
      }

      const candles: CandleData[] = data.slice(-limit).map(bar => ({
        time: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0,
      }));

      logMarketData('eodhd-rest', 'candles', { symbol, interval, count: candles.length, latencyMs });
      return { success: true, data: candles, source: 'eodhd', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      logMarketData('eodhd-rest', 'candles-error', { symbol, error: (error as Error).message });
      return { success: false, error: (error as Error).message, source: 'eodhd', latencyMs };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Lightweight check with a single symbol
      const url = `${EODHD_BASE}/api/real-time/AAPL.US?api_token=${this.apiKey}&fmt=json`;
      const response = await fetchWithTimeout(url, {}, 5000);
      return response.ok;
    } catch {
      return false;
    }
  }
}
