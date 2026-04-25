/**
 * TRIX (Triple Exponential Average)
 *
 * TRIX is the 1-period rate of change of a triple-smoothed EMA.
 * It filters out insignificant price movements and shows the underlying trend.
 *
 * Calculation:
 * 1. EMA1 = EMA(close, period)
 * 2. EMA2 = EMA(EMA1, period)
 * 3. EMA3 = EMA(EMA2, period)
 * 4. TRIX = (EMA3 - prev EMA3) / prev EMA3 × 100
 *
 * Warmup: nulls from each EMA stage propagate; downstream stages do not
 * begin until they have `period` consecutive non-null upstream samples.
 * First valid TRIX therefore appears at `index = 3 * (period - 1) + 1`,
 * matching StockCharts canonical TRIX (no zero-padding seed contamination).
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { TRIX_META } from "../indicator-meta";
import { ema } from "../moving-average/ema";

/**
 * EMA over a nullable input series. Nulls do not advance the running EMA;
 * the SMA seed is taken from the first `period` consecutive non-null
 * inputs. A null input mid-stream resets the chain.
 */
function emaOfNullable(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let prev: number | null = null;
  let consec = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) {
      prev = null;
      consec = 0;
      continue;
    }
    if (prev === null) {
      consec++;
      if (consec === period) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j] as number;
        prev = sum / period;
        result[i] = prev;
      }
    } else {
      prev = v * multiplier + prev * (1 - multiplier);
      result[i] = prev;
    }
  }
  return result;
}

/**
 * TRIX options
 */
export type TrixOptions = {
  /** Period for triple EMA smoothing (default: 15) */
  period?: number;
  /** Signal line period (default: 9) */
  signalPeriod?: number;
};

/**
 * TRIX value
 */
export type TrixValue = {
  /** TRIX line value */
  trix: number | null;
  /** Signal line (EMA of TRIX) */
  signal: number | null;
};

/**
 * Calculate TRIX (Triple Exponential Average)
 *
 * Interpretation:
 * - Positive TRIX: Uptrend
 * - Negative TRIX: Downtrend
 * - TRIX crossing above signal: Bullish
 * - TRIX crossing below signal: Bearish
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - TRIX options
 * @returns Series of TRIX values
 *
 * @example
 * ```ts
 * const trixData = trix(candles);
 * const { trix: trixVal, signal } = trixData[i].value;
 *
 * if (trixVal > signal) {
 *   // Bullish crossover
 * }
 * ```
 */
export function trix(
  candles: Candle[] | NormalizedCandle[],
  options: TrixOptions = {},
): Series<TrixValue> {
  const { period = 15, signalPeriod = 9 } = options;

  if (period < 1) throw new Error("TRIX period must be at least 1");
  if (signalPeriod < 1) throw new Error("TRIX signal period must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) return [];

  // EMA1 over close prices (already null-aware via ema())
  const ema1Values = ema(normalized, { period, source: "close" }).map((e) => e.value);
  // EMA2 / EMA3: null-propagating cascade
  const ema2Values = emaOfNullable(ema1Values, period);
  const ema3Values = emaOfNullable(ema2Values, period);

  // TRIX = 1-period ROC of EMA3
  const trixValues: (number | null)[] = new Array(normalized.length).fill(null);
  for (let i = 1; i < ema3Values.length; i++) {
    const cur = ema3Values[i];
    const prev = ema3Values[i - 1];
    if (cur === null || prev === null) continue;
    trixValues[i] = prev === 0 ? 0 : ((cur - prev) / prev) * 100;
  }

  // Signal = EMA(TRIX) — null-propagating so leading null TRIX bars do not
  // contaminate the SMA seed of the signal line.
  const signalValues = emaOfNullable(trixValues, signalPeriod);

  const result: Series<TrixValue> = new Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    result[i] = {
      time: normalized[i].time,
      value: { trix: trixValues[i], signal: signalValues[i] },
    };
  }

  return tagSeries(result, withLabelParams(TRIX_META, [period]));
}
