// EODHD WebSocket Manager — manages 3 streaming connections (forex, us-quote, crypto)
// Auto-reconnects with exponential backoff, normalizes ticks to MarketQuote

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import type {
  MarketQuote,
  EODHDEndpoint,
  EODHDForexTick,
  EODHDUSQuote,
  EODHDCryptoTick,
} from './types';
import { fromEodhdWsSymbol, getEodhdWsSubscriptions, logMarketData } from './utils';

const EODHD_WS_BASE = 'wss://ws.eodhistoricaldata.com/ws';
const HEARTBEAT_TIMEOUT_MS = 60_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const SESSION_CHECK_INTERVAL_MS = 60_000; // check market sessions every minute

interface EndpointState {
  ws: WebSocket | null;
  endpoint: EODHDEndpoint;
  url: string;
  symbols: string[];          // EODHD WS symbols to subscribe
  connected: boolean;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  heartbeatTimer: NodeJS.Timeout | null;
  lastMessageTime: number;
  messageCount: number;
  sessionPaused: boolean;     // true if disconnected due to market being closed
}

// Check if US stock market is in tradeable hours (4:00 AM - 8:00 PM EST)
function isUSMarketHours(): boolean {
  const now = new Date();
  const estHour = (now.getUTCHours() - 5 + 24) % 24;
  const day = now.getUTCDay();
  // Adjust day if UTC→EST crosses midnight
  const estDay = (now.getUTCHours() - 5 < 0) ? (day - 1 + 7) % 7 : day;
  if (estDay === 0 || estDay === 6) return false; // weekend
  return estHour >= 4 && estHour < 20; // 4:00 AM - 8:00 PM EST
}

// Check if FX market is open (Sunday 17:00 EST - Friday 17:00 EST)
function isFxMarketOpen(): boolean {
  const now = new Date();
  const estHour = (now.getUTCHours() - 5 + 24) % 24;
  const day = now.getUTCDay();
  const estDay = (now.getUTCHours() - 5 < 0) ? (day - 1 + 7) % 7 : day;
  if (estDay === 6) return false; // Saturday
  if (estDay === 0 && estHour < 17) return false; // Sunday before 17:00
  if (estDay === 5 && estHour >= 17) return false; // Friday after 17:00
  return true;
}

function isEndpointSessionActive(endpoint: EODHDEndpoint): boolean {
  switch (endpoint) {
    case 'us-quote': return isUSMarketHours();
    case 'forex': return isFxMarketOpen();
    case 'crypto': return true; // 24/7
  }
}

export class EODHDWebSocketManager extends EventEmitter {
  private apiKey: string;
  private endpoints: Map<EODHDEndpoint, EndpointState> = new Map();
  private running = false;
  private sessionCheckTimer: NodeJS.Timeout | null = null;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;

    const subscriptions = getEodhdWsSubscriptions();

    for (const endpoint of ['forex', 'us-quote', 'crypto'] as EODHDEndpoint[]) {
      this.endpoints.set(endpoint, {
        ws: null,
        endpoint,
        url: `${EODHD_WS_BASE}/${endpoint}?api_token=${this.apiKey}`,
        symbols: subscriptions[endpoint],
        connected: false,
        reconnectAttempts: 0,
        reconnectTimer: null,
        heartbeatTimer: null,
        lastMessageTime: 0,
        messageCount: 0,
        sessionPaused: false,
      });
    }
  }

  async connect(): Promise<void> {
    this.running = true;

    for (const [endpoint, state] of this.endpoints) {
      if (state.symbols.length === 0) {
        logMarketData('eodhd-ws', 'skip', { endpoint, reason: 'no symbols' });
        continue;
      }

      // Only connect if the market session is active for this endpoint
      if (isEndpointSessionActive(endpoint)) {
        this.connectEndpoint(endpoint);
      } else {
        state.sessionPaused = true;
        logMarketData('eodhd-ws', 'session-paused', { endpoint, reason: 'market closed' });
      }
    }

    // Start periodic session checker to connect/disconnect based on market hours
    this.startSessionChecker();
  }

  private startSessionChecker(): void {
    if (this.sessionCheckTimer) return;

    this.sessionCheckTimer = setInterval(() => {
      for (const [endpoint, state] of this.endpoints) {
        if (state.symbols.length === 0) continue;

        const shouldBeActive = isEndpointSessionActive(endpoint);

        if (shouldBeActive && state.sessionPaused) {
          // Market opened — connect
          state.sessionPaused = false;
          logMarketData('eodhd-ws', 'session-resumed', { endpoint });
          this.connectEndpoint(endpoint);
        } else if (!shouldBeActive && !state.sessionPaused && state.connected) {
          // Market closed — disconnect to save resources
          state.sessionPaused = true;
          logMarketData('eodhd-ws', 'session-paused', { endpoint, reason: 'market closed' });
          this.closeEndpoint(endpoint, true);
        }
      }
    }, SESSION_CHECK_INTERVAL_MS);
  }

  private connectEndpoint(endpoint: EODHDEndpoint): void {
    const state = this.endpoints.get(endpoint)!;
    if (!this.running) return;

    // Clean up any existing connection
    this.closeEndpoint(endpoint, false);

    logMarketData('eodhd-ws', 'connecting', { endpoint, symbols: state.symbols.length });

    const ws = new WebSocket(state.url);
    state.ws = ws;

    ws.on('open', () => {
      state.connected = true;
      state.reconnectAttempts = 0;
      logMarketData('eodhd-ws', 'connected', { endpoint });

      // Subscribe to all symbols for this endpoint
      this.subscribeEndpoint(endpoint, state.symbols);

      // Start heartbeat monitoring
      this.startHeartbeat(endpoint);
    });

    ws.on('message', (data: WebSocket.Data) => {
      state.lastMessageTime = Date.now();
      state.messageCount++;

      try {
        const message = JSON.parse(data.toString());

        // Skip status/subscription confirmation messages
        if (message.status_code || message.message) return;

        this.handleMessage(endpoint, message);
      } catch {
        // Ignore parse errors for binary/ping frames
      }
    });

    ws.on('error', (error: Error) => {
      logMarketData('eodhd-ws', 'error', { endpoint, error: error.message });
    });

    ws.on('close', (code: number, reason: Buffer) => {
      state.connected = false;
      const reasonStr = reason.toString();
      logMarketData('eodhd-ws', 'disconnected', { endpoint, code, reason: reasonStr });
      this.stopHeartbeat(endpoint);

      // Don't reconnect on 403 (plan doesn't cover this endpoint)
      if (reasonStr.includes('403') || code === 4003) {
        logMarketData('eodhd-ws', 'auth-failed', { endpoint, reason: 'API key does not have access — will not reconnect' });
        return;
      }

      this.scheduleReconnect(endpoint);
    });
  }

  private subscribeEndpoint(endpoint: EODHDEndpoint, symbols: string[]): void {
    const state = this.endpoints.get(endpoint)!;
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

    const msg = JSON.stringify({ action: 'subscribe', symbols: symbols.join(',') });
    state.ws.send(msg);
    logMarketData('eodhd-ws', 'subscribed', { endpoint, symbols });
  }

  private handleMessage(endpoint: EODHDEndpoint, message: unknown): void {
    let quote: MarketQuote | null = null;

    switch (endpoint) {
      case 'forex':
        quote = this.normalizeForexTick(message as EODHDForexTick);
        break;
      case 'us-quote':
        quote = this.normalizeUSQuote(message as EODHDUSQuote);
        break;
      case 'crypto':
        quote = this.normalizeCryptoTick(message as EODHDCryptoTick);
        break;
    }

    if (quote) {
      this.emit('quote', quote);
    }
  }

  private normalizeForexTick(tick: EODHDForexTick): MarketQuote | null {
    if (!tick.s || tick.a == null || tick.b == null) return null;

    const platformSymbol = fromEodhdWsSymbol(tick.s);
    if (!platformSymbol) return null;

    const bid = Number(tick.b);
    const ask = Number(tick.a);
    const last = (bid + ask) / 2;
    const changePercent = tick.dc ? Number(tick.dc) : 0;
    const change = tick.dd ? Number(tick.dd) : 0;

    return {
      symbol: platformSymbol,
      bid,
      bidSize: 100000,
      ask,
      askSize: 100000,
      last,
      lastSize: 10000,
      volume: 0,
      change,
      changePercent,
      high: last,
      low: last,
      open: last,
      previousClose: change !== 0 ? last - change : last,
      timestamp: new Date(tick.t || Date.now()),
    };
  }

  private normalizeUSQuote(tick: EODHDUSQuote): MarketQuote | null {
    if (!tick.s || tick.ap == null || tick.bp == null) return null;

    const platformSymbol = fromEodhdWsSymbol(tick.s);
    if (!platformSymbol) return null;

    const bid = Number(tick.bp);
    const ask = Number(tick.ap);
    const last = (bid + ask) / 2;

    return {
      symbol: platformSymbol,
      bid,
      bidSize: Number(tick.bs) || 100,
      ask,
      askSize: Number(tick.as) || 100,
      last,
      lastSize: 100,
      volume: 0,
      change: 0,
      changePercent: 0,
      high: last,
      low: last,
      open: last,
      previousClose: last,
      timestamp: new Date(tick.t || Date.now()),
    };
  }

  private normalizeCryptoTick(tick: EODHDCryptoTick): MarketQuote | null {
    if (!tick.s || tick.p == null) return null;

    const platformSymbol = fromEodhdWsSymbol(tick.s);
    if (!platformSymbol) return null;

    const last = Number(tick.p);
    const changePercent = tick.dc ? Number(tick.dc) : 0;
    const change = tick.dd ? Number(tick.dd) : 0;

    return {
      symbol: platformSymbol,
      bid: last * 0.9999,
      bidSize: 1,
      ask: last * 1.0001,
      askSize: 1,
      last,
      lastSize: Number(tick.q) || 0,
      volume: 0,
      change,
      changePercent,
      high: last,
      low: last,
      open: last,
      previousClose: change !== 0 ? last - change : last,
      timestamp: new Date(tick.t || Date.now()),
    };
  }

  private startHeartbeat(endpoint: EODHDEndpoint): void {
    const state = this.endpoints.get(endpoint)!;
    this.stopHeartbeat(endpoint);

    state.heartbeatTimer = setInterval(() => {
      if (state.lastMessageTime > 0 && Date.now() - state.lastMessageTime > HEARTBEAT_TIMEOUT_MS) {
        logMarketData('eodhd-ws', 'heartbeat-timeout', { endpoint, lastMsg: Date.now() - state.lastMessageTime });
        this.closeEndpoint(endpoint, false);
        this.scheduleReconnect(endpoint);
      }
    }, HEARTBEAT_TIMEOUT_MS / 2);
  }

  private stopHeartbeat(endpoint: EODHDEndpoint): void {
    const state = this.endpoints.get(endpoint)!;
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(endpoint: EODHDEndpoint): void {
    if (!this.running) return;

    const state = this.endpoints.get(endpoint)!;
    if (state.reconnectTimer) return;
    if (state.sessionPaused) return; // Don't reconnect during closed market

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, state.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    state.reconnectAttempts++;

    logMarketData('eodhd-ws', 'reconnect-scheduled', { endpoint, delay, attempt: state.reconnectAttempts });

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      this.connectEndpoint(endpoint);
    }, delay);
  }

  private closeEndpoint(endpoint: EODHDEndpoint, clearReconnect: boolean): void {
    const state = this.endpoints.get(endpoint)!;

    this.stopHeartbeat(endpoint);

    if (clearReconnect && state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    if (state.ws) {
      state.ws.removeAllListeners();
      if (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING) {
        state.ws.close();
      }
      state.ws = null;
    }

    state.connected = false;
  }

  getStats(): Record<string, { connected: boolean; messages: number; lastMessage: number; sessionPaused: boolean; marketOpen: boolean }> {
    const stats: Record<string, { connected: boolean; messages: number; lastMessage: number; sessionPaused: boolean; marketOpen: boolean }> = {};
    for (const [endpoint, state] of this.endpoints) {
      stats[endpoint] = {
        connected: state.connected,
        messages: state.messageCount,
        lastMessage: state.lastMessageTime,
        sessionPaused: state.sessionPaused,
        marketOpen: isEndpointSessionActive(endpoint),
      };
    }
    return stats;
  }

  isConnected(): boolean {
    for (const state of this.endpoints.values()) {
      if (state.symbols.length > 0 && state.connected) return true;
    }
    return false;
  }

  shutdown(): void {
    this.running = false;
    if (this.sessionCheckTimer) {
      clearInterval(this.sessionCheckTimer);
      this.sessionCheckTimer = null;
    }
    for (const endpoint of this.endpoints.keys()) {
      this.closeEndpoint(endpoint, true);
    }
    logMarketData('eodhd-ws', 'shutdown', {});
  }
}
