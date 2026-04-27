import type { Candle } from "../schemas/candle";

export interface CandleHandle {
  handle: string;
  count: number;
  span: { from: number; to: number };
  symbol?: string;
  hint?: string;
}

interface Entry extends CandleHandle {
  candles: Candle[];
}

const DEFAULT_CAPACITY = 50;

/**
 * Session-scoped candle store. Lifetime = the stdio MCP process; not persisted.
 * LRU eviction (oldest dropped silently when capacity is exceeded). Reload is
 * cheap because the caller already has the candles in hand.
 *
 * Insertion order in a Map is preserved by spec. We exploit that for LRU:
 * `get()` re-inserts the entry to move it to the end, `keys().next().value`
 * gives the oldest entry to evict.
 */
export class CandleStore {
  private readonly entries = new Map<string, Entry>();
  private readonly capacity: number;
  private counter = 0;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  put(candles: Candle[], meta: { symbol?: string; hint?: string } = {}): CandleHandle {
    if (candles.length === 0) {
      throw new Error("INVALID_INPUT: candles must contain at least 1 entry");
    }
    const handle = this.nextHandle();
    const entry: Entry = {
      handle,
      candles,
      count: candles.length,
      span: {
        from: candles[0].time,
        to: candles[candles.length - 1].time,
      },
      symbol: meta.symbol,
      hint: meta.hint,
    };
    this.entries.set(handle, entry);
    this.evictIfNeeded();
    return this.toMeta(entry);
  }

  get(handle: string): Candle[] | undefined {
    const entry = this.entries.get(handle);
    if (!entry) return undefined;
    // Touch: move to most-recently-used position
    this.entries.delete(handle);
    this.entries.set(handle, entry);
    return entry.candles;
  }

  has(handle: string): boolean {
    return this.entries.has(handle);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private nextHandle(): string {
    this.counter += 1;
    const rand = Math.random().toString(36).slice(2, 8);
    return `cdl_${this.counter.toString(36)}_${rand}`;
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  private toMeta(entry: Entry): CandleHandle {
    return {
      handle: entry.handle,
      count: entry.count,
      span: entry.span,
      symbol: entry.symbol,
      hint: entry.hint,
    };
  }
}

/** Singleton store shared across tool handlers in the same process. */
export const defaultCandleStore = new CandleStore();
