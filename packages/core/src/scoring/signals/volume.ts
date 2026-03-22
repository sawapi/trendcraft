/**
 * Volume Signal Evaluators
 *
 * Signal evaluators for volume-based indicators.
 */

import { cmf, volumeAnomaly, volumeMa, volumeTrend } from "../../indicators";
import type { NormalizedCandle, PrecomputedIndicators, SignalDefinition } from "../../types";

/**
 * Create volume spike evaluator
 *
 * Returns 1 when volume is significantly above average.
 *
 * @param threshold - Volume ratio threshold (default: 1.5 = 50% above avg)
 * @param period - MA period for average (default: 20)
 * @example
 * ```ts
 * import { ScoreBuilder, createVolumeSpikeEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "volSpike", weight: 1.5, evaluate: createVolumeSpikeEvaluator(1.5) })
 *   .build();
 * ```
 */
export function createVolumeSpikeEvaluator(
  threshold = 1.5,
  period = 20,
): SignalDefinition["evaluate"] {
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
      const slice = candles.slice(0, index + 1);
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
 */
export function createVolumeAnomalyEvaluator(
  zThreshold = 2,
  period = 20,
): SignalDefinition["evaluate"] {
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
      const slice = candles.slice(0, index + 1);
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
 */
export function createBullishVolumeTrendEvaluator(maPeriod = 20): SignalDefinition["evaluate"] {
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
      const slice = candles.slice(0, index + 1);
      const trendSeries = volumeTrend(slice, { maPeriod });
      current = trendSeries[trendSeries.length - 1]?.value;
    }

    if (!current) return 0;

    // Bullish volume: price up + volume up, confirmed
    if (current.isConfirmed && current.priceTrend === "up" && current.volumeTrend === "up") {
      return 1;
    }

    // Price up with high confidence
    if (current.priceTrend === "up" && current.confidence > 70) {
      return current.confidence / 100;
    }

    return 0;
  };
}

/**
 * Create bearish volume trend evaluator
 *
 * Returns 1 when volume pattern suggests distribution.
 */
export function createBearishVolumeTrendEvaluator(maPeriod = 20): SignalDefinition["evaluate"] {
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
      const slice = candles.slice(0, index + 1);
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
 * @example
 * ```ts
 * import { ScoreBuilder, createCmfPositiveEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "cmf", weight: 1.5, evaluate: createCmfPositiveEvaluator(0.1) })
 *   .build();
 * ```
 */
export function createCmfPositiveEvaluator(
  threshold = 0.1,
  period = 20,
): SignalDefinition["evaluate"] {
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
      const slice = candles.slice(0, index + 1);
      const cmfSeries = cmf(slice, { period });
      current = cmfSeries[cmfSeries.length - 1]?.value;
    }

    if (current === null || current === undefined) return 0;

    if (current >= threshold) {
      // Scale: 0.1 = 0.5, 0.2+ = 1
      return Math.min(1, current / (threshold * 2) + 0.5);
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
 */
export function createCmfNegativeEvaluator(
  threshold = -0.1,
  period = 20,
): SignalDefinition["evaluate"] {
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
      const slice = candles.slice(0, index + 1);
      const cmfSeries = cmf(slice, { period });
      current = cmfSeries[cmfSeries.length - 1]?.value;
    }

    if (current === null || current === undefined) return 0;

    if (current <= threshold) {
      return Math.min(1, Math.abs(current) / (Math.abs(threshold) * 2) + 0.5);
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
 */
export function createHighVolumeUpCandleEvaluator(
  volumeThreshold = 1.5,
  period = 20,
): SignalDefinition["evaluate"] {
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
      const slice = candles.slice(0, index + 1);
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
  evaluate: createVolumeSpikeEvaluator(1.5, 20),
  requiredIndicators: ["volumeMa20"],
};

export const volumeAnomaly2z: SignalDefinition = {
  name: "volumeAnomaly",
  displayName: "Volume Anomaly (2σ)",
  weight: 2.0,
  category: "volume",
  evaluate: createVolumeAnomalyEvaluator(2, 20),
  requiredIndicators: ["volumeAnomaly"],
};

export const bullishVolumeTrend: SignalDefinition = {
  name: "bullishVolumeTrend",
  displayName: "Bullish Volume",
  weight: 1.5,
  category: "volume",
  evaluate: createBullishVolumeTrendEvaluator(20),
  requiredIndicators: ["volumeTrend"],
};

export const cmfPositive: SignalDefinition = {
  name: "cmfPositive",
  displayName: "CMF > 0.1",
  weight: 1.5,
  category: "volume",
  evaluate: createCmfPositiveEvaluator(0.1, 20),
  requiredIndicators: ["cmf20"],
};

export const highVolumeUpCandle: SignalDefinition = {
  name: "highVolumeUp",
  displayName: "High Vol Up Candle",
  weight: 1.5,
  category: "volume",
  evaluate: createHighVolumeUpCandleEvaluator(1.5, 20),
  requiredIndicators: ["volumeMa20"],
};
