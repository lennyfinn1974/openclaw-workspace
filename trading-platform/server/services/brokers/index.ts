// Unified Market Data Provider
// Coordinates multiple data sources with automatic fallback and caching

import { EventEmitter } from 'events';
import type {
  BrokerAdapter,
  FetchResult,
  MarketQuote,
  CandleData,
  OrderBookData,
  DataSource,
  AssetType,
} from './types';
import { yahooFinance, YahooFinanceAdapter } from './yahooFinance';
import { binance, BinanceAdapter } from './binance';
import { alpaca, AlpacaAdapter } from './alpaca';
import { isCryptoSymbol, isFxSymbol, isCommoditySymbol, isEodhdRestOnly, hasEodhdMapping, getEodhdRestPollSymbols, logMarketData, sleep } from './utils';
import { forexSimulator, ForexSimulator } from './forexSimulator';
import { commoditySimulator, CommoditySimulator } from './commoditySimulator';
import { EODHDWebSocketManager } from './eodhdWebSocket';
import { EODHDRestAdapter } from './eodhd';

export interface MarketDataConfig {
  enableLiveData: boolean;
  primaryStockSource: 'yahoo' | 'alpaca';
  primaryCryptoSource: 'binance';
  enableEodhd: boolean;
  cacheTtlMs: number;
  pollingIntervalMs: number;
  maxRetries: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  source: DataSource;
}

const DEFAULT_CONFIG: MarketDataConfig = {
  enableLiveData: true,
  primaryStockSource: 'yahoo',
  primaryCryptoSource: 'binance',
  enableEodhd: !!process.env.EODHD_API_KEY,
  cacheTtlMs: 5000, // 5 seconds for quotes
  pollingIntervalMs: 1000, // Poll every second
  maxRetries: 2,
};

export class MarketDataProvider extends EventEmitter {
  private config: MarketDataConfig;
  private quoteCache: Map<string, CacheEntry<MarketQuote>> = new Map();
  private candleCache: Map<string, CacheEntry<CandleData[]>> = new Map();
  private orderbookCache: Map<string, CacheEntry<OrderBookData>> = new Map();
  private subscribedSymbols: Set<string> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  private healthStatus: Map<DataSource, boolean> = new Map();

  // Adapters
  private yahooAdapter: YahooFinanceAdapter;
  private binanceAdapter: BinanceAdapter;
  private alpacaAdapter: AlpacaAdapter;
  private eodhdWsManager: EODHDWebSocketManager | null = null;
  private eodhdRestAdapter: EODHDRestAdapter | null = null;
  private eodhdRestPollTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<MarketDataConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.yahooAdapter = yahooFinance;
    this.binanceAdapter = binance;
    this.alpacaAdapter = alpaca;

    // Initialize health status
    this.healthStatus.set('yahoo', true);
    this.healthStatus.set('binance', true);
    this.healthStatus.set('alpaca', this.alpacaAdapter.isApiConfigured());
    this.healthStatus.set('eodhd', !!this.eodhdRestAdapter);
    this.healthStatus.set('simulated', true);

    logMarketData('provider', 'initialized', {
      enableLiveData: this.config.enableLiveData,
      primaryStockSource: this.config.primaryStockSource,
      primaryCryptoSource: this.config.primaryCryptoSource,
      eodhd: !!this.eodhdRestAdapter,
      eodhdWs: !!this.eodhdWsManager,
    });
  }

  private startEodhdRestPolling(): void {
    if (!this.eodhdRestAdapter) return;

    const restOnlySymbols = getEodhdRestPollSymbols();
    if (restOnlySymbols.length === 0) return;

    logMarketData('provider', 'eodhd-rest-polling-start', { symbols: restOnlySymbols });

    this.eodhdRestPollTimer = setInterval(async () => {
      for (const symbol of restOnlySymbols) {
        const result = await this.eodhdRestAdapter!.getQuote(symbol);
        if (result.success && result.data) {
          this.quoteCache.set(symbol.toUpperCase(), {
            data: result.data,
            timestamp: Date.now(),
            source: 'eodhd',
          });
          this.emit('quote', result.data);
        }
      }
    }, 15_000); // Poll every 15 seconds

    // Initial poll immediately
    (async () => {
      for (const symbol of restOnlySymbols) {
        const result = await this.eodhdRestAdapter!.getQuote(symbol);
        if (result.success && result.data) {
          this.quoteCache.set(symbol.toUpperCase(), {
            data: result.data,
            timestamp: Date.now(),
            source: 'eodhd',
          });
          this.emit('quote', result.data);
        }
      }
    })();
  }

  // Initialize EODHD adapters — call after env vars are loaded
  async initEodhd(): Promise<void> {
    const eodhdKey = process.env.EODHD_API_KEY;
    if (!eodhdKey || this.eodhdRestAdapter) return; // already initialized or no key

    this.eodhdRestAdapter = new EODHDRestAdapter(eodhdKey);
    this.eodhdWsManager = new EODHDWebSocketManager(eodhdKey);

    // Forward EODHD WS quotes to this provider's 'quote' event
    this.eodhdWsManager.on('quote', (quote: MarketQuote) => {
      this.quoteCache.set(quote.symbol.toUpperCase(), {
        data: quote,
        timestamp: Date.now(),
        source: 'eodhd',
      });
      this.emit('quote', quote);
    });

    // Connect EODHD WebSockets
    try {
      await this.eodhdWsManager.connect();
    } catch (err) {
      logMarketData('provider', 'eodhd-ws-connect-error', { error: String(err) });
    }

    // Start REST polling for symbols without WS coverage (CL, NG, HG)
    this.startEodhdRestPolling();

    this.healthStatus.set('eodhd', true);
    logMarketData('provider', 'eodhd-initialized', {
      wsConnected: this.eodhdWsManager.isConnected(),
      restPollSymbols: getEodhdRestPollSymbols(),
    });
  }

  isEodhdEnabled(): boolean {
    return !!this.eodhdRestAdapter;
  }

  // Determine asset type from symbol
  private getAssetType(symbol: string): AssetType {
    if (isCryptoSymbol(symbol)) return 'crypto';
    if (isFxSymbol(symbol)) return 'forex';
    if (isCommoditySymbol(symbol)) return 'commodity';
    return 'stock';
  }

  // Get appropriate adapter for symbol
  private getAdapter(symbol: string): BrokerAdapter {
    const assetType = this.getAssetType(symbol);

    // EODHD REST for symbols that are REST-only (CL, NG, HG)
    if (this.eodhdRestAdapter && isEodhdRestOnly(symbol)) {
      return this.eodhdRestAdapter;
    }

    // EODHD REST for FX and commodity symbols with EODHD mapping (WS handles streaming,
    // but REST provides candles and on-demand quotes)
    if (this.eodhdRestAdapter && hasEodhdMapping(symbol) && (assetType === 'forex' || assetType === 'commodity')) {
      return this.eodhdRestAdapter;
    }

    if (assetType === 'crypto') {
      // Keep Binance as primary for crypto; EODHD is fallback
      return this.binanceAdapter;
    }

    if (assetType === 'forex') {
      // EODHD failed or not available → fall back to simulator
      return forexSimulator;
    }

    if (assetType === 'commodity') {
      // Commodities without EODHD mapping (CL=F, NG=F) → Yahoo Finance
      return this.yahooAdapter;
    }

    // For stocks: EODHD if available, then Alpaca, then Yahoo
    if (this.eodhdRestAdapter && hasEodhdMapping(symbol)) {
      return this.eodhdRestAdapter;
    }

    if (this.config.primaryStockSource === 'alpaca' && this.alpacaAdapter.isApiConfigured()) {
      return this.alpacaAdapter;
    }

    return this.yahooAdapter;
  }

  // Get fallback adapter
  private getFallbackAdapter(symbol: string, failedSource: DataSource): BrokerAdapter | null {
    const assetType = this.getAssetType(symbol);

    if (assetType === 'stock') {
      if (failedSource === 'eodhd') return this.yahooAdapter;
      if (failedSource === 'yahoo' && this.alpacaAdapter.isApiConfigured()) return this.alpacaAdapter;
      if (failedSource === 'alpaca') return this.yahooAdapter;
    }

    if (assetType === 'forex') {
      // EODHD failed → fall back to simulator
      if (failedSource === 'eodhd') return forexSimulator;
    }

    if (assetType === 'commodity') {
      // EODHD failed → try Yahoo Finance; Yahoo failed → simulator
      if (failedSource === 'eodhd') return this.yahooAdapter;
      if (failedSource === 'yahoo') return commoditySimulator;
    }

    if (assetType === 'crypto') {
      // Binance failed → try EODHD if available
      if (failedSource === 'binance' && this.eodhdRestAdapter && hasEodhdMapping(symbol)) {
        return this.eodhdRestAdapter;
      }
    }

    return null;
  }

  // Check if cache entry is valid
  private isCacheValid<T>(entry: CacheEntry<T> | undefined, ttlMs: number): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < ttlMs;
  }

  // Fetch quote with caching and fallback
  async getQuote(symbol: string): Promise<FetchResult<MarketQuote>> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = this.quoteCache.get(upperSymbol);
    if (this.isCacheValid(cached, this.config.cacheTtlMs)) {
      return {
        success: true,
        data: cached!.data,
        source: cached!.source,
        latencyMs: 0,
      };
    }

    if (!this.config.enableLiveData) {
      return {
        success: false,
        error: 'Live data disabled',
        source: 'simulated',
        latencyMs: 0,
      };
    }

    const adapter = this.getAdapter(upperSymbol);
    let result = await adapter.getQuote(upperSymbol);

    // Try fallback if primary fails
    if (!result.success) {
      const fallback = this.getFallbackAdapter(upperSymbol, adapter.name);
      if (fallback) {
        logMarketData('provider', 'fallback', {
          symbol: upperSymbol,
          from: adapter.name,
          to: fallback.name,
        });
        result = await fallback.getQuote(upperSymbol);
      }
    }

    // Cache successful results
    if (result.success && result.data) {
      this.quoteCache.set(upperSymbol, {
        data: result.data,
        timestamp: Date.now(),
        source: result.source,
      });
    }

    return result;
  }

  // Fetch candles with caching
  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<FetchResult<CandleData[]>> {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `${upperSymbol}:${timeframe}`;

    // Longer cache for candles (30 seconds)
    const cached = this.candleCache.get(cacheKey);
    if (this.isCacheValid(cached, 30000)) {
      return {
        success: true,
        data: cached!.data,
        source: cached!.source,
        latencyMs: 0,
      };
    }

    if (!this.config.enableLiveData) {
      return {
        success: false,
        error: 'Live data disabled',
        source: 'simulated',
        latencyMs: 0,
      };
    }

    const adapter = this.getAdapter(upperSymbol);
    let result = await adapter.getCandles(upperSymbol, timeframe, limit);

    // Try fallback if primary fails
    if (!result.success) {
      const fallback = this.getFallbackAdapter(upperSymbol, adapter.name);
      if (fallback) {
        result = await fallback.getCandles(upperSymbol, timeframe, limit);
      }
    }

    // Cache successful results
    if (result.success && result.data) {
      this.candleCache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
        source: result.source,
      });
    }

    return result;
  }

  // Fetch order book with caching
  async getOrderBook(symbol: string, levels: number = 10): Promise<FetchResult<OrderBookData>> {
    const upperSymbol = symbol.toUpperCase();

    // Short cache for order book (2 seconds)
    const cached = this.orderbookCache.get(upperSymbol);
    if (this.isCacheValid(cached, 2000)) {
      return {
        success: true,
        data: cached!.data,
        source: cached!.source,
        latencyMs: 0,
      };
    }

    if (!this.config.enableLiveData) {
      return {
        success: false,
        error: 'Live data disabled',
        source: 'simulated',
        latencyMs: 0,
      };
    }

    const assetType = this.getAssetType(upperSymbol);

    // Use Binance for crypto (has real order book)
    if (assetType === 'crypto') {
      const result = await this.binanceAdapter.getOrderBook(upperSymbol, levels);
      if (result.success && result.data) {
        this.orderbookCache.set(upperSymbol, {
          data: result.data,
          timestamp: Date.now(),
          source: result.source,
        });
      }
      return result;
    }

    // For stocks, try Alpaca first if configured
    if (this.alpacaAdapter.isApiConfigured()) {
      const result = await this.alpacaAdapter.getOrderBook(upperSymbol, levels);
      if (result.success && result.data) {
        this.orderbookCache.set(upperSymbol, {
          data: result.data,
          timestamp: Date.now(),
          source: result.source,
        });
      }
      return result;
    }

    // No order book available for stocks without Alpaca
    return {
      success: false,
      error: 'Order book not available - configure Alpaca API for stock order books',
      source: 'simulated',
      latencyMs: 0,
    };
  }

  // Subscribe to real-time updates for symbols
  subscribe(symbols: string[]): void {
    for (const symbol of symbols) {
      this.subscribedSymbols.add(symbol.toUpperCase());
    }

    // Start polling if not already running
    if (!this.pollingInterval && this.subscribedSymbols.size > 0) {
      this.startPolling();
    }

    logMarketData('provider', 'subscribe', {
      symbols,
      totalSubscribed: this.subscribedSymbols.size,
    });
  }

  // Unsubscribe from symbols
  unsubscribe(symbols: string[]): void {
    for (const symbol of symbols) {
      this.subscribedSymbols.delete(symbol.toUpperCase());
    }

    // Stop polling if no subscriptions
    if (this.subscribedSymbols.size === 0) {
      this.stopPolling();
    }

    logMarketData('provider', 'unsubscribe', {
      symbols,
      totalSubscribed: this.subscribedSymbols.size,
    });
  }

  // Start polling for subscribed symbols
  private startPolling(): void {
    if (this.pollingInterval) return;

    logMarketData('provider', 'startPolling', {
      intervalMs: this.config.pollingIntervalMs,
    });

    this.pollingInterval = setInterval(async () => {
      await this.pollSubscribedSymbols();
    }, this.config.pollingIntervalMs);
  }

  // Stop polling
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logMarketData('provider', 'stopPolling', {});
    }
  }

  // Poll all subscribed symbols
  private async pollSubscribedSymbols(): Promise<void> {
    const symbols = Array.from(this.subscribedSymbols);

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (symbol) => {
          const result = await this.getQuote(symbol);
          if (result.success && result.data) {
            this.emit('quote', result.data);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await sleep(100);
      }
    }
  }

  // Health check for all adapters
  async checkHealth(): Promise<Map<DataSource, boolean>> {
    const checks: Promise<boolean>[] = [
      this.yahooAdapter.isHealthy(),
      this.binanceAdapter.isHealthy(),
      this.alpacaAdapter.isHealthy(),
    ];

    if (this.eodhdRestAdapter) {
      checks.push(this.eodhdRestAdapter.isHealthy());
    }

    const results = await Promise.all(checks);

    this.healthStatus.set('yahoo', results[0]);
    this.healthStatus.set('binance', results[1]);
    this.healthStatus.set('alpaca', results[2]);
    if (this.eodhdRestAdapter) {
      this.healthStatus.set('eodhd', results[3]);
    }

    const eodhdWsConnected = this.eodhdWsManager?.isConnected() ?? false;

    logMarketData('provider', 'healthCheck', {
      yahoo: results[0],
      binance: results[1],
      alpaca: results[2],
      eodhdRest: this.eodhdRestAdapter ? results[3] : 'not configured',
      eodhdWs: eodhdWsConnected,
    });

    return this.healthStatus;
  }

  // Get current health status
  getHealthStatus(): Map<DataSource, boolean> {
    return new Map(this.healthStatus);
  }

  // Clear all caches
  clearCache(): void {
    this.quoteCache.clear();
    this.candleCache.clear();
    this.orderbookCache.clear();
    logMarketData('provider', 'clearCache', {});
  }

  // Get statistics
  getStats(): {
    subscribedSymbols: number;
    cachedQuotes: number;
    cachedCandles: number;
    cachedOrderbooks: number;
    healthStatus: Record<string, boolean>;
    eodhdWs?: Record<string, { connected: boolean; messages: number; lastMessage: number }>;
  } {
    return {
      subscribedSymbols: this.subscribedSymbols.size,
      cachedQuotes: this.quoteCache.size,
      cachedCandles: this.candleCache.size,
      cachedOrderbooks: this.orderbookCache.size,
      healthStatus: Object.fromEntries(this.healthStatus),
      ...(this.eodhdWsManager ? { eodhdWs: this.eodhdWsManager.getStats() } : {}),
    };
  }

  // Shutdown
  shutdown(): void {
    this.stopPolling();
    if (this.eodhdRestPollTimer) {
      clearInterval(this.eodhdRestPollTimer);
      this.eodhdRestPollTimer = null;
    }
    if (this.eodhdWsManager) {
      this.eodhdWsManager.shutdown();
    }
    this.clearCache();
    this.subscribedSymbols.clear();
    logMarketData('provider', 'shutdown', {});
  }
}

// Export adapters
export { yahooFinance, binance, alpaca };

// Export types
export * from './types';

// Create and export default provider instance
export const marketDataProvider = new MarketDataProvider();
