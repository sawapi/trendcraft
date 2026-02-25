/**
 * Incremental RSI (Relative Strength Index)
 *
 * Uses Wilder's smoothing method for consistency with batch implementation.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type RsiState = {
  period: number;
  prevClose: number | null;
  avgGain: number;
  avgLoss: number;
  count: number;
  initialGains: number[];
  initialLosses: number[];
};

/**
 * Create an incremental RSI indicator (Wilder's method)
 *
 * @example
 * ```ts
 * const rsi14 = createRsi({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = rsi14.next(candle);
 *   if (rsi14.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createRsi(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<RsiState>,
): IncrementalIndicator<number | null, RsiState> {
  const period = options.period ?? 14;

  let prevClose: number | null;
  let avgGain: number;
  let avgLoss: number;
  let count: number;
  let initialGains: number[];
  let initialLosses: number[];

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevClose = s.prevClose;
    avgGain = s.avgGain;
    avgLoss = s.avgLoss;
    count = s.count;
    initialGains = [...s.initialGains];
    initialLosses = [...s.initialLosses];
  } else {
    prevClose = null;
    avgGain = 0;
    avgLoss = 0;
    count = 0;
    initialGains = [];
    initialLosses = [];
  }

  function computeRsi(ag: number, al: number): number | null {
    if (al === 0 && ag === 0) return 50;
    if (al === 0) return 100;
    const rs = ag / al;
    return 100 - 100 / (1 + rs);
  }

  const indicator: IncrementalIndicator<number | null, RsiState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevClose === null) {
        // First candle: no change to compute
        prevClose = candle.close;
        return { time: candle.time, value: null };
      }

      const change = candle.close - prevClose;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      prevClose = candle.close;

      // count includes current candle. We need period+1 candles to produce first RSI.
      // Candle 1: no change (null), candles 2..period: collect gains/losses, candle period+1: first RSI

      if (count <= period) {
        // Still in initial collection phase (indices 1..period-1 of changes)
        initialGains.push(gain);
        initialLosses.push(loss);
        return { time: candle.time, value: null };
      }

      if (count === period + 1) {
        // First RSI value: simple average of first 'period' gains/losses
        // initialGains/Losses has period-1 values, plus the current one
        initialGains.push(gain);
        initialLosses.push(loss);

        avgGain = initialGains.reduce((s, v) => s + v, 0) / period;
        avgLoss = initialLosses.reduce((s, v) => s + v, 0) / period;

        // Free memory
        initialGains = [];
        initialLosses = [];

        return { time: candle.time, value: computeRsi(avgGain, avgLoss) };
      }

      // Wilder's smoothing: ((prev * (period - 1)) + current) / period
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      return { time: candle.time, value: computeRsi(avgGain, avgLoss) };
    },

    peek(candle: NormalizedCandle) {
      if (prevClose === null || count < period) {
        return { time: candle.time, value: null };
      }

      const change = candle.close - prevClose;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      if (count === period) {
        // Would be the first RSI value
        const gains = [...initialGains, gain];
        const losses = [...initialLosses, loss];
        const ag = gains.reduce((s, v) => s + v, 0) / period;
        const al = losses.reduce((s, v) => s + v, 0) / period;
        return { time: candle.time, value: computeRsi(ag, al) };
      }

      const peekAvgGain = (avgGain * (period - 1) + gain) / period;
      const peekAvgLoss = (avgLoss * (period - 1) + loss) / period;
      return { time: candle.time, value: computeRsi(peekAvgGain, peekAvgLoss) };
    },

    getState(): RsiState {
      return { period, prevClose, avgGain, avgLoss, count, initialGains: [...initialGains], initialLosses: [...initialLosses] };
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
