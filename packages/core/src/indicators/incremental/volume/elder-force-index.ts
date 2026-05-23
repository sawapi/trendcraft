/**
 * Incremental Elder's Force Index
 *
 * Tracks both short-period (entry timing) and long-period (trend bias)
 * EMAs of raw FI(1) = `(close − prevClose) * volume` in lockstep, the
 * canonical Elder pairing.
 *
 * State category: **Cascaded** (two recursive EMA stages, each
 * permanently conditioned on its construction-time period). Resume
 * with a different `shortPeriod` / `longPeriod` is refused.
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

export type ElderForceIndexValue = {
  short: number | null;
  long: number | null;
};

/**
 * Bare state shape for Elder's Force Index. Params (`shortPeriod`,
 * `longPeriod`) live in `meta.params`.
 */
export type ElderForceIndexState = {
  prevClose: number | null;
  shortEma: number | null;
  longEma: number | null;
  /** Running sum used to seed each EMA's first non-null value (SMA of first `period` raw forces). */
  shortSum: number;
  longSum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ELDER_FORCE_INDEX_VERSION = 1;

type ElderForceIndexParams = {
  shortPeriod: number;
  longPeriod: number;
};

/**
 * Create an incremental Elder's Force Index indicator
 *
 * Default periods are Elder's canonical pair: short=2 (entry timing),
 * long=13 (trend bias).
 *
 * @example
 * ```ts
 * const fi = createElderForceIndex();
 * for (const candle of stream) {
 *   const { value } = fi.next(candle);
 *   if (fi.isWarmedUp) console.log(value); // { short, long }
 * }
 * ```
 */
export function createElderForceIndex(
  options: { shortPeriod?: number; longPeriod?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ElderForceIndexState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<ElderForceIndexValue, IndicatorSnapshot<ElderForceIndexState>> {
  const { params, state } = resolveResume<ElderForceIndexParams, ElderForceIndexState>({
    indicator: "elderForceIndex",
    version: ELDER_FORCE_INDEX_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { shortPeriod: 2, longPeriod: 13 },
  });

  const shortPeriod = requireParam(
    "elderForceIndex",
    params,
    "shortPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const longPeriod = requireParam(
    "elderForceIndex",
    params,
    "longPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  const shortMultiplier = 2 / (shortPeriod + 1);
  const longMultiplier = 2 / (longPeriod + 1);

  let prevClose: number | null;
  let shortEma: number | null;
  let longEma: number | null;
  let shortSum: number;
  let longSum: number;
  let count: number;

  if (state !== null) {
    prevClose = state.prevClose;
    shortEma = state.shortEma;
    longEma = state.longEma;
    shortSum = state.shortSum;
    longSum = state.longSum;
    count = state.count;
  } else {
    prevClose = null;
    shortEma = null;
    longEma = null;
    shortSum = 0;
    longSum = 0;
    count = 0;
  }

  function computeRawForce(candle: NormalizedCandle): number {
    if (prevClose === null) return 0;
    return (candle.close - prevClose) * candle.volume;
  }

  /**
   * Advance one EMA by one bar. Returns the new EMA value (or `null`
   * if not yet warmed up). Mutates only via the returned value — the
   * caller owns the assignment.
   */
  function stepEma(
    raw: number,
    period: number,
    multiplier: number,
    prev: number | null,
    sum: number,
  ): { ema: number | null; sum: number } {
    if (count < period) {
      return { ema: null, sum: sum + raw };
    }
    if (count === period) {
      const next = (sum + raw) / period;
      return { ema: next, sum: sum + raw };
    }
    return { ema: raw * multiplier + (prev ?? 0) * (1 - multiplier), sum };
  }

  const indicator: IncrementalIndicator<
    ElderForceIndexValue,
    IndicatorSnapshot<ElderForceIndexState>
  > = {
    next(candle: NormalizedCandle) {
      const raw = computeRawForce(candle);
      count++;

      const s = stepEma(raw, shortPeriod, shortMultiplier, shortEma, shortSum);
      const l = stepEma(raw, longPeriod, longMultiplier, longEma, longSum);
      shortEma = s.ema;
      longEma = l.ema;
      shortSum = s.sum;
      longSum = l.sum;

      prevClose = candle.close;
      return { time: candle.time, value: { short: shortEma, long: longEma } };
    },

    peek(candle: NormalizedCandle) {
      const raw = prevClose === null ? 0 : (candle.close - prevClose) * candle.volume;
      const peekCount = count + 1;

      const peekStep = (
        period: number,
        multiplier: number,
        prev: number | null,
        sum: number,
      ): number | null => {
        if (peekCount < period) return null;
        if (peekCount === period) return (sum + raw) / period;
        return raw * multiplier + (prev ?? 0) * (1 - multiplier);
      };

      return {
        time: candle.time,
        value: {
          short: peekStep(shortPeriod, shortMultiplier, shortEma, shortSum),
          long: peekStep(longPeriod, longMultiplier, longEma, longSum),
        },
      };
    },

    getState(): IndicatorSnapshot<ElderForceIndexState> {
      return makeSnapshot(
        "elderForceIndex",
        ELDER_FORCE_INDEX_VERSION,
        { shortPeriod, longPeriod },
        {
          prevClose,
          shortEma,
          longEma,
          shortSum,
          longSum,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // Both channels must have warmed up before downstream code can
      // treat the value as fully initialized. Without `Math.max` a
      // caller passing `shortPeriod > longPeriod` (allowed by the API)
      // would see `isWarmedUp === true` while `value.short` was still
      // `null`.
      return count >= Math.max(shortPeriod, longPeriod);
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
