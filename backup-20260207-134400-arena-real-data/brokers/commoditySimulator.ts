// Commodity Simulator - Futures and commodity simulation
// BTC routes to existing Binance adapter; everything else is simulated
import type { MarketQuote, CandleData, FetchResult, BrokerAdapter, DataSource } from './types';

interface CommodityConfig {
  symbol: string;
  displayName: string;
  basePrice: number;
  dailyVolatility: number;
  avgDailyVolume: number;
  spreadBps: number;         // basis points
  contractMultiplier: number;
  tradingHours: 'nearly_24h' | 'us_futures' | 'crypto';
}

const COMMODITIES: Record<string, CommodityConfig> = {
  'CL=F':  { symbol: 'CL=F', displayName: 'Crude Oil', basePrice: 78.50, dailyVolatility: 0.025, avgDailyVolume: 800000, spreadBps: 3, contractMultiplier: 1000, tradingHours: 'us_futures' },
  'NG=F':  { symbol: 'NG=F', displayName: 'Natural Gas', basePrice: 2.85, dailyVolatility: 0.045, avgDailyVolume: 400000, spreadBps: 10, contractMultiplier: 10000, tradingHours: 'us_futures' },
  'SI=F':  { symbol: 'SI=F', displayName: 'Silver', basePrice: 28.50, dailyVolatility: 0.022, avgDailyVolume: 60000, spreadBps: 5, contractMultiplier: 5000, tradingHours: 'us_futures' },
  'HG=F':  { symbol: 'HG=F', displayName: 'Copper', basePrice: 4.25, dailyVolatility: 0.020, avgDailyVolume: 50000, spreadBps: 5, contractMultiplier: 25000, tradingHours: 'us_futures' },
  'GC=F':  { symbol: 'GC=F', displayName: 'Gold', basePrice: 2350.00, dailyVolatility: 0.012, avgDailyVolume: 200000, spreadBps: 2, contractMultiplier: 100, tradingHours: 'nearly_24h' },
  'LTHM':  { symbol: 'LTHM', displayName: 'Lithium Americas', basePrice: 5.80, dailyVolatility: 0.055, avgDailyVolume: 3000000, spreadBps: 20, contractMultiplier: 1, tradingHours: 'us_futures' },
  // BTC is handled by Binance adapter, but we keep a config for fallback
  'BTC':   { symbol: 'BTC', displayName: 'Bitcoin', basePrice: 68000, dailyVolatility: 0.035, avgDailyVolume: 25000000000, spreadBps: 5, contractMultiplier: 1, tradingHours: 'crypto' },
};

interface CommodityPriceState {
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  trend: number;
  momentum: number;
}

export class CommoditySimulator implements BrokerAdapter {
  name: DataSource = 'simulated';
  private prices: Map<string, CommodityPriceState> = new Map();
  private candles: Map<string, CandleData[]> = new Map();

  constructor() {
    this.initializePrices();
    this.generateHistoricalCandles();
  }

  private initializePrices(): void {
    for (const config of Object.values(COMMODITIES)) {
      const jitter = (Math.random() - 0.5) * 0.03 * config.basePrice;
      const price = config.basePrice + jitter;
      this.prices.set(config.symbol, {
        price,
        open: price * (1 + (Math.random() - 0.5) * 0.005),
        high: price * (1 + Math.random() * 0.01),
        low: price * (1 - Math.random() * 0.01),
        previousClose: price * (1 + (Math.random() - 0.5) * 0.01),
        volume: Math.floor(config.avgDailyVolume * 0.3),
        trend: (Math.random() - 0.5) * 2,
        momentum: 0,
      });
    }
  }

  private generateHistoricalCandles(): void {
    for (const config of Object.values(COMMODITIES)) {
      const candles: CandleData[] = [];
      let price = config.basePrice * (0.9 + Math.random() * 0.2);
      const now = Math.floor(Date.now() / 1000);

      for (let i = 499; i >= 0; i--) {
        const time = now - i * 300;
        const vol = config.dailyVolatility / Math.sqrt(252 * 78);
        const meanRev = (config.basePrice - price) / config.basePrice * 0.03;
        const change = (Math.random() - 0.5 + meanRev) * vol * price;
        const open = price;
        const close = price + change;
        const wick = Math.abs(change) * 0.6 * Math.random();

        candles.push({
          time,
          open,
          high: Math.max(open, close) + wick,
          low: Math.min(open, close) - wick,
          close,
          volume: Math.floor(config.avgDailyVolume / 78 * (0.3 + Math.random())),
        });
        price = close;
      }
      this.candles.set(config.symbol, candles);
    }
  }

  updatePrices(): Map<string, MarketQuote> {
    const quotes = new Map<string, MarketQuote>();

    for (const config of Object.values(COMMODITIES)) {
      // Skip BTC — let Binance handle it
      if (config.symbol === 'BTC') continue;

      const state = this.prices.get(config.symbol)!;
      const vol = config.dailyVolatility / Math.sqrt(252 * 390 * 60 * 10);

      const noise = (Math.random() - 0.5) * 2;
      const meanRev = (config.basePrice - state.price) / config.basePrice * 0.03;
      state.momentum = state.momentum * 0.95 + noise * 0.05;

      const change = (noise + state.trend * 0.05 + meanRev + state.momentum) * vol * state.price;
      state.price = Math.max(state.price * 0.92, Math.min(state.price * 1.08, state.price + change));
      state.high = Math.max(state.high, state.price);
      state.low = Math.min(state.low, state.price);
      state.volume += Math.floor(Math.random() * 200);

      if (Math.random() < 0.001) state.trend = (Math.random() - 0.5) * 2;

      const spreadHalf = state.price * config.spreadBps / 20000;
      const bid = state.price - spreadHalf;
      const ask = state.price + spreadHalf;
      const pChange = state.price - state.previousClose;

      quotes.set(config.symbol, {
        symbol: config.symbol,
        bid, bidSize: Math.floor(50 + Math.random() * 500),
        ask, askSize: Math.floor(50 + Math.random() * 500),
        last: state.price, lastSize: Math.floor(10 + Math.random() * 100),
        volume: state.volume,
        change: pChange, changePercent: (pChange / state.previousClose) * 100,
        high: state.high, low: state.low, open: state.open,
        previousClose: state.previousClose,
        timestamp: new Date(),
      });
    }
    return quotes;
  }

  async getQuote(symbol: string): Promise<FetchResult<MarketQuote>> {
    const quotes = this.updatePrices();
    const quote = quotes.get(symbol);
    if (!quote) {
      // Try from price state for BTC fallback
      const state = this.prices.get(symbol);
      if (!state) return { success: false, error: 'Unknown commodity symbol', source: 'simulated', latencyMs: 0 };
    }
    if (quote) return { success: true, data: quote, source: 'simulated', latencyMs: 0 };
    return { success: false, error: 'Quote not available', source: 'simulated', latencyMs: 0 };
  }

  async getCandles(symbol: string, _interval: string, limit: number): Promise<FetchResult<CandleData[]>> {
    const data = this.candles.get(symbol);
    if (!data) return { success: false, error: 'Unknown commodity symbol', source: 'simulated', latencyMs: 0 };
    return { success: true, data: data.slice(-limit), source: 'simulated', latencyMs: 0 };
  }

  async isHealthy(): Promise<boolean> { return true; }

  getSymbols(): string[] { return Object.keys(COMMODITIES).filter(s => s !== 'BTC'); }
  getCurrentPrice(symbol: string): number { return this.prices.get(symbol)?.price || 0; }
  static isCommoditySymbol(symbol: string): boolean { return symbol in COMMODITIES && symbol !== 'BTC'; }
}

export const commoditySimulator = new CommoditySimulator();
