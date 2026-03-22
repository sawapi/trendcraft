/**
 * Type definitions for CandleFormer - Mini Transformer for candlestick prediction
 */

// ============================================
// Tokenizer Types
// ============================================

/**
 * Quantized candle representation using shape-category tokenization.
 *
 * 17 traditional candlestick shape categories × 4 volume bins = 68 tokens + 1 PAD = 69 total.
 */
export type CandleToken = {
  /** Shape category (0-16): see SHAPE_NAMES for labels */
  shape: number;
  /** Volume bin (0-3): low, normal, high, spike */
  volumeBin: number;
  /** Token ID: shape * 4 + volumeBin */
  id: number;
};

/** Number of shape categories */
export const NUM_SHAPES = 17;

/** Number of volume bins */
export const NUM_VOLUME_BINS = 4;

/** Vocabulary size: 17 shapes × 4 volume + 1 PAD */
export const VOCAB_SIZE = 69;

/** PAD token ID */
export const PAD_TOKEN = 68;

/** Number of multi-candle pattern categories + 1 "none" */
export const NUM_PATTERNS = 15;

/** Pattern vocab size (14 multi-candle patterns + 1 "none") */
export const PATTERN_VOCAB_SIZE = 15;

/** "No pattern" token ID */
export const PATTERN_NONE = 0;

/** Number of prediction classes */
export const NUM_CLASSES = 3;

/** Prediction direction */
export type PredictionDirection = "bullish" | "bearish" | "neutral";

// ============================================
// Model Types
// ============================================

/**
 * Model hyperparameters
 */
export type CandleFormerConfig = {
  /** Vocabulary size (default: 46) */
  vocabSize: number;
  /** Sequence length / context window (default: 16) */
  seqLen: number;
  /** Embedding dimension (default: 16) */
  embedDim: number;
  /** Number of attention heads (default: 4) */
  numHeads: number;
  /** MLP hidden dimension (default: 64) */
  mlpDim: number;
  /** Number of output classes (default: 3) */
  numClasses: number;
  /** Dropout rate (default: 0.1, 0 = disabled) */
  dropoutRate: number;
  /** Number of transformer layers (default: 1) */
  numLayers: number;
  /** Pattern vocabulary size for dual embedding (default: 15, 0 = disabled) */
  patternVocabSize: number;
};

/**
 * Default model configuration
 */
export const DEFAULT_CONFIG: CandleFormerConfig = {
  vocabSize: VOCAB_SIZE,
  seqLen: 16,
  embedDim: 16,
  numHeads: 4,
  mlpDim: 64,
  numClasses: NUM_CLASSES,
  dropoutRate: 0.1,
  numLayers: 1,
  patternVocabSize: 0,
};

/**
 * Per-layer transformer weights (LN1, Attention, LN2, MLP)
 */
export type TransformerLayerWeights = {
  ln1Gamma: number[]; // [embedDim]
  ln1Beta: number[]; // [embedDim]
  wQ: number[][]; // [embedDim, embedDim]
  bQ: number[]; // [embedDim]
  wK: number[][]; // [embedDim, embedDim]
  bK: number[]; // [embedDim]
  wV: number[][]; // [embedDim, embedDim]
  bV: number[]; // [embedDim]
  wO: number[][]; // [embedDim, embedDim]
  bO: number[]; // [embedDim]
  ln2Gamma: number[]; // [embedDim]
  ln2Beta: number[]; // [embedDim]
  mlpW1: number[][]; // [embedDim, mlpDim]
  mlpB1: number[]; // [mlpDim]
  mlpW2: number[][]; // [mlpDim, embedDim]
  mlpB2: number[]; // [embedDim]
};

/**
 * Serializable model weights
 */
export type CandleFormerWeights = {
  config: CandleFormerConfig;

  // Embeddings
  tokenEmbed: number[][]; // [vocabSize, embedDim]
  posEmbed: number[][]; // [seqLen, embedDim]
  patternEmbed?: number[][]; // [patternVocabSize, embedDim] (optional, dual embedding)

  // Transformer layers
  layers: TransformerLayerWeights[];

  // Output head
  outW: number[][]; // [embedDim, numClasses]
  outB: number[]; // [numClasses]
};

// ============================================
// Training Types
// ============================================

/**
 * Training options
 */
export type CandleFormerTrainOptions = {
  /** Number of epochs (default: 100) */
  epochs?: number;
  /** Learning rate (default: 0.001) */
  learningRate?: number;
  /** Mini-batch size (default: 32) */
  batchSize?: number;
  /** Validation split ratio (default: 0.1) */
  validationSplit?: number;
  /** Sequence length (default: 16) */
  seqLen?: number;
  /** Embedding dimension (default: 16) */
  embedDim?: number;
  /** Number of attention heads (default: 4) */
  numHeads?: number;
  /** MLP hidden dimension (default: 64) */
  mlpDim?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Neutral threshold for target classification (default: 0.001) */
  neutralThreshold?: number;
  /** Softmax temperature for inference (default: 1.0) */
  temperature?: number;
  /** Early stopping patience (default: 10, 0 = disabled) */
  patience?: number;
  /** Dropout rate during training (default: 0.1) */
  dropoutRate?: number;
  /** Weight decay / L2 regularization (default: 0.01) */
  weightDecay?: number;
  /** Number of transformer layers (default: 1) */
  numLayers?: number;
  /** Number of warmup epochs for LR schedule (default: 10% of epochs) */
  warmupEpochs?: number;
  /** Label smoothing factor (default: 0.1, 0 = disabled) */
  labelSmoothing?: number;
  /** Gradient clipping max norm (default: 1.0, 0 = disabled) */
  gradClipNorm?: number;
  /** Enable pattern-aware dual embedding (default: false) */
  enablePatterns?: boolean;
  /** Epoch callback for progress reporting */
  onEpoch?: (epoch: number, trainLoss: number, valLoss: number | null) => void;
};

/**
 * Training result
 */
export type CandleFormerTrainResult = {
  /** Trained model weights */
  weights: CandleFormerWeights;
  /** Final training loss */
  trainLoss: number;
  /** Final validation loss (null if no validation split) */
  valLoss: number | null;
  /** Accuracy on validation set (0-1) */
  accuracy: number;
  /** Loss history per epoch */
  lossHistory: { epoch: number; trainLoss: number; valLoss: number | null }[];
};

// ============================================
// Indicator Types
// ============================================

/**
 * CandleFormer indicator options
 */
export type CandleFormerOptions = {
  /** Pre-trained model weights (required) */
  weights: CandleFormerWeights;
  /** Softmax temperature (default: 1.0, lower = more confident) */
  temperature?: number;
};

/**
 * CandleFormer prediction value
 */
export type CandleFormerValue = {
  /** Predicted direction */
  direction: PredictionDirection;
  /** Confidence 0-100 */
  confidence: number;
  /** Class probabilities */
  probabilities: { bullish: number; bearish: number; neutral: number };
  /** Current candle's token */
  token: CandleToken;
};
