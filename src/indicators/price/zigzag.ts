/**
 * Zigzag Indicator
 *
 * Connects significant swing points, filtering out noise smaller than
 * a specified percentage or ATR-based threshold. Useful for identifying
 * major price swings and wave structures.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Zigzag point value
 */
export type ZigzagValue = {
  /** Whether this bar is a zigzag pivot point ('high', 'low', or null) */
  point: "high" | "low" | null;
  /** Price of the pivot point, null if not a pivot */
  price: number | null;
  /** Percentage change from the previous pivot, null if not a pivot */
  changePercent: number | null;
};

/**
 * Zigzag options
 */
export type ZigzagOptions = {
  /** Minimum percentage deviation to confirm a swing (default: 5) */
  deviation?: number;
  /** Whether to use ATR-based threshold instead of percentage (default: false) */
  useAtr?: boolean;
  /** ATR period when useAtr is true (default: 14) */
  atrPeriod?: number;
  /** ATR multiplier when useAtr is true (default: 2) */
  atrMultiplier?: number;
};

/**
 * Calculate Zigzag indicator
 *
 * Identifies significant swing highs and lows by filtering out moves
 * smaller than the deviation threshold. The result connects only the
 * major turning points.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Zigzag options
 * @returns Series of zigzag values
 *
 * @example
 * ```ts
 * const zigzagData = zigzag(candles); // 5% deviation
 * const zigzagAtr = zigzag(candles, { useAtr: true, atrMultiplier: 2 });
 *
 * // Extract pivot points
 * const pivots = zigzagData.filter(z => z.value.point !== null);
 * ```
 */
export function zigzag(
  candles: Candle[] | NormalizedCandle[],
  options: ZigzagOptions = {},
): Series<ZigzagValue> {
  const { deviation = 5, useAtr = false, atrPeriod = 14, atrMultiplier = 2 } = options;

  if (deviation <= 0) {
    throw new Error("Zigzag deviation must be positive");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Initialize result with null values
  const result: Series<ZigzagValue> = normalized.map((c) => ({
    time: c.time,
    value: { point: null, price: null, changePercent: null },
  }));

  if (normalized.length < 2) {
    return result;
  }

  // Calculate ATR if needed
  let atrValues: number[] | null = null;
  if (useAtr) {
    atrValues = calculateSimpleAtr(normalized, atrPeriod);
  }

  // Track current zigzag state
  let trend: "up" | "down" | null = null;
  let lastPivotPrice = 0;
  let lastPivotIndex = 0;
  let currentHigh = normalized[0].high;
  let currentHighIndex = 0;
  let currentLow = normalized[0].low;
  let currentLowIndex = 0;

  for (let i = 1; i < normalized.length; i++) {
    const high = normalized[i].high;
    const low = normalized[i].low;

    // Get threshold for current bar
    const threshold = useAtr && atrValues && atrValues[i] > 0
      ? atrValues[i] * atrMultiplier
      : (lastPivotPrice || high) * (deviation / 100);

    if (trend === null) {
      // Initialize trend
      if (high > currentHigh) {
        currentHigh = high;
        currentHighIndex = i;
      }
      if (low < currentLow) {
        currentLow = low;
        currentLowIndex = i;
      }

      // Determine initial trend based on which extreme came first
      if (currentHigh - normalized[0].low >= threshold) {
        trend = "up";
        lastPivotPrice = currentLow;
        lastPivotIndex = currentLowIndex;
        result[currentLowIndex].value = {
          point: "low",
          price: currentLow,
          changePercent: null,
        };
      } else if (normalized[0].high - currentLow >= threshold) {
        trend = "down";
        lastPivotPrice = currentHigh;
        lastPivotIndex = currentHighIndex;
        result[currentHighIndex].value = {
          point: "high",
          price: currentHigh,
          changePercent: null,
        };
      }
      continue;
    }

    if (trend === "up") {
      if (high > currentHigh) {
        currentHigh = high;
        currentHighIndex = i;
      }

      // Check for reversal down
      const drop = currentHigh - low;
      const dropThreshold = useAtr && atrValues && atrValues[i] > 0
        ? atrValues[i] * atrMultiplier
        : currentHigh * (deviation / 100);

      if (drop >= dropThreshold) {
        // Mark the high as a pivot
        const changePct = lastPivotPrice > 0
          ? ((currentHigh - lastPivotPrice) / lastPivotPrice) * 100
          : null;
        result[currentHighIndex].value = {
          point: "high",
          price: currentHigh,
          changePercent: changePct,
        };

        lastPivotPrice = currentHigh;
        lastPivotIndex = currentHighIndex;
        trend = "down";
        currentLow = low;
        currentLowIndex = i;
      }
    } else {
      // trend === "down"
      if (low < currentLow) {
        currentLow = low;
        currentLowIndex = i;
      }

      // Check for reversal up
      const rise = high - currentLow;
      const riseThreshold = useAtr && atrValues && atrValues[i] > 0
        ? atrValues[i] * atrMultiplier
        : currentLow * (deviation / 100);

      if (rise >= riseThreshold) {
        // Mark the low as a pivot
        const changePct = lastPivotPrice > 0
          ? ((currentLow - lastPivotPrice) / lastPivotPrice) * 100
          : null;
        result[currentLowIndex].value = {
          point: "low",
          price: currentLow,
          changePercent: changePct,
        };

        lastPivotPrice = currentLow;
        lastPivotIndex = currentLowIndex;
        trend = "up";
        currentHigh = high;
        currentHighIndex = i;
      }
    }
  }

  return result;
}

/**
 * Simple ATR calculation for internal use (avoids circular dependency)
 */
function calculateSimpleAtr(candles: NormalizedCandle[], period: number): number[] {
  const result: number[] = new Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );

    if (i < period) {
      // Accumulate for initial average
      result[i] = result[i - 1] + tr;
      if (i === period - 1) {
        result[i] = (result[i]) / period;
      }
    } else if (i === period - 1) {
      result[i] = result[i] / period;
    } else {
      // Wilder's smoothing
      result[i] = (result[i - 1] * (period - 1) + tr) / period;
    }
  }

  return result;
}
