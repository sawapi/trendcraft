/**
 * Incremental Elder's Force Index
 *
 * Tracks both short-period (entry timing) and long-period (trend bias)
 * EMAs of raw FI(1) = `(close − prevClose) * volume` in lockstep, the
 * canonical Elder pairing.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type ElderForceIndexValue = {
  short: number | null;
  long: number | null;
};

export type ElderForceIndexState = {
  shortPeriod: number;
  longPeriod: number;
  prevClose: number | null;
  shortEma: number | null;
  longEma: number | null;
  /** Running sum used to seed each EMA's first non-null value (SMA of first `period` raw forces). */
  shortSum: number;
  longSum: number;
  count: number;
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
  warmUpOptions?: WarmUpOptions<ElderForceIndexState>,
): IncrementalIndicator<ElderForceIndexValue, ElderForceIndexState> {
  // Resume order: explicit option > persisted state > canonical default.
  // Reading the snapshot first is critical — a state captured under
  // custom periods (e.g. shortPeriod=5, longPeriod=20) would otherwise
  // silently switch to 2 / 13 mid-stream after restore, producing a
  // discontinuous EMA. Explicit options still win for callers that
  // intentionally re-parameterize on resume.
  const shortPeriod = options.shortPeriod ?? warmUpOptions?.fromState?.shortPeriod ?? 2;
  const longPeriod = options.longPeriod ?? warmUpOptions?.fromState?.longPeriod ?? 13;

  if (shortPeriod < 1) {
    throw new Error("Elder Force Index shortPeriod must be at least 1");
  }
  if (longPeriod < 1) {
    throw new Error("Elder Force Index longPeriod must be at least 1");
  }

  const shortMultiplier = 2 / (shortPeriod + 1);
  const longMultiplier = 2 / (longPeriod + 1);

  let prevClose: number | null;
  let shortEma: number | null;
  let longEma: number | null;
  let shortSum: number;
  let longSum: number;
  let count: number;

  const fs = warmUpOptions?.fromState ?? null;
  const periodsMatchSnapshot =
    fs !== null && fs.shortPeriod === shortPeriod && fs.longPeriod === longPeriod;

  if (fs !== null && periodsMatchSnapshot) {
    // Full restore — same periods, all EMA state is mathematically valid.
    prevClose = fs.prevClose;
    shortEma = fs.shortEma;
    longEma = fs.longEma;
    shortSum = fs.shortSum;
    longSum = fs.longSum;
    count = fs.count;
  } else if (fs !== null) {
    // The caller resumed with explicit periods that differ from the
    // snapshot — intentional re-parameterization. The previous EMA /
    // sum / count were accumulated under the old multipliers and can't
    // be reused; replaying them with new multipliers would produce a
    // mathematically incorrect series. Reset the EMA state and let the
    // new periods warm up from scratch. We keep `prevClose` so the
    // first raw-force computation after resume is still correct.
    prevClose = fs.prevClose;
    shortEma = null;
    longEma = null;
    shortSum = 0;
    longSum = 0;
    count = 0;
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

  const indicator: IncrementalIndicator<ElderForceIndexValue, ElderForceIndexState> = {
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

    getState(): ElderForceIndexState {
      return {
        shortPeriod,
        longPeriod,
        prevClose,
        shortEma,
        longEma,
        shortSum,
        longSum,
        count,
      };
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
