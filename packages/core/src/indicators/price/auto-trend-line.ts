/**
 * Auto Trend Line
 *
 * Draws resistance line through the last two swing highs
 * and support line through the last two swing lows.
 * Lines are interpolated across all bars as a standard line series.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { swingPoints } from "./swing-points";

/**
 * Options for auto trend line calculation
 */
export type AutoTrendLineOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
};

/**
 * Auto trend line result for each bar
 */
export type AutoTrendLineValue = {
  /** Resistance line value (interpolated), null before enough data */
  resistance: number | null;
  /** Support line value (interpolated), null before enough data */
  support: number | null;
};

/**
 * Calculate auto trend lines from swing points
 *
 * Connects the last two swing highs to form a resistance trend line
 * and the last two swing lows to form a support trend line. Lines are
 * drawn from the first anchor point onward and updated as new swing
 * points are confirmed.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Auto trend line options
 * @returns Series of auto trend line values
 *
 * @example
 * ```ts
 * const tl = autoTrendLine(candles, { leftBars: 10, rightBars: 10 });
 * const last = tl[tl.length - 1].value;
 * console.log(`Resistance: ${last.resistance}, Support: ${last.support}`);
 * ```
 */
export function autoTrendLine(
  candles: Candle[] | NormalizedCandle[],
  options: AutoTrendLineOptions = {},
): Series<AutoTrendLineValue> {
  const { leftBars = 10, rightBars = 10 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const swings = swingPoints(normalized, { leftBars, rightBars });

  const result: Series<AutoTrendLineValue> = [];

  // Track swing highs and lows
  const swingHighs: Array<{ index: number; price: number }> = [];
  const swingLows: Array<{ index: number; price: number }> = [];

  // Current line parameters
  let resSlope = 0;
  let resAnchorIdx = 0;
  let resAnchorPrice = 0;
  let hasResistance = false;

  let supSlope = 0;
  let supAnchorIdx = 0;
  let supAnchorPrice = 0;
  let hasSupport = false;

  for (let i = 0; i < swings.length; i++) {
    const sp = swings[i].value;

    if (sp.isSwingHigh) {
      swingHighs.push({ index: i, price: normalized[i].high });
      if (swingHighs.length >= 2) {
        const p1 = swingHighs[swingHighs.length - 2];
        const p2 = swingHighs[swingHighs.length - 1];
        resSlope = (p2.price - p1.price) / (p2.index - p1.index);
        resAnchorIdx = p1.index;
        resAnchorPrice = p1.price;
        hasResistance = true;
      }
    }

    if (sp.isSwingLow) {
      swingLows.push({ index: i, price: normalized[i].low });
      if (swingLows.length >= 2) {
        const p1 = swingLows[swingLows.length - 2];
        const p2 = swingLows[swingLows.length - 1];
        supSlope = (p2.price - p1.price) / (p2.index - p1.index);
        supAnchorIdx = p1.index;
        supAnchorPrice = p1.price;
        hasSupport = true;
      }
    }

    const resistance =
      hasResistance && i >= resAnchorIdx ? resAnchorPrice + resSlope * (i - resAnchorIdx) : null;

    const support =
      hasSupport && i >= supAnchorIdx ? supAnchorPrice + supSlope * (i - supAnchorIdx) : null;

    result.push({
      time: swings[i].time,
      value: { resistance, support },
    });
  }

  return tagSeries(result, { pane: "main", label: "Trend Lines" });
}
