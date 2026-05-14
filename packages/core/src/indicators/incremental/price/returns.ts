/**
 * Incremental Returns
 *
 * State category: **Windowed** (raw close buffer; the only state is
 * the last `period` close values).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<ReturnsState>` and `fromState` accepts the same.
 *
 * n-period simple or log returns of close prices.
 *
 * Defaults: `period` defaults to `1` (the universal pandas / NumPy /
 * quantstats convention — `r_t = close_t / close_{t-1} - 1`).
 * `type` defaults to `"simple"`. Reconfig may change either param;
 * the close buffer carries forward as raw values and the new
 * `period` / `type` apply from the next bar onward.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for Returns. Params (`period`, `type`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 */
export type ReturnsState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const RETURNS_VERSION = 1;

type ReturnsParams = {
  period: number;
  type: "simple" | "log";
};

/**
 * Create an incremental Returns indicator.
 *
 * `period` >= 1 controls the lookback distance used to compute the return; the
 * output is `null` until at least `period + 1` candles have been seen.
 *
 * @example
 * ```ts
 * const r = createReturns({ period: 1, type: "log" });
 * for (const candle of stream) {
 *   const { value } = r.next(candle);
 *   if (value !== null) console.log(value);
 * }
 * ```
 */
export function createReturns(
  options: { period?: number; type?: "simple" | "log" } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ReturnsState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<ReturnsState>> {
  const { params, state, reconfigured } = resolveResume<ReturnsParams, ReturnsState>({
    indicator: "returns",
    version: RETURNS_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 1, type: "simple" },
  });

  const period = params.period;
  const type = params.type;

  if (!Number.isInteger(period) || period < 1) {
    throw new Error('returns: option "period" must be a positive integer');
  }
  if (type !== "simple" && type !== "log") {
    throw new Error('returns: option "type" must be "simple" or "log"');
  }

  // Buffer holds the last `period` closes (i.e. closes at index t-period..t-1);
  // when a new close arrives, the oldest slot is the reference price.
  let buffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. Carry forward the most recent min(snapshot, newPeriod)
      // raw closes into a buffer at the new capacity. No sums to recompute —
      // the return computation reads the buffer's oldest slot directly.
      // A `type` change leaves the buffer untouched (raw closes) but the
      // returned values shift from simple to log formula from the next bar.
      const oldBuffer = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const available = oldBuffer.length;
      const carryStart = Math.max(0, available - period);
      for (let i = carryStart; i < available; i++) {
        buffer.push(oldBuffer.get(i));
      }
      count = state.count;
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      count = state.count;
    }
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function calc(current: number, prev: number): number | null {
    if (prev === 0) return null;
    return type === "log" ? Math.log(current / prev) : (current - prev) / prev;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<ReturnsState>> = {
    next(candle: NormalizedCandle) {
      const current = candle.close;
      let value: number | null = null;
      if (buffer.isFull) {
        const prev = buffer.oldest();
        value = calc(current, prev);
      }
      buffer.push(current);
      count++;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      if (!buffer.isFull) return { time: candle.time, value: null };
      return { time: candle.time, value: calc(candle.close, buffer.oldest()) };
    },

    getState(): IndicatorSnapshot<ReturnsState> {
      return makeSnapshot(
        "returns",
        RETURNS_VERSION,
        { period, type },
        { buffer: buffer.snapshot(), count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.isFull;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
