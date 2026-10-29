/**
 * Volume Signal Evaluators
 *
 * Signal evaluators for volume-based indicators.
 */

import { checkedPrefix } from "../../core/normalize";
import { cmf, volumeAnomaly, volumeMa, volumeTrend } from "../../indicators";
import type { NormalizedCandle, PrecomputedIndicators, SignalDefinition } from "../../types";
import { assertInRange, assertPositive } from "../../utils/validate-number";
import { assertPeriod } from "../../utils/validate-period";

/**
 * Create volume spike evaluator
 *
 * Returns 1 when volume is significantly above average.
 *
 * @param threshold - Volume ratio threshold (default: 1.5 = 50% above avg)
 * @param period - MA period for average (default: 20)
 * @throws Error if `threshold` is not positive or `period` is not a positive integer
 * @example
 * ```ts
 * import { ScoreBuilder, createVolumeSpikeEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "volSpike", displayName: "Volume Spike", weight: 1.5, evaluate: createVolumeSpikeEvaluator(1.5) })
 *   .build();
 * ```
 */
export function createVolumeSpikeEvaluator(
  threshold = 1.5,
  period = 20,
): SignalDefinition["evaluate"] {
  assertPositive("createVolumeSpikeEvaluator threshold", threshold);
  assertPeriod("createVolumeSpikeEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available (for period 20 only)
    let avgVol: number | null | undefined;

    if (precomputed?.volumeMa20 && period === 20) {
      avgVol = precomputed.volumeMa20[index];
    } else {
      const slice = checkedPrefix(candles, index + 1);
      const volMaSeries = volumeMa(slice, { period });
      avgVol = volMaSeries[volMaSeries.length - 1]?.value;
    }

    if (avgVol === null || avgVol === undefined || avgVol === 0) return 0;

    const currentVol = candles[index].volume;
    const ratio = currentVol / avgVol;

    if (ratio >= threshold * 2) return 1; // Very high spike
    if (ratio >= threshold) {
      // Scale between threshold and 2x threshold
      return 0.5 + (ratio - threshold) / (threshold * 2);
    }

    return 0;
  };
}

/**
 * Create volume anomaly evaluator
 *
 * Returns 1 when volume is statistically anomalous (above z-score threshold).
 *
 * @param zThreshold - Z-score threshold (default: 2)
 * @param period - Period for stats (default: 20)
 * @throws Error if `zThreshold` is not positive or `period` is not a positive integer
 */
export function createVolumeAnomalyEvaluator(
  zThreshold = 2,
  period = 20,
): SignalDefinition["evaluate"] {
  assertPositive("createVolumeAnomalyEvaluator zThreshold", zThreshold);
  assertPeriod("createVolumeAnomalyEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available (for period 20 and zThreshold 2 only)
    let current:
      | { ratio: number; level: string; isAnomaly: boolean; zScore: number | null }
      | null
      | undefined;

    if (precomputed?.volumeAnomaly && period === 20 && zThreshold === 2) {
      current = precomputed.volumeAnomaly[index];
    } else {
      const slice = checkedPrefix(candles, index + 1);
      const anomalySeries = volumeAnomaly(slice, { period, zScoreThreshold: zThreshold });
      const anomalyValue = anomalySeries[anomalySeries.length - 1]?.value;
      if (anomalyValue) {
        current = {
          ratio: anomalyValue.ratio,
          level: anomalyValue.level ?? "normal",
          isAnomaly: anomalyValue.isAnomaly,
          zScore: anomalyValue.zScore,
        };
      }
    }

    if (!current) return 0;

    if (current.isAnomaly && current.zScore !== null) {
      // Scale by how much it exceeds threshold
      const excess = current.zScore - zThreshold;
      return Math.min(1, 0.7 + excess * 0.1);
    }

    return 0;
  };
}

/**
 * Create bullish volume trend evaluator
 *
 * Returns 1 when volume is increasing with price (healthy uptrend).
 * @throws Error if `maPeriod` is not a positive integer
 */
export function createBullishVolumeTrendEvaluator(maPeriod = 20): SignalDefinition["evaluate"] {
  assertPeriod("createBullishVolumeTrendEvaluator maPeriod", maPeriod);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < maPeriod) return 0;

    // Use pre-computed data if available (for period 20 only)
    let current:
      | {
          isConfirmed: boolean;
          priceTrend: string;
          volumeTrend: string;
          confidence: number;
          hasDivergence: boolean;
        }
      | null
      | undefined;

    if (precomputed?.volumeTrend && maPeriod === 20) {
      current = precomputed.volumeTrend[index];
    } else {
      const slice = checkedPrefix(candles, index + 1);
      const trendSeries = volumeTrend(slice, { maPeriod });
      current = trendSeries[trendSeries.length - 1]?.value;
    }

    if (!current) return 0;

    // Bullish volume: price up + volume up, confirmed
    if (current.isConfirmed && current.priceTrend === "up" && current.volumeTrend === "up") {
      return 1;
    }

    // Price up with volume rising, high confidence. The volume gate matters:
    // price up + volume down is the bearish divergence (weak rally), which
    // the bearish evaluator scores and this one must not.
    if (current.priceTrend === "up" && current.volumeTrend === "up" && current.confidence > 70) {
      return current.confidence / 100;
    }

    return 0;
  };
}

/**
 * Create bearish volume trend evaluator
 *
 * Returns 1 when volume pattern suggests distribution.
 * @throws Error if `maPeriod` is not a positive integer
 */
export function createBearishVolumeTrendEvaluator(maPeriod = 20): SignalDefinition["evaluate"] {
  assertPeriod("createBearishVolumeTrendEvaluator maPeriod", maPeriod);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < maPeriod) return 0;

    // Use pre-computed data if available (for period 20 only)
    let current:
      | {
          isConfirmed: boolean;
          priceTrend: string;
          volumeTrend: string;
          confidence: number;
          hasDivergence: boolean;
        }
      | null
      | undefined;

    if (precomputed?.volumeTrend && maPeriod === 20) {
      current = precomputed.volumeTrend[index];
    } else {
      const slice = checkedPrefix(candles, index + 1);
      const trendSeries = volumeTrend(slice, { maPeriod });
      current = trendSeries[trendSeries.length - 1]?.value;
    }

    if (!current) return 0;

    // Bearish volume: price down + volume up (selling pressure)
    if (current.priceTrend === "down" && current.volumeTrend === "up" && current.confidence > 70) {
      return 1;
    }

    // Divergence (price up but volume down - weakness)
    if (current.hasDivergence && current.priceTrend === "up") {
      return current.confidence / 100;
    }

    return 0;
  };
}

/**
 * Create CMF positive evaluator
 *
 * Returns 1 when Chaikin Money Flow is strongly positive.
 *
 * @param threshold - CMF threshold (default: 0.1)
 * @param period - CMF period (default: 20)
 * @throws Error if `threshold` is not in (0, 1] or `period` is not a positive integer
 * @example
 * ```ts
 * import { ScoreBuilder } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "cmf", displayName: "CMF Positive", weight: 1.5, evaluate: createCmfPositiveEvaluator(0.1) })
 *   .build();
 * ```
 */
export function createCmfPositiveEvaluator(
  threshold = 0.1,
  period = 20,
): SignalDefinition["evaluate"] {
  // CMF lies in [-1, 1]. The score divides by the threshold, and one at or
  // below 0 would score a negative CMF as positive.
  assertInRange("createCmfPositiveEvaluator threshold", threshold, 0, 1);
  if (threshold === 0) {
    throw new Error("createCmfPositiveEvaluator threshold must be greater than 0");
  }
  assertPeriod("createCmfPositiveEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available (for period 20 only)
    let current: number | null | undefined;

    if (precomputed?.cmf20 && period === 20) {
      current = precomputed.cmf20[index];
    } else {
      const slice = checkedPrefix(candles, index + 1);
      const cmfSeries = cmf(slice, { period });
      current = cmfSeries[cmfSeries.length - 1]?.value;
    }

    if (current === null || current === undefined) return 0;

    if (current >= threshold) {
      // Scale between threshold and 2x threshold: threshold = 0.5, 2x threshold+ = 1
      return Math.min(1, 0.5 + (current - threshold) / (threshold * 2));
    }

    if (current > 0) {
      return (current / threshold) * 0.5; // Partial score for positive but below threshold
    }

    return 0;
  };
}

/**
 * Create CMF negative evaluator
 *
 * Returns 1 when Chaikin Money Flow is strongly negative.
 *
 * @param threshold - CMF threshold (default: -0.1)
 * @param period - CMF period (default: 20)
 * @throws Error if `threshold` is not in [-1, 0) or `period` is not a positive integer
 */
export function createCmfNegativeEvaluator(
  threshold = -0.1,
  period = 20,
): SignalDefinition["evaluate"] {
  // Mirror of the positive evaluator: a threshold at or above 0 scored a
  // positive CMF as negative (0.154 for a threshold of +0.1).
  assertInRange("createCmfNegativeEvaluator threshold", threshold, -1, 0);
  if (threshold === 0) {
    throw new Error("createCmfNegativeEvaluator threshold must be less than 0");
  }
  assertPeriod("createCmfNegativeEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available (for period 20 only)
    let current: number | null | undefined;

    if (precomputed?.cmf20 && period === 20) {
      current = precomputed.cmf20[index];
    } else {
      const slice = checkedPrefix(candles, index + 1);
      const cmfSeries = cmf(slice, { period });
      current = cmfSeries[cmfSeries.length - 1]?.value;
    }

    if (current === null || current === undefined) return 0;

    if (current <= threshold) {
      // Scale between threshold and 2x threshold: threshold = 0.5, 2x threshold+ = 1
      const magnitude = Math.abs(threshold);
      return Math.min(1, 0.5 + (Math.abs(current) - magnitude) / (magnitude * 2));
    }

    if (current < 0) {
      return (Math.abs(current) / Math.abs(threshold)) * 0.5;
    }

    return 0;
  };
}

/**
 * Create high volume on up candle evaluator
 *
 * Returns 1 when there's high volume on an up candle (bullish accumulation).
 * @throws Error if `volumeThreshold` is not positive or `period` is not a positive integer
 */
export function createHighVolumeUpCandleEvaluator(
  volumeThreshold = 1.5,
  period = 20,
): SignalDefinition["evaluate"] {
  assertPositive("createHighVolumeUpCandleEvaluator volumeThreshold", volumeThreshold);
  assertPeriod("createHighVolumeUpCandleEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    const candle = candles[index];
    const isUpCandle = candle.close > candle.open;

    if (!isUpCandle) return 0;

    // Use pre-computed data if available (for period 20 only)
    let avgVol: number | null | undefined;

    if (precomputed?.volumeMa20 && period === 20) {
      avgVol = precomputed.volumeMa20[index];
    } else {
      const slice = checkedPrefix(candles, index + 1);
      const volMaSeries = volumeMa(slice, { period });
      avgVol = volMaSeries[volMaSeries.length - 1]?.value;
    }

    if (avgVol === null || avgVol === undefined || avgVol === 0) return 0;

    const ratio = candle.volume / avgVol;

    if (ratio >= volumeThreshold) {
      // Bonus for large candle body
      const bodySize = Math.abs(candle.close - candle.open);
      const range = candle.high - candle.low;
      const bodyRatio = range > 0 ? bodySize / range : 0;

      return Math.min(1, 0.6 + bodyRatio * 0.4);
    }

    return 0;
  };
}

// Pre-built signal definitions
export const volumeSpike: SignalDefinition = {
  name: "volumeSpike",
  displayName: "Volume Spike",
  weight: 1.5,
  category: "volume",
  evaluate: /* @__PURE__ */ createVolumeSpikeEvaluator(1.5, 20),
  requiredIndicators: ["volumeMa20"],
};

export const volumeAnomaly2z: SignalDefinition = {
  name: "volumeAnomaly",
  displayName: "Volume Anomaly (2σ)",
  weight: 2.0,
  category: "volume",
  evaluate: /* @__PURE__ */ createVolumeAnomalyEvaluator(2, 20),
  requiredIndicators: ["volumeAnomaly"],
};

export const bullishVolumeTrend: SignalDefinition = {
  name: "bullishVolumeTrend",
  displayName: "Bullish Volume",
  weight: 1.5,
  category: "volume",
  evaluate: /* @__PURE__ */ createBullishVolumeTrendEvaluator(20),
  requiredIndicators: ["volumeTrend"],
};

export const cmfPositive: SignalDefinition = {
  name: "cmfPositive",
  displayName: "CMF > 0.1",
  weight: 1.5,
  category: "volume",
  evaluate: /* @__PURE__ */ createCmfPositiveEvaluator(0.1, 20),
  requiredIndicators: ["cmf20"],
};

export const highVolumeUpCandle: SignalDefinition = {
  name: "highVolumeUp",
  displayName: "High Vol Up Candle",
  weight: 1.5,
  category: "volume",
  evaluate: /* @__PURE__ */ createHighVolumeUpCandleEvaluator(1.5, 20),
  requiredIndicators: ["volumeMa20"],
};
