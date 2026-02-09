/**
 * Memory System for Superior Trading Bot
 * Handles persistence, indexing, and retrieval of all observed trading data
 * 
 * Architecture:
 * - Event Buffer: Ring buffer of last N events for fast access
 * - Time-series Database: Long-term storage with compression
 * - Pattern Cache: Quick access to discovered patterns
 * - Bot Intelligence: Behavioral fingerprints and performance data
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

// ===================== TYPES =====================

export interface ObservationEvent {
  id: string;
  timestamp: number;
  source: 'arena_bot' | 'market' | 'regime' | 'self';
  botId?: string;
  eventType: 'trade' | 'position_update' | 'fitness_change' | 'dna_mutation' | 'leaderboard' | 'evolution';
  payload: any;
  enrichment?: EventEnrichment;
}

export interface EventEnrichment {
  marketRegime?: string;
  indicators?: IndicatorSnapshot;
  attribution?: TradeAttribution;
  novelty?: number;
}

export interface IndicatorSnapshot {
  rsi14: number;
  macdHist: number;
  bbPosition: number;    // 0=lower band, 1=upper band
  atr14: number;
  volumeRatio: number;   // vs 20-period avg
  trendStrength: number; // ADX
  priceVsMA50: number;   // % deviation
  priceVsMA200: number;
}

export interface TradeAttribution {
  tradeId: string;
  totalReturn: number;
  regimeContribution: number;
  timingContribution: number;
  directionContribution: number;
  sizingContribution: number;
  skillVsLuck: number; // -1 to 1, negative = mostly luck
}

export interface BotFingerprint {
  botId: string;
  lastUpdated: number;
  avgHoldingPeriod: number;
  tradeFrequency: number;
  preferredRegimes: string[];
  directionBias: number; // -1 (always short) to +1 (always long)
  entryPatterns: any[];
  exitPatterns: any[];
  performanceByRegime: Record<string, any>;
  archetypeId: number;
  archetypeDistance: number;
}

export interface PatternRecord {
  id: string;
  type: string;
  confidence: number;
  firstSeen: number;
  lastConfirmed: number;
  frequency: number;
  profitability: number;
  conditions: any;
  examples: string[]; // Event IDs
}

// ===================== MEMORY SYSTEM =====================

export class MemorySystem extends EventEmitter {
  private config: any;
  private dataDir: string;
  private eventBuffer: ObservationEvent[] = [];
  private bufferIndex = 0;
  private maxBufferSize: number;
  
  private botFingerprints = new Map<string, BotFingerprint>();
  private patterns = new Map<string, PatternRecord>();
  private dailyFiles = new Map<string, string>(); // date -> filepath
  
  private isReady = false;
  
  constructor(config: any) {
    super();
    this.config = config;
    this.dataDir = path.join(process.cwd(), 'superior-trading-bot', 'data');
    this.maxBufferSize = config.eventBufferSize || 10000;
  }
  
  async initialize(): Promise<void> {
    // Create data directory structure
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'events'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'patterns'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'fingerprints'), { recursive: true });
    
    // Load existing patterns and fingerprints
    await this.loadPatterns();
    await this.loadFingerprints();
    
    // Initialize event buffer (ring buffer)
    this.eventBuffer = new Array(this.maxBufferSize);
    this.bufferIndex = 0;
    
    this.isReady = true;
    this.emit('ready');
  }
  
  async shutdown(): Promise<void> {
    // Save current state
    await this.savePatterns();
    await this.saveFingerprints();
    
    this.isReady = false;
    this.emit('shutdown');
  }
  
  // ===================== EVENT STORAGE =====================
  
  addEvent(event: ObservationEvent): void {
    if (!this.isReady) {
      throw new Error('Memory system not initialized');
    }
    
    // Add to ring buffer (O(1))
    this.eventBuffer[this.bufferIndex] = event;
    this.bufferIndex = (this.bufferIndex + 1) % this.maxBufferSize;
    
    // Persist to daily file (async, non-blocking)
    this.persistEventAsync(event);
    
    this.emit('event:added', event);
  }
  
  private async persistEventAsync(event: ObservationEvent): Promise<void> {
    try {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      const filepath = path.join(this.dataDir, 'events', `${date}.jsonl`);
      
      const line = JSON.stringify(event) + '\n';
      await fs.appendFile(filepath, line);
      
    } catch (error) {
      this.emit('error', { operation: 'persistEvent', error });
    }
  }
  
  // ===================== EVENT QUERIES =====================
  
  getRecentEvents(count: number = 100): ObservationEvent[] {
    const result: ObservationEvent[] = [];
    let index = (this.bufferIndex - 1 + this.maxBufferSize) % this.maxBufferSize;
    
    for (let i = 0; i < Math.min(count, this.maxBufferSize); i++) {
      const event = this.eventBuffer[index];
      if (!event) break;
      
      result.push(event);
      index = (index - 1 + this.maxBufferSize) % this.maxBufferSize;
    }
    
    return result;
  }
  
  getEventsByBotId(botId: string, count: number = 50): ObservationEvent[] {
    return this.getRecentEvents(this.maxBufferSize)
      .filter(event => event.botId === botId)
      .slice(0, count);
  }
  
  getEventsByType(eventType: string, count: number = 50): ObservationEvent[] {
    return this.getRecentEvents(this.maxBufferSize)
      .filter(event => event.eventType === eventType)
      .slice(0, count);
  }
  
  getEventsInTimeRange(startTime: number, endTime: number): ObservationEvent[] {
    return this.getRecentEvents(this.maxBufferSize)
      .filter(event => event.timestamp >= startTime && event.timestamp <= endTime);
  }
  
  // ===================== BOT FINGERPRINTS =====================
  
  updateBotFingerprint(botId: string, fingerprint: Partial<BotFingerprint>): void {
    const existing = this.botFingerprints.get(botId) || {
      botId,
      lastUpdated: Date.now(),
      avgHoldingPeriod: 0,
      tradeFrequency: 0,
      preferredRegimes: [],
      directionBias: 0,
      entryPatterns: [],
      exitPatterns: [],
      performanceByRegime: {},
      archetypeId: -1,
      archetypeDistance: 0,
    };
    
    const updated = { ...existing, ...fingerprint, lastUpdated: Date.now() };
    this.botFingerprints.set(botId, updated);
    
    this.emit('fingerprint:updated', { botId, fingerprint: updated });
  }
  
  getBotFingerprint(botId: string): BotFingerprint | null {
    return this.botFingerprints.get(botId) || null;
  }
  
  getAllFingerprints(): BotFingerprint[] {
    return Array.from(this.botFingerprints.values());
  }
  
  // ===================== PATTERN MANAGEMENT =====================
  
  addPattern(pattern: PatternRecord): void {
    this.patterns.set(pattern.id, pattern);
    this.emit('pattern:added', pattern);
  }
  
  updatePattern(patternId: string, updates: Partial<PatternRecord>): void {
    const existing = this.patterns.get(patternId);
    if (!existing) return;
    
    const updated = { ...existing, ...updates };
    this.patterns.set(patternId, updated);
    
    this.emit('pattern:updated', { patternId, pattern: updated });
  }
  
  getPattern(patternId: string): PatternRecord | null {
    return this.patterns.get(patternId) || null;
  }
  
  getPatternsByType(type: string): PatternRecord[] {
    return Array.from(this.patterns.values())
      .filter(pattern => pattern.type === type);
  }
  
  getTopPatterns(count: number = 10): PatternRecord[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => (b.confidence * b.profitability) - (a.confidence * a.profitability))
      .slice(0, count);
  }
  
  // ===================== PERSISTENCE =====================
  
  private async loadPatterns(): Promise<void> {
    try {
      const filepath = path.join(this.dataDir, 'patterns', 'patterns.json');
      const data = await fs.readFile(filepath, 'utf-8');
      const patterns = JSON.parse(data);
      
      for (const pattern of patterns) {
        this.patterns.set(pattern.id, pattern);
      }
      
    } catch (error) {
      // File doesn't exist yet, that's ok
    }
  }
  
  private async savePatterns(): Promise<void> {
    try {
      const filepath = path.join(this.dataDir, 'patterns', 'patterns.json');
      const patterns = Array.from(this.patterns.values());
      await fs.writeFile(filepath, JSON.stringify(patterns, null, 2));
      
    } catch (error) {
      this.emit('error', { operation: 'savePatterns', error });
    }
  }
  
  private async loadFingerprints(): Promise<void> {
    try {
      const filepath = path.join(this.dataDir, 'fingerprints', 'fingerprints.json');
      const data = await fs.readFile(filepath, 'utf-8');
      const fingerprints = JSON.parse(data);
      
      for (const fingerprint of fingerprints) {
        this.botFingerprints.set(fingerprint.botId, fingerprint);
      }
      
    } catch (error) {
      // File doesn't exist yet, that's ok
    }
  }
  
  private async saveFingerprints(): Promise<void> {
    try {
      const filepath = path.join(this.dataDir, 'fingerprints', 'fingerprints.json');
      const fingerprints = Array.from(this.botFingerprints.values());
      await fs.writeFile(filepath, JSON.stringify(fingerprints, null, 2));
      
    } catch (error) {
      this.emit('error', { operation: 'saveFingerprints', error });
    }
  }
  
  // ===================== STATISTICS =====================
  
  getStats() {
    const recentEvents = this.getRecentEvents();
    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalEvents: recentEvents.length,
      eventsByType,
      totalBots: this.botFingerprints.size,
      totalPatterns: this.patterns.size,
      memoryUsage: {
        bufferUsed: recentEvents.length,
        bufferCapacity: this.maxBufferSize,
        fingerprints: this.botFingerprints.size,
        patterns: this.patterns.size,
      }
    };
  }
  
  isReady(): boolean {
    return this.isReady;
  }
}