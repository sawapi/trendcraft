/**
 * Incremental Garman-Klass Volatility
 *
 * An efficient volatility estimator that uses the full OHLC price range,
 * providing a more accurate measure than close-to-close historical volatility.
 *
 * Formula per bar: 0.5 * ln(H/L)^2 - (2*ln(2) - 1) * ln(C/O)^2
 * Output: sqrt(mean(components) * annualFactor) * 100
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type GarmanKlassState = {
  period: number;
  annualFactor: number;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  count: number;
};

/**
 * Create an incremental Garman-Klass Volatility indicator
 *
 * @example
 * ```ts
 * const gk = createGarmanKlass({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = gk.next(candle);
 *   if (gk.isWarmedUp) console.log(`GK Vol: ${value?.toFixed(2)}%`);
 * }
 * ```
 */
export function createGarmanKlass(
  options: { period?: number; annualFactor?: number } = {},
  warmUpOptions?: WarmUpOptions<GarmanKlassState>,
): IncrementalIndicator<number | null, GarmanKlassState> {
  const period = options.period ?? 20;
  const annualFactor = options.annualFactor ?? 252;

  const LN2_COEFF = 2 * Math.LN2 - 1;

  let buffer: CircularBuffer<number>;
  let sum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    sum = s.sum;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    count = 0;
  }

  function computeComponent(candle: NormalizedCandle): number | null {
    if (candle.low <= 0 || candle.open <= 0) return null;
    const lnHL = Math.log(candle.high / candle.low);
    const lnCO = Math.log(candle.close / candle.open);
    return 0.5 * lnHL * lnHL - LN2_COEFF * lnCO * lnCO;
  }

  function computeOutput(currentSum: number): number {
    const mean = currentSum / period;
    return Math.sqrt(Math.max(0, mean) * annualFactor) * 100;
  }

  const indicator: IncrementalIndicator<number | null, GarmanKlassState> = {
    next(candle: NormalizedCandle) {
      count++;

      const component = computeComponent(candle);
      if (component === null) {
        // Invalid candle — push NaN marker to track the invalid slot
        // so buffer.length still advances correctly
        if (buffer.isFull) {
          const oldest = buffer.oldest();
          if (!Number.isNaN(oldest)) sum -= oldest;
        }
        buffer.push(Number.NaN);
        return { time: candle.time, value: null };
      }

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        if (!Number.isNaN(oldest)) {
          sum = sum - oldest + component;
        } else {
          sum += component;
        }
      } else {
        sum += component;
      }

      buffer.push(component);

      // Only output when buffer is full and all entries are valid
      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }

      // Check for any NaN (invalid) entries in the window
      for (let i = 0; i < buffer.length; i++) {
        if (Number.isNaN(buffer.get(i))) {
          return { time: candle.time, value: null };
        }
      }

      return { time: candle.time, value: computeOutput(sum) };
    },

    peek(candle: NormalizedCandle) {
      const component = computeComponent(candle);
      if (component === null || count + 1 < period) {
        return { time: candle.time, value: null };
      }

      let peekSum = sum;
      if (buffer.isFull) {
        const oldest = buffer.oldest();
        peekSum = peekSum - oldest + component;
      } else {
        peekSum += component;
      }

      if (buffer.length + (buffer.isFull ? 0 : 1) < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeOutput(peekSum) };
    },

    getState(): GarmanKlassState {
      return {
        period,
        annualFactor,
        buffer: buffer.snapshot(),
        sum,
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
