/**
 * Main Observation Engine - Layer 1 of Meta-Cognitive Trading System
 * Coordinates WebSocket ingestion, event enrichment, and ring buffer storage
 */

import { EventEmitter } from 'events';
import { ObservationRingBuffer } from './RingBuffer';
import { ArenaWebSocketClient } from './ArenaWebSocketClient';
import { EventEnrichmentEngine } from './EventEnrichmentEngine';
import { 
  ObservationEvent, 
  RingBufferQuery, 
  RingBufferStats,
  StrategyFingerprint,
  TradeEvent,
  AttributedOutcome
} from '../types/core';

interface ObservationEngineConfig {
  arenaUrl?: string;
  bufferSize?: number;
  enableEnrichment?: boolean;
  cleanupInterval?: number;
}

interface ObservationEngineStats {
  status: 'starting' | 'running' | 'error' | 'stopped';
  eventsProcessed: number;
  enrichmentErrors: number;
  connectionStats: any;
  bufferStats: RingBufferStats;
  uptime: number;
  performanceMetrics: {
    avgEnrichmentTime: number;
    eventsPerSecond: number;
    lastError?: string;
  };
}

export class ObservationEngine extends EventEmitter {
  private config: ObservationEngineConfig;
  private ringBuffer: ObservationRingBuffer;
  private arenaClient: ArenaWebSocketClient;
  private enrichmentEngine: EventEnrichmentEngine;
  
  private isRunning = false;
  private startTime = 0;
  private eventsProcessed = 0;
  private enrichmentErrors = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  // Performance tracking
  private enrichmentTimes: number[] = [];
  private lastEventTime = 0;
  private eventTimestamps: number[] = [];

  constructor(config: ObservationEngineConfig = {}) {
    super();
    
    this.config = {
      arenaUrl: config.arenaUrl || 'ws://localhost:3000',
      bufferSize: config.bufferSize || 10000,
      enableEnrichment: config.enableEnrichment !== false,
      cleanupInterval: config.cleanupInterval || 300000 // 5 minutes
    };

    this.ringBuffer = new ObservationRingBuffer(this.config.bufferSize!);
    this.arenaClient = new ArenaWebSocketClient(this.config.arenaUrl!);
    this.enrichmentEngine = new EventEnrichmentEngine();

    this.setupEventHandlers();
  }

  /**
   * Start the observation engine
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Observation Engine...');
    
    try {
      this.startTime = Date.now();
      this.isRunning = true;

      // Connect to arena WebSocket
      await this.arenaClient.connect();
      console.log('✅ Arena connection established');

      // Start cleanup timer
      this.startCleanupTimer();

      this.emit('started');
      console.log('🎯 Observation Engine is running and ingesting events');

    } catch (error) {
      this.isRunning = false;
      console.error('❌ Failed to start Observation Engine:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the observation engine
   */
  async stop(): Promise<void> {
    console.log('⏹️ Stopping Observation Engine...');
    
    this.isRunning = false;
    
    // Disconnect from arena
    this.arenaClient.disconnect();
    
    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.emit('stopped');
    console.log('✅ Observation Engine stopped');
  }

  /**
   * Query events from ring buffer
   */
  queryEvents(query: RingBufferQuery): ObservationEvent[] {
    return this.ringBuffer.query(query);
  }

  /**
   * Get latest events
   */
  getLatestEvents(count: number = 100): ObservationEvent[] {
    return this.ringBuffer.getLatest(count);
  }

  /**
   * Add market data for enrichment
   */
  addMarketData(symbol: string, bid: number, ask: number, bidSize?: number, askSize?: number): void {
    this.enrichmentEngine.updateMarketData(symbol, bid, ask, bidSize, askSize);
  }

  /**
   * Add OHLCV data for indicator calculation
   */
  addOHLCVData(symbol: string, open: number, high: number, low: number, close: number, volume: number): void {
    this.enrichmentEngine.addOHLCVData(symbol, open, high, low, close, volume);
  }

  /**
   * Get indicator snapshot for a symbol
   */
  getIndicatorSnapshot(symbol: string) {
    return this.enrichmentEngine.getIndicatorSnapshot(symbol);
  }

  /**
   * Get market summary for dashboard
   */
  getMarketSummary(symbol: string) {
    return this.enrichmentEngine.getMarketSummary(symbol);
  }

  /**
   * Get engine statistics
   */
  getStats(): ObservationEngineStats {
    const now = Date.now();
    const uptime = this.isRunning ? now - this.startTime : 0;
    
    // Calculate average enrichment time
    const recentEnrichmentTimes = this.enrichmentTimes.slice(-100);
    const avgEnrichmentTime = recentEnrichmentTimes.length > 0 
      ? recentEnrichmentTimes.reduce((a, b) => a + b, 0) / recentEnrichmentTimes.length 
      : 0;

    // Calculate events per second (last 60 seconds)
    const recentEventTimestamps = this.eventTimestamps.filter(t => t > now - 60000);
    const eventsPerSecond = recentEventTimestamps.length / 60;

    return {
      status: this.isRunning ? 'running' : 'stopped',
      eventsProcessed: this.eventsProcessed,
      enrichmentErrors: this.enrichmentErrors,
      connectionStats: this.arenaClient.getStats(),
      bufferStats: this.ringBuffer.getStats(),
      uptime,
      performanceMetrics: {
        avgEnrichmentTime,
        eventsPerSecond
      }
    };
  }

  /**
   * Generate strategy fingerprint for a bot
   */
  generateStrategyFingerprint(botId: string, lookbackHours: number = 24): StrategyFingerprint | null {
    const cutoff = Date.now() - (lookbackHours * 60 * 60 * 1000);
    
    const trades = this.ringBuffer.query({
      eventType: 'trade',
      botId,
      startTime: cutoff
    }).map(e => e.payload as TradeEvent);

    if (trades.length < 5) {
      return null; // Not enough trades for fingerprint
    }

    // Calculate behavioral metrics
    const holdingPeriods: number[] = [];
    const directions = trades.map(t => t.direction);
    const buyCount = directions.filter(d => d === 'buy').length;
    const directionBias = (buyCount / trades.length) * 2 - 1; // -1 to 1

    // Trade frequency (trades per hour)
    const timeSpan = Math.max(1, (Date.now() - Math.min(...trades.map(t => t.timestamp))) / (1000 * 60 * 60));
    const tradeFrequency = trades.length / timeSpan;

    // Regime preferences
    const regimeCounts: Record<string, number> = {};
    trades.forEach(trade => {
      regimeCounts[trade.regime] = (regimeCounts[trade.regime] || 0) + 1;
    });
    
    const preferredRegimes = Object.entries(regimeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([regime]) => regime as any);

    return {
      botId,
      avgHoldingPeriod: holdingPeriods.length > 0 ? holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length : 0,
      tradeFrequency,
      preferredRegimes,
      directionBias,
      sizingBehavior: 'fixed', // Would need more analysis to determine
      performanceByRegime: new Map() // Would need outcome data to calculate
    };
  }

  /**
   * Clear ring buffer
   */
  clearBuffer(): void {
    this.ringBuffer.clear();
    console.log('🗑️ Ring buffer cleared');
  }

  // Private methods

  private setupEventHandlers(): void {
    // Handle raw observations from arena
    this.arenaClient.on('observation', async (event: ObservationEvent) => {
      await this.processObservation(event);
    });

    // Handle leaderboard updates
    this.arenaClient.on('leaderboard', (leaderboard) => {
      this.emit('leaderboard', leaderboard);
    });

    // Handle connection errors
    this.arenaClient.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private async processObservation(event: ObservationEvent): Promise<void> {
    try {
      const startTime = Date.now();

      // Enrich the event if enabled
      const enrichedEvent = this.config.enableEnrichment 
        ? await this.enrichmentEngine.enrichEvent(event)
        : event;

      // Store in ring buffer
      this.ringBuffer.append(enrichedEvent);

      // Update metrics
      this.eventsProcessed++;
      this.eventTimestamps.push(Date.now());
      this.lastEventTime = Date.now();

      if (this.config.enableEnrichment) {
        const enrichmentTime = Date.now() - startTime;
        this.enrichmentTimes.push(enrichmentTime);
        
        // Keep only recent enrichment times for performance calculation
        if (this.enrichmentTimes.length > 1000) {
          this.enrichmentTimes.splice(0, this.enrichmentTimes.length - 1000);
        }
      }

      // Emit processed event
      this.emit('event', enrichedEvent);

      // Emit specific event types for targeted listeners
      this.emit(`event:${event.eventType}`, enrichedEvent);

    } catch (error) {
      this.enrichmentErrors++;
      console.error('❌ Error processing observation:', error);
      this.emit('error', error);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval!);
  }

  private cleanup(): void {
    // Clean up enrichment engine
    this.enrichmentEngine.cleanup();
    
    // Clean up old event timestamps
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
    this.eventTimestamps = this.eventTimestamps.filter(t => t > cutoff);
    
    console.log('🧹 Cleanup completed');
  }
}