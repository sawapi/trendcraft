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
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type BosValue = {
  bullishBos: boolean;
  bearishBos: boolean;
  brokenLevel: number | null;
  trend: "bullish" | "bearish" | "neutral";
  swingHighLevel: number | null;
  swingLowLevel: number | null;
};

type WindowEntry = { high: number; low: number };

export type BosState = {
  swingPeriod: number;
  buffer: ReturnType<CircularBuffer<WindowEntry>["snapshot"]>;
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
  trend: "bullish" | "bearish" | "neutral";
  count: number;
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
  warmUpOptions?: WarmUpOptions<BosState>,
): IncrementalIndicator<BosValue, BosState> {
  const swingPeriod = options.swingPeriod ?? 5;
  if (swingPeriod < 1) throw new Error("swingPeriod must be at least 1");

  const windowSize = 2 * swingPeriod + 1;

  let buffer: CircularBuffer<WindowEntry>;
  let lastSwingHigh: number | null;
  let lastSwingLow: number | null;
  let trend: "bullish" | "bearish" | "neutral";
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    lastSwingHigh = s.lastSwingHigh;
    lastSwingLow = s.lastSwingLow;
    trend = s.trend;
    count = s.count;
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

  const indicator: IncrementalIndicator<BosValue, BosState> = {
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
      const saved = indicator.getState();
      const result = indicator.next(candle);
      buffer = CircularBuffer.fromSnapshot(saved.buffer);
      lastSwingHigh = saved.lastSwingHigh;
      lastSwingLow = saved.lastSwingLow;
      trend = saved.trend;
      count = saved.count;
      return result;
    },

    getState(): BosState {
      return {
        swingPeriod,
        buffer: buffer.snapshot(),
        lastSwingHigh,
        lastSwingLow,
        trend,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= windowSize;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}

export type ChochState = {
  bosState: BosState;
  prevTrend: "bullish" | "bearish" | "neutral";
};

/**
 * Create an incremental Change of Character indicator.
 *
 * CHoCH is a BOS in the opposite direction of the previous (post-BOS) trend.
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
  warmUpOptions?: WarmUpOptions<ChochState>,
): IncrementalIndicator<BosValue, ChochState> {
  const bos = createBreakOfStructure(
    options,
    warmUpOptions?.fromState ? { fromState: warmUpOptions.fromState.bosState } : undefined,
  );
  let prevTrend: "bullish" | "bearish" | "neutral" = warmUpOptions?.fromState
    ? warmUpOptions.fromState.prevTrend
    : "neutral";

  const indicator: IncrementalIndicator<BosValue, ChochState> = {
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

    getState(): ChochState {
      return { bosState: bos.getState(), prevTrend };
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
