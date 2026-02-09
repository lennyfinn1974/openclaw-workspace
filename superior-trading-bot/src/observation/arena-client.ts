// WebSocket client for arena connection at localhost:3000
// Ingests real-time data from 21-bot tournament

import WebSocket from 'ws';
import { ObservationEvent, TradeEvent, PositionSnapshot, MarketRegime } from '../types/observation';
import { ObservationRingBuffer } from './ring-buffer';

export interface ArenaMessage {
  type: 'trade' | 'position' | 'fitness' | 'dna_change' | 'market_data';
  botId?: string;
  timestamp: number;
  data: any;
}

export class ArenaWebSocketClient {
  private ws: WebSocket | null = null;
  private eventBuffer: ObservationRingBuffer;
  private reconnectInterval: number = 5000;
  private isConnected: boolean = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  
  constructor(buffer: ObservationRingBuffer) {
    this.eventBuffer = buffer;
    this.setupMessageHandlers();
  }
  
  /**
   * Connect to arena WebSocket at localhost:3000
   */
  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket('ws://localhost:3000');
      
      this.ws.on('open', () => {
        console.log('✅ Connected to Arena WebSocket at localhost:3000');
        this.isConnected = true;
        
        // Subscribe to all bot events
        this.send({
          action: 'subscribe',
          channels: ['trades', 'positions', 'fitness', 'dna_changes', 'market_data']
        });
      });
      
      this.ws.on('message', (data) => {
        try {
          const message: ArenaMessage = JSON.parse(data.toString());
          this.handleArenaMessage(message);
        } catch (error) {
          console.error('Failed to parse arena message:', error);
        }
      });
      
      this.ws.on('close', () => {
        console.log('❌ Arena WebSocket disconnected');
        this.isConnected = false;
        this.scheduleReconnect();
      });
      
      this.ws.on('error', (error) => {
        console.error('Arena WebSocket error:', error);
        this.isConnected = false;
      });
      
    } catch (error) {
      console.error('Failed to connect to arena:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle incoming arena messages and convert to observation events
   */
  private handleArenaMessage(message: ArenaMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      console.warn(`Unknown arena message type: ${message.type}`);
    }
  }
  
  /**
   * Setup message handlers for different arena event types
   */
  private setupMessageHandlers(): void {
    
    // Trade events from bots
    this.messageHandlers.set('trade', (message: ArenaMessage) => {
      const tradeEvent: TradeEvent = {
        botId: message.botId!,
        symbol: message.data.symbol,
        direction: message.data.direction,
        quantity: message.data.quantity,
        price: message.data.price,
        regime: this.classifyMarketRegime(message.data),
        preTradeIndicators: message.data.indicators || this.getDefaultIndicators()
      };
      
      const obsEvent: ObservationEvent = {
        timestamp: message.timestamp,
        source: 'arena_bot',
        botId: message.botId,
        eventType: 'trade',
        payload: tradeEvent
      };
      
      this.eventBuffer.append(obsEvent);
      console.log(`📊 Trade logged: Bot ${message.botId} ${tradeEvent.direction} ${tradeEvent.quantity} ${tradeEvent.symbol} @ ${tradeEvent.price}`);
    });
    
    // Position updates
    this.messageHandlers.set('position', (message: ArenaMessage) => {
      const positionEvent: PositionSnapshot = {
        botId: message.botId!,
        symbol: message.data.symbol,
        quantity: message.data.quantity,
        entryPrice: message.data.entryPrice,
        currentPrice: message.data.currentPrice,
        unrealizedPnL: message.data.unrealizedPnL,
        duration: message.data.duration
      };
      
      const obsEvent: ObservationEvent = {
        timestamp: message.timestamp,
        source: 'arena_bot',
        botId: message.botId,
        eventType: 'position_update',
        payload: positionEvent
      };
      
      this.eventBuffer.append(obsEvent);
    });
    
    // Fitness updates (key for meta-cognitive learning)
    this.messageHandlers.set('fitness', (message: ArenaMessage) => {
      const obsEvent: ObservationEvent = {
        timestamp: message.timestamp,
        source: 'arena_bot',
        botId: message.botId,
        eventType: 'fitness_change',
        payload: {
          botId: message.botId!,
          newFitness: message.data.newFitness,
          previousFitness: message.data.previousFitness,
          performanceWindow: message.data.window
        }
      };
      
      this.eventBuffer.append(obsEvent);
      console.log(`🧠 Fitness update: Bot ${message.botId} ${message.data.newFitness.toFixed(2)}%`);
    });
    
    // DNA changes (strategy evolution tracking)
    this.messageHandlers.set('dna_change', (message: ArenaMessage) => {
      const obsEvent: ObservationEvent = {
        timestamp: message.timestamp,
        source: 'arena_bot',
        botId: message.botId,
        eventType: 'dna_mutation',
        payload: {
          botId: message.botId!,
          geneIndex: message.data.geneIndex,
          oldValue: message.data.oldValue,
          newValue: message.data.newValue,
          mutationType: message.data.mutationType
        }
      };
      
      this.eventBuffer.append(obsEvent);
      console.log(`🧬 DNA mutation: Bot ${message.botId} gene[${message.data.geneIndex}] ${message.data.oldValue} → ${message.data.newValue}`);
    });
  }
  
  /**
   * Classify market regime based on incoming data
   * Placeholder - will be enhanced with proper regime detection
   */
  private classifyMarketRegime(data: any): MarketRegime {
    // Simple placeholder regime classification
    const volatility = data.atr || 0;
    const trend = data.trend || 0;
    
    if (Math.abs(trend) > 0.02) {
      return trend > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
    } else if (volatility > 0.03) {
      return 'VOLATILE';
    } else {
      return 'RANGING';
    }
  }
  
  /**
   * Default indicator values when not provided
   */
  private getDefaultIndicators() {
    return {
      rsi14: 50,
      macdHist: 0,
      bbPosition: 0.5,
      atr14: 0.01,
      volumeRatio: 1,
      trendStrength: 20,
      priceVsMA50: 0,
      priceVsMA200: 0
    };
  }
  
  /**
   * Send message to arena
   */
  private send(data: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    setTimeout(() => {
      console.log('🔄 Attempting to reconnect to arena...');
      this.connect();
    }, this.reconnectInterval);
  }
  
  /**
   * Close connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
  
  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; bufferStats: any } {
    return {
      connected: this.isConnected,
      bufferStats: this.eventBuffer.getStats()
    };
  }
}