/**
 * Incremental EMA (Exponential Moving Average)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type EmaState = {
  period: number;
  source: PriceSource;
  multiplier: number;
  prevEma: number | null;
  sum: number;
  count: number;
};

function getSourcePrice(candle: NormalizedCandle, source: PriceSource): number {
  switch (source) {
    case "open":
      return candle.open;
    case "high":
      return candle.high;
    case "low":
      return candle.low;
    case "close":
      return candle.close;
    case "hl2":
      return (candle.high + candle.low) / 2;
    case "hlc3":
      return (candle.high + candle.low + candle.close) / 3;
    case "ohlc4":
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    case "volume":
      return candle.volume;
    default:
      return candle.close;
  }
}

/**
 * Create an incremental EMA indicator
 *
 * @example
 * ```ts
 * const ema20 = createEma({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = ema20.next(candle);
 *   if (ema20.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createEma(
  options: { period: number; source?: PriceSource },
  warmUpOptions?: WarmUpOptions<EmaState>,
): IncrementalIndicator<number | null, EmaState> {
  const period = options.period;
  const source: PriceSource = options.source ?? "close";
  const multiplier = 2 / (period + 1);

  let prevEma: number | null;
  let sum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevEma = s.prevEma;
    sum = s.sum;
    count = s.count;
  } else {
    prevEma = null;
    sum = 0;
    count = 0;
  }

  function computeValue(price: number, currentCount: number): number | null {
    if (currentCount < period) {
      return null;
    }
    if (currentCount === period) {
      // First EMA = SMA of first 'period' values
      return (sum + price) / period;
    }
    // EMA = price * multiplier + prevEma * (1 - multiplier)
    return price * multiplier + prevEma! * (1 - multiplier);
  }

  const indicator: IncrementalIndicator<number | null, EmaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      if (count < period) {
        sum += price;
        prevEma = null;
        return { time: candle.time, value: null };
      }

      if (count === period) {
        sum += price;
        prevEma = sum / period;
        return { time: candle.time, value: prevEma };
      }

      // Standard EMA calculation
      prevEma = price * multiplier + prevEma! * (1 - multiplier);
      return { time: candle.time, value: prevEma };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const value = computeValue(price, count + 1);
      return { time: candle.time, value };
    },

    getState(): EmaState {
      return { period, source, multiplier, prevEma, sum, count };
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
