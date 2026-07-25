/**
 * Incremental Garman-Klass Volatility
 *
 * An efficient volatility estimator that uses the full OHLC price range,
 * providing a more accurate measure than close-to-close historical volatility.
 *
 * Formula per bar: 0.5 * ln(H/L)^2 - (2*ln(2) - 1) * ln(C/O)^2
 * Output: sqrt(mean(components) * annualFactor) * 100
 *
 * State category: **Windowed** (a fixed-size component buffer plus a
 * running `sum`). Resume with a different `period` carries the
 * component buffer forward. `annualFactor` is a resume-invariant
 * param — it only scales the final sqrt output, never the buffer.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for Garman-Klass. Params (`period`, `annualFactor`)
 * live in `meta.params` on the wire.
 */
export type GarmanKlassState = {
  /**
   * Per-bar variance contributions. A candle the estimator cannot use is held
   * as `null` rather than `NaN`: `JSON.stringify` turns `NaN` into `null`
   * anyway, so a NaN marker came back from a persisted snapshot as a slot the
   * resume path no longer recognised as invalid, and the resumed indicator
   * reported volatility where its uninterrupted twin reported none.
   */
  buffer: ReturnType<CircularBuffer<number | null>["snapshot"]>;
  sum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const GARMAN_KLASS_VERSION = 2;

type GarmanKlassParams = {
  period: number;
  annualFactor: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<GarmanKlassState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<GarmanKlassState>> {
  const { params, state, reconfigured } = resolveResume<GarmanKlassParams, GarmanKlassState>({
    indicator: "garmanKlass",
    version: GARMAN_KLASS_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, annualFactor: 252 },
    resumeInvariantParams: ["annualFactor"],
  });

  const period = requireParam(
    "garmanKlass",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const annualFactor = params.annualFactor;

  const LN2_COEFF = 2 * Math.LN2 - 1;

  let buffer: CircularBuffer<number | null>;
  let sum: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the component buffer forward and
      // recompute the running sum (null markers are excluded).
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number | null>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
      sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer.get(i);
        if (v !== null) sum += v;
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      sum = state.sum;
    }
    count = state.count;
  } else {
    buffer = new CircularBuffer<number | null>(period);
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

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<GarmanKlassState>> = {
    next(candle: NormalizedCandle) {
      count++;

      const component = computeComponent(candle);
      if (component === null) {
        // Invalid candle — push a null marker to track the unusable slot
        // so buffer.length still advances correctly
        if (buffer.isFull) {
          const oldest = buffer.oldest();
          if (oldest !== null) sum -= oldest;
        }
        buffer.push(null);
        return { time: candle.time, value: null };
      }

      if (buffer.isFull) {
        const oldest = buffer.oldest();
        if (oldest !== null) {
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

      // Check for any null (invalid) entries in the window
      for (let i = 0; i < buffer.length; i++) {
        if (buffer.get(i) === null) {
          return { time: candle.time, value: null };
        }
      }

      return { time: candle.time, value: computeOutput(sum) };
    },

    peek(candle: NormalizedCandle) {
      const component = computeComponent(candle);
      if (component === null || buffer.length < period - 1) {
        return { time: candle.time, value: null };
      }

      let peekSum = sum;
      if (buffer.isFull) {
        const oldest = buffer.oldest();
        // An unusable slot never entered `sum`, so there is nothing to remove.
        peekSum = peekSum - (oldest ?? 0) + component;
      } else {
        peekSum += component;
      }

      if (buffer.length + (buffer.isFull ? 0 : 1) < period) {
        return { time: candle.time, value: null };
      }

      // A null marker anywhere in the simulated window invalidates output.
      const start = buffer.isFull ? 1 : 0;
      for (let i = start; i < buffer.length; i++) {
        if (buffer.get(i) === null) {
          return { time: candle.time, value: null };
        }
      }

      return { time: candle.time, value: computeOutput(peekSum) };
    },

    getState(): IndicatorSnapshot<GarmanKlassState> {
      return makeSnapshot(
        "garmanKlass",
        GARMAN_KLASS_VERSION,
        { period, annualFactor },
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

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
