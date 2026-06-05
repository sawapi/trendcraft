/**
 * Incremental PPO (Percentage Price Oscillator)
 *
 * PPO = ((fastEMA - slowEMA) / slowEMA) * 100
 * Signal = EMA(PPO, signalPeriod)
 * Histogram = PPO - Signal
 *
 * Similar to MACD but expressed as a percentage, making it comparable across instruments.
 *
 * State category: **Cascaded** (three recursive EMA layers). PPO keeps
 * its own inline EMA logic — it does not compose `createEma` — so the
 * bare state carries the EMA accumulators directly. Resume with a
 * different `fastPeriod` / `slowPeriod` / `signalPeriod` / `source` is
 * refused.
 *
 * Migrated to the 0.4.0 State Contract. The EMA multipliers are
 * derived from the periods in the factory closure and not persisted.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

export type PpoValue = {
  ppo: number;
  signal: number | null;
  histogram: number | null;
};

/**
 * Bare state shape for PPO. Params (`fastPeriod`, `slowPeriod`,
 * `signalPeriod`, `source`) live in `meta.params`; the EMA multipliers
 * are derived from the periods.
 */
export type PpoState = {
  fastEma: number | null;
  slowEma: number | null;
  signalEma: number | null;
  fastSum: number;
  slowSum: number;
  signalSum: number;
  count: number;
  validPpoCount: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const PPO_VERSION = 1;

type PpoParams = {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  source: PriceSource;
};

/**
 * Create an incremental PPO indicator
 *
 * @example
 * ```ts
 * const ppo = createPpo({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
 * for (const candle of stream) {
 *   const { value } = ppo.next(candle);
 *   if (ppo.isWarmedUp && value) {
 *     console.log(value.ppo, value.signal, value.histogram);
 *   }
 * }
 * ```
 */
export function createPpo(
  options: {
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<PpoState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<PpoValue | null, IndicatorSnapshot<PpoState>> {
  const { params, state } = resolveResume<PpoParams, PpoState>({
    indicator: "ppo",
    version: PPO_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: "close" },
  });

  const fastPeriod = requireParam(
    "ppo",
    params,
    "fastPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const slowPeriod = requireParam(
    "ppo",
    params,
    "slowPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const signalPeriod = requireParam(
    "ppo",
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
  let validPpoCount: number;

  if (state !== null) {
    fastEma = state.fastEma;
    slowEma = state.slowEma;
    signalEma = state.signalEma;
    fastSum = state.fastSum;
    slowSum = state.slowSum;
    signalSum = state.signalSum;
    count = state.count;
    validPpoCount = state.validPpoCount;
  } else {
    fastEma = null;
    slowEma = null;
    signalEma = null;
    fastSum = 0;
    slowSum = 0;
    signalSum = 0;
    count = 0;
    validPpoCount = 0;
  }

  const nullValue: PpoValue | null = null;

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

  const indicator: IncrementalIndicator<PpoValue | null, IndicatorSnapshot<PpoState>> = {
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

      // Calculate PPO line
      if (fastEma === null || slowEma === null || slowEma === 0) {
        return { time: candle.time, value: nullValue };
      }

      const ppoLine = ((fastEma - slowEma) / slowEma) * 100;
      validPpoCount++;

      // Update signal EMA
      if (validPpoCount < signalPeriod) {
        signalSum += ppoLine;
        return {
          time: candle.time,
          value: { ppo: ppoLine, signal: null, histogram: null },
        };
      }

      if (validPpoCount === signalPeriod) {
        signalSum += ppoLine;
        signalEma = signalSum / signalPeriod;
      } else {
        signalEma = ppoLine * signalMult + (signalEma ?? 0) * (1 - signalMult);
      }

      const histogram = ppoLine - (signalEma ?? 0);

      return {
        time: candle.time,
        value: { ppo: ppoLine, signal: signalEma, histogram },
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

      const ppoLine = ((fr.ema - sr.ema) / sr.ema) * 100;
      const peekValidCount = validPpoCount + 1;

      if (peekValidCount < signalPeriod) {
        return {
          time: candle.time,
          value: { ppo: ppoLine, signal: null, histogram: null },
        };
      }

      let peekSignal: number;
      if (peekValidCount === signalPeriod) {
        peekSignal = (signalSum + ppoLine) / signalPeriod;
      } else {
        peekSignal = ppoLine * signalMult + (signalEma ?? 0) * (1 - signalMult);
      }

      return {
        time: candle.time,
        value: { ppo: ppoLine, signal: peekSignal, histogram: ppoLine - peekSignal },
      };
    },

    getState(): IndicatorSnapshot<PpoState> {
      return makeSnapshot(
        "ppo",
        PPO_VERSION,
        { fastPeriod, slowPeriod, signalPeriod, source },
        {
          fastEma,
          slowEma,
          signalEma,
          fastSum,
          slowSum,
          signalSum,
          count,
          validPpoCount,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return validPpoCount >= signalPeriod;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
