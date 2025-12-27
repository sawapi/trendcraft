/**
 * Swing Points Detection
 *
 * Identifies swing highs and swing lows in price data.
 * A swing high is a bar with a higher high than the surrounding bars.
 * A swing low is a bar with a lower low than the surrounding bars.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
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

  return result;
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
