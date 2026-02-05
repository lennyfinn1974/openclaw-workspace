// Market Data Simulator - Generates realistic price movements and order book data
import { EventEmitter } from 'events';
import type { Quote, OrderBook, OHLCV, Timeframe, MarketSession } from '../../src/types/trading';

interface SymbolConfig {
  symbol: string;
  basePrice: number;
  volatility: number; // Daily volatility (e.g., 0.02 = 2%)
  avgVolume: number;
  sector: string;
}

const SYMBOLS: SymbolConfig[] = [
  { symbol: 'AAPL', basePrice: 185.50, volatility: 0.018, avgVolume: 50000000, sector: 'Technology' },
  { symbol: 'MSFT', basePrice: 420.25, volatility: 0.016, avgVolume: 25000000, sector: 'Technology' },
  { symbol: 'GOOGL', basePrice: 175.80, volatility: 0.020, avgVolume: 20000000, sector: 'Technology' },
  { symbol: 'AMZN', basePrice: 225.60, volatility: 0.022, avgVolume: 35000000, sector: 'Technology' },
  { symbol: 'NVDA', basePrice: 875.50, volatility: 0.035, avgVolume: 45000000, sector: 'Technology' },
  { symbol: 'TSLA', basePrice: 175.25, volatility: 0.045, avgVolume: 80000000, sector: 'Automotive' },
  { symbol: 'META', basePrice: 585.40, volatility: 0.025, avgVolume: 18000000, sector: 'Technology' },
  { symbol: 'AMD', basePrice: 165.75, volatility: 0.032, avgVolume: 55000000, sector: 'Technology' },
  { symbol: 'SPY', basePrice: 525.30, volatility: 0.010, avgVolume: 75000000, sector: 'ETF' },
  { symbol: 'QQQ', basePrice: 485.20, volatility: 0.012, avgVolume: 45000000, sector: 'ETF' },
  { symbol: 'NFLX', basePrice: 625.80, volatility: 0.028, avgVolume: 8000000, sector: 'Entertainment' },
  { symbol: 'CRM', basePrice: 295.40, volatility: 0.024, avgVolume: 6000000, sector: 'Technology' },
  { symbol: 'COIN', basePrice: 245.60, volatility: 0.055, avgVolume: 12000000, sector: 'Finance' },
  { symbol: 'PLTR', basePrice: 24.85, volatility: 0.042, avgVolume: 35000000, sector: 'Technology' },
  { symbol: 'SMCI', basePrice: 785.20, volatility: 0.065, avgVolume: 8000000, sector: 'Technology' },
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
  trend: number; // -1 to 1, affects price movement bias
  momentum: number;
}

export class MarketDataSimulator extends EventEmitter {
  private prices: Map<string, PriceState> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private ohlcvData: Map<string, Map<Timeframe, OHLCV[]>> = new Map();
  private currentMinuteCandle: Map<string, OHLCV> = new Map();

  constructor() {
    super();
    this.initializePrices();
    this.generateHistoricalData();
  }

  private initializePrices(): void {
    for (const config of SYMBOLS) {
      // Add some random offset to make it realistic
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

    let price = config.basePrice * (0.85 + Math.random() * 0.3); // Start with historical variance
    const volatility = config.volatility / Math.sqrt(252 * (timeframe === '1d' ? 1 : 390 / (msPerCandle / 60000)));

    for (let i = candleCount - 1; i >= 0; i--) {
      const time = Math.floor((endTime - i * msPerCandle) / 1000);

      // Generate realistic OHLCV with trend and mean reversion
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

  start(): void {
    if (this.intervalId) return;

    // Update prices every 100ms for realistic tick data
    this.intervalId = setInterval(() => {
      this.updatePrices();
    }, 100);

    // Update candles every second
    setInterval(() => {
      this.updateCandles();
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updatePrices(): void {
    for (const config of SYMBOLS) {
      const state = this.prices.get(config.symbol)!;

      // Micro price movement with momentum
      const tickVolatility = config.volatility / Math.sqrt(252 * 390 * 60 * 10); // Per 100ms
      const noise = (Math.random() - 0.5) * 2;
      const trendBias = state.trend * 0.1;
      const meanReversion = (config.basePrice - state.price) / config.basePrice * 0.05;

      // Update momentum
      state.momentum = state.momentum * 0.95 + noise * 0.05;

      const change = (noise + trendBias + meanReversion + state.momentum) * tickVolatility * state.price;
      const newPrice = Math.max(state.price * 0.9, Math.min(state.price * 1.1, state.price + change));

      // Update state
      state.price = Number(newPrice.toFixed(2));
      state.high = Math.max(state.high, state.price);
      state.low = Math.min(state.low, state.price);

      // Update spread (tighter for liquid stocks)
      const spreadBps = 1 + Math.random() * 3; // 1-4 basis points
      state.bid = Number((state.price * (1 - spreadBps / 10000)).toFixed(2));
      state.ask = Number((state.price * (1 + spreadBps / 10000)).toFixed(2));
      state.bidSize = Math.floor(100 + Math.random() * 2000);
      state.askSize = Math.floor(100 + Math.random() * 2000);

      // Volume tick
      state.volume += Math.floor(Math.random() * 1000 * (1 + Math.abs(change / state.price) * 100));

      // Random trend shifts
      if (Math.random() < 0.001) {
        state.trend = (Math.random() - 0.5) * 2;
      }

      // Emit quote update
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
        // Start new candle
        if (candle) {
          // Save completed candle to 1m data
          const symbolData = this.ohlcvData.get(config.symbol)!;
          const minuteData = symbolData.get('1m')!;
          minuteData.push(candle);
          if (minuteData.length > 500) minuteData.shift();

          // Update higher timeframes
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
        // Update current candle
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
    };
  }

  getOrderBook(symbol: string, levels: number = 10): OrderBook | null {
    const state = this.prices.get(symbol);
    if (!state) return null;

    const bids: { price: number; size: number; orders: number }[] = [];
    const asks: { price: number; size: number; orders: number }[] = [];

    // Generate realistic order book levels
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

  getCandles(symbol: string, timeframe: Timeframe): OHLCV[] {
    const symbolData = this.ohlcvData.get(symbol);
    if (!symbolData) return [];
    return symbolData.get(timeframe) || [];
  }

  getCurrentPrice(symbol: string): number {
    return this.prices.get(symbol)?.price || 0;
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

    // Pre-market: 4:00 AM - 9:30 AM EST
    if (time >= 240 && time < 570) return 'pre_market';

    // Regular: 9:30 AM - 4:00 PM EST
    if (time >= 570 && time < 960) return 'regular';

    // After-hours: 4:00 PM - 8:00 PM EST
    if (time >= 960 && time < 1200) return 'after_hours';

    return 'closed';
  }

  isInKillZone(): { zone: string; active: boolean } {
    const now = new Date();
    const estHour = (now.getUTCHours() - 5 + 24) % 24;

    // London Kill Zone: 02:00 - 05:00 EST
    if (estHour >= 2 && estHour < 5) {
      return { zone: 'London', active: true };
    }

    // NY Kill Zone: 08:00 - 11:00 EST
    if (estHour >= 8 && estHour < 11) {
      return { zone: 'New York', active: true };
    }

    return { zone: 'None', active: false };
  }
}
