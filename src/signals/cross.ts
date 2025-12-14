/**
 * Cross detection utilities for trading signals
 * Detects when one series crosses over/under another
 */

import { normalizeCandles } from "../core/normalize";
import { sma } from "../indicators/moving-average/sma";
import type { Candle, NormalizedCandle, Series } from "../types";

/**
 * Options for golden/dead cross detection
 */
export type CrossOptions = {
  /** Short-term period (default: 5) */
  short?: number;
  /** Long-term period (default: 25, Japanese stock standard) */
  long?: number;
};

/**
 * Detect when series A crosses over series B
 * Returns true at the point where A moves from below/equal to above B
 *
 * @param seriesA - First series (the one crossing over)
 * @param seriesB - Second series (the one being crossed)
 * @returns Series of boolean values (true when crossover occurs)
 *
 * @example
 * ```ts
 * const sma5 = sma(candles, { period: 5 });
 * const sma25 = sma(candles, { period: 25 });
 * const crosses = crossOver(sma5, sma25);
 * // true when SMA5 crosses above SMA25
 * ```
 */
export function crossOver(
  seriesA: Series<number | null>,
  seriesB: Series<number | null>
): Series<boolean> {
  if (seriesA.length !== seriesB.length) {
    throw new Error("Series must have the same length");
  }

  const result: Series<boolean> = [];

  for (let i = 0; i < seriesA.length; i++) {
    if (i === 0) {
      // First point cannot be a crossover
      result.push({ time: seriesA[i].time, value: false });
      continue;
    }

    const prevA = seriesA[i - 1].value;
    const prevB = seriesB[i - 1].value;
    const currA = seriesA[i].value;
    const currB = seriesB[i].value;

    // Check for null values
    if (prevA === null || prevB === null || currA === null || currB === null) {
      result.push({ time: seriesA[i].time, value: false });
      continue;
    }

    // Crossover: A was <= B and now A > B
    const isCrossOver = prevA <= prevB && currA > currB;
    result.push({ time: seriesA[i].time, value: isCrossOver });
  }

  return result;
}

/**
 * Detect when series A crosses under series B
 * Returns true at the point where A moves from above/equal to below B
 *
 * @param seriesA - First series (the one crossing under)
 * @param seriesB - Second series (the one being crossed)
 * @returns Series of boolean values (true when crossunder occurs)
 *
 * @example
 * ```ts
 * const sma5 = sma(candles, { period: 5 });
 * const sma25 = sma(candles, { period: 25 });
 * const crosses = crossUnder(sma5, sma25);
 * // true when SMA5 crosses below SMA25
 * ```
 */
export function crossUnder(
  seriesA: Series<number | null>,
  seriesB: Series<number | null>
): Series<boolean> {
  if (seriesA.length !== seriesB.length) {
    throw new Error("Series must have the same length");
  }

  const result: Series<boolean> = [];

  for (let i = 0; i < seriesA.length; i++) {
    if (i === 0) {
      // First point cannot be a crossunder
      result.push({ time: seriesA[i].time, value: false });
      continue;
    }

    const prevA = seriesA[i - 1].value;
    const prevB = seriesB[i - 1].value;
    const currA = seriesA[i].value;
    const currB = seriesB[i].value;

    // Check for null values
    if (prevA === null || prevB === null || currA === null || currB === null) {
      result.push({ time: seriesA[i].time, value: false });
      continue;
    }

    // Crossunder: A was >= B and now A < B
    const isCrossUnder = prevA >= prevB && currA < currB;
    result.push({ time: seriesA[i].time, value: isCrossUnder });
  }

  return result;
}

/**
 * Detect Golden Cross (short-term SMA crosses above long-term SMA)
 * A bullish signal indicating potential upward momentum
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Cross options (short/long periods)
 * @returns Series of boolean values (true when golden cross occurs)
 *
 * @example
 * ```ts
 * // Default: 5-day crosses above 25-day (Japanese stock standard)
 * const gc = goldenCross(candles);
 *
 * // Custom periods: 5-day crosses above 20-day
 * const gc520 = goldenCross(candles, { short: 5, long: 20 });
 * ```
 */
export function goldenCross(
  candles: Candle[] | NormalizedCandle[],
  options: CrossOptions = {}
): Series<boolean> {
  const { short: shortPeriod = 5, long: longPeriod = 25 } = options;

  if (shortPeriod >= longPeriod) {
    throw new Error("Short period must be less than long period");
  }

  // Normalize candles for consistency
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Calculate SMAs
  const shortSma = sma(normalized, { period: shortPeriod });
  const longSma = sma(normalized, { period: longPeriod });

  return crossOver(shortSma, longSma);
}

/**
 * Detect Dead Cross (short-term SMA crosses below long-term SMA)
 * A bearish signal indicating potential downward momentum
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Cross options (short/long periods)
 * @returns Series of boolean values (true when dead cross occurs)
 *
 * @example
 * ```ts
 * // Default: 5-day crosses below 25-day (Japanese stock standard)
 * const dc = deadCross(candles);
 *
 * // Custom periods: 5-day crosses below 20-day
 * const dc520 = deadCross(candles, { short: 5, long: 20 });
 * ```
 */
export function deadCross(
  candles: Candle[] | NormalizedCandle[],
  options: CrossOptions = {}
): Series<boolean> {
  const { short: shortPeriod = 5, long: longPeriod = 25 } = options;

  if (shortPeriod >= longPeriod) {
    throw new Error("Short period must be less than long period");
  }

  // Normalize candles for consistency
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Calculate SMAs
  const shortSma = sma(normalized, { period: shortPeriod });
  const longSma = sma(normalized, { period: longPeriod });

  return crossUnder(shortSma, longSma);
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}

/**
 * Cross signal quality assessment
 */
export type CrossSignalQuality = {
  /** The timestamp of the cross event */
  time: number;
  /** Type of cross: golden or dead */
  type: "golden" | "dead";
  /** Whether the signal is likely a fake (damashi) */
  isFake: boolean;
  /** Quality score: 0-100 (higher = more reliable) */
  score: number;
  /** Details of each filter check */
  details: {
    /** Volume is above average (confirms the cross) */
    volumeConfirmed: boolean;
    /** Mid-term trend direction matches the cross */
    trendConfirmed: boolean;
    /** Cross was maintained for N days without reversal */
    holdingConfirmed: boolean | null;
    /** Price is above SMA (for GC) or below SMA (for DC) */
    pricePositionConfirmed: boolean;
    /** Days until the next reverse cross (null if no reverse yet) */
    daysUntilReverse: number | null;
  };
};

/**
 * Options for cross validation
 */
export type CrossValidationOptions = {
  /** Short-term period for cross detection (default: 5) */
  short?: number;
  /** Long-term period for cross detection (default: 25) */
  long?: number;
  /** Period for volume moving average (default: 20) */
  volumeMaPeriod?: number;
  /** Period for trend calculation (slope lookback, default: 5) */
  trendPeriod?: number;
  /** Days to check if cross is maintained without reversal (default: 5) */
  holdingDays?: number;
};

/**
 * Validate cross signals and detect potential fake (damashi) signals
 *
 * Uses multiple filters to assess signal quality:
 * 1. Volume confirmation: Cross occurs with above-average volume (20 points)
 * 2. Trend confirmation: Mid-term SMA slope matches cross direction (20 points)
 * 3. Holding confirmation: Cross maintained for N days without reversal (30 points)
 * 4. Price position: Price is above/below long SMA (15 points)
 *
 * @param candles - Array of candles
 * @param options - Validation options
 * @returns Array of cross events with quality assessment
 *
 * @example
 * ```ts
 * const signals = validateCrossSignals(candles);
 * const reliableGC = signals.filter(s => s.type === 'golden' && !s.isFake);
 * const fakeSignals = signals.filter(s => s.isFake);
 * ```
 */
export function validateCrossSignals(
  candles: Candle[] | NormalizedCandle[],
  options: CrossValidationOptions = {}
): CrossSignalQuality[] {
  const {
    short: shortPeriod = 5,
    long: longPeriod = 25,
    volumeMaPeriod = 20,
    trendPeriod = 5,
    holdingDays = 5,
  } = options;

  if (candles.length === 0) return [];

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Calculate SMAs
  const shortSma = sma(normalized, { period: shortPeriod });
  const longSma = sma(normalized, { period: longPeriod });

  // Calculate volume MA
  const volumes = normalized.map((c) => c.volume);
  const volumeMa = calculateSimpleMa(volumes, volumeMaPeriod);

  // Detect crosses
  const goldenCrosses = crossOver(shortSma, longSma);
  const deadCrosses = crossUnder(shortSma, longSma);

  // Build list of all cross indices for daysUntilReverse calculation
  const crossIndices: { idx: number; type: "golden" | "dead" }[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (goldenCrosses[i].value) crossIndices.push({ idx: i, type: "golden" });
    if (deadCrosses[i].value) crossIndices.push({ idx: i, type: "dead" });
  }

  const results: CrossSignalQuality[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const isGolden = goldenCrosses[i].value;
    const isDead = deadCrosses[i].value;

    if (!isGolden && !isDead) continue;

    const type = isGolden ? "golden" : "dead";
    const candle = normalized[i];

    // 1. Volume confirmation: current volume > volume MA (20 points)
    const currentVolMa = volumeMa[i];
    const volumeConfirmed = currentVolMa !== null && candle.volume > currentVolMa;

    // 2. Trend confirmation: long SMA slope matches cross direction (20 points)
    const trendConfirmed = checkTrendDirection(longSma, i, trendPeriod, type);

    // 3. Holding confirmation: cross maintained for N days (30 points)
    const holdingConfirmed = checkHoldingDays(shortSma, longSma, i, holdingDays, type);

    // 4. Price position: price above/below long SMA (15 points)
    const longSmaValue = longSma[i].value;
    const pricePositionConfirmed =
      longSmaValue !== null &&
      (type === "golden" ? candle.close > longSmaValue : candle.close < longSmaValue);

    // 5. Days until reverse cross (for historical analysis)
    const daysUntilReverse = findDaysUntilReverse(crossIndices, i, type);

    // Calculate score (0-100)
    // Base: 15 points (for detecting the cross itself)
    let score = 15;
    if (volumeConfirmed) score += 20;
    if (trendConfirmed) score += 20;
    if (holdingConfirmed === true) score += 30;
    if (pricePositionConfirmed) score += 15;

    // Signal is considered fake if:
    // - holdingConfirmed is false (reversed within N days), OR
    // - holdingConfirmed is null (not enough data) AND both volume and trend fail
    const isFake =
      holdingConfirmed === false ||
      (holdingConfirmed === null && !volumeConfirmed && !trendConfirmed);

    results.push({
      time: candle.time,
      type,
      isFake,
      score,
      details: {
        volumeConfirmed,
        trendConfirmed,
        holdingConfirmed,
        pricePositionConfirmed,
        daysUntilReverse,
      },
    });
  }

  return results;
}

/**
 * Check if cross is maintained for N days without reversal
 * Returns:
 * - true: cross maintained for N days
 * - false: cross reversed within N days
 * - null: not enough future data to determine
 */
function checkHoldingDays(
  shortSma: Series<number | null>,
  longSma: Series<number | null>,
  crossIdx: number,
  holdingDays: number,
  crossType: "golden" | "dead"
): boolean | null {
  const endIdx = crossIdx + holdingDays;

  // Not enough data to check
  if (endIdx >= shortSma.length) {
    return null;
  }

  // Check each day after the cross
  for (let i = crossIdx + 1; i <= endIdx; i++) {
    const shortVal = shortSma[i].value;
    const longVal = longSma[i].value;

    if (shortVal === null || longVal === null) {
      continue;
    }

    // For golden cross: short should stay above long
    // For dead cross: short should stay below long
    if (crossType === "golden" && shortVal < longVal) {
      return false; // Reversed
    }
    if (crossType === "dead" && shortVal > longVal) {
      return false; // Reversed
    }
  }

  return true; // Maintained for N days
}

/**
 * Calculate simple moving average for a number array
 */
function calculateSimpleMa(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j];
    }
    result.push(sum / period);
  }

  return result;
}

/**
 * Check if trend direction matches cross type
 * Golden cross should occur when mid-term trend is rising
 * Dead cross should occur when mid-term trend is falling
 */
function checkTrendDirection(
  longSma: Series<number | null>,
  currentIdx: number,
  lookback: number,
  crossType: "golden" | "dead"
): boolean {
  if (currentIdx < lookback) return false;

  const currentValue = longSma[currentIdx].value;
  const pastValue = longSma[currentIdx - lookback].value;

  if (currentValue === null || pastValue === null) return false;

  const slope = currentValue - pastValue;

  // Golden cross is confirmed if trend is rising (slope > 0)
  // Dead cross is confirmed if trend is falling (slope < 0)
  if (crossType === "golden") {
    return slope > 0;
  }
  return slope < 0;
}

/**
 * Find days until the next reverse cross
 * For golden cross, find the next dead cross
 * For dead cross, find the next golden cross
 * Returns null if no reverse cross found
 */
function findDaysUntilReverse(
  crossIndices: { idx: number; type: "golden" | "dead" }[],
  currentIdx: number,
  crossType: "golden" | "dead"
): number | null {
  const reverseType = crossType === "golden" ? "dead" : "golden";

  // Find the next reverse cross after current index
  for (const cross of crossIndices) {
    if (cross.idx > currentIdx && cross.type === reverseType) {
      return cross.idx - currentIdx;
    }
  }

  return null; // No reverse cross found
}
