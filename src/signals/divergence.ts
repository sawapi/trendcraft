/**
 * Divergence detection utilities
 * Detects divergence between price and indicators (OBV, RSI, MACD, etc.)
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import { macd } from "../indicators/momentum/macd";
import { rsi } from "../indicators/momentum/rsi";
import { obv } from "../indicators/volume/obv";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Divergence signal type
 */
export type DivergenceSignal = {
  /** Timestamp of the divergence point (second peak/trough) */
  time: number;
  /** Type of divergence */
  type: "bullish" | "bearish";
  /** First peak/trough index */
  firstIdx: number;
  /** Second peak/trough index */
  secondIdx: number;
  /** Price values at the two points */
  price: { first: number; second: number };
  /** Indicator values at the two points */
  indicator: { first: number; second: number };
};

/**
 * Options for divergence detection
 */
export type DivergenceOptions = {
  /** Lookback period for finding peaks/troughs (default: 5) */
  swingLookback?: number;
  /** Minimum bars between two peaks/troughs (default: 5) */
  minSwingDistance?: number;
  /** Maximum bars between two peaks/troughs (default: 60) */
  maxSwingDistance?: number;
};

/**
 * Detect OBV divergence signals
 *
 * Divergence occurs when price and OBV move in opposite directions:
 * - Bullish divergence: Price makes lower low, OBV makes higher low
 *   (indicates potential upward reversal)
 * - Bearish divergence: Price makes higher high, OBV makes lower high
 *   (indicates potential downward reversal)
 *
 * @param candles - Array of candles
 * @param options - Detection options
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const signals = obvDivergence(candles);
 * const bullish = signals.filter(s => s.type === 'bullish');
 * const bearish = signals.filter(s => s.type === 'bearish');
 * ```
 */
export function obvDivergence(
  candles: Candle[] | NormalizedCandle[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 10) return [];

  const obvData = obv(normalized);
  const prices = normalized.map((c) => c.close);
  const obvValues = obvData.map((d) => d.value);

  return detectDivergence(normalized, prices, obvValues, options);
}

/**
 * Detect RSI divergence signals
 *
 * Divergence occurs when price and RSI move in opposite directions:
 * - Bullish divergence: Price makes lower low, RSI makes higher low
 *   (indicates potential upward reversal, often from oversold territory)
 * - Bearish divergence: Price makes higher high, RSI makes lower high
 *   (indicates potential downward reversal, often from overbought territory)
 *
 * @param candles - Array of candles
 * @param options - Detection options
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const signals = rsiDivergence(candles);
 * const bullish = signals.filter(s => s.type === 'bullish');
 * const bearish = signals.filter(s => s.type === 'bearish');
 * ```
 */
export function rsiDivergence(
  candles: Candle[] | NormalizedCandle[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 14) return [];

  const rsiData = rsi(normalized, { period: 14 });
  const prices = normalized.map((c) => c.close);
  const rsiValues = rsiData.map((d) => d.value ?? 50); // Use 50 as neutral if null

  return detectDivergence(normalized, prices, rsiValues, options);
}

/**
 * Detect MACD divergence signals
 *
 * Divergence occurs when price and MACD line move in opposite directions:
 * - Bullish divergence: Price makes lower low, MACD makes higher low
 *   (indicates potential upward reversal)
 * - Bearish divergence: Price makes higher high, MACD makes lower high
 *   (indicates potential downward reversal)
 *
 * @param candles - Array of candles
 * @param options - Detection options
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const signals = macdDivergence(candles);
 * const bullish = signals.filter(s => s.type === 'bullish');
 * const bearish = signals.filter(s => s.type === 'bearish');
 * ```
 */
export function macdDivergence(
  candles: Candle[] | NormalizedCandle[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 26) return [];

  const macdData = macd(normalized);
  const prices = normalized.map((c) => c.close);
  const macdValues = macdData.map((d) => d.value.macd ?? 0); // Use 0 as neutral if null

  return detectDivergence(normalized, prices, macdValues, options);
}

/**
 * Generic divergence detection between price and any indicator
 *
 * @param candles - Normalized candles (for timestamps)
 * @param prices - Price series (typically close prices)
 * @param indicator - Indicator series
 * @param options - Detection options
 * @returns Array of divergence signals
 */
export function detectDivergence(
  candles: NormalizedCandle[],
  prices: number[],
  indicator: number[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const { swingLookback = 5, minSwingDistance = 5, maxSwingDistance = 60 } = options;

  const results: DivergenceSignal[] = [];

  // Find swing highs and lows for price
  const priceHighs = findSwingHighs(prices, swingLookback);
  const priceLows = findSwingLows(prices, swingLookback);

  // Find swing highs and lows for indicator
  const indHighs = findSwingHighs(indicator, swingLookback);
  const indLows = findSwingLows(indicator, swingLookback);

  // Detect bearish divergence (price higher high, indicator lower high)
  for (let i = 1; i < priceHighs.length; i++) {
    const prev = priceHighs[i - 1];
    const curr = priceHighs[i];

    // Check distance constraint
    const distance = curr.idx - prev.idx;
    if (distance < minSwingDistance || distance > maxSwingDistance) continue;

    // Price makes higher high
    if (curr.value <= prev.value) continue;

    // Find corresponding indicator highs
    const prevIndHigh = findNearestSwing(indHighs, prev.idx, swingLookback);
    const currIndHigh = findNearestSwing(indHighs, curr.idx, swingLookback);

    if (!prevIndHigh || !currIndHigh) continue;

    // Indicator makes lower high (bearish divergence)
    if (currIndHigh.value < prevIndHigh.value) {
      results.push({
        time: candles[curr.idx].time,
        type: "bearish",
        firstIdx: prev.idx,
        secondIdx: curr.idx,
        price: { first: prev.value, second: curr.value },
        indicator: { first: prevIndHigh.value, second: currIndHigh.value },
      });
    }
  }

  // Detect bullish divergence (price lower low, indicator higher low)
  for (let i = 1; i < priceLows.length; i++) {
    const prev = priceLows[i - 1];
    const curr = priceLows[i];

    // Check distance constraint
    const distance = curr.idx - prev.idx;
    if (distance < minSwingDistance || distance > maxSwingDistance) continue;

    // Price makes lower low
    if (curr.value >= prev.value) continue;

    // Find corresponding indicator lows
    const prevIndLow = findNearestSwing(indLows, prev.idx, swingLookback);
    const currIndLow = findNearestSwing(indLows, curr.idx, swingLookback);

    if (!prevIndLow || !currIndLow) continue;

    // Indicator makes higher low (bullish divergence)
    if (currIndLow.value > prevIndLow.value) {
      results.push({
        time: candles[curr.idx].time,
        type: "bullish",
        firstIdx: prev.idx,
        secondIdx: curr.idx,
        price: { first: prev.value, second: curr.value },
        indicator: { first: prevIndLow.value, second: currIndLow.value },
      });
    }
  }

  // Sort by time
  results.sort((a, b) => a.time - b.time);

  return results;
}

/**
 * Swing point type
 */
type SwingPoint = {
  idx: number;
  value: number;
};

/**
 * Find swing highs (local maxima)
 */
function findSwingHighs(data: number[], lookback: number): SwingPoint[] {
  const result: SwingPoint[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;

    // Check if current point is higher than all points in lookback range
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j] >= data[i]) {
        isHigh = false;
        break;
      }
    }

    if (isHigh) {
      result.push({ idx: i, value: data[i] });
    }
  }

  return result;
}

/**
 * Find swing lows (local minima)
 */
function findSwingLows(data: number[], lookback: number): SwingPoint[] {
  const result: SwingPoint[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    let isLow = true;

    // Check if current point is lower than all points in lookback range
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j] <= data[i]) {
        isLow = false;
        break;
      }
    }

    if (isLow) {
      result.push({ idx: i, value: data[i] });
    }
  }

  return result;
}

/**
 * Find the nearest swing point to a given index
 */
function findNearestSwing(
  swings: SwingPoint[],
  targetIdx: number,
  tolerance: number,
): SwingPoint | null {
  let nearest: SwingPoint | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const swing of swings) {
    const distance = Math.abs(swing.idx - targetIdx);
    if (distance <= tolerance && distance < minDistance) {
      minDistance = distance;
      nearest = swing;
    }
  }

  return nearest;
}
