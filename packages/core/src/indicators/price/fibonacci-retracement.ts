/**
 * Fibonacci Retracement
 *
 * Calculates Fibonacci retracement levels between the most recent
 * swing high and swing low. Automatically detects swing points and
 * determines trend direction based on which swing occurred more recently.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { swingPoints } from "./swing-points";

/**
 * Options for Fibonacci retracement calculation
 */
export type FibonacciRetracementOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
  /** Fibonacci ratio levels to calculate (default: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]) */
  levels?: number[];
};

/**
 * Fibonacci retracement result for each bar
 */
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

const DEFAULT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * Calculate Fibonacci retracement levels based on swing points
 *
 * Uses swing point detection to find the most recent swing high and swing low,
 * then calculates retracement levels between them.
 *
 * - When swing high is more recent (uptrend): 0% = high, 100% = low
 * - When swing low is more recent (downtrend): 0% = low, 100% = high
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Fibonacci retracement options
 * @returns Series of Fibonacci retracement values
 *
 * @example
 * ```ts
 * const fib = fibonacciRetracement(candles, { leftBars: 10, rightBars: 10 });
 * const last = fib[fib.length - 1].value;
 * if (last.levels) {
 *   console.log(`61.8% level: ${last.levels["0.618"]}`);
 *   console.log(`Trend: ${last.trend}`);
 * }
 * ```
 */
export function fibonacciRetracement(
  candles: Candle[] | NormalizedCandle[],
  options: FibonacciRetracementOptions = {},
): Series<FibonacciRetracementValue> {
  const { leftBars = 10, rightBars = 10, levels = DEFAULT_LEVELS } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Detect swing points once
  const swings = swingPoints(normalized, { leftBars, rightBars });

  const result: Series<FibonacciRetracementValue> = [];

  let lastSwingHighPrice: number | null = null;
  let lastSwingLowPrice: number | null = null;
  let lastSwingHighIdx: number | null = null;
  let lastSwingLowIdx: number | null = null;

  for (let i = 0; i < swings.length; i++) {
    const sp = swings[i].value;

    // Track swing points as they are confirmed
    if (sp.isSwingHigh) {
      lastSwingHighPrice = normalized[i].high;
      lastSwingHighIdx = i;
    }
    if (sp.isSwingLow) {
      lastSwingLowPrice = normalized[i].low;
      lastSwingLowIdx = i;
    }

    // Need both swing high and low to calculate levels
    if (
      lastSwingHighPrice === null ||
      lastSwingLowPrice === null ||
      lastSwingHighIdx === null ||
      lastSwingLowIdx === null
    ) {
      result.push({
        time: swings[i].time,
        value: {
          levels: null,
          swingHigh: lastSwingHighPrice,
          swingLow: lastSwingLowPrice,
          trend: null,
        },
      });
      continue;
    }

    // Determine trend direction
    const trend: "up" | "down" = lastSwingHighIdx > lastSwingLowIdx ? "up" : "down";
    const range = lastSwingHighPrice - lastSwingLowPrice;

    // Calculate levels
    const levelMap: Record<string, number> = {};
    for (const ratio of levels) {
      if (trend === "up") {
        // Uptrend: 0% = high (start), 100% = low (full retracement)
        levelMap[String(ratio)] = lastSwingHighPrice - ratio * range;
      } else {
        // Downtrend: 0% = low (start), 100% = high (full retracement)
        levelMap[String(ratio)] = lastSwingLowPrice + ratio * range;
      }
    }

    result.push({
      time: swings[i].time,
      value: {
        levels: levelMap,
        swingHigh: lastSwingHighPrice,
        swingLow: lastSwingLowPrice,
        trend,
      },
    });
  }

  return tagSeries(result, { pane: "main", label: "Fib" });
}
