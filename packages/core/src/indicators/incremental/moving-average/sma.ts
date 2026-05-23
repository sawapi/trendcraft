/**
 * Incremental SMA (Simple Moving Average)
 *
 * State category: **Windowed** (raw price buffer, no recursion).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<SmaState>` and `fromState` accepts the same.
 *
 * Defaults: `source` defaults to `"close"`. `period` has no canonical
 * default (Pine Script / TA-Lib / Tulip all require it from the
 * caller); it must be supplied on first construction. On resume, it
 * may be omitted to inherit from the snapshot.
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
 * Bare state shape for SMA. Params (`period`, `source`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type SmaState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const SMA_VERSION = 1;

type SmaParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental SMA indicator
 *
 * @example
 * ```ts
 * // Fresh start — period is required on first call.
 * const sma20 = createSma({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = sma20.next(candle);
 *   if (sma20.isWarmedUp) console.log(value);
 * }
 *
 * // Resume from a saved snapshot — period may be omitted; the
 * // snapshot supplies it.
 * const resumed = createSma({}, { fromState: snapshot });
 * ```
 */
export function createSma(
  options: { period?: number; source?: PriceSource },
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<SmaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<SmaState>> {
  const { params, state, reconfigured } = resolveResume<SmaParams, SmaState>({
    indicator: "sma",
    version: SMA_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { source: "close" }, // `period` is intentionally absent — no canonical default.
  });

  const period = requireParam(
    "sma",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let buffer: CircularBuffer<number>;
  let sum: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. The snapshot's buffer is at the OLD capacity;
      // we need a buffer at the NEW capacity holding the most recent
      // min(snapshot.length, newPeriod) samples. Sum must be
      // recomputed from those carried samples — the snapshot's `sum`
      // was over the old window and would be wrong for the new one.
      const oldBuffer = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const available = oldBuffer.length;
      const carryStart = Math.max(0, available - period);
      sum = 0;
      for (let i = carryStart; i < available; i++) {
        const v = oldBuffer.get(i);
        buffer.push(v);
        sum += v;
      }
      // Preserve `count` as the public "candles processed so far"
      // counter. Warm-up readiness is gated on `buffer.length`
      // separately so a grown period correctly waits for new bars.
      count = state.count;
    } else {
      // Same shape — restore buffer verbatim.
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      sum = state.sum;
      count = state.count;
    }
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<SmaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (buffer.isFull) {
        sum = sum - buffer.oldest() + price;
      } else {
        sum += price;
      }

      buffer.push(price);
      count++;

      // Warm-up gated on the buffer being full, not on `count`. After
      // a period-growing resume, `count` is the snapshot's large
      // value but the rebuilt buffer needs more candles to fill.
      const value = buffer.length >= period ? sum / period : null;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const newSum = buffer.isFull ? sum - buffer.oldest() + price : sum + price;
      const newLength = Math.min(buffer.length + 1, period);
      const value = newLength >= period ? newSum / period : null;
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<SmaState> {
      return makeSnapshot(
        "sma",
        SMA_VERSION,
        { period, source },
        { buffer: buffer.snapshot(), sum, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= period;
    },
  };

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
