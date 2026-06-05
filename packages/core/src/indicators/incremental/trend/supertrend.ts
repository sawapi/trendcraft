/**
 * Incremental Supertrend
 *
 * Uses ATR internally to calculate dynamic support/resistance bands.
 *
 * State category: **Mixed** (an inner recursive ATR snapshot plus the
 * recursive `prevFinalUpper` / `prevFinalLower` / `direction` bands).
 * `multiplier` feeds the final bands that carry forward recursively,
 * so it is state-shaping — every param change on resume is refused.
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
import { type AtrState, createAtr } from "../volatility/atr";

export type SupertrendValue = {
  supertrend: number | null;
  direction: 1 | -1 | 0;
  upperBand: number | null;
  lowerBand: number | null;
};

export type SupertrendState = {
  atrState: IndicatorSnapshot<AtrState>;
  prevFinalUpper: number | null;
  prevFinalLower: number | null;
  prevClose: number | null;
  direction: 1 | -1 | 0;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const SUPERTREND_VERSION = 1;

type SupertrendParams = {
  period: number;
  multiplier: number;
};

/**
 * Create an incremental Supertrend indicator
 *
 * @example
 * ```ts
 * const st = createSupertrend({ period: 10, multiplier: 3 });
 * for (const candle of stream) {
 *   const { value } = st.next(candle);
 *   if (st.isWarmedUp) console.log(value.supertrend, value.direction);
 * }
 * ```
 */
export function createSupertrend(
  options: { period?: number; multiplier?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<SupertrendState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<SupertrendValue, IndicatorSnapshot<SupertrendState>> {
  const { params, state } = resolveResume<SupertrendParams, SupertrendState>({
    indicator: "supertrend",
    version: SUPERTREND_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 10, multiplier: 3 },
  });

  const period = requireParam(
    "supertrend",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const multiplier = requireParam(
    "supertrend",
    params,
    "multiplier",
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
    "must be a positive number",
  );

  let atrIndicator: ReturnType<typeof createAtr>;
  let prevFinalUpper: number | null;
  let prevFinalLower: number | null;
  let prevClose: number | null;
  let direction: 1 | -1 | 0;
  let count: number;

  if (state !== null) {
    atrIndicator = createAtr({ period }, { fromState: state.atrState });
    prevFinalUpper = state.prevFinalUpper;
    prevFinalLower = state.prevFinalLower;
    prevClose = state.prevClose;
    direction = state.direction;
    count = state.count;
  } else {
    atrIndicator = createAtr({ period });
    prevFinalUpper = null;
    prevFinalLower = null;
    prevClose = null;
    direction = 0;
    count = 0;
  }

  const nullValue: SupertrendValue = {
    supertrend: null,
    direction: 0,
    upperBand: null,
    lowerBand: null,
  };

  const indicator: IncrementalIndicator<SupertrendValue, IndicatorSnapshot<SupertrendState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const atrResult = atrIndicator.next(candle);
      const atrVal = atrResult.value;

      if (atrVal === null) {
        prevClose = candle.close;
        return { time: candle.time, value: nullValue };
      }

      const hl2 = (candle.high + candle.low) / 2;
      const basicUpper = hl2 + multiplier * atrVal;
      const basicLower = hl2 - multiplier * atrVal;

      // Final Upper Band
      let finalUpper: number;
      if (prevFinalUpper === null) {
        finalUpper = basicUpper;
      } else {
        finalUpper =
          basicUpper < prevFinalUpper || (prevClose !== null && prevClose > prevFinalUpper)
            ? basicUpper
            : prevFinalUpper;
      }

      // Final Lower Band
      let finalLower: number;
      if (prevFinalLower === null) {
        finalLower = basicLower;
      } else {
        finalLower =
          basicLower > prevFinalLower || (prevClose !== null && prevClose < prevFinalLower)
            ? basicLower
            : prevFinalLower;
      }

      // Determine direction
      if (direction === 0) {
        // Initial direction
        direction = candle.close > finalUpper ? 1 : -1;
      } else if (direction === -1 && candle.close > finalUpper) {
        direction = 1;
      } else if (direction === 1 && candle.close < finalLower) {
        direction = -1;
      }

      const supertrend = direction === 1 ? finalLower : finalUpper;

      prevFinalUpper = finalUpper;
      prevFinalLower = finalLower;
      prevClose = candle.close;

      return {
        time: candle.time,
        value: { supertrend, direction, upperBand: finalUpper, lowerBand: finalLower },
      };
    },

    peek(candle: NormalizedCandle) {
      const atrPeek = atrIndicator.peek(candle);
      if (atrPeek.value === null) {
        return { time: candle.time, value: nullValue };
      }

      const hl2 = (candle.high + candle.low) / 2;
      const basicUpper = hl2 + multiplier * atrPeek.value;
      const basicLower = hl2 - multiplier * atrPeek.value;

      const finalUpper =
        prevFinalUpper === null
          ? basicUpper
          : basicUpper < prevFinalUpper || (prevClose !== null && prevClose > prevFinalUpper)
            ? basicUpper
            : prevFinalUpper;

      const finalLower =
        prevFinalLower === null
          ? basicLower
          : basicLower > prevFinalLower || (prevClose !== null && prevClose < prevFinalLower)
            ? basicLower
            : prevFinalLower;

      let dir = direction;
      if (dir === 0) {
        dir = candle.close > finalUpper ? 1 : -1;
      } else if (dir === -1 && candle.close > finalUpper) {
        dir = 1;
      } else if (dir === 1 && candle.close < finalLower) {
        dir = -1;
      }

      return {
        time: candle.time,
        value: {
          supertrend: dir === 1 ? finalLower : finalUpper,
          direction: dir,
          upperBand: finalUpper,
          lowerBand: finalLower,
        },
      };
    },

    getState(): IndicatorSnapshot<SupertrendState> {
      return makeSnapshot(
        "supertrend",
        SUPERTREND_VERSION,
        { period, multiplier },
        {
          atrState: atrIndicator.getState(),
          prevFinalUpper,
          prevFinalLower,
          prevClose,
          direction,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return atrIndicator.isWarmedUp && direction !== 0;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
