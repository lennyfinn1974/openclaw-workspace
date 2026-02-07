// Market Data Simulator with Live Feed Integration
// Provides real-time market data with automatic fallback to simulation

import { EventEmitter } from 'events';
import type { Quote, OrderBook, OHLCV, Timeframe, MarketSession } from '../../src/types/trading';
import { marketDataProvider, MarketDataProvider, type MarketQuote, type CandleData, type OrderBookData } from './brokers';
import { forexSimulator } from './brokers/forexSimulator';
import { commoditySimulator } from './brokers/commoditySimulator';

interface SymbolConfig {
  symbol: string;
  basePrice: number;
  volatility: number;
  avgVolume: number;
  sector: string;
  assetType: 'stock' | 'crypto' | 'forex' | 'commodity';
}

// Supported symbols with fallback simulation parameters
const SYMBOLS: SymbolConfig[] = [
  // Stocks (Yahoo Finance / Alpaca)
  { symbol: 'AAPL', basePrice: 185.50, volatility: 0.018, avgVolume: 50000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'MSFT', basePrice: 420.25, volatility: 0.016, avgVolume: 25000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'GOOGL', basePrice: 175.80, volatility: 0.020, avgVolume: 20000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'AMZN', basePrice: 225.60, volatility: 0.022, avgVolume: 35000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'NVDA', basePrice: 875.50, volatility: 0.035, avgVolume: 45000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'TSLA', basePrice: 175.25, volatility: 0.045, avgVolume: 80000000, sector: 'Automotive', assetType: 'stock' },
  { symbol: 'META', basePrice: 585.40, volatility: 0.025, avgVolume: 18000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'AMD', basePrice: 165.75, volatility: 0.032, avgVolume: 55000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'SPY', basePrice: 525.30, volatility: 0.010, avgVolume: 75000000, sector: 'ETF', assetType: 'stock' },
  { symbol: 'QQQ', basePrice: 485.20, volatility: 0.012, avgVolume: 45000000, sector: 'ETF', assetType: 'stock' },
  { symbol: 'NFLX', basePrice: 625.80, volatility: 0.028, avgVolume: 8000000, sector: 'Entertainment', assetType: 'stock' },
  { symbol: 'CRM', basePrice: 295.40, volatility: 0.024, avgVolume: 6000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'COIN', basePrice: 245.60, volatility: 0.055, avgVolume: 12000000, sector: 'Finance', assetType: 'stock' },
  { symbol: 'PLTR', basePrice: 24.85, volatility: 0.042, avgVolume: 35000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'SMCI', basePrice: 785.20, volatility: 0.065, avgVolume: 8000000, sector: 'Technology', assetType: 'stock' },
  // Arena Beta stocks (not already in list)
  { symbol: 'ROKU', basePrice: 62.50, volatility: 0.050, avgVolume: 6000000, sector: 'Technology', assetType: 'stock' },
  { symbol: 'MSTR', basePrice: 1750.00, volatility: 0.065, avgVolume: 4000000, sector: 'Technology', assetType: 'stock' },
  // Crypto (Binance)
  { symbol: 'BTC', basePrice: 68000, volatility: 0.035, avgVolume: 25000000000, sector: 'Crypto', assetType: 'crypto' },
  { symbol: 'ETH', basePrice: 3500, volatility: 0.040, avgVolume: 15000000000, sector: 'Crypto', assetType: 'crypto' },
  { symbol: 'SOL', basePrice: 145, volatility: 0.055, avgVolume: 2500000000, sector: 'Crypto', assetType: 'crypto' },
  { symbol: 'BNB', basePrice: 580, volatility: 0.030, avgVolume: 1500000000, sector: 'Crypto', assetType: 'crypto' },
  { symbol: 'XRP', basePrice: 0.55, volatility: 0.045, avgVolume: 1200000000, sector: 'Crypto', assetType: 'crypto' },
  // FX (EODHD WS / Simulator fallback)
  { symbol: 'GBP/JPY', basePrice: 193.50, volatility: 0.012, avgVolume: 15000000, sector: 'FX', assetType: 'forex' },
  { symbol: 'USD/TRY', basePrice: 32.80, volatility: 0.015, avgVolume: 5000000, sector: 'FX', assetType: 'forex' },
  { symbol: 'USD/ZAR', basePrice: 18.65, volatility: 0.014, avgVolume: 8000000, sector: 'FX', assetType: 'forex' },
  { symbol: 'EUR/USD', basePrice: 1.0875, volatility: 0.006, avgVolume: 500000000, sector: 'FX', assetType: 'forex' },
  { symbol: 'GBP/USD', basePrice: 1.2725, volatility: 0.007, avgVolume: 300000000, sector: 'FX', assetType: 'forex' },
  { symbol: 'USD/JPY', basePrice: 154.25, volatility: 0.007, avgVolume: 400000000, sector: 'FX', assetType: 'forex' },
  { symbol: 'AUD/USD', basePrice: 0.6580, volatility: 0.008, avgVolume: 150000000, sector: 'FX', assetType: 'forex' },
  // Commodities (EODHD REST/WS / Simulator fallback)
  { symbol: 'GC=F', basePrice: 2350.00, volatility: 0.012, avgVolume: 200000, sector: 'Commodity', assetType: 'commodity' },
  { symbol: 'SI=F', basePrice: 28.50, volatility: 0.022, avgVolume: 60000, sector: 'Commodity', assetType: 'commodity' },
  { symbol: 'CL=F', basePrice: 78.50, volatility: 0.025, avgVolume: 800000, sector: 'Commodity', assetType: 'commodity' },
  { symbol: 'NG=F', basePrice: 2.85, volatility: 0.045, avgVolume: 400000, sector: 'Commodity', assetType: 'commodity' },
  { symbol: 'HG=F', basePrice: 4.25, volatility: 0.020, avgVolume: 50000, sector: 'Commodity', assetType: 'commodity' },
  { symbol: 'LTHM', basePrice: 5.80, volatility: 0.055, avgVolume: 3000000, sector: 'Commodity', assetType: 'commodity' },
];

interface PriceState {
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  trend: number;
  momentum: number;
  lastLiveUpdate: number;
  isLive: boolean;
}

interface DataSourceStatus {
  yahoo: boolean;
  binance: boolean;
  alpaca: boolean;
  eodhd: boolean;
  lastCheck: number;
}

export class MarketDataSimulator extends EventEmitter {
  private prices: Map<string, PriceState> = new Map();
  private simulationInterval: NodeJS.Timeout | null = null;
  private liveDataInterval: NodeJS.Timeout | null = null;
  private ohlcvData: Map<string, Map<Timeframe, OHLCV[]>> = new Map();
  private currentMinuteCandle: Map<string, OHLCV> = new Map();
  private dataProvider: MarketDataProvider;
  private enableLiveData: boolean;
  private dataSourceStatus: DataSourceStatus = {
    yahoo: false,
    binance: false,
    alpaca: false,
    eodhd: false,
    lastCheck: 0,
  };

  constructor(enableLiveData: boolean = true) {
    super();
    this.enableLiveData = enableLiveData;
    this.dataProvider = marketDataProvider;
    this.initializePrices();
    this.generateHistoricalData();

    // Set up live data event forwarding
    this.dataProvider.on('quote', (quote: MarketQuote) => {
      this.handleLiveQuote(quote);
    });

    console.log(`[MarketDataSimulator] Initialized with live data ${enableLiveData ? 'enabled' : 'disabled'}`);
  }

  private initializePrices(): void {
    for (const config of SYMBOLS) {
      const randomOffset = (Math.random() - 0.5) * 0.04 * config.basePrice;
      const price = config.basePrice + randomOffset;

      this.prices.set(config.symbol, {
        price,
        open: price * (1 + (Math.random() - 0.5) * 0.01),
        high: price * (1 + Math.random() * 0.02),
        low: price * (1 - Math.random() * 0.02),
        previousClose: price * (1 + (Math.random() - 0.5) * 0.02),
        volume: Math.floor(config.avgVolume * (0.3 + Math.random() * 0.4)),
        bid: price * 0.9999,
        ask: price * 1.0001,
        bidSize: Math.floor(100 + Math.random() * 1000),
        askSize: Math.floor(100 + Math.random() * 1000),
        trend: (Math.random() - 0.5) * 2,
        momentum: 0,
        lastLiveUpdate: 0,
        isLive: false,
      });
    }
  }

  private generateHistoricalData(): void {
    const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '1d'];
    const now = Date.now();

    for (const config of SYMBOLS) {
      this.ohlcvData.set(config.symbol, new Map());
      const symbolData = this.ohlcvData.get(config.symbol)!;

      for (const tf of timeframes) {
        const candles = this.generateCandles(config, tf, now);
        symbolData.set(tf, candles);
      }
    }
  }

  private generateCandles(config: SymbolConfig, timeframe: Timeframe, endTime: number): OHLCV[] {
    const msPerCandle = this.timeframeToMs(timeframe);
    const candleCount = timeframe === '1d' ? 252 : timeframe === '1h' ? 24 * 30 : 500;
    const candles: OHLCV[] = [];

    let price = config.basePrice * (0.85 + Math.random() * 0.3);
    const volatility = config.volatility / Math.sqrt(252 * (timeframe === '1d' ? 1 : 390 / (msPerCandle / 60000)));

    for (let i = candleCount - 1; i >= 0; i--) {
      const time = Math.floor((endTime - i * msPerCandle) / 1000);
      const trend = (config.basePrice - price) / config.basePrice * 0.1;
      const change = (Math.random() - 0.5 + trend) * volatility * price;

      const open = price;
      const close = price + change;
      const highLow = Math.abs(change) + Math.random() * volatility * price * 0.5;
      const high = Math.max(open, close) + highLow * Math.random();
      const low = Math.min(open, close) - highLow * Math.random();

      const volumeMultiplier = 1 + Math.abs(change / price) * 10 + (Math.random() - 0.5);
      const volume = Math.floor(config.avgVolume / (390 * 60000 / msPerCandle) * volumeMultiplier);

      candles.push({
        time,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
      });

      price = close;
    }

    return candles;
  }

  private timeframeToMs(tf: Timeframe): number {
    const map: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
    };
    return map[tf];
  }

  // Handle incoming live quote data
  private handleLiveQuote(quote: MarketQuote): void {
    const state = this.prices.get(quote.symbol);
    if (!state) return;

    // Update state with live data
    state.price = quote.last;
    state.bid = quote.bid;
    state.ask = quote.ask;
    state.bidSize = quote.bidSize;
    state.askSize = quote.askSize;
    state.volume = quote.volume;
    state.high = Math.max(state.high, quote.high);
    state.low = Math.min(state.low, quote.low);
    state.open = quote.open;
    state.previousClose = quote.previousClose;
    state.lastLiveUpdate = Date.now();
    state.isLive = true;

    // Emit the quote
    this.emit('quote', this.getQuote(quote.symbol));
  }

  async start(): Promise<void> {
    // Initialize EODHD if API key is available (must happen after dotenv loads)
    await this.dataProvider.initEodhd();

    // Check health of data sources
    await this.checkDataSources();

    // Start live data polling for subscribed symbols
    if (this.enableLiveData) {
      this.dataProvider.subscribe(SYMBOLS.map(s => s.symbol));
      this.startLiveDataPolling();
    }

    // Always run simulation for smooth updates and fallback
    if (!this.simulationInterval) {
      this.simulationInterval = setInterval(() => {
        this.updatePrices();
        this.updateArenaSimulators();
      }, 100);
    }

    // Update candles every second
    setInterval(() => {
      this.updateCandles();
    }, 1000);

    console.log('[MarketDataSimulator] Started');
  }

  private async checkDataSources(): Promise<void> {
    try {
      const health = await this.dataProvider.checkHealth();
      this.dataSourceStatus = {
        yahoo: health.get('yahoo') || false,
        binance: health.get('binance') || false,
        alpaca: health.get('alpaca') || false,
        eodhd: health.get('eodhd') || false,
        lastCheck: Date.now(),
      };

      console.log('[MarketDataSimulator] Data source status:', this.dataSourceStatus);
    } catch (error) {
      console.error('[MarketDataSimulator] Error checking data sources:', error);
    }
  }

  private startLiveDataPolling(): void {
    if (this.liveDataInterval) return;

    // Poll live data every 5 seconds
    this.liveDataInterval = setInterval(async () => {
      await this.fetchLiveData();
    }, 5000);

    // Initial fetch
    this.fetchLiveData();
  }

  private async fetchLiveData(): Promise<void> {
    for (const config of SYMBOLS) {
      try {
        const result = await this.dataProvider.getQuote(config.symbol);
        if (result.success && result.data) {
          this.handleLiveQuote(result.data);
        }
      } catch (error) {
        // Silently fail - simulation will provide fallback
      }
    }
  }

  stop(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.liveDataInterval) {
      clearInterval(this.liveDataInterval);
      this.liveDataInterval = null;
    }
    this.dataProvider.shutdown();
    console.log('[MarketDataSimulator] Stopped');
  }

  private updatePrices(): void {
    const now = Date.now();

    for (const config of SYMBOLS) {
      const state = this.prices.get(config.symbol)!;

      // Skip simulation if we have recent live data (within 10 seconds)
      if (state.isLive && now - state.lastLiveUpdate < 10000) {
        // Just emit the current state
        this.emit('quote', this.getQuote(config.symbol));
        continue;
      }

      // Mark as not live if data is stale
      if (now - state.lastLiveUpdate > 10000) {
        state.isLive = false;
      }

      // Simulate price movement
      const tickVolatility = config.volatility / Math.sqrt(252 * 390 * 60 * 10);
      const noise = (Math.random() - 0.5) * 2;
      const trendBias = state.trend * 0.1;
      const meanReversion = (config.basePrice - state.price) / config.basePrice * 0.05;

      state.momentum = state.momentum * 0.95 + noise * 0.05;

      const change = (noise + trendBias + meanReversion + state.momentum) * tickVolatility * state.price;
      const newPrice = Math.max(state.price * 0.9, Math.min(state.price * 1.1, state.price + change));

      state.price = Number(newPrice.toFixed(2));
      state.high = Math.max(state.high, state.price);
      state.low = Math.min(state.low, state.price);

      const spreadBps = 1 + Math.random() * 3;
      state.bid = Number((state.price * (1 - spreadBps / 10000)).toFixed(2));
      state.ask = Number((state.price * (1 + spreadBps / 10000)).toFixed(2));
      state.bidSize = Math.floor(100 + Math.random() * 2000);
      state.askSize = Math.floor(100 + Math.random() * 2000);
      state.volume += Math.floor(Math.random() * 1000 * (1 + Math.abs(change / state.price) * 100));

      if (Math.random() < 0.001) {
        state.trend = (Math.random() - 0.5) * 2;
      }

      this.emit('quote', this.getQuote(config.symbol));
    }
  }

  private updateCandles(): void {
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = Math.floor(now / 60) * 60;

    for (const config of SYMBOLS) {
      const state = this.prices.get(config.symbol)!;
      let candle = this.currentMinuteCandle.get(config.symbol);

      if (!candle || candle.time < currentMinute) {
        if (candle) {
          const symbolData = this.ohlcvData.get(config.symbol)!;
          const minuteData = symbolData.get('1m')!;
          minuteData.push(candle);
          if (minuteData.length > 500) minuteData.shift();

          this.aggregateCandle(config.symbol, '5m', 5);
          this.aggregateCandle(config.symbol, '15m', 15);
          this.aggregateCandle(config.symbol, '1h', 60);

          this.emit('candle', { symbol: config.symbol, timeframe: '1m', candle });
        }

        candle = {
          time: currentMinute,
          open: state.price,
          high: state.price,
          low: state.price,
          close: state.price,
          volume: 0,
        };
        this.currentMinuteCandle.set(config.symbol, candle);
      } else {
        candle.high = Math.max(candle.high, state.price);
        candle.low = Math.min(candle.low, state.price);
        candle.close = state.price;
        candle.volume = state.volume;
      }
    }
  }

  private aggregateCandle(symbol: string, timeframe: Timeframe, minutes: number): void {
    const symbolData = this.ohlcvData.get(symbol)!;
    const minuteData = symbolData.get('1m')!;
    const targetData = symbolData.get(timeframe)!;

    const now = Math.floor(Date.now() / 1000);
    const periodStart = Math.floor(now / (minutes * 60)) * minutes * 60;

    const relevantCandles = minuteData.filter(c => c.time >= periodStart - minutes * 60 && c.time < periodStart);

    if (relevantCandles.length >= minutes) {
      const aggregated: OHLCV = {
        time: periodStart - minutes * 60,
        open: relevantCandles[0].open,
        high: Math.max(...relevantCandles.map(c => c.high)),
        low: Math.min(...relevantCandles.map(c => c.low)),
        close: relevantCandles[relevantCandles.length - 1].close,
        volume: relevantCandles.reduce((sum, c) => sum + c.volume, 0),
      };

      if (!targetData.find(c => c.time === aggregated.time)) {
        targetData.push(aggregated);
        if (targetData.length > 500) targetData.shift();
        this.emit('candle', { symbol, timeframe, candle: aggregated });
      }
    }
  }

  getQuote(symbol: string): Quote | null {
    const state = this.prices.get(symbol);
    if (!state) return null;

    const change = state.price - state.previousClose;
    const changePercent = (change / state.previousClose) * 100;

    return {
      symbol,
      bid: state.bid,
      bidSize: state.bidSize,
      ask: state.ask,
      askSize: state.askSize,
      last: state.price,
      lastSize: Math.floor(100 + Math.random() * 500),
      volume: state.volume,
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      high: state.high,
      low: state.low,
      open: state.open,
      previousClose: state.previousClose,
      timestamp: new Date(),
      source: state.isLive ? this.getLiveDataSource(symbol) : 'simulated', // 🚨 ARENA: Track data source for validation
    };
  }

  // Determine the actual live data source for a symbol
  private getLiveDataSource(symbol: string): 'yahoo' | 'binance' | 'alpaca' | 'eodhd' {
    // Check symbol type and determine likely source
    if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(symbol)) {
      return 'binance';
    }
    if (['GBP/JPY', 'USD/TRY', 'USD/ZAR', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F'].includes(symbol)) {
      return 'eodhd';
    }
    // Default to yahoo for stocks
    return 'yahoo';
  }

  async getOrderBook(symbol: string, levels: number = 10): Promise<OrderBook | null> {
    // Try live order book first
    if (this.enableLiveData) {
      const result = await this.dataProvider.getOrderBook(symbol, levels);
      if (result.success && result.data) {
        return {
          symbol: result.data.symbol,
          bids: result.data.bids.map(b => ({
            price: b.price,
            size: b.size,
            orders: b.orders || 1,
          })),
          asks: result.data.asks.map(a => ({
            price: a.price,
            size: a.size,
            orders: a.orders || 1,
          })),
          spread: result.data.spread,
          spreadPercent: result.data.spreadPercent,
          timestamp: result.data.timestamp,
        };
      }
    }

    // Fallback to simulated order book
    return this.getSimulatedOrderBook(symbol, levels);
  }

  private getSimulatedOrderBook(symbol: string, levels: number): OrderBook | null {
    const state = this.prices.get(symbol);
    if (!state) return null;

    const bids: { price: number; size: number; orders: number }[] = [];
    const asks: { price: number; size: number; orders: number }[] = [];

    for (let i = 0; i < levels; i++) {
      const bidPrice = state.bid - (i * state.price * 0.0002);
      const askPrice = state.ask + (i * state.price * 0.0002);

      bids.push({
        price: Number(bidPrice.toFixed(2)),
        size: Math.floor(100 + Math.random() * 5000 * Math.exp(-i * 0.3)),
        orders: Math.floor(1 + Math.random() * 20 * Math.exp(-i * 0.2)),
      });

      asks.push({
        price: Number(askPrice.toFixed(2)),
        size: Math.floor(100 + Math.random() * 5000 * Math.exp(-i * 0.3)),
        orders: Math.floor(1 + Math.random() * 20 * Math.exp(-i * 0.2)),
      });
    }

    const spread = state.ask - state.bid;
    const spreadPercent = (spread / state.price) * 100;

    return {
      symbol,
      bids,
      asks,
      spread: Number(spread.toFixed(2)),
      spreadPercent: Number(spreadPercent.toFixed(4)),
      timestamp: new Date(),
    };
  }

  async getCandles(symbol: string, timeframe: Timeframe): Promise<OHLCV[]> {
    // Try live candles first
    if (this.enableLiveData) {
      const result = await this.dataProvider.getCandles(symbol, timeframe, 500);
      if (result.success && result.data && result.data.length > 0) {
        // Merge with simulated data for continuity
        const symbolData = this.ohlcvData.get(symbol);
        if (symbolData) {
          symbolData.set(timeframe, result.data as OHLCV[]);
        }
        return result.data as OHLCV[];
      }
    }

    // Fallback to simulated data
    const symbolData = this.ohlcvData.get(symbol);
    if (!symbolData) return [];
    return symbolData.get(timeframe) || [];
  }

  getCurrentPrice(symbol: string): number {
    return this.prices.get(symbol)?.price || 0;
  }

  // Synchronous access to stored OHLCV candles (no async/network call)
  getStoredCandles(symbol: string, timeframe: string): OHLCV[] | null {
    const symbolData = this.ohlcvData.get(symbol);
    if (!symbolData) return null;
    const candles = symbolData.get(timeframe as Timeframe);
    return candles && candles.length > 0 ? candles : null;
  }

  getSymbols(): string[] {
    return SYMBOLS.map(s => s.symbol);
  }

  getMarketSession(): MarketSession {
    const now = new Date();
    const estHour = (now.getUTCHours() - 5 + 24) % 24;
    const estMinute = now.getUTCMinutes();
    const time = estHour * 60 + estMinute;

    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    if (isWeekend) return 'closed';

    if (time >= 240 && time < 570) return 'pre_market';
    if (time >= 570 && time < 960) return 'regular';
    if (time >= 960 && time < 1200) return 'after_hours';

    return 'closed';
  }

  isInKillZone(): { zone: string; active: boolean } {
    const now = new Date();
    const estHour = (now.getUTCHours() - 5 + 24) % 24;

    if (estHour >= 2 && estHour < 5) {
      return { zone: 'London', active: true };
    }
    if (estHour >= 8 && estHour < 11) {
      return { zone: 'New York', active: true };
    }

    return { zone: 'None', active: false };
  }

  // Get data source status
  getDataSourceStatus(): DataSourceStatus & { liveSymbols: string[] } {
    const liveSymbols = Array.from(this.prices.entries())
      .filter(([_, state]) => state.isLive)
      .map(([symbol]) => symbol);

    return {
      ...this.dataSourceStatus,
      liveSymbols,
    };
  }

  // Check if a symbol is using live data
  isLive(symbol: string): boolean {
    const state = this.prices.get(symbol);
    return state?.isLive || false;
  }

  // Get provider-level stats (EODHD WS connections, etc.)
  getProviderStats(): Record<string, unknown> {
    return this.dataProvider.getStats();
  }

  // Get price for any arena symbol (stocks, FX, commodities, crypto)
  getArenaPrice(symbol: string): number {
    // Check standard symbols first
    const stdPrice = this.getCurrentPrice(symbol);
    if (stdPrice > 0) return stdPrice;

    // Check FX simulator
    const fxPrice = forexSimulator.getCurrentPrice(symbol);
    if (fxPrice > 0) return fxPrice;

    // Check commodity simulator
    const commodityPrice = commoditySimulator.getCurrentPrice(symbol);
    if (commodityPrice > 0) return commodityPrice;

    return 0;
  }

  // Get quote for any arena symbol
  getArenaQuote(symbol: string): Quote | null {
    // Standard symbols
    const stdQuote = this.getQuote(symbol);
    if (stdQuote) return stdQuote;

    // FX - construct Quote from MarketQuote
    const fxPrice = forexSimulator.getCurrentPrice(symbol);
    if (fxPrice > 0) {
      return {
        symbol,
        bid: fxPrice * 0.9999,
        bidSize: 100000,
        ask: fxPrice * 1.0001,
        askSize: 100000,
        last: fxPrice,
        lastSize: 10000,
        volume: 1000000,
        change: 0,
        changePercent: 0,
        high: fxPrice * 1.005,
        low: fxPrice * 0.995,
        open: fxPrice,
        previousClose: fxPrice,
        timestamp: new Date(),
        source: 'simulated', // 🚨 ARENA: Mark as simulated for validation
      };
    }

    // Commodity
    const comPrice = commoditySimulator.getCurrentPrice(symbol);
    if (comPrice > 0) {
      return {
        symbol,
        bid: comPrice * 0.9998,
        bidSize: 100,
        ask: comPrice * 1.0002,
        askSize: 100,
        last: comPrice,
        lastSize: 10,
        volume: 50000,
        change: 0,
        changePercent: 0,
        high: comPrice * 1.01,
        low: comPrice * 0.99,
        open: comPrice,
        previousClose: comPrice,
        timestamp: new Date(),
        source: 'simulated', // 🚨 ARENA: Mark as simulated for validation
      };
    }

    return null;
  }

  // Update arena simulators (called from simulation interval)
  // When EODHD is providing live data, these simulators still run as fallback
  // but their prices are overridden by handleLiveQuote when EODHD quotes arrive
  updateArenaSimulators(): void {
    forexSimulator.updatePrices();
    commoditySimulator.updatePrices();
  }
}
