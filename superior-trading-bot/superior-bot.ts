#!/usr/bin/env tsx
/**
 * SUPERIOR TRADING BOT - Meta-Cognitive Trading System
 * 
 * Revolutionary 7-Layer Architecture:
 * 1. Observation Engine (Layer 1) - Real-time data ingestion & enrichment
 * 2. Pattern Extraction (Layer 2) - Shapley value attribution, strategy fingerprinting
 * 3. Strategy Synthesis (Layer 3) - GP, NMF factor analysis, adversarial generation
 * 4. Competitive Intelligence (Layer 4) - Predict competitor moves, detect crowding
 * 5. Capital Allocator (Layer 5) - Thompson Sampling multi-armed bandit
 * 6. Execution & Risk Governor (Layer 6) - Circuit breakers with veto power
 * 7. Transparency Dashboard (Layer 7) - Real-time decision tracking
 * 
 * Implementation: Phase 1 - Foundation (Days 1-3)
 * Status: OBSERVE & LEARN ONLY - NO TRADING
 * 
 * Created: 2026-02-09 09:35 GMT+4
 * Author: Aries (Enhanced Sovereign Command Architecture)
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ObservationEngine } from './observation/observation-engine';
import { PatternExtraction } from './intelligence/pattern-extraction';
import { DashboardServer } from './dashboard/dashboard-server';
import { MemorySystem } from './core/memory-system';
import { Logger } from './core/logger';

// ===================== CONFIGURATION =====================

interface SuperiorBotConfig {
  // Arena Integration
  arenaApiUrl: string;
  arenaWebSocketUrl: string;
  
  // Dashboard
  dashboardPort: number;
  
  // Phase Control
  phase: 1 | 2 | 3 | 4 | 5;
  tradingEnabled: boolean;
  
  // Memory
  memoryRetentionDays: number;
  eventBufferSize: number;
  
  // Risk Limits (Phase 1: All zeros)
  maxDailyDrawdown: number;
  maxWeeklyDrawdown: number;
  maxSingleTradeRisk: number;
}

const DEFAULT_CONFIG: SuperiorBotConfig = {
  arenaApiUrl: 'http://localhost:8101',
  arenaWebSocketUrl: 'ws://localhost:8101',
  dashboardPort: 9001,
  phase: 1,
  tradingEnabled: false,
  memoryRetentionDays: 30,
  eventBufferSize: 10000,
  maxDailyDrawdown: 0.0,  // Phase 1: No trading
  maxWeeklyDrawdown: 0.0, // Phase 1: No trading
  maxSingleTradeRisk: 0.0, // Phase 1: No trading
};

// ===================== MAIN SUPERIOR BOT CLASS =====================

export class SuperiorTradingBot extends EventEmitter {
  private config: SuperiorBotConfig;
  private logger: Logger;
  private memory: MemorySystem;
  private observationEngine: ObservationEngine;
  private patternExtraction: PatternExtraction;
  private dashboardServer: DashboardServer;
  
  private isRunning = false;
  private startTime: Date;
  
  constructor(config?: Partial<SuperiorBotConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
    
    // Initialize core systems
    this.logger = new Logger('SUPERIOR-BOT');
    this.memory = new MemorySystem(this.config);
    
    // Initialize 7-layer architecture (Phase 1: Layers 1-2 only)
    this.observationEngine = new ObservationEngine(this.config, this.memory, this.logger);
    this.patternExtraction = new PatternExtraction(this.config, this.memory, this.logger);
    this.dashboardServer = new DashboardServer(this.config, this.memory, this.logger);
    
    // Wire up event handlers
    this.setupEventHandlers();
    
    this.logger.info('🧠 Superior Trading Bot initialized', {
      phase: this.config.phase,
      tradingEnabled: this.config.tradingEnabled,
      architecture: '7-layer Meta-Cognitive System'
    });
  }
  
  // ===================== LIFECYCLE MANAGEMENT =====================
  
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Superior Bot is already running');
    }
    
    this.logger.info('🚀 Starting Superior Trading Bot - Phase 1: Foundation');
    this.logger.info('📊 Mission: OBSERVE & LEARN - NO TRADING');
    
    try {
      // Start core systems in order
      await this.memory.initialize();
      this.logger.success('✅ Memory System online');
      
      await this.observationEngine.start();
      this.logger.success('✅ Observation Engine online - Layer 1 active');
      
      await this.patternExtraction.start();
      this.logger.success('✅ Pattern Extraction online - Layer 2 active');
      
      await this.dashboardServer.start();
      this.logger.success(`✅ Dashboard Server online - http://localhost:${this.config.dashboardPort}`);
      
      this.isRunning = true;
      
      // Emit startup event
      this.emit('started', {
        phase: this.config.phase,
        timestamp: new Date().toISOString(),
        systems: ['memory', 'observation', 'pattern-extraction', 'dashboard']
      });
      
      this.logger.info('🎯 Superior Trading Bot online - Ready to revolutionize trading!');
      
    } catch (error) {
      this.logger.error('❌ Failed to start Superior Trading Bot', error);
      await this.stop();
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    this.logger.info('🛑 Stopping Superior Trading Bot...');
    
    try {
      // Stop systems in reverse order
      await this.dashboardServer?.stop();
      await this.patternExtraction?.stop();
      await this.observationEngine?.stop();
      await this.memory?.shutdown();
      
      this.isRunning = false;
      
      this.emit('stopped', {
        runtime: Date.now() - this.startTime.getTime(),
        timestamp: new Date().toISOString()
      });
      
      this.logger.success('✅ Superior Trading Bot stopped gracefully');
      
    } catch (error) {
      this.logger.error('❌ Error during shutdown', error);
      throw error;
    }
  }
  
  // ===================== STATUS & MONITORING =====================
  
  getStatus() {
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      isRunning: this.isRunning,
      phase: this.config.phase,
      uptime,
      tradingEnabled: this.config.tradingEnabled,
      systems: {
        memory: this.memory?.isReady() ?? false,
        observation: this.observationEngine?.isConnected() ?? false,
        patternExtraction: this.patternExtraction?.isActive() ?? false,
        dashboard: this.dashboardServer?.isRunning() ?? false,
      },
      stats: {
        eventsProcessed: this.observationEngine?.getEventCount() ?? 0,
        patternsExtracted: this.patternExtraction?.getPatternCount() ?? 0,
        memoryUsage: process.memoryUsage(),
      },
      config: {
        arenaApiUrl: this.config.arenaApiUrl,
        dashboardPort: this.config.dashboardPort,
        eventBufferSize: this.config.eventBufferSize,
      }
    };
  }
  
  // ===================== EVENT HANDLING =====================
  
  private setupEventHandlers(): void {
    // Observation Engine events
    this.observationEngine.on('trade', (trade) => {
      this.emit('observation:trade', trade);
      this.logger.debug('👁️ Trade observed', { botId: trade.botId, symbol: trade.symbol, side: trade.side });
    });
    
    this.observationEngine.on('leaderboard', (leaderboard) => {
      this.emit('observation:leaderboard', leaderboard);
      this.logger.debug('🏆 Leaderboard updated', { entries: leaderboard.length });
    });
    
    this.observationEngine.on('evolution', (evolution) => {
      this.emit('observation:evolution', evolution);
      this.logger.info('🧬 Evolution event detected', { generation: evolution.generation, type: evolution.type });
    });
    
    // Pattern Extraction events
    this.patternExtraction.on('pattern:discovered', (pattern) => {
      this.emit('intelligence:pattern', pattern);
      this.logger.info('🔍 New pattern discovered', { type: pattern.type, confidence: pattern.confidence });
    });
    
    this.patternExtraction.on('attribution:complete', (attribution) => {
      this.emit('intelligence:attribution', attribution);
      this.logger.debug('📊 Trade attribution complete', { tradeId: attribution.tradeId });
    });
    
    // Error handling
    this.observationEngine.on('error', (error) => {
      this.logger.error('🚨 Observation Engine error', error);
      this.emit('error', { source: 'observation', error });
    });
    
    this.patternExtraction.on('error', (error) => {
      this.logger.error('🚨 Pattern Extraction error', error);  
      this.emit('error', { source: 'pattern-extraction', error });
    });
  }
}

// ===================== CLI INTERFACE =====================

if (require.main === module) {
  const bot = new SuperiorTradingBot();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });
  
  // Start the bot
  bot.start().catch((error) => {
    console.error('❌ Failed to start Superior Trading Bot:', error);
    process.exit(1);
  });
}

export default SuperiorTradingBot;