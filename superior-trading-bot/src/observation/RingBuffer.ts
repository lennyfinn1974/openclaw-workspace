/**
 * High-Performance Ring Buffer for Observation Events
 * O(1) append, O(log n) time-range queries via secondary sorted index
 */

import { ObservationEvent, RingBufferQuery, RingBufferStats } from '../types/core';

interface TimeIndex {
  timestamp: number;
  bufferIndex: number;
}

export class ObservationRingBuffer {
  private buffer: (ObservationEvent | null)[];
  private readonly capacity: number;
  private writeIndex: number = 0;
  private size: number = 0;
  private timeIndex: TimeIndex[] = [];  // Sorted by timestamp for O(log n) queries

  constructor(capacity: number = 10000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  /**
   * Add event to buffer - O(1) operation
   */
  append(event: ObservationEvent): void {
    // Handle buffer wrap-around
    if (this.size === this.capacity) {
      // Remove old time index entry
      const oldEvent = this.buffer[this.writeIndex];
      if (oldEvent) {
        this.removeFromTimeIndex(oldEvent.timestamp, this.writeIndex);
      }
    }

    // Add new event
    this.buffer[this.writeIndex] = event;
    this.addToTimeIndex(event.timestamp, this.writeIndex);

    // Update indices
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  /**
   * Query events by time range - O(log n) operation
   */
  query(query: RingBufferQuery): ObservationEvent[] {
    const startTime = query.startTime || 0;
    const endTime = query.endTime || Date.now();
    const limit = query.limit || 1000;

    // Binary search for start position in time index
    const startIdx = this.binarySearchStart(startTime);
    const results: ObservationEvent[] = [];

    // Linear scan from start position (already sorted by time)
    for (let i = startIdx; i < this.timeIndex.length && results.length < limit; i++) {
      const timeEntry = this.timeIndex[i];
      
      if (timeEntry.timestamp > endTime) break;

      const event = this.buffer[timeEntry.bufferIndex];
      if (!event) continue;

      // Apply filters
      if (query.source && event.source !== query.source) continue;
      if (query.eventType && event.eventType !== query.eventType) continue;
      if (query.botId && this.extractBotId(event) !== query.botId) continue;
      if (query.symbol && this.extractSymbol(event) !== query.symbol) continue;

      results.push(event);
    }

    return results;
  }

  /**
   * Get all events in chronological order
   */
  getAllEvents(): ObservationEvent[] {
    return this.timeIndex
      .map(entry => this.buffer[entry.bufferIndex])
      .filter((event): event is ObservationEvent => event !== null);
  }

  /**
   * Get latest N events
   */
  getLatest(count: number = 100): ObservationEvent[] {
    const all = this.getAllEvents();
    return all.slice(-count);
  }

  /**
   * Get buffer statistics
   */
  getStats(): RingBufferStats {
    const events = this.getAllEvents();
    
    const eventsByType: Record<string, number> = {};
    const eventsBySource: Record<string, number> = {};

    events.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;
    });

    return {
      totalEvents: this.size,
      oldestEvent: events[0]?.timestamp || 0,
      newestEvent: events[events.length - 1]?.timestamp || 0,
      eventsByType: eventsByType as any,
      eventsBySource: eventsBySource as any,
      bufferUtilization: (this.size / this.capacity) * 100
    };
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.buffer = new Array(this.capacity).fill(null);
    this.timeIndex = [];
    this.writeIndex = 0;
    this.size = 0;
  }

  // Private helper methods

  private addToTimeIndex(timestamp: number, bufferIndex: number): void {
    const entry: TimeIndex = { timestamp, bufferIndex };
    
    // Binary search for insertion position to maintain sort order
    let left = 0;
    let right = this.timeIndex.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.timeIndex[mid].timestamp <= timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    this.timeIndex.splice(left, 0, entry);
  }

  private removeFromTimeIndex(timestamp: number, bufferIndex: number): void {
    const index = this.timeIndex.findIndex(
      entry => entry.timestamp === timestamp && entry.bufferIndex === bufferIndex
    );
    if (index !== -1) {
      this.timeIndex.splice(index, 1);
    }
  }

  private binarySearchStart(timestamp: number): number {
    let left = 0;
    let right = this.timeIndex.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.timeIndex[mid].timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }

  private extractBotId(event: ObservationEvent): string | null {
    switch (event.eventType) {
      case 'trade':
        return (event.payload as any).botId || null;
      case 'position_update':
        return (event.payload as any).botId || null;
      case 'fitness_change':
        return (event.payload as any).botId || null;
      case 'dna_mutation':
        return (event.payload as any).botId || null;
      default:
        return null;
    }
  }

  private extractSymbol(event: ObservationEvent): string | null {
    switch (event.eventType) {
      case 'trade':
        return (event.payload as any).symbol || null;
      case 'position_update':
        return (event.payload as any).symbol || null;
      default:
        return null;
    }
  }
}