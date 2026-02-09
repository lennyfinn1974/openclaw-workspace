// API Service - REST endpoints for Trading Platform
import type {
  Portfolio,
  Position,
  Order,
  Trade,
  Quote,
  OrderBook,
  OHLCV,
  Timeframe,
  RSI,
  MACD,
  MovingAverage,
  OrderBlock,
  FairValueGap,
  MarketStructure,
  QullamagieSetup,
  LiquidityLevel,
} from '@/types/trading';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8101';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// ===================== PORTFOLIO =====================

export async function getPortfolio(): Promise<Portfolio> {
  return fetchApi<Portfolio>('/api/portfolio');
}

export async function resetPortfolio(balance: number = 100000): Promise<{ success: boolean; portfolio: Portfolio }> {
  return fetchApi('/api/portfolio/reset', {
    method: 'POST',
    body: JSON.stringify({ balance }),
  });
}

// ===================== POSITIONS =====================

export async function getPositions(): Promise<Position[]> {
  return fetchApi<Position[]>('/api/positions');
}

export async function getPosition(symbol: string): Promise<Position> {
  return fetchApi<Position>(`/api/positions/${symbol}`);
}

// ===================== ORDERS =====================

export async function getOrders(status?: string): Promise<Order[]> {
  const params = status ? `?status=${status}` : '';
  return fetchApi<Order[]>(`/api/orders${params}`);
}

export async function getOrder(orderId: string): Promise<Order> {
  return fetchApi<Order>(`/api/orders/${orderId}`);
}

export async function placeOrder(params: {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: string;
}): Promise<Order> {
  return fetchApi<Order>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function cancelOrder(orderId: string): Promise<Order> {
  return fetchApi<Order>(`/api/orders/${orderId}`, {
    method: 'DELETE',
  });
}

// ===================== TRADES =====================

export async function getTrades(symbol?: string, limit: number = 50): Promise<Trade[]> {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  params.set('limit', limit.toString());
  return fetchApi<Trade[]>(`/api/trades?${params}`);
}

// ===================== MARKET DATA =====================

export async function getQuote(symbol: string): Promise<Quote> {
  return fetchApi<Quote>(`/api/quote/${symbol}`);
}

export async function getQuotes(): Promise<Quote[]> {
  return fetchApi<Quote[]>('/api/quotes');
}

export async function getOrderBook(symbol: string, levels: number = 10): Promise<OrderBook> {
  return fetchApi<OrderBook>(`/api/orderbook/${symbol}?levels=${levels}`);
}

export async function getCandles(symbol: string, timeframe: Timeframe): Promise<OHLCV[]> {
  return fetchApi<OHLCV[]>(`/api/candles/${symbol}?timeframe=${timeframe}`);
}

export async function getSymbols(): Promise<string[]> {
  return fetchApi<string[]>('/api/symbols');
}

export async function getMarketSession(): Promise<{
  session: string;
  killZone: { zone: string; active: boolean };
}> {
  return fetchApi('/api/market/session');
}

// ===================== TECHNICAL ANALYSIS =====================

export async function getIndicators(
  symbol: string,
  timeframe: Timeframe
): Promise<{
  rsi: RSI;
  macd: MACD;
  movingAverages: { sma: MovingAverage[]; ema: MovingAverage[] };
}> {
  return fetchApi(`/api/analysis/${symbol}/indicators?timeframe=${timeframe}`);
}

export async function getIctAnalysis(
  symbol: string,
  timeframe: Timeframe
): Promise<{
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquidityLevels: LiquidityLevel[];
  marketStructure: MarketStructure;
}> {
  return fetchApi(`/api/analysis/${symbol}/ict?timeframe=${timeframe}`);
}

export async function getQullaSetups(symbol: string): Promise<QullamagieSetup[]> {
  return fetchApi<QullamagieSetup[]>(`/api/analysis/${symbol}/qullamaggie`);
}

export async function calculatePositionSize(params: {
  portfolioValue: number;
  riskPercent: number;
  entryPrice: number;
  stopLoss: number;
}): Promise<{
  shares: number;
  positionValue: number;
  riskAmount: number;
  maxLoss: number;
}> {
  return fetchApi('/api/analysis/position-size', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ===================== RISK SETTINGS =====================

export async function getRiskSettings(): Promise<{
  max_risk_per_trade: number;
  max_daily_loss: number;
  max_position_size: number;
  max_open_positions: number;
}> {
  return fetchApi('/api/risk-settings');
}

export async function updateRiskSettings(params: {
  maxRiskPerTrade?: number;
  maxDailyLoss?: number;
  maxPositionSize?: number;
  maxOpenPositions?: number;
}): Promise<{ success: boolean }> {
  return fetchApi('/api/risk-settings', {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

// ===================== WATCHLISTS =====================

export async function getWatchlists(): Promise<{ id: string; name: string; symbols: string[] }[]> {
  return fetchApi('/api/watchlists');
}

export async function saveWatchlist(params: { id: string; name: string; symbols: string[] }): Promise<void> {
  return fetchApi('/api/watchlists', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ===================== HEALTH =====================

export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  return fetchApi('/api/health');
}
