// Shared utilities for market data brokers
// Rate limiting, validation, and fetch helpers

import type { RateLimitConfig } from './types';

// Rate limiter with token bucket algorithm
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private readonly retryAfterMs: number;

  constructor(config: RateLimitConfig) {
    this.maxTokens = config.maxRequests;
    this.tokens = this.maxTokens;
    this.refillRate = config.maxRequests / config.windowMs;
    this.lastRefill = Date.now();
    this.retryAfterMs = config.retryAfterMs;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  canMakeRequest(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  consumeToken(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  getRetryAfterMs(): number {
    return this.retryAfterMs;
  }

  getRemainingTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Fetch with timeout and retry
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Exponential backoff retry
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Symbol validation (1-15 uppercase alphanumeric + common suffixes)
export function validateSymbol(symbol: string): boolean {
  if (typeof symbol !== 'string') return false;
  const cleaned = symbol.trim().toUpperCase();
  if (cleaned.length < 1 || cleaned.length > 20) return false;
  // Allow letters, numbers, dash, slash, equals (for Yahoo futures like CL=F)
  return /^[A-Z0-9\-/=.]+$/.test(cleaned);
}

// Sanitize symbol for API use
export function sanitizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

// User agent for Yahoo Finance requests
export const YAHOO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Symbol mapping for different asset types
export const CRYPTO_SYMBOLS: Record<string, { binance: string; coingecko: string }> = {
  'BTC': { binance: 'BTCUSDT', coingecko: 'bitcoin' },
  'ETH': { binance: 'ETHUSDT', coingecko: 'ethereum' },
  'SOL': { binance: 'SOLUSDT', coingecko: 'solana' },
  'BNB': { binance: 'BNBUSDT', coingecko: 'binancecoin' },
  'XRP': { binance: 'XRPUSDT', coingecko: 'ripple' },
  'ADA': { binance: 'ADAUSDT', coingecko: 'cardano' },
  'DOGE': { binance: 'DOGEUSDT', coingecko: 'dogecoin' },
  'AVAX': { binance: 'AVAXUSDT', coingecko: 'avalanche-2' },
  'DOT': { binance: 'DOTUSDT', coingecko: 'polkadot' },
  'LINK': { binance: 'LINKUSDT', coingecko: 'chainlink' },
  'MATIC': { binance: 'MATICUSDT', coingecko: 'matic-network' },
  'UNI': { binance: 'UNIUSDT', coingecko: 'uniswap' },
  'SHIB': { binance: 'SHIBUSDT', coingecko: 'shiba-inu' },
  'LTC': { binance: 'LTCUSDT', coingecko: 'litecoin' },
  'ATOM': { binance: 'ATOMUSDT', coingecko: 'cosmos' },
  'ARB': { binance: 'ARBUSDT', coingecko: 'arbitrum' },
  'OP': { binance: 'OPUSDT', coingecko: 'optimism' },
  'APT': { binance: 'APTUSDT', coingecko: 'aptos' },
  'SUI': { binance: 'SUIUSDT', coingecko: 'sui' },
  'PEPE': { binance: 'PEPEUSDT', coingecko: 'pepe' },
};

// FX symbols used in the arena
const FX_SYMBOLS = new Set(['GBP/JPY', 'USD/TRY', 'USD/ZAR', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD']);

// Commodity symbols used in the arena
const COMMODITY_SYMBOLS = new Set(['CL=F', 'NG=F', 'SI=F', 'HG=F', 'GC=F', 'LTHM']);

// Detect if a symbol is forex
export function isFxSymbol(symbol: string): boolean {
  return FX_SYMBOLS.has(symbol.toUpperCase());
}

// Detect if a symbol is a commodity
export function isCommoditySymbol(symbol: string): boolean {
  return COMMODITY_SYMBOLS.has(symbol.toUpperCase());
}

// Detect if a symbol is crypto
export function isCryptoSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  // Check direct mapping
  if (CRYPTO_SYMBOLS[upper]) return true;
  // Check if it's a Binance pair
  if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('BTC')) return true;
  return false;
}

// Get Binance symbol from ticker
export function getBinanceSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (CRYPTO_SYMBOLS[upper]) {
    return CRYPTO_SYMBOLS[upper].binance;
  }
  // If already a pair, return as-is
  if (upper.endsWith('USDT') || upper.endsWith('BUSD')) {
    return upper;
  }
  // Default to USDT pair
  return `${upper}USDT`;
}

// Timeframe conversion
export function getYahooInterval(timeframe: string): { interval: string; range: string } {
  const map: Record<string, { interval: string; range: string }> = {
    '1m': { interval: '1m', range: '1d' },
    '5m': { interval: '5m', range: '5d' },
    '15m': { interval: '15m', range: '5d' },
    '30m': { interval: '30m', range: '5d' },
    '1h': { interval: '1h', range: '1mo' },
    '4h': { interval: '1h', range: '3mo' }, // Yahoo doesn't have 4h, use 1h
    '1d': { interval: '1d', range: '1y' },
    '1w': { interval: '1wk', range: '5y' },
  };
  return map[timeframe] || { interval: '1d', range: '1mo' };
}

export function getBinanceInterval(timeframe: string): string {
  const map: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1w': '1w',
  };
  return map[timeframe] || '1d';
}

// Calculate spread from bid/ask
export function calculateSpread(bid: number, ask: number): { spread: number; spreadPercent: number } {
  const spread = ask - bid;
  const midPrice = (bid + ask) / 2;
  const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;
  return {
    spread: Number(spread.toFixed(6)),
    spreadPercent: Number(spreadPercent.toFixed(4)),
  };
}

// Format price based on value
export function formatPrice(price: number): number {
  if (price >= 1000) return Number(price.toFixed(2));
  if (price >= 1) return Number(price.toFixed(4));
  if (price >= 0.01) return Number(price.toFixed(6));
  return Number(price.toFixed(8));
}

// Logging utility
export function logMarketData(source: string, action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${source}] ${action}:`, JSON.stringify(details));
}

// Error classification
export type ErrorType = 'rate_limit' | 'timeout' | 'network' | 'invalid_symbol' | 'api_error' | 'unknown';

export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429') || message.includes('too many')) {
    return 'rate_limit';
  }
  if (message.includes('timeout') || message.includes('aborted')) {
    return 'timeout';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
    return 'network';
  }
  if (message.includes('not found') || message.includes('invalid symbol') || message.includes('400')) {
    return 'invalid_symbol';
  }
  if (message.includes('500') || message.includes('503') || message.includes('api')) {
    return 'api_error';
  }
  return 'unknown';
}
