/**
 * Incremental IMI (Intraday Momentum Index)
 *
 * IMI = 100 × SUM(gains, n) / (SUM(gains, n) + SUM(losses, n))
 * Uses simple rolling sums with a circular buffer window.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type ImiState = {
  period: number;
  gainsBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lossesBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sumGain: number;
  sumLoss: number;
  count: number;
};

/**
 * Create an incremental IMI indicator
 *
 * @example
 * ```ts
 * const imi = createImi({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = imi.next(candle);
 *   if (imi.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createImi(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<ImiState>,
): IncrementalIndicator<number | null, ImiState> {
  const period = options.period ?? 14;

  let gainsBuffer: CircularBuffer<number>;
  let lossesBuffer: CircularBuffer<number>;
  let sumGain: number;
  let sumLoss: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    gainsBuffer = CircularBuffer.fromSnapshot(s.gainsBuffer);
    lossesBuffer = CircularBuffer.fromSnapshot(s.lossesBuffer);
    sumGain = s.sumGain;
    sumLoss = s.sumLoss;
    count = s.count;
  } else {
    gainsBuffer = new CircularBuffer<number>(period);
    lossesBuffer = new CircularBuffer<number>(period);
    sumGain = 0;
    sumLoss = 0;
    count = 0;
  }

  function computeImi(sg: number, sl: number): number {
    const total = sg + sl;
    return total === 0 ? 50 : (100 * sg) / total;
  }

  const indicator: IncrementalIndicator<number | null, ImiState> = {
    next(candle: NormalizedCandle) {
      count++;

      const gain = candle.close > candle.open ? candle.close - candle.open : 0;
      const loss = candle.open > candle.close ? candle.open - candle.close : 0;

      // Remove oldest value if buffer is full
      if (gainsBuffer.isFull) {
        sumGain -= gainsBuffer.oldest();
        sumLoss -= lossesBuffer.oldest();
      }

      sumGain += gain;
      sumLoss += loss;
      gainsBuffer.push(gain);
      lossesBuffer.push(loss);

      if (count < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeImi(sumGain, sumLoss) };
    },

    peek(candle: NormalizedCandle) {
      if (count + 1 < period) {
        return { time: candle.time, value: null };
      }

      const gain = candle.close > candle.open ? candle.close - candle.open : 0;
      const loss = candle.open > candle.close ? candle.open - candle.close : 0;

      let peekSumGain = sumGain + gain;
      let peekSumLoss = sumLoss + loss;

      if (gainsBuffer.isFull) {
        peekSumGain -= gainsBuffer.oldest();
        peekSumLoss -= lossesBuffer.oldest();
      }

      return { time: candle.time, value: computeImi(peekSumGain, peekSumLoss) };
    },

    getState(): ImiState {
      return {
        period,
        gainsBuffer: gainsBuffer.snapshot(),
        lossesBuffer: lossesBuffer.snapshot(),
        sumGain,
        sumLoss,
        count,
      };
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
