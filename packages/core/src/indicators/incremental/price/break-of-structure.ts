/**
 * Incremental Break of Structure (BOS) and Change of Character (CHoCH).
 *
 * Swing detection is identical to `createSwingPoints` (a 2*swingPeriod+1
 * window, strict inequality) but we only track the last confirmed swing
 * high / low (plus trend state) — no per-bar swing-point series is exposed.
 * BOS fires on the current candle's time when its close crosses the last
 * confirmed swing level; matches batch `breakOfStructure()` bar-by-bar.
 *
 * CHoCH derives from BOS: it marks only the first BOS that flips the prior
 * trend direction.
 *
 * State category: **Mixed** (a fixed-size `2*swingPeriod+1` raw
 * high/low window plus persistent last-swing / trend trackers
 * conditioned on the window the swing was confirmed under). A
 * `swingPeriod` change re-times confirmation and would re-emit
 * pre-snapshot structure from the carried window, so any param change
 * on resume is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type BosValue = {
  bullishBos: boolean;
  bearishBos: boolean;
  brokenLevel: number | null;
  trend: "bullish" | "bearish" | "neutral";
  swingHighLevel: number | null;
  swingLowLevel: number | null;
};

type WindowEntry = { high: number; low: number };

/**
 * Bare state shape for Break of Structure. The param (`swingPeriod`)
 * lives in `meta.params` on the wire.
 */
export type BosState = {
  buffer: ReturnType<CircularBuffer<WindowEntry>["snapshot"]>;
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
  trend: "bullish" | "bearish" | "neutral";
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const BREAK_OF_STRUCTURE_VERSION = 1;

type BosParams = {
  swingPeriod: number;
};

/**
 * Create an incremental Break of Structure indicator.
 *
 * @example
 * ```ts
 * const bos = createBreakOfStructure({ swingPeriod: 5 });
 * for (const candle of stream) {
 *   const { value } = bos.next(candle);
 *   if (value.bullishBos) console.log("bullish BOS at", value.brokenLevel);
 * }
 * ```
 */
export function createBreakOfStructure(
  options: { swingPeriod?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<BosState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<BosValue, IndicatorSnapshot<BosState>> {
  const { params, state, reconfigured } = resolveResume<BosParams, BosState>({
    indicator: "breakOfStructure",
    version: BREAK_OF_STRUCTURE_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { swingPeriod: 5 },
  });

  const swingPeriod = params.swingPeriod;
  if (swingPeriod < 1) throw new Error("swingPeriod must be at least 1");

  const windowSize = 2 * swingPeriod + 1;

  let buffer: CircularBuffer<WindowEntry>;
  let lastSwingHigh: number | null;
  let lastSwingLow: number | null;
  let trend: "bullish" | "bearish" | "neutral";
  let count: number;

  if (state !== null) {
    const old = CircularBuffer.fromSnapshot(state.buffer);
    if (reconfigured) {
      buffer = new CircularBuffer<WindowEntry>(windowSize);
      const carry = Math.min(old.length, windowSize);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = old;
    }
    lastSwingHigh = state.lastSwingHigh;
    lastSwingLow = state.lastSwingLow;
    trend = state.trend;
    count = state.count;
  } else {
    buffer = new CircularBuffer<WindowEntry>(windowSize);
    lastSwingHigh = null;
    lastSwingLow = null;
    trend = "neutral";
    count = 0;
  }

  function evaluateMid(): { isHigh: boolean; isLow: boolean; mid: WindowEntry } | null {
    if (buffer.length < windowSize) return null;
    const mid = buffer.get(swingPeriod);
    let isHigh = true;
    let isLow = true;
    for (let i = 0; i < windowSize; i++) {
      if (i === swingPeriod) continue;
      const e = buffer.get(i);
      if (e.high >= mid.high) isHigh = false;
      if (e.low <= mid.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    return { isHigh, isLow, mid };
  }

  const indicator: IncrementalIndicator<BosValue, IndicatorSnapshot<BosState>> = {
    next(candle: NormalizedCandle) {
      buffer.push({ high: candle.high, low: candle.low });
      count++;

      // Confirm the middle bar as a swing point if applicable.
      const mid = evaluateMid();
      if (mid) {
        if (mid.isHigh) {
          lastSwingHigh = mid.mid.high;
        }
        if (mid.isLow) {
          lastSwingLow = mid.mid.low;
        }
      }

      // BOS check against the current bar's close.
      let bullishBos = false;
      let bearishBos = false;
      let brokenLevel: number | null = null;

      if (lastSwingHigh !== null && candle.close > lastSwingHigh) {
        bullishBos = true;
        brokenLevel = lastSwingHigh;
        trend = "bullish";
        lastSwingHigh = null;
      }
      if (lastSwingLow !== null && candle.close < lastSwingLow) {
        bearishBos = true;
        brokenLevel = lastSwingLow;
        trend = "bearish";
        lastSwingLow = null;
      }

      return {
        time: candle.time,
        value: {
          bullishBos,
          bearishBos,
          brokenLevel,
          trend,
          swingHighLevel: lastSwingHigh,
          swingLowLevel: lastSwingLow,
        },
      };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState().state;
      const result = indicator.next(candle);
      buffer = CircularBuffer.fromSnapshot(saved.buffer);
      lastSwingHigh = saved.lastSwingHigh;
      lastSwingLow = saved.lastSwingLow;
      trend = saved.trend;
      count = saved.count;
      return result;
    },

    getState(): IndicatorSnapshot<BosState> {
      return makeSnapshot(
        "breakOfStructure",
        BREAK_OF_STRUCTURE_VERSION,
        { swingPeriod },
        {
          buffer: buffer.snapshot(),
          lastSwingHigh,
          lastSwingLow,
          trend,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= windowSize;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}

/**
 * Bare state shape for Change of Character. Composes an inner BOS
 * snapshot. The param (`swingPeriod`) lives in `meta.params`.
 */
export type ChochState = {
  bosState: IndicatorSnapshot<BosState>;
  prevTrend: "bullish" | "bearish" | "neutral";
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const CHANGE_OF_CHARACTER_VERSION = 1;

/**
 * Create an incremental Change of Character indicator.
 *
 * CHoCH is a BOS in the opposite direction of the previous (post-BOS) trend.
 *
 * State category: **Mixed** — wraps an inner BOS snapshot; a
 * `swingPeriod` change on resume is refused (as for BOS itself).
 *
 * @example
 * ```ts
 * const choch = createChangeOfCharacter({ swingPeriod: 5 });
 * for (const candle of stream) {
 *   const { value } = choch.next(candle);
 *   if (value.bullishBos) console.log("bullish CHoCH — trend reversal");
 * }
 * ```
 */
export function createChangeOfCharacter(
  options: { swingPeriod?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ChochState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<BosValue, IndicatorSnapshot<ChochState>> {
  const { params, state } = resolveResume<BosParams, ChochState>({
    indicator: "changeOfCharacter",
    version: CHANGE_OF_CHARACTER_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { swingPeriod: 5 },
  });

  const swingPeriod = params.swingPeriod;
  const bos = createBreakOfStructure(
    { swingPeriod },
    state ? { fromState: state.bosState } : undefined,
  );
  let prevTrend: "bullish" | "bearish" | "neutral" = state ? state.prevTrend : "neutral";

  const indicator: IncrementalIndicator<BosValue, IndicatorSnapshot<ChochState>> = {
    next(candle: NormalizedCandle) {
      const { time, value } = bos.next(candle);
      const isBullishChoch = value.bullishBos && prevTrend === "bearish";
      const isBearishChoch = value.bearishBos && prevTrend === "bullish";
      if (value.bullishBos || value.bearishBos) {
        prevTrend = value.trend;
      }
      return {
        time,
        value: {
          ...value,
          bullishBos: isBullishChoch,
          bearishBos: isBearishChoch,
        },
      };
    },

    peek(candle: NormalizedCandle) {
      const savedPrev = prevTrend;
      const { time, value } = bos.peek(candle);
      const isBullishChoch = value.bullishBos && savedPrev === "bearish";
      const isBearishChoch = value.bearishBos && savedPrev === "bullish";
      return {
        time,
        value: {
          ...value,
          bullishBos: isBullishChoch,
          bearishBos: isBearishChoch,
        },
      };
    },

    getState(): IndicatorSnapshot<ChochState> {
      return makeSnapshot(
        "changeOfCharacter",
        CHANGE_OF_CHARACTER_VERSION,
        { swingPeriod },
        { bosState: bos.getState(), prevTrend },
      );
    },

    get count() {
      return bos.count;
    },

    get isWarmedUp() {
      return bos.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
