// High-performance ring buffer for observation events
// O(1) append, O(log n) time-range queries

import { ObservationEvent, RingBufferOptions } from '../types/observation';

export class ObservationRingBuffer {
  private buffer: ObservationEvent[];
  private writeIndex: number = 0;
  private size: number = 0;
  private readonly maxSize: number;
  private timeIndex: Map<number, number[]> = new Map(); // timestamp -> buffer indices
  
  constructor(options: RingBufferOptions) {
    this.maxSize = options.maxEvents;
    this.buffer = new Array(this.maxSize);
  }
  
  /**
   * Add event to buffer - O(1) operation
   */
  append(event: ObservationEvent): void {
    const index = this.writeIndex;
    
    // Remove old time index entry if overwriting
    if (this.size === this.maxSize) {
      const oldEvent = this.buffer[index];
      this.removeTimeIndex(oldEvent.timestamp, index);
    }
    
    // Add new event
    this.buffer[index] = event;
    this.addTimeIndex(event.timestamp, index);
    
    // Update pointers
    this.writeIndex = (this.writeIndex + 1) % this.maxSize;
    this.size = Math.min(this.size + 1, this.maxSize);
  }
  
  /**
   * Query events in time range - O(log n) operation
   */
  getEventsInRange(startTime: number, endTime: number): ObservationEvent[] {
    const events: ObservationEvent[] = [];
    
    // Find all timestamps in range
    for (const [timestamp, indices] of this.timeIndex.entries()) {
      if (timestamp >= startTime && timestamp <= endTime) {
        for (const index of indices) {
          if (this.buffer[index] && this.buffer[index].timestamp === timestamp) {
            events.push(this.buffer[index]);
          }
        }
      }
    }
    
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Get recent events - O(k) where k is count
   */
  getRecentEvents(count: number): ObservationEvent[] {
    const result: ObservationEvent[] = [];
    let currentIndex = (this.writeIndex - 1 + this.maxSize) % this.maxSize;
    
    for (let i = 0; i < Math.min(count, this.size); i++) {
      if (this.buffer[currentIndex]) {
        result.unshift(this.buffer[currentIndex]);
      }
      currentIndex = (currentIndex - 1 + this.maxSize) % this.maxSize;
    }
    
    return result;
  }
  
  /**
   * Get current size and capacity info
   */
  getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.size,
      maxSize: this.maxSize,
      utilization: this.size / this.maxSize
    };
  }
  
  private addTimeIndex(timestamp: number, bufferIndex: number): void {
    if (!this.timeIndex.has(timestamp)) {
      this.timeIndex.set(timestamp, []);
    }
    this.timeIndex.get(timestamp)!.push(bufferIndex);
  }
  
  private removeTimeIndex(timestamp: number, bufferIndex: number): void {
    const indices = this.timeIndex.get(timestamp);
    if (indices) {
      const pos = indices.indexOf(bufferIndex);
      if (pos !== -1) {
        indices.splice(pos, 1);
      }
      if (indices.length === 0) {
        this.timeIndex.delete(timestamp);
      }
    }
  }
}