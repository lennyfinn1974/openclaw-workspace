// Core Trading Types for Professional Trading Platform

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';
export type MarketSession = 'pre_market' | 'regular' | 'after_hours' | 'closed';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  avgFillPrice?: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  dayPnL: number;
  dayPnLPercent: number;
}

export interface Portfolio {
  cash: number;
  buyingPower: number;
  totalValue: number;
  dayPnL: number;
  dayPnLPercent: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  total: number;
  commission: number;
  timestamp: Date;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
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
  source?: 'yahoo' | 'binance' | 'alpaca' | 'eodhd' | 'simulated'; // ARENA: Track data source for real data validation
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
  timestamp: Date;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export interface ChartData {
  symbol: string;
  timeframe: Timeframe;
  data: OHLCV[];
}

// Technical Analysis Types
export interface TechnicalIndicator {
  name: string;
  value: number;
  signal?: 'bullish' | 'bearish' | 'neutral';
}

export interface RSI {
  value: number;
  overbought: boolean;
  oversold: boolean;
}

export interface MACD {
  macd: number;
  signal: number;
  histogram: number;
  crossover?: 'bullish' | 'bearish';
}

export interface MovingAverage {
  period: number;
  type: 'sma' | 'ema';
  value: number;
}

// ICT Methodology Types
export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  startTime: number;
  endTime?: number;
  mitigated: boolean;
  strength: number;
}

export interface FairValueGap {
  id: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  midpoint: number;
  time: number;
  filled: boolean;
  fillPercent: number;
}

export interface LiquidityLevel {
  price: number;
  type: 'buy_side' | 'sell_side';
  strength: number;
  swept: boolean;
}

export interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'ranging';
  swingHighs: { price: number; time: number }[];
  swingLows: { price: number; time: number }[];
  breakOfStructure?: { price: number; time: number; type: 'bullish' | 'bearish' };
  changeOfCharacter?: { price: number; time: number; type: 'bullish' | 'bearish' };
}

// Qullamaggie Setup Types
export type QullamSetupType = 'common_breakout' | 'episodic_pivot' | 'power_earnings_gap' | 'ipo_breakout';

export interface QullamagieSetup {
  id: string;
  symbol: string;
  type: QullamSetupType;
  pivotPrice: number;
  stopLoss: number;
  riskPercent: number;
  volumeRatio: number;
  consolidationDays: number;
  relativeStrength: number;
  score: number;
  timestamp: Date;
}

// Kill Zones
export interface KillZone {
  name: string;
  startHour: number;
  endHour: number;
  timezone: string;
  active: boolean;
}

// Risk Management
export interface RiskParameters {
  maxRiskPerTrade: number; // 0.3-0.5%
  maxDailyLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
}

export interface PositionSizeCalculation {
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  riskAmount: number;
  riskPercent: number;
  shares: number;
  positionValue: number;
  potentialLoss: number;
}

// WebSocket Message Types
export type WSMessageType =
  | 'quote_update'
  | 'order_update'
  | 'trade_executed'
  | 'position_update'
  | 'orderbook_update'
  | 'chart_update'
  | 'alert';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: Date;
}

// Watchlist
export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Alerts
export type AlertCondition = 'price_above' | 'price_below' | 'volume_above' | 'percent_change';

export interface Alert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  value: number;
  triggered: boolean;
  triggeredAt?: Date;
  createdAt: Date;
}
