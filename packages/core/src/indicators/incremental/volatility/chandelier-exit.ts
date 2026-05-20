/**
 * Incremental Chandelier Exit
 *
 * Long Exit = Highest High (n) - ATR * Multiplier
 * Short Exit = Lowest Low (n) + ATR * Multiplier
 *
 * State category: **Mixed** (an inner recursive ATR snapshot, windowed
 * high/low buffers, and a recursive `prevDirection`). `multiplier`
 * feeds the exit levels that determine `direction`, which carries into
 * `prevDirection`, so it is state-shaping — every param change on
 * resume is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { ChandelierExitValue, NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { type AtrState, createAtr } from "./atr";

export type ChandelierExitState = {
  atrState: IndicatorSnapshot<AtrState>;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevDirection: 1 | -1 | 0;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const CHANDELIER_EXIT_VERSION = 1;

type ChandelierExitParams = {
  period: number;
  multiplier: number;
  /** Optional — falls back to `period` when omitted. */
  lookback?: number;
};

/**
 * Create an incremental Chandelier Exit indicator
 *
 * @example
 * ```ts
 * const ce = createChandelierExit({ period: 22, multiplier: 3.0 });
 * for (const candle of stream) {
 *   const { value } = ce.next(candle);
 *   if (value.isCrossover) console.log('Direction change!');
 * }
 * ```
 */
export function createChandelierExit(
  options: { period?: number; multiplier?: number; lookback?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ChandelierExitState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<ChandelierExitValue, IndicatorSnapshot<ChandelierExitState>> {
  // Pass the raw `options` to resolveResume — do not inject a resolved
  // `lookback`. Injecting a default would make a resumed snapshot
  // (which omits `lookback`) look like a state-shaping change and throw.
  const { params, state } = resolveResume<ChandelierExitParams, ChandelierExitState>({
    indicator: "chandelierExit",
    version: CHANDELIER_EXIT_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 22, multiplier: 3.0 },
  });

  const period = requireParam(
    "chandelierExit",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const multiplier = requireParam(
    "chandelierExit",
    params,
    "multiplier",
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
    "must be a positive number",
  );
  // `lookback` has no canonical default — it falls back to `period`.
  // Resolved AFTER resolveResume: a resumed snapshot keeps its saved
  // `lookback` (recorded in `meta.params` by getState) because the raw
  // options carry no injected default to diff against.
  const hlLookback = params.lookback ?? period;
  if (!Number.isInteger(hlLookback) || hlLookback < 1) {
    throw new Error(
      'chandelierExit: option "lookback" failed validation (must be a positive integer)',
    );
  }

  let atrIndicator: ReturnType<typeof createAtr>;
  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let prevDirection: 1 | -1 | 0;
  let count: number;

  if (state !== null) {
    atrIndicator = createAtr({ period }, { fromState: state.atrState });
    highBuffer = CircularBuffer.fromSnapshot(state.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(state.lowBuffer);
    prevDirection = state.prevDirection;
    count = state.count;
  } else {
    atrIndicator = createAtr({ period });
    highBuffer = new CircularBuffer<number>(hlLookback);
    lowBuffer = new CircularBuffer<number>(hlLookback);
    prevDirection = 0;
    count = 0;
  }

  function getHighest(buf: CircularBuffer<number>): number {
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < buf.length; i++) {
      if (buf.get(i) > max) max = buf.get(i);
    }
    return max;
  }

  function getLowest(buf: CircularBuffer<number>): number {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < buf.length; i++) {
      if (buf.get(i) < min) min = buf.get(i);
    }
    return min;
  }

  const indicator: IncrementalIndicator<
    ChandelierExitValue,
    IndicatorSnapshot<ChandelierExitState>
  > = {
    next(candle: NormalizedCandle) {
      count++;
      const atrResult = atrIndicator.next(candle);
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);

      const highestHigh = getHighest(highBuffer);
      const lowestLow = getLowest(lowBuffer);
      const atrVal = atrResult.value;

      let longExit: number | null = null;
      let shortExit: number | null = null;

      if (atrVal !== null) {
        const atrDist = atrVal * multiplier;
        longExit = highestHigh - atrDist;
        shortExit = lowestLow + atrDist;
      }

      let direction: 1 | -1 | 0 = 0;
      if (longExit !== null && shortExit !== null) {
        if (candle.close > longExit) {
          direction = 1;
        } else if (candle.close < shortExit) {
          direction = -1;
        } else {
          direction = prevDirection !== 0 ? prevDirection : 1;
        }
      }

      let isCrossover = false;
      if (prevDirection !== 0 && direction !== 0 && prevDirection !== direction) {
        isCrossover = true;
      }

      const value: ChandelierExitValue = {
        longExit,
        shortExit,
        direction,
        isCrossover,
        highestHigh,
        lowestLow,
        atr: atrVal,
      };

      prevDirection = direction;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const atrVal = atrIndicator.peek(candle).value;

      // Simulate adding to buffers
      let hh = candle.high;
      let ll = candle.low;
      if (highBuffer.length > 0) {
        hh = Math.max(getHighest(highBuffer), candle.high);
        ll = Math.min(getLowest(lowBuffer), candle.low);
        // If buffer is full, we also need to remove oldest and consider new
        if (highBuffer.isFull) {
          // Recalculate without oldest, plus new value
          let maxH = candle.high;
          let minL = candle.low;
          for (let i = 1; i < highBuffer.length; i++) {
            if (highBuffer.get(i) > maxH) maxH = highBuffer.get(i);
            if (lowBuffer.get(i) < minL) minL = lowBuffer.get(i);
          }
          hh = maxH;
          ll = minL;
        }
      }

      let longExit: number | null = null;
      let shortExit: number | null = null;

      if (atrVal !== null) {
        longExit = hh - atrVal * multiplier;
        shortExit = ll + atrVal * multiplier;
      }

      let direction: 1 | -1 | 0 = 0;
      if (longExit !== null && shortExit !== null) {
        if (candle.close > longExit) {
          direction = 1;
        } else if (candle.close < shortExit) {
          direction = -1;
        } else {
          direction = prevDirection !== 0 ? prevDirection : 1;
        }
      }

      let isCrossover = false;
      if (prevDirection !== 0 && direction !== 0 && prevDirection !== direction) {
        isCrossover = true;
      }

      return {
        time: candle.time,
        value: {
          longExit,
          shortExit,
          direction,
          isCrossover,
          highestHigh: hh,
          lowestLow: ll,
          atr: atrVal,
        },
      };
    },

    getState(): IndicatorSnapshot<ChandelierExitState> {
      return makeSnapshot(
        "chandelierExit",
        CHANDELIER_EXIT_VERSION,
        { period, multiplier, lookback: hlLookback },
        {
          atrState: atrIndicator.getState(),
          highBuffer: highBuffer.snapshot(),
          lowBuffer: lowBuffer.snapshot(),
          prevDirection,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return atrIndicator.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
