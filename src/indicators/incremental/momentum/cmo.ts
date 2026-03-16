/**
 * Incremental CMO (Chande Momentum Oscillator)
 *
 * CMO = 100 × (AvgGain - AvgLoss) / (AvgGain + AvgLoss)
 * Uses Wilder's smoothing method (same as RSI).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type CmoState = {
  period: number;
  source: PriceSource;
  prevClose: number | null;
  avgUp: number;
  avgDown: number;
  count: number;
  initialUps: number[];
  initialDowns: number[];
};

/**
 * Create an incremental CMO indicator
 *
 * @example
 * ```ts
 * const cmo = createCmo({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = cmo.next(candle);
 *   if (cmo.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createCmo(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<CmoState>,
): IncrementalIndicator<number | null, CmoState> {
  const period = options.period ?? 14;
  const source: PriceSource = options.source ?? "close";

  let prevClose: number | null;
  let avgUp: number;
  let avgDown: number;
  let count: number;
  let initialUps: number[];
  let initialDowns: number[];

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevClose = s.prevClose;
    avgUp = s.avgUp;
    avgDown = s.avgDown;
    count = s.count;
    initialUps = [...s.initialUps];
    initialDowns = [...s.initialDowns];
  } else {
    prevClose = null;
    avgUp = 0;
    avgDown = 0;
    count = 0;
    initialUps = [];
    initialDowns = [];
  }

  function computeCmo(au: number, ad: number): number {
    const total = au + ad;
    return total === 0 ? 0 : (100 * (au - ad)) / total;
  }

  const indicator: IncrementalIndicator<number | null, CmoState> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      if (prevClose === null) {
        prevClose = price;
        return { time: candle.time, value: null };
      }

      const diff = price - prevClose;
      const up = diff > 0 ? diff : 0;
      const down = diff < 0 ? -diff : 0;
      prevClose = price;

      // count includes current candle. Need period+1 candles for first value.
      if (count <= period) {
        initialUps.push(up);
        initialDowns.push(down);
        return { time: candle.time, value: null };
      }

      if (count === period + 1) {
        initialUps.push(up);
        initialDowns.push(down);
        avgUp = initialUps.reduce((s, v) => s + v, 0) / period;
        avgDown = initialDowns.reduce((s, v) => s + v, 0) / period;
        initialUps = [];
        initialDowns = [];
        return { time: candle.time, value: computeCmo(avgUp, avgDown) };
      }

      // Wilder's smoothing
      avgUp = (avgUp * (period - 1) + up) / period;
      avgDown = (avgDown * (period - 1) + down) / period;

      return { time: candle.time, value: computeCmo(avgUp, avgDown) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (prevClose === null || count < period) {
        return { time: candle.time, value: null };
      }

      const diff = price - prevClose;
      const up = diff > 0 ? diff : 0;
      const down = diff < 0 ? -diff : 0;

      if (count === period) {
        const ups = [...initialUps, up];
        const downs = [...initialDowns, down];
        const au = ups.reduce((s, v) => s + v, 0) / period;
        const ad = downs.reduce((s, v) => s + v, 0) / period;
        return { time: candle.time, value: computeCmo(au, ad) };
      }

      const peekAvgUp = (avgUp * (period - 1) + up) / period;
      const peekAvgDown = (avgDown * (period - 1) + down) / period;

      return { time: candle.time, value: computeCmo(peekAvgUp, peekAvgDown) };
    },

    getState(): CmoState {
      return {
        period,
        source,
        prevClose,
        avgUp,
        avgDown,
        count,
        initialUps: [...initialUps],
        initialDowns: [...initialDowns],
      };
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
