/**
 * Multi-Timeframe (MTF) Conditions
 *
 * Backtest conditions that evaluate indicators on higher timeframes.
 * Useful for trend-following strategies that confirm direction on weekly/monthly.
 */

import { getMtfIndicator, setMtfIndicator } from "../../core/mtf-context";
import { type DmiValue, dmi } from "../../indicators/momentum/dmi";
import { rsi } from "../../indicators/momentum/rsi";
import { ema, sma } from "../../indicators/moving-average";
import type {
  MtfContext,
  MtfPresetCondition,
  NormalizedCandle,
  TimeframeShorthand,
} from "../../types";

// ============================================
// RSI Conditions
// ============================================

/**
 * Weekly RSI above threshold
 *
 * @param threshold - RSI threshold (default: 50)
 * @param period - RSI period (default: 14)
 *
 * @example
 * ```ts
 * // Buy when weekly RSI > 50 and daily golden cross
 * const entry = and(weeklyRsiAbove(50), goldenCross());
 * ```
 */
export function weeklyRsiAbove(threshold = 50, period = 14): MtfPresetCondition {
  return mtfRsiAbove("weekly", threshold, period);
}

/**
 * Weekly RSI below threshold
 */
export function weeklyRsiBelow(threshold = 50, period = 14): MtfPresetCondition {
  return mtfRsiBelow("weekly", threshold, period);
}

/**
 * Monthly RSI above threshold
 */
export function monthlyRsiAbove(threshold = 50, period = 14): MtfPresetCondition {
  return mtfRsiAbove("monthly", threshold, period);
}

/**
 * Monthly RSI below threshold
 */
export function monthlyRsiBelow(threshold = 50, period = 14): MtfPresetCondition {
  return mtfRsiBelow("monthly", threshold, period);
}

/**
 * Generic MTF RSI above condition
 */
export function mtfRsiAbove(
  timeframe: TimeframeShorthand,
  threshold = 50,
  period = 14,
): MtfPresetCondition {
  const cacheKey = `rsi_${period}`;

  return {
    type: "mtf-preset",
    name: `${timeframe}RsiAbove(${threshold})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      // Get or calculate RSI for this timeframe
      let rsiData = getMtfIndicator<Array<{ time: number; value: number | null }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!rsiData) {
        rsiData = rsi(dataset.candles, { period });
        setMtfIndicator(mtf, timeframe, cacheKey, rsiData);
      }

      const rsiValue = rsiData[mtfIndex]?.value;
      return rsiValue !== null && rsiValue !== undefined && rsiValue > threshold;
    },
  };
}

/**
 * Generic MTF RSI below condition
 */
export function mtfRsiBelow(
  timeframe: TimeframeShorthand,
  threshold = 50,
  period = 14,
): MtfPresetCondition {
  const cacheKey = `rsi_${period}`;

  return {
    type: "mtf-preset",
    name: `${timeframe}RsiBelow(${threshold})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      let rsiData = getMtfIndicator<Array<{ time: number; value: number | null }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!rsiData) {
        rsiData = rsi(dataset.candles, { period });
        setMtfIndicator(mtf, timeframe, cacheKey, rsiData);
      }

      const rsiValue = rsiData[mtfIndex]?.value;
      return rsiValue !== null && rsiValue !== undefined && rsiValue < threshold;
    },
  };
}

// ============================================
// Moving Average Conditions
// ============================================

/**
 * Price above weekly SMA
 *
 * @param period - SMA period (default: 20)
 */
export function weeklyPriceAboveSma(period = 20): MtfPresetCondition {
  return mtfPriceAboveSma("weekly", period);
}

/**
 * Price below weekly SMA
 */
export function weeklyPriceBelowSma(period = 20): MtfPresetCondition {
  return mtfPriceBelowSma("weekly", period);
}

/**
 * Price above monthly SMA
 */
export function monthlyPriceAboveSma(period = 20): MtfPresetCondition {
  return mtfPriceAboveSma("monthly", period);
}

/**
 * Price below monthly SMA
 */
export function monthlyPriceBelowSma(period = 20): MtfPresetCondition {
  return mtfPriceBelowSma("monthly", period);
}

/**
 * Generic MTF price above SMA condition
 */
export function mtfPriceAboveSma(timeframe: TimeframeShorthand, period = 20): MtfPresetCondition {
  const cacheKey = `sma_${period}`;

  return {
    type: "mtf-preset",
    name: `${timeframe}PriceAboveSma(${period})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      let smaData = getMtfIndicator<Array<{ time: number; value: number | null }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!smaData) {
        smaData = sma(dataset.candles, { period });
        setMtfIndicator(mtf, timeframe, cacheKey, smaData);
      }

      const smaValue = smaData[mtfIndex]?.value;
      const mtfCandle = dataset.candles[mtfIndex];

      return smaValue !== null && smaValue !== undefined && mtfCandle && mtfCandle.close > smaValue;
    },
  };
}

/**
 * Generic MTF price below SMA condition
 */
export function mtfPriceBelowSma(timeframe: TimeframeShorthand, period = 20): MtfPresetCondition {
  const cacheKey = `sma_${period}`;

  return {
    type: "mtf-preset",
    name: `${timeframe}PriceBelowSma(${period})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      let smaData = getMtfIndicator<Array<{ time: number; value: number | null }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!smaData) {
        smaData = sma(dataset.candles, { period });
        setMtfIndicator(mtf, timeframe, cacheKey, smaData);
      }

      const smaValue = smaData[mtfIndex]?.value;
      const mtfCandle = dataset.candles[mtfIndex];

      return smaValue !== null && smaValue !== undefined && mtfCandle && mtfCandle.close < smaValue;
    },
  };
}

/**
 * Price above weekly EMA
 */
export function weeklyPriceAboveEma(period = 20): MtfPresetCondition {
  return mtfPriceAboveEma("weekly", period);
}

/**
 * Generic MTF price above EMA condition
 */
export function mtfPriceAboveEma(timeframe: TimeframeShorthand, period = 20): MtfPresetCondition {
  const cacheKey = `ema_${period}`;

  return {
    type: "mtf-preset",
    name: `${timeframe}PriceAboveEma(${period})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      let emaData = getMtfIndicator<Array<{ time: number; value: number | null }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!emaData) {
        emaData = ema(dataset.candles, { period });
        setMtfIndicator(mtf, timeframe, cacheKey, emaData);
      }

      const emaValue = emaData[mtfIndex]?.value;
      const mtfCandle = dataset.candles[mtfIndex];

      return emaValue !== null && emaValue !== undefined && mtfCandle && mtfCandle.close > emaValue;
    },
  };
}

// ============================================
// Trend Strength Conditions
// ============================================

/**
 * Weekly trend is strong (ADX > threshold)
 *
 * @param adxThreshold - ADX threshold for strong trend (default: 25)
 */
export function weeklyTrendStrong(adxThreshold = 25): MtfPresetCondition {
  return mtfTrendStrong("weekly", adxThreshold);
}

/**
 * Monthly trend is strong
 */
export function monthlyTrendStrong(adxThreshold = 25): MtfPresetCondition {
  return mtfTrendStrong("monthly", adxThreshold);
}

/**
 * Generic MTF trend strength condition
 */
export function mtfTrendStrong(
  timeframe: TimeframeShorthand,
  adxThreshold = 25,
): MtfPresetCondition {
  const cacheKey = "dmi_14";

  return {
    type: "mtf-preset",
    name: `${timeframe}TrendStrong(ADX>${adxThreshold})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      let dmiData = getMtfIndicator<Array<{ time: number; value: DmiValue }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!dmiData) {
        dmiData = dmi(dataset.candles);
        setMtfIndicator(mtf, timeframe, cacheKey, dmiData);
      }

      const adxValue = dmiData[mtfIndex]?.value?.adx;
      return adxValue !== null && adxValue !== undefined && adxValue > adxThreshold;
    },
  };
}

/**
 * Weekly uptrend (+DI > -DI and ADX > threshold)
 */
export function weeklyUptrend(adxThreshold = 20): MtfPresetCondition {
  return mtfUptrend("weekly", adxThreshold);
}

/**
 * Weekly downtrend (-DI > +DI and ADX > threshold)
 */
export function weeklyDowntrend(adxThreshold = 20): MtfPresetCondition {
  return mtfDowntrend("weekly", adxThreshold);
}

/**
 * Generic MTF uptrend condition
 */
export function mtfUptrend(timeframe: TimeframeShorthand, adxThreshold = 20): MtfPresetCondition {
  const cacheKey = "dmi_14";

  return {
    type: "mtf-preset",
    name: `${timeframe}Uptrend(ADX>${adxThreshold})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      let dmiData = getMtfIndicator<Array<{ time: number; value: DmiValue }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!dmiData) {
        dmiData = dmi(dataset.candles);
        setMtfIndicator(mtf, timeframe, cacheKey, dmiData);
      }

      const value = dmiData[mtfIndex]?.value;
      if (!value) return false;

      const { plusDi, minusDi, adx: adxVal } = value;
      return (
        plusDi !== null &&
        minusDi !== null &&
        adxVal !== null &&
        plusDi > minusDi &&
        adxVal > adxThreshold
      );
    },
  };
}

/**
 * Generic MTF downtrend condition
 */
export function mtfDowntrend(timeframe: TimeframeShorthand, adxThreshold = 20): MtfPresetCondition {
  const cacheKey = "dmi_14";

  return {
    type: "mtf-preset",
    name: `${timeframe}Downtrend(ADX>${adxThreshold})`,
    requiredTimeframes: [timeframe],
    evaluate: (mtf, indicators, candle, index, candles) => {
      const dataset = mtf.datasets.get(timeframe);
      const mtfIndex = mtf.indices.get(timeframe);

      if (!dataset || mtfIndex === undefined) return false;

      let dmiData = getMtfIndicator<Array<{ time: number; value: DmiValue }>>(
        mtf,
        timeframe,
        cacheKey,
      );

      if (!dmiData) {
        dmiData = dmi(dataset.candles);
        setMtfIndicator(mtf, timeframe, cacheKey, dmiData);
      }

      const value = dmiData[mtfIndex]?.value;
      if (!value) return false;

      const { plusDi, minusDi, adx: adxVal } = value;
      return (
        plusDi !== null &&
        minusDi !== null &&
        adxVal !== null &&
        minusDi > plusDi &&
        adxVal > adxThreshold
      );
    },
  };
}

// ============================================
// Custom MTF Condition
// ============================================

/**
 * Create a custom MTF condition
 *
 * @param requiredTimeframes - Timeframes needed for this condition
 * @param name - Condition name for display
 * @param evaluate - Custom evaluation function
 *
 * @example
 * ```ts
 * // Custom: Weekly close above monthly close
 * const weeklyAboveMonthly = mtfCondition(
 *   ["weekly", "monthly"],
 *   "weeklyAboveMonthly",
 *   (mtf) => {
 *     const weeklyIdx = mtf.indices.get("weekly");
 *     const monthlyIdx = mtf.indices.get("monthly");
 *     const weekly = mtf.datasets.get("weekly")?.candles[weeklyIdx!];
 *     const monthly = mtf.datasets.get("monthly")?.candles[monthlyIdx!];
 *     return weekly && monthly && weekly.close > monthly.close;
 *   }
 * );
 * ```
 */
export function mtfCondition(
  requiredTimeframes: TimeframeShorthand[],
  name: string,
  evaluate: (
    mtf: MtfContext,
    indicators: Record<string, unknown>,
    candle: NormalizedCandle,
    index: number,
    candles: NormalizedCandle[],
  ) => boolean,
): MtfPresetCondition {
  return {
    type: "mtf-preset",
    name,
    requiredTimeframes,
    evaluate,
  };
}
