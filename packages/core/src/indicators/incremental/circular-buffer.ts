/**
 * Circular Buffer
 *
 * Fixed-size ring buffer for efficient sliding window operations.
 * Used by incremental indicators that need a lookback window (SMA, WMA, etc.)
 */

/**
 * Fixed-size circular buffer with O(1) push and random access
 *
 * @example
 * ```ts
 * const buf = new CircularBuffer<number>(3);
 * buf.push(1); buf.push(2); buf.push(3); // [1, 2, 3]
 * buf.push(4); // [2, 3, 4] - oldest value (1) is overwritten
 * buf.get(0); // 2 (oldest)
 * buf.get(2); // 4 (newest)
 * ```
 */
export class CircularBuffer<T> {
  private data: T[];
  private head = 0;
  private _length = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Array(capacity);
  }

  /**
   * Add a value to the buffer. If full, the oldest value is overwritten.
   */
  push(value: T): void {
    this.data[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this._length < this.capacity) {
      this._length++;
    }
  }

  /**
   * Get value at index (0 = oldest, length-1 = newest)
   */
  get(index: number): T {
    if (index < 0 || index >= this._length) {
      throw new RangeError(`Index ${index} out of bounds [0, ${this._length})`);
    }
    const actualIndex = (this.head - this._length + index + this.capacity) % this.capacity;
    return this.data[actualIndex];
  }

  /**
   * Get the most recently added value
   */
  newest(): T {
    if (this._length === 0) throw new RangeError("Buffer is empty");
    return this.data[(this.head - 1 + this.capacity) % this.capacity];
  }

  /**
   * Get the oldest value in the buffer
   */
  oldest(): T {
    if (this._length === 0) throw new RangeError("Buffer is empty");
    return this.data[(this.head - this._length + this.capacity) % this.capacity];
  }

  /** Current number of elements */
  get length(): number {
    return this._length;
  }

  /** Whether buffer is at capacity */
  get isFull(): boolean {
    return this._length === this.capacity;
  }

  /**
   * Convert to a plain array (oldest first)
   */
  toArray(): T[] {
    const result: T[] = new Array(this._length);
    for (let i = 0; i < this._length; i++) {
      result[i] = this.get(i);
    }
    return result;
  }

  /**
   * Create a snapshot for serialization
   */
  snapshot(): { data: T[]; head: number; length: number; capacity: number } {
    return {
      data: [...this.data],
      head: this.head,
      length: this._length,
      capacity: this.capacity,
    };
  }

  /**
   * Restore from a snapshot
   */
  static fromSnapshot<T>(snap: {
    data: T[];
    head: number;
    length: number;
    capacity: number;
  }): CircularBuffer<T> {
    const buf = new CircularBuffer<T>(snap.capacity);
    buf.data = [...snap.data];
    buf.head = snap.head;
    buf._length = snap.length;
    return buf;
  }
}
