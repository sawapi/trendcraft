/**
 * Incremental MACD (Moving Average Convergence Divergence)
 *
 * Composite indicator using three EMA layers: fast, slow, signal.
 *
 * State category: **Cascaded** (three recursive EMA layers). MACD
 * keeps its own inline EMA logic — it does not compose `createEma` —
 * so the bare state carries the EMA accumulators directly. Resume
 * with a different `fastPeriod` / `slowPeriod` / `signalPeriod` /
 * `source` is refused.
 *
 * Migrated to the 0.4.0 State Contract. The EMA multipliers
 * (`fastMult` / `slowMult` / `signalMult`) are derived from the
 * periods in the factory closure and not persisted.
 */

import type { MacdValue, NormalizedCandle, PriceSource } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for MACD. Params (`fastPeriod`, `slowPeriod`,
 * `signalPeriod`, `source`) live in `meta.params`; the EMA multipliers
 * are derived from the periods.
 */
export type MacdState = {
  fastEma: number | null;
  slowEma: number | null;
  signalEma: number | null;
  fastSum: number;
  slowSum: number;
  signalSum: number;
  count: number;
  validMacdCount: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const MACD_VERSION = 1;

type MacdParams = {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  source: PriceSource;
};

/**
 * Create an incremental MACD indicator
 *
 * @example
 * ```ts
 * const macd = createMacd({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
 * for (const candle of stream) {
 *   const { value } = macd.next(candle);
 *   if (macd.isWarmedUp) console.log(value.macd, value.signal, value.histogram);
 * }
 * ```
 */
export function createMacd(
  options: {
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<MacdState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<MacdValue, IndicatorSnapshot<MacdState>> {
  const { params, state } = resolveResume<MacdParams, MacdState>({
    indicator: "macd",
    version: MACD_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: "close" },
  });

  const fastPeriod = requireParam(
    "macd",
    params,
    "fastPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const slowPeriod = requireParam(
    "macd",
    params,
    "slowPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const signalPeriod = requireParam(
    "macd",
    params,
    "signalPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const fastMult = 2 / (fastPeriod + 1);
  const slowMult = 2 / (slowPeriod + 1);
  const signalMult = 2 / (signalPeriod + 1);

  let fastEma: number | null;
  let slowEma: number | null;
  let signalEma: number | null;
  let fastSum: number;
  let slowSum: number;
  let signalSum: number;
  let count: number;
  let validMacdCount: number;

  if (state !== null) {
    fastEma = state.fastEma;
    slowEma = state.slowEma;
    signalEma = state.signalEma;
    fastSum = state.fastSum;
    slowSum = state.slowSum;
    signalSum = state.signalSum;
    count = state.count;
    validMacdCount = state.validMacdCount;
  } else {
    fastEma = null;
    slowEma = null;
    signalEma = null;
    fastSum = 0;
    slowSum = 0;
    signalSum = 0;
    count = 0;
    validMacdCount = 0;
  }

  const nullValue: MacdValue = { macd: null, signal: null, histogram: null };

  function updateEma(
    price: number,
    prevEma: number | null,
    sum: number,
    period: number,
    mult: number,
    currentCount: number,
  ): { ema: number | null; sum: number } {
    if (currentCount < period) {
      return { ema: null, sum: sum + price };
    }
    if (currentCount === period) {
      const newSum = sum + price;
      return { ema: newSum / period, sum: newSum };
    }
    return { ema: price * mult + (prevEma ?? 0) * (1 - mult), sum };
  }

  const indicator: IncrementalIndicator<MacdValue, IndicatorSnapshot<MacdState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      // Update fast EMA
      const fastResult = updateEma(price, fastEma, fastSum, fastPeriod, fastMult, count);
      fastEma = fastResult.ema;
      fastSum = fastResult.sum;

      // Update slow EMA
      const slowResult = updateEma(price, slowEma, slowSum, slowPeriod, slowMult, count);
      slowEma = slowResult.ema;
      slowSum = slowResult.sum;

      // Calculate MACD line
      if (fastEma === null || slowEma === null) {
        return { time: candle.time, value: nullValue };
      }

      const macdLine = fastEma - slowEma;
      validMacdCount++;

      // Update signal EMA
      if (validMacdCount < signalPeriod) {
        signalSum += macdLine;
        return {
          time: candle.time,
          value: { macd: macdLine, signal: null, histogram: null },
        };
      }

      if (validMacdCount === signalPeriod) {
        signalSum += macdLine;
        signalEma = signalSum / signalPeriod;
      } else {
        signalEma = macdLine * signalMult + (signalEma ?? 0) * (1 - signalMult);
      }

      const histogram = macdLine - (signalEma ?? 0);

      return {
        time: candle.time,
        value: { macd: macdLine, signal: signalEma, histogram },
      };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      // Preview fast EMA
      const fr = updateEma(price, fastEma, fastSum, fastPeriod, fastMult, peekCount);
      const sr = updateEma(price, slowEma, slowSum, slowPeriod, slowMult, peekCount);

      if (fr.ema === null || sr.ema === null) {
        return { time: candle.time, value: nullValue };
      }

      const macdLine = fr.ema - sr.ema;
      const peekValidCount = validMacdCount + 1;

      if (peekValidCount < signalPeriod) {
        return {
          time: candle.time,
          value: { macd: macdLine, signal: null, histogram: null },
        };
      }

      let peekSignal: number;
      if (peekValidCount === signalPeriod) {
        peekSignal = (signalSum + macdLine) / signalPeriod;
      } else {
        peekSignal = macdLine * signalMult + (signalEma ?? 0) * (1 - signalMult);
      }

      return {
        time: candle.time,
        value: { macd: macdLine, signal: peekSignal, histogram: macdLine - peekSignal },
      };
    },

    getState(): IndicatorSnapshot<MacdState> {
      return makeSnapshot(
        "macd",
        MACD_VERSION,
        { fastPeriod, slowPeriod, signalPeriod, source },
        {
          fastEma,
          slowEma,
          signalEma,
          fastSum,
          slowSum,
          signalSum,
          count,
          validMacdCount,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return validMacdCount >= signalPeriod;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
