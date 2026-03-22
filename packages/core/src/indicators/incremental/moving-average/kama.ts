/**
 * Incremental KAMA (Kaufman Adaptive Moving Average)
 *
 * KAMA adapts smoothing speed based on Efficiency Ratio (ER).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type KamaState = {
  period: number;
  source: PriceSource;
  fastSC: number;
  slowSC: number;
  priceBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevKama: number | null;
  count: number;
};

/**
 * Create an incremental KAMA indicator
 *
 * @example
 * ```ts
 * const kama = createKama({ period: 10 });
 * for (const candle of stream) {
 *   const { value } = kama.next(candle);
 *   if (kama.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createKama(
  options: { period?: number; fastPeriod?: number; slowPeriod?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<KamaState>,
): IncrementalIndicator<number | null, KamaState> {
  const period = options.period ?? 10;
  const source: PriceSource = options.source ?? "close";
  const fastSC = 2 / ((options.fastPeriod ?? 2) + 1);
  const slowSC = 2 / ((options.slowPeriod ?? 30) + 1);

  // Need period+1 prices to compute direction and volatility
  let priceBuffer: CircularBuffer<number>;
  let prevKama: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    priceBuffer = CircularBuffer.fromSnapshot(s.priceBuffer);
    prevKama = s.prevKama;
    count = s.count;
  } else {
    priceBuffer = new CircularBuffer<number>(period + 1);
    prevKama = null;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, KamaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      priceBuffer.push(price);

      if (count < period) {
        return { time: candle.time, value: null };
      }

      if (count === period) {
        // Seed KAMA with close[period-1] (TA-Lib compatible)
        prevKama = price;
        return { time: candle.time, value: null };
      }

      // count > period: compute KAMA
      // Direction: |price - price[period ago]|
      const direction = Math.abs(price - priceBuffer.get(0));

      // Volatility: sum of |price[i] - price[i-1]| for period bars
      let volatility = 0;
      for (let i = 1; i < priceBuffer.length; i++) {
        volatility += Math.abs(priceBuffer.get(i) - priceBuffer.get(i - 1));
      }

      const er = volatility === 0 ? 0 : direction / volatility;
      const sc = (er * (fastSC - slowSC) + slowSC) ** 2;

      const prev = prevKama ?? 0;
      prevKama = prev + sc * (price - prev);

      return { time: candle.time, value: prevKama };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      if (peekCount <= period) {
        return { time: candle.time, value: null };
      }

      // After push, the oldest element would be at index 1 if full, else 0
      const startIdx = priceBuffer.isFull ? 1 : 0;

      // Direction: |price - oldest price after simulated push|
      const direction = Math.abs(price - priceBuffer.get(startIdx));

      // Volatility: sum of |price[i] - price[i-1]| for the window, with new price appended
      let volatility = 0;
      let prevPrice = priceBuffer.get(startIdx);
      for (let i = startIdx + 1; i < priceBuffer.length; i++) {
        volatility += Math.abs(priceBuffer.get(i) - prevPrice);
        prevPrice = priceBuffer.get(i);
      }
      volatility += Math.abs(price - prevPrice);

      const er = volatility === 0 ? 0 : direction / volatility;
      const sc = (er * (fastSC - slowSC) + slowSC) ** 2;

      const prev = prevKama ?? 0;
      return { time: candle.time, value: prev + sc * (price - prev) };
    },

    getState(): KamaState {
      return {
        period,
        source,
        fastSC,
        slowSC,
        priceBuffer: priceBuffer.snapshot(),
        prevKama,
        count,
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
