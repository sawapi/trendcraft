/**
 * Incremental Fibonacci Retracement.
 *
 * Wraps `createSwingPoints` to track the most recent confirmed swing high and
 * swing low and computes retracement level prices on every bar. Output shape
 * matches the batch `fibonacciRetracement` so downstream consumers
 * (e.g. `addAutoFibRetracement` to convert anchors → `FibRetracementDrawing`)
 * see the same fields.
 *
 * Parity note
 * -----------
 * The batch `fibonacciRetracement` uses look-ahead via batch `swingPoints` —
 * at iteration `i` it consults `swings[i].isSwingHigh`, which itself peeks
 * `rightBars` bars into the future. Live cannot do that: a swing at bar `j`
 * is only confirmed at step `j + rightBars`. As a result, this implementation
 * lags batch by `rightBars` bars in the moment a freshly-formed swing becomes
 * visible. Once both sides have processed the same data, the tracked
 * `swingHigh` / `swingLow` and computed `levels` agree (shifted parity:
 * `live.next(c_t).value` matches `batch[t - rightBars].value`).
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { resolveLevels, validateSwingConfig } from "./swing-helpers";
import { createSwingPoints, type SwingPointsState } from "./swing-points";

export type FibonacciRetracementValue = {
  /** Fibonacci levels mapped by ratio string to price value, null if not enough data */
  levels: Record<string, number> | null;
  /** Price of the swing high used for calculation */
  swingHigh: number | null;
  /** Price of the swing low used for calculation */
  swingLow: number | null;
  /** Trend direction: "up" if swing high is more recent, "down" if swing low is more recent */
  trend: "up" | "down" | null;
};

export type FibonacciRetracementOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
  /** Fibonacci ratio levels to calculate (default: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]) */
  levels?: number[];
};

/**
 * Bare state shape for Fibonacci Retracement. Params (`leftBars`,
 * `rightBars`, `levels`) live in `meta.params`; the inner swing-points
 * snapshot is itself an `IndicatorSnapshot`.
 */
export type FibonacciRetracementState = {
  swings: IndicatorSnapshot<SwingPointsState>;
  lastSwingHighPrice: number | null;
  lastSwingHighIdx: number | null;
  lastSwingLowPrice: number | null;
  lastSwingLowIdx: number | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const FIBONACCI_RETRACEMENT_VERSION = 1;

const DEFAULT_LEVELS: readonly number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

type FibonacciRetracementParams = {
  leftBars: number;
  rightBars: number;
  levels: number[];
};

export function createFibonacciRetracement(
  options: FibonacciRetracementOptions = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<FibonacciRetracementState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<FibonacciRetracementValue, IndicatorSnapshot<FibonacciRetracementState>> {
  const { params, state } = resolveResume<FibonacciRetracementParams, FibonacciRetracementState>({
    indicator: "fibonacciRetracement",
    version: FIBONACCI_RETRACEMENT_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { leftBars: 10, rightBars: 10, levels: DEFAULT_LEVELS.slice() },
  });
  const { leftBars, rightBars } = validateSwingConfig(params.leftBars, params.rightBars);
  const { levels, ratioKeys } = resolveLevels(params.levels);

  let swings: ReturnType<typeof createSwingPoints>;
  let lastSwingHighPrice: number | null;
  let lastSwingHighIdx: number | null;
  let lastSwingLowPrice: number | null;
  let lastSwingLowIdx: number | null;
  let count: number;

  // Cached output. Rebuilt only when the swing state changes; otherwise the
  // same object is returned across bars to avoid allocating an identical
  // levels record per call. The IncrementalIndicator contract returns a
  // fresh `{ time, value }` envelope but the inner `value` may be shared.
  let cached: FibonacciRetracementValue | null = null;
  let cachedHighIdx: number | null = null;
  let cachedLowIdx: number | null = null;

  if (state !== null) {
    swings = createSwingPoints({ leftBars, rightBars }, { fromState: state.swings });
    lastSwingHighPrice = state.lastSwingHighPrice;
    lastSwingHighIdx = state.lastSwingHighIdx;
    lastSwingLowPrice = state.lastSwingLowPrice;
    lastSwingLowIdx = state.lastSwingLowIdx;
    count = state.count;
  } else {
    swings = createSwingPoints({ leftBars, rightBars });
    lastSwingHighPrice = null;
    lastSwingHighIdx = null;
    lastSwingLowPrice = null;
    lastSwingLowIdx = null;
    count = 0;
  }

  function computeOutput(): FibonacciRetracementValue {
    if (cached !== null && cachedHighIdx === lastSwingHighIdx && cachedLowIdx === lastSwingLowIdx) {
      return cached;
    }
    let value: FibonacciRetracementValue;
    if (
      lastSwingHighPrice === null ||
      lastSwingLowPrice === null ||
      lastSwingHighIdx === null ||
      lastSwingLowIdx === null
    ) {
      value = {
        levels: null,
        swingHigh: lastSwingHighPrice,
        swingLow: lastSwingLowPrice,
        trend: null,
      };
    } else {
      const trend: "up" | "down" = lastSwingHighIdx > lastSwingLowIdx ? "up" : "down";
      const range = lastSwingHighPrice - lastSwingLowPrice;
      const map: Record<string, number> = {};
      for (let i = 0; i < levels.length; i++) {
        const ratio = levels[i];
        map[ratioKeys[i]] =
          trend === "up" ? lastSwingHighPrice - ratio * range : lastSwingLowPrice + ratio * range;
      }
      value = {
        levels: map,
        swingHigh: lastSwingHighPrice,
        swingLow: lastSwingLowPrice,
        trend,
      };
    }
    cached = value;
    cachedHighIdx = lastSwingHighIdx;
    cachedLowIdx = lastSwingLowIdx;
    return value;
  }

  const indicator: IncrementalIndicator<
    FibonacciRetracementValue,
    IndicatorSnapshot<FibonacciRetracementState>
  > = {
    next(candle: NormalizedCandle) {
      count++;
      const swingResult = swings.next(candle);
      const sv = swingResult.value;
      // A confirmed swing at this step belongs to bar (count - 1 - rightBars).
      const confirmedIdx = count - 1 - rightBars;

      if (sv.isSwingHigh && sv.swingHighPrice !== null && confirmedIdx >= 0) {
        lastSwingHighPrice = sv.swingHighPrice;
        lastSwingHighIdx = confirmedIdx;
      }
      if (sv.isSwingLow && sv.swingLowPrice !== null && confirmedIdx >= 0) {
        lastSwingLowPrice = sv.swingLowPrice;
        lastSwingLowIdx = confirmedIdx;
      }

      return {
        time: candle.time,
        value: computeOutput(),
      };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState().state;
      const result = indicator.next(candle);
      swings = createSwingPoints({ leftBars, rightBars }, { fromState: saved.swings });
      lastSwingHighPrice = saved.lastSwingHighPrice;
      lastSwingHighIdx = saved.lastSwingHighIdx;
      lastSwingLowPrice = saved.lastSwingLowPrice;
      lastSwingLowIdx = saved.lastSwingLowIdx;
      count = saved.count;
      return result;
    },

    getState(): IndicatorSnapshot<FibonacciRetracementState> {
      return makeSnapshot(
        "fibonacciRetracement",
        FIBONACCI_RETRACEMENT_VERSION,
        { leftBars, rightBars, levels: levels.slice() },
        {
          swings: swings.getState(),
          lastSwingHighPrice,
          lastSwingHighIdx,
          lastSwingLowPrice,
          lastSwingLowIdx,
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
