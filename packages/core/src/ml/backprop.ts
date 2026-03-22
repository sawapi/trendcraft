/**
 * Backpropagation for CandleFormer
 *
 * Computes gradients for all model parameters using cached forward-pass intermediates.
 * Each function returns gradients in the same shape as the corresponding parameter.
 */

import type { ForwardCache, LayerForwardCache, ModelParams, TransformerLayerParams } from "./model";
import { Tensor } from "./tensor";

/**
 * Per-layer gradients
 */
export type LayerGradients = {
  ln1Gamma: Tensor;
  ln1Beta: Tensor;
  wQ: Tensor;
  bQ: Tensor;
  wK: Tensor;
  bK: Tensor;
  wV: Tensor;
  bV: Tensor;
  wO: Tensor;
  bO: Tensor;
  ln2Gamma: Tensor;
  ln2Beta: Tensor;
  mlpW1: Tensor;
  mlpB1: Tensor;
  mlpW2: Tensor;
  mlpB2: Tensor;
};

/**
 * Gradients for all model parameters
 */
export type Gradients = {
  tokenEmbed: Tensor;
  posEmbed: Tensor;
  patternEmbed: Tensor | null;
  layers: LayerGradients[];
  outW: Tensor;
  outB: Tensor;
};

// ============================================
// Backward pass helpers
// ============================================

/**
 * Backward through GELU activation
 * d_gelu/dx = 0.5 * (1 + tanh(k)) + 0.5 * x * (1 - tanh(k)^2) * k'
 * where k = sqrt(2/pi) * (x + 0.044715 * x^3)
 */
function geluBackward(grad: Tensor, input: Tensor): Tensor {
  const out = new Tensor(input.rows, input.cols);
  const sqrtTwoPi = Math.sqrt(2 / Math.PI);
  for (let i = 0; i < input.data.length; i++) {
    const x = input.data[i];
    const k = sqrtTwoPi * (x + 0.044715 * x * x * x);
    const tanhK = Math.tanh(k);
    const dK = sqrtTwoPi * (1 + 3 * 0.044715 * x * x);
    const dGelu = 0.5 * (1 + tanhK) + 0.5 * x * (1 - tanhK * tanhK) * dK;
    out.data[i] = grad.data[i] * dGelu;
  }
  return out;
}

/**
 * Backward through layer normalization
 * Returns: [dInput, dGamma, dBeta]
 */
function layerNormBackward(
  grad: Tensor,
  input: Tensor,
  gamma: Tensor,
  eps = 1e-5,
): [Tensor, Tensor, Tensor] {
  const { rows, cols } = input;
  const dInput = new Tensor(rows, cols);
  const dGamma = Tensor.zeros(1, cols);
  const dBeta = Tensor.zeros(1, cols);

  for (let i = 0; i < rows; i++) {
    const offset = i * cols;

    // Recompute mean and variance for this row
    let mean = 0;
    for (let j = 0; j < cols; j++) mean += input.data[offset + j];
    mean /= cols;

    let variance = 0;
    for (let j = 0; j < cols; j++) {
      const diff = input.data[offset + j] - mean;
      variance += diff * diff;
    }
    variance /= cols;
    const std = Math.sqrt(variance + eps);

    // Normalized values
    const xHat = new Float64Array(cols);
    for (let j = 0; j < cols; j++) {
      xHat[j] = (input.data[offset + j] - mean) / std;
    }

    // dBeta += grad, dGamma += grad * xHat
    for (let j = 0; j < cols; j++) {
      dBeta.data[j] += grad.data[offset + j];
      dGamma.data[j] += grad.data[offset + j] * xHat[j];
    }

    // dInput: standard LN backward
    // dxHat = grad * gamma
    const dxHat = new Float64Array(cols);
    for (let j = 0; j < cols; j++) {
      dxHat[j] = grad.data[offset + j] * gamma.data[j];
    }

    // Sum terms
    let sumDxHat = 0;
    let sumDxHatXhat = 0;
    for (let j = 0; j < cols; j++) {
      sumDxHat += dxHat[j];
      sumDxHatXhat += dxHat[j] * xHat[j];
    }

    for (let j = 0; j < cols; j++) {
      dInput.data[offset + j] =
        (1 / std) * (dxHat[j] - sumDxHat / cols - (xHat[j] * sumDxHatXhat) / cols);
    }
  }

  return [dInput, dGamma, dBeta];
}

/**
 * Backward through softmax (row-wise)
 * For each row: dInput = softmaxOut * (grad - sum(grad * softmaxOut))
 */
function softmaxBackward(grad: Tensor, softmaxOut: Tensor): Tensor {
  const out = new Tensor(grad.rows, grad.cols);
  for (let i = 0; i < grad.rows; i++) {
    const offset = i * grad.cols;
    let dot = 0;
    for (let j = 0; j < grad.cols; j++) {
      dot += grad.data[offset + j] * softmaxOut.data[offset + j];
    }
    for (let j = 0; j < grad.cols; j++) {
      out.data[offset + j] = softmaxOut.data[offset + j] * (grad.data[offset + j] - dot);
    }
  }
  return out;
}

/**
 * Sum rows to produce a bias gradient [1, cols]
 */
function sumRows(grad: Tensor): Tensor {
  const out = Tensor.zeros(1, grad.cols);
  for (let i = 0; i < grad.rows; i++) {
    for (let j = 0; j < grad.cols; j++) {
      out.data[j] += grad.data[i * grad.cols + j];
    }
  }
  return out;
}

/**
 * Backward through a single transformer layer
 * Returns: [layerGradients, dInput (gradient w.r.t. layer input)]
 */
function backwardLayer(
  layer: TransformerLayerParams,
  layerCache: LayerForwardCache,
  dResidual2: Tensor,
  config: CandleFormerConfig,
): [LayerGradients, Tensor] {
  const { seqLen, embedDim, numHeads } = config;
  const headDim = embedDim / numHeads;

  // MLP backward (residual2 = residual1 + mlpOutFinal)
  let dMlpOut = dResidual2.clone();
  const dResidual1Pre = dResidual2.clone();

  // MLP dropout backward
  if (layerCache.mlpDropMask) {
    const dropoutRate = config.dropoutRate;
    dMlpOut = dMlpOut.mul(layerCache.mlpDropMask).scale(1 / (1 - dropoutRate));
  }

  // mlpOut = mlpAct × mlpW2 + mlpB2
  const dMlpW2 = layerCache.mlpAct.transpose().matmul(dMlpOut);
  const dMlpB2 = sumRows(dMlpOut);
  const dMlpAct = dMlpOut.matmul(layer.mlpW2.transpose());

  // GELU backward
  const dMlpHidden = geluBackward(dMlpAct, layerCache.mlpHidden);

  // mlpHidden = ln2Out × mlpW1 + mlpB1
  const dMlpW1 = layerCache.ln2Out.transpose().matmul(dMlpHidden);
  const dMlpB1 = sumRows(dMlpHidden);
  const dLn2Out = dMlpHidden.matmul(layer.mlpW1.transpose());

  // Layer Norm 2 backward
  const [dResidual1Ln2, dLn2Gamma, dLn2Beta] = layerNormBackward(
    dLn2Out,
    layerCache.residual1,
    layer.ln2Gamma,
  );

  const dResidual1 = dResidual1Pre.add(dResidual1Ln2);

  // Attention backward (residual1 = input + attnOutFinal)
  let dAttnOut = dResidual1.clone();
  const dInputPre = dResidual1.clone();

  // Attention dropout backward
  if (layerCache.attnDropMask) {
    const dropoutRate = config.dropoutRate;
    dAttnOut = dAttnOut.mul(layerCache.attnDropMask).scale(1 / (1 - dropoutRate));
  }

  // attnOut = attnConcat × wO + bO
  const dWO = layerCache.attnConcat.transpose().matmul(dAttnOut);
  const dBO = sumRows(dAttnOut);
  const dAttnConcat = dAttnOut.matmul(layer.wO.transpose());

  // Split gradient back to heads
  const dQ = Tensor.zeros(seqLen, embedDim);
  const dK = Tensor.zeros(seqLen, embedDim);
  const dV = Tensor.zeros(seqLen, embedDim);

  for (let h = 0; h < numHeads; h++) {
    const colStart = h * headDim;

    const dHeadOut = dAttnConcat.sliceCols(colStart, colStart + headDim);
    const Vh = layerCache.V.sliceCols(colStart, colStart + headDim);
    const dWeights = dHeadOut.matmul(Vh.transpose());
    const dVh = layerCache.attnWeights[h].transpose().matmul(dHeadOut);

    const dScoresMasked = softmaxBackward(dWeights, layerCache.attnWeights[h]);

    // Apply causal mask backward
    for (let i = 0; i < seqLen; i++) {
      for (let j = i + 1; j < seqLen; j++) {
        dScoresMasked.set(i, j, 0);
      }
    }

    const scale = 1 / Math.sqrt(headDim);
    const dScores = dScoresMasked.scale(scale);
    const Qh = layerCache.Q.sliceCols(colStart, colStart + headDim);
    const Kh = layerCache.K.sliceCols(colStart, colStart + headDim);

    const dQh = dScores.matmul(Kh);
    const dKh = dScores.transpose().matmul(Qh);

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < headDim; j++) {
        dQ.set(i, colStart + j, dQ.get(i, colStart + j) + dQh.get(i, j));
        dK.set(i, colStart + j, dK.get(i, colStart + j) + dKh.get(i, j));
        dV.set(i, colStart + j, dV.get(i, colStart + j) + dVh.get(i, j));
      }
    }
  }

  // Q = ln1Out × wQ + bQ
  const dWQ = layerCache.ln1Out.transpose().matmul(dQ);
  const dBQ = sumRows(dQ);
  const dLn1FromQ = dQ.matmul(layer.wQ.transpose());

  const dWK = layerCache.ln1Out.transpose().matmul(dK);
  const dBK = sumRows(dK);
  const dLn1FromK = dK.matmul(layer.wK.transpose());

  const dWV = layerCache.ln1Out.transpose().matmul(dV);
  const dBV = sumRows(dV);
  const dLn1FromV = dV.matmul(layer.wV.transpose());

  const dLn1Out = dLn1FromQ.add(dLn1FromK).add(dLn1FromV);

  // Layer Norm 1 backward
  const [dInputLn1, dLn1Gamma, dLn1Beta] = layerNormBackward(
    dLn1Out,
    layerCache.input,
    layer.ln1Gamma,
  );

  const dInput = dInputPre.add(dInputLn1);

  const layerGrads: LayerGradients = {
    ln1Gamma: dLn1Gamma,
    ln1Beta: dLn1Beta,
    wQ: dWQ,
    bQ: dBQ,
    wK: dWK,
    bK: dBK,
    wV: dWV,
    bV: dBV,
    wO: dWO,
    bO: dBO,
    ln2Gamma: dLn2Gamma,
    ln2Beta: dLn2Beta,
    mlpW1: dMlpW1,
    mlpB1: dMlpB1,
    mlpW2: dMlpW2,
    mlpB2: dMlpB2,
  };

  return [layerGrads, dInput];
}

import type { CandleFormerConfig } from "./types";

// ============================================
// Full backward pass
// ============================================

/**
 * Compute gradients for all parameters given a target class
 *
 * @param params - Model parameters
 * @param cache - Forward pass cache
 * @param target - Target class index (0=bullish, 1=bearish, 2=neutral)
 * @param labelSmoothing - Label smoothing factor (0 = disabled)
 * @returns Gradients for all parameters
 */
export function backward(
  params: ModelParams,
  cache: ForwardCache,
  target: number,
  labelSmoothing = 0,
): Gradients {
  const { config } = params;
  const { seqLen, embedDim } = config;
  const numClasses = config.numClasses;

  // ============================================
  // Output head backward
  // ============================================

  // d(cross-entropy)/d(logits) = softmax(logits) - target
  const probs = cache.logits.softmax(); // [1, numClasses]
  const dLogits = probs.clone();

  if (labelSmoothing > 0) {
    // Smoothed target: (1 - smooth) * one_hot + smooth / numClasses
    // dLogits = probs - smoothedTarget
    for (let j = 0; j < numClasses; j++) {
      const smoothedTarget = (j === target ? 1 - labelSmoothing : 0) + labelSmoothing / numClasses;
      dLogits.data[j] -= smoothedTarget;
    }
  } else {
    dLogits.data[target] -= 1;
  }

  // dOutW = lastHidden^T × dLogits
  const dOutW = cache.lastHidden.transpose().matmul(dLogits);
  const dOutB = dLogits.clone();

  // dLastHidden = dLogits × outW^T  →  [1, embedDim]
  const dLastHidden = dLogits.matmul(params.outW.transpose());

  // Expand dLastHidden back to full sequence gradient
  const dHidden = Tensor.zeros(seqLen, embedDim);
  for (let j = 0; j < embedDim; j++) {
    dHidden.set(seqLen - 1, j, dLastHidden.data[j]);
  }

  // ============================================
  // Backward through layers in reverse order
  // ============================================
  const layerGrads: LayerGradients[] = new Array(params.layers.length);
  let dInput = dHidden;

  for (let L = params.layers.length - 1; L >= 0; L--) {
    const [lg, di] = backwardLayer(params.layers[L], cache.layerCaches[L], dInput, config);
    layerGrads[L] = lg;
    dInput = di;
  }

  // ============================================
  // Embedding backward
  // ============================================
  const dEmbed = dInput;
  const dTokenEmbed = Tensor.zeros(params.tokenEmbed.rows, embedDim);
  const dPosEmbed = Tensor.zeros(params.posEmbed.rows, embedDim);
  const dPatternEmbed = params.patternEmbed
    ? Tensor.zeros(params.patternEmbed.rows, embedDim)
    : null;

  for (let i = 0; i < seqLen; i++) {
    const tokenIdx = cache.tokens[i];
    for (let j = 0; j < embedDim; j++) {
      const grad = dEmbed.get(i, j);
      dTokenEmbed.set(tokenIdx, j, dTokenEmbed.get(tokenIdx, j) + grad);
      dPosEmbed.set(i, j, dPosEmbed.get(i, j) + grad);
    }

    // Pattern embedding gradient (same gradient flows to all additive embeddings)
    if (dPatternEmbed && cache.patternTokens) {
      const patternIdx = cache.patternTokens[i];
      for (let j = 0; j < embedDim; j++) {
        dPatternEmbed.set(patternIdx, j, dPatternEmbed.get(patternIdx, j) + dEmbed.get(i, j));
      }
    }
  }

  return {
    tokenEmbed: dTokenEmbed,
    posEmbed: dPosEmbed,
    patternEmbed: dPatternEmbed,
    layers: layerGrads,
    outW: dOutW,
    outB: dOutB,
  };
}

/**
 * Accumulate gradients from multiple samples (for mini-batch)
 */
export function accumulateGradients(accumulated: Gradients, newGrad: Gradients): void {
  accumulateTensor(accumulated.tokenEmbed, newGrad.tokenEmbed);
  accumulateTensor(accumulated.posEmbed, newGrad.posEmbed);
  if (accumulated.patternEmbed && newGrad.patternEmbed) {
    accumulateTensor(accumulated.patternEmbed, newGrad.patternEmbed);
  }
  accumulateTensor(accumulated.outW, newGrad.outW);
  accumulateTensor(accumulated.outB, newGrad.outB);
  for (let L = 0; L < accumulated.layers.length; L++) {
    const accLayer = accumulated.layers[L];
    const newLayer = newGrad.layers[L];
    const keys = Object.keys(accLayer) as (keyof LayerGradients)[];
    for (const key of keys) {
      accumulateTensor(accLayer[key], newLayer[key]);
    }
  }
}

function accumulateTensor(acc: Tensor, grad: Tensor): void {
  for (let i = 0; i < acc.data.length; i++) {
    acc.data[i] += grad.data[i];
  }
}

/**
 * Scale all gradients by a factor (e.g., 1/batchSize for averaging)
 */
export function scaleGradients(grads: Gradients, factor: number): void {
  scaleTensor(grads.tokenEmbed, factor);
  scaleTensor(grads.posEmbed, factor);
  if (grads.patternEmbed) scaleTensor(grads.patternEmbed, factor);
  scaleTensor(grads.outW, factor);
  scaleTensor(grads.outB, factor);
  for (const layer of grads.layers) {
    const keys = Object.keys(layer) as (keyof LayerGradients)[];
    for (const key of keys) {
      scaleTensor(layer[key], factor);
    }
  }
}

function scaleTensor(t: Tensor, factor: number): void {
  for (let i = 0; i < t.data.length; i++) {
    t.data[i] *= factor;
  }
}

/**
 * Create a zero-initialized gradients object matching param shapes
 */
export function zeroGradients(params: ModelParams): Gradients {
  const { embedDim, mlpDim, numClasses } = params.config;
  const layers: LayerGradients[] = params.layers.map(() => ({
    ln1Gamma: Tensor.zeros(1, embedDim),
    ln1Beta: Tensor.zeros(1, embedDim),
    wQ: Tensor.zeros(embedDim, embedDim),
    bQ: Tensor.zeros(1, embedDim),
    wK: Tensor.zeros(embedDim, embedDim),
    bK: Tensor.zeros(1, embedDim),
    wV: Tensor.zeros(embedDim, embedDim),
    bV: Tensor.zeros(1, embedDim),
    wO: Tensor.zeros(embedDim, embedDim),
    bO: Tensor.zeros(1, embedDim),
    ln2Gamma: Tensor.zeros(1, embedDim),
    ln2Beta: Tensor.zeros(1, embedDim),
    mlpW1: Tensor.zeros(embedDim, mlpDim),
    mlpB1: Tensor.zeros(1, mlpDim),
    mlpW2: Tensor.zeros(mlpDim, embedDim),
    mlpB2: Tensor.zeros(1, embedDim),
  }));

  return {
    tokenEmbed: Tensor.zeros(params.tokenEmbed.rows, params.tokenEmbed.cols),
    posEmbed: Tensor.zeros(params.posEmbed.rows, params.posEmbed.cols),
    patternEmbed: params.patternEmbed
      ? Tensor.zeros(params.patternEmbed.rows, params.patternEmbed.cols)
      : null,
    layers,
    outW: Tensor.zeros(embedDim, numClasses),
    outB: Tensor.zeros(1, numClasses),
  };
}

/**
 * Clip gradients by global norm to prevent gradient explosion
 *
 * @param grads - Gradients to clip (modified in-place)
 * @param maxNorm - Maximum allowed global norm
 * @returns Actual global norm before clipping
 */
export function clipGradients(grads: Gradients, maxNorm: number): number {
  // Compute global norm
  let totalSq = 0;
  totalSq += sumOfSquares(grads.tokenEmbed);
  totalSq += sumOfSquares(grads.posEmbed);
  if (grads.patternEmbed) totalSq += sumOfSquares(grads.patternEmbed);
  totalSq += sumOfSquares(grads.outW);
  totalSq += sumOfSquares(grads.outB);
  for (const layer of grads.layers) {
    const keys = Object.keys(layer) as (keyof LayerGradients)[];
    for (const key of keys) {
      totalSq += sumOfSquares(layer[key]);
    }
  }

  const globalNorm = Math.sqrt(totalSq);

  if (globalNorm > maxNorm) {
    const scale = maxNorm / globalNorm;
    scaleGradients(grads, scale);
  }

  return globalNorm;
}

function sumOfSquares(t: Tensor): number {
  let sum = 0;
  for (let i = 0; i < t.data.length; i++) {
    sum += t.data[i] * t.data[i];
  }
  return sum;
}
