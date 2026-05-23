/**
 * Incremental KAMA (Kaufman Adaptive Moving Average)
 *
 * KAMA adapts smoothing speed based on Efficiency Ratio (ER).
 *
 * State category: **Mixed** (price buffer for ER + recursive
 * `prevKama`). The recursive component permanently carries past
 * parameters, so resume with a different `period` / `fastPeriod` /
 * `slowPeriod` / `source` is refused by the mixed-category policy.
 *
 * Migrated to the 0.4.0 State Contract. The smoothing constants
 * `fastSC` / `slowSC` are derived from `fastPeriod` / `slowPeriod` in
 * the factory closure and not persisted — `meta.params` carries the
 * periods themselves.
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
 * Bare state shape for KAMA. Params (`period`, `fastPeriod`,
 * `slowPeriod`, `source`) live in `meta.params`.
 */
export type KamaState = {
  priceBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevKama: number | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const KAMA_VERSION = 1;

type KamaParams = {
  period: number;
  fastPeriod: number;
  slowPeriod: number;
  source: PriceSource;
};

/**
 * Create an incremental KAMA indicator
 *
 * @example
 * ```ts
 * const kama = createKama({ period: 10 });
 * for (const candle of stream) {
 *   const { value } = kama.next(candle);
 *   if (kama.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createKama(
  options: { period?: number; fastPeriod?: number; slowPeriod?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<KamaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<KamaState>> {
  const { params, state } = resolveResume<KamaParams, KamaState>({
    indicator: "kama",
    version: KAMA_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 10, fastPeriod: 2, slowPeriod: 30, source: "close" },
  });

  const period = requireParam(
    "kama",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const fastPeriod = requireParam(
    "kama",
    params,
    "fastPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const slowPeriod = requireParam(
    "kama",
    params,
    "slowPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const fastSC = 2 / (fastPeriod + 1);
  const slowSC = 2 / (slowPeriod + 1);

  // Need period+1 prices to compute direction and volatility
  let priceBuffer: CircularBuffer<number>;
  let prevKama: number | null;
  let count: number;

  if (state !== null) {
    priceBuffer = CircularBuffer.fromSnapshot(state.priceBuffer);
    prevKama = state.prevKama;
    count = state.count;
  } else {
    priceBuffer = new CircularBuffer<number>(period + 1);
    prevKama = null;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<KamaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      priceBuffer.push(price);

      if (count < period) {
        return { time: candle.time, value: null };
      }

      if (count === period) {
        // Seed KAMA with close[period-1] (TA-Lib compatible)
        prevKama = price;
        return { time: candle.time, value: null };
      }

      // count > period: compute KAMA
      // Direction: |price - price[period ago]|
      const direction = Math.abs(price - priceBuffer.get(0));

      // Volatility: sum of |price[i] - price[i-1]| for period bars
      let volatility = 0;
      for (let i = 1; i < priceBuffer.length; i++) {
        volatility += Math.abs(priceBuffer.get(i) - priceBuffer.get(i - 1));
      }

      const er = volatility === 0 ? 0 : direction / volatility;
      const sc = (er * (fastSC - slowSC) + slowSC) ** 2;

      const prev = prevKama ?? 0;
      prevKama = prev + sc * (price - prev);

      return { time: candle.time, value: prevKama };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      if (peekCount <= period) {
        return { time: candle.time, value: null };
      }

      // After push, the oldest element would be at index 1 if full, else 0
      const startIdx = priceBuffer.isFull ? 1 : 0;

      // Direction: |price - oldest price after simulated push|
      const direction = Math.abs(price - priceBuffer.get(startIdx));

      // Volatility: sum of |price[i] - price[i-1]| for the window, with new price appended
      let volatility = 0;
      let prevPrice = priceBuffer.get(startIdx);
      for (let i = startIdx + 1; i < priceBuffer.length; i++) {
        volatility += Math.abs(priceBuffer.get(i) - prevPrice);
        prevPrice = priceBuffer.get(i);
      }
      volatility += Math.abs(price - prevPrice);

      const er = volatility === 0 ? 0 : direction / volatility;
      const sc = (er * (fastSC - slowSC) + slowSC) ** 2;

      const prev = prevKama ?? 0;
      return { time: candle.time, value: prev + sc * (price - prev) };
    },

    getState(): IndicatorSnapshot<KamaState> {
      return makeSnapshot(
        "kama",
        KAMA_VERSION,
        { period, fastPeriod, slowPeriod, source },
        {
          priceBuffer: priceBuffer.snapshot(),
          prevKama,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count > period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
