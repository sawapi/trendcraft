/**
 * Incremental Auto Trend Line.
 *
 * Wraps `createSwingPoints` and tracks the last 2 confirmed swing highs +
 * last 2 confirmed swing lows. Resistance slope/anchor are derived from the
 * pair of swing highs, support from the pair of swing lows. Output projects
 * each line at the current bar.
 *
 * Parity note (same shifted-parity property as Channel Line / Fib): batch
 * uses look-ahead via batch `swingPoints`, while live confirms swings with
 * `rightBars` delay. `hasResistance / hasSupport` and the underlying slope/
 * anchor at step `t` agree with `batch[t - rightBars]`. Raw `resistance /
 * support` cannot be compared bar-by-bar across the shift because each side
 * projects at a different bar.
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { cloneShallow, pushBounded, validateSwingConfig } from "./swing-helpers";
import { createSwingPoints, type SwingPointsState } from "./swing-points";

export type AutoTrendLineValue = {
  /** Resistance line value at the current bar, null before enough data */
  resistance: number | null;
  /** Support line value at the current bar, null before enough data */
  support: number | null;
};

export type AutoTrendLineOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
};

type SwingPoint = {
  index: number;
  price: number;
};

/**
 * Bare state shape for Auto Trend Line. Params (`leftBars`,
 * `rightBars`) live in `meta.params`; the inner swing-points snapshot
 * is itself an `IndicatorSnapshot`.
 */
export type AutoTrendLineState = {
  swings: IndicatorSnapshot<SwingPointsState>;
  lastTwoHighs: SwingPoint[];
  lastTwoLows: SwingPoint[];
  hasResistance: boolean;
  resSlope: number;
  resAnchorIdx: number;
  resAnchorPrice: number;
  hasSupport: boolean;
  supSlope: number;
  supAnchorIdx: number;
  supAnchorPrice: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const AUTO_TREND_LINE_VERSION = 1;

type AutoTrendLineParams = {
  leftBars: number;
  rightBars: number;
};

export function createAutoTrendLine(
  options: AutoTrendLineOptions = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AutoTrendLineState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<AutoTrendLineValue, IndicatorSnapshot<AutoTrendLineState>> {
  const { params, state } = resolveResume<AutoTrendLineParams, AutoTrendLineState>({
    indicator: "autoTrendLine",
    version: AUTO_TREND_LINE_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { leftBars: 10, rightBars: 10 },
  });
  const { leftBars, rightBars } = validateSwingConfig(params.leftBars, params.rightBars);

  let swings: ReturnType<typeof createSwingPoints>;
  let lastTwoHighs: SwingPoint[];
  let lastTwoLows: SwingPoint[];
  let hasResistance: boolean;
  let resSlope: number;
  let resAnchorIdx: number;
  let resAnchorPrice: number;
  let hasSupport: boolean;
  let supSlope: number;
  let supAnchorIdx: number;
  let supAnchorPrice: number;
  let count: number;

  if (state !== null) {
    swings = createSwingPoints({ leftBars, rightBars }, { fromState: state.swings });
    lastTwoHighs = cloneShallow(state.lastTwoHighs);
    lastTwoLows = cloneShallow(state.lastTwoLows);
    hasResistance = state.hasResistance;
    resSlope = state.resSlope;
    resAnchorIdx = state.resAnchorIdx;
    resAnchorPrice = state.resAnchorPrice;
    hasSupport = state.hasSupport;
    supSlope = state.supSlope;
    supAnchorIdx = state.supAnchorIdx;
    supAnchorPrice = state.supAnchorPrice;
    count = state.count;
  } else {
    swings = createSwingPoints({ leftBars, rightBars });
    lastTwoHighs = [];
    lastTwoLows = [];
    hasResistance = false;
    resSlope = 0;
    resAnchorIdx = 0;
    resAnchorPrice = 0;
    hasSupport = false;
    supSlope = 0;
    supAnchorIdx = 0;
    supAnchorPrice = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<
    AutoTrendLineValue,
    IndicatorSnapshot<AutoTrendLineState>
  > = {
    next(candle: NormalizedCandle) {
      count++;
      const swingResult = swings.next(candle);
      const sv = swingResult.value;
      const confirmedIdx = count - 1 - rightBars;

      if (sv.isSwingHigh && sv.swingHighPrice !== null && confirmedIdx >= 0) {
        pushBounded(lastTwoHighs, { index: confirmedIdx, price: sv.swingHighPrice }, 2);
        if (lastTwoHighs.length === 2) {
          const p1 = lastTwoHighs[0];
          const p2 = lastTwoHighs[1];
          resSlope = (p2.price - p1.price) / (p2.index - p1.index);
          resAnchorIdx = p1.index;
          resAnchorPrice = p1.price;
          hasResistance = true;
        }
      }

      if (sv.isSwingLow && sv.swingLowPrice !== null && confirmedIdx >= 0) {
        pushBounded(lastTwoLows, { index: confirmedIdx, price: sv.swingLowPrice }, 2);
        if (lastTwoLows.length === 2) {
          const p1 = lastTwoLows[0];
          const p2 = lastTwoLows[1];
          supSlope = (p2.price - p1.price) / (p2.index - p1.index);
          supAnchorIdx = p1.index;
          supAnchorPrice = p1.price;
          hasSupport = true;
        }
      }

      const barIdx = count - 1;
      const resistance =
        hasResistance && barIdx >= resAnchorIdx
          ? resAnchorPrice + resSlope * (barIdx - resAnchorIdx)
          : null;
      const support =
        hasSupport && barIdx >= supAnchorIdx
          ? supAnchorPrice + supSlope * (barIdx - supAnchorIdx)
          : null;

      return {
        time: candle.time,
        value: { resistance, support },
      };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState().state;
      const result = indicator.next(candle);
      swings = createSwingPoints({ leftBars, rightBars }, { fromState: saved.swings });
      lastTwoHighs = cloneShallow(saved.lastTwoHighs);
      lastTwoLows = cloneShallow(saved.lastTwoLows);
      hasResistance = saved.hasResistance;
      resSlope = saved.resSlope;
      resAnchorIdx = saved.resAnchorIdx;
      resAnchorPrice = saved.resAnchorPrice;
      hasSupport = saved.hasSupport;
      supSlope = saved.supSlope;
      supAnchorIdx = saved.supAnchorIdx;
      supAnchorPrice = saved.supAnchorPrice;
      count = saved.count;
      return result;
    },

    getState(): IndicatorSnapshot<AutoTrendLineState> {
      return makeSnapshot(
        "autoTrendLine",
        AUTO_TREND_LINE_VERSION,
        { leftBars, rightBars },
        {
          swings: swings.getState(),
          lastTwoHighs: cloneShallow(lastTwoHighs),
          lastTwoLows: cloneShallow(lastTwoLows),
          hasResistance,
          resSlope,
          resAnchorIdx,
          resAnchorPrice,
          hasSupport,
          supSlope,
          supAnchorIdx,
          supAnchorPrice,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return swings.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
