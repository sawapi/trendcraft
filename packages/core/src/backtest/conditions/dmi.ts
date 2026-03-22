/**
 * DMI/ADX conditions
 */

import { dmi } from "../../indicators/momentum/dmi";
import type { PresetCondition } from "../../types";

// ============================================
// DMI/ADX Conditions
// ============================================

/**
 * DMI Bullish: +DI > -DI with optional ADX filter
 * @param minAdx Minimum ADX for trend strength (default: 20)
 * @example
 * ```ts
 * import { runBacktest, dmiBullish, dmiBearish } from "trendcraft";
 *
 * const result = runBacktest(candles, dmiBullish(25), dmiBearish(25), {
 *   capital: 1_000_000,
 * });
 * ```
 */
export function dmiBullish(minAdx = 20, period = 14): PresetCondition {
  const cacheKey = `dmi_${period}`;

  return {
    type: "preset",
    name: `dmiBullish(ADX>${minAdx})`,
    evaluate: (indicators, candle, index, candles) => {
      let dmiData = indicators[cacheKey] as
        | {
            time: number;
            value: { plusDi: number | null; minusDi: number | null; adx: number | null };
          }[]
        | undefined;

      if (!dmiData) {
        dmiData = dmi(candles, { period });
        indicators[cacheKey] = dmiData;
      }

      const d = dmiData[index]?.value;
      if (!d || d.plusDi === null || d.minusDi === null || d.adx === null) return false;

      return d.plusDi > d.minusDi && d.adx >= minAdx;
    },
  };
}

/**
 * DMI Bearish: -DI > +DI with optional ADX filter
 * @param minAdx Minimum ADX for trend strength (default: 20)
 * @example
 * ```ts
 * import { runBacktest, dmiBullish, dmiBearish, and, adxStrong } from "trendcraft";
 *
 * // Only enter when trend is strong (ADX > 30)
 * const entry = and(dmiBullish(), adxStrong(30));
 * const result = runBacktest(candles, entry, dmiBearish(), { capital: 1_000_000 });
 * ```
 */
export function dmiBearish(minAdx = 20, period = 14): PresetCondition {
  const cacheKey = `dmi_${period}`;

  return {
    type: "preset",
    name: `dmiBearish(ADX>${minAdx})`,
    evaluate: (indicators, candle, index, candles) => {
      let dmiData = indicators[cacheKey] as
        | {
            time: number;
            value: { plusDi: number | null; minusDi: number | null; adx: number | null };
          }[]
        | undefined;

      if (!dmiData) {
        dmiData = dmi(candles, { period });
        indicators[cacheKey] = dmiData;
      }

      const d = dmiData[index]?.value;
      if (!d || d.plusDi === null || d.minusDi === null || d.adx === null) return false;

      return d.minusDi > d.plusDi && d.adx >= minAdx;
    },
  };
}

/**
 * ADX Strong Trend: ADX above threshold
 * @param threshold ADX threshold (default: 25)
 * @example
 * ```ts
 * import { runBacktest, and, goldenCrossCondition, adxStrong, deadCrossCondition } from "trendcraft";
 *
 * // Golden cross only when trend is strong
 * const entry = and(goldenCrossCondition(), adxStrong(25));
 * const result = runBacktest(candles, entry, deadCrossCondition(), { capital: 1_000_000 });
 * ```
 */
export function adxStrong(threshold = 25, period = 14): PresetCondition {
  const cacheKey = `dmi_${period}`;

  return {
    type: "preset",
    name: `adxStrong(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let dmiData = indicators[cacheKey] as
        | {
            time: number;
            value: { plusDi: number | null; minusDi: number | null; adx: number | null };
          }[]
        | undefined;

      if (!dmiData) {
        dmiData = dmi(candles, { period });
        indicators[cacheKey] = dmiData;
      }

      const d = dmiData[index]?.value;
      return d?.adx !== null && d?.adx !== undefined && d.adx >= threshold;
    },
  };
}
