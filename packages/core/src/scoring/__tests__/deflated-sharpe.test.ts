import { describe, expect, it } from "vitest";
import {
  deflatedSharpe,
  deflatedSharpeFromReturns,
  expectedMaxSharpe,
  probabilisticSharpe,
} from "../deflated-sharpe";

describe("probabilisticSharpe", () => {
  it("is 0.5 when the observed Sharpe equals the benchmark", () => {
    // The standard-normal CDF approximation carries |error| < 1.5e-7.
    expect(probabilisticSharpe(0.1, 0.1, 250)).toBeCloseTo(0.5, 6);
  });

  it("exceeds 0.5 for a positive edge and drops below for a negative one", () => {
    expect(probabilisticSharpe(0.1, 0, 250)).toBeGreaterThan(0.5);
    expect(probabilisticSharpe(-0.1, 0, 250)).toBeLessThan(0.5);
  });

  it("is monotonically increasing in the observed Sharpe", () => {
    const lo = probabilisticSharpe(0.05, 0, 250);
    const mid = probabilisticSharpe(0.1, 0, 250);
    const hi = probabilisticSharpe(0.2, 0, 250);
    expect(lo).toBeLessThan(mid);
    expect(mid).toBeLessThan(hi);
  });

  it("rises with sample size for a fixed positive edge", () => {
    expect(probabilisticSharpe(0.1, 0, 1000)).toBeGreaterThan(probabilisticSharpe(0.1, 0, 100));
  });

  it("matches a hand-computed value for the normal case", () => {
    // z = 0.1 * sqrt(100) / sqrt(1 + 0.5 * 0.01) = 0.99751 → Φ ≈ 0.8407
    expect(probabilisticSharpe(0.1, 0, 101, 0, 3)).toBeCloseTo(0.8407, 3);
  });

  it("returns NaN when the sample is too small or the variance term is non-positive", () => {
    expect(Number.isNaN(probabilisticSharpe(0.1, 0, 1))).toBe(true);
    // Large positive skew with a large Sharpe can drive the radicand ≤ 0.
    expect(Number.isNaN(probabilisticSharpe(5, 0, 250, 10, 3))).toBe(true);
  });
});

describe("expectedMaxSharpe", () => {
  it("is the trial mean when there is no selection (≤ 1 trial or zero variance)", () => {
    expect(expectedMaxSharpe(1, 0.01)).toBe(0);
    expect(expectedMaxSharpe(100, 0)).toBe(0);
    expect(expectedMaxSharpe(1, 0.01, 0.3)).toBe(0.3);
  });

  it("increases with the number of trials (more trials → higher expected max)", () => {
    const few = expectedMaxSharpe(5, 0.01);
    const many = expectedMaxSharpe(500, 0.01);
    expect(many).toBeGreaterThan(few);
    expect(few).toBeGreaterThan(0);
  });

  it("scales with the trial Sharpe standard deviation", () => {
    expect(expectedMaxSharpe(50, 0.04)).toBeCloseTo(2 * expectedMaxSharpe(50, 0.01), 10);
  });
});

describe("deflatedSharpe", () => {
  it("deflates below the undeflated PSR because the selection benchmark is positive", () => {
    const params = {
      observedSharpe: 0.15,
      sampleSize: 500,
      trials: 50,
      trialSharpeVariance: 0.0025,
    };
    const dsr = deflatedSharpe(params);
    const undeflated = probabilisticSharpe(params.observedSharpe, 0, params.sampleSize);
    expect(dsr).toBeLessThan(undeflated);
    expect(dsr).toBeGreaterThanOrEqual(0);
    expect(dsr).toBeLessThanOrEqual(1);
  });

  it("drops as the number of trials grows (more searching → harder to clear)", () => {
    const base = {
      observedSharpe: 0.15,
      sampleSize: 500,
      trialSharpeVariance: 0.0025,
    };
    const few = deflatedSharpe({ ...base, trials: 5 });
    const many = deflatedSharpe({ ...base, trials: 1000 });
    expect(many).toBeLessThan(few);
  });

  it("equals the undeflated PSR with a single trial", () => {
    const dsr = deflatedSharpe({
      observedSharpe: 0.15,
      sampleSize: 500,
      trials: 1,
      trialSharpeVariance: 0.0025,
    });
    expect(dsr).toBeCloseTo(probabilisticSharpe(0.15, 0, 500), 10);
  });
});

describe("deflatedSharpeFromReturns", () => {
  it("returns NaN for degenerate input", () => {
    expect(Number.isNaN(deflatedSharpeFromReturns([0.01], [0.1]))).toBe(true);
    expect(Number.isNaN(deflatedSharpeFromReturns([0.01, 0.01, 0.01], [0.1]))).toBe(true);
  });

  it("derives a probability in [0, 1] from raw returns and trial Sharpes", () => {
    // A steadily positive return series.
    const returns = Array.from({ length: 300 }, (_, i) => 0.004 + (i % 2 === 0 ? 0.002 : -0.001));
    const trialSharpes = Array.from({ length: 20 }, (_, i) => 0.05 + i * 0.005);
    const dsr = deflatedSharpeFromReturns(returns, trialSharpes);
    expect(dsr).toBeGreaterThanOrEqual(0);
    expect(dsr).toBeLessThanOrEqual(1);
  });

  it("is lower when the same edge is framed as the best of many noisy trials", () => {
    // A modest positive drift buried in genuine volatility, so the
    // deflated Sharpe is not saturated at 1 and the selection-bias
    // benchmark can actually move it.
    const returns = Array.from({ length: 300 }, (_, i) => 0.0008 + ((i % 5) - 2) * 0.01);
    const fewTrials = [0.08, 0.09, 0.1];
    const manyTrials = Array.from({ length: 300 }, (_, i) => -0.05 + i * 0.001);
    expect(deflatedSharpeFromReturns(returns, manyTrials)).toBeLessThan(
      deflatedSharpeFromReturns(returns, fewTrials),
    );
  });
});
