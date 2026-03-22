/**
 * Incremental ATR (Average True Range)
 *
 * Uses Wilder's smoothing method for consistency with batch implementation.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type AtrState = {
  period: number;
  prevClose: number | null;
  atr: number | null;
  trSum: number;
  count: number;
};

/**
 * Create an incremental ATR indicator (Wilder's method)
 *
 * @example
 * ```ts
 * const atr14 = createAtr({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = atr14.next(candle);
 *   if (atr14.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createAtr(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<AtrState>,
): IncrementalIndicator<number | null, AtrState> {
  const period = options.period ?? 14;

  let prevClose: number | null;
  let atrValue: number | null;
  let trSum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevClose = s.prevClose;
    atrValue = s.atr;
    trSum = s.trSum;
    count = s.count;
  } else {
    prevClose = null;
    atrValue = null;
    trSum = 0;
    count = 0;
  }

  function calculateTR(candle: NormalizedCandle, pc: number): number {
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - pc),
      Math.abs(candle.low - pc),
    );
  }

  const indicator: IncrementalIndicator<number | null, AtrState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        // First candle: no TR (TR[0] = 0 in TA-Lib convention)
        prevClose = candle.close;
        return { time: candle.time, value: null };
      }

      const tr = calculateTR(candle, prevClose);
      prevClose = candle.close;

      // count=1 was the first candle (no TR), count=2..period: accumulate TR
      // First ATR at count = period + 1 (index = period in 0-based)
      if (count <= period) {
        trSum += tr;
        return { time: candle.time, value: null };
      }

      if (count === period + 1) {
        // First ATR = simple average of TR[1..period]
        trSum += tr;
        atrValue = trSum / period;
        return { time: candle.time, value: atrValue };
      }

      // Wilder's smoothing: ((prevATR * (period - 1)) + currentTR) / period
      atrValue = ((atrValue ?? 0) * (period - 1) + tr) / period;
      return { time: candle.time, value: atrValue };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null || count < period) {
        return { time: candle.time, value: null };
      }

      const tr = calculateTR(candle, prevClose);

      if (count === period) {
        const peekAtr = (trSum + tr) / period;
        return { time: candle.time, value: peekAtr };
      }

      const peekAtr = ((atrValue ?? 0) * (period - 1) + tr) / period;
      return { time: candle.time, value: peekAtr };
    },

    getState(): AtrState {
      return { period, prevClose, atr: atrValue, trSum, count };
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
