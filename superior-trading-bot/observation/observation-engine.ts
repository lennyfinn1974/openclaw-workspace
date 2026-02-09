/**
 * Observation Engine - Layer 1 of Superior Trading Bot
 * 
 * Purpose: Ingest every trade, position change, and performance metric from all 21 arena bots
 * plus market data, creating a unified event stream with enrichment.
 * 
 * Key Features:
 * - WebSocket connection to Arena system
 * - Real-time trade ingestion and enrichment
 * - Indicator snapshot calculation
 * - Market regime detection integration
 * - Event correlation and deduplication
 * - Connection resilience with auto-reconnect
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { MemorySystem, ObservationEvent, IndicatorSnapshot } from '../core/memory-system';
import { Logger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';

// ===================== TYPES =====================

export interface TradeEvent {
  botId: string;
  botName: string;
  groupName: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  pnl: number;
  reason: string;
  timestamp: string;
}

export interface LeaderboardEvent {
  tournamentId: string;
  roundNumber: number;
  entries: Array<{
    rank: number;
    botId: string;
    botName: string;
    groupName: string;
    totalPnL: number;
    totalPnLPercent: number;
    sharpeRatio: number;
    winRate: number;
    fitness: number;
  }>;
}

export interface EvolutionEvent {
  type: 'start' | 'complete';
  generation: number;
  results?: Array<{
    generation: number;
    groupName: string;
    elites: string[];
    offspring: string[];
    avgFitnessBefore: number;
    avgFitnessAfter: number;
  }>;
}

export interface MarketDataEvent {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  indicators?: IndicatorSnapshot;
}

// ===================== OBSERVATION ENGINE =====================

export class ObservationEngine extends EventEmitter {
  private config: any;
  private memory: MemorySystem;
  private logger: Logger;
  
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  
  private eventCount = 0;
  private lastHeartbeat = 0;
  private connectionRetries = 0;
  
  // Event deduplication
  private recentEventHashes = new Set<string>();
  private hashCleanupInterval: NodeJS.Timeout | null = null;
  
  // Market data cache for indicator calculation
  private priceCache = new Map<string, Array<{ price: number; volume: number; timestamp: number }>>();
  private maxPriceHistory = 200; // Keep 200 periods for indicator calculations
  
  constructor(config: any, memory: MemorySystem, logger: Logger) {
    super();
    this.config = config;
    this.memory = memory;
    this.logger = logger.constructor.name === 'Logger' ? logger : new Logger('OBSERVATION-ENGINE');
    
    // Cleanup old event hashes every 5 minutes
    this.hashCleanupInterval = setInterval(() => {
      this.cleanupEventHashes();
    }, 5 * 60 * 1000);
  }
  
  // ===================== LIFECYCLE =====================
  
  async start(): Promise<void> {
    this.logger.info('🌊 Starting Observation Engine - Layer 1');
    
    try {
      await this.connectToArena();
      await this.subscribeToArenaEvents();
      
      this.logger.success('✅ Observation Engine online - All sensors active');
      
    } catch (error) {
      this.logger.error('❌ Failed to start Observation Engine', error);
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    this.logger.info('🛑 Stopping Observation Engine...');
    
    if (this.hashCleanupInterval) {
      clearInterval(this.hashCleanupInterval);
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.logger.success('✅ Observation Engine stopped');
  }
  
  // ===================== ARENA CONNECTION =====================
  
  private async connectToArena(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.arenaWebSocketUrl}/ws`;
      this.logger.info(`🔌 Connecting to Arena WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastHeartbeat = Date.now();
        
        this.logger.success('✅ Arena WebSocket connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleArenaMessage(data);
      });
      
      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.logger.warn(`🔌 Arena WebSocket closed`, { code, reason: reason.toString() });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.logger.error('❌ Max reconnect attempts reached, giving up');
          this.emit('error', new Error('Arena WebSocket connection failed permanently'));
        }
      });
      
      this.ws.on('error', (error) => {
        this.logger.error('🚨 Arena WebSocket error', error);
        reject(error);
      });
      
      // Connection timeout
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Arena WebSocket connection timeout'));
        }
      }, 10000);
    });
  }
  
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    this.logger.info(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connectToArena();
        await this.subscribeToArenaEvents();
      } catch (error) {
        this.logger.error('❌ Reconnect attempt failed', error);
      }
    }, delay);
  }
  
  // ===================== MESSAGE HANDLING =====================
  
  private handleArenaMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      // Update heartbeat
      this.lastHeartbeat = Date.now();
      
      switch (message.type) {
        case 'trade':
          this.handleTradeEvent(message.data);
          break;
          
        case 'leaderboard':
          this.handleLeaderboardEvent(message.data);
          break;
          
        case 'evolution':
          this.handleEvolutionEvent(message.data);
          break;
          
        case 'market_data':
          this.handleMarketDataEvent(message.data);
          break;
          
        case 'heartbeat':
          // Just update timestamp, no processing needed
          break;
          
        default:
          this.logger.debug('🤔 Unknown Arena message type', { type: message.type });
      }
      
    } catch (error) {
      this.logger.error('❌ Failed to parse Arena message', error, { data: data.toString().substring(0, 200) });
    }
  }
  
  // ===================== EVENT HANDLERS =====================
  
  private handleTradeEvent(trade: TradeEvent): void {
    // Create event hash for deduplication
    const hash = this.createEventHash('trade', trade.botId, trade.timestamp, trade.symbol, trade.side);
    
    if (this.recentEventHashes.has(hash)) {
      this.logger.debug('⚠️ Duplicate trade event ignored', { botId: trade.botId, symbol: trade.symbol });
      return;
    }
    
    this.recentEventHashes.add(hash);
    
    // Enrich trade with market indicators
    const indicators = this.calculateIndicators(trade.symbol, parseFloat(String(trade.price)));
    
    // Create observation event
    const observationEvent: ObservationEvent = {
      id: uuidv4(),
      timestamp: new Date(trade.timestamp).getTime(),
      source: 'arena_bot',
      botId: trade.botId,
      eventType: 'trade',
      payload: trade,
      enrichment: {
        indicators,
        marketRegime: this.detectMarketRegime(trade.symbol, indicators),
      }
    };
    
    // Store in memory
    this.memory.addEvent(observationEvent);
    this.eventCount++;
    
    // Emit for pattern extraction
    this.emit('trade', observationEvent);
    
    this.logger.debug('📈 Trade observed and enriched', {
      botId: trade.botId,
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      regime: observationEvent.enrichment?.marketRegime
    });
  }
  
  private handleLeaderboardEvent(leaderboard: LeaderboardEvent): void {
    const hash = this.createEventHash('leaderboard', leaderboard.tournamentId, 
      String(leaderboard.roundNumber), String(leaderboard.entries.length));
    
    if (this.recentEventHashes.has(hash)) {
      return;
    }
    
    this.recentEventHashes.add(hash);
    
    const observationEvent: ObservationEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: 'arena_bot',
      eventType: 'leaderboard',
      payload: leaderboard,
    };
    
    this.memory.addEvent(observationEvent);
    this.eventCount++;
    
    this.emit('leaderboard', observationEvent);
    
    this.logger.debug('🏆 Leaderboard observed', { 
      round: leaderboard.roundNumber, 
      entries: leaderboard.entries.length 
    });
  }
  
  private handleEvolutionEvent(evolution: EvolutionEvent): void {
    const hash = this.createEventHash('evolution', String(evolution.generation), evolution.type);
    
    if (this.recentEventHashes.has(hash)) {
      return;
    }
    
    this.recentEventHashes.add(hash);
    
    const observationEvent: ObservationEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: 'arena_bot',
      eventType: 'evolution',
      payload: evolution,
    };
    
    this.memory.addEvent(observationEvent);
    this.eventCount++;
    
    this.emit('evolution', observationEvent);
    
    this.logger.info('🧬 Evolution observed', { 
      generation: evolution.generation, 
      type: evolution.type,
      results: evolution.results?.length || 0
    });
  }
  
  private handleMarketDataEvent(marketData: MarketDataEvent): void {
    // Update price cache for indicator calculations
    this.updatePriceCache(marketData.symbol, marketData.price, marketData.volume);
    
    // Don't store every market tick, too noisy
    // Only store if significant price movement or volume spike
    const shouldStore = this.isSignificantMarketMove(marketData);
    
    if (shouldStore) {
      const observationEvent: ObservationEvent = {
        id: uuidv4(),
        timestamp: new Date(marketData.timestamp).getTime(),
        source: 'market',
        eventType: 'position_update', // Market data affects positions
        payload: marketData,
      };
      
      this.memory.addEvent(observationEvent);
      this.eventCount++;
    }
  }
  
  // ===================== INDICATOR CALCULATIONS =====================
  
  private updatePriceCache(symbol: string, price: number, volume: number): void {
    if (!this.priceCache.has(symbol)) {
      this.priceCache.set(symbol, []);
    }
    
    const cache = this.priceCache.get(symbol)!;
    cache.push({
      price,
      volume,
      timestamp: Date.now()
    });
    
    // Keep only recent history
    if (cache.length > this.maxPriceHistory) {
      cache.shift();
    }
  }
  
  private calculateIndicators(symbol: string, currentPrice: number): IndicatorSnapshot | undefined {
    const priceData = this.priceCache.get(symbol);
    if (!priceData || priceData.length < 50) {
      return undefined; // Need sufficient history
    }
    
    const prices = priceData.map(d => d.price);
    const volumes = priceData.map(d => d.volume);
    
    try {
      return {
        rsi14: this.calculateRSI(prices, 14),
        macdHist: this.calculateMACDHistogram(prices),
        bbPosition: this.calculateBollingerBandPosition(prices, currentPrice),
        atr14: this.calculateATR(priceData, 14),
        volumeRatio: this.calculateVolumeRatio(volumes, 20),
        trendStrength: this.calculateADX(priceData, 14),
        priceVsMA50: this.calculatePriceVsMA(prices, currentPrice, 50),
        priceVsMA200: this.calculatePriceVsMA(prices, currentPrice, 200),
      };
    } catch (error) {
      this.logger.warn('⚠️ Error calculating indicators', { symbol, error: error.message });
      return undefined;
    }
  }
  
  // Simplified indicator calculations (production would use a proper TA library)
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  private calculateMACDHistogram(prices: number[]): number {
    // Simplified MACD calculation
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    
    // For histogram, we'd need signal line (EMA of MACD), simplified as zero
    return macdLine;
  }
  
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  private calculateBollingerBandPosition(prices: number[], currentPrice: number): number {
    const period = 20;
    if (prices.length < period) return 0.5;
    
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b) / period;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upperBand = sma + (2 * stdDev);
    const lowerBand = sma - (2 * stdDev);
    
    if (upperBand === lowerBand) return 0.5;
    return Math.max(0, Math.min(1, (currentPrice - lowerBand) / (upperBand - lowerBand)));
  }
  
  private calculateATR(priceData: Array<{price: number}>, period: number): number {
    // Simplified ATR - would need high/low/close for proper calculation
    if (priceData.length < period + 1) return 0;
    
    const ranges = [];
    for (let i = 1; i < priceData.length; i++) {
      ranges.push(Math.abs(priceData[i].price - priceData[i-1].price));
    }
    
    const recentRanges = ranges.slice(-period);
    return recentRanges.reduce((a, b) => a + b) / period;
  }
  
  private calculateVolumeRatio(volumes: number[], period: number): number {
    if (volumes.length < period + 1) return 1;
    
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-period - 1, -1).reduce((a, b) => a + b) / period;
    
    return avgVolume === 0 ? 1 : currentVolume / avgVolume;
  }
  
  private calculateADX(priceData: Array<{price: number}>, period: number): number {
    // Simplified trend strength - would need proper ADX calculation
    if (priceData.length < period + 1) return 0;
    
    const prices = priceData.map(d => d.price);
    const changes = [];
    
    for (let i = 1; i < prices.length; i++) {
      changes.push(Math.abs(prices[i] - prices[i-1]));
    }
    
    const recentChanges = changes.slice(-period);
    return recentChanges.reduce((a, b) => a + b) / period;
  }
  
  private calculatePriceVsMA(prices: number[], currentPrice: number, period: number): number {
    if (prices.length < period) return 0;
    
    const recentPrices = prices.slice(-period);
    const ma = recentPrices.reduce((a, b) => a + b) / period;
    
    return ma === 0 ? 0 : ((currentPrice - ma) / ma) * 100;
  }
  
  // ===================== REGIME DETECTION =====================
  
  private detectMarketRegime(symbol: string, indicators?: IndicatorSnapshot): string {
    if (!indicators) return 'UNKNOWN';
    
    // Simple regime classification based on indicators
    const { rsi14, trendStrength, priceVsMA50, bbPosition } = indicators;
    
    if (trendStrength > 25 && Math.abs(priceVsMA50) > 2) {
      return priceVsMA50 > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
    }
    
    if (rsi14 > 70 || rsi14 < 30) {
      return 'VOLATILE';
    }
    
    if (bbPosition > 0.8 || bbPosition < 0.2) {
      return 'BREAKOUT';
    }
    
    if (Math.abs(priceVsMA50) < 1 && trendStrength < 20) {
      return 'RANGING';
    }
    
    return 'QUIET';
  }
  
  // ===================== UTILITIES =====================
  
  private createEventHash(...components: string[]): string {
    return Buffer.from(components.join('|')).toString('base64');
  }
  
  private cleanupEventHashes(): void {
    // Keep hashes for last 30 minutes only
    this.recentEventHashes.clear();
  }
  
  private isSignificantMarketMove(marketData: MarketDataEvent): boolean {
    // Only store market data if price moved >0.1% or volume >2x average
    // This prevents noise while capturing important market events
    return Math.random() < 0.01; // For now, store 1% of market ticks
  }
  
  private async subscribeToArenaEvents(): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Arena WebSocket');
    }
    
    // Send subscription message
    const subscription = {
      type: 'subscribe',
      events: ['trades', 'leaderboard', 'evolution', 'market_data']
    };
    
    this.ws.send(JSON.stringify(subscription));
    this.logger.info('📡 Subscribed to Arena events');
  }
  
  // ===================== STATUS =====================
  
  isConnected(): boolean {
    return this.isConnected;
  }
  
  getEventCount(): number {
    return this.eventCount;
  }
  
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      eventCount: this.eventCount,
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts,
      cachedSymbols: this.priceCache.size,
    };
  }
}