/**
 * Utilities for comparison mode - align and normalize comparison data
 */

import type { NormalizedCandle } from "trendcraft";

/**
 * Align comparison candles to main chart dates and return percentage-normalized values.
 * Returns an array of (number|null)[] matching mainDates length.
 * Each value is the percentage change from the first aligned bar.
 */
export function alignComparisonData(
  mainCandles: NormalizedCandle[],
  comparisonCandles: NormalizedCandle[],
): (number | null)[] {
  if (mainCandles.length === 0 || comparisonCandles.length === 0) {
    return mainCandles.map(() => null);
  }

  // Build a map from date string to close price for comparison
  const compMap = new Map<string, number>();
  for (const c of comparisonCandles) {
    const key = dateKey(c.time);
    compMap.set(key, c.close);
  }

  // Find first matching date to use as base
  let basePrice: number | null = null;
  const result: (number | null)[] = [];

  for (const c of mainCandles) {
    const key = dateKey(c.time);
    const price = compMap.get(key) ?? null;
    if (price !== null && basePrice === null) {
      basePrice = price;
    }
    if (price !== null && basePrice !== null) {
      result.push(((price - basePrice) / basePrice) * 100);
    } else {
      result.push(null);
    }
  }

  return result;
}

/**
 * Normalize main candles to percentage from first candle's close
 */
export function normalizeMainToPercent(candles: NormalizedCandle[]): (number | null)[] {
  if (candles.length === 0) return [];
  const base = candles[0].close;
  return candles.map((c) => ((c.close - base) / base) * 100);
}

function dateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
