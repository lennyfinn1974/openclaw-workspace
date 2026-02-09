// Forex Pair Simulator - Realistic FX simulation with session-aware volatility
import type { MarketQuote, CandleData, FetchResult, BrokerAdapter, DataSource } from './types';

interface FxPairConfig {
  symbol: string;
  basePrice: number;
  pipSize: number;       // e.g. 0.01 for JPY pairs, 0.0001 for others
  avgSpreadPips: number;
  dailyVolatility: number; // annualized volatility
  avgDailyVolume: number;
}

const FX_PAIRS: Record<string, FxPairConfig> = {
  'GBP/JPY': { symbol: 'GBP/JPY', basePrice: 193.50, pipSize: 0.01, avgSpreadPips: 3.0, dailyVolatility: 0.012, avgDailyVolume: 15000000 },
  'USD/TRY': { symbol: 'USD/TRY', basePrice: 32.80, pipSize: 0.0001, avgSpreadPips: 80.0, dailyVolatility: 0.015, avgDailyVolume: 5000000 },
  'USD/ZAR': { symbol: 'USD/ZAR', basePrice: 18.65, pipSize: 0.0001, avgSpreadPips: 50.0, dailyVolatility: 0.014, avgDailyVolume: 8000000 },
  'EUR/USD': { symbol: 'EUR/USD', basePrice: 1.0875, pipSize: 0.0001, avgSpreadPips: 1.0, dailyVolatility: 0.006, avgDailyVolume: 500000000 },
  'GBP/USD': { symbol: 'GBP/USD', basePrice: 1.2725, pipSize: 0.0001, avgSpreadPips: 1.5, dailyVolatility: 0.007, avgDailyVolume: 300000000 },
  'USD/JPY': { symbol: 'USD/JPY', basePrice: 154.25, pipSize: 0.01, avgSpreadPips: 1.0, dailyVolatility: 0.007, avgDailyVolume: 400000000 },
  'AUD/USD': { symbol: 'AUD/USD', basePrice: 0.6580, pipSize: 0.0001, avgSpreadPips: 1.5, dailyVolatility: 0.008, avgDailyVolume: 150000000 },
};

interface FxPriceState {
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  trend: number;
  momentum: number;
}

export class ForexSimulator implements BrokerAdapter {
  name: DataSource = 'simulated';
  private prices: Map<string, FxPriceState> = new Map();
  private candles: Map<string, CandleData[]> = new Map();

  constructor() {
    this.initializePrices();
    this.generateHistoricalCandles();
  }

  private initializePrices(): void {
    for (const config of Object.values(FX_PAIRS)) {
      const jitter = (Math.random() - 0.5) * 0.02 * config.basePrice;
      const price = config.basePrice + jitter;
      this.prices.set(config.symbol, {
        price,
        open: price,
        high: price * 1.002,
        low: price * 0.998,
        previousClose: price * (1 + (Math.random() - 0.5) * 0.005),
        volume: Math.floor(config.avgDailyVolume * 0.3),
        trend: (Math.random() - 0.5) * 2,
        momentum: 0,
      });
    }
  }

  private generateHistoricalCandles(): void {
    for (const config of Object.values(FX_PAIRS)) {
      const candles: CandleData[] = [];
      let price = config.basePrice * (0.95 + Math.random() * 0.1);
      const now = Math.floor(Date.now() / 1000);

      for (let i = 499; i >= 0; i--) {
        const time = now - i * 300; // 5-minute candles
        const vol = config.dailyVolatility / Math.sqrt(252 * 78); // 78 5-min bars per day
        const change = (Math.random() - 0.5 + (config.basePrice - price) / config.basePrice * 0.05) * vol * price;
        const open = price;
        const close = price + change;
        const wick = Math.abs(change) * 0.5 * Math.random();
        const high = Math.max(open, close) + wick;
        const low = Math.min(open, close) - wick;

        candles.push({ time, open, high, low, close, volume: Math.floor(config.avgDailyVolume / 78 * (0.5 + Math.random())) });
        price = close;
      }

      this.candles.set(config.symbol, candles);
    }
  }

  getSessionVolatilityMultiplier(): number {
    const now = new Date();
    const utcHour = now.getUTCHours();
    // London: 07-16 UTC, NY: 12-21 UTC, overlap: 12-16 UTC
    if (utcHour >= 12 && utcHour < 16) return 1.5; // London-NY overlap
    if (utcHour >= 7 && utcHour < 16) return 1.2;  // London
    if (utcHour >= 12 && utcHour < 21) return 1.1;  // NY
    if (utcHour >= 0 && utcHour < 7) return 0.8;    // Asian
    return 0.6; // quiet hours
  }

  updatePrices(): Map<string, MarketQuote> {
    const quotes = new Map<string, MarketQuote>();
    const sessionMult = this.getSessionVolatilityMultiplier();

    for (const config of Object.values(FX_PAIRS)) {
      const state = this.prices.get(config.symbol)!;
      const vol = config.dailyVolatility / Math.sqrt(252 * 390 * 60 * 10) * sessionMult;

      const noise = (Math.random() - 0.5) * 2;
      const meanRev = (config.basePrice - state.price) / config.basePrice * 0.02;
      state.momentum = state.momentum * 0.95 + noise * 0.05;

      const change = (noise + state.trend * 0.05 + meanRev + state.momentum) * vol * state.price;
      state.price = Math.max(state.price * 0.95, Math.min(state.price * 1.05, state.price + change));

      state.high = Math.max(state.high, state.price);
      state.low = Math.min(state.low, state.price);
      state.volume += Math.floor(Math.random() * 500);

      if (Math.random() < 0.001) state.trend = (Math.random() - 0.5) * 2;

      const spreadHalf = config.avgSpreadPips * config.pipSize * 0.5;
      const bid = state.price - spreadHalf;
      const ask = state.price + spreadHalf;

      const pChange = state.price - state.previousClose;

      quotes.set(config.symbol, {
        symbol: config.symbol,
        bid, bidSize: Math.floor(100000 + Math.random() * 5000000),
        ask, askSize: Math.floor(100000 + Math.random() * 5000000),
        last: state.price, lastSize: Math.floor(10000 + Math.random() * 100000),
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
    if (!quote) return { success: false, error: 'Unknown FX symbol', source: 'simulated', latencyMs: 0 };
    return { success: true, data: quote, source: 'simulated', latencyMs: 0 };
  }

  async getCandles(symbol: string, _interval: string, limit: number): Promise<FetchResult<CandleData[]>> {
    const data = this.candles.get(symbol);
    if (!data) return { success: false, error: 'Unknown FX symbol', source: 'simulated', latencyMs: 0 };
    return { success: true, data: data.slice(-limit), source: 'simulated', latencyMs: 0 };
  }

  async isHealthy(): Promise<boolean> { return true; }

  getSymbols(): string[] { return Object.keys(FX_PAIRS); }
  getCurrentPrice(symbol: string): number { return this.prices.get(symbol)?.price || 0; }
  static isFxSymbol(symbol: string): boolean { return symbol in FX_PAIRS; }
}

export const forexSimulator = new ForexSimulator();
