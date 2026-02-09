// Main Observation Engine - Layer 1 of Superior Trading Bot
// Orchestrates real-time data ingestion and event enrichment

import { ObservationRingBuffer } from './ring-buffer';
import { ArenaWebSocketClient } from './arena-client';
import { IndicatorEnrichment } from './enrichment';
import { ObservationEvent } from '../types/observation';

export interface ObservationEngineConfig {
  bufferSize: number;
  arenaUrl: string;
  enableEnrichment: boolean;
  enableTimeQueries: boolean;
}

export class ObservationEngine {
  private ringBuffer: ObservationRingBuffer;
  private arenaClient: ArenaWebSocketClient;
  private enrichment: IndicatorEnrichment;
  private isRunning: boolean = false;
  
  constructor(config: ObservationEngineConfig) {
    // Initialize ring buffer for event storage
    this.ringBuffer = new ObservationRingBuffer({
      maxEvents: config.bufferSize,
      enableTimeQueries: config.enableTimeQueries
    });
    
    // Initialize arena WebSocket client
    this.arenaClient = new ArenaWebSocketClient(this.ringBuffer);
    
    // Initialize indicator enrichment pipeline
    this.enrichment = new IndicatorEnrichment();
  }
  
  /**
   * Start the observation engine - begin data ingestion
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Observation Engine (Layer 1)');
    
    try {
      // Connect to arena WebSocket
      await this.arenaClient.connect();
      
      // Start enrichment pipeline
      this.enrichment.start();
      
      this.isRunning = true;
      console.log('✅ Observation Engine operational - ingesting 21-bot arena data');
      
      // Log status every 30 seconds
      this.startStatusLogging();
      
    } catch (error) {
      console.error('❌ Failed to start Observation Engine:', error);
      throw error;
    }
  }
  
  /**
   * Stop the observation engine
   */
  stop(): void {
    console.log('🛑 Stopping Observation Engine');
    
    this.arenaClient.disconnect();
    this.enrichment.stop();
    this.isRunning = false;
  }
  
  /**
   * Get events from time range - primary query interface for Layer 2
   */
  getEventsInTimeRange(startTime: number, endTime: number): ObservationEvent[] {
    return this.ringBuffer.getEventsInRange(startTime, endTime);
  }
  
  /**
   * Get recent events - for real-time analysis
   */
  getRecentEvents(count: number): ObservationEvent[] {
    return this.ringBuffer.getRecentEvents(count);
  }
  
  /**
   * Get trade events only (filtered view)
   */
  getTradeEvents(timeRange?: { start: number; end: number }): ObservationEvent[] {
    let events: ObservationEvent[];
    
    if (timeRange) {
      events = this.getEventsInTimeRange(timeRange.start, timeRange.end);
    } else {
      events = this.getRecentEvents(1000);
    }
    
    return events.filter(event => event.eventType === 'trade');
  }
  
  /**
   * Get fitness events (for meta-cognitive learning)
   */
  getFitnessEvents(timeRange?: { start: number; end: number }): ObservationEvent[] {
    let events: ObservationEvent[];
    
    if (timeRange) {
      events = this.getEventsInTimeRange(timeRange.start, timeRange.end);
    } else {
      events = this.getRecentEvents(1000);
    }
    
    return events.filter(event => event.eventType === 'fitness_change');
  }
  
  /**
   * Get system status and statistics
   */
  getStatus(): {
    running: boolean;
    connection: any;
    buffer: any;
    enrichment: any;
  } {
    return {
      running: this.isRunning,
      connection: this.arenaClient.getStatus(),
      buffer: this.ringBuffer.getStats(),
      enrichment: this.enrichment.getStats()
    };
  }
  
  /**
   * Log status periodically for monitoring
   */
  private startStatusLogging(): void {
    if (!this.isRunning) return;
    
    const logStatus = () => {
      const status = this.getStatus();
      console.log(`📊 Observation Engine Status:
        - Connected: ${status.connection.connected}
        - Buffer: ${status.buffer.size}/${status.buffer.maxSize} events (${(status.buffer.utilization * 100).toFixed(1)}%)
        - Enriched: ${status.enrichment.enrichedCount} trades`);
    };
    
    // Log immediately
    logStatus();
    
    // Then every 30 seconds
    const interval = setInterval(() => {
      if (this.isRunning) {
        logStatus();
      } else {
        clearInterval(interval);
      }
    }, 30000);
  }
}

// Export factory function for easy initialization
export function createObservationEngine(config?: Partial<ObservationEngineConfig>): ObservationEngine {
  const defaultConfig: ObservationEngineConfig = {
    bufferSize: 10000,
    arenaUrl: 'ws://localhost:3000',
    enableEnrichment: true,
    enableTimeQueries: true
  };
  
  return new ObservationEngine({ ...defaultConfig, ...config });
}

// Export all components
export { ObservationRingBuffer } from './ring-buffer';
export { ArenaWebSocketClient } from './arena-client';
export { IndicatorEnrichment } from './enrichment';
export * from '../types/observation';