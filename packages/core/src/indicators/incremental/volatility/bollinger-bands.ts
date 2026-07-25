/**
 * Incremental Bollinger Bands
 *
 * Uses population variance (/N, not /(N-1)) for TA-Lib compatibility.
 *
 * State category: **Windowed** (a fixed-size price buffer; the band
 * statistics are recomputed from it each bar, O(period)). Resume with a
 * different `period` carries the raw price buffer forward; `source` change
 * is refused. `stdDev` is a resume-invariant param — it only scales the band
 * width, never the buffer.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import { centeredMoments } from "../../../core/statistics";
import type { BollingerBandsValue, NormalizedCandle, PriceSource } from "../../../types";
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
 * Bare state shape for Bollinger Bands. Params (`period`, `stdDev`,
 * `source`) live in `meta.params` on the wire.
 */
export type BollingerBandsState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Per-indicator schema version. Bumped on any breaking state change.
 *
 * v2 dropped the running `sum`/`sumSquares`: a drifted sum-of-squares was
 * being serialized into snapshots, so the error survived restore. The buffer
 * alone determines the window.
 */
export const BOLLINGER_BANDS_VERSION = 2;

type BollingerBandsParams = {
  period: number;
  stdDev: number;
  source: PriceSource;
};

/**
 * Create an incremental Bollinger Bands indicator
 *
 * @example
 * ```ts
 * const bb = createBollingerBands({ period: 20, stdDev: 2 });
 * for (const candle of stream) {
 *   const { value } = bb.next(candle);
 *   if (bb.isWarmedUp) console.log(value.upper, value.middle, value.lower);
 * }
 * ```
 */
export function createBollingerBands(
  options: { period?: number; stdDev?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<BollingerBandsState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<BollingerBandsValue, IndicatorSnapshot<BollingerBandsState>> {
  const { params, state, reconfigured } = resolveResume<BollingerBandsParams, BollingerBandsState>({
    indicator: "bollingerBands",
    version: BOLLINGER_BANDS_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, stdDev: 2, source: "close" },
    resumeInvariantParams: ["stdDev"],
  });

  const period = requireParam(
    "bollingerBands",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const stdDevMult = params.stdDev;
  const source = params.source;

  let buffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the raw prices forward into the new window.
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
    }
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  const nullValue: BollingerBandsValue = {
    upper: null,
    middle: null,
    lower: null,
    percentB: null,
    bandwidth: null,
  };

  /**
   * Bands for a full window, recomputed from the prices themselves.
   *
   * A running sum-of-squares is O(1) per bar but cancels catastrophically
   * once prices are large relative to their spread — bands collapse to zero
   * width and percentB pins to its 0.5 fallback — and the drift used to be
   * serialized into the snapshot. See centeredMoments.
   */
  function computeBands(window: readonly number[], price: number): BollingerBandsValue {
    const { mean, sumSqDev } = centeredMoments(window);
    const std = Math.sqrt(sumSqDev / period);

    const upper = mean + stdDevMult * std;
    const lower = mean - stdDevMult * std;
    const bandWidth = upper - lower;

    const percentB = bandWidth > 0 ? (price - lower) / bandWidth : 0.5;
    const bandwidth = mean !== 0 ? bandWidth / mean : 0;

    return { upper, middle: mean, lower, percentB, bandwidth };
  }

  const indicator: IncrementalIndicator<
    BollingerBandsValue,
    IndicatorSnapshot<BollingerBandsState>
  > = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      buffer.push(price);

      if (buffer.length < period) {
        return { time: candle.time, value: nullValue };
      }

      return { time: candle.time, value: computeBands(buffer.toArray(), price) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (buffer.length < period - 1) {
        return { time: candle.time, value: nullValue };
      }

      // The window the buffer would hold after pushing `price`.
      const window = buffer.toArray().slice(buffer.isFull ? 1 : 0);
      window.push(price);

      return { time: candle.time, value: computeBands(window, price) };
    },

    getState(): IndicatorSnapshot<BollingerBandsState> {
      return makeSnapshot(
        "bollingerBands",
        BOLLINGER_BANDS_VERSION,
        { period, stdDev: stdDevMult, source },
        { buffer: buffer.snapshot(), count },
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
