/**
 * Incremental Zigzag
 *
 * Emits a pivot (high or low) the moment a reversal of at least `deviation`
 * percent (or `atrMultiplier * ATR` if `useAtr: true`) is confirmed against
 * the running extreme of the current trend.
 *
 * Output time per `next(candle)` call:
 *  - when no pivot is confirmed, the current candle's time with a null value
 *  - when a pivot is confirmed, the original time of the extremum bar (so
 *    streamed output aligns with batch zigzag() output on pivot bars)
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import type { AtrState } from "../volatility/atr";
import { createAtr } from "../volatility/atr";

export type ZigzagValue = {
  point: "high" | "low" | null;
  price: number | null;
  changePercent: number | null;
};

export type ZigzagState = {
  deviation: number;
  useAtr: boolean;
  atrPeriod: number;
  atrMultiplier: number;
  trend: "up" | "down" | null;
  lastPivotPrice: number;
  currentHigh: number;
  currentHighTime: number;
  currentLow: number;
  currentLowTime: number;
  firstHigh: number;
  firstLow: number;
  count: number;
  maxInitBars: number;
  atrState: AtrState | null;
};

const nullValue: ZigzagValue = { point: null, price: null, changePercent: null };

/**
 * Create an incremental Zigzag indicator.
 *
 * @example
 * ```ts
 * const zz = createZigzag({ deviation: 5 });
 * for (const candle of stream) {
 *   const { time, value } = zz.next(candle);
 *   if (value.point) console.log(`Pivot ${value.point} at ${time}: ${value.price}`);
 * }
 * ```
 */
export function createZigzag(
  options: {
    deviation?: number;
    useAtr?: boolean;
    atrPeriod?: number;
    atrMultiplier?: number;
  } = {},
  warmUpOptions?: WarmUpOptions<ZigzagState>,
): IncrementalIndicator<ZigzagValue, ZigzagState> {
  const deviation = options.deviation ?? 5;
  const useAtr = options.useAtr ?? false;
  const atrPeriod = options.atrPeriod ?? 14;
  const atrMultiplier = options.atrMultiplier ?? 2;

  if (deviation <= 0) {
    throw new Error("Zigzag deviation must be positive");
  }

  const maxInitBars = Math.max(20, atrPeriod * 2);

  let trend: "up" | "down" | null;
  let lastPivotPrice: number;
  let currentHigh: number;
  let currentHighTime: number;
  let currentLow: number;
  let currentLowTime: number;
  let firstHigh: number;
  let firstLow: number;
  let count: number;
  let atr: IncrementalIndicator<number | null, AtrState> | null;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    trend = s.trend;
    lastPivotPrice = s.lastPivotPrice;
    currentHigh = s.currentHigh;
    currentHighTime = s.currentHighTime;
    currentLow = s.currentLow;
    currentLowTime = s.currentLowTime;
    firstHigh = s.firstHigh;
    firstLow = s.firstLow;
    count = s.count;
    atr = useAtr
      ? createAtr({ period: atrPeriod }, s.atrState ? { fromState: s.atrState } : undefined)
      : null;
  } else {
    trend = null;
    lastPivotPrice = 0;
    currentHigh = 0;
    currentHighTime = 0;
    currentLow = 0;
    currentLowTime = 0;
    firstHigh = 0;
    firstLow = 0;
    count = 0;
    atr = useAtr ? createAtr({ period: atrPeriod }) : null;
  }

  function currentThreshold(atrVal: number | null, anchorPrice: number): number {
    if (useAtr && atrVal !== null && atrVal > 0) return atrVal * atrMultiplier;
    return Math.abs(anchorPrice) * (deviation / 100);
  }

  const indicator: IncrementalIndicator<ZigzagValue, ZigzagState> = {
    next(candle: NormalizedCandle) {
      const atrVal = atr ? atr.next(candle).value : null;
      const isFirst = count === 0;
      count++;

      if (isFirst) {
        currentHigh = candle.high;
        currentHighTime = candle.time;
        currentLow = candle.low;
        currentLowTime = candle.time;
        firstHigh = candle.high;
        firstLow = candle.low;
        return { time: candle.time, value: { ...nullValue } };
      }

      const { high, low } = candle;

      if (trend === null) {
        if (high > currentHigh) {
          currentHigh = high;
          currentHighTime = candle.time;
        }
        if (low < currentLow) {
          currentLow = low;
          currentLowTime = candle.time;
        }

        const initAnchor = lastPivotPrice || currentHigh;
        const threshold = currentThreshold(atrVal, initAnchor);

        if (currentHigh - firstLow >= threshold) {
          trend = "up";
          lastPivotPrice = currentLow;
          return {
            time: currentLowTime,
            value: { point: "low", price: currentLow, changePercent: null },
          };
        }
        if (firstHigh - currentLow >= threshold) {
          trend = "down";
          lastPivotPrice = currentHigh;
          return {
            time: currentHighTime,
            value: { point: "high", price: currentHigh, changePercent: null },
          };
        }
        if (count >= maxInitBars) {
          const upRange = currentHigh - firstLow;
          const downRange = firstHigh - currentLow;
          if (upRange >= downRange) {
            trend = "up";
            lastPivotPrice = currentLow;
            return {
              time: currentLowTime,
              value: { point: "low", price: currentLow, changePercent: null },
            };
          }
          trend = "down";
          lastPivotPrice = currentHigh;
          return {
            time: currentHighTime,
            value: { point: "high", price: currentHigh, changePercent: null },
          };
        }
        return { time: candle.time, value: { ...nullValue } };
      }

      if (trend === "up") {
        if (high > currentHigh) {
          currentHigh = high;
          currentHighTime = candle.time;
        }
        const drop = currentHigh - low;
        const dropThreshold = currentThreshold(atrVal, currentHigh);
        if (drop >= dropThreshold) {
          const changePct =
            lastPivotPrice > 0 ? ((currentHigh - lastPivotPrice) / lastPivotPrice) * 100 : null;
          const pivotTime = currentHighTime;
          const pivotPrice = currentHigh;
          lastPivotPrice = currentHigh;
          trend = "down";
          currentLow = low;
          currentLowTime = candle.time;
          return {
            time: pivotTime,
            value: { point: "high", price: pivotPrice, changePercent: changePct },
          };
        }
        return { time: candle.time, value: { ...nullValue } };
      }

      // trend === "down"
      if (low < currentLow) {
        currentLow = low;
        currentLowTime = candle.time;
      }
      const rise = high - currentLow;
      const riseThreshold = currentThreshold(atrVal, currentLow);
      if (rise >= riseThreshold) {
        const changePct =
          lastPivotPrice > 0 ? ((currentLow - lastPivotPrice) / lastPivotPrice) * 100 : null;
        const pivotTime = currentLowTime;
        const pivotPrice = currentLow;
        lastPivotPrice = currentLow;
        trend = "up";
        currentHigh = high;
        currentHighTime = candle.time;
        return {
          time: pivotTime,
          value: { point: "low", price: pivotPrice, changePercent: changePct },
        };
      }
      return { time: candle.time, value: { ...nullValue } };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState();
      const result = indicator.next(candle);
      // restore
      trend = saved.trend;
      lastPivotPrice = saved.lastPivotPrice;
      currentHigh = saved.currentHigh;
      currentHighTime = saved.currentHighTime;
      currentLow = saved.currentLow;
      currentLowTime = saved.currentLowTime;
      firstHigh = saved.firstHigh;
      firstLow = saved.firstLow;
      count = saved.count;
      atr = useAtr
        ? createAtr(
            { period: atrPeriod },
            saved.atrState ? { fromState: saved.atrState } : undefined,
          )
        : null;
      return result;
    },

    getState(): ZigzagState {
      return {
        deviation,
        useAtr,
        atrPeriod,
        atrMultiplier,
        trend,
        lastPivotPrice,
        currentHigh,
        currentHighTime,
        currentLow,
        currentLowTime,
        firstHigh,
        firstLow,
        count,
        maxInitBars,
        atrState: atr ? atr.getState() : null,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return trend !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
