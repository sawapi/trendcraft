/**
 * Volume Profile
 *
 * Analyzes volume distribution across price levels to identify
 * significant support/resistance zones and the Point of Control (POC).
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type {
  Candle,
  NormalizedCandle,
  Series,
  VolumePriceLevel,
  VolumeProfileValue,
} from "../../types";

/**
 * Volume Profile options
 */
export type VolumeProfileOptions = {
  /** Number of price levels to divide the range (default: 24) */
  levels?: number;
  /** Percentage of volume that defines the Value Area (default: 0.70 = 70%) */
  valueAreaPercent?: number;
  /** Number of candles to include in the profile (default: all) */
  period?: number;
};

/**
 * Calculate Volume Profile for a given period
 *
 * The Volume Profile shows volume distribution by price level, helping identify:
 * - POC (Point of Control): Price level with highest volume - strong S/R
 * - Value Area: Range where 70% of volume occurred - fair value zone
 * - VAH (Value Area High): Upper bound of value area - resistance
 * - VAL (Value Area Low): Lower bound of value area - support
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Profile options
 * @returns Volume Profile result
 *
 * @example
 * ```ts
 * // Calculate profile for last 20 days
 * const profile = volumeProfile(candles, { period: 20 });
 *
 * console.log(`POC: ${profile.poc}`);
 * console.log(`Value Area: ${profile.val} - ${profile.vah}`);
 *
 * // Use for trading
 * if (currentPrice < profile.val) {
 *   console.log("Price below Value Area - potential long entry");
 * }
 * ```
 */
export function volumeProfile(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeProfileOptions = {},
): VolumeProfileValue {
  const { levels = 24, valueAreaPercent = 0.7, period } = options;

  if (levels < 2) {
    throw new Error("Volume profile must have at least 2 levels");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return createEmptyProfile();
  }

  // Use only the specified period (from the end)
  const periodCandles =
    period && period < normalized.length ? normalized.slice(-period) : normalized;

  if (periodCandles.length === 0) {
    return createEmptyProfile();
  }

  // Find price range
  let periodHigh = Number.NEGATIVE_INFINITY;
  let periodLow = Number.POSITIVE_INFINITY;

  for (const candle of periodCandles) {
    if (candle.high > periodHigh) periodHigh = candle.high;
    if (candle.low < periodLow) periodLow = candle.low;
  }

  // Handle edge case where all prices are the same
  if (periodHigh === periodLow) {
    const singleLevel: VolumePriceLevel = {
      priceLow: periodLow,
      priceHigh: periodHigh,
      priceMid: periodLow,
      volume: periodCandles.reduce((sum, c) => sum + c.volume, 0),
      volumePercent: 100,
    };

    return {
      levels: [singleLevel],
      poc: periodLow,
      vah: periodHigh,
      val: periodLow,
      periodHigh,
      periodLow,
    };
  }

  // Create price levels
  const priceRange = periodHigh - periodLow;
  const levelHeight = priceRange / levels;
  const volumeLevels: VolumePriceLevel[] = [];

  for (let i = 0; i < levels; i++) {
    volumeLevels.push({
      priceLow: periodLow + i * levelHeight,
      priceHigh: periodLow + (i + 1) * levelHeight,
      priceMid: periodLow + (i + 0.5) * levelHeight,
      volume: 0,
      volumePercent: 0,
    });
  }

  // Distribute volume to price levels
  // For each candle, distribute its volume across the price levels it touches
  let totalVolume = 0;

  for (const candle of periodCandles) {
    const candleVolume = candle.volume;
    totalVolume += candleVolume;

    // Find which levels this candle touches (from low to high)
    const candleLow = Math.min(candle.low, candle.high);
    const candleHigh = Math.max(candle.low, candle.high);
    const candleRange = candleHigh - candleLow;

    for (let i = 0; i < levels; i++) {
      const level = volumeLevels[i];

      // Check if candle overlaps with this level
      const overlapLow = Math.max(candleLow, level.priceLow);
      const overlapHigh = Math.min(candleHigh, level.priceHigh);

      if (overlapHigh > overlapLow) {
        // Calculate proportion of candle in this level
        const overlapRange = overlapHigh - overlapLow;
        const proportion = candleRange > 0 ? overlapRange / candleRange : 1 / levels;

        level.volume += candleVolume * proportion;
      }
    }
  }

  // Calculate volume percentages
  if (totalVolume > 0) {
    for (const level of volumeLevels) {
      level.volumePercent = (level.volume / totalVolume) * 100;
    }
  }

  // Find POC (Point of Control) - level with highest volume
  let maxVolumeLevel = volumeLevels[0];
  for (const level of volumeLevels) {
    if (level.volume > maxVolumeLevel.volume) {
      maxVolumeLevel = level;
    }
  }
  const poc = maxVolumeLevel.priceMid;

  // Calculate Value Area (70% of volume centered around POC)
  const { vah, val } = calculateValueArea(volumeLevels, valueAreaPercent, totalVolume);

  return {
    levels: volumeLevels,
    poc,
    vah,
    val,
    periodHigh,
    periodLow,
  };
}

/**
 * Calculate rolling Volume Profile series
 *
 * Computes Volume Profile for each candle using a rolling window,
 * useful for backtesting and dynamic analysis.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Profile options
 * @returns Series of Volume Profile values
 *
 * @example
 * ```ts
 * const profiles = volumeProfileSeries(candles, { period: 20 });
 *
 * // Track POC over time
 * const pocHistory = profiles.map(p => p.value?.poc);
 * ```
 */
export function volumeProfileSeries(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeProfileOptions = {},
): Series<VolumeProfileValue | null> {
  const { period = 20, levels = 24, valueAreaPercent = 0.7 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const len = normalized.length;

  if (len === 0) {
    return [];
  }

  const result: Series<VolumeProfileValue | null> = new Array(len);

  for (let i = 0; i < period - 1 && i < len; i++) {
    result[i] = { time: normalized[i].time, value: null };
  }

  for (let i = period - 1; i < len; i++) {
    const profile = computeProfileWindow(
      normalized,
      i - period + 1,
      i + 1,
      levels,
      valueAreaPercent,
    );
    result[i] = { time: normalized[i].time, value: profile };
  }

  return result;
}

/**
 * Compute Volume Profile for a window defined by [start, end) indices.
 * Avoids array slicing and redundant normalization.
 */
function computeProfileWindow(
  candles: NormalizedCandle[],
  start: number,
  end: number,
  levels: number,
  valueAreaPercent: number,
): VolumeProfileValue {
  if (start >= end) {
    return createEmptyProfile();
  }

  // Find price range
  let periodHigh = Number.NEGATIVE_INFINITY;
  let periodLow = Number.POSITIVE_INFINITY;

  for (let i = start; i < end; i++) {
    const c = candles[i];
    if (c.high > periodHigh) periodHigh = c.high;
    if (c.low < periodLow) periodLow = c.low;
  }

  // Handle edge case where all prices are the same
  if (periodHigh === periodLow) {
    let totalVol = 0;
    for (let i = start; i < end; i++) totalVol += candles[i].volume;

    return {
      levels: [
        {
          priceLow: periodLow,
          priceHigh: periodHigh,
          priceMid: periodLow,
          volume: totalVol,
          volumePercent: 100,
        },
      ],
      poc: periodLow,
      vah: periodHigh,
      val: periodLow,
      periodHigh,
      periodLow,
    };
  }

  // Create price levels
  const priceRange = periodHigh - periodLow;
  const levelHeight = priceRange / levels;
  const volumeLevels: VolumePriceLevel[] = new Array(levels);

  for (let i = 0; i < levels; i++) {
    volumeLevels[i] = {
      priceLow: periodLow + i * levelHeight,
      priceHigh: periodLow + (i + 1) * levelHeight,
      priceMid: periodLow + (i + 0.5) * levelHeight,
      volume: 0,
      volumePercent: 0,
    };
  }

  // Distribute volume to price levels
  let totalVolume = 0;
  const invLevels = 1 / levels;

  for (let ci = start; ci < end; ci++) {
    const candle = candles[ci];
    const candleVolume = candle.volume;
    totalVolume += candleVolume;

    const candleLow = Math.min(candle.low, candle.high);
    const candleHigh = Math.max(candle.low, candle.high);
    const candleRange = candleHigh - candleLow;

    // Narrow search to only levels that could overlap
    const firstLevel = Math.max(0, Math.floor((candleLow - periodLow) / levelHeight));
    const lastLevel = Math.min(levels - 1, Math.floor((candleHigh - periodLow) / levelHeight));

    if (candleRange > 0) {
      const invCandleRange = 1 / candleRange;
      for (let li = firstLevel; li <= lastLevel; li++) {
        const level = volumeLevels[li];
        const overlapLow = Math.max(candleLow, level.priceLow);
        const overlapHigh = Math.min(candleHigh, level.priceHigh);
        if (overlapHigh > overlapLow) {
          level.volume += candleVolume * (overlapHigh - overlapLow) * invCandleRange;
        }
      }
    } else {
      for (let li = firstLevel; li <= lastLevel; li++) {
        volumeLevels[li].volume += candleVolume * invLevels;
      }
    }
  }

  // Calculate volume percentages
  if (totalVolume > 0) {
    const invTotal = 100 / totalVolume;
    for (let i = 0; i < levels; i++) {
      volumeLevels[i].volumePercent = volumeLevels[i].volume * invTotal;
    }
  }

  // Find POC
  let maxVolumeLevel = volumeLevels[0];
  for (let i = 1; i < levels; i++) {
    if (volumeLevels[i].volume > maxVolumeLevel.volume) {
      maxVolumeLevel = volumeLevels[i];
    }
  }

  const { vah, val } = calculateValueArea(volumeLevels, valueAreaPercent, totalVolume);

  return {
    levels: volumeLevels,
    poc: maxVolumeLevel.priceMid,
    vah,
    val,
    periodHigh,
    periodLow,
  };
}

/**
 * Calculate Value Area High and Low
 * Value Area contains a specified percentage of total volume centered around POC
 */
function calculateValueArea(
  levels: VolumePriceLevel[],
  valueAreaPercent: number,
  totalVolume: number,
): { vah: number; val: number } {
  if (levels.length === 0 || totalVolume === 0) {
    return { vah: 0, val: 0 };
  }

  // Find POC index
  let pocIndex = 0;
  let maxVolume = levels[0].volume;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].volume > maxVolume) {
      maxVolume = levels[i].volume;
      pocIndex = i;
    }
  }

  // Start with POC and expand outward
  let areaVolume = levels[pocIndex].volume;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  const targetVolume = totalVolume * valueAreaPercent;

  while (areaVolume < targetVolume && (lowIndex > 0 || highIndex < levels.length - 1)) {
    // Compare volumes at the next level on each side
    const volumeBelow = lowIndex > 0 ? levels[lowIndex - 1].volume : 0;
    const volumeAbove = highIndex < levels.length - 1 ? levels[highIndex + 1].volume : 0;

    // Expand towards the side with more volume
    if (volumeBelow >= volumeAbove && lowIndex > 0) {
      lowIndex--;
      areaVolume += levels[lowIndex].volume;
    } else if (highIndex < levels.length - 1) {
      highIndex++;
      areaVolume += levels[highIndex].volume;
    } else if (lowIndex > 0) {
      lowIndex--;
      areaVolume += levels[lowIndex].volume;
    }
  }

  return {
    val: levels[lowIndex].priceLow,
    vah: levels[highIndex].priceHigh,
  };
}

/**
 * Create an empty profile for edge cases
 */
function createEmptyProfile(): VolumeProfileValue {
  return {
    levels: [],
    poc: 0,
    vah: 0,
    val: 0,
    periodHigh: 0,
    periodLow: 0,
  };
}
