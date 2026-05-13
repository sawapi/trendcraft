/**
 * Incremental WMA (Weighted Moving Average)
 *
 * State category: **Windowed** (raw price buffer + cached running
 * sums for O(1) update). Migrated to the 0.4.0 State Contract:
 * `getState()` returns `IndicatorSnapshot<WmaState>` and `fromState`
 * accepts the same.
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
 * Bare state shape for WMA. Params (`period`, `source`) live in
 * `meta.params`. `weightDenominator` is recomputed at construction
 * from `period` — it's a cache, not canonical state.
 */
export type WmaState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  weightedSum: number;
  simpleSum: number;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const WMA_VERSION = 1;

type WmaParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental WMA indicator
 *
 * WMA = (P₀×n + P₁×(n-1) + ... + Pₙ₋₁×1) / (n×(n+1)/2)
 *
 * @example
 * ```ts
 * // Fresh start — period is required on first call.
 * const wma10 = createWma({ period: 10 });
 * for (const candle of stream) {
 *   const { value } = wma10.next(candle);
 *   if (wma10.isWarmedUp) console.log(value);
 * }
 *
 * // Resume — period may be omitted; the snapshot supplies it.
 * const resumed = createWma({}, { fromState: snapshot });
 * ```
 */
export function createWma(
  options: { period?: number; source?: PriceSource },
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<WmaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<WmaState>> {
  const { params, state, reconfigured } = resolveResume<WmaParams, WmaState>({
    indicator: "wma",
    version: WMA_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { source: "close" }, // `period` intentionally absent — no canonical default.
  });

  const period = requireParam(
    "wma",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const weightDenominator = (period * (period + 1)) / 2;

  let buffer: CircularBuffer<number>;
  let weightedSum: number;
  let simpleSum: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. The snapshot's buffer is at the OLD capacity
      // and its weightedSum / simpleSum reflect the OLD window
      // weighting — neither carries forward as-is. Rebuild the
      // buffer at the new capacity from the latest snapshot prices
      // and recompute both sums from those carried samples.
      //
      // (Source changes are refused by resolveResume before reaching
      // here.)
      const oldBuffer = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const available = oldBuffer.length;
      const carryStart = Math.max(0, available - period);
      weightedSum = 0;
      simpleSum = 0;
      let weightIdx = 0;
      for (let i = carryStart; i < available; i++) {
        const v = oldBuffer.get(i);
        buffer.push(v);
        weightedSum += v * (weightIdx + 1);
        simpleSum += v;
        weightIdx++;
      }
      count = state.count;
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      weightedSum = state.weightedSum;
      simpleSum = state.simpleSum;
      count = state.count;
    }
  } else {
    buffer = new CircularBuffer<number>(period);
    weightedSum = 0;
    simpleSum = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<WmaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      if (buffer.isFull) {
        // Sliding window update:
        // weightedSum = weightedSum - simpleSum + newPrice * period
        // simpleSum = simpleSum - oldest + newPrice
        weightedSum = weightedSum - simpleSum + price * period;
        simpleSum = simpleSum - buffer.oldest() + price;
        buffer.push(price);
        return { time: candle.time, value: weightedSum / weightDenominator };
      }

      // Buffer not yet full — build up.
      buffer.push(price);
      // Recompute from scratch during warmup (cheap, period bars max).
      weightedSum = 0;
      simpleSum = 0;
      const len = buffer.length;
      for (let i = 0; i < len; i++) {
        const w = i + 1;
        weightedSum += buffer.get(i) * w;
        simpleSum += buffer.get(i);
      }

      // Warm-up gated on `buffer.length` (not `count`) so a
      // period-growing resume waits for the rebuilt buffer to fill.
      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }
      return { time: candle.time, value: weightedSum / weightDenominator };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekLength = Math.min(buffer.length + 1, period);
      if (peekLength < period) {
        return { time: candle.time, value: null };
      }

      if (buffer.isFull) {
        const newWeightedSum = weightedSum - simpleSum + price * period;
        return { time: candle.time, value: newWeightedSum / weightDenominator };
      }

      // During warmup phase, compute from scratch.
      let ws = 0;
      const len = buffer.length;
      for (let i = 0; i < len; i++) {
        ws += buffer.get(i) * (i + 1);
      }
      ws += price * (len + 1);
      const wd = ((len + 1) * (len + 2)) / 2;
      return { time: candle.time, value: ws / wd };
    },

    getState(): IndicatorSnapshot<WmaState> {
      return makeSnapshot(
        "wma",
        WMA_VERSION,
        { period, source },
        { buffer: buffer.snapshot(), weightedSum, simpleSum, count },
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
