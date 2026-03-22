/**
 * Volume Moving Average Cross Detection
 *
 * Detects when short-term volume MA crosses above long-term volume MA,
 * indicating a shift in trading activity that often precedes price moves.
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Volume MA cross signal
 */
export type VolumeMaCrossSignal = {
  /** Timestamp of the cross detection */
  time: number;
  /** Signal type */
  type: "volume_ma_cross";
  /** Current volume */
  volume: number;
  /** Short-term MA value */
  shortMa: number;
  /** Long-term MA value */
  longMa: number;
  /** Cross direction: "bullish" = short crosses above long */
  direction: "bullish" | "bearish";
  /** Ratio of short MA to long MA */
  ratio: number;
  /** Number of consecutive days above/below since cross */
  daysSinceCross: number;
};

/**
 * Options for volume MA cross detection
 */
export type VolumeMaCrossOptions = {
  /** Short-term MA period (default: 5) */
  shortPeriod?: number;
  /** Long-term MA period (default: 20) */
  longPeriod?: number;
  /** Minimum ratio of short/long MA to qualify (default: 1.0) */
  minRatio?: number;
  /** Only detect bullish crosses (default: true) */
  bullishOnly?: boolean;
};

/**
 * Calculate simple moving average using sliding window (O(1) per step)
 */
function calculateSmaArray(volumes: number[], period: number): number[] {
  const result: number[] = new Array(volumes.length).fill(0);
  if (volumes.length < period) return result;

  // Calculate first SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += volumes[i];
  }
  result[period - 1] = sum / period;

  // Sliding window for remaining
  for (let i = period; i < volumes.length; i++) {
    sum = sum - volumes[i - period] + volumes[i];
    result[i] = sum / period;
  }

  return result;
}

/**
 * Detect volume MA cross signals
 *
 * Identifies when the short-term volume moving average crosses above
 * the long-term volume moving average, suggesting increased trading activity.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Detection options
 * @returns Array of volume MA cross signals
 *
 * @example
 * ```ts
 * const signals = volumeMaCross(candles, {
 *   shortPeriod: 5,
 *   longPeriod: 20,
 *   minRatio: 1.2
 * });
 *
 * signals.forEach(s => {
 *   console.log(`Volume MA cross at ${new Date(s.time)}: ${s.ratio.toFixed(2)}x`);
 * });
 * ```
 */
export function volumeMaCross(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeMaCrossOptions = {},
): VolumeMaCrossSignal[] {
  const { shortPeriod = 5, longPeriod = 20, minRatio = 1.0, bullishOnly = true } = options;

  if (shortPeriod < 1) {
    throw new Error("Short period must be at least 1");
  }
  if (longPeriod <= shortPeriod) {
    throw new Error("Long period must be greater than short period");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length <= longPeriod) {
    return [];
  }

  const results: VolumeMaCrossSignal[] = [];

  // Pre-calculate all volumes and SMAs (O(n) instead of O(n²))
  const volumes = normalized.map((c) => c.volume);
  const shortMaArray = calculateSmaArray(volumes, shortPeriod);
  const longMaArray = calculateSmaArray(volumes, longPeriod);

  // Track state for consecutive days
  let prevShortMa = 0;
  let prevLongMa = 0;
  let daysSinceCross = 0;
  let currentDirection: "bullish" | "bearish" | null = null;

  for (let i = longPeriod; i < normalized.length; i++) {
    const shortMa = shortMaArray[i];
    const longMa = longMaArray[i];

    const ratio = longMa > 0 ? shortMa / longMa : 0;
    const isBullish = shortMa > longMa;

    // Detect cross
    const wasBullish = prevShortMa > prevLongMa;
    const crossedBullish = !wasBullish && isBullish && prevLongMa > 0;
    const crossedBearish = wasBullish && !isBullish && prevLongMa > 0;

    if (crossedBullish) {
      currentDirection = "bullish";
      daysSinceCross = 1;
    } else if (crossedBearish) {
      currentDirection = "bearish";
      daysSinceCross = 1;
    } else if (currentDirection === "bullish" && isBullish) {
      daysSinceCross++;
    } else if (currentDirection === "bearish" && !isBullish) {
      daysSinceCross++;
    } else {
      // Direction changed without clear cross or no active state
      if (
        (currentDirection === "bullish" && !isBullish) ||
        (currentDirection === "bearish" && isBullish)
      ) {
        currentDirection = null;
        daysSinceCross = 0;
      }
    }

    // Output signal at cross point and while condition holds
    if (currentDirection === "bullish" && ratio >= minRatio) {
      results.push({
        time: normalized[i].time,
        type: "volume_ma_cross",
        volume: normalized[i].volume,
        shortMa,
        longMa,
        direction: "bullish",
        ratio,
        daysSinceCross,
      });
    } else if (!bullishOnly && currentDirection === "bearish") {
      results.push({
        time: normalized[i].time,
        type: "volume_ma_cross",
        volume: normalized[i].volume,
        shortMa,
        longMa,
        direction: "bearish",
        ratio,
        daysSinceCross,
      });
    }

    prevShortMa = shortMa;
    prevLongMa = longMa;
  }

  return results;
}
