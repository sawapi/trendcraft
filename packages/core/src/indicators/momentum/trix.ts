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
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { ema } from "../moving-average/ema";

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

  // Triple EMA smoothing
  const ema1 = ema(normalized, { period, source: "close" });

  // Build synthetic candles from ema1 for second EMA pass
  const ema1Candles: NormalizedCandle[] = ema1.map((e) => ({
    time: e.time,
    open: e.value ?? 0,
    high: e.value ?? 0,
    low: e.value ?? 0,
    close: e.value ?? 0,
    volume: 0,
  }));
  const ema2 = ema(ema1Candles, { period, source: "close" });

  const ema2Candles: NormalizedCandle[] = ema2.map((e) => ({
    time: e.time,
    open: e.value ?? 0,
    high: e.value ?? 0,
    low: e.value ?? 0,
    close: e.value ?? 0,
    volume: 0,
  }));
  const ema3 = ema(ema2Candles, { period, source: "close" });

  // Calculate TRIX: rate of change of ema3
  const trixValues: (number | null)[] = [];
  for (let i = 0; i < ema3.length; i++) {
    if (i === 0 || ema3[i].value === null || ema3[i - 1].value === null) {
      trixValues.push(null);
      continue;
    }
    const prev = ema3[i - 1].value ?? 0;
    if (prev === 0) {
      trixValues.push(0);
    } else {
      trixValues.push((((ema3[i].value ?? 0) - prev) / prev) * 100);
    }
  }

  // Calculate signal line (EMA of TRIX)
  const trixCandles: NormalizedCandle[] = trixValues.map((v, i) => ({
    time: normalized[i].time,
    open: v ?? 0,
    high: v ?? 0,
    low: v ?? 0,
    close: v ?? 0,
    volume: 0,
  }));
  const signalEma = ema(trixCandles, { period: signalPeriod, source: "close" });

  // Find the index where TRIX first becomes valid
  let firstValidTrix = -1;
  for (let i = 0; i < trixValues.length; i++) {
    if (trixValues[i] !== null) {
      firstValidTrix = i;
      break;
    }
  }

  const result: Series<TrixValue> = [];
  for (let i = 0; i < normalized.length; i++) {
    const trixVal = trixValues[i];
    // Signal is only valid after firstValidTrix + signalPeriod - 1
    const signalVal =
      firstValidTrix >= 0 && i >= firstValidTrix + signalPeriod - 1 ? signalEma[i].value : null;

    result.push({
      time: normalized[i].time,
      value: { trix: trixVal, signal: signalVal },
    });
  }

  return tagSeries(result, { overlay: false, label: "TRIX", referenceLines: [0] });
}
