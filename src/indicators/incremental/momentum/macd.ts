/**
 * Incremental MACD (Moving Average Convergence Divergence)
 *
 * Composite indicator using three EMA layers: fast, slow, signal.
 */

import type { MacdValue, NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type MacdState = {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
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
  validMacdCount: number;
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
  options: { fastPeriod?: number; slowPeriod?: number; signalPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<MacdState>,
): IncrementalIndicator<MacdValue, MacdState> {
  const fastPeriod = options.fastPeriod ?? 12;
  const slowPeriod = options.slowPeriod ?? 26;
  const signalPeriod = options.signalPeriod ?? 9;
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

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    fastEma = s.fastEma;
    slowEma = s.slowEma;
    signalEma = s.signalEma;
    fastSum = s.fastSum;
    slowSum = s.slowSum;
    signalSum = s.signalSum;
    count = s.count;
    validMacdCount = s.validMacdCount;
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
    return { ema: price * mult + (prevEma as number) * (1 - mult), sum };
  }

  const indicator: IncrementalIndicator<MacdValue, MacdState> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = candle.close;

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
        signalEma = macdLine * signalMult + (signalEma as number) * (1 - signalMult);
      }

      const histogram = macdLine - (signalEma as number);

      return {
        time: candle.time,
        value: { macd: macdLine, signal: signalEma, histogram },
      };
    },

    peek(candle: NormalizedCandle) {
      const price = candle.close;
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
        peekSignal = macdLine * signalMult + (signalEma as number) * (1 - signalMult);
      }

      return {
        time: candle.time,
        value: { macd: macdLine, signal: peekSignal, histogram: macdLine - peekSignal },
      };
    },

    getState(): MacdState {
      return {
        fastPeriod,
        slowPeriod,
        signalPeriod,
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
        validMacdCount,
      };
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
