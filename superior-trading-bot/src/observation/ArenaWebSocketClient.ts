/**
 * WebSocket Client for Arena Event Ingestion
 * Connects to 21-bot tournament at localhost:3000
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { ObservationEvent, TradeEvent, MarketRegime } from '../types/core';
import { v4 as uuidv4 } from 'uuid';

interface ArenaTradeEvent {
  botId: string;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  confidence?: number;
}

interface ArenaFitnessEvent {
  botId: string;
  fitness: number;
  rank: number;
  pnl: number;
  sharpe: number;
  winRate: number;
  drawdown: number;
}

interface ArenaLeaderboardEvent {
  leaderboard: Array<{
    botId: string;
    fitness: number;
    rank: number;
    pnl: number;
  }>;
  timestamp: number;
}

interface ArenaMessage {
  type: 'trade' | 'fitness' | 'leaderboard' | 'dna_change' | 'position_update';
  data: ArenaTradeEvent | ArenaFitnessEvent | ArenaLeaderboardEvent | any;
}

export class ArenaWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5 seconds
  private isConnected = false;
  private url: string;

  // State tracking for enhanced events
  private botFitness: Map<string, number> = new Map();
  private lastHeartbeat = Date.now();

  constructor(arenaUrl: string = 'ws://localhost:3000') {
    super();
    this.url = arenaUrl;
  }

  /**
   * Connect to arena WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔗 Connecting to Arena at ${this.url}...`);
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('✅ Connected to Arena WebSocket');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastHeartbeat = Date.now();
          
          // Send subscription message
          this.sendMessage({ type: 'subscribe', data: { events: ['trade', 'fitness', 'leaderboard', 'dna_change'] } });
          
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message: ArenaMessage = JSON.parse(data.toString());
            this.handleArenaMessage(message);
            this.lastHeartbeat = Date.now();
          } catch (error) {
            console.error('❌ Error parsing arena message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('❌ Arena WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`🔌 Arena WebSocket closed: ${code} - ${reason}`);
          this.isConnected = false;
          this.handleReconnect();
        });

      } catch (error) {
        console.error('❌ Failed to connect to arena:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from arena
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if client is connected
   */
  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection stats
   */
  getStats(): {
    connected: boolean;
    lastHeartbeat: number;
    reconnectAttempts: number;
    url: string;
  } {
    return {
      connected: this.connected,
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts,
      url: this.url
    };
  }

  // Private methods

  private handleArenaMessage(message: ArenaMessage): void {
    switch (message.type) {
      case 'trade':
        this.handleTradeEvent(message.data as ArenaTradeEvent);
        break;
      case 'fitness':
        this.handleFitnessEvent(message.data as ArenaFitnessEvent);
        break;
      case 'leaderboard':
        this.handleLeaderboardEvent(message.data as ArenaLeaderboardEvent);
        break;
      case 'dna_change':
        this.handleDNAChangeEvent(message.data);
        break;
      case 'position_update':
        this.handlePositionUpdateEvent(message.data);
        break;
      default:
        console.log('📨 Unknown arena message type:', message.type);
    }
  }

  private handleTradeEvent(trade: ArenaTradeEvent): void {
    // Convert arena trade to observation event
    const tradeEvent: TradeEvent = {
      botId: trade.botId,
      symbol: trade.symbol,
      direction: trade.action,
      quantity: trade.quantity,
      price: trade.price,
      timestamp: trade.timestamp,
      regime: this.detectMarketRegime(trade.symbol), // Simple regime detection for now
      preTradeIndicators: {
        rsi14: 50, // Will be enriched by IndicatorCalculator
        macdHist: 0,
        bbPosition: 0.5,
        atr14: 0.01,
        volumeRatio: 1,
        trendStrength: 25,
        priceVsMA50: 0,
        priceVsMA200: 0
      },
      confidence: trade.confidence
    };

    const observationEvent: ObservationEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: 'arena_bot',
      eventType: 'trade',
      payload: tradeEvent
    };

    this.emit('observation', observationEvent);
  }

  private handleFitnessEvent(fitness: ArenaFitnessEvent): void {
    const oldFitness = this.botFitness.get(fitness.botId) || 0;
    this.botFitness.set(fitness.botId, fitness.fitness);

    const observationEvent: ObservationEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: 'arena_bot',
      eventType: 'fitness_change',
      payload: {
        botId: fitness.botId,
        newFitness: fitness.fitness,
        oldFitness: oldFitness,
        rankChange: 0, // Could calculate from leaderboard
        timestamp: Date.now()
      }
    };

    this.emit('observation', observationEvent);
  }

  private handleLeaderboardEvent(leaderboard: ArenaLeaderboardEvent): void {
    // Emit leaderboard snapshot for dashboard
    this.emit('leaderboard', leaderboard);
  }

  private handleDNAChangeEvent(dnaChange: any): void {
    const observationEvent: ObservationEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: 'arena_bot',
      eventType: 'dna_mutation',
      payload: {
        botId: dnaChange.botId,
        geneIndex: dnaChange.geneIndex,
        oldValue: dnaChange.oldValue,
        newValue: dnaChange.newValue,
        mutationType: dnaChange.mutationType || 'mutation',
        timestamp: Date.now()
      }
    };

    this.emit('observation', observationEvent);
  }

  private handlePositionUpdateEvent(positionUpdate: any): void {
    const observationEvent: ObservationEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      source: 'arena_bot',
      eventType: 'position_update',
      payload: {
        botId: positionUpdate.botId,
        symbol: positionUpdate.symbol,
        quantity: positionUpdate.quantity,
        avgPrice: positionUpdate.avgPrice,
        unrealizedPnL: positionUpdate.unrealizedPnL,
        timestamp: Date.now()
      }
    };

    this.emit('observation', observationEvent);
  }

  private detectMarketRegime(symbol: string): MarketRegime {
    // Simple regime detection - will be enhanced by dedicated regime detector
    // For now, return a default value
    return 'RANGING';
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms...`);

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect().catch(error => {
          console.error('❌ Reconnection failed:', error);
        });
      }
    }, this.reconnectDelay);
  }
}