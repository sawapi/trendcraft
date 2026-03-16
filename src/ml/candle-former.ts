/**
 * CandleFormer Indicator Wrapper
 *
 * Wraps the CandleFormer model as a standard TrendCraft indicator
 * returning Series<CandleFormerValue>.
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../types";
import { forward, predict, weightsToParams } from "./model";
import {
  classToDirection,
  computeVolumeRatios,
  padPatternTokens,
  padTokens,
  quantizeCandle,
  tokenizeCandles,
  tokenizePatterns,
} from "./tokenizer";
import type { CandleFormerOptions, CandleFormerValue } from "./types";

/**
 * CandleFormer indicator - predicts next candle direction using a trained Transformer
 *
 * Requires pre-trained weights (use `trainCandleFormer()` first).
 * Returns a prediction for each candle based on the preceding sequence.
 *
 * @param candles - Input candlestick data
 * @param options - Options including required pre-trained weights
 * @returns Series of predictions with direction, confidence, and probabilities
 *
 * @example
 * ```ts
 * const { weights } = trainCandleFormer(trainingCandles, { epochs: 200 });
 * const predictions = candleFormer(testCandles, { weights });
 *
 * for (const p of predictions) {
 *   console.log(`${p.value.direction} (${p.value.confidence}% confidence)`);
 * }
 * ```
 */
export function candleFormer(
  candles: Candle[] | NormalizedCandle[],
  options: CandleFormerOptions,
): Series<CandleFormerValue> {
  const { weights, temperature = 1.0 } = options;
  const { seqLen } = weights.config;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) return [];

  const params = weightsToParams(weights);
  const allTokens = tokenizeCandles(normalized);
  const volumeRatios = computeVolumeRatios(normalized);
  const hasPatterns = (params.config.patternVocabSize ?? 0) > 0;
  const allPatternTokens = hasPatterns ? tokenizePatterns(normalized) : null;
  const result: Series<CandleFormerValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    const token = quantizeCandle(candle, volumeRatios[i]);

    // Build input sequence: tokens up to and including current candle
    const contextTokens = allTokens.slice(0, i + 1);
    const paddedTokens = padTokens(contextTokens, seqLen);

    // Build pattern token sequence if dual embedding is enabled
    let paddedPatternTokens: number[] | undefined;
    if (allPatternTokens) {
      const contextPatterns = allPatternTokens.slice(0, i + 1);
      paddedPatternTokens = padPatternTokens(contextPatterns, seqLen);
    }

    // Forward pass
    const { logits } = forward(params, paddedTokens, false, undefined, paddedPatternTokens);
    const probs = predict(logits, temperature);

    // Extract probabilities
    const bullishProb = probs.data[0];
    const bearishProb = probs.data[1];
    const neutralProb = probs.data[2];

    // Determine predicted direction
    let maxProb = bullishProb;
    let classIdx = 0;
    if (bearishProb > maxProb) {
      maxProb = bearishProb;
      classIdx = 1;
    }
    if (neutralProb > maxProb) {
      maxProb = neutralProb;
      classIdx = 2;
    }

    result.push({
      time: candle.time,
      value: {
        direction: classToDirection(classIdx),
        confidence: Math.round(maxProb * 100),
        probabilities: {
          bullish: bullishProb,
          bearish: bearishProb,
          neutral: neutralProb,
        },
        token,
      },
    });
  }

  return result;
}
