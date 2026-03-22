/**
 * CandleFormer Training Loop
 *
 * Mini-batch SGD with Adam optimizer, LR schedule, label smoothing, and gradient clipping.
 * Prepares training data from candle sequences, runs forward + backward passes,
 * and updates weights.
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import type { Candle, NormalizedCandle } from "../types";
import {
  type Gradients,
  type LayerGradients,
  accumulateGradients,
  backward,
  clipGradients,
  scaleGradients,
  zeroGradients,
} from "./backprop";
import {
  type ModelParams,
  type TransformerLayerParams,
  forward,
  initParams,
  paramsToWeights,
  weightsToParams,
} from "./model";
import { type Tensor, mulberry32 } from "./tensor";
import {
  classifyDirection,
  padPatternTokens,
  padTokens,
  tokenizeCandles,
  tokenizePatterns,
} from "./tokenizer";
import type {
  CandleFormerConfig,
  CandleFormerTrainOptions,
  CandleFormerTrainResult,
  CandleFormerWeights,
} from "./types";
import { DEFAULT_CONFIG, PATTERN_VOCAB_SIZE } from "./types";

// ============================================
// Training data preparation
// ============================================

type TrainSample = {
  tokens: number[]; // [seqLen]
  patternTokens: number[] | null; // [seqLen] or null if patterns disabled
  target: number; // 0=bullish, 1=bearish, 2=neutral
};

/**
 * Create training samples from candle data
 * Each sample: seqLen candles → predict direction of next candle
 */
function prepareTrainData(
  candles: NormalizedCandle[],
  seqLen: number,
  neutralThreshold: number,
  enablePatterns: boolean,
): TrainSample[] {
  const allTokens = tokenizeCandles(candles);
  const allPatternTokens = enablePatterns ? tokenizePatterns(candles) : null;
  const samples: TrainSample[] = [];

  // Sliding window: tokens[i..i+seqLen] → target from candles[i+seqLen-1] vs candles[i+seqLen]
  for (let i = 0; i <= allTokens.length - seqLen - 1; i++) {
    const tokens = allTokens.slice(i, i + seqLen);
    const patternTokens = allPatternTokens ? allPatternTokens.slice(i, i + seqLen) : null;
    const target = classifyDirection(
      candles[i + seqLen - 1],
      candles[i + seqLen],
      neutralThreshold,
    );
    samples.push({ tokens, patternTokens, target });
  }

  return samples;
}

/**
 * Shuffle array in-place using Fisher-Yates
 */
function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============================================
// Learning Rate Schedule
// ============================================

/**
 * Compute learning rate with warmup + cosine decay
 *
 * @param epoch - Current epoch (0-indexed)
 * @param totalEpochs - Total number of epochs
 * @param baseLr - Base learning rate
 * @param warmup - Number of warmup epochs
 * @returns Scheduled learning rate
 */
export function getLearningRate(
  epoch: number,
  totalEpochs: number,
  baseLr: number,
  warmup: number,
): number {
  if (warmup > 0 && epoch < warmup) {
    return (baseLr * (epoch + 1)) / warmup;
  }
  const progress = (epoch - warmup) / Math.max(1, totalEpochs - warmup);
  return baseLr * 0.5 * (1 + Math.cos(Math.PI * progress));
}

// ============================================
// Adam Optimizer
// ============================================

type AdamState = {
  m: Record<string, Float64Array>; // First moment
  v: Record<string, Float64Array>; // Second moment
  t: number; // Timestep
};

function initAdam(params: ModelParams): AdamState {
  const m: Record<string, Float64Array> = {};
  const v: Record<string, Float64Array> = {};

  // Embedding + output params
  const topLevelParams: [string, Tensor][] = [
    ["tokenEmbed", params.tokenEmbed],
    ["posEmbed", params.posEmbed],
    ["outW", params.outW],
    ["outB", params.outB],
  ];
  for (const [key, p] of topLevelParams) {
    m[key] = new Float64Array(p.data.length);
    v[key] = new Float64Array(p.data.length);
  }

  // Pattern embedding (optional)
  if (params.patternEmbed) {
    m.patternEmbed = new Float64Array(params.patternEmbed.data.length);
    v.patternEmbed = new Float64Array(params.patternEmbed.data.length);
  }

  // Per-layer params
  const layerKeys = getLayerParamKeys();
  for (let L = 0; L < params.layers.length; L++) {
    for (const key of layerKeys) {
      const fullKey = `layer${L}_${key}`;
      const p = params.layers[L][key as keyof TransformerLayerParams];
      m[fullKey] = new Float64Array(p.data.length);
      v[fullKey] = new Float64Array(p.data.length);
    }
  }

  return { m, v, t: 0 };
}

function getLayerParamKeys(): string[] {
  return [
    "ln1Gamma",
    "ln1Beta",
    "wQ",
    "bQ",
    "wK",
    "bK",
    "wV",
    "bV",
    "wO",
    "bO",
    "ln2Gamma",
    "ln2Beta",
    "mlpW1",
    "mlpB1",
    "mlpW2",
    "mlpB2",
  ];
}

function adamStep(
  params: ModelParams,
  grads: Gradients,
  state: AdamState,
  lr: number,
  beta1 = 0.9,
  beta2 = 0.999,
  eps = 1e-8,
): void {
  state.t++;

  const updateParam = (param: Tensor, grad: Tensor, mKey: string) => {
    const mArr = state.m[mKey];
    const vArr = state.v[mKey];
    for (let i = 0; i < param.data.length; i++) {
      mArr[i] = beta1 * mArr[i] + (1 - beta1) * grad.data[i];
      vArr[i] = beta2 * vArr[i] + (1 - beta2) * grad.data[i] * grad.data[i];
      const mHat = mArr[i] / (1 - beta1 ** state.t);
      const vHat = vArr[i] / (1 - beta2 ** state.t);
      param.data[i] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
    }
  };

  // Top-level params
  updateParam(params.tokenEmbed, grads.tokenEmbed, "tokenEmbed");
  updateParam(params.posEmbed, grads.posEmbed, "posEmbed");
  if (params.patternEmbed && grads.patternEmbed) {
    updateParam(params.patternEmbed, grads.patternEmbed, "patternEmbed");
  }
  updateParam(params.outW, grads.outW, "outW");
  updateParam(params.outB, grads.outB, "outB");

  // Per-layer params
  const layerKeys = getLayerParamKeys();
  for (let L = 0; L < params.layers.length; L++) {
    for (const key of layerKeys) {
      const fullKey = `layer${L}_${key}`;
      const param = params.layers[L][key as keyof TransformerLayerParams];
      const grad = grads.layers[L][key as keyof LayerGradients];
      updateParam(param, grad, fullKey);
    }
  }
}

// ============================================
// Evaluation
// ============================================

/**
 * Compute loss and accuracy on a dataset
 */
function evaluate(params: ModelParams, samples: TrainSample[]): { loss: number; accuracy: number } {
  if (samples.length === 0) return { loss: 0, accuracy: 0 };

  let totalLoss = 0;
  let correct = 0;

  for (const sample of samples) {
    const { logits } = forward(
      params,
      sample.tokens,
      false,
      undefined,
      sample.patternTokens ?? undefined,
    );
    totalLoss += logits.crossEntropyLoss([sample.target]);

    // Find predicted class
    let maxVal = Number.NEGATIVE_INFINITY;
    let predicted = 0;
    for (let j = 0; j < logits.cols; j++) {
      if (logits.data[j] > maxVal) {
        maxVal = logits.data[j];
        predicted = j;
      }
    }
    if (predicted === sample.target) correct++;
  }

  return {
    loss: totalLoss / samples.length,
    accuracy: correct / samples.length,
  };
}

// ============================================
// Weight decay keys
// ============================================

/** Layer-level weight keys subject to weight decay (exclude biases and LN) */
const LAYER_WEIGHT_DECAY_KEYS: (keyof TransformerLayerParams)[] = [
  "wQ",
  "wK",
  "wV",
  "wO",
  "mlpW1",
  "mlpW2",
];

// ============================================
// Main training function
// ============================================

/**
 * Train a CandleFormer model on candlestick data
 *
 * @param candles - Historical candlestick data, or array of multiple datasets (multi-stock training).
 *   Each dataset must have at least seqLen + 2 candles.
 * @param options - Training configuration
 * @returns Trained weights, loss, and accuracy metrics
 *
 * @example
 * ```ts
 * // Single stock
 * const { weights } = trainCandleFormer(candles, { epochs: 200 });
 *
 * // Multi-stock (samples generated independently per stock, no cross-contamination)
 * const { weights } = trainCandleFormer([aaplCandles, msftCandles, googCandles], {
 *   epochs: 200,
 * });
 * ```
 */
export function trainCandleFormer(
  candles: Candle[] | NormalizedCandle[] | (Candle[] | NormalizedCandle[])[],
  options: CandleFormerTrainOptions = {},
): CandleFormerTrainResult {
  const {
    epochs = 100,
    learningRate = 0.001,
    batchSize = 32,
    validationSplit = 0.1,
    seqLen = DEFAULT_CONFIG.seqLen,
    embedDim = DEFAULT_CONFIG.embedDim,
    numHeads = DEFAULT_CONFIG.numHeads,
    mlpDim = DEFAULT_CONFIG.mlpDim,
    seed = 42,
    neutralThreshold = 0.001,
    patience = 10,
    dropoutRate = 0.1,
    weightDecay = 0.01,
    numLayers = 1,
    warmupEpochs,
    labelSmoothing = 0.1,
    gradClipNorm = 1.0,
    enablePatterns = false,
    onEpoch,
  } = options;

  const warmup = warmupEpochs ?? Math.max(1, Math.floor(epochs * 0.1));

  // Normalize input: support single or multi-stock
  // Multi-stock: candles[0] is an array (another candle dataset), not a candle object
  const isMulti = candles.length > 0 && Array.isArray(candles[0]);
  const candleArrays: (Candle[] | NormalizedCandle[])[] = isMulti
    ? (candles as (Candle[] | NormalizedCandle[])[])
    : [candles as Candle[] | NormalizedCandle[]];

  // Build config
  const config: CandleFormerConfig = {
    ...DEFAULT_CONFIG,
    seqLen,
    embedDim,
    numHeads,
    mlpDim,
    dropoutRate,
    numLayers,
    patternVocabSize: enablePatterns ? PATTERN_VOCAB_SIZE : 0,
  };

  // Initialize model
  const params = initParams(config, seed);
  const rng = mulberry32(seed + 1);

  // Prepare training data from each dataset independently (no cross-contamination)
  const allSamples: TrainSample[] = [];
  for (const dataset of candleArrays) {
    const normalized = isNormalized(dataset) ? dataset : normalizeCandles(dataset);
    if (normalized.length < seqLen + 2) {
      throw new Error(`Need at least ${seqLen + 2} candles for training, got ${normalized.length}`);
    }
    const samples = prepareTrainData(normalized, seqLen, neutralThreshold, enablePatterns);
    allSamples.push(...samples);
  }
  shuffle(allSamples, rng);

  // Split into train/validation
  const valSize = Math.max(1, Math.floor(allSamples.length * validationSplit));
  const valSamples = validationSplit > 0 ? allSamples.slice(0, valSize) : [];
  const trainSamples = validationSplit > 0 ? allSamples.slice(valSize) : allSamples;

  if (trainSamples.length === 0) {
    throw new Error("Not enough data for training after validation split");
  }

  // Initialize Adam
  const adam = initAdam(params);

  // Training loop with early stopping
  const lossHistory: { epoch: number; trainLoss: number; valLoss: number | null }[] = [];
  let bestValLoss = Number.POSITIVE_INFINITY;
  let bestWeights: CandleFormerWeights | null = null;
  let patienceCounter = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const lr = getLearningRate(epoch, epochs, learningRate, warmup);

    shuffle(trainSamples, rng);

    let epochLoss = 0;
    let numBatches = 0;

    // Mini-batch training
    for (let batchStart = 0; batchStart < trainSamples.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, trainSamples.length);
      const batch = trainSamples.slice(batchStart, batchEnd);
      const actualBatchSize = batch.length;

      // Accumulate gradients over batch
      const batchGrads = zeroGradients(params);
      let batchLoss = 0;

      for (const sample of batch) {
        const { logits, cache } = forward(
          params,
          sample.tokens,
          true,
          rng,
          sample.patternTokens ?? undefined,
        );
        batchLoss += logits.crossEntropyLoss([sample.target]);

        const grads = backward(params, cache, sample.target, labelSmoothing);
        accumulateGradients(batchGrads, grads);
      }

      // Average gradients
      scaleGradients(batchGrads, 1 / actualBatchSize);

      // Gradient clipping
      if (gradClipNorm > 0) {
        clipGradients(batchGrads, gradClipNorm);
      }

      // Adam update
      adamStep(params, batchGrads, adam, lr);

      // Weight decay (AdamW style: applied after Adam step)
      if (weightDecay > 0) {
        // Top-level weight matrices
        const decayTargets = [params.tokenEmbed, params.posEmbed, params.outW];
        if (params.patternEmbed) decayTargets.push(params.patternEmbed);
        for (const p of decayTargets) {
          for (let i = 0; i < p.data.length; i++) {
            p.data[i] *= 1 - lr * weightDecay;
          }
        }
        // Per-layer weight matrices
        for (const layer of params.layers) {
          for (const key of LAYER_WEIGHT_DECAY_KEYS) {
            const p = layer[key];
            for (let i = 0; i < p.data.length; i++) {
              p.data[i] *= 1 - lr * weightDecay;
            }
          }
        }
      }

      epochLoss += batchLoss / actualBatchSize;
      numBatches++;
    }

    const trainLoss = epochLoss / numBatches;

    // Validation
    const valResult = valSamples.length > 0 ? evaluate(params, valSamples) : null;
    const valLoss = valResult?.loss ?? null;

    lossHistory.push({ epoch, trainLoss, valLoss });

    if (onEpoch) {
      onEpoch(epoch, trainLoss, valLoss);
    }

    // Early stopping check
    if (patience > 0 && valLoss !== null) {
      if (valLoss < bestValLoss - 1e-6) {
        bestValLoss = valLoss;
        bestWeights = paramsToWeights(params);
        patienceCounter = 0;
      } else {
        patienceCounter++;
        if (patienceCounter >= patience) {
          break;
        }
      }
    }
  }

  // Restore best weights if early stopping saved a checkpoint
  if (bestWeights) {
    const bestParams = weightsToParams(bestWeights);
    // Copy best params back for final evaluation
    params.tokenEmbed.data.set(bestParams.tokenEmbed.data);
    params.posEmbed.data.set(bestParams.posEmbed.data);
    if (params.patternEmbed && bestParams.patternEmbed) {
      params.patternEmbed.data.set(bestParams.patternEmbed.data);
    }
    params.outW.data.set(bestParams.outW.data);
    params.outB.data.set(bestParams.outB.data);
    for (let L = 0; L < params.layers.length; L++) {
      const layerKeys = getLayerParamKeys();
      for (const key of layerKeys) {
        const src = bestParams.layers[L][key as keyof TransformerLayerParams];
        const dst = params.layers[L][key as keyof TransformerLayerParams];
        dst.data.set(src.data);
      }
    }
  }

  // Final evaluation
  const trainEval = evaluate(params, trainSamples);
  const valEval = valSamples.length > 0 ? evaluate(params, valSamples) : null;

  return {
    weights: bestWeights ?? paramsToWeights(params),
    trainLoss: trainEval.loss,
    valLoss: valEval?.loss ?? null,
    accuracy: valEval?.accuracy ?? trainEval.accuracy,
    lossHistory,
  };
}
