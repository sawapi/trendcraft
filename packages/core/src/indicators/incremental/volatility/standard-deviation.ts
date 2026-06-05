/**
 * Incremental Standard Deviation
 *
 * State category: **Windowed** (raw price buffer + running sum and sum-of-
 * squares for O(1) per-candle variance).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<StandardDeviationState>` and `fromState` accepts
 * the same.
 *
 * Rolling population standard deviation (divides by N, matching the
 * batch `standardDeviation()` and TA-Lib convention).
 *
 * Defaults: `source` defaults to `"close"`. `period` has no canonical
 * default — TA-Lib's `STDDEV` requires it from the caller; aligned
 * with the SMA / WMA / VWMA migration pattern.
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
 * Bare state shape for Standard Deviation. Params (`period`, `source`)
 * live in `meta.params` on the wire — they are not part of the bare state.
 */
export type StandardDeviationState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  sumSq: number;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const STANDARD_DEVIATION_VERSION = 1;

type StandardDeviationParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental Standard Deviation indicator.
 *
 * @example
 * ```ts
 * // Fresh start — period is required on first call.
 * const sd = createStandardDeviation({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = sd.next(candle);
 *   if (sd.isWarmedUp) console.log(value);
 * }
 *
 * // Resume from a saved snapshot — period may be omitted; the
 * // snapshot supplies it.
 * const resumed = createStandardDeviation({}, { fromState: snapshot });
 * ```
 */
export function createStandardDeviation(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<StandardDeviationState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<StandardDeviationState>> {
  const { params, state, reconfigured } = resolveResume<
    StandardDeviationParams,
    StandardDeviationState
  >({
    indicator: "standardDeviation",
    version: STANDARD_DEVIATION_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { source: "close" }, // `period` is intentionally absent — no canonical default.
  });

  const period = requireParam(
    "standardDeviation",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let buffer: CircularBuffer<number>;
  let sum: number;
  let sumSq: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. The snapshot's buffer is at the OLD capacity;
      // rebuild at the NEW capacity holding the most recent
      // min(snapshot.length, newPeriod) samples. sum / sumSq must be
      // recomputed from those carried samples — the snapshot's running
      // totals were over the old window.
      const oldBuffer = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const available = oldBuffer.length;
      const carryStart = Math.max(0, available - period);
      sum = 0;
      sumSq = 0;
      for (let i = carryStart; i < available; i++) {
        const v = oldBuffer.get(i);
        buffer.push(v);
        sum += v;
        sumSq += v * v;
      }
      count = state.count;
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      sum = state.sum;
      sumSq = state.sumSq;
      count = state.count;
    }
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    sumSq = 0;
    count = 0;
  }

  function compute(): number | null {
    if (buffer.length < period) return null;
    const mean = sum / period;
    // Variance = E[X²] - (E[X])²; clamp tiny negatives from float error.
    const variance = Math.max(0, sumSq / period - mean * mean);
    return Math.sqrt(variance);
  }

  const indicator: IncrementalIndicator<
    number | null,
    IndicatorSnapshot<StandardDeviationState>
  > = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      if (buffer.isFull) {
        const oldest = buffer.oldest();
        sum -= oldest;
        sumSq -= oldest * oldest;
      }
      buffer.push(price);
      sum += price;
      sumSq += price * price;
      count++;
      return { time: candle.time, value: compute() };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const willEvict = buffer.isFull;
      const peekSum = sum + price - (willEvict ? buffer.oldest() : 0);
      const peekSumSq = sumSq + price * price - (willEvict ? buffer.oldest() * buffer.oldest() : 0);
      const peekLength = Math.min(buffer.length + 1, period);
      if (peekLength < period) return { time: candle.time, value: null };
      const mean = peekSum / period;
      const variance = Math.max(0, peekSumSq / period - mean * mean);
      return { time: candle.time, value: Math.sqrt(variance) };
    },

    getState(): IndicatorSnapshot<StandardDeviationState> {
      return makeSnapshot(
        "standardDeviation",
        STANDARD_DEVIATION_VERSION,
        { period, source },
        { buffer: buffer.snapshot(), sum, sumSq, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
