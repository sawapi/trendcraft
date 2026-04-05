/**
 * Incremental PPO (Percentage Price Oscillator)
 *
 * PPO = ((fastEMA - slowEMA) / slowEMA) * 100
 * Signal = EMA(PPO, signalPeriod)
 * Histogram = PPO - Signal
 *
 * Similar to MACD but expressed as a percentage, making it comparable across instruments.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type PpoValue = {
  ppo: number;
  signal: number | null;
  histogram: number | null;
};

export type PpoState = {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  source: PriceSource;
  fastEma: number | null;
  slowEma: number | null;
  signalEma: number | null;
  fastSum: number;
  slowSum: number;
  signalSum: number;
  fastMult: number;
  slowMult: number;
  signalMult: number;
  count: number;
  validPpoCount: number;
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
  warmUpOptions?: WarmUpOptions<PpoState>,
): IncrementalIndicator<PpoValue | null, PpoState> {
  const fastPeriod = options.fastPeriod ?? 12;
  const slowPeriod = options.slowPeriod ?? 26;
  const signalPeriod = options.signalPeriod ?? 9;
  const source: PriceSource = options.source ?? "close";
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

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    fastEma = s.fastEma;
    slowEma = s.slowEma;
    signalEma = s.signalEma;
    fastSum = s.fastSum;
    slowSum = s.slowSum;
    signalSum = s.signalSum;
    count = s.count;
    validPpoCount = s.validPpoCount;
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

  const indicator: IncrementalIndicator<PpoValue | null, PpoState> = {
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

    getState(): PpoState {
      return {
        fastPeriod,
        slowPeriod,
        signalPeriod,
        source,
        fastEma,
        slowEma,
        signalEma,
        fastSum,
        slowSum,
        signalSum,
        fastMult,
        slowMult,
        signalMult,
        count,
        validPpoCount,
      };
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
