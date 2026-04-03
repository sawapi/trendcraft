/**
 * Liquidity Sweep Detection
 *
 * A Liquidity Sweep occurs when price briefly breaks a swing high/low
 * to trigger stop losses, then quickly reverses back.
 *
 * This is a common institutional pattern used to:
 * - Trigger retail stop losses
 * - Accumulate/distribute positions
 * - Create false breakouts before the real move
 *
 * Bullish Sweep: Price breaks below a swing low, then recovers above it
 * Bearish Sweep: Price breaks above a swing high, then recovers below it
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { swingPoints } from "../price/swing-points";

/**
 * Create a sweep object with given parameters
 */
function createSweep(params: {
  type: "bullish" | "bearish";
  sweptLevel: number;
  sweepExtreme: number;
  sweepIndex: number;
  sweepTime: number;
  sweepDepthPercent: number;
  recovered: boolean;
}): LiquiditySweep {
  const { type, sweptLevel, sweepExtreme, sweepIndex, sweepTime, sweepDepthPercent, recovered } =
    params;
  return {
    type,
    sweptLevel,
    sweepExtreme,
    sweepIndex,
    sweepTime,
    recovered,
    recoveredIndex: recovered ? sweepIndex : null,
    recoveredTime: recovered ? sweepTime : null,
    sweepDepthPercent,
  };
}

/**
 * Individual Liquidity Sweep
 */
export type LiquiditySweep = {
  /** Sweep type */
  type: "bullish" | "bearish";
  /** The swing level that was swept (broken and recovered) */
  sweptLevel: number;
  /** The extreme price reached during the sweep */
  sweepExtreme: number;
  /** Index where the sweep occurred */
  sweepIndex: number;
  /** Time when the sweep occurred */
  sweepTime: number;
  /** Whether price has recovered back past the swing level */
  recovered: boolean;
  /** Index where price recovered (null if not recovered) */
  recoveredIndex: number | null;
  /** Time when price recovered (null if not recovered) */
  recoveredTime: number | null;
  /** How far past the swing level price went (percentage) */
  sweepDepthPercent: number;
};

/**
 * Liquidity Sweep detection result
 */
export type LiquiditySweepValue = {
  /** Is there a new sweep on this bar? */
  isSweep: boolean;
  /** New sweep detected on this bar */
  sweep: LiquiditySweep | null;
  /** Recent sweeps (both recovered and unrecovered) */
  recentSweeps: LiquiditySweep[];
  /** Sweeps that recovered on this bar (good entry signals) */
  recoveredThisBar: LiquiditySweep[];
};

/**
 * Options for Liquidity Sweep detection
 */
export type LiquiditySweepOptions = {
  /** Swing detection period (default: 5) */
  swingPeriod?: number;
  /** Maximum bars to wait for recovery (default: 3) */
  maxRecoveryBars?: number;
  /** Maximum number of recent sweeps to track (default: 10) */
  maxTrackedSweeps?: number;
  /** Minimum sweep depth percentage to count as valid (default: 0) */
  minSweepDepth?: number;
};

/**
 * Detect Liquidity Sweeps
 *
 * A Liquidity Sweep is identified when:
 * 1. Price breaks past a swing high/low
 * 2. Price recovers back within the swing range
 *
 * This creates a false breakout pattern that often precedes
 * a strong move in the opposite direction.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Liquidity Sweep options
 * @returns Series of Liquidity Sweep values
 *
 * @example
 * ```ts
 * const sweeps = liquiditySweep(candles, { swingPeriod: 5 });
 *
 * const last = sweeps[sweeps.length - 1].value;
 *
 * // Check for sweep recovery (good entry signal)
 * if (last.recoveredThisBar.length > 0) {
 *   const sweep = last.recoveredThisBar[0];
 *   if (sweep.type === "bullish") {
 *     console.log("Bullish sweep recovered - potential long entry");
 *   }
 * }
 * ```
 */
export function liquiditySweep(
  candles: Candle[] | NormalizedCandle[],
  options: LiquiditySweepOptions = {},
): Series<LiquiditySweepValue> {
  const {
    swingPeriod = 5,
    maxRecoveryBars = 3,
    maxTrackedSweeps = 10,
    minSweepDepth = 0,
  } = options;

  if (swingPeriod < 1) throw new Error("swingPeriod must be at least 1");
  if (maxRecoveryBars < 1) throw new Error("maxRecoveryBars must be at least 1");
  if (maxTrackedSweeps < 1) throw new Error("maxTrackedSweeps must be at least 1");
  if (minSweepDepth < 0) throw new Error("minSweepDepth must be non-negative");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Get swing points
  const swings = swingPoints(normalized, {
    leftBars: swingPeriod,
    rightBars: swingPeriod,
  });

  const result: Series<LiquiditySweepValue> = [];

  // Track active swing levels and recent sweeps
  let recentSwingHigh: { level: number; index: number } | null = null;
  let recentSwingLow: { level: number; index: number } | null = null;
  let recentSweeps: LiquiditySweep[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    const swing = swings[i]?.value;

    let newSweep: LiquiditySweep | null = null;
    const recoveredThisBar: LiquiditySweep[] = [];

    // Check for bullish sweep (break below swing low, then recover)
    if (recentSwingLow && i > recentSwingLow.index) {
      const swingLowLevel = recentSwingLow.level;

      // Price broke below swing low
      if (candle.low < swingLowLevel) {
        const sweepDepth = ((swingLowLevel - candle.low) / swingLowLevel) * 100;

        if (sweepDepth >= minSweepDepth) {
          const recovered = candle.close > swingLowLevel;
          newSweep = createSweep({
            type: "bullish",
            sweptLevel: swingLowLevel,
            sweepExtreme: candle.low,
            sweepIndex: i,
            sweepTime: candle.time,
            sweepDepthPercent: sweepDepth,
            recovered,
          });
          if (recovered) {
            recoveredThisBar.push(newSweep);
          }
          recentSwingLow = null;
        }
      }
    }

    // Check for bearish sweep (break above swing high, then recover)
    if (!newSweep && recentSwingHigh && i > recentSwingHigh.index) {
      const swingHighLevel = recentSwingHigh.level;

      // Price broke above swing high
      if (candle.high > swingHighLevel) {
        const sweepDepth = ((candle.high - swingHighLevel) / swingHighLevel) * 100;

        if (sweepDepth >= minSweepDepth) {
          const recovered = candle.close < swingHighLevel;
          newSweep = createSweep({
            type: "bearish",
            sweptLevel: swingHighLevel,
            sweepExtreme: candle.high,
            sweepIndex: i,
            sweepTime: candle.time,
            sweepDepthPercent: sweepDepth,
            recovered,
          });
          if (recovered) {
            recoveredThisBar.push(newSweep);
          }
          recentSwingHigh = null;
        }
      }
    }

    // Check for delayed recovery of unrecovered sweeps
    recentSweeps = recentSweeps.filter((sweep) => {
      // Remove sweeps that are too old
      if (i - sweep.sweepIndex > maxRecoveryBars && !sweep.recovered) {
        return false;
      }

      // Check for recovery
      if (!sweep.recovered) {
        if (sweep.type === "bullish" && candle.close > sweep.sweptLevel) {
          sweep.recovered = true;
          sweep.recoveredIndex = i;
          sweep.recoveredTime = candle.time;
          recoveredThisBar.push(sweep);
        } else if (sweep.type === "bearish" && candle.close < sweep.sweptLevel) {
          sweep.recovered = true;
          sweep.recoveredIndex = i;
          sweep.recoveredTime = candle.time;
          recoveredThisBar.push(sweep);
        }
      }

      return true;
    });

    // Add new sweep to tracking
    if (newSweep) {
      recentSweeps.push(newSweep);
      if (recentSweeps.length > maxTrackedSweeps) {
        recentSweeps = recentSweeps.slice(-maxTrackedSweeps);
      }
    }

    // Update tracked swing levels for next iteration
    // (After sweep checks to avoid overwriting the level we just swept)
    if (swing?.isSwingHigh && swing.swingHighPrice !== null) {
      recentSwingHigh = { level: swing.swingHighPrice, index: i };
    }
    if (swing?.isSwingLow && swing.swingLowPrice !== null) {
      recentSwingLow = { level: swing.swingLowPrice, index: i };
    }

    result.push({
      time: candle.time,
      value: {
        isSweep: newSweep !== null,
        sweep: newSweep,
        recentSweeps: [...recentSweeps],
        recoveredThisBar,
      },
    });
  }

  return tagSeries(result, { overlay: true, label: "Liq Sweep" });
}

/**
 * Get all recovered sweeps from a series
 */
export function getRecoveredSweeps(
  candles: Candle[] | NormalizedCandle[],
  options: LiquiditySweepOptions = {},
): { bullish: LiquiditySweep[]; bearish: LiquiditySweep[] } {
  const series = liquiditySweep(candles, options);

  const bullish: LiquiditySweep[] = [];
  const bearish: LiquiditySweep[] = [];

  for (const item of series) {
    for (const sweep of item.value.recoveredThisBar) {
      if (sweep.type === "bullish") {
        bullish.push(sweep);
      } else {
        bearish.push(sweep);
      }
    }
  }

  return { bullish, bearish };
}

/**
 * Check if there's a recent sweep at the current bar that could signal an entry
 */
export function hasRecentSweepSignal(
  candles: Candle[] | NormalizedCandle[],
  type: "bullish" | "bearish" | "both" = "both",
  options: LiquiditySweepOptions = {},
): boolean {
  const series = liquiditySweep(candles, options);

  if (series.length === 0) {
    return false;
  }

  const last = series[series.length - 1].value;

  if (type === "both") {
    return last.recoveredThisBar.length > 0;
  }

  return last.recoveredThisBar.some((s) => s.type === type);
}
