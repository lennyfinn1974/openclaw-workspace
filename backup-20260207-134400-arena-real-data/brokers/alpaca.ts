// Alpaca adapter for stock market data and order book
// Requires API keys for full access, but provides paper trading and live data

import type {
  BrokerAdapter,
  FetchResult,
  MarketQuote,
  CandleData,
  OrderBookData,
  DataSource,
  AlpacaQuote,
  AlpacaBar,
  AlpacaTrade,
} from './types';
import {
  RateLimiter,
  fetchWithTimeout,
  fetchWithRetry,
  validateSymbol,
  sanitizeSymbol,
  formatPrice,
  calculateSpread,
  logMarketData,
  classifyError,
} from './utils';

// Alpaca endpoints - configurable for paper vs live trading
const ALPACA_DATA_URL = process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets/v2';
const ALPACA_API_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET || '';

// Alpaca rate limits: 200 requests/minute for free tier
const rateLimiter = new RateLimiter({
  maxRequests: 150,       // Conservative limit
  windowMs: 60 * 1000,    // per minute
  retryAfterMs: 1000,
});

export class AlpacaAdapter implements BrokerAdapter {
  name: DataSource = 'alpaca';
  private lastHealthCheck: { healthy: boolean; timestamp: number } | null = null;
  private healthCheckInterval = 60000; // 1 minute
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(ALPACA_API_KEY && ALPACA_API_SECRET);
    if (!this.isConfigured) {
      console.warn('[alpaca] API keys not configured - Alpaca adapter will return errors');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      'Accept': 'application/json',
    };
  }

  async getQuote(symbol: string): Promise<FetchResult<MarketQuote>> {
    const startTime = Date.now();

    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Alpaca API keys not configured',
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

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
      // Get latest quote and trade in parallel
      const [quoteResponse, tradeResponse] = await Promise.all([
        fetchWithRetry(
          () => fetchWithTimeout(
            `${ALPACA_DATA_URL}/stocks/${cleanSymbol}/quotes/latest`,
            { headers: this.getAuthHeaders() },
            10000
          ),
          2,
          500
        ),
        fetchWithRetry(
          () => fetchWithTimeout(
            `${ALPACA_DATA_URL}/stocks/${cleanSymbol}/trades/latest`,
            { headers: this.getAuthHeaders() },
            10000
          ),
          2,
          500
        ),
      ]);

      if (!quoteResponse.ok) {
        throw new Error(`Alpaca quote error: ${quoteResponse.status}`);
      }

      const quoteData = await quoteResponse.json();
      const quote: AlpacaQuote = quoteData.quote;

      let lastPrice = quote.ap; // Default to ask price
      let lastSize = 0;

      if (tradeResponse.ok) {
        const tradeData = await tradeResponse.json();
        const trade: AlpacaTrade = tradeData.trade;
        lastPrice = trade.p;
        lastSize = trade.s;
      }

      // Get daily bar for OHLC data
      const barResponse = await fetchWithTimeout(
        `${ALPACA_DATA_URL}/stocks/${cleanSymbol}/bars/latest?timeframe=1Day`,
        { headers: this.getAuthHeaders() },
        10000
      );

      let open = lastPrice;
      let high = lastPrice;
      let low = lastPrice;
      let volume = 0;
      let previousClose = lastPrice;

      if (barResponse.ok) {
        const barData = await barResponse.json();
        const bar: AlpacaBar = barData.bar;
        open = bar.o;
        high = bar.h;
        low = bar.l;
        volume = bar.v;
        previousClose = bar.c; // Previous day's close
      }

      const change = lastPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
      const { spread, spreadPercent } = calculateSpread(quote.bp, quote.ap);

      const marketQuote: MarketQuote = {
        symbol: cleanSymbol,
        bid: formatPrice(quote.bp),
        bidSize: quote.bs,
        ask: formatPrice(quote.ap),
        askSize: quote.as,
        last: formatPrice(lastPrice),
        lastSize,
        volume,
        change: formatPrice(change),
        changePercent: Number(changePercent.toFixed(2)),
        high: formatPrice(high),
        low: formatPrice(low),
        open: formatPrice(open),
        previousClose: formatPrice(previousClose),
        timestamp: new Date(),
      };

      logMarketData('alpaca', 'quote', { symbol: cleanSymbol, price: lastPrice });

      return {
        success: true,
        data: marketQuote,
        source: this.name,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorType = classifyError(err);

      logMarketData('alpaca', 'error', {
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

    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Alpaca API keys not configured',
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

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
    const alpacaTimeframe = this.getAlpacaTimeframe(timeframe);

    try {
      // Calculate start date based on timeframe and limit
      const end = new Date();
      const start = this.calculateStartDate(timeframe, limit);

      const url = new URL(`${ALPACA_DATA_URL}/stocks/${cleanSymbol}/bars`);
      url.searchParams.set('timeframe', alpacaTimeframe);
      url.searchParams.set('start', start.toISOString());
      url.searchParams.set('end', end.toISOString());
      url.searchParams.set('limit', String(Math.min(limit, 10000)));
      url.searchParams.set('adjustment', 'split'); // Adjust for splits

      const response = await fetchWithRetry(
        () => fetchWithTimeout(url.toString(), { headers: this.getAuthHeaders() }, 15000),
        2,
        500
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alpaca API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const bars: AlpacaBar[] = data.bars || [];

      const candles: CandleData[] = bars.map((bar) => ({
        time: Math.floor(new Date(bar.t).getTime() / 1000),
        open: formatPrice(bar.o),
        high: formatPrice(bar.h),
        low: formatPrice(bar.l),
        close: formatPrice(bar.c),
        volume: bar.v,
      }));

      logMarketData('alpaca', 'candles', {
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

      logMarketData('alpaca', 'error', {
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

  async getOrderBook(symbol: string, levels: number = 10): Promise<FetchResult<OrderBookData>> {
    const startTime = Date.now();

    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Alpaca API keys not configured',
        source: this.name,
        latencyMs: Date.now() - startTime,
      };
    }

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
      // Alpaca doesn't provide full order book via REST API
      // Instead, we fetch the latest NBBO (National Best Bid and Offer)
      // and recent trades to estimate depth
      const quoteResponse = await fetchWithRetry(
        () => fetchWithTimeout(
          `${ALPACA_DATA_URL}/stocks/${cleanSymbol}/quotes/latest`,
          { headers: this.getAuthHeaders() },
          10000
        ),
        2,
        500
      );

      if (!quoteResponse.ok) {
        throw new Error(`Alpaca API error: ${quoteResponse.status}`);
      }

      const quoteData = await quoteResponse.json();
      const quote: AlpacaQuote = quoteData.quote;

      // Generate synthetic order book levels from NBBO
      // In production, you'd use Alpaca's WebSocket for real-time order book
      const bidPrice = quote.bp;
      const askPrice = quote.ap;
      const tickSize = bidPrice >= 1 ? 0.01 : 0.0001;

      const bids = Array.from({ length: levels }, (_, i) => ({
        price: formatPrice(bidPrice - i * tickSize),
        size: Math.floor(quote.bs * (1 - i * 0.1)),
        orders: Math.max(1, Math.floor(Math.random() * 10)),
      }));

      const asks = Array.from({ length: levels }, (_, i) => ({
        price: formatPrice(askPrice + i * tickSize),
        size: Math.floor(quote.as * (1 - i * 0.1)),
        orders: Math.max(1, Math.floor(Math.random() * 10)),
      }));

      const { spread, spreadPercent } = calculateSpread(bidPrice, askPrice);

      const orderBook: OrderBookData = {
        symbol: cleanSymbol,
        bids,
        asks,
        spread,
        spreadPercent,
        timestamp: new Date(),
      };

      logMarketData('alpaca', 'orderbook', {
        symbol: cleanSymbol,
        levels,
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

      logMarketData('alpaca', 'error', {
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

  private getAlpacaTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1Min',
      '5m': '5Min',
      '15m': '15Min',
      '30m': '30Min',
      '1h': '1Hour',
      '4h': '4Hour',
      '1d': '1Day',
      '1w': '1Week',
    };
    return map[timeframe] || '1Day';
  }

  private calculateStartDate(timeframe: string, limit: number): Date {
    const now = new Date();
    const msMultipliers: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
    };

    const multiplier = msMultipliers[timeframe] || msMultipliers['1d'];
    return new Date(now.getTime() - limit * multiplier * 1.5); // Add buffer
  }

  async isHealthy(): Promise<boolean> {
    // Cache health check for 1 minute
    if (
      this.lastHealthCheck &&
      Date.now() - this.lastHealthCheck.timestamp < this.healthCheckInterval
    ) {
      return this.lastHealthCheck.healthy;
    }

    if (!this.isConfigured) {
      this.lastHealthCheck = { healthy: false, timestamp: Date.now() };
      return false;
    }

    try {
      const response = await fetchWithTimeout(
        `${ALPACA_DATA_URL}/stocks/AAPL/quotes/latest`,
        { headers: this.getAuthHeaders() },
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

  isApiConfigured(): boolean {
    return this.isConfigured;
  }

  getRemainingRequests(): number {
    return rateLimiter.getRemainingTokens();
  }
}

// Singleton instance
export const alpaca = new AlpacaAdapter();
