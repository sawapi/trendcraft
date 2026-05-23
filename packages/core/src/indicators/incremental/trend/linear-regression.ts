/**
 * Incremental Linear Regression
 *
 * Rolling least-squares fit over the last `period` prices with x = 0..period-1
 * indexed within the window. State is kept as O(1)-updateable running sums
 * (sumY, sumY², sumXY) plus a CircularBuffer of `period` y-values needed
 * to know which y is being evicted when the window slides.
 *
 * Update law (proved under the change of variable k = j+1 against the batch
 * sumXY = Σ j·y_{i-period+1+j}):
 *
 *   sumXY_new = sumXY_old + (period-1) * y_new - (sumY_old - y_drop)
 *
 * where y_drop is the oldest value in the window before the push.
 *
 * State category: **Windowed** (a raw price buffer plus running sums).
 * Warmup and seeding are gated on `buffer.isFull`, not a monotonic
 * `count`, so resume with a different `period` carries the buffer
 * forward correctly; `source` change is refused.
 *
 * Migrated to the 0.4.0 State Contract.
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

export type LinearRegressionValue = {
  value: number;
  slope: number;
  intercept: number;
  rSquared: number;
};

/**
 * Bare state shape for Linear Regression. Params (`period`, `source`)
 * live in `meta.params` on the wire.
 */
export type LinearRegressionState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sumY: number;
  sumY2: number;
  sumXY: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const LINEAR_REGRESSION_VERSION = 1;

type LinearRegressionParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental Linear Regression indicator.
 *
 * @example
 * ```ts
 * const lr = createLinearRegression({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = lr.next(candle);
 *   if (value && value.rSquared > 0.8) console.log("strong trend, slope=", value.slope);
 * }
 * ```
 */
export function createLinearRegression(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<LinearRegressionState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<LinearRegressionValue | null, IndicatorSnapshot<LinearRegressionState>> {
  const { params, state, reconfigured } = resolveResume<
    LinearRegressionParams,
    LinearRegressionState
  >({
    indicator: "linearRegression",
    version: LINEAR_REGRESSION_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, source: "close" },
  });

  const period = requireParam(
    "linearRegression",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const source = params.source;

  // Closed-form constants for x = 0..period-1
  const sumX = (period * (period - 1)) / 2;
  const sumX2 = (period * (period - 1) * (2 * period - 1)) / 6;
  const denomX = period * sumX2 - sumX * sumX;

  let buffer: CircularBuffer<number>;
  let sumY: number;
  let sumY2: number;
  let sumXY: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the raw prices forward and recompute the
      // running sums against the new window.
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
      sumY = 0;
      sumY2 = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer.get(i);
        sumY += v;
        sumY2 += v * v;
      }
      // sumXY is only meaningful once the window is full; seed it now
      // if the carry-forward already filled the new window.
      sumXY = 0;
      if (buffer.isFull) {
        for (let j = 0; j < period; j++) sumXY += j * buffer.get(j);
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      sumY = state.sumY;
      sumY2 = state.sumY2;
      sumXY = state.sumXY;
    }
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sumY = 0;
    sumY2 = 0;
    sumXY = 0;
    count = 0;
  }

  function compute(): LinearRegressionValue | null {
    if (!buffer.isFull) return null;
    const slope = (period * sumXY - sumX * sumY) / denomX;
    const intercept = (sumY - slope * sumX) / period;
    const value = intercept + slope * (period - 1);
    // Pearson R² via running sums; clamp to [0, 1] for float safety.
    const denomY = period * sumY2 - sumY * sumY;
    const numerR2 = (period * sumXY - sumX * sumY) ** 2;
    const rSquared = denomY > 0 && denomX > 0 ? numerR2 / (denomX * denomY) : 0;
    return {
      value,
      slope,
      intercept,
      rSquared: Math.min(1, Math.max(0, rSquared)),
    };
  }

  const indicator: IncrementalIndicator<
    LinearRegressionValue | null,
    IndicatorSnapshot<LinearRegressionState>
  > = {
    next(candle: NormalizedCandle) {
      const y = getSourcePrice(candle, source);
      const wasFull = buffer.isFull;
      const yDrop = wasFull ? buffer.oldest() : 0;

      // Window already full → use the slide-update law BEFORE mutating sumY.
      if (wasFull) {
        sumXY = sumXY + (period - 1) * y - (sumY - yDrop);
      }

      sumY = sumY - yDrop + y;
      sumY2 = sumY2 - yDrop * yDrop + y * y;
      buffer.push(y);
      count++;

      // Buffer just reached full → seed sumXY from the explicit sum.
      if (!wasFull && buffer.isFull) {
        sumXY = 0;
        for (let j = 0; j < period; j++) {
          sumXY += j * buffer.get(j);
        }
      }

      return { time: candle.time, value: compute() };
    },

    peek(candle: NormalizedCandle) {
      const y = getSourcePrice(candle, source);
      const wasFull = buffer.isFull;
      const yDrop = wasFull ? buffer.oldest() : 0;
      const willBeFull = wasFull || buffer.length + 1 >= period;
      if (!willBeFull) return { time: candle.time, value: null };

      let peekSumY: number;
      let peekSumY2: number;
      let peekSumXY: number;

      if (wasFull) {
        peekSumY = sumY - yDrop + y;
        peekSumY2 = sumY2 - yDrop * yDrop + y * y;
        peekSumXY = sumXY + (period - 1) * y - (sumY - yDrop);
      } else {
        // Buffer becomes full exactly now; seed sumXY from buffer + new y.
        peekSumY = sumY + y;
        peekSumY2 = sumY2 + y * y;
        peekSumXY = 0;
        for (let j = 0; j < buffer.length; j++) peekSumXY += j * buffer.get(j);
        peekSumXY += buffer.length * y;
      }

      const slope = (period * peekSumXY - sumX * peekSumY) / denomX;
      const intercept = (peekSumY - slope * sumX) / period;
      const value = intercept + slope * (period - 1);
      const denomY = period * peekSumY2 - peekSumY * peekSumY;
      const numerR2 = (period * peekSumXY - sumX * peekSumY) ** 2;
      const rSquared = denomY > 0 && denomX > 0 ? numerR2 / (denomX * denomY) : 0;
      return {
        time: candle.time,
        value: {
          value,
          slope,
          intercept,
          rSquared: Math.min(1, Math.max(0, rSquared)),
        },
      };
    },

    getState(): IndicatorSnapshot<LinearRegressionState> {
      return makeSnapshot(
        "linearRegression",
        LINEAR_REGRESSION_VERSION,
        { period, source },
        { buffer: buffer.snapshot(), sumY, sumY2, sumXY, count },
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
