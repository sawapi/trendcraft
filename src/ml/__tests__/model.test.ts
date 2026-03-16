import { describe, expect, it } from "vitest";
import { forward, initParams, paramsToWeights, predict, weightsToParams } from "../model";
import { mulberry32 } from "../tensor";
import type { CandleFormerConfig } from "../types";
import { DEFAULT_CONFIG, PAD_TOKEN } from "../types";

const SMALL_CONFIG: CandleFormerConfig = {
  ...DEFAULT_CONFIG,
  seqLen: 4,
  embedDim: 8,
  numHeads: 2,
  mlpDim: 16,
};

describe("initParams", () => {
  it("creates params with correct shapes", () => {
    const params = initParams(SMALL_CONFIG, 42);
    expect(params.tokenEmbed.rows).toBe(SMALL_CONFIG.vocabSize);
    expect(params.tokenEmbed.cols).toBe(SMALL_CONFIG.embedDim);
    expect(params.posEmbed.rows).toBe(SMALL_CONFIG.seqLen);
    expect(params.posEmbed.cols).toBe(SMALL_CONFIG.embedDim);
    expect(params.layers).toHaveLength(1);
    expect(params.layers[0].wQ.rows).toBe(SMALL_CONFIG.embedDim);
    expect(params.layers[0].wQ.cols).toBe(SMALL_CONFIG.embedDim);
    expect(params.layers[0].mlpW1.rows).toBe(SMALL_CONFIG.embedDim);
    expect(params.layers[0].mlpW1.cols).toBe(SMALL_CONFIG.mlpDim);
    expect(params.outW.rows).toBe(SMALL_CONFIG.embedDim);
    expect(params.outW.cols).toBe(SMALL_CONFIG.numClasses);
  });

  it("creates multi-layer params", () => {
    const config = { ...SMALL_CONFIG, numLayers: 3 };
    const params = initParams(config, 42);
    expect(params.layers).toHaveLength(3);
    // Each layer has independent weights
    expect(Array.from(params.layers[0].wQ.data)).not.toEqual(Array.from(params.layers[1].wQ.data));
  });

  it("is deterministic with same seed", () => {
    const p1 = initParams(SMALL_CONFIG, 42);
    const p2 = initParams(SMALL_CONFIG, 42);
    expect(Array.from(p1.tokenEmbed.data)).toEqual(Array.from(p2.tokenEmbed.data));
    expect(Array.from(p1.layers[0].wQ.data)).toEqual(Array.from(p2.layers[0].wQ.data));
  });
});

describe("forward", () => {
  it("produces logits with correct shape", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const tokens = [0, 1, 2, 3];
    const { logits } = forward(params, tokens);
    expect(logits.rows).toBe(1);
    expect(logits.cols).toBe(SMALL_CONFIG.numClasses);
  });

  it("produces finite logits", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const tokens = [5, 10, 15, 20];
    const { logits } = forward(params, tokens);
    for (let j = 0; j < logits.cols; j++) {
      expect(Number.isFinite(logits.get(0, j))).toBe(true);
    }
  });

  it("handles PAD tokens", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const tokens = [PAD_TOKEN, PAD_TOKEN, 5, 10];
    const { logits } = forward(params, tokens);
    expect(logits.rows).toBe(1);
    expect(logits.cols).toBe(3);
  });

  it("cache contains all intermediate tensors", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const tokens = [0, 1, 2, 3];
    const { cache } = forward(params, tokens);
    expect(cache.embedOut.rows).toBe(SMALL_CONFIG.seqLen);
    expect(cache.layerCaches).toHaveLength(1);
    expect(cache.layerCaches[0].Q.rows).toBe(SMALL_CONFIG.seqLen);
    expect(cache.layerCaches[0].attnWeights).toHaveLength(SMALL_CONFIG.numHeads);
    expect(cache.layerCaches[0].mlpHidden.cols).toBe(SMALL_CONFIG.mlpDim);
    expect(cache.logits.cols).toBe(SMALL_CONFIG.numClasses);
  });

  it("different inputs produce different outputs", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const { logits: l1 } = forward(params, [0, 1, 2, 3]);
    const { logits: l2 } = forward(params, [10, 20, 30, 40]);
    const same = l1.data[0] === l2.data[0] && l1.data[1] === l2.data[1];
    expect(same).toBe(false);
  });

  it("training mode with dropout produces different outputs across runs", () => {
    const config: CandleFormerConfig = { ...SMALL_CONFIG, dropoutRate: 0.5 };
    const params = initParams(config, 42);
    const tokens = [0, 1, 2, 3];
    const rng1 = mulberry32(100);
    const rng2 = mulberry32(200);
    const { logits: l1 } = forward(params, tokens, true, rng1);
    const { logits: l2 } = forward(params, tokens, true, rng2);
    // With different rng seeds, dropout masks differ → outputs differ
    const same =
      l1.data[0] === l2.data[0] && l1.data[1] === l2.data[1] && l1.data[2] === l2.data[2];
    expect(same).toBe(false);
  });

  it("inference mode (training=false) produces same output regardless of dropoutRate", () => {
    const config: CandleFormerConfig = { ...SMALL_CONFIG, dropoutRate: 0.5 };
    const params = initParams(config, 42);
    const tokens = [0, 1, 2, 3];
    const { logits: l1 } = forward(params, tokens, false);
    const { logits: l2 } = forward(params, tokens, false);
    expect(Array.from(l1.data)).toEqual(Array.from(l2.data));
  });

  it("dropout masks are stored in cache during training", () => {
    const config: CandleFormerConfig = { ...SMALL_CONFIG, dropoutRate: 0.3 };
    const params = initParams(config, 42);
    const rng = mulberry32(42);
    const { cache } = forward(params, [0, 1, 2, 3], true, rng);
    expect(cache.layerCaches[0].attnDropMask).not.toBeNull();
    expect(cache.layerCaches[0].mlpDropMask).not.toBeNull();
    expect(cache.layerCaches[0].attnDropMask!.rows).toBe(config.seqLen);
    expect(cache.layerCaches[0].attnDropMask!.cols).toBe(config.embedDim);
  });

  it("dropout masks are null during inference", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const { cache } = forward(params, [0, 1, 2, 3]);
    expect(cache.layerCaches[0].attnDropMask).toBeNull();
    expect(cache.layerCaches[0].mlpDropMask).toBeNull();
  });

  it("multi-layer forward produces finite logits", () => {
    const config = { ...SMALL_CONFIG, numLayers: 3 };
    const params = initParams(config, 42);
    const { logits, cache } = forward(params, [0, 1, 2, 3]);
    expect(logits.rows).toBe(1);
    expect(logits.cols).toBe(3);
    for (let j = 0; j < logits.cols; j++) {
      expect(Number.isFinite(logits.get(0, j))).toBe(true);
    }
    expect(cache.layerCaches).toHaveLength(3);
  });
});

describe("predict", () => {
  it("returns valid probabilities summing to 1", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const { logits } = forward(params, [0, 1, 2, 3]);
    const probs = predict(logits);
    let sum = 0;
    for (let j = 0; j < probs.cols; j++) {
      expect(probs.get(0, j)).toBeGreaterThanOrEqual(0);
      expect(probs.get(0, j)).toBeLessThanOrEqual(1);
      sum += probs.get(0, j);
    }
    expect(sum).toBeCloseTo(1, 10);
  });

  it("lower temperature increases confidence", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const { logits } = forward(params, [0, 1, 2, 3]);
    const probsWarm = predict(logits, 2.0);
    const probsCold = predict(logits, 0.1);

    // Find max probability
    let maxWarm = 0;
    let maxCold = 0;
    for (let j = 0; j < probsWarm.cols; j++) {
      maxWarm = Math.max(maxWarm, probsWarm.get(0, j));
      maxCold = Math.max(maxCold, probsCold.get(0, j));
    }
    expect(maxCold).toBeGreaterThan(maxWarm);
  });
});

describe("weights serialization", () => {
  it("round-trips through paramsToWeights → weightsToParams", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const weights = paramsToWeights(params);
    const restored = weightsToParams(weights);

    // Check a few tensors match
    expect(Array.from(restored.tokenEmbed.data)).toEqual(Array.from(params.tokenEmbed.data));
    expect(Array.from(restored.layers[0].wQ.data)).toEqual(Array.from(params.layers[0].wQ.data));
    expect(Array.from(restored.outW.data)).toEqual(Array.from(params.outW.data));
    expect(restored.config).toEqual(params.config);
  });

  it("weights are JSON serializable", () => {
    const params = initParams(SMALL_CONFIG, 42);
    const weights = paramsToWeights(params);
    const json = JSON.stringify(weights);
    const parsed = JSON.parse(json);

    // Verify structure
    expect(parsed.config).toEqual(SMALL_CONFIG);
    expect(parsed.tokenEmbed).toHaveLength(SMALL_CONFIG.vocabSize);
    expect(parsed.tokenEmbed[0]).toHaveLength(SMALL_CONFIG.embedDim);
    expect(parsed.layers).toHaveLength(1);
    expect(parsed.layers[0].wQ).toHaveLength(SMALL_CONFIG.embedDim);
  });

  it("multi-layer round-trips correctly", () => {
    const config = { ...SMALL_CONFIG, numLayers: 2 };
    const params = initParams(config, 42);
    const weights = paramsToWeights(params);
    const restored = weightsToParams(weights);

    expect(restored.layers).toHaveLength(2);
    expect(Array.from(restored.layers[0].wQ.data)).toEqual(Array.from(params.layers[0].wQ.data));
    expect(Array.from(restored.layers[1].wQ.data)).toEqual(Array.from(params.layers[1].wQ.data));
  });

  it("migrates v1 flat format to v2 layers format", () => {
    // Simulate v1 weights (flat layer fields)
    const params = initParams(SMALL_CONFIG, 42);
    const layer = params.layers[0];
    const v1Weights = {
      config: { ...SMALL_CONFIG, numLayers: undefined as unknown as number },
      tokenEmbed: params.tokenEmbed.toArray(),
      posEmbed: params.posEmbed.toArray(),
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
      outW: params.outW.toArray(),
      outB: params.outB.toVec(),
    };

    const restored = weightsToParams(v1Weights as any);
    expect(restored.layers).toHaveLength(1);
    expect(restored.config.numLayers).toBe(1);
    expect(Array.from(restored.layers[0].wQ.data)).toEqual(Array.from(params.layers[0].wQ.data));
  });
});
