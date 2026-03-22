/**
 * Break of Structure (BOS) Detection
 *
 * Detects when price breaks through a significant swing point,
 * indicating a potential change in market structure.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Break of Structure result
 */
export type BosValue = {
  /** Bullish break of structure (price broke above swing high) */
  bullishBos: boolean;
  /** Bearish break of structure (price broke below swing low) */
  bearishBos: boolean;
  /** The level that was broken */
  brokenLevel: number | null;
  /** Current market trend based on structure */
  trend: "bullish" | "bearish" | "neutral";
  /** Most recent swing high level */
  swingHighLevel: number | null;
  /** Most recent swing low level */
  swingLowLevel: number | null;
};

/**
 * Options for BOS detection
 */
export type BosOptions = {
  /** Swing detection period (bars on each side, default: 5) */
  swingPeriod?: number;
};

/**
 * Detect Break of Structure
 *
 * A bullish BOS occurs when price closes above a recent swing high.
 * A bearish BOS occurs when price closes below a recent swing low.
 *
 * This is a key concept in Smart Money Concepts (SMC) trading.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - BOS options
 * @returns Series of BOS values
 *
 * @example
 * ```ts
 * const bos = breakOfStructure(candles, { swingPeriod: 5 });
 *
 * // Check for structure breaks
 * const lastBos = bos[bos.length - 1].value;
 * if (lastBos.bullishBos) {
 *   console.log(`Bullish BOS! Broke above ${lastBos.brokenLevel}`);
 * }
 *
 * // Track trend
 * console.log(`Current trend: ${lastBos.trend}`);
 * ```
 */
export function breakOfStructure(
  candles: Candle[] | NormalizedCandle[],
  options: BosOptions = {},
): Series<BosValue> {
  const { swingPeriod = 5 } = options;

  if (swingPeriod < 1) throw new Error("swingPeriod must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<BosValue> = [];

  // Track swing points
  let lastSwingHigh: number | null = null;
  let lastSwingHighIdx: number | null = null;
  let lastSwingLow: number | null = null;
  let lastSwingLowIdx: number | null = null;

  // Track trend
  let currentTrend: "bullish" | "bearish" | "neutral" = "neutral";

  // Pre-calculate swing points
  const swingHighs: Array<{ idx: number; price: number }> = [];
  const swingLows: Array<{ idx: number; price: number }> = [];

  for (let i = swingPeriod; i < normalized.length - swingPeriod; i++) {
    const pivotHigh = normalized[i].high;
    const pivotLow = normalized[i].low;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= swingPeriod; j++) {
      if (normalized[i - j].high >= pivotHigh || normalized[i + j].high >= pivotHigh) {
        isSwingHigh = false;
      }
      if (normalized[i - j].low <= pivotLow || normalized[i + j].low <= pivotLow) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      swingHighs.push({ idx: i, price: pivotHigh });
    }
    if (isSwingLow) {
      swingLows.push({ idx: i, price: pivotLow });
    }
  }

  // Track which swing points are confirmed at each bar
  let swingHighPtr = 0;
  let swingLowPtr = 0;

  for (let i = 0; i < normalized.length; i++) {
    // Update confirmed swing points (confirmed after swingPeriod bars)
    while (swingHighPtr < swingHighs.length && swingHighs[swingHighPtr].idx + swingPeriod <= i) {
      lastSwingHigh = swingHighs[swingHighPtr].price;
      lastSwingHighIdx = swingHighs[swingHighPtr].idx;
      swingHighPtr++;
    }

    while (swingLowPtr < swingLows.length && swingLows[swingLowPtr].idx + swingPeriod <= i) {
      lastSwingLow = swingLows[swingLowPtr].price;
      lastSwingLowIdx = swingLows[swingLowPtr].idx;
      swingLowPtr++;
    }

    // Check for BOS
    let bullishBos = false;
    let bearishBos = false;
    let brokenLevel: number | null = null;

    // Bullish BOS: Close above swing high
    if (lastSwingHigh !== null && normalized[i].close > lastSwingHigh) {
      bullishBos = true;
      brokenLevel = lastSwingHigh;
      currentTrend = "bullish";
      // Reset swing high after break
      lastSwingHigh = null;
      lastSwingHighIdx = null;
    }

    // Bearish BOS: Close below swing low
    if (lastSwingLow !== null && normalized[i].close < lastSwingLow) {
      bearishBos = true;
      brokenLevel = lastSwingLow;
      currentTrend = "bearish";
      // Reset swing low after break
      lastSwingLow = null;
      lastSwingLowIdx = null;
    }

    result.push({
      time: normalized[i].time,
      value: {
        bullishBos,
        bearishBos,
        brokenLevel,
        trend: currentTrend,
        swingHighLevel: lastSwingHigh,
        swingLowLevel: lastSwingLow,
      },
    });
  }

  return result;
}

/**
 * Detect Change of Character (CHoCH)
 *
 * Similar to BOS but specifically detects the first break in the opposite direction,
 * signaling a potential trend reversal.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - BOS options
 * @returns Series of CHoCH values
 */
export function changeOfCharacter(
  candles: Candle[] | NormalizedCandle[],
  options: BosOptions = {},
): Series<BosValue> {
  const bos = breakOfStructure(candles, options);

  // Track the trend before BOS
  let prevTrend: "bullish" | "bearish" | "neutral" = "neutral";

  return bos.map((item) => {
    const { bullishBos, bearishBos, trend } = item.value;

    // CHoCH is a BOS in the opposite direction of the previous trend
    const isBullishChoch = bullishBos && prevTrend === "bearish";
    const isBearishChoch = bearishBos && prevTrend === "bullish";

    // Update previous trend if we had a BOS
    if (bullishBos || bearishBos) {
      prevTrend = trend;
    }

    return {
      time: item.time,
      value: {
        ...item.value,
        bullishBos: isBullishChoch,
        bearishBos: isBearishChoch,
      },
    };
  });
}
