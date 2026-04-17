/**
 * DMI (Directional Movement Index) and ADX (Average Directional Index)
 * Measures trend strength and direction
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { DMI_META } from "../indicator-meta";

/**
 * DMI result values
 */
export type DmiValue = {
  /** +DI (Positive Directional Indicator) */
  plusDi: number | null;
  /** -DI (Negative Directional Indicator) */
  minusDi: number | null;
  /** ADX (Average Directional Index) - trend strength */
  adx: number | null;
};

/**
 * Options for DMI calculation
 */
export type DmiOptions = {
  /** Period for DI and ATR calculation (default: 14) */
  period?: number;
  /** Period for ADX smoothing (default: 14) */
  adxPeriod?: number;
};

/**
 * Calculate DMI (Directional Movement Index) and ADX
 *
 * +DI measures uptrend strength
 * -DI measures downtrend strength
 * ADX measures overall trend strength (not direction)
 *
 * Trading signals:
 * - +DI > -DI: Bullish trend
 * - -DI > +DI: Bearish trend
 * - ADX > 25: Strong trend
 * - ADX < 20: Weak trend / ranging market
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - DMI options
 * @returns Series of DMI values
 *
 * @example
 * ```ts
 * const dmi = dmi(candles, { period: 14 });
 * const { plusDi, minusDi, adx } = dmi[i].value;
 *
 * if (adx > 25 && plusDi > minusDi) {
 *   // Strong bullish trend
 * }
 * ```
 */
export function dmi(
  candles: Candle[] | NormalizedCandle[],
  options: DmiOptions = {},
): Series<DmiValue> {
  const { period = 14, adxPeriod = 14 } = options;

  if (period < 1) throw new Error("period must be at least 1");
  if (adxPeriod < 1) throw new Error("adxPeriod must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Step 1: Calculate True Range, +DM, -DM for each bar
  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];

    if (i === 0) {
      // First bar: TR requires previous close, so skip (TA-Lib compatible)
      tr.push(0);
      plusDm.push(0);
      minusDm.push(0);
      continue;
    }

    const prev = normalized[i - 1];

    // True Range: max of (H-L, |H-prevC|, |L-prevC|)
    const highLow = current.high - current.low;
    const highPrevClose = Math.abs(current.high - prev.close);
    const lowPrevClose = Math.abs(current.low - prev.close);
    tr.push(Math.max(highLow, highPrevClose, lowPrevClose));

    // Directional Movement
    const upMove = current.high - prev.high;
    const downMove = prev.low - current.low;

    if (upMove > downMove && upMove > 0) {
      plusDm.push(upMove);
    } else {
      plusDm.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDm.push(downMove);
    } else {
      minusDm.push(0);
    }
  }

  // Step 2: Smooth TR, +DM, -DM using Wilder's smoothing
  const smoothedTr = wilderSmooth(tr, period);
  const smoothedPlusDm = wilderSmooth(plusDm, period);
  const smoothedMinusDm = wilderSmooth(minusDm, period);

  // Step 3: Calculate +DI and -DI
  const plusDi: (number | null)[] = [];
  const minusDi: (number | null)[] = [];
  const dx: (number | null)[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const atr = smoothedTr[i];
    const pDm = smoothedPlusDm[i];
    const mDm = smoothedMinusDm[i];

    if (atr === null || pDm === null || mDm === null || atr === 0) {
      plusDi.push(null);
      minusDi.push(null);
      dx.push(null);
      continue;
    }

    const pDi = (100 * pDm) / atr;
    const mDi = (100 * mDm) / atr;
    plusDi.push(pDi);
    minusDi.push(mDi);

    // DX = |+DI - -DI| / (+DI + -DI) * 100
    const diSum = pDi + mDi;
    if (diSum === 0) {
      dx.push(0);
    } else {
      dx.push((100 * Math.abs(pDi - mDi)) / diSum);
    }
  }

  // Step 4: Calculate ADX (smoothed DX)
  const adx = wilderSmoothNullable(dx, adxPeriod);

  // Build result
  const result: Series<DmiValue> = [];
  for (let i = 0; i < normalized.length; i++) {
    result.push({
      time: normalized[i].time,
      value: {
        plusDi: plusDi[i],
        minusDi: minusDi[i],
        adx: adx[i],
      },
    });
  }

  return tagSeries(result, withLabelParams(DMI_META, [period]));
}

/**
 * Wilder's Smoothing Method
 * Similar to EMA but uses 1/N instead of 2/(N+1)
 */
function wilderSmooth(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  // TA-Lib compatible: sum period-1 values (index 1..period-1), then start
  // Wilder's smoothing at index=period. First non-null output is at index=period.
  // Index 0 is always 0 (TR/DM requires previous bar).
  let initSum = 0;

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      // Accumulate initial sum (index 1..period-1 = period-1 values)
      initSum += values[i]; // index 0 is 0, so effectively sums index 1..period-1
      result.push(null);
    } else if (i === period) {
      // First smoothed value: apply Wilder's to initial sum with current value
      const smoothed = initSum - initSum / period + values[i];
      result.push(smoothed);
    } else {
      // Wilder's smoothing: prev - (prev/N) + current
      const prev = result[i - 1];
      if (prev === null) {
        result.push(null);
      } else {
        result.push(prev - prev / period + values[i]);
      }
    }
  }

  return result;
}

/**
 * Wilder's Smoothing for nullable values
 */
function wilderSmoothNullable(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  // Find first valid index with enough data
  let firstValidIdx = -1;
  let validCount = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      validCount++;
      if (validCount === period) {
        firstValidIdx = i;
        break;
      }
    }
  }

  for (let i = 0; i < values.length; i++) {
    if (firstValidIdx === -1 || i < firstValidIdx) {
      result.push(null);
    } else if (i === firstValidIdx) {
      // First value: average of first N valid values
      let sum = 0;
      let count = 0;
      for (let j = i; j >= 0 && count < period; j--) {
        const val = values[j];
        if (val !== null) {
          sum += val;
          count++;
        }
      }
      result.push(sum / period);
    } else {
      const prev = result[i - 1];
      const curr = values[i];
      if (prev === null || curr === null) {
        result.push(prev); // Keep previous value if current is null
      } else {
        // Wilder's smoothing for ADX (averaged version)
        result.push((prev * (period - 1) + curr) / period);
      }
    }
  }

  return result;
}
