/**
 * CandleFormer Model - Forward Pass
 *
 * N-layer Transformer decoder following MicroGPT architecture:
 * Token Embed + Pos Embed → [LN1 → Causal Self-Attention → Residual
 * → LN2 → MLP (GELU) → Residual] × N → Output Head
 */

import { Tensor, mulberry32 } from "./tensor";
import type { CandleFormerConfig, CandleFormerWeights, TransformerLayerWeights } from "./types";
import { DEFAULT_CONFIG } from "./types";

// ============================================
// Per-layer parameters (Tensor form)
// ============================================

export type TransformerLayerParams = {
  ln1Gamma: Tensor; // [1, embedDim]
  ln1Beta: Tensor; // [1, embedDim]
  wQ: Tensor; // [embedDim, embedDim]
  bQ: Tensor; // [1, embedDim]
  wK: Tensor; // [embedDim, embedDim]
  bK: Tensor; // [1, embedDim]
  wV: Tensor; // [embedDim, embedDim]
  bV: Tensor; // [1, embedDim]
  wO: Tensor; // [embedDim, embedDim]
  bO: Tensor; // [1, embedDim]
  ln2Gamma: Tensor; // [1, embedDim]
  ln2Beta: Tensor; // [1, embedDim]
  mlpW1: Tensor; // [embedDim, mlpDim]
  mlpB1: Tensor; // [1, mlpDim]
  mlpW2: Tensor; // [mlpDim, embedDim]
  mlpB2: Tensor; // [1, embedDim]
};

// ============================================
// Model Parameters (Tensor form)
// ============================================

export type ModelParams = {
  config: CandleFormerConfig;
  tokenEmbed: Tensor; // [vocabSize, embedDim]
  posEmbed: Tensor; // [seqLen, embedDim]
  patternEmbed: Tensor | null; // [patternVocabSize, embedDim] (null if disabled)
  layers: TransformerLayerParams[];
  outW: Tensor; // [embedDim, numClasses]
  outB: Tensor; // [1, numClasses]
};

// ============================================
// Weight initialization
// ============================================

/**
 * Initialize a single transformer layer's parameters
 */
function initLayerParams(
  embedDim: number,
  mlpDim: number,
  rng: () => number,
): TransformerLayerParams {
  return {
    ln1Gamma: Tensor.ones(1, embedDim),
    ln1Beta: Tensor.zeros(1, embedDim),
    wQ: Tensor.randn(embedDim, embedDim, rng),
    bQ: Tensor.zeros(1, embedDim),
    wK: Tensor.randn(embedDim, embedDim, rng),
    bK: Tensor.zeros(1, embedDim),
    wV: Tensor.randn(embedDim, embedDim, rng),
    bV: Tensor.zeros(1, embedDim),
    wO: Tensor.randn(embedDim, embedDim, rng),
    bO: Tensor.zeros(1, embedDim),
    ln2Gamma: Tensor.ones(1, embedDim),
    ln2Beta: Tensor.zeros(1, embedDim),
    mlpW1: Tensor.randn(embedDim, mlpDim, rng),
    mlpB1: Tensor.zeros(1, mlpDim),
    mlpW2: Tensor.randn(mlpDim, embedDim, rng),
    mlpB2: Tensor.zeros(1, embedDim),
  };
}

/**
 * Initialize model parameters with Xavier initialization
 */
export function initParams(config: CandleFormerConfig = DEFAULT_CONFIG, seed = 42): ModelParams {
  const rng = mulberry32(seed);
  const { vocabSize, seqLen, embedDim, mlpDim, numClasses, numLayers } = config;

  const layers: TransformerLayerParams[] = [];
  for (let i = 0; i < numLayers; i++) {
    layers.push(initLayerParams(embedDim, mlpDim, rng));
  }

  const patternVocabSize = config.patternVocabSize ?? 0;

  return {
    config,
    tokenEmbed: Tensor.randn(vocabSize, embedDim, rng),
    posEmbed: Tensor.randn(seqLen, embedDim, rng),
    patternEmbed: patternVocabSize > 0 ? Tensor.randn(patternVocabSize, embedDim, rng) : null,
    layers,
    outW: Tensor.randn(embedDim, numClasses, rng),
    outB: Tensor.zeros(1, numClasses),
  };
}

// ============================================
// Serialization
// ============================================

function layerParamsToWeights(layer: TransformerLayerParams): TransformerLayerWeights {
  return {
    ln1Gamma: layer.ln1Gamma.toVec(),
    ln1Beta: layer.ln1Beta.toVec(),
    wQ: layer.wQ.toArray(),
    bQ: layer.bQ.toVec(),
    wK: layer.wK.toArray(),
    bK: layer.bK.toVec(),
    wV: layer.wV.toArray(),
    bV: layer.bV.toVec(),
    wO: layer.wO.toArray(),
    bO: layer.bO.toVec(),
    ln2Gamma: layer.ln2Gamma.toVec(),
    ln2Beta: layer.ln2Beta.toVec(),
    mlpW1: layer.mlpW1.toArray(),
    mlpB1: layer.mlpB1.toVec(),
    mlpW2: layer.mlpW2.toArray(),
    mlpB2: layer.mlpB2.toVec(),
  };
}

function layerWeightsToParams(lw: TransformerLayerWeights): TransformerLayerParams {
  return {
    ln1Gamma: Tensor.fromVec(lw.ln1Gamma),
    ln1Beta: Tensor.fromVec(lw.ln1Beta),
    wQ: Tensor.fromArray(lw.wQ),
    bQ: Tensor.fromVec(lw.bQ),
    wK: Tensor.fromArray(lw.wK),
    bK: Tensor.fromVec(lw.bK),
    wV: Tensor.fromArray(lw.wV),
    bV: Tensor.fromVec(lw.bV),
    wO: Tensor.fromArray(lw.wO),
    bO: Tensor.fromVec(lw.bO),
    ln2Gamma: Tensor.fromVec(lw.ln2Gamma),
    ln2Beta: Tensor.fromVec(lw.ln2Beta),
    mlpW1: Tensor.fromArray(lw.mlpW1),
    mlpB1: Tensor.fromVec(lw.mlpB1),
    mlpW2: Tensor.fromArray(lw.mlpW2),
    mlpB2: Tensor.fromVec(lw.mlpB2),
  };
}

/**
 * Convert Tensor-based params to JSON-serializable weights
 */
export function paramsToWeights(params: ModelParams): CandleFormerWeights {
  return {
    config: params.config,
    tokenEmbed: params.tokenEmbed.toArray(),
    posEmbed: params.posEmbed.toArray(),
    patternEmbed: params.patternEmbed?.toArray(),
    layers: params.layers.map(layerParamsToWeights),
    outW: params.outW.toArray(),
    outB: params.outB.toVec(),
  };
}

/**
 * Convert JSON weights to Tensor-based params.
 * Supports v1 format (flat layer fields) via auto-migration.
 */
export function weightsToParams(weights: CandleFormerWeights): ModelParams {
  // v1 → v2 migration: flat layer fields → layers array
  let layerWeights: TransformerLayerWeights[];
  if (!weights.layers && (weights as Record<string, unknown>).wQ) {
    const old = weights as unknown as Record<string, unknown>;
    layerWeights = [
      {
        ln1Gamma: old.ln1Gamma as number[],
        ln1Beta: old.ln1Beta as number[],
        wQ: old.wQ as number[][],
        bQ: old.bQ as number[],
        wK: old.wK as number[][],
        bK: old.bK as number[],
        wV: old.wV as number[][],
        bV: old.bV as number[],
        wO: old.wO as number[][],
        bO: old.bO as number[],
        ln2Gamma: old.ln2Gamma as number[],
        ln2Beta: old.ln2Beta as number[],
        mlpW1: old.mlpW1 as number[][],
        mlpB1: old.mlpB1 as number[],
        mlpW2: old.mlpW2 as number[][],
        mlpB2: old.mlpB2 as number[],
      },
    ];
  } else {
    layerWeights = weights.layers;
  }

  // Ensure config has numLayers (v1 configs lack it)
  const config: CandleFormerConfig = {
    ...weights.config,
    numLayers: weights.config.numLayers ?? layerWeights.length,
    patternVocabSize: weights.config.patternVocabSize ?? 0,
  };

  return {
    config,
    tokenEmbed: Tensor.fromArray(weights.tokenEmbed),
    posEmbed: Tensor.fromArray(weights.posEmbed),
    patternEmbed: weights.patternEmbed ? Tensor.fromArray(weights.patternEmbed) : null,
    layers: layerWeights.map(layerWeightsToParams),
    outW: Tensor.fromArray(weights.outW),
    outB: Tensor.fromVec(weights.outB),
  };
}

// ============================================
// Forward pass (intermediates saved for backprop)
// ============================================

/**
 * Per-layer intermediate values saved during forward pass
 */
export type LayerForwardCache = {
  input: Tensor; // [seqLen, embedDim] - input to this layer
  ln1Out: Tensor;
  Q: Tensor;
  K: Tensor;
  V: Tensor;
  attnScores: Tensor[];
  attnWeights: Tensor[];
  attnHeadOuts: Tensor[];
  attnConcat: Tensor;
  attnOut: Tensor;
  attnDropMask: Tensor | null;
  mlpDropMask: Tensor | null;
  residual1: Tensor;
  ln2Out: Tensor;
  mlpHidden: Tensor;
  mlpAct: Tensor;
  mlpOut: Tensor;
  residual2: Tensor;
};

/**
 * Intermediate values saved during forward pass for backpropagation
 */
export type ForwardCache = {
  tokens: number[];
  patternTokens: number[] | null;
  tokenEmbedOut: Tensor;
  posEmbedOut: Tensor;
  patternEmbedOut: Tensor | null;
  embedOut: Tensor;
  layerCaches: LayerForwardCache[];
  lastHidden: Tensor;
  logits: Tensor;
};

/**
 * Run a single transformer layer forward pass
 */
function forwardLayer(
  layer: TransformerLayerParams,
  input: Tensor,
  config: CandleFormerConfig,
  training: boolean,
  rng?: () => number,
): LayerForwardCache {
  const { seqLen, embedDim, numHeads } = config;
  const headDim = embedDim / numHeads;

  // LN1
  const ln1Out = input.layerNorm(layer.ln1Gamma, layer.ln1Beta);

  // Multi-Head Causal Self-Attention
  const Q = ln1Out.matmul(layer.wQ).addBias(layer.bQ);
  const K = ln1Out.matmul(layer.wK).addBias(layer.bK);
  const V = ln1Out.matmul(layer.wV).addBias(layer.bV);

  const attnScores: Tensor[] = [];
  const attnWeights: Tensor[] = [];
  const attnHeadOuts: Tensor[] = [];

  for (let h = 0; h < numHeads; h++) {
    const colStart = h * headDim;
    const colEnd = colStart + headDim;
    const Qh = Q.sliceCols(colStart, colEnd);
    const Kh = K.sliceCols(colStart, colEnd);
    const Vh = V.sliceCols(colStart, colEnd);

    const scores = Qh.matmul(Kh.transpose()).scale(1 / Math.sqrt(headDim));
    const masked = scores.causalMask();
    const weights = masked.softmax();
    const headOut = weights.matmul(Vh);

    attnScores.push(scores);
    attnWeights.push(weights);
    attnHeadOuts.push(headOut);
  }

  const attnConcat = Tensor.concatCols(attnHeadOuts);
  const attnOut = attnConcat.matmul(layer.wO).addBias(layer.bO);

  // Dropout on attention output
  let attnDropMask: Tensor | null = null;
  let attnOutFinal = attnOut;
  if (training && config.dropoutRate > 0 && rng) {
    attnDropMask = Tensor.dropoutMask(seqLen, embedDim, config.dropoutRate, rng);
    attnOutFinal = attnOut.mul(attnDropMask).scale(1 / (1 - config.dropoutRate));
  }

  // Residual 1
  const residual1 = input.add(attnOutFinal);

  // LN2
  const ln2Out = residual1.layerNorm(layer.ln2Gamma, layer.ln2Beta);

  // MLP
  const mlpHidden = ln2Out.matmul(layer.mlpW1).addBias(layer.mlpB1);
  const mlpAct = mlpHidden.gelu();
  const mlpOut = mlpAct.matmul(layer.mlpW2).addBias(layer.mlpB2);

  // Dropout on MLP output
  let mlpDropMask: Tensor | null = null;
  let mlpOutFinal = mlpOut;
  if (training && config.dropoutRate > 0 && rng) {
    mlpDropMask = Tensor.dropoutMask(seqLen, embedDim, config.dropoutRate, rng);
    mlpOutFinal = mlpOut.mul(mlpDropMask).scale(1 / (1 - config.dropoutRate));
  }

  // Residual 2
  const residual2 = residual1.add(mlpOutFinal);

  return {
    input,
    ln1Out,
    Q,
    K,
    V,
    attnScores,
    attnWeights,
    attnHeadOuts,
    attnConcat,
    attnOut,
    attnDropMask,
    mlpDropMask,
    residual1,
    ln2Out,
    mlpHidden,
    mlpAct,
    mlpOut,
    residual2,
  };
}

/**
 * Forward pass through the CandleFormer model
 *
 * @param params - Model parameters
 * @param tokens - Input token IDs (length = seqLen)
 * @param training - Enable dropout (default: false)
 * @param rng - Random number generator for dropout
 * @param patternTokens - Optional pattern token IDs for dual embedding (length = seqLen)
 * @returns Logits tensor [1, numClasses] and forward cache for backprop
 */
export function forward(
  params: ModelParams,
  tokens: number[],
  training = false,
  rng?: () => number,
  patternTokens?: number[],
): { logits: Tensor; cache: ForwardCache } {
  const { config } = params;
  const { seqLen, embedDim } = config;

  // 1. Token + Position Embedding (+ optional Pattern Embedding)
  const tokenEmbedOut = Tensor.gather(params.tokenEmbed, tokens);
  const posIndices = Array.from({ length: seqLen }, (_, i) => i);
  const posEmbedOut = Tensor.gather(params.posEmbed, posIndices);
  let embedOut = tokenEmbedOut.add(posEmbedOut);

  // Dual embedding: add pattern embedding if available
  let patternEmbedOut: Tensor | null = null;
  if (params.patternEmbed && patternTokens) {
    patternEmbedOut = Tensor.gather(params.patternEmbed, patternTokens);
    embedOut = embedOut.add(patternEmbedOut);
  }

  // 2. Transformer layers
  let hidden = embedOut;
  const layerCaches: LayerForwardCache[] = [];

  for (let L = 0; L < params.layers.length; L++) {
    const layerCache = forwardLayer(params.layers[L], hidden, config, training, rng);
    layerCaches.push(layerCache);
    hidden = layerCache.residual2;
  }

  // 3. Output head (last token only)
  const lastHidden = hidden.sliceRows(seqLen - 1, seqLen);
  const logits = lastHidden.matmul(params.outW).addBias(params.outB);

  const cache: ForwardCache = {
    tokens,
    patternTokens: patternTokens ?? null,
    tokenEmbedOut,
    posEmbedOut,
    patternEmbedOut,
    embedOut,
    layerCaches,
    lastHidden,
    logits,
  };

  return { logits, cache };
}

/**
 * Predict class probabilities with temperature scaling
 *
 * @param logits - Raw logits [1, numClasses]
 * @param temperature - Softmax temperature (default: 1.0)
 * @returns Probabilities [1, numClasses]
 */
export function predict(logits: Tensor, temperature = 1.0): Tensor {
  return logits.scale(1 / temperature).softmax();
}
