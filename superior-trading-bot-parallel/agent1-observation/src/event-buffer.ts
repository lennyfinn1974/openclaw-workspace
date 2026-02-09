// ============================================================
// Ring Buffer — O(1) insert, bounded memory for event streams
// ============================================================

export class RingBuffer<T> {
  private items: (T | undefined)[];
  private head = 0;
  private _count = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.items = new Array(capacity);
  }

  push(item: T): void {
    const idx = (this.head + this._count) % this.capacity;
    if (this._count === this.capacity) {
      // Buffer full — overwrite oldest
      this.head = (this.head + 1) % this.capacity;
    } else {
      this._count++;
    }
    this.items[idx] = item;
  }

  get count(): number {
    return this._count;
  }

  /** Get item by logical index (0 = oldest) */
  get(index: number): T | undefined {
    if (index < 0 || index >= this._count) return undefined;
    return this.items[(this.head + index) % this.capacity];
  }

  /** Get the most recent item */
  latest(): T | undefined {
    if (this._count === 0) return undefined;
    return this.get(this._count - 1);
  }

  /** Get the N most recent items (newest first) */
  recent(n: number): T[] {
    const result: T[] = [];
    const count = Math.min(n, this._count);
    for (let i = this._count - 1; i >= this._count - count; i--) {
      const item = this.get(i);
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  /** Iterate all items oldest → newest */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this._count; i++) {
      const item = this.get(i);
      if (item !== undefined) yield item;
    }
  }

  /** Convert to array (oldest → newest) */
  toArray(): T[] {
    return [...this];
  }

  /** Filter items matching predicate */
  filter(predicate: (item: T) => boolean): T[] {
    const result: T[] = [];
    for (const item of this) {
      if (predicate(item)) result.push(item);
    }
    return result;
  }

  /** Get items within time window (assumes items have a timestamp-like field) */
  window(fromMs: number, toMs: number, getTime: (item: T) => number): T[] {
    return this.filter(item => {
      const t = getTime(item);
      return t >= fromMs && t <= toMs;
    });
  }

  clear(): void {
    this.items = new Array(this.capacity);
    this.head = 0;
    this._count = 0;
  }
}
