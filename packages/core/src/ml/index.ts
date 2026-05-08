/**
 * CandleFormer - Mini Transformer for candlestick prediction
 *
 * A pure TypeScript implementation of a 1-layer Transformer decoder
 * that learns candlestick patterns and predicts next-bar direction.
 *
 * @example
 * ```ts
 * import { trainCandleFormer, candleFormer, candleFormerBullish } from "trendcraft";
 *
 * // Train
 * const { weights, accuracy } = trainCandleFormer(candles, { epochs: 200 });
 *
 * // Predict
 * const predictions = candleFormer(newCandles, { weights });
 *
 * // Backtest
 * const entry = candleFormerBullish(weights, 60);
 * ```
 */

// Indicator
export { candleFormer } from "./candle-former";
// Backtest conditions
export { candleFormerBearish, candleFormerBullish } from "./conditions";
// Tokenizer
export {
  classifyShape,
  PATTERN_NAMES,
  quantizeCandle,
  SHAPE_NAMES,
  tokenizeCandles,
  tokenizePatterns,
} from "./tokenizer";
// Model
export { trainCandleFormer } from "./train";

// Types
export type {
  CandleFormerConfig,
  CandleFormerOptions,
  CandleFormerTrainOptions,
  CandleFormerTrainResult,
  CandleFormerValue,
  CandleFormerWeights,
  CandleToken,
  PredictionDirection,
} from "./types";

export {
  DEFAULT_CONFIG,
  NUM_CLASSES,
  NUM_PATTERNS,
  NUM_SHAPES,
  NUM_VOLUME_BINS,
  PAD_TOKEN,
  PATTERN_NONE,
  PATTERN_VOCAB_SIZE,
  VOCAB_SIZE,
} from "./types";
