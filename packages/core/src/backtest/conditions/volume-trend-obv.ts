/**
 * Volume Trend, CMF & OBV Conditions
 *
 * Backtest conditions for:
 * - Volume trend confirmation
 * - CMF (Chaikin Money Flow)
 * - OBV (On Balance Volume)
 */

import { sma } from "../../indicators/moving-average/sma";
import { cmf as calcCmf } from "../../indicators/volume/cmf";
import { obv as calcObv } from "../../indicators/volume/obv";
import { volumeTrend as calcVolumeTrend } from "../../indicators/volume/volume-trend";
import type { PresetCondition, VolumeTrendValue } from "../../types";

// ============================================
// Volume Trend Conditions
// ============================================

/**
 * Volume confirms the current price trend
 *
 * True when:
 * - Price up + volume up (healthy uptrend)
 * - Price down + volume up (strong selling)
 */
export function volumeConfirmsTrend(): PresetCondition {
  const cacheKey = "volumeTrend";

  return {
    type: "preset",
    name: "volumeConfirmsTrend",
    evaluate: (indicators, candle, index, candles) => {
      let trendData = indicators[cacheKey] as
        | { time: number; value: VolumeTrendValue }[]
        | undefined;

      if (!trendData) {
        trendData = calcVolumeTrend(candles);
        indicators[cacheKey] = trendData;
      }

      const current = trendData[index]?.value;
      return current?.isConfirmed === true;
    },
  };
}

/**
 * Volume diverges from price (potential reversal signal)
 *
 * True when:
 * - Price up + volume down (weak rally, potential top)
 * - Price down + volume down (selling exhaustion, potential bottom)
 */
export function volumeDivergence(): PresetCondition {
  const cacheKey = "volumeTrend";

  return {
    type: "preset",
    name: "volumeDivergence",
    evaluate: (indicators, candle, index, candles) => {
      let trendData = indicators[cacheKey] as
        | { time: number; value: VolumeTrendValue }[]
        | undefined;

      if (!trendData) {
        trendData = calcVolumeTrend(candles);
        indicators[cacheKey] = trendData;
      }

      const current = trendData[index]?.value;
      return current?.hasDivergence === true;
    },
  };
}

/**
 * Bullish volume divergence (price down but volume decreasing - exhaustion)
 */
export function bullishVolumeDivergence(): PresetCondition {
  const cacheKey = "volumeTrend";

  return {
    type: "preset",
    name: "bullishVolumeDivergence",
    evaluate: (indicators, candle, index, candles) => {
      let trendData = indicators[cacheKey] as
        | { time: number; value: VolumeTrendValue }[]
        | undefined;

      if (!trendData) {
        trendData = calcVolumeTrend(candles);
        indicators[cacheKey] = trendData;
      }

      const current = trendData[index]?.value;
      return (
        current?.hasDivergence === true &&
        current.priceTrend === "down" &&
        current.volumeTrend === "down"
      );
    },
  };
}

/**
 * Bearish volume divergence (price up but volume decreasing - weak rally)
 */
export function bearishVolumeDivergence(): PresetCondition {
  const cacheKey = "volumeTrend";

  return {
    type: "preset",
    name: "bearishVolumeDivergence",
    evaluate: (indicators, candle, index, candles) => {
      let trendData = indicators[cacheKey] as
        | { time: number; value: VolumeTrendValue }[]
        | undefined;

      if (!trendData) {
        trendData = calcVolumeTrend(candles);
        indicators[cacheKey] = trendData;
      }

      const current = trendData[index]?.value;
      return (
        current?.hasDivergence === true &&
        current.priceTrend === "up" &&
        current.volumeTrend === "down"
      );
    },
  };
}

/**
 * Volume trend confidence is above threshold
 *
 * @param minConfidence - Minimum confidence score (0-100, default: 60)
 */
export function volumeTrendConfidence(minConfidence = 60): PresetCondition {
  const cacheKey = "volumeTrend";

  return {
    type: "preset",
    name: `volumeTrendConfidence(${minConfidence})`,
    evaluate: (indicators, candle, index, candles) => {
      let trendData = indicators[cacheKey] as
        | { time: number; value: VolumeTrendValue }[]
        | undefined;

      if (!trendData) {
        trendData = calcVolumeTrend(candles);
        indicators[cacheKey] = trendData;
      }

      const current = trendData[index]?.value;
      return current !== undefined && current.confidence >= minConfidence;
    },
  };
}

// ============================================
// CMF (Chaikin Money Flow) Conditions
// ============================================

/**
 * CMF is above threshold (buying pressure / accumulation)
 *
 * CMF measures buying and selling pressure based on where price closes
 * within the high-low range, weighted by volume.
 *
 * @param threshold - CMF threshold (default: 0, range: -1 to 1)
 * @param period - CMF calculation period (default: 20)
 *
 * @example
 * ```ts
 * // Accumulation phase detection
 * const entry = and(
 *   volumeAccumulationCondition({ minDays: 3 }),
 *   cmfAbove(0),  // Buying pressure dominant
 *   priceAboveSma(50),
 * );
 *
 * // Strong buying pressure
 * const strongBuy = cmfAbove(0.1);
 * ```
 */
export function cmfAbove(threshold = 0, period = 20): PresetCondition {
  const cacheKey = `cmf_${period}`;

  return {
    type: "preset",
    name: `cmfAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let cmfData = indicators[cacheKey] as { time: number; value: number | null }[] | undefined;

      if (!cmfData) {
        cmfData = calcCmf(candles, { period });
        indicators[cacheKey] = cmfData;
      }

      const value = cmfData[index]?.value;
      return value !== null && value > threshold;
    },
  };
}

/**
 * CMF is below threshold (selling pressure / distribution)
 *
 * @param threshold - CMF threshold (default: 0, range: -1 to 1)
 * @param period - CMF calculation period (default: 20)
 *
 * @example
 * ```ts
 * // Distribution phase detection
 * const exit = and(
 *   cmfBelow(0),      // Selling pressure dominant
 *   rsiAbove(70),     // Overbought
 * );
 *
 * // Strong selling pressure
 * const strongSell = cmfBelow(-0.1);
 * ```
 */
export function cmfBelow(threshold = 0, period = 20): PresetCondition {
  const cacheKey = `cmf_${period}`;

  return {
    type: "preset",
    name: `cmfBelow(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let cmfData = indicators[cacheKey] as { time: number; value: number | null }[] | undefined;

      if (!cmfData) {
        cmfData = calcCmf(candles, { period });
        indicators[cacheKey] = cmfData;
      }

      const value = cmfData[index]?.value;
      return value !== null && value < threshold;
    },
  };
}

// ============================================
// OBV (On Balance Volume) Conditions
// ============================================

/**
 * OBV is rising (current OBV > OBV N periods ago)
 *
 * Rising OBV indicates accumulation - volume is flowing into the asset.
 * This is a bullish signal, especially when price is also rising.
 *
 * @param period - Number of periods to look back (default: 10)
 *
 * @example
 * ```ts
 * // Accumulation confirmation
 * const entry = and(
 *   volumeAccumulationCondition({ minDays: 3 }),
 *   cmfAbove(0),
 *   obvRising(10),  // OBV trending up
 * );
 * ```
 */
export function obvRising(period = 10): PresetCondition {
  const cacheKey = "obv";

  return {
    type: "preset",
    name: `obvRising(${period})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < period) return false;

      let obvData = indicators[cacheKey] as { time: number; value: number }[] | undefined;

      if (!obvData) {
        obvData = calcObv(candles);
        indicators[cacheKey] = obvData;
      }

      const current = obvData[index]?.value;
      const past = obvData[index - period]?.value;

      if (current === undefined || past === undefined) return false;

      return current > past;
    },
  };
}

/**
 * OBV is falling (current OBV < OBV N periods ago)
 *
 * Falling OBV indicates distribution - volume is flowing out of the asset.
 * This is a bearish signal, especially when price is also falling.
 *
 * @param period - Number of periods to look back (default: 10)
 *
 * @example
 * ```ts
 * // Distribution warning
 * const exit = and(
 *   obvFalling(10),   // OBV trending down
 *   cmfBelow(0),      // Selling pressure
 * );
 * ```
 */
export function obvFalling(period = 10): PresetCondition {
  const cacheKey = "obv";

  return {
    type: "preset",
    name: `obvFalling(${period})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < period) return false;

      let obvData = indicators[cacheKey] as { time: number; value: number }[] | undefined;

      if (!obvData) {
        obvData = calcObv(candles);
        indicators[cacheKey] = obvData;
      }

      const current = obvData[index]?.value;
      const past = obvData[index - period]?.value;

      if (current === undefined || past === undefined) return false;

      return current < past;
    },
  };
}

/**
 * OBV short-term MA crosses above long-term MA (bullish)
 *
 * This is similar to a golden cross but for OBV, indicating
 * increasing buying pressure momentum.
 *
 * @param shortPeriod - Short MA period (default: 5)
 * @param longPeriod - Long MA period (default: 20)
 *
 * @example
 * ```ts
 * // OBV momentum turning bullish
 * const entry = and(
 *   obvCrossUp(5, 20),
 *   rsiBelow(50),
 * );
 * ```
 */
export function obvCrossUp(shortPeriod = 5, longPeriod = 20): PresetCondition {
  const cacheKey = `obvMa_${shortPeriod}_${longPeriod}`;

  return {
    type: "preset",
    name: `obvCrossUp(${shortPeriod},${longPeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let maData = indicators[cacheKey] as
        | { short: number | null; long: number | null }[]
        | undefined;

      if (!maData) {
        const obvData = calcObv(candles);
        // Convert OBV to candle-like format for SMA calculation
        const obvCandles = obvData.map((d) => ({
          time: d.time,
          open: d.value,
          high: d.value,
          low: d.value,
          close: d.value,
          volume: 0,
        }));

        const shortMa = sma(obvCandles, { period: shortPeriod });
        const longMa = sma(obvCandles, { period: longPeriod });

        maData = obvData.map((_, i) => ({
          short: shortMa[i]?.value ?? null,
          long: longMa[i]?.value ?? null,
        }));

        indicators[cacheKey] = maData;
      }

      const current = maData[index];
      const prev = maData[index - 1];

      if (
        current?.short === null ||
        current?.long === null ||
        prev?.short === null ||
        prev?.long === null
      ) {
        return false;
      }

      // Cross up: previous short <= long, current short > long
      return prev.short <= prev.long && current.short > current.long;
    },
  };
}

/**
 * OBV short-term MA crosses below long-term MA (bearish)
 *
 * This is similar to a dead cross but for OBV, indicating
 * increasing selling pressure momentum.
 *
 * @param shortPeriod - Short MA period (default: 5)
 * @param longPeriod - Long MA period (default: 20)
 *
 * @example
 * ```ts
 * // OBV momentum turning bearish
 * const exit = and(
 *   obvCrossDown(5, 20),
 *   rsiAbove(50),
 * );
 * ```
 */
export function obvCrossDown(shortPeriod = 5, longPeriod = 20): PresetCondition {
  const cacheKey = `obvMa_${shortPeriod}_${longPeriod}`;

  return {
    type: "preset",
    name: `obvCrossDown(${shortPeriod},${longPeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let maData = indicators[cacheKey] as
        | { short: number | null; long: number | null }[]
        | undefined;

      if (!maData) {
        const obvData = calcObv(candles);
        // Convert OBV to candle-like format for SMA calculation
        const obvCandles = obvData.map((d) => ({
          time: d.time,
          open: d.value,
          high: d.value,
          low: d.value,
          close: d.value,
          volume: 0,
        }));

        const shortMa = sma(obvCandles, { period: shortPeriod });
        const longMa = sma(obvCandles, { period: longPeriod });

        maData = obvData.map((_, i) => ({
          short: shortMa[i]?.value ?? null,
          long: longMa[i]?.value ?? null,
        }));

        indicators[cacheKey] = maData;
      }

      const current = maData[index];
      const prev = maData[index - 1];

      if (
        current?.short === null ||
        current?.long === null ||
        prev?.short === null ||
        prev?.long === null
      ) {
        return false;
      }

      // Cross down: previous short >= long, current short < long
      return prev.short >= prev.long && current.short < current.long;
    },
  };
}
