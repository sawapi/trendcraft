/**
 * Andrew's Pitchfork
 *
 * Draws a median line from pivot P0 through the midpoint of P1-P2,
 * plus upper and lower handle lines parallel to the median.
 * Uses the last 3 alternating swing points (P0, P1, P2).
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { swingPoints } from "./swing-points";

/**
 * Options for Andrew's Pitchfork calculation
 */
export type AndrewsPitchforkOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
};

/**
 * Andrew's Pitchfork result for each bar
 */
export type AndrewsPitchforkValue = {
  /** Median line value */
  median: number | null;
  /** Upper handle line value */
  upper: number | null;
  /** Lower handle line value */
  lower: number | null;
};

/**
 * Calculate Andrew's Pitchfork from three alternating swing points
 *
 * Given three pivot points P0, P1, P2 (alternating swing highs/lows):
 * - Median line: from P0 through midpoint of P1 and P2
 * - Upper handle: parallel to median, passing through the higher of P1/P2
 * - Lower handle: parallel to median, passing through the lower of P1/P2
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Andrew's Pitchfork options
 * @returns Series of Pitchfork values
 *
 * @example
 * ```ts
 * const pf = andrewsPitchfork(candles, { leftBars: 10, rightBars: 10 });
 * const last = pf[pf.length - 1].value;
 * console.log(`Median: ${last.median}, Upper: ${last.upper}, Lower: ${last.lower}`);
 * ```
 */
export function andrewsPitchfork(
  candles: Candle[] | NormalizedCandle[],
  options: AndrewsPitchforkOptions = {},
): Series<AndrewsPitchforkValue> {
  const { leftBars = 10, rightBars = 10 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const swings = swingPoints(normalized, { leftBars, rightBars });

  const result: Series<AndrewsPitchforkValue> = [];

  // Track alternating points incrementally
  const alternating: Array<{ index: number; price: number; type: "high" | "low" }> = [];

  // Current pitchfork parameters
  let pfDefined = false;
  let pfSlope = 0;
  let pfP0Idx = 0;
  let pfP0Price = 0;
  let pfUpperOffset = 0;
  let pfLowerOffset = 0;

  for (let i = 0; i < swings.length; i++) {
    const sp = swings[i].value;

    let updated = false;

    if (sp.isSwingHigh) {
      const point = { index: i, price: normalized[i].high, type: "high" as const };
      if (alternating.length === 0 || alternating[alternating.length - 1].type !== "high") {
        alternating.push(point);
        updated = true;
      } else {
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
        if (point.price < alternating[alternating.length - 1].price) {
          alternating[alternating.length - 1] = point;
          updated = true;
        }
      }
    }

    if (updated && alternating.length >= 3) {
      const p0 = alternating[alternating.length - 3];
      const p1 = alternating[alternating.length - 2];
      const p2 = alternating[alternating.length - 1];

      // Midpoint of P1 and P2
      const midIndex = (p1.index + p2.index) / 2;
      const midPrice = (p1.price + p2.price) / 2;

      // Median line: P0 → M
      const dIdx = midIndex - p0.index;
      if (dIdx !== 0) {
        pfSlope = (midPrice - p0.price) / dIdx;
        pfP0Idx = p0.index;
        pfP0Price = p0.price;

        // Upper and lower offsets
        const upperPoint = p1.price >= p2.price ? p1 : p2;
        const lowerPoint = p1.price < p2.price ? p1 : p2;

        const medianAtUpper = pfP0Price + pfSlope * (upperPoint.index - pfP0Idx);
        const medianAtLower = pfP0Price + pfSlope * (lowerPoint.index - pfP0Idx);

        pfUpperOffset = upperPoint.price - medianAtUpper;
        pfLowerOffset = lowerPoint.price - medianAtLower;
        pfDefined = true;
      }
    }

    if (pfDefined && i >= pfP0Idx) {
      const median = pfP0Price + pfSlope * (i - pfP0Idx);
      const upper = median + pfUpperOffset;
      const lower = median + pfLowerOffset;

      result.push({
        time: swings[i].time,
        value: { median, upper, lower },
      });
    } else {
      result.push({
        time: swings[i].time,
        value: { median: null, upper: null, lower: null },
      });
    }
  }

  return result;
}
