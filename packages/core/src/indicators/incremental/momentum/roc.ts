/**
 * Incremental Rate of Change (ROC)
 *
 * ROC = ((Current Price - Price N periods ago) / Price N periods ago) × 100
 *
 * State category: **Windowed** (a fixed-size price buffer; no
 * recursive accumulator). Resume with a different `period` carries the
 * raw price buffer forward; `source` change is refused.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<RocState>` and `fromState` accepts the same.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for ROC. Params (`period`, `source`) live in
 * `meta.params` on the wire.
 */
export type RocState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ROC_VERSION = 1;

type RocParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental Rate of Change indicator
 *
 * @example
 * ```ts
 * const rocInd = createRoc({ period: 12 });
 * for (const candle of stream) {
 *   const result = rocInd.next(candle);
 *   if (rocInd.isWarmedUp) console.log(result.value);
 * }
 * ```
 */
export function createRoc(
  options: { period?: number; source?: PriceSource },
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<RocState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<RocState>> {
  const { params, state, reconfigured } = resolveResume<RocParams, RocState>({
    indicator: "roc",
    version: ROC_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { source: "close" },
  });

  const period = requireParam(
    "roc",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  // Need period + 1 slots: period historical values + current.
  let buffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the raw prices forward into a buffer
      // resized to the new capacity (windowed carry-forward).
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period + 1);
      const carry = Math.min(old.length, period + 1);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
    }
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(period + 1);
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<RocState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      buffer.push(price);
      count++;

      if (buffer.length <= period) {
        return { time: candle.time, value: null };
      }

      // oldest() is the price from `period` candles ago
      const pastPrice = buffer.oldest();
      const value = pastPrice !== 0 ? ((price - pastPrice) / pastPrice) * 100 : 0;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }

      // If buffer is full, oldest would shift; otherwise oldest stays the same
      let pastPrice: number;
      if (buffer.length === buffer.capacity) {
        // After push, the current oldest would be evicted, so pastPrice is buffer.get(1)
        pastPrice = buffer.get(1);
      } else {
        pastPrice = buffer.oldest();
      }

      const value = pastPrice !== 0 ? ((price - pastPrice) / pastPrice) * 100 : 0;
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<RocState> {
      return makeSnapshot(
        "roc",
        ROC_VERSION,
        { period, source },
        { buffer: buffer.snapshot(), count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length > period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
