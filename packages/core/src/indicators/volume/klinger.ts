/**
 * Klinger Volume Oscillator (KVO)
 *
 * Compares short-term and long-term volume force EMAs
 * to identify long-term money flow trends.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Klinger value
 */
export type KlingerValue = {
  /** KVO line (short EMA - long EMA of Volume Force) */
  kvo: number | null;
  /** Signal line (EMA of KVO) */
  signal: number | null;
  /** Histogram (KVO - signal) */
  histogram: number | null;
};

/**
 * Klinger options
 */
export type KlingerOptions = {
  /** Short EMA period (default: 34) */
  shortPeriod?: number;
  /** Long EMA period (default: 55) */
  longPeriod?: number;
  /** Signal EMA period (default: 13) */
  signalPeriod?: number;
};

/**
 * Calculate Klinger Volume Oscillator
 *
 * 1. Trend (T) = +1 if (H+L+C) > prev(H+L+C), else -1
 * 2. dm = H - L
 * 3. cm = accumulates dm when trend continues, resets when trend reverses
 * 4. Volume Force (VF) = Volume × |2×(dm/cm) - 1| × T × 100
 * 5. KVO = EMA(VF, short) - EMA(VF, long)
 * 6. Signal = EMA(KVO, signal)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of Klinger values
 *
 * @example
 * ```ts
 * const kvo = klinger(candles, { shortPeriod: 34, longPeriod: 55 });
 * ```
 */
export function klinger(
  candles: Candle[] | NormalizedCandle[],
  options: KlingerOptions = {},
): Series<KlingerValue> {
  const { shortPeriod = 34, longPeriod = 55, signalPeriod = 13 } = options;

  if (shortPeriod < 1 || longPeriod < 1 || signalPeriod < 1) {
    throw new Error("Klinger periods must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const len = normalized.length;

  if (len === 0) {
    return [];
  }

  // Step 1: Calculate Volume Force
  const vf: number[] = new Array(len);
  let prevHlc = normalized[0].high + normalized[0].low + normalized[0].close;
  let prevTrend = 1;
  let cm = normalized[0].high - normalized[0].low;
  vf[0] = 0;

  for (let i = 1; i < len; i++) {
    const c = normalized[i];
    const hlc = c.high + c.low + c.close;
    const trend = hlc > prevHlc ? 1 : -1;
    const dm = c.high - c.low;

    if (trend === prevTrend) {
      cm += dm;
    } else {
      cm = dm;
    }

    // Volume Force
    const cmRatio = cm === 0 ? 0 : Math.abs(2 * (dm / cm) - 1);
    vf[i] = c.volume * cmRatio * trend * 100;

    prevHlc = hlc;
    prevTrend = trend;
  }

  // Step 2: EMA of VF (short and long)
  const shortEma = calcEma(vf, shortPeriod);
  const longEma = calcEma(vf, longPeriod);

  // Step 3: KVO = shortEma - longEma
  const kvoValues: (number | null)[] = new Array(len);
  for (let i = 0; i < len; i++) {
    if (shortEma[i] === null || longEma[i] === null) {
      kvoValues[i] = null;
    } else {
      kvoValues[i] = (shortEma[i] as number) - (longEma[i] as number);
    }
  }

  // Step 4: Signal = EMA of KVO
  const signalValues = calcEmaNullable(kvoValues, signalPeriod);

  // Build result
  const result: Series<KlingerValue> = new Array(len);
  for (let i = 0; i < len; i++) {
    const kvo = kvoValues[i];
    const signal = signalValues[i];
    result[i] = {
      time: normalized[i].time,
      value: {
        kvo,
        signal,
        histogram: kvo !== null && signal !== null ? kvo - signal : null,
      },
    };
  }

  return tagSeries(result, { pane: "sub", label: "Klinger", referenceLines: [0] });
}

/**
 * Simple EMA calculation for a number array
 */
function calcEma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length);
  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sum += values[i];
      result[i] = null;
    } else if (i === period - 1) {
      sum += values[i];
      result[i] = sum / period;
    } else {
      result[i] = values[i] * multiplier + (result[i - 1] as number) * (1 - multiplier);
    }
  }

  return result;
}

/**
 * EMA calculation for nullable values
 */
function calcEmaNullable(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length);
  const multiplier = 2 / (period + 1);

  let validCount = 0;
  let sum = 0;
  let seeded = false;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || (seeded === false && validCount < period - 1)) {
      if (v !== null) {
        sum += v;
        validCount++;
      }
      result[i] = null;
    } else if (!seeded) {
      sum += v;
      validCount++;
      result[i] = sum / period;
      seeded = true;
    } else {
      const prev = result[i - 1];
      if (prev === null) {
        result[i] = null;
      } else {
        result[i] = v * multiplier + prev * (1 - multiplier);
      }
    }
  }

  return result;
}
