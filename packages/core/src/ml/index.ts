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

// Tokenizer
export {
  quantizeCandle,
  tokenizeCandles,
  tokenizePatterns,
  classifyShape,
  SHAPE_NAMES,
  PATTERN_NAMES,
} from "./tokenizer";

// Model
export { trainCandleFormer } from "./train";

// Indicator
export { candleFormer } from "./candle-former";

// Backtest conditions
export { candleFormerBullish, candleFormerBearish } from "./conditions";

// Types
export type {
  CandleToken,
  CandleFormerConfig,
  CandleFormerWeights,
  CandleFormerTrainOptions,
  CandleFormerTrainResult,
  CandleFormerOptions,
  CandleFormerValue,
  PredictionDirection,
} from "./types";

export {
  VOCAB_SIZE,
  PAD_TOKEN,
  NUM_CLASSES,
  NUM_SHAPES,
  NUM_VOLUME_BINS,
  NUM_PATTERNS,
  PATTERN_VOCAB_SIZE,
  PATTERN_NONE,
  DEFAULT_CONFIG,
} from "./types";
