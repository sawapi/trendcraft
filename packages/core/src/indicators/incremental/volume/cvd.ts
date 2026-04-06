/**
 * Incremental CVD (Cumulative Volume Delta)
 *
 * Estimates buying and selling pressure from OHLCV data.
 * buyVol = volume * (close - low) / (high - low)
 * sellVol = volume - buyVol
 * delta = buyVol - sellVol
 * CVD = cumulative sum of delta
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type CvdState = {
  cumDelta: number;
  count: number;
};

/**
 * Create an incremental CVD indicator
 *
 * @example
 * ```ts
 * const cvd = createCvd();
 * for (const candle of stream) {
 *   const { value } = cvd.next(candle);
 *   console.log(value);
 * }
 * ```
 */
export function createCvd(
  warmUpOptions?: WarmUpOptions<CvdState>,
): IncrementalIndicator<number, CvdState> {
  let cumDelta: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    cumDelta = s.cumDelta;
    count = s.count;
  } else {
    cumDelta = 0;
    count = 0;
  }

  function computeDelta(candle: NormalizedCandle): number {
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    const buyVol = (candle.volume * (candle.close - candle.low)) / range;
    const sellVol = candle.volume - buyVol;
    return buyVol - sellVol;
  }

  const indicator: IncrementalIndicator<number, CvdState> = {
    next(candle: NormalizedCandle) {
      count++;
      cumDelta += computeDelta(candle);
      return { time: candle.time, value: cumDelta };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: cumDelta + computeDelta(candle) };
    },

    getState(): CvdState {
      return { cumDelta, count };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 1;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
