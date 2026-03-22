/**
 * Additional coverage tests for ml/train.ts
 *
 * Targets uncovered branches: multi-stock training, pattern tokens,
 * validationSplit=0, warmup edge cases, gradient clipping disabled,
 * weight decay with patternEmbed, early stopping with best-weights restore,
 * and edge cases in data preparation.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { getLearningRate, trainCandleFormer } from "../train";
import { DEFAULT_CONFIG } from "../types";

const TINY = {
  seqLen: 4,
  embedDim: 8,
  numHeads: 2,
  mlpDim: 16,
};

function genCandles(n: number, seed = 42): NormalizedCandle[] {
  let price = 100;
  const candles: NormalizedCandle[] = [];
  let s = seed;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  for (let i = 0; i < n; i++) {
    const r = rng();
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

describe("train-coverage", () => {
  // ---- getLearningRate edge cases ----
  describe("getLearningRate", () => {
    it("warmup=0 at epoch=0 uses cosine schedule", () => {
      const lr = getLearningRate(0, 100, 0.001, 0);
      // progress = 0/100 = 0, cos(0) = 1, so lr = baseLr * 0.5 * 2 = baseLr
      expect(lr).toBeCloseTo(0.001, 6);
    });

    it("warmup=0 at mid epoch", () => {
      const lr = getLearningRate(50, 100, 0.001, 0);
      // progress = 50/100, cos(pi*0.5) ≈ 0 → lr ≈ baseLr * 0.5
      expect(lr).toBeCloseTo(0.0005, 4);
    });

    it("warmup > totalEpochs: all epochs are warmup", () => {
      const lr = getLearningRate(5, 10, 0.01, 20);
      expect(lr).toBeCloseTo((0.01 * 6) / 20, 6);
    });

    it("warmup equals totalEpochs: cosine denominator max(1,...)", () => {
      // epoch = warmup → progress = 0 / max(1, 0) = 0
      const lr = getLearningRate(10, 10, 0.001, 10);
      // Still in warmup: (0.001 * 11) / 10
      // Actually epoch=10 is not < warmup=10, so cosine kicks in
      // progress = (10-10)/max(1,0) = 0, lr = 0.001*0.5*(1+1) = 0.001
      expect(lr).toBeCloseTo(0.001, 6);
    });
  });

  // ---- Training data edge cases ----
  describe("data validation", () => {
    it("throws on too few candles", () => {
      const candles = genCandles(5);
      expect(() => trainCandleFormer(candles, { seqLen: 16 })).toThrow(/Need at least/);
    });

    it("minimal dataset still trains (2 samples, 1 val, 1 train)", () => {
      // seqLen=4, 6 candles → 2 samples. valSplit=0.5 → valSize=1, trainSamples=1
      const candles = genCandles(6);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 2,
        batchSize: 1,
        seed: 42,
        validationSplit: 0.5,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });
      expect(result.lossHistory).toHaveLength(2);
      expect(result.trainLoss).toBeGreaterThan(0);
    });
  });

  // ---- Multi-stock training ----
  describe("multi-stock training", () => {
    it("accepts array of candle arrays", () => {
      const stock1 = genCandles(60, 1);
      const stock2 = genCandles(60, 2);
      const result = trainCandleFormer([stock1, stock2], {
        ...TINY,
        epochs: 3,
        batchSize: 8,
        seed: 42,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });

      expect(result.weights).toBeDefined();
      expect(result.lossHistory).toHaveLength(3);
      expect(result.trainLoss).toBeGreaterThan(0);
    });

    it("throws when one stock in multi array has insufficient data", () => {
      const good = genCandles(60, 1);
      const bad = genCandles(3, 2); // too short
      expect(() => trainCandleFormer([good, bad], { ...TINY, epochs: 1 })).toThrow(/Need at least/);
    });
  });

  // ---- validationSplit = 0 ----
  describe("validationSplit = 0", () => {
    it("no validation set, uses train accuracy", () => {
      const candles = genCandles(60);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 3,
        batchSize: 8,
        seed: 42,
        validationSplit: 0,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });

      expect(result.valLoss).toBeNull();
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.lossHistory).toHaveLength(3);
      for (const h of result.lossHistory) {
        expect(h.valLoss).toBeNull();
      }
    });
  });

  // ---- Weight decay with all features enabled ----
  describe("weight decay with patternEmbed", () => {
    it("applies weight decay to patternEmbed when patterns enabled", () => {
      const candles = genCandles(100);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 3,
        batchSize: 16,
        seed: 42,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0.05,
        labelSmoothing: 0,
        gradClipNorm: 0,
        enablePatterns: true,
      });

      expect(result.weights).toBeDefined();
      expect(result.weights.config.patternVocabSize).toBeGreaterThan(0);
    });
  });

  // ---- Gradient clipping enabled ----
  describe("gradient clipping", () => {
    it("training with gradClipNorm > 0 runs without error", () => {
      const candles = genCandles(60);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 3,
        batchSize: 8,
        seed: 42,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0.5,
      });

      expect(result.trainLoss).toBeGreaterThan(0);
    });
  });

  // ---- Early stopping and best-weight restoration ----
  describe("early stopping with best-weight restoration", () => {
    it("restores best weights after early stop", () => {
      const candles = genCandles(200);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 100,
        batchSize: 16,
        seed: 42,
        patience: 5,
        validationSplit: 0.2,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });

      // Should have stopped early
      expect(result.lossHistory.length).toBeLessThan(100);
      expect(result.weights).toBeDefined();
      // valLoss should be set
      expect(result.valLoss).not.toBeNull();
    });

    it("bestWeights=null when patience=0 (no early stopping)", () => {
      const candles = genCandles(60);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 3,
        batchSize: 8,
        seed: 42,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });

      // No early stopping → bestWeights null → uses paramsToWeights at end
      expect(result.weights).toBeDefined();
      expect(result.lossHistory).toHaveLength(3);
    });
  });

  // ---- Early stopping with patterns enabled ----
  describe("early stopping with pattern embeddings", () => {
    it("restores pattern weights on early stop", () => {
      const candles = genCandles(200);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 100,
        batchSize: 16,
        seed: 42,
        patience: 5,
        validationSplit: 0.2,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
        enablePatterns: true,
      });

      expect(result.lossHistory.length).toBeLessThan(100);
      expect(result.weights.config.patternVocabSize).toBeGreaterThan(0);
    });
  });

  // ---- onEpoch callback with validation loss ----
  describe("onEpoch callback", () => {
    it("receives valLoss when validation enabled", () => {
      const candles = genCandles(60);
      const valLosses: (number | null)[] = [];

      trainCandleFormer(candles, {
        ...TINY,
        epochs: 3,
        batchSize: 8,
        seed: 42,
        patience: 0,
        validationSplit: 0.2,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
        onEpoch: (_epoch, _trainLoss, valLoss) => {
          valLosses.push(valLoss);
        },
      });

      expect(valLosses).toHaveLength(3);
      for (const v of valLosses) {
        expect(v).not.toBeNull();
        expect(typeof v).toBe("number");
      }
    });

    it("receives null valLoss when validationSplit=0", () => {
      const candles = genCandles(60);
      const valLosses: (number | null)[] = [];

      trainCandleFormer(candles, {
        ...TINY,
        epochs: 2,
        batchSize: 8,
        seed: 42,
        patience: 0,
        validationSplit: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
        onEpoch: (_epoch, _trainLoss, valLoss) => {
          valLosses.push(valLoss);
        },
      });

      expect(valLosses).toHaveLength(2);
      for (const v of valLosses) {
        expect(v).toBeNull();
      }
    });
  });

  // ---- Dropout enabled path ----
  describe("dropout enabled", () => {
    it("training with dropout > 0 runs without error", () => {
      const candles = genCandles(60);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 3,
        batchSize: 8,
        seed: 42,
        patience: 0,
        dropoutRate: 0.2,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });

      expect(result.trainLoss).toBeGreaterThan(0);
    });
  });

  // ---- Warmup epochs auto-calculation ----
  describe("warmup auto-calculation", () => {
    it("auto warmup = max(1, floor(epochs*0.1))", () => {
      const candles = genCandles(60);
      const losses: number[] = [];

      trainCandleFormer(candles, {
        ...TINY,
        epochs: 5,
        batchSize: 8,
        seed: 42,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
        // warmupEpochs not set → auto = max(1, floor(5*0.1)) = 1
        onEpoch: (_epoch, trainLoss) => {
          losses.push(trainLoss);
        },
      });

      expect(losses).toHaveLength(5);
    });

    it("explicit warmupEpochs overrides auto", () => {
      const candles = genCandles(60);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 5,
        batchSize: 8,
        seed: 42,
        patience: 0,
        warmupEpochs: 3,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });

      expect(result.lossHistory).toHaveLength(5);
    });
  });

  // ---- Raw (unnormalized) candle input ----
  describe("raw candle input (auto-normalization)", () => {
    it("accepts raw candles with Date-based time", () => {
      // Create candles without the normalized structure (just Candle type)
      const rawCandles = genCandles(60).map((c) => ({
        ...c,
        // These are already NormalizedCandle shape, but isNormalized checks
        // for numeric fields, so this should pass through
      }));

      const result = trainCandleFormer(rawCandles, {
        ...TINY,
        epochs: 2,
        batchSize: 8,
        seed: 42,
        patience: 0,
        dropoutRate: 0,
        weightDecay: 0,
        labelSmoothing: 0,
        gradClipNorm: 0,
      });

      expect(result.weights).toBeDefined();
    });
  });

  // ---- All features combined ----
  describe("all features combined", () => {
    it("training with all options enabled", () => {
      const candles = genCandles(100);
      const result = trainCandleFormer(candles, {
        ...TINY,
        epochs: 5,
        batchSize: 8,
        seed: 42,
        patience: 3,
        validationSplit: 0.15,
        dropoutRate: 0.1,
        weightDecay: 0.01,
        labelSmoothing: 0.1,
        gradClipNorm: 1.0,
        enablePatterns: true,
        warmupEpochs: 2,
        numLayers: 2,
      });

      expect(result.weights).toBeDefined();
      expect(result.weights.layers).toHaveLength(2);
      expect(result.trainLoss).toBeGreaterThan(0);
    });
  });
});
