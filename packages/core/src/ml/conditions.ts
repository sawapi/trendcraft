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
 * Predictions are fully determined by the weights, so each distinct weights
 * object gets a stable process-wide id that participates in the cache key.
 * Without it, mixing two models in one backtest (or across runs sharing an
 * IndicatorCache) would serve the first model's predictions to the second.
 */
const weightsIds = new WeakMap<CandleFormerWeights, number>();
let nextWeightsId = 0;
function weightsId(weights: CandleFormerWeights): number {
  let id = weightsIds.get(weights);
  if (id === undefined) {
    id = nextWeightsId++;
    weightsIds.set(weights, id);
  }
  return id;
}

/**
 * Get or compute cached CandleFormer predictions
 */
function getCachedPredictions(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  weights: CandleFormerWeights,
): Series<CandleFormerValue> {
  const cacheKey = `${CACHE_PREFIX}predictions_${weightsId(weights)}`;
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
 * const entry = candleFormerBullish(modelWeights, 60);
 * const result = runBacktest(candles, entry, rsiAbove(70), { capital: 100_000 });
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
 * const exit = candleFormerBearish(modelWeights, 60);
 * const result = runBacktest(candles, rsiBelow(30), exit, { capital: 100_000 });
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
