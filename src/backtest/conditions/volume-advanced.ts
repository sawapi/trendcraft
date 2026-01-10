/**
 * Advanced Volume Conditions
 *
 * Backtest conditions for volume analysis including:
 * - Volume anomaly detection
 * - Volume Profile conditions (POC, Value Area)
 * - Volume trend confirmation
 */

import { cmf as calcCmf } from "../../indicators/volume/cmf";
import { obv as calcObv } from "../../indicators/volume/obv";
import { sma } from "../../indicators/moving-average/sma";
import { volumeAnomaly as calcVolumeAnomaly } from "../../indicators/volume/volume-anomaly";
import { volumeProfileSeries } from "../../indicators/volume/volume-profile";
import { volumeTrend as calcVolumeTrend } from "../../indicators/volume/volume-trend";
import type {
  PresetCondition,
  VolumeAnomalyValue,
  VolumeProfileValue,
  VolumeTrendValue,
} from "../../types";

// ============================================
// Volume Anomaly Conditions
// ============================================

/**
 * Volume anomaly detected (high or extreme)
 *
 * @param threshold - Minimum ratio to consider anomalous (default: 2.0)
 * @param period - Lookback period for average (default: 20)
 *
 * @example
 * ```ts
 * // Buy on golden cross with high volume
 * const entry = and(goldenCross(), volumeAnomalyCondition(2.0));
 * ```
 */
export function volumeAnomalyCondition(threshold = 2.0, period = 20): PresetCondition {
  const cacheKey = `volumeAnomaly_${period}_${threshold}`;

  return {
    type: "preset",
    name: `volumeAnomaly(${threshold}x)`,
    evaluate: (indicators, candle, index, candles) => {
      let anomalyData = indicators[cacheKey] as
        | { time: number; value: VolumeAnomalyValue }[]
        | undefined;

      if (!anomalyData) {
        anomalyData = calcVolumeAnomaly(candles, { period, highThreshold: threshold });
        indicators[cacheKey] = anomalyData;
      }

      const current = anomalyData[index]?.value;
      return current?.isAnomaly === true;
    },
  };
}

/**
 * Extreme volume detected (typically 3x average)
 *
 * @param threshold - Minimum ratio for extreme (default: 3.0)
 * @param period - Lookback period for average (default: 20)
 */
export function volumeExtreme(threshold = 3.0, period = 20): PresetCondition {
  const cacheKey = `volumeAnomaly_${period}_extreme`;

  return {
    type: "preset",
    name: `volumeExtreme(${threshold}x)`,
    evaluate: (indicators, candle, index, candles) => {
      let anomalyData = indicators[cacheKey] as
        | { time: number; value: VolumeAnomalyValue }[]
        | undefined;

      if (!anomalyData) {
        anomalyData = calcVolumeAnomaly(candles, {
          period,
          highThreshold: threshold * 0.67,
          extremeThreshold: threshold,
        });
        indicators[cacheKey] = anomalyData;
      }

      const current = anomalyData[index]?.value;
      return current?.level === "extreme";
    },
  };
}

/**
 * Volume ratio above specified threshold
 *
 * @param minRatio - Minimum volume/average ratio (default: 1.5)
 * @param period - Lookback period (default: 20)
 */
export function volumeRatioAbove(minRatio = 1.5, period = 20): PresetCondition {
  const cacheKey = `volumeAnomaly_${period}_ratio`;

  return {
    type: "preset",
    name: `volumeRatioAbove(${minRatio})`,
    evaluate: (indicators, candle, index, candles) => {
      let anomalyData = indicators[cacheKey] as
        | { time: number; value: VolumeAnomalyValue }[]
        | undefined;

      if (!anomalyData) {
        anomalyData = calcVolumeAnomaly(candles, { period });
        indicators[cacheKey] = anomalyData;
      }

      const current = anomalyData[index]?.value;
      return current !== undefined && current.ratio >= minRatio;
    },
  };
}

// ============================================
// Volume Profile Conditions
// ============================================

/**
 * Price is near Point of Control (POC)
 *
 * @param tolerance - Percentage distance from POC to consider "near" (default: 0.02 = 2%)
 * @param profilePeriod - Period for volume profile calculation (default: 20)
 *
 * @example
 * ```ts
 * // Buy on bounce from POC
 * const entry = and(nearPoc(0.02), rsiBelow(30));
 * ```
 */
export function nearPoc(tolerance = 0.02, profilePeriod = 20): PresetCondition {
  const cacheKey = `volumeProfile_${profilePeriod}`;

  return {
    type: "preset",
    name: `nearPoc(${(tolerance * 100).toFixed(1)}%)`,
    evaluate: (indicators, candle, index, candles) => {
      let profileData = indicators[cacheKey] as
        | { time: number; value: VolumeProfileValue | null }[]
        | undefined;

      if (!profileData) {
        profileData = volumeProfileSeries(candles, { period: profilePeriod });
        indicators[cacheKey] = profileData;
      }

      const profile = profileData[index]?.value;
      if (!profile || profile.poc === 0) return false;

      const distance = Math.abs(candle.close - profile.poc) / profile.poc;
      return distance <= tolerance;
    },
  };
}

/**
 * Price is within Value Area (between VAL and VAH)
 *
 * @param profilePeriod - Period for volume profile calculation (default: 20)
 */
export function inValueArea(profilePeriod = 20): PresetCondition {
  const cacheKey = `volumeProfile_${profilePeriod}`;

  return {
    type: "preset",
    name: `inValueArea(${profilePeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      let profileData = indicators[cacheKey] as
        | { time: number; value: VolumeProfileValue | null }[]
        | undefined;

      if (!profileData) {
        profileData = volumeProfileSeries(candles, { period: profilePeriod });
        indicators[cacheKey] = profileData;
      }

      const profile = profileData[index]?.value;
      if (!profile) return false;

      return candle.close >= profile.val && candle.close <= profile.vah;
    },
  };
}

/**
 * Price breaks above Value Area High (potential bullish breakout)
 *
 * @param profilePeriod - Period for volume profile calculation (default: 20)
 */
export function breakoutVah(profilePeriod = 20): PresetCondition {
  const cacheKey = `volumeProfile_${profilePeriod}`;

  return {
    type: "preset",
    name: `breakoutVah(${profilePeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let profileData = indicators[cacheKey] as
        | { time: number; value: VolumeProfileValue | null }[]
        | undefined;

      if (!profileData) {
        profileData = volumeProfileSeries(candles, { period: profilePeriod });
        indicators[cacheKey] = profileData;
      }

      const profile = profileData[index]?.value;
      const prevProfile = profileData[index - 1]?.value;
      if (!profile || !prevProfile) return false;

      // Previous close was at or below VAH, current close is above
      return candles[index - 1].close <= prevProfile.vah && candle.close > profile.vah;
    },
  };
}

/**
 * Price breaks below Value Area Low (potential bearish breakdown)
 *
 * @param profilePeriod - Period for volume profile calculation (default: 20)
 */
export function breakdownVal(profilePeriod = 20): PresetCondition {
  const cacheKey = `volumeProfile_${profilePeriod}`;

  return {
    type: "preset",
    name: `breakdownVal(${profilePeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let profileData = indicators[cacheKey] as
        | { time: number; value: VolumeProfileValue | null }[]
        | undefined;

      if (!profileData) {
        profileData = volumeProfileSeries(candles, { period: profilePeriod });
        indicators[cacheKey] = profileData;
      }

      const profile = profileData[index]?.value;
      const prevProfile = profileData[index - 1]?.value;
      if (!profile || !prevProfile) return false;

      // Previous close was at or above VAL, current close is below
      return candles[index - 1].close >= prevProfile.val && candle.close < profile.val;
    },
  };
}

/**
 * Price is above POC (bullish position in profile)
 *
 * @param profilePeriod - Period for volume profile calculation (default: 20)
 */
export function priceAbovePoc(profilePeriod = 20): PresetCondition {
  const cacheKey = `volumeProfile_${profilePeriod}`;

  return {
    type: "preset",
    name: `priceAbovePoc(${profilePeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      let profileData = indicators[cacheKey] as
        | { time: number; value: VolumeProfileValue | null }[]
        | undefined;

      if (!profileData) {
        profileData = volumeProfileSeries(candles, { period: profilePeriod });
        indicators[cacheKey] = profileData;
      }

      const profile = profileData[index]?.value;
      if (!profile || profile.poc === 0) return false;

      return candle.close > profile.poc;
    },
  };
}

/**
 * Price is below POC (bearish position in profile)
 *
 * @param profilePeriod - Period for volume profile calculation (default: 20)
 */
export function priceBelowPoc(profilePeriod = 20): PresetCondition {
  const cacheKey = `volumeProfile_${profilePeriod}`;

  return {
    type: "preset",
    name: `priceBelowPoc(${profilePeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      let profileData = indicators[cacheKey] as
        | { time: number; value: VolumeProfileValue | null }[]
        | undefined;

      if (!profileData) {
        profileData = volumeProfileSeries(candles, { period: profilePeriod });
        indicators[cacheKey] = profileData;
      }

      const profile = profileData[index]?.value;
      if (!profile || profile.poc === 0) return false;

      return candle.close < profile.poc;
    },
  };
}

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
      let cmfData = indicators[cacheKey] as
        | { time: number; value: number | null }[]
        | undefined;

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
      let cmfData = indicators[cacheKey] as
        | { time: number; value: number | null }[]
        | undefined;

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

      let obvData = indicators[cacheKey] as
        | { time: number; value: number }[]
        | undefined;

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

      let obvData = indicators[cacheKey] as
        | { time: number; value: number }[]
        | undefined;

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
