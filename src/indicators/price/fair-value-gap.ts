/**
 * Fair Value Gap (FVG) Detection
 *
 * Identifies price imbalances where there is a gap between
 * candle wicks, indicating areas of unfilled orders.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Individual FVG gap
 */
export type FvgGap = {
  /** Gap type */
  type: "bullish" | "bearish";
  /** Upper boundary of the gap */
  high: number;
  /** Lower boundary of the gap */
  low: number;
  /** Index where the gap was created */
  startIndex: number;
  /** Time when the gap was created */
  startTime: number;
  /** Whether the gap has been filled */
  filled: boolean;
  /** Index where the gap was filled (null if not filled) */
  filledIndex: number | null;
  /** Time when the gap was filled (null if not filled) */
  filledTime: number | null;
};

/**
 * FVG detection result
 */
export type FvgValue = {
  /** New bullish FVG created at this bar */
  newBullishFvg: boolean;
  /** New bearish FVG created at this bar */
  newBearishFvg: boolean;
  /** The new FVG if one was created */
  newFvg: FvgGap | null;
  /** Currently active (unfilled) bullish FVGs */
  activeBullishFvgs: FvgGap[];
  /** Currently active (unfilled) bearish FVGs */
  activeBearishFvgs: FvgGap[];
  /** FVGs that were filled at this bar */
  filledFvgs: FvgGap[];
};

/**
 * Options for FVG detection
 */
export type FvgOptions = {
  /** Minimum gap size as percentage of price (default: 0) */
  minGapPercent?: number;
  /** Maximum number of active FVGs to track (default: 10) */
  maxActiveFvgs?: number;
  /** Consider partial fill as filled (default: true) */
  partialFill?: boolean;
};

/**
 * Detect Fair Value Gaps
 *
 * A bullish FVG occurs when: candle[i-2].high < candle[i].low
 * (Gap between the first candle's high and third candle's low)
 *
 * A bearish FVG occurs when: candle[i-2].low > candle[i].high
 * (Gap between the first candle's low and third candle's high)
 *
 * FVGs are areas of imbalance that price often revisits.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - FVG options
 * @returns Series of FVG values
 *
 * @example
 * ```ts
 * const fvg = fairValueGap(candles, { minGapPercent: 0.1 });
 *
 * const lastFvg = fvg[fvg.length - 1].value;
 *
 * // Check for new FVG
 * if (lastFvg.newBullishFvg) {
 *   console.log(`New bullish FVG: ${lastFvg.newFvg?.low} - ${lastFvg.newFvg?.high}`);
 * }
 *
 * // Get active FVGs for support/resistance
 * console.log(`Active bullish FVGs: ${lastFvg.activeBullishFvgs.length}`);
 * console.log(`Active bearish FVGs: ${lastFvg.activeBearishFvgs.length}`);
 * ```
 */
export function fairValueGap(
  candles: Candle[] | NormalizedCandle[],
  options: FvgOptions = {},
): Series<FvgValue> {
  const { minGapPercent = 0, maxActiveFvgs = 10, partialFill = true } = options;

  if (minGapPercent < 0) throw new Error("minGapPercent must be non-negative");
  if (maxActiveFvgs < 1) throw new Error("maxActiveFvgs must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<FvgValue> = [];

  // Track active FVGs
  let activeBullishFvgs: FvgGap[] = [];
  let activeBearishFvgs: FvgGap[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    let newBullishFvg = false;
    let newBearishFvg = false;
    let newFvg: FvgGap | null = null;
    const filledFvgs: FvgGap[] = [];

    // Check for new FVG (need at least 3 candles)
    if (i >= 2) {
      const candle0 = normalized[i - 2]; // First candle
      const candle2 = normalized[i]; // Third candle (current)

      // Bullish FVG: gap up
      if (candle0.high < candle2.low) {
        const gapSize = candle2.low - candle0.high;
        const gapPercent = (gapSize / candle0.high) * 100;

        if (gapPercent >= minGapPercent) {
          newBullishFvg = true;
          newFvg = {
            type: "bullish",
            high: candle2.low,
            low: candle0.high,
            startIndex: i,
            startTime: candle.time,
            filled: false,
            filledIndex: null,
            filledTime: null,
          };

          // Add to active list (maintain max limit)
          activeBullishFvgs.push(newFvg);
          if (activeBullishFvgs.length > maxActiveFvgs) {
            activeBullishFvgs = activeBullishFvgs.slice(-maxActiveFvgs);
          }
        }
      }

      // Bearish FVG: gap down
      if (candle0.low > candle2.high) {
        const gapSize = candle0.low - candle2.high;
        const gapPercent = (gapSize / candle0.low) * 100;

        if (gapPercent >= minGapPercent) {
          newBearishFvg = true;
          newFvg = {
            type: "bearish",
            high: candle0.low,
            low: candle2.high,
            startIndex: i,
            startTime: candle.time,
            filled: false,
            filledIndex: null,
            filledTime: null,
          };

          // Add to active list (maintain max limit)
          activeBearishFvgs.push(newFvg);
          if (activeBearishFvgs.length > maxActiveFvgs) {
            activeBearishFvgs = activeBearishFvgs.slice(-maxActiveFvgs);
          }
        }
      }
    }

    // Check for FVG fills (price enters the gap zone)
    // Bullish FVG filled when price goes down into the gap
    activeBullishFvgs = activeBullishFvgs.filter((fvg) => {
      const isFilled = partialFill
        ? candle.low <= fvg.high // Price touched the gap
        : candle.low <= fvg.low; // Price filled the entire gap

      if (isFilled && fvg.startIndex !== i) {
        // Don't fill on the same bar it was created
        fvg.filled = true;
        fvg.filledIndex = i;
        fvg.filledTime = candle.time;
        filledFvgs.push(fvg);
        return false; // Remove from active
      }
      return true;
    });

    // Bearish FVG filled when price goes up into the gap
    activeBearishFvgs = activeBearishFvgs.filter((fvg) => {
      const isFilled = partialFill
        ? candle.high >= fvg.low // Price touched the gap
        : candle.high >= fvg.high; // Price filled the entire gap

      if (isFilled && fvg.startIndex !== i) {
        // Don't fill on the same bar it was created
        fvg.filled = true;
        fvg.filledIndex = i;
        fvg.filledTime = candle.time;
        filledFvgs.push(fvg);
        return false; // Remove from active
      }
      return true;
    });

    result.push({
      time: candle.time,
      value: {
        newBullishFvg,
        newBearishFvg,
        newFvg,
        activeBullishFvgs: [...activeBullishFvgs],
        activeBearishFvgs: [...activeBearishFvgs],
        filledFvgs,
      },
    });
  }

  return result;
}

/**
 * Get all unfilled FVGs at the end of the series
 */
export function getUnfilledFvgs(
  candles: Candle[] | NormalizedCandle[],
  options: FvgOptions = {},
): { bullish: FvgGap[]; bearish: FvgGap[] } {
  const fvgSeries = fairValueGap(candles, options);

  if (fvgSeries.length === 0) {
    return { bullish: [], bearish: [] };
  }

  const last = fvgSeries[fvgSeries.length - 1].value;
  return {
    bullish: last.activeBullishFvgs,
    bearish: last.activeBearishFvgs,
  };
}

/**
 * Find nearest FVG to current price
 */
export function getNearestFvg(
  candles: Candle[] | NormalizedCandle[],
  options: FvgOptions = {},
): FvgGap | null {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return null;
  }

  const currentPrice = normalized[normalized.length - 1].close;
  const { bullish, bearish } = getUnfilledFvgs(candles, options);

  let nearestFvg: FvgGap | null = null;
  let minDistance = Infinity;

  // Check bullish FVGs (below price, support)
  for (const fvg of bullish) {
    const distance = Math.abs(currentPrice - fvg.high);
    if (distance < minDistance) {
      minDistance = distance;
      nearestFvg = fvg;
    }
  }

  // Check bearish FVGs (above price, resistance)
  for (const fvg of bearish) {
    const distance = Math.abs(currentPrice - fvg.low);
    if (distance < minDistance) {
      minDistance = distance;
      nearestFvg = fvg;
    }
  }

  return nearestFvg;
}
