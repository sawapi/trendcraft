/**
 * Fibonacci Extension
 *
 * Calculates extension levels from a three-point pattern (A→B→C).
 * - Bullish: Low→High→Low → extension targets above C
 * - Bearish: High→Low→High → extension targets below C
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { swingPoints } from "./swing-points";

/**
 * Options for Fibonacci extension calculation
 */
export type FibonacciExtensionOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
  /** Extension ratio levels (default: [0, 0.618, 1, 1.272, 1.618, 2, 2.618]) */
  levels?: number[];
};

/**
 * Fibonacci extension result for each bar
 */
export type FibonacciExtensionValue = {
  /** Extension levels mapped by ratio string to price value, null if not enough data */
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

const DEFAULT_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];

/**
 * Calculate Fibonacci extension levels from three alternating swing points
 *
 * Uses the last 3 alternating swing points to determine A→B→C pattern:
 * - Low→High→Low = bullish extension (targets above C)
 * - High→Low→High = bearish extension (targets below C)
 *
 * Validates that C is between A and B (valid retracement).
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Fibonacci extension options
 * @returns Series of Fibonacci extension values
 *
 * @example
 * ```ts
 * const ext = fibonacciExtension(candles, { leftBars: 10, rightBars: 10 });
 * const last = ext[ext.length - 1].value;
 * if (last.levels) {
 *   console.log(`161.8% target: ${last.levels["1.618"]}`);
 *   console.log(`Direction: ${last.direction}`);
 * }
 * ```
 */
export function fibonacciExtension(
  candles: Candle[] | NormalizedCandle[],
  options: FibonacciExtensionOptions = {},
): Series<FibonacciExtensionValue> {
  const { leftBars = 10, rightBars = 10, levels = DEFAULT_LEVELS } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const swings = swingPoints(normalized, { leftBars, rightBars });

  const result: Series<FibonacciExtensionValue> = [];

  // Track alternating points incrementally
  const alternating: Array<{ index: number; price: number; type: "high" | "low" }> = [];

  let currentLevels: Record<string, number> | null = null;
  let currentPointA: number | null = null;
  let currentPointB: number | null = null;
  let currentPointC: number | null = null;
  let currentDirection: "bullish" | "bearish" | null = null;
  let displayFromIdx = -1;

  for (let i = 0; i < swings.length; i++) {
    const sp = swings[i].value;

    let updated = false;

    if (sp.isSwingHigh) {
      const point = { index: i, price: normalized[i].high, type: "high" as const };
      if (alternating.length === 0 || alternating[alternating.length - 1].type !== "high") {
        alternating.push(point);
        updated = true;
      } else {
        // Same type consecutive: keep more extreme
        if (point.price > alternating[alternating.length - 1].price) {
          alternating[alternating.length - 1] = point;
          updated = true;
        }
      }
    }

    if (sp.isSwingLow) {
      const point = { index: i, price: normalized[i].low, type: "low" as const };
      if (alternating.length === 0 || alternating[alternating.length - 1].type !== "low") {
        alternating.push(point);
        updated = true;
      } else {
        // Same type consecutive: keep more extreme
        if (point.price < alternating[alternating.length - 1].price) {
          alternating[alternating.length - 1] = point;
          updated = true;
        }
      }
    }

    if (updated && alternating.length >= 3) {
      const a = alternating[alternating.length - 3];
      const b = alternating[alternating.length - 2];
      const c = alternating[alternating.length - 1];

      // Determine pattern
      let direction: "bullish" | "bearish" | null = null;
      if (a.type === "low" && b.type === "high" && c.type === "low") {
        direction = "bullish";
      } else if (a.type === "high" && b.type === "low" && c.type === "high") {
        direction = "bearish";
      }

      if (direction) {
        // Validate C is between A and B
        const validRetracement = direction === "bullish"
          ? (c.price > a.price && c.price < b.price)
          : (c.price < a.price && c.price > b.price);

        if (validRetracement) {
          const move = Math.abs(b.price - a.price);
          const levelMap: Record<string, number> = {};

          for (const ratio of levels) {
            if (direction === "bullish") {
              levelMap[String(ratio)] = c.price + ratio * move;
            } else {
              levelMap[String(ratio)] = c.price - ratio * move;
            }
          }

          currentLevels = levelMap;
          currentPointA = a.price;
          currentPointB = b.price;
          currentPointC = c.price;
          currentDirection = direction;
          displayFromIdx = c.index;
        }
      }
    }

    result.push({
      time: swings[i].time,
      value: {
        levels: (displayFromIdx >= 0 && i >= displayFromIdx) ? currentLevels : null,
        pointA: (displayFromIdx >= 0 && i >= displayFromIdx) ? currentPointA : null,
        pointB: (displayFromIdx >= 0 && i >= displayFromIdx) ? currentPointB : null,
        pointC: (displayFromIdx >= 0 && i >= displayFromIdx) ? currentPointC : null,
        direction: (displayFromIdx >= 0 && i >= displayFromIdx) ? currentDirection : null,
      },
    });
  }

  return result;
}
