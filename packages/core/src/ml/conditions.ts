/**
 * CandleFormer Backtest Conditions
 *
 * PresetCondition implementations for using CandleFormer predictions
 * as entry/exit signals in backtesting.
 */

import type { NormalizedCandle, PresetCondition, Series } from "../types";
import { candleFormer } from "./candle-former";
import type { CandleFormerValue, CandleFormerWeights } from "./types";

const CACHE_PREFIX = "candleFormer_";

/**
 * Get or compute cached CandleFormer predictions
 */
function getCachedPredictions(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  weights: CandleFormerWeights,
): Series<CandleFormerValue> {
  const cacheKey = `${CACHE_PREFIX}predictions`;
  const cached = indicators[cacheKey] as Series<CandleFormerValue> | undefined;
  if (cached) return cached;

  const predictions = candleFormer(candles, { weights });
  indicators[cacheKey] = predictions;
  return predictions;
}

/**
 * CandleFormer predicts bullish with minimum confidence
 *
 * @param weights - Pre-trained model weights
 * @param minConfidence - Minimum confidence threshold 0-100 (default: 50)
 *
 * @example
 * ```ts
 * const entry = candleFormerBullish(weights, 60);
 * const result = runBacktest(candles, { entry, exit: rsiAbove(70) });
 * ```
 */
export function candleFormerBullish(
  weights: CandleFormerWeights,
  minConfidence = 50,
): PresetCondition {
  return {
    type: "preset",
    name: `candleFormerBullish(${minConfidence})`,
    evaluate: (indicators, candle, _index, candles) => {
      const predictions = getCachedPredictions(indicators, candles, weights);
      const prediction = predictions.find((p) => p.time === candle.time);
      if (!prediction) return false;
      return (
        prediction.value.direction === "bullish" && prediction.value.confidence >= minConfidence
      );
    },
  };
}

/**
 * CandleFormer predicts bearish with minimum confidence
 *
 * @param weights - Pre-trained model weights
 * @param minConfidence - Minimum confidence threshold 0-100 (default: 50)
 *
 * @example
 * ```ts
 * const exit = candleFormerBearish(weights, 60);
 * const result = runBacktest(candles, { entry: rsiBelow(30), exit });
 * ```
 */
export function candleFormerBearish(
  weights: CandleFormerWeights,
  minConfidence = 50,
): PresetCondition {
  return {
    type: "preset",
    name: `candleFormerBearish(${minConfidence})`,
    evaluate: (indicators, candle, _index, candles) => {
      const predictions = getCachedPredictions(indicators, candles, weights);
      const prediction = predictions.find((p) => p.time === candle.time);
      if (!prediction) return false;
      return (
        prediction.value.direction === "bearish" && prediction.value.confidence >= minConfidence
      );
    },
  };
}
