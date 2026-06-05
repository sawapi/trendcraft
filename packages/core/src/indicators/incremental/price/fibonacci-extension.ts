/**
 * Incremental Fibonacci Extension.
 *
 * Wraps `createSwingPoints` and maintains an alternating-swing list of the
 * last (up to 3) confirmed swings to detect an A→B→C pattern. When the
 * pattern is valid (C between A and B), extension level prices are computed
 * relative to C.
 *
 * Output shape matches batch `fibonacciExtension`.
 *
 * Parity note (same as Fib Retracement): batch uses look-ahead via batch
 * `swingPoints`, while live confirms swings with `rightBars` delay. Live
 * therefore lags batch by `rightBars` bars; once both sides have processed
 * the same data, the values agree (`live.next(c_t).value` matches
 * `batch[t - rightBars].value`).
 */

import type { NormalizedCandle } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { cloneShallow, pushBounded, resolveLevels, validateSwingConfig } from "./swing-helpers";
import { createSwingPoints, type SwingPointsState } from "./swing-points";

export type FibonacciExtensionValue = {
  /** Extension levels mapped by ratio string to price value, null until a valid A→B→C pattern */
  levels: Record<string, number> | null;
  /** Point A price (start of initial move) */
  pointA: number | null;
  /** Point B price (end of initial move) */
  pointB: number | null;
  /** Point C price (end of retracement) */
  pointC: number | null;
  /** Direction of the extension */
  direction: "bullish" | "bearish" | null;
};

export type FibonacciExtensionOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
  /** Extension ratio levels (default: [0, 0.618, 1, 1.272, 1.618, 2, 2.618]) */
  levels?: number[];
};

type AlternatingPoint = {
  index: number;
  price: number;
  type: "high" | "low";
};

/**
 * Bare state shape for Fibonacci Extension. Params (`leftBars`,
 * `rightBars`, `levels`) live in `meta.params`; the inner swing-points
 * snapshot is itself an `IndicatorSnapshot`.
 */
export type FibonacciExtensionState = {
  swings: IndicatorSnapshot<SwingPointsState>;
  alternating: AlternatingPoint[];
  currentLevels: Record<string, number> | null;
  currentPointA: number | null;
  currentPointB: number | null;
  currentPointC: number | null;
  currentDirection: "bullish" | "bearish" | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const FIBONACCI_EXTENSION_VERSION = 1;

const DEFAULT_LEVELS: readonly number[] = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];

type FibonacciExtensionParams = {
  leftBars: number;
  rightBars: number;
  levels: number[];
};

export function createFibonacciExtension(
  options: FibonacciExtensionOptions = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<FibonacciExtensionState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<FibonacciExtensionValue, IndicatorSnapshot<FibonacciExtensionState>> {
  const { params, state } = resolveResume<FibonacciExtensionParams, FibonacciExtensionState>({
    indicator: "fibonacciExtension",
    version: FIBONACCI_EXTENSION_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { leftBars: 10, rightBars: 10, levels: DEFAULT_LEVELS.slice() },
  });
  const { leftBars, rightBars } = validateSwingConfig(params.leftBars, params.rightBars);
  const { levels, ratioKeys } = resolveLevels(params.levels);

  let swings: ReturnType<typeof createSwingPoints>;
  // The pattern only ever needs the last 3 alternating points. Trim to that
  // bound to keep state size constant on long streams.
  let alternating: AlternatingPoint[];
  let currentLevels: Record<string, number> | null;
  let currentPointA: number | null;
  let currentPointB: number | null;
  let currentPointC: number | null;
  let currentDirection: "bullish" | "bearish" | null;
  let count: number;

  if (state !== null) {
    swings = createSwingPoints({ leftBars, rightBars }, { fromState: state.swings });
    alternating = cloneShallow(state.alternating);
    currentLevels = state.currentLevels ? { ...state.currentLevels } : null;
    currentPointA = state.currentPointA;
    currentPointB = state.currentPointB;
    currentPointC = state.currentPointC;
    currentDirection = state.currentDirection;
    count = state.count;
  } else {
    swings = createSwingPoints({ leftBars, rightBars });
    alternating = [];
    currentLevels = null;
    currentPointA = null;
    currentPointB = null;
    currentPointC = null;
    currentDirection = null;
    count = 0;
  }

  // Cached output, reused across bars when no swing-driven update happened.
  let cached: FibonacciExtensionValue | null = null;

  function pushOrReplace(point: AlternatingPoint): boolean {
    if (alternating.length === 0) {
      alternating.push(point);
      return true;
    }
    const last = alternating[alternating.length - 1];
    if (last.type !== point.type) {
      pushBounded(alternating, point, 3);
      return true;
    }
    // Same type consecutive: keep the more extreme.
    const moreExtreme = point.type === "high" ? point.price > last.price : point.price < last.price;
    if (moreExtreme) {
      alternating[alternating.length - 1] = point;
      return true;
    }
    return false;
  }

  function reEvaluatePattern(): void {
    if (alternating.length < 3) return;
    const a = alternating[0];
    const b = alternating[1];
    const c = alternating[2];
    let direction: "bullish" | "bearish" | null = null;
    if (a.type === "low" && b.type === "high" && c.type === "low") {
      direction = "bullish";
    } else if (a.type === "high" && b.type === "low" && c.type === "high") {
      direction = "bearish";
    }
    if (!direction) return;
    const validRetracement =
      direction === "bullish"
        ? c.price > a.price && c.price < b.price
        : c.price < a.price && c.price > b.price;
    if (!validRetracement) return;

    const move = Math.abs(b.price - a.price);
    const map: Record<string, number> = {};
    for (let i = 0; i < levels.length; i++) {
      const ratio = levels[i];
      map[ratioKeys[i]] = direction === "bullish" ? c.price + ratio * move : c.price - ratio * move;
    }
    currentLevels = map;
    currentPointA = a.price;
    currentPointB = b.price;
    currentPointC = c.price;
    currentDirection = direction;
    cached = null; // invalidate output cache
  }

  function output(): FibonacciExtensionValue {
    if (cached !== null) return cached;
    const value: FibonacciExtensionValue = {
      levels: currentLevels,
      pointA: currentPointA,
      pointB: currentPointB,
      pointC: currentPointC,
      direction: currentDirection,
    };
    cached = value;
    return value;
  }

  const indicator: IncrementalIndicator<
    FibonacciExtensionValue,
    IndicatorSnapshot<FibonacciExtensionState>
  > = {
    next(candle: NormalizedCandle) {
      count++;
      const swingResult = swings.next(candle);
      const sv = swingResult.value;
      const confirmedIdx = count - 1 - rightBars;

      let updated = false;
      if (sv.isSwingHigh && sv.swingHighPrice !== null && confirmedIdx >= 0) {
        if (pushOrReplace({ index: confirmedIdx, price: sv.swingHighPrice, type: "high" })) {
          updated = true;
        }
      }
      if (sv.isSwingLow && sv.swingLowPrice !== null && confirmedIdx >= 0) {
        if (pushOrReplace({ index: confirmedIdx, price: sv.swingLowPrice, type: "low" })) {
          updated = true;
        }
      }

      if (updated) reEvaluatePattern();

      return {
        time: candle.time,
        value: output(),
      };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState().state;
      const result = indicator.next(candle);
      swings = createSwingPoints({ leftBars, rightBars }, { fromState: saved.swings });
      alternating = cloneShallow(saved.alternating);
      currentLevels = saved.currentLevels ? { ...saved.currentLevels } : null;
      currentPointA = saved.currentPointA;
      currentPointB = saved.currentPointB;
      currentPointC = saved.currentPointC;
      currentDirection = saved.currentDirection;
      count = saved.count;
      cached = null;
      return result;
    },

    getState(): IndicatorSnapshot<FibonacciExtensionState> {
      return makeSnapshot(
        "fibonacciExtension",
        FIBONACCI_EXTENSION_VERSION,
        { leftBars, rightBars, levels: levels.slice() },
        {
          swings: swings.getState(),
          alternating: cloneShallow(alternating),
          currentLevels: currentLevels ? { ...currentLevels } : null,
          currentPointA,
          currentPointB,
          currentPointC,
          currentDirection,
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
