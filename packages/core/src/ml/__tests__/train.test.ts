import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { backward, zeroGradients } from "../backprop";
import { forward, initParams } from "../model";
import { Tensor } from "../tensor";
import { getLearningRate, trainCandleFormer } from "../train";
import type { CandleFormerConfig } from "../types";
import { DEFAULT_CONFIG } from "../types";

const SMALL_CONFIG: CandleFormerConfig = {
  ...DEFAULT_CONFIG,
  seqLen: 4,
  embedDim: 8,
  numHeads: 2,
  mlpDim: 16,
};

/**
 * Generate synthetic trending candles for testing
 */
function generateTrendCandles(n: number, seed = 42): NormalizedCandle[] {
  // Simple deterministic price generator
  let price = 100;
  const candles: NormalizedCandle[] = [];
  let state = seed;
  const nextRand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };

  for (let i = 0; i < n; i++) {
    const r = nextRand();
    // Alternate between bullish and bearish trends
    const trend = Math.sin(i / 10) > 0 ? 1 : -1;
    const change = trend * (r * 3 + 0.5);

    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + r * 2;
    const low = Math.min(open, close) - r * 2;

    candles.push({
      time: i * 86400000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.floor(r * 5000),
    });

    price = close;
  }

  return candles;
}

describe("backward (numerical gradient check)", () => {
  it("output weight gradients match numerical gradients", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const tokens = [0, 5, 10, 20];
    const target = 1;

    // Analytical gradient
    const { cache } = forward(params, tokens);
    const grads = backward(params, cache, target);

    // Check outW gradients numerically
    const eps = 1e-5;
    for (let i = 0; i < Math.min(3, params.outW.rows); i++) {
      for (let j = 0; j < params.outW.cols; j++) {
        const orig = params.outW.get(i, j);

        params.outW.set(i, j, orig + eps);
        const { logits: logitsPlus } = forward(params, tokens);
        const lossPlus = logitsPlus.crossEntropyLoss([target]);

        params.outW.set(i, j, orig - eps);
        const { logits: logitsMinus } = forward(params, tokens);
        const lossMinus = logitsMinus.crossEntropyLoss([target]);

        params.outW.set(i, j, orig);

        const numGrad = (lossPlus - lossMinus) / (2 * eps);
        const analGrad = grads.outW.get(i, j);

        // Allow relative tolerance for small gradients
        if (Math.abs(numGrad) > 1e-7) {
          expect(analGrad).toBeCloseTo(numGrad, 3);
        }
      }
    }
  });

  it("output bias gradients match numerical gradients", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const tokens = [0, 5, 10, 20];
    const target = 0;

    const { cache } = forward(params, tokens);
    const grads = backward(params, cache, target);

    const eps = 1e-5;
    for (let j = 0; j < params.outB.cols; j++) {
      const orig = params.outB.data[j];

      params.outB.data[j] = orig + eps;
      const lossPlus = forward(params, tokens).logits.crossEntropyLoss([target]);

      params.outB.data[j] = orig - eps;
      const lossMinus = forward(params, tokens).logits.crossEntropyLoss([target]);

      params.outB.data[j] = orig;

      const numGrad = (lossPlus - lossMinus) / (2 * eps);
      expect(grads.outB.data[j]).toBeCloseTo(numGrad, 3);
    }
  });

  it("MLP weight gradients match numerical gradients (spot check)", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const tokens = [1, 2, 3, 4];
    const target = 2;

    const { cache } = forward(params, tokens);
    const grads = backward(params, cache, target);

    const eps = 1e-5;
    // Spot check a few elements of mlpW2
    for (let check = 0; check < 5; check++) {
      const i = check % params.layers[0].mlpW2.rows;
      const j = check % params.layers[0].mlpW2.cols;
      const orig = params.layers[0].mlpW2.get(i, j);

      params.layers[0].mlpW2.set(i, j, orig + eps);
      const lossPlus = forward(params, tokens).logits.crossEntropyLoss([target]);

      params.layers[0].mlpW2.set(i, j, orig - eps);
      const lossMinus = forward(params, tokens).logits.crossEntropyLoss([target]);

      params.layers[0].mlpW2.set(i, j, orig);

      const numGrad = (lossPlus - lossMinus) / (2 * eps);
      if (Math.abs(numGrad) > 1e-7) {
        expect(grads.layers[0].mlpW2.get(i, j)).toBeCloseTo(numGrad, 2);
      }
    }
  });

  it("multi-layer gradients match numerical gradients", () => {
    const config = { ...SMALL_CONFIG, numLayers: 2 };
    const params = initParams(config, 42);
    const tokens = [0, 5, 10, 20];
    const target = 1;

    const { cache } = forward(params, tokens);
    const grads = backward(params, cache, target);

    const eps = 1e-5;
    // Check layer 0 wQ (deeper layer, gradient flows through layer 1)
    for (let check = 0; check < 3; check++) {
      const i = check % params.layers[0].wQ.rows;
      const j = check % params.layers[0].wQ.cols;
      const orig = params.layers[0].wQ.get(i, j);

      params.layers[0].wQ.set(i, j, orig + eps);
      const lossPlus = forward(params, tokens).logits.crossEntropyLoss([target]);

      params.layers[0].wQ.set(i, j, orig - eps);
      const lossMinus = forward(params, tokens).logits.crossEntropyLoss([target]);

      params.layers[0].wQ.set(i, j, orig);

      const numGrad = (lossPlus - lossMinus) / (2 * eps);
      if (Math.abs(numGrad) > 1e-7) {
        expect(grads.layers[0].wQ.get(i, j)).toBeCloseTo(numGrad, 2);
      }
    }
  });
});

describe("getLearningRate", () => {
  it("starts at baseLr/warmup for epoch 0", () => {
    const lr = getLearningRate(0, 100, 0.001, 10);
    expect(lr).toBeCloseTo(0.0001, 6);
  });

  it("reaches baseLr at end of warmup", () => {
    const lr = getLearningRate(9, 100, 0.001, 10);
    expect(lr).toBeCloseTo(0.001, 6);
  });

  it("decays to near 0 at final epoch", () => {
    const lr = getLearningRate(99, 100, 0.001, 10);
    expect(lr).toBeLessThan(0.0001);
  });

  it("returns baseLr with warmup=0", () => {
    const lr = getLearningRate(0, 100, 0.001, 0);
    expect(lr).toBeCloseTo(0.001, 6);
  });
});

describe("trainCandleFormer", () => {
  it("throws on insufficient data", () => {
    const candles = generateTrendCandles(5);
    expect(() => trainCandleFormer(candles, { seqLen: 16 })).toThrow(/Need at least/);
  });

  it("trains and returns weights and metrics", () => {
    const candles = generateTrendCandles(100);
    const result = trainCandleFormer(candles, {
      epochs: 5,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 16,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0,
      gradClipNorm: 0,
    });

    expect(result.weights).toBeDefined();
    expect(result.weights.config.seqLen).toBe(SMALL_CONFIG.seqLen);
    expect(result.weights.layers).toHaveLength(1);
    expect(result.trainLoss).toBeGreaterThan(0);
    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeLessThanOrEqual(1);
    expect(result.lossHistory).toHaveLength(5);
  });

  it("loss decreases over epochs on synthetic data", () => {
    const candles = generateTrendCandles(200);
    const losses: number[] = [];

    trainCandleFormer(candles, {
      epochs: 30,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 16,
      learningRate: 0.003,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0,
      gradClipNorm: 0,
      onEpoch: (_epoch, trainLoss) => {
        losses.push(trainLoss);
      },
    });

    // Compare average of first 5 vs last 5 epochs
    const firstAvg = losses.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const lastAvg = losses.slice(-5).reduce((a, b) => a + b, 0) / 5;
    expect(lastAvg).toBeLessThan(firstAvg);
  });

  it("is deterministic with same seed", () => {
    const candles = generateTrendCandles(60);
    const opts = {
      epochs: 3,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 8,
      seed: 123,
      labelSmoothing: 0,
      gradClipNorm: 0,
    };

    const r1 = trainCandleFormer(candles, opts);
    const r2 = trainCandleFormer(candles, opts);

    expect(r1.trainLoss).toBe(r2.trainLoss);
    expect(r1.weights.layers[0].wQ).toEqual(r2.weights.layers[0].wQ);
  });

  it("early stopping halts training before max epochs", () => {
    const candles = generateTrendCandles(200);
    const result = trainCandleFormer(candles, {
      epochs: 200,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 16,
      seed: 42,
      patience: 5,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0,
      gradClipNorm: 0,
    });

    // Should stop before 200 epochs
    expect(result.lossHistory.length).toBeLessThan(200);
    expect(result.lossHistory.length).toBeGreaterThan(5);
  });

  it("weight decay reduces weight magnitudes", () => {
    const candles = generateTrendCandles(100);
    const noDecay = trainCandleFormer(candles, {
      epochs: 10,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 16,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0,
      gradClipNorm: 0,
    });
    const withDecay = trainCandleFormer(candles, {
      epochs: 10,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 16,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0.1,
      labelSmoothing: 0,
      gradClipNorm: 0,
    });

    // Compute sum of squared weights for outW
    const sumSqNoDecay = noDecay.weights.outW.flat().reduce((s, v) => s + v * v, 0);
    const sumSqDecay = withDecay.weights.outW.flat().reduce((s, v) => s + v * v, 0);
    expect(sumSqDecay).toBeLessThan(sumSqNoDecay);
  });

  it("onEpoch callback receives correct epoch numbers", () => {
    const candles = generateTrendCandles(60);
    const epochs: number[] = [];

    trainCandleFormer(candles, {
      epochs: 3,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0,
      gradClipNorm: 0,
      onEpoch: (epoch) => epochs.push(epoch),
    });

    expect(epochs).toEqual([0, 1, 2]);
  });

  it("trains multi-layer model", () => {
    const candles = generateTrendCandles(100);
    const result = trainCandleFormer(candles, {
      epochs: 5,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      numLayers: 2,
      batchSize: 16,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0,
      gradClipNorm: 0,
    });

    expect(result.weights.layers).toHaveLength(2);
    expect(result.trainLoss).toBeGreaterThan(0);
  });

  it("label smoothing changes loss computation", () => {
    const candles = generateTrendCandles(100);
    const noSmooth = trainCandleFormer(candles, {
      epochs: 5,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 16,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0,
      gradClipNorm: 0,
    });
    const withSmooth = trainCandleFormer(candles, {
      epochs: 5,
      seqLen: SMALL_CONFIG.seqLen,
      embedDim: SMALL_CONFIG.embedDim,
      numHeads: SMALL_CONFIG.numHeads,
      mlpDim: SMALL_CONFIG.mlpDim,
      batchSize: 16,
      seed: 42,
      patience: 0,
      dropoutRate: 0,
      weightDecay: 0,
      labelSmoothing: 0.2,
      gradClipNorm: 0,
    });

    // Different label smoothing should produce different weights
    expect(noSmooth.weights.outW).not.toEqual(withSmooth.weights.outW);
  });
});
