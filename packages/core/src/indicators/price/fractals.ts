/**
 * Bill Williams Fractals
 *
 * Identifies fractal patterns in price data. A fractal is a series of
 * at least 5 bars where the middle bar has the highest high (up fractal)
 * or the lowest low (down fractal) compared to surrounding bars.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Fractal detection result
 */
export type FractalValue = {
  /** Whether this bar is an up fractal (swing high) */
  upFractal: boolean;
  /** Whether this bar is a down fractal (swing low) */
  downFractal: boolean;
  /** Price of the up fractal (high), null if not a fractal */
  upPrice: number | null;
  /** Price of the down fractal (low), null if not a fractal */
  downPrice: number | null;
};

/**
 * Options for fractal detection
 */
export type FractalOptions = {
  /** Number of bars on each side for comparison (default: 2) */
  period?: number;
};

/**
 * Detect Bill Williams Fractals
 *
 * An up fractal occurs when a bar's high is higher than
 * the highs of `period` bars on each side.
 * A down fractal occurs when a bar's low is lower than
 * the lows of `period` bars on each side.
 *
 * With default period=2, this creates the classic 5-bar fractal pattern.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Fractal options
 * @returns Series of fractal values
 *
 * @example
 * ```ts
 * const fractalData = fractals(candles);
 *
 * // Find fractal signals
 * for (const point of fractalData) {
 *   if (point.value.upFractal) {
 *     console.log(`Up fractal at ${point.value.upPrice}`);
 *   }
 *   if (point.value.downFractal) {
 *     console.log(`Down fractal at ${point.value.downPrice}`);
 *   }
 * }
 * ```
 */
export function fractals(
  candles: Candle[] | NormalizedCandle[],
  options: FractalOptions = {},
): Series<FractalValue> {
  const { period = 2 } = options;

  if (period < 1) {
    throw new Error("Fractals period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<FractalValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    let upFractal = false;
    let downFractal = false;

    // Check if we have enough bars on both sides
    if (i >= period && i < normalized.length - period) {
      const currentHigh = normalized[i].high;
      const currentLow = normalized[i].low;

      let isHighest = true;
      let isLowest = true;

      for (let j = 1; j <= period; j++) {
        // Check left side
        if (normalized[i - j].high >= currentHigh) isHighest = false;
        if (normalized[i - j].low <= currentLow) isLowest = false;

        // Check right side
        if (normalized[i + j].high >= currentHigh) isHighest = false;
        if (normalized[i + j].low <= currentLow) isLowest = false;
      }

      upFractal = isHighest;
      downFractal = isLowest;
    }

    result.push({
      time: normalized[i].time,
      value: {
        upFractal,
        downFractal,
        upPrice: upFractal ? normalized[i].high : null,
        downPrice: downFractal ? normalized[i].low : null,
      },
    });
  }

  return tagSeries(result, { overlay: true, label: "Fractals" });
}
