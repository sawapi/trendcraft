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
 * R² is computed from running sums via the Pearson form
 *   R² = (n·sumXY − sumX·sumY)² / ((n·sumXX − sumX²) · (n·sumYY − sumY²))
 * so we never have to iterate the buffer to get ssRes / ssTot.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type LinearRegressionValue = {
  value: number;
  slope: number;
  intercept: number;
  rSquared: number;
};

export type LinearRegressionState = {
  period: number;
  source: PriceSource;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sumY: number;
  sumY2: number;
  sumXY: number;
  count: number;
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
  warmUpOptions?: WarmUpOptions<LinearRegressionState>,
): IncrementalIndicator<LinearRegressionValue | null, LinearRegressionState> {
  // When restoring from a snapshot, the saved period/source MUST win over the
  // factory-call defaults — otherwise sumY / sumXY / buffer values that were
  // computed under one configuration would be reused with a different one,
  // silently corrupting outputs from the first resumed candle onward.
  const period = warmUpOptions?.fromState?.period ?? options.period ?? 14;
  const source: PriceSource = warmUpOptions?.fromState?.source ?? options.source ?? "close";

  if (period < 2) {
    throw new Error("Linear Regression period must be at least 2");
  }

  // Closed-form constants for x = 0..period-1
  const sumX = (period * (period - 1)) / 2;
  const sumX2 = (period * (period - 1) * (2 * period - 1)) / 6;
  const denomX = period * sumX2 - sumX * sumX;

  let buffer: CircularBuffer<number>;
  let sumY: number;
  let sumY2: number;
  let sumXY: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    sumY = s.sumY;
    sumY2 = s.sumY2;
    sumXY = s.sumXY;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sumY = 0;
    sumY2 = 0;
    sumXY = 0;
    count = 0;
  }

  function compute(): LinearRegressionValue | null {
    if (count < period) return null;
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

  const indicator: IncrementalIndicator<LinearRegressionValue | null, LinearRegressionState> = {
    next(candle: NormalizedCandle) {
      const y = getSourcePrice(candle, source);
      const willEvict = buffer.isFull;
      const yDrop = willEvict ? buffer.oldest() : 0;

      // Window already full → use the slide-update law BEFORE mutating sumY.
      if (count >= period) {
        sumXY = sumXY + (period - 1) * y - (sumY - yDrop);
      }

      sumY = sumY - yDrop + y;
      sumY2 = sumY2 - yDrop * yDrop + y * y;
      buffer.push(y);
      count++;

      // First time the buffer is full → seed sumXY from the explicit sum.
      if (count === period) {
        sumXY = 0;
        for (let j = 0; j < period; j++) {
          sumXY += j * buffer.get(j);
        }
      }

      return { time: candle.time, value: compute() };
    },

    peek(candle: NormalizedCandle) {
      const y = getSourcePrice(candle, source);
      const willEvict = buffer.isFull;
      const yDrop = willEvict ? buffer.oldest() : 0;
      const peekCount = count + 1;
      if (peekCount < period) return { time: candle.time, value: null };

      let peekSumY: number;
      let peekSumY2: number;
      let peekSumXY: number;

      if (count < period) {
        // Buffer just becomes full; peek the seeded sumXY from buffer + new y.
        peekSumY = sumY + y;
        peekSumY2 = sumY2 + y * y;
        peekSumXY = 0;
        // Buffer currently has count elements, peek-pushing y at the end.
        for (let j = 0; j < count; j++) peekSumXY += j * buffer.get(j);
        peekSumXY += count * y;
      } else {
        peekSumY = sumY - yDrop + y;
        peekSumY2 = sumY2 - yDrop * yDrop + y * y;
        peekSumXY = sumXY + (period - 1) * y - (sumY - yDrop);
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

    getState(): LinearRegressionState {
      return {
        period,
        source,
        buffer: buffer.snapshot(),
        sumY,
        sumY2,
        sumXY,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
