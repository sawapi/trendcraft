/**
 * Incremental VWMA (Volume Weighted Moving Average)
 *
 * VWMA = Sum(Price * Volume, n) / Sum(Volume, n)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type VwmaState = {
  period: number;
  source: PriceSource;
  pvBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  volBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sumPV: number;
  sumV: number;
  count: number;
};

/**
 * Create an incremental VWMA indicator
 *
 * @example
 * ```ts
 * const vwma20 = createVwma({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = vwma20.next(candle);
 *   if (vwma20.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createVwma(
  options: { period: number; source?: PriceSource },
  warmUpOptions?: WarmUpOptions<VwmaState>,
): IncrementalIndicator<number | null, VwmaState> {
  const period = options.period;
  const source: PriceSource = options.source ?? "close";

  let pvBuffer: CircularBuffer<number>;
  let volBuffer: CircularBuffer<number>;
  let sumPV: number;
  let sumV: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    pvBuffer = CircularBuffer.fromSnapshot(s.pvBuffer);
    volBuffer = CircularBuffer.fromSnapshot(s.volBuffer);
    sumPV = s.sumPV;
    sumV = s.sumV;
    count = s.count;
  } else {
    pvBuffer = new CircularBuffer<number>(period);
    volBuffer = new CircularBuffer<number>(period);
    sumPV = 0;
    sumV = 0;
    count = 0;
  }

  function computeValue(pv: number, vol: number): number | null {
    if (count + 1 < period) return null;
    let newSumPV = sumPV + pv;
    let newSumV = sumV + vol;
    if (pvBuffer.isFull) {
      newSumPV -= pvBuffer.oldest();
      newSumV -= volBuffer.oldest();
    }
    return newSumV === 0 ? null : newSumPV / newSumV;
  }

  const indicator: IncrementalIndicator<number | null, VwmaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const vol = candle.volume;
      const pv = price * vol;
      count++;

      if (pvBuffer.isFull) {
        sumPV -= pvBuffer.oldest();
        sumV -= volBuffer.oldest();
      }

      sumPV += pv;
      sumV += vol;
      pvBuffer.push(pv);
      volBuffer.push(vol);

      if (count < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: sumV === 0 ? null : sumPV / sumV };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const vol = candle.volume;
      const pv = price * vol;
      return { time: candle.time, value: computeValue(pv, vol) };
    },

    getState(): VwmaState {
      return {
        period,
        source,
        pvBuffer: pvBuffer.snapshot(),
        volBuffer: volBuffer.snapshot(),
        sumPV,
        sumV,
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
