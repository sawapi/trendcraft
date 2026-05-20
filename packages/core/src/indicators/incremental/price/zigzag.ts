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
 *
 * State category: **Mixed** (a recursive trend / running-extreme
 * tracker composed with an inner recursive ATR snapshot). Every param
 * (`deviation`, `useAtr`, `atrPeriod`, `atrMultiplier`) affects either
 * the pivot-trigger threshold or the inner ATR, so resuming with any
 * changed is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import type { AtrState } from "../volatility/atr";
import { createAtr } from "../volatility/atr";

export type ZigzagValue = {
  point: "high" | "low" | null;
  price: number | null;
  changePercent: number | null;
};

/**
 * Bare state shape for Zigzag. Params (`deviation`, `useAtr`,
 * `atrPeriod`, `atrMultiplier`) live in `meta.params`; the derived
 * `maxInitBars` is recomputed in the factory. The inner ATR snapshot
 * is itself an `IndicatorSnapshot` (or `null` when `useAtr` is false).
 */
export type ZigzagState = {
  trend: "up" | "down" | null;
  lastPivotPrice: number;
  currentHigh: number;
  currentHighTime: number;
  currentLow: number;
  currentLowTime: number;
  firstHigh: number;
  firstLow: number;
  count: number;
  atrState: IndicatorSnapshot<AtrState> | null;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ZIGZAG_VERSION = 1;

type ZigzagParams = {
  deviation: number;
  useAtr: boolean;
  atrPeriod: number;
  atrMultiplier: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ZigzagState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<ZigzagValue, IndicatorSnapshot<ZigzagState>> {
  const { params, state } = resolveResume<ZigzagParams, ZigzagState>({
    indicator: "zigzag",
    version: ZIGZAG_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { deviation: 5, useAtr: false, atrPeriod: 14, atrMultiplier: 2 },
  });

  const deviation = requireParam(
    "zigzag",
    params,
    "deviation",
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
    "must be a positive number",
  );
  const useAtr = params.useAtr;
  const atrPeriod = params.atrPeriod;
  const atrMultiplier = params.atrMultiplier;

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
  let atr: IncrementalIndicator<number | null, IndicatorSnapshot<AtrState>> | null;

  if (state !== null) {
    trend = state.trend;
    lastPivotPrice = state.lastPivotPrice;
    currentHigh = state.currentHigh;
    currentHighTime = state.currentHighTime;
    currentLow = state.currentLow;
    currentLowTime = state.currentLowTime;
    firstHigh = state.firstHigh;
    firstLow = state.firstLow;
    count = state.count;
    atr = useAtr
      ? createAtr({ period: atrPeriod }, state.atrState ? { fromState: state.atrState } : undefined)
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

  const indicator: IncrementalIndicator<ZigzagValue, IndicatorSnapshot<ZigzagState>> = {
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
      const saved = indicator.getState().state;
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

    getState(): IndicatorSnapshot<ZigzagState> {
      return makeSnapshot(
        "zigzag",
        ZIGZAG_VERSION,
        { deviation, useAtr, atrPeriod, atrMultiplier },
        {
          trend,
          lastPivotPrice,
          currentHigh,
          currentHighTime,
          currentLow,
          currentLowTime,
          firstHigh,
          firstLow,
          count,
          atrState: atr ? atr.getState() : null,
        },
      );
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
