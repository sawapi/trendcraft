/**
 * Klinger Volume Oscillator (KVO)
 *
 * Compares short-term and long-term volume force EMAs
 * to identify long-term money flow trends.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { KLINGER_META } from "../indicator-meta";

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
 * Stephen J. Klinger's volume oscillator (1997 Stocks & Commodities
 * article). The default (34, 55, 13) parameters are Klinger's own.
 *
 * 1. Key Price = High + Low + Close
 * 2. Trend (T) = +1 if Key Price > prev Key Price, else -1
 * 3. DM = High - Low (daily range)
 * 4. CM (cumulative measurement):
 *    - same trend: CM = prev CM + DM
 *    - trend reversal: CM = DM (this implementation; the original
 *      paper specifies CM = prev DM + DM. Both forms are seen in
 *      published implementations and produce nearly identical
 *      oscillator shapes at default periods. Held to avoid a breaking
 *      VF-magnitude shift; pin the variant in JSDoc as a documented
 *      choice.)
 * 5. Volume Force (VF) = Volume × |2 × (DM / CM) − 1| × T × 100
 * 6. KVO = EMA(VF, shortPeriod) − EMA(VF, longPeriod)
 * 7. Signal = EMA(KVO, signalPeriod)
 *
 * The Key Price is intentionally the **sum** H+L+C (not HLC/3) — only
 * its sign of change matters for trend determination, so the divisor
 * is a no-op.
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

  return tagSeries(result, withLabelParams(KLINGER_META, [shortPeriod, longPeriod, signalPeriod]));
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
