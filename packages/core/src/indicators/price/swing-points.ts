/**
 * Swing Points Detection
 *
 * Identifies swing highs and swing lows in price data.
 * A swing high is a bar with a higher high than the surrounding bars.
 * A swing low is a bar with a lower low than the surrounding bars.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Swing point detection result
 */
export type SwingPointValue = {
  /** Is this bar a confirmed swing high? */
  isSwingHigh: boolean;
  /** Is this bar a confirmed swing low? */
  isSwingLow: boolean;
  /** Price of the most recent swing high */
  swingHighPrice: number | null;
  /** Price of the most recent swing low */
  swingLowPrice: number | null;
  /** Bars since the most recent swing high */
  swingHighIndex: number | null;
  /** Bars since the most recent swing low */
  swingLowIndex: number | null;
};

/**
 * Options for swing point detection
 */
export type SwingPointOptions = {
  /** Number of bars to the left for confirmation (default: 5) */
  leftBars?: number;
  /** Number of bars to the right for confirmation (default: 5) */
  rightBars?: number;
};

/**
 * Detect swing highs and swing lows
 *
 * A swing high is confirmed when:
 * - The bar's high is higher than all bars within leftBars to the left
 * - The bar's high is higher than all bars within rightBars to the right
 *
 * A swing low is confirmed when:
 * - The bar's low is lower than all bars within leftBars to the left
 * - The bar's low is lower than all bars within rightBars to the right
 *
 * Note: Swing points are confirmed with a delay of rightBars.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Swing point options
 * @returns Series of swing point values
 *
 * @example
 * ```ts
 * const swings = swingPoints(candles, { leftBars: 5, rightBars: 5 });
 *
 * // Find all swing highs
 * const swingHighs = swings.filter(s => s.value.isSwingHigh);
 *
 * // Get current swing levels
 * const lastSwing = swings[swings.length - 1].value;
 * console.log(`Last swing high: ${lastSwing.swingHighPrice}`);
 * console.log(`Last swing low: ${lastSwing.swingLowPrice}`);
 * ```
 */
export function swingPoints(
  candles: Candle[] | NormalizedCandle[],
  options: SwingPointOptions = {},
): Series<SwingPointValue> {
  const { leftBars = 5, rightBars = 5 } = options;

  if (leftBars < 1) throw new Error("leftBars must be at least 1");
  if (rightBars < 1) throw new Error("rightBars must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // First pass: identify all swing points
  const swingHighs: boolean[] = new Array(normalized.length).fill(false);
  const swingLows: boolean[] = new Array(normalized.length).fill(false);

  for (let i = leftBars; i < normalized.length - rightBars; i++) {
    const pivotHigh = normalized[i].high;
    const pivotLow = normalized[i].low;

    let isSwingHigh = true;
    let isSwingLow = true;

    // Check left bars
    for (let j = 1; j <= leftBars; j++) {
      if (normalized[i - j].high >= pivotHigh) {
        isSwingHigh = false;
      }
      if (normalized[i - j].low <= pivotLow) {
        isSwingLow = false;
      }
    }

    // Check right bars
    for (let j = 1; j <= rightBars; j++) {
      if (normalized[i + j].high >= pivotHigh) {
        isSwingHigh = false;
      }
      if (normalized[i + j].low <= pivotLow) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      swingHighs[i] = true;
    }
    if (isSwingLow) {
      swingLows[i] = true;
    }
  }

  // Second pass: build result with tracking
  const result: Series<SwingPointValue> = [];
  let lastSwingHighPrice: number | null = null;
  let lastSwingLowPrice: number | null = null;
  let lastSwingHighIdx: number | null = null;
  let lastSwingLowIdx: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    // Update tracking when we pass a swing point
    if (swingHighs[i]) {
      lastSwingHighPrice = normalized[i].high;
      lastSwingHighIdx = i;
    }
    if (swingLows[i]) {
      lastSwingLowPrice = normalized[i].low;
      lastSwingLowIdx = i;
    }

    result.push({
      time: normalized[i].time,
      value: {
        isSwingHigh: swingHighs[i],
        isSwingLow: swingLows[i],
        swingHighPrice: lastSwingHighPrice,
        swingLowPrice: lastSwingLowPrice,
        swingHighIndex: lastSwingHighIdx !== null ? i - lastSwingHighIdx : null,
        swingLowIndex: lastSwingLowIdx !== null ? i - lastSwingLowIdx : null,
      },
    });
  }

  return tagSeries(result, { kind: "swingPoints", overlay: true, label: "Swing Points" });
}

/**
 * Get only swing high points from the series
 */
export function getSwingHighs(
  candles: Candle[] | NormalizedCandle[],
  options: SwingPointOptions = {},
): Array<{ time: number; price: number; index: number }> {
  const swings = swingPoints(candles, options);
  const result: Array<{ time: number; price: number; index: number }> = [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  for (let i = 0; i < swings.length; i++) {
    if (swings[i].value.isSwingHigh) {
      result.push({
        time: swings[i].time,
        price: normalized[i].high,
        index: i,
      });
    }
  }

  return result;
}

/**
 * Get only swing low points from the series
 */
/**
 * A swing point with alternating high/low pattern
 */
export type AlternatingSwingPoint = {
  time: number;
  price: number;
  index: number;
  type: "high" | "low";
};

/**
 * Get the last N alternating swing points (high-low-high or low-high-low).
 *
 * Collects all swing points in chronological order, merges consecutive
 * same-type points (keeping the most extreme), and returns the last
 * `count` points in time order.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param count - Number of alternating points to return
 * @param options - Swing point options
 * @returns Array of alternating swing points (up to `count`), time-ordered
 *
 * @example
 * ```ts
 * const points = getAlternatingSwingPoints(candles, 3, { leftBars: 10, rightBars: 10 });
 * // points = [{ type: "low", ... }, { type: "high", ... }, { type: "low", ... }]
 * ```
 */
export function getAlternatingSwingPoints(
  candles: Candle[] | NormalizedCandle[],
  count: number,
  options: SwingPointOptions = {},
): AlternatingSwingPoint[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0 || count <= 0) {
    return [];
  }

  const swings = swingPoints(normalized, options);

  // Collect all swing points in order
  const allPoints: AlternatingSwingPoint[] = [];
  for (let i = 0; i < swings.length; i++) {
    const sp = swings[i].value;
    if (sp.isSwingHigh) {
      allPoints.push({
        time: swings[i].time,
        price: normalized[i].high,
        index: i,
        type: "high",
      });
    }
    if (sp.isSwingLow) {
      allPoints.push({
        time: swings[i].time,
        price: normalized[i].low,
        index: i,
        type: "low",
      });
    }
  }

  if (allPoints.length === 0) {
    return [];
  }

  // Sort by index (should already be, but ensure for same-bar high+low)
  allPoints.sort((a, b) => a.index - b.index);

  // Merge consecutive same-type points: keep the most extreme value
  const merged: AlternatingSwingPoint[] = [allPoints[0]];
  for (let i = 1; i < allPoints.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = allPoints[i];
    if (curr.type === prev.type) {
      // Same type: keep more extreme
      if (curr.type === "high" && curr.price > prev.price) {
        merged[merged.length - 1] = curr;
      } else if (curr.type === "low" && curr.price < prev.price) {
        merged[merged.length - 1] = curr;
      }
    } else {
      merged.push(curr);
    }
  }

  // Return last `count` points
  return merged.slice(-count);
}

export function getSwingLows(
  candles: Candle[] | NormalizedCandle[],
  options: SwingPointOptions = {},
): Array<{ time: number; price: number; index: number }> {
  const swings = swingPoints(candles, options);
  const result: Array<{ time: number; price: number; index: number }> = [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  for (let i = 0; i < swings.length; i++) {
    if (swings[i].value.isSwingLow) {
      result.push({
        time: swings[i].time,
        price: normalized[i].low,
        index: i,
      });
    }
  }

  return result;
}
