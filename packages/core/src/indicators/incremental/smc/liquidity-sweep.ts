/**
 * Incremental Liquidity Sweep detection.
 *
 * A liquidity sweep is a brief breach of a recent swing high / low followed by
 * a recovery back inside the prior range. Recovery is the discrete trade
 * trigger and is what we want to surface in real time.
 *
 * Stream semantics
 * ----------------
 * Swing confirmation is delayed by `swingPeriod` bars (a swing at bar `j` is
 * only known at step `j + swingPeriod`). To stay close to the batch output
 * without using look-ahead, this implementation:
 *
 *   1. Drives an internal `createSwingPoints` for confirmation (delayed).
 *   2. Holds the last `swingPeriod + 1` candles in a ring.
 *   3. When a swing is confirmed at step `t` (for bar `mid = t - swingPeriod`),
 *      it scans the buffered bars `(mid, t]` against the new level to detect
 *      any sweep that already occurred in that window — `sweep.sweepIndex /
 *      sweepTime` reflect the actual bar.
 *   4. Recovery checks always run against the current bar.
 *
 * The set of sweeps observed by the live indicator eventually matches batch,
 * but emission lags real time by up to `swingPeriod` bars. Tests compare the
 * multiset of detected sweeps after both sides finish processing.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import { type SwingPointsState, createSwingPoints } from "../price/swing-points";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type LiquiditySweep = {
  type: "bullish" | "bearish";
  sweptLevel: number;
  sweepExtreme: number;
  sweepIndex: number;
  sweepTime: number;
  recovered: boolean;
  recoveredIndex: number | null;
  recoveredTime: number | null;
  sweepDepthPercent: number;
};

export type LiquiditySweepValue = {
  /** A new sweep was detected during this step (may be backfilled from a recent bar). */
  isSweep: boolean;
  /** The newly detected sweep, if any. */
  sweep: LiquiditySweep | null;
  /** All currently tracked sweeps (recovered and unrecovered). */
  recentSweeps: LiquiditySweep[];
  /** Sweeps that recovered on this exact bar — high-value entry signal. */
  recoveredThisBar: LiquiditySweep[];
};

export type LiquiditySweepOptions = {
  /** Swing detection period (default: 5) */
  swingPeriod?: number;
  /** Maximum bars to wait for recovery (default: 3) */
  maxRecoveryBars?: number;
  /** Maximum number of recent sweeps to retain (default: 10) */
  maxTrackedSweeps?: number;
  /** Minimum sweep depth percentage to count as valid (default: 0) */
  minSweepDepth?: number;
};

type BufferedCandle = {
  time: number;
  high: number;
  low: number;
  close: number;
  index: number;
};

export type LiquiditySweepState = {
  swingPeriod: number;
  maxRecoveryBars: number;
  maxTrackedSweeps: number;
  minSweepDepth: number;
  swings: SwingPointsState;
  buffer: ReturnType<CircularBuffer<BufferedCandle>["snapshot"]>;
  recentSwingHigh: { level: number; index: number } | null;
  recentSwingLow: { level: number; index: number } | null;
  recentSweeps: LiquiditySweep[];
  count: number;
};

export function createLiquiditySweep(
  options: LiquiditySweepOptions = {},
  warmUpOptions?: WarmUpOptions<LiquiditySweepState>,
): IncrementalIndicator<LiquiditySweepValue, LiquiditySweepState> {
  const swingPeriod = options.swingPeriod ?? 5;
  const maxRecoveryBars = options.maxRecoveryBars ?? 3;
  const maxTrackedSweeps = options.maxTrackedSweeps ?? 10;
  const minSweepDepth = options.minSweepDepth ?? 0;

  if (swingPeriod < 1) throw new Error("swingPeriod must be at least 1");
  if (maxRecoveryBars < 1) throw new Error("maxRecoveryBars must be at least 1");
  if (maxTrackedSweeps < 1) throw new Error("maxTrackedSweeps must be at least 1");
  if (minSweepDepth < 0) throw new Error("minSweepDepth must be non-negative");

  const bufferCapacity = swingPeriod + 1;

  let swings: ReturnType<typeof createSwingPoints>;
  let buffer: CircularBuffer<BufferedCandle>;
  let recentSwingHigh: { level: number; index: number } | null;
  let recentSwingLow: { level: number; index: number } | null;
  let recentSweeps: LiquiditySweep[];
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    swings = createSwingPoints(
      { leftBars: swingPeriod, rightBars: swingPeriod },
      { fromState: s.swings },
    );
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    recentSwingHigh = s.recentSwingHigh ? { ...s.recentSwingHigh } : null;
    recentSwingLow = s.recentSwingLow ? { ...s.recentSwingLow } : null;
    recentSweeps = s.recentSweeps.map((sw) => ({ ...sw }));
    count = s.count;
  } else {
    swings = createSwingPoints({ leftBars: swingPeriod, rightBars: swingPeriod });
    buffer = new CircularBuffer<BufferedCandle>(bufferCapacity);
    recentSwingHigh = null;
    recentSwingLow = null;
    recentSweeps = [];
    count = 0;
  }

  function trySweep(
    swing: { level: number; index: number },
    bar: BufferedCandle,
    side: "bullish" | "bearish",
  ): LiquiditySweep | null {
    if (bar.index <= swing.index) return null;
    let depth: number;
    let extreme: number;
    if (side === "bullish") {
      if (bar.low >= swing.level) return null;
      depth = ((swing.level - bar.low) / swing.level) * 100;
      extreme = bar.low;
    } else {
      if (bar.high <= swing.level) return null;
      depth = ((bar.high - swing.level) / swing.level) * 100;
      extreme = bar.high;
    }
    if (depth < minSweepDepth) return null;
    const recovered = side === "bullish" ? bar.close > swing.level : bar.close < swing.level;
    return {
      type: side,
      sweptLevel: swing.level,
      sweepExtreme: extreme,
      sweepIndex: bar.index,
      sweepTime: bar.time,
      sweepDepthPercent: depth,
      recovered,
      recoveredIndex: recovered ? bar.index : null,
      recoveredTime: recovered ? bar.time : null,
    };
  }

  function pushSweep(sweep: LiquiditySweep): void {
    recentSweeps.push(sweep);
    if (recentSweeps.length > maxTrackedSweeps) {
      recentSweeps = recentSweeps.slice(-maxTrackedSweeps);
    }
  }

  /**
   * Buffer scan against a freshly-confirmed swing.
   *
   * Defensive only: by `createSwingPoints`'s strict-inequality rule, a swing at
   * bar `j` requires every bar in `[j-leftBars..j+rightBars]` (which is exactly
   * our buffered window) to have `low > j.low` (or `high < j.high`), so a sweep
   * inside that window is structurally impossible. Empirical probe on 10k
   * random candles confirms zero backfilled hits. The branch is kept to stay
   * robust if swing detection ever loosens to non-strict inequality.
   */
  function findBackfilledSweep(
    swing: { level: number; index: number },
    side: "bullish" | "bearish",
  ): LiquiditySweep | null {
    for (let i = 0; i < buffer.length; i++) {
      const sweep = trySweep(swing, buffer.get(i), side);
      if (sweep) return sweep;
    }
    return null;
  }

  const indicator: IncrementalIndicator<LiquiditySweepValue, LiquiditySweepState> = {
    next(candle: NormalizedCandle) {
      const idx = count;
      buffer.push({
        time: candle.time,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        index: idx,
      });
      count++;

      const swingResult = swings.next(candle);
      const sv = swingResult.value;
      const recoveredThisBar: LiquiditySweep[] = [];
      let newSweep: LiquiditySweep | null = null;

      const confirmedSwingIdx = idx - swingPeriod;

      // Process newly-confirmed swings. Outside bars can confirm both a high
      // and a low on the same step, so each side runs an independent backfill
      // scan. If a backfill produces a sweep the swing tracker is reset (it
      // has been swept); otherwise the level is adopted as the active tracker.
      // Only the first detected sweep is reported as `value.sweep`; the second
      // is still pushed to `recentSweeps` so it can recover later.
      function commitBackfilled(sweep: LiquiditySweep | null): void {
        if (!sweep) return;
        if (newSweep === null) newSweep = sweep;
        if (sweep.recoveredIndex === idx) recoveredThisBar.push(sweep);
        pushSweep(sweep);
      }

      if (sv.isSwingHigh && sv.swingHighPrice !== null && confirmedSwingIdx >= 0) {
        const newHigh = { level: sv.swingHighPrice, index: confirmedSwingIdx };
        const sweep = findBackfilledSweep(newHigh, "bearish");
        if (sweep) {
          commitBackfilled(sweep);
          recentSwingHigh = null;
        } else {
          recentSwingHigh = newHigh;
        }
      }

      if (sv.isSwingLow && sv.swingLowPrice !== null && confirmedSwingIdx >= 0) {
        const newLow = { level: sv.swingLowPrice, index: confirmedSwingIdx };
        const sweep = findBackfilledSweep(newLow, "bullish");
        if (sweep) {
          commitBackfilled(sweep);
          recentSwingLow = null;
        } else {
          recentSwingLow = newLow;
        }
      }

      // Current bar against any pre-existing tracked swing (set in earlier steps).
      const currentBar = buffer.newest();
      if (newSweep === null && recentSwingLow) {
        const sweep = trySweep(recentSwingLow, currentBar, "bullish");
        if (sweep) {
          newSweep = sweep;
          if (sweep.recovered) recoveredThisBar.push(sweep);
          pushSweep(sweep);
          recentSwingLow = null;
        }
      }
      if (newSweep === null && recentSwingHigh) {
        const sweep = trySweep(recentSwingHigh, currentBar, "bearish");
        if (sweep) {
          newSweep = sweep;
          if (sweep.recovered) recoveredThisBar.push(sweep);
          pushSweep(sweep);
          recentSwingHigh = null;
        }
      }

      // Delayed recovery on previously tracked unrecovered sweeps.
      const survivors: LiquiditySweep[] = [];
      for (const sweep of recentSweeps) {
        // Drop too-old unrecovered sweeps.
        if (idx - sweep.sweepIndex > maxRecoveryBars && !sweep.recovered) continue;
        if (!sweep.recovered) {
          if (sweep.type === "bullish" && candle.close > sweep.sweptLevel) {
            sweep.recovered = true;
            sweep.recoveredIndex = idx;
            sweep.recoveredTime = candle.time;
            recoveredThisBar.push(sweep);
          } else if (sweep.type === "bearish" && candle.close < sweep.sweptLevel) {
            sweep.recovered = true;
            sweep.recoveredIndex = idx;
            sweep.recoveredTime = candle.time;
            recoveredThisBar.push(sweep);
          }
        }
        survivors.push(sweep);
      }
      recentSweeps = survivors;

      return {
        time: candle.time,
        value: {
          isSweep: newSweep !== null,
          sweep: newSweep,
          recentSweeps: recentSweeps.map((s) => ({ ...s })),
          recoveredThisBar,
        },
      };
    },

    peek(candle: NormalizedCandle) {
      const saved = indicator.getState();
      const result = indicator.next(candle);
      swings = createSwingPoints(
        { leftBars: swingPeriod, rightBars: swingPeriod },
        { fromState: saved.swings },
      );
      buffer = CircularBuffer.fromSnapshot(saved.buffer);
      recentSwingHigh = saved.recentSwingHigh ? { ...saved.recentSwingHigh } : null;
      recentSwingLow = saved.recentSwingLow ? { ...saved.recentSwingLow } : null;
      recentSweeps = saved.recentSweeps.map((sw) => ({ ...sw }));
      count = saved.count;
      return result;
    },

    getState(): LiquiditySweepState {
      return {
        swingPeriod,
        maxRecoveryBars,
        maxTrackedSweeps,
        minSweepDepth,
        swings: swings.getState(),
        buffer: buffer.snapshot(),
        recentSwingHigh: recentSwingHigh ? { ...recentSwingHigh } : null,
        recentSwingLow: recentSwingLow ? { ...recentSwingLow } : null,
        recentSweeps: recentSweeps.map((sw) => ({ ...sw })),
        count,
      };
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
