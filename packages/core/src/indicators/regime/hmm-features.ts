/**
 * Feature extraction from candles for HMM regime detection.
 *
 * Extracts a multi-dimensional feature vector per candle for use with
 * the Gaussian HMM. Features capture returns, volatility, volume, and
 * candle morphology.
 *
 * @module
 */

import type { NormalizedCandle } from "../../types";

// ============================================
// Types
// ============================================

/** Options for feature extraction */
export type FeatureOptions = {
  /** Lookback for return calculation (default: 1) */
  returnLookback?: number;
  /** Rolling window for volatility (standard deviation of returns) (default: 20) */
  volatilityWindow?: number;
  /** Rolling window for volume ratio (volume / SMA of volume) (default: 20) */
  volumeWindow?: number;
};

// ============================================
// Feature Extraction
// ============================================

/**
 * Extract feature vectors from normalized candles for HMM input.
 *
 * Features per bar:
 * 1. **returns** - (close[i] - close[i-lookback]) / close[i-lookback], 0 for warmup
 * 2. **volatility** - Rolling standard deviation of returns, 0 for warmup
 * 3. **volumeRatio** - volume[i] / SMA(volume, window), 1 for warmup
 * 4. **range** - (high - low) / close, normalized bar range
 * 5. **bodyRatio** - |close - open| / (high - low), 0 if high === low
 *
 * @param candles - Normalized candle data
 * @param options - Feature extraction parameters
 * @returns Array of feature vectors, one per candle
 *
 * @example
 * ```ts
 * import { normalizeCandles } from "trendcraft";
 * import { extractFeatures } from "./hmm-features";
 *
 * const features = extractFeatures(normalizeCandles(candles));
 * // features[0] = [return, volatility, volumeRatio, range, bodyRatio]
 * ```
 */
export function extractFeatures(candles: NormalizedCandle[], options?: FeatureOptions): number[][] {
  const returnLookback = options?.returnLookback ?? 1;
  const volatilityWindow = options?.volatilityWindow ?? 20;
  const volumeWindow = options?.volumeWindow ?? 20;
  const T = candles.length;

  // Pre-compute returns
  const rets = new Array(T).fill(0);
  for (let i = returnLookback; i < T; i++) {
    const prev = candles[i - returnLookback].close;
    if (prev !== 0) {
      rets[i] = (candles[i].close - prev) / prev;
    }
  }

  // Pre-compute rolling volatility (std dev of returns)
  const vol = new Array(T).fill(0);
  for (let i = volatilityWindow; i < T; i++) {
    let sum = 0;
    for (let j = i - volatilityWindow; j < i; j++) {
      sum += rets[j];
    }
    const mean = sum / volatilityWindow;
    let sqSum = 0;
    for (let j = i - volatilityWindow; j < i; j++) {
      const diff = rets[j] - mean;
      sqSum += diff * diff;
    }
    vol[i] = Math.sqrt(sqSum / volatilityWindow);
  }

  // Pre-compute volume SMA and ratio
  const volRatio = new Array(T).fill(1);
  for (let i = volumeWindow; i < T; i++) {
    let sum = 0;
    for (let j = i - volumeWindow; j < i; j++) {
      sum += candles[j].volume;
    }
    const avg = sum / volumeWindow;
    volRatio[i] = avg > 0 ? candles[i].volume / avg : 1;
  }

  // Build feature matrix
  const features: number[][] = new Array(T);
  for (let i = 0; i < T; i++) {
    const c = candles[i];
    const range = c.close !== 0 ? (c.high - c.low) / c.close : 0;
    const barSize = c.high - c.low;
    const bodyRatio = barSize > 0 ? Math.abs(c.close - c.open) / barSize : 0;

    features[i] = [rets[i], vol[i], volRatio[i], range, bodyRatio];
  }

  return features;
}
