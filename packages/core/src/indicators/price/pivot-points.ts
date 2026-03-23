/**
 * Pivot Points indicator
 *
 * Pivot Points are used to determine potential support and resistance levels.
 * They are calculated based on the high, low, and close of the previous period.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Pivot Points options
 */
export type PivotPointsOptions = {
  /** Calculation method (default: 'standard') */
  method?: "standard" | "fibonacci" | "woodie" | "camarilla" | "demark";
};

/**
 * Pivot Points value
 */
export type PivotPointsValue = {
  /** Pivot Point (central level) */
  pivot: number | null;
  /** Resistance level 1 */
  r1: number | null;
  /** Resistance level 2 */
  r2: number | null;
  /** Resistance level 3 */
  r3: number | null;
  /** Support level 1 */
  s1: number | null;
  /** Support level 2 */
  s2: number | null;
  /** Support level 3 */
  s3: number | null;
};

/**
 * Calculate Pivot Points
 *
 * Standard method:
 * - Pivot = (High + Low + Close) / 3
 * - R1 = 2 × Pivot - Low
 * - R2 = Pivot + (High - Low)
 * - R3 = High + 2 × (Pivot - Low)
 * - S1 = 2 × Pivot - High
 * - S2 = Pivot - (High - Low)
 * - S3 = Low - 2 × (High - Pivot)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Pivot Points options
 * @returns Series of Pivot Points values
 *
 * @example
 * ```ts
 * const pivots = pivotPoints(candles);
 * const fibPivots = pivotPoints(candles, { method: 'fibonacci' });
 *
 * // Use pivot levels for trading decisions
 * const { pivot, r1, s1 } = pivots[i].value;
 * ```
 */
export function pivotPoints(
  candles: Candle[] | NormalizedCandle[],
  options: PivotPointsOptions = {},
): Series<PivotPointsValue> {
  const { method = "standard" } = options;

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<PivotPointsValue> = [];

  if (normalized.length === 0) {
    return result;
  }

  // First candle has no previous data
  result.push({
    time: normalized[0].time,
    value: {
      pivot: null,
      r1: null,
      r2: null,
      r3: null,
      s1: null,
      s2: null,
      s3: null,
    },
  });

  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    const high = prev.high;
    const low = prev.low;
    const close = prev.close;
    const open = curr.open;

    let value: PivotPointsValue;

    switch (method) {
      case "fibonacci":
        value = calculateFibonacci(high, low, close);
        break;
      case "woodie":
        value = calculateWoodie(high, low, open);
        break;
      case "camarilla":
        value = calculateCamarilla(high, low, close);
        break;
      case "demark":
        value = calculateDemark(high, low, close, open);
        break;
      default:
        value = calculateStandard(high, low, close);
    }

    result.push({
      time: normalized[i].time,
      value,
    });
  }

  return tagSeries(result, { pane: "main", label: "Pivot" });
}

/**
 * Standard Pivot Points calculation
 */
function calculateStandard(high: number, low: number, close: number): PivotPointsValue {
  const pivot = (high + low + close) / 3;
  const range = high - low;

  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + range,
    r3: high + 2 * (pivot - low),
    s1: 2 * pivot - high,
    s2: pivot - range,
    s3: low - 2 * (high - pivot),
  };
}

/**
 * Fibonacci Pivot Points calculation
 */
function calculateFibonacci(high: number, low: number, close: number): PivotPointsValue {
  const pivot = (high + low + close) / 3;
  const range = high - low;

  return {
    pivot,
    r1: pivot + 0.382 * range,
    r2: pivot + 0.618 * range,
    r3: pivot + 1.0 * range,
    s1: pivot - 0.382 * range,
    s2: pivot - 0.618 * range,
    s3: pivot - 1.0 * range,
  };
}

/**
 * Woodie Pivot Points calculation
 */
function calculateWoodie(high: number, low: number, open: number): PivotPointsValue {
  const pivot = (high + low + 2 * open) / 4;
  const range = high - low;

  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + range,
    r3: high + 2 * (pivot - low),
    s1: 2 * pivot - high,
    s2: pivot - range,
    s3: low - 2 * (high - pivot),
  };
}

/**
 * Camarilla Pivot Points calculation
 */
function calculateCamarilla(high: number, low: number, close: number): PivotPointsValue {
  const range = high - low;

  return {
    pivot: (high + low + close) / 3,
    r1: close + range * (1.1 / 12),
    r2: close + range * (1.1 / 6),
    r3: close + range * (1.1 / 4),
    s1: close - range * (1.1 / 12),
    s2: close - range * (1.1 / 6),
    s3: close - range * (1.1 / 4),
  };
}

/**
 * DeMark Pivot Points calculation
 */
function calculateDemark(high: number, low: number, close: number, open: number): PivotPointsValue {
  let x: number;

  if (close < open) {
    x = high + 2 * low + close;
  } else if (close > open) {
    x = 2 * high + low + close;
  } else {
    x = high + low + 2 * close;
  }

  const pivot = x / 4;

  return {
    pivot,
    r1: x / 2 - low,
    r2: null, // DeMark typically only has R1/S1
    r3: null,
    s1: x / 2 - high,
    s2: null,
    s3: null,
  };
}
