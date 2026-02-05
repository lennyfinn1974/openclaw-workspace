// Zustand Store for Trading State Management
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Portfolio,
  Position,
  Order,
  Quote,
  OrderBook,
  Trade,
  OHLCV,
  Timeframe,
  MarketSession,
  OrderBlock,
  FairValueGap,
  MarketStructure,
  QullamagieSetup,
  RSI,
  MACD,
  MovingAverage,
} from '@/types/trading';

interface TradingState {
  // Portfolio & Positions
  portfolio: Portfolio | null;
  positions: Position[];

  // Orders
  orders: Order[];
  pendingOrders: Order[];
  trades: Trade[];

  // Market Data
  quotes: Map<string, Quote>;
  orderBooks: Map<string, OrderBook>;
  candles: Map<string, Map<Timeframe, OHLCV[]>>;

  // UI State
  selectedSymbol: string;
  selectedTimeframe: Timeframe;
  watchlist: string[];
  marketSession: MarketSession;
  killZone: { zone: string; active: boolean };

  // Technical Analysis
  indicators: {
    rsi: RSI | null;
    macd: MACD | null;
    sma: MovingAverage[];
    ema: MovingAverage[];
  };
  ictAnalysis: {
    orderBlocks: OrderBlock[];
    fairValueGaps: FairValueGap[];
    marketStructure: MarketStructure | null;
  };
  qullaSetups: QullamagieSetup[];

  // Connection State
  isConnected: boolean;
  lastUpdate: Date | null;

  // Actions
  setPortfolio: (portfolio: Portfolio) => void;
  setPositions: (positions: Position[]) => void;
  updatePosition: (position: Position) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  setOrders: (orders: Order[]) => void;
  addTrade: (trade: Trade) => void;
  setTrades: (trades: Trade[]) => void;
  updateQuote: (quote: Quote) => void;
  updateOrderBook: (symbol: string, orderBook: OrderBook) => void;
  updateCandles: (symbol: string, timeframe: Timeframe, candles: OHLCV[]) => void;
  addCandle: (symbol: string, timeframe: Timeframe, candle: OHLCV) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedTimeframe: (timeframe: Timeframe) => void;
  setWatchlist: (watchlist: string[]) => void;
  setMarketSession: (session: MarketSession) => void;
  setKillZone: (killZone: { zone: string; active: boolean }) => void;
  setIndicators: (indicators: Partial<TradingState['indicators']>) => void;
  setIctAnalysis: (analysis: Partial<TradingState['ictAnalysis']>) => void;
  setQullaSetups: (setups: QullamagieSetup[]) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

const initialState = {
  portfolio: null,
  positions: [],
  orders: [],
  pendingOrders: [],
  trades: [],
  quotes: new Map(),
  orderBooks: new Map(),
  candles: new Map(),
  selectedSymbol: 'AAPL',
  selectedTimeframe: '5m' as Timeframe,
  watchlist: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY', 'QQQ', 'AMD'],
  marketSession: 'regular' as MarketSession,
  killZone: { zone: 'None', active: false },
  indicators: {
    rsi: null,
    macd: null,
    sma: [],
    ema: [],
  },
  ictAnalysis: {
    orderBlocks: [],
    fairValueGaps: [],
    marketStructure: null,
  },
  qullaSetups: [],
  isConnected: false,
  lastUpdate: null,
};

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setPortfolio: (portfolio) => set({ portfolio, lastUpdate: new Date() }),

    setPositions: (positions) => set({ positions, lastUpdate: new Date() }),

    updatePosition: (position) =>
      set((state) => {
        const idx = state.positions.findIndex((p) => p.symbol === position.symbol);
        if (idx === -1) {
          return { positions: [...state.positions, position], lastUpdate: new Date() };
        }
        const newPositions = [...state.positions];
        newPositions[idx] = position;
        return { positions: newPositions, lastUpdate: new Date() };
      }),

    addOrder: (order) =>
      set((state) => ({
        orders: [order, ...state.orders].slice(0, 100),
        pendingOrders:
          order.status === 'pending' || order.status === 'partial'
            ? [order, ...state.pendingOrders.filter((o) => o.id !== order.id)]
            : state.pendingOrders.filter((o) => o.id !== order.id),
        lastUpdate: new Date(),
      })),

    updateOrder: (order) =>
      set((state) => {
        const idx = state.orders.findIndex((o) => o.id === order.id);
        const newOrders = [...state.orders];
        if (idx !== -1) {
          newOrders[idx] = order;
        } else {
          newOrders.unshift(order);
        }
        return {
          orders: newOrders.slice(0, 100),
          pendingOrders:
            order.status === 'pending' || order.status === 'partial'
              ? [order, ...state.pendingOrders.filter((o) => o.id !== order.id)]
              : state.pendingOrders.filter((o) => o.id !== order.id),
          lastUpdate: new Date(),
        };
      }),

    setOrders: (orders) =>
      set({
        orders,
        pendingOrders: orders.filter((o) => o.status === 'pending' || o.status === 'partial'),
        lastUpdate: new Date(),
      }),

    addTrade: (trade) =>
      set((state) => ({
        trades: [trade, ...state.trades].slice(0, 100),
        lastUpdate: new Date(),
      })),

    setTrades: (trades) => set({ trades, lastUpdate: new Date() }),

    updateQuote: (quote) =>
      set((state) => {
        const newQuotes = new Map(state.quotes);
        newQuotes.set(quote.symbol, quote);
        return { quotes: newQuotes, lastUpdate: new Date() };
      }),

    updateOrderBook: (symbol, orderBook) =>
      set((state) => {
        const newOrderBooks = new Map(state.orderBooks);
        newOrderBooks.set(symbol, orderBook);
        return { orderBooks: newOrderBooks };
      }),

    updateCandles: (symbol, timeframe, candles) =>
      set((state) => {
        const newCandles = new Map(state.candles);
        const symbolCandles = newCandles.get(symbol) || new Map();
        symbolCandles.set(timeframe, candles);
        newCandles.set(symbol, symbolCandles);
        return { candles: newCandles };
      }),

    addCandle: (symbol, timeframe, candle) =>
      set((state) => {
        const newCandles = new Map(state.candles);
        const symbolCandles = newCandles.get(symbol) || new Map();
        const tfCandles = symbolCandles.get(timeframe) || [];

        // Check if we should update the last candle or add new one
        const lastCandle = tfCandles[tfCandles.length - 1];
        if (lastCandle && lastCandle.time === candle.time) {
          tfCandles[tfCandles.length - 1] = candle;
        } else {
          tfCandles.push(candle);
          if (tfCandles.length > 500) tfCandles.shift();
        }

        symbolCandles.set(timeframe, tfCandles);
        newCandles.set(symbol, symbolCandles);
        return { candles: newCandles };
      }),

    setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

    setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),

    setWatchlist: (watchlist) => set({ watchlist }),

    setMarketSession: (session) => set({ marketSession: session }),

    setKillZone: (killZone) => set({ killZone }),

    setIndicators: (indicators) =>
      set((state) => ({
        indicators: { ...state.indicators, ...indicators },
      })),

    setIctAnalysis: (analysis) =>
      set((state) => ({
        ictAnalysis: { ...state.ictAnalysis, ...analysis },
      })),

    setQullaSetups: (setups) => set({ qullaSetups: setups }),

    setConnected: (connected) => set({ isConnected: connected }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const selectCurrentQuote = (state: TradingState) =>
  state.quotes.get(state.selectedSymbol);

export const selectCurrentOrderBook = (state: TradingState) =>
  state.orderBooks.get(state.selectedSymbol);

export const selectCurrentCandles = (state: TradingState) => {
  const symbolCandles = state.candles.get(state.selectedSymbol);
  return symbolCandles?.get(state.selectedTimeframe) || [];
};

export const selectPositionBySymbol = (symbol: string) => (state: TradingState) =>
  state.positions.find((p) => p.symbol === symbol);

export const selectTotalUnrealizedPnL = (state: TradingState) =>
  state.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

export const selectTotalRealizedPnL = (state: TradingState) =>
  state.positions.reduce((sum, p) => sum + p.realizedPnL, 0);
