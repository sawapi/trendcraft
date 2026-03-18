import { describe, expect, it } from "vitest";
import { mulberry32, randNormal } from "../../../ml/tensor";
import type { NormalizedCandle } from "../../../types";
import { backward, baumWelch, forward, gaussianLogPdf, viterbi } from "../hmm-core";
import type { HmmModel } from "../hmm-core";
import { fitHmm, hmmRegimes, regimeTransitionMatrix } from "../hmm-regimes";

// ============================================
// Helpers
// ============================================

/** Box-Muller normal RNG using a seeded PRNG */
function normalRandom(rng: () => number): number {
  return randNormal(rng);
}

/** Generate synthetic data from a known 2-state HMM */
function generateSyntheticHmmData(
  rng: () => number,
  numObs: number,
): { observations: number[][]; trueStates: number[] } {
  const means = [
    [0.02, 0.1],
    [-0.02, 0.3],
  ];
  const variances = [
    [0.0001, 0.01],
    [0.0001, 0.01],
  ];
  const transition = [
    [0.95, 0.05],
    [0.05, 0.95],
  ];

  const states: number[] = [0];
  const obs: number[][] = [];

  // Generate initial observation
  obs.push([
    means[0][0] + normalRandom(rng) * Math.sqrt(variances[0][0]),
    means[0][1] + normalRandom(rng) * Math.sqrt(variances[0][1]),
  ]);

  for (let t = 1; t < numObs; t++) {
    const prevState = states[t - 1];
    const r = rng();
    const newState = r < transition[prevState][0] ? 0 : 1;
    states.push(newState);

    obs.push([
      means[newState][0] + normalRandom(rng) * Math.sqrt(variances[newState][0]),
      means[newState][1] + normalRandom(rng) * Math.sqrt(variances[newState][1]),
    ]);
  }

  return { observations: obs, trueStates: states };
}

/** Create simple normalized candles for testing */
function makeCandles(n: number, seed = 42): NormalizedCandle[] {
  const rng = mulberry32(seed);
  const candles: NormalizedCandle[] = [];
  let price = 100;

  for (let i = 0; i < n; i++) {
    const ret = (rng() - 0.5) * 0.04; // +/- 2%
    const open = price;
    price *= 1 + ret;
    const close = price;
    const high = Math.max(open, close) * (1 + rng() * 0.01);
    const low = Math.min(open, close) * (1 - rng() * 0.01);
    const volume = 1000 + rng() * 5000;

    candles.push({
      time: 1000000 + i * 86400,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

// ============================================
// Tests
// ============================================

describe("gaussianLogPdf", () => {
  it("computes correct value for standard normal at x=0", () => {
    const result = gaussianLogPdf(0, 0, 1);
    // -0.5 * ln(2 * PI) = -0.9189385...
    expect(result).toBeCloseTo(-0.9189385, 5);
  });

  it("computes correct value for non-standard distribution", () => {
    // mean=2, var=4, x=2 -> -0.5 * ln(2*PI*4) = -0.5 * ln(8*PI)
    const result = gaussianLogPdf(2, 2, 4);
    expect(result).toBeCloseTo(-0.5 * Math.log(8 * Math.PI), 10);
  });

  it("penalizes values far from the mean", () => {
    const atMean = gaussianLogPdf(0, 0, 1);
    const farAway = gaussianLogPdf(5, 0, 1);
    expect(atMean).toBeGreaterThan(farAway);
  });
});

describe("forward / backward", () => {
  const model: HmmModel = {
    numStates: 2,
    pi: [0.6, 0.4],
    transitionMatrix: [
      [0.9, 0.1],
      [0.2, 0.8],
    ],
    emissionMeans: [
      [1, 0],
      [-1, 0],
    ],
    emissionVariances: [
      [1, 1],
      [1, 1],
    ],
    logLikelihood: 0,
    converged: true,
  };

  const observations = [
    [0.5, 0.1],
    [0.8, -0.2],
    [-0.5, 0.3],
    [1.2, 0.0],
    [-0.8, -0.1],
  ];

  it("forward produces valid scaled alpha", () => {
    const { alpha, scales } = forward(observations, model);

    expect(alpha.length).toBe(observations.length);
    expect(scales.length).toBe(observations.length);

    // Each alpha[t] should sum to ~1 (due to scaling)
    for (let t = 0; t < observations.length; t++) {
      const sum = alpha[t].reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1, 6);
    }

    // All scales should be positive
    for (const s of scales) {
      expect(s).toBeGreaterThan(0);
    }
  });

  it("backward produces valid beta values", () => {
    const { scales } = forward(observations, model);
    const beta = backward(observations, model, scales);

    expect(beta.length).toBe(observations.length);

    // Last beta should be [1, 1]
    expect(beta[observations.length - 1][0]).toBe(1);
    expect(beta[observations.length - 1][1]).toBe(1);

    // All beta values should be finite
    for (let t = 0; t < observations.length; t++) {
      for (let i = 0; i < model.numStates; i++) {
        expect(Number.isFinite(beta[t][i])).toBe(true);
      }
    }
  });

  it("gamma (alpha * beta) sums to ~1 for each time step", () => {
    const { alpha, scales } = forward(observations, model);
    const beta = backward(observations, model, scales);

    for (let t = 0; t < observations.length; t++) {
      let gammaSum = 0;
      for (let i = 0; i < model.numStates; i++) {
        gammaSum += alpha[t][i] * beta[t][i];
      }
      expect(gammaSum).toBeCloseTo(1, 4);
    }
  });
});

describe("baumWelch", () => {
  it("recovers approximate means from synthetic 2-state data", () => {
    const rng = mulberry32(123);
    const { observations } = generateSyntheticHmmData(rng, 300);

    const model = baumWelch(observations, {
      numStates: 2,
      maxIterations: 100,
      seed: 42,
      numRestarts: 5,
    });

    expect(model.numStates).toBe(2);
    expect(model.logLikelihood).not.toBe(Number.NEGATIVE_INFINITY);

    // The model should recover two distinct mean patterns
    // Sort states by first feature mean for consistent comparison
    const sorted = model.emissionMeans
      .map((m, i) => ({ idx: i, mean0: m[0], mean1: m[1] }))
      .sort((a, b) => a.mean0 - b.mean0);

    // State with lower return mean should have negative-ish first feature
    expect(sorted[0].mean0).toBeLessThan(sorted[1].mean0);
    // The gap between means should be meaningful
    expect(sorted[1].mean0 - sorted[0].mean0).toBeGreaterThan(0.005);
  });

  it("produces valid transition matrix", () => {
    const rng = mulberry32(42);
    const { observations } = generateSyntheticHmmData(rng, 200);

    const model = baumWelch(observations, {
      numStates: 2,
      seed: 99,
    });

    // Each row should sum to ~1
    for (const row of model.transitionMatrix) {
      const sum = row.reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1, 6);
    }

    // All probabilities should be non-negative
    for (const row of model.transitionMatrix) {
      for (const p of row) {
        expect(p).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("has no NaN or Infinity in parameters", () => {
    const rng = mulberry32(7);
    const { observations } = generateSyntheticHmmData(rng, 150);

    const model = baumWelch(observations, { numStates: 2, seed: 77 });

    // Check all model parameters
    for (const p of model.pi) {
      expect(Number.isFinite(p)).toBe(true);
    }
    for (const row of model.transitionMatrix) {
      for (const v of row) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
    for (const row of model.emissionMeans) {
      for (const v of row) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
    for (const row of model.emissionVariances) {
      for (const v of row) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
    expect(Number.isFinite(model.logLikelihood)).toBe(true);
  });
});

describe("viterbi", () => {
  it("assigns states roughly matching generation for synthetic data", () => {
    const rng = mulberry32(55);
    const { observations, trueStates } = generateSyntheticHmmData(rng, 300);

    const model = baumWelch(observations, {
      numStates: 2,
      seed: 42,
      numRestarts: 5,
    });

    const decoded = viterbi(observations, model);

    expect(decoded.length).toBe(observations.length);

    // Check all decoded states are valid
    for (const s of decoded) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2);
    }

    // The decoded states should have a reasonable correspondence to true states.
    // Since state labels may be swapped, check both mappings.
    let matchDirect = 0;
    let matchSwapped = 0;
    for (let i = 0; i < decoded.length; i++) {
      if (decoded[i] === trueStates[i]) matchDirect++;
      if (decoded[i] === 1 - trueStates[i]) matchSwapped++;
    }
    const bestMatch = Math.max(matchDirect, matchSwapped);
    const accuracy = bestMatch / decoded.length;

    // Should get at least 60% accuracy (reasonable for a probabilistic model)
    expect(accuracy).toBeGreaterThan(0.6);
  });

  it("produces no NaN or Infinity in output", () => {
    const rng = mulberry32(99);
    const { observations } = generateSyntheticHmmData(rng, 100);

    const model = baumWelch(observations, { numStates: 2, seed: 11 });
    const decoded = viterbi(observations, model);

    for (const s of decoded) {
      expect(Number.isFinite(s)).toBe(true);
    }
  });
});

describe("hmmRegimes", () => {
  it("returns correct output length for 50+ candles", () => {
    const candles = makeCandles(60);
    const result = hmmRegimes(candles, { numStates: 3, seed: 42 });

    expect(result.length).toBe(60);
  });

  it("each result has valid probabilities summing to ~1", () => {
    const candles = makeCandles(80);
    const result = hmmRegimes(candles, { numStates: 3, seed: 42 });

    for (const r of result) {
      const probSum = r.value.probabilities.reduce((s, v) => s + v, 0);
      expect(probSum).toBeCloseTo(1, 4);
      expect(r.value.probabilities.length).toBe(3);
    }
  });

  it("assigns one of the expected labels for 3 states", () => {
    const candles = makeCandles(100);
    const result = hmmRegimes(candles, { numStates: 3, seed: 42 });

    const validLabels = new Set(["trending-up", "ranging", "trending-down"]);
    for (const r of result) {
      expect(validLabels.has(r.value.label)).toBe(true);
    }
  });

  it("uses state-N labels for non-3 states", () => {
    const candles = makeCandles(80);
    const result = hmmRegimes(candles, { numStates: 4, seed: 42 });

    for (const r of result) {
      expect(r.value.label).toMatch(/^state-\d+$/);
    }
  });

  it("has no NaN or Infinity in output for 100+ observations", () => {
    const candles = makeCandles(120);
    const result = hmmRegimes(candles, { numStates: 3, seed: 42 });

    for (const r of result) {
      expect(Number.isFinite(r.time)).toBe(true);
      expect(Number.isFinite(r.value.regime)).toBe(true);
      expect(Number.isFinite(r.value.logLikelihood)).toBe(true);
      for (const p of r.value.probabilities) {
        expect(Number.isFinite(p)).toBe(true);
      }
    }
  });
});

describe("regimeTransitionMatrix", () => {
  it("expected durations are positive", () => {
    const candles = makeCandles(100);
    const model = fitHmm(candles, { numStates: 3, seed: 42 });
    const info = regimeTransitionMatrix(model);

    for (const d of info.expectedDurations) {
      expect(d).toBeGreaterThan(0);
    }
  });

  it("stationary distribution sums to 1", () => {
    const candles = makeCandles(100);
    const model = fitHmm(candles, { numStates: 3, seed: 42 });
    const info = regimeTransitionMatrix(model);

    const sum = info.stationaryDistribution.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("returns correct number of labels", () => {
    const candles = makeCandles(80);
    const model = fitHmm(candles, { numStates: 3, seed: 42 });
    const info = regimeTransitionMatrix(model);

    expect(info.labels.length).toBe(3);
    expect(info.matrix.length).toBe(3);
    expect(info.expectedDurations.length).toBe(3);
    expect(info.stationaryDistribution.length).toBe(3);
  });

  it("transition matrix rows sum to ~1", () => {
    const candles = makeCandles(100);
    const model = fitHmm(candles, { numStates: 2, seed: 42 });
    const info = regimeTransitionMatrix(model);

    for (const row of info.matrix) {
      const sum = row.reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it("accepts custom labels", () => {
    const candles = makeCandles(80);
    const model = fitHmm(candles, { numStates: 2, seed: 42 });
    const info = regimeTransitionMatrix(model, ["bull", "bear"]);

    expect(info.labels).toEqual(["bull", "bear"]);
  });
});
