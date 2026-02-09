// Broker adapter types for live market data integration

export interface MarketQuote {
  symbol: string;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
  last: number;
  lastSize: number;
  volume: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders?: number;
}

export interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  timestamp: Date;
}

export type AssetType = 'stock' | 'crypto' | 'forex' | 'commodity';
export type DataSource = 'yahoo' | 'binance' | 'alpaca' | 'simulated';

export interface SymbolMapping {
  symbol: string;
  assetType: AssetType;
  yahooSymbol?: string;
  binanceSymbol?: string;
  alpacaSymbol?: string;
  coingeckoId?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs: number;
}

export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: DataSource;
  latencyMs: number;
}

export interface BrokerAdapter {
  name: DataSource;
  getQuote(symbol: string): Promise<FetchResult<MarketQuote>>;
  getCandles(symbol: string, interval: string, limit: number): Promise<FetchResult<CandleData[]>>;
  getOrderBook?(symbol: string, levels: number): Promise<FetchResult<OrderBookData>>;
  isHealthy(): Promise<boolean>;
}

// Yahoo Finance specific types
export interface YahooChartResult {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        regularMarketPrice: number;
        previousClose: number;
        regularMarketDayHigh: number;
        regularMarketDayLow: number;
        regularMarketOpen: number;
        regularMarketVolume: number;
        currency: string;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }>;
    error?: { code: string; description: string };
  };
}

// Binance specific types
export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
}

export interface BinanceKline {
  0: number;   // Open time
  1: string;   // Open
  2: string;   // High
  3: string;   // Low
  4: string;   // Close
  5: string;   // Volume
  6: number;   // Close time
  7: string;   // Quote volume
  8: number;   // Number of trades
  9: string;   // Taker buy base volume
  10: string;  // Taker buy quote volume
  11: string;  // Ignore
}

export interface BinanceOrderBook {
  lastUpdateId: number;
  bids: [string, string][];  // [price, quantity]
  asks: [string, string][];
}

// Alpaca specific types
export interface AlpacaQuote {
  t: string;   // timestamp
  ax: string;  // ask exchange
  ap: number;  // ask price
  as: number;  // ask size
  bx: string;  // bid exchange
  bp: number;  // bid price
  bs: number;  // bid size
}

export interface AlpacaBar {
  t: string;   // timestamp
  o: number;   // open
  h: number;   // high
  l: number;   // low
  c: number;   // close
  v: number;   // volume
  n: number;   // number of trades
  vw: number;  // volume weighted average price
}

export interface AlpacaTrade {
  t: string;   // timestamp
  x: string;   // exchange
  p: number;   // price
  s: number;   // size
  c: string[]; // conditions
  i: number;   // trade ID
  z: string;   // tape
}
