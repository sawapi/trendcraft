/**
 * Functions that take two or more series must pair values that describe the
 * same bar. They used to take `Math.min(...lengths)` and read from index 0,
 * which pairs different dates as soon as the histories start at different
 * times, while still returning a plausible-looking number.
 *
 * - Time-keyed inputs are joined on their timestamps.
 * - Parallel arrays must have equal length (a mismatch throws).
 * - analyzeLeadLag, whose bare return arrays carry no times, uses the common
 *   trailing window like the risk functions.
 */

import { describe, expect, it } from "vitest";
import { linearRegression, spearmanCorrelation } from "../alpha-decay/statistics";
import { analyzeCorrelation } from "../correlation/analysis";
import { detectIntermarketDivergence } from "../correlation/divergence";
import { analyzeLeadLag } from "../correlation/lead-lag";
import {
  pearsonCorrelation,
  rollingCorrelation,
  spearmanRankCorrelation,
} from "../correlation/rolling";
import { analyzePair } from "../pairs/analysis";
import { olsRegression } from "../pairs/regression";
import { conditionalDrawdown } from "../risk/drawdown-analysis";

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);

/** A noisy random-walk-like price path, deterministic. */
function path(n: number): number[] {
  const out: number[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    p *= 1 + 0.01 * Math.sin(i * 1.7) + 0.006 * Math.cos(i * 0.31);
    out.push(p);
  }
  return out;
}

// B tracks A exactly (B = A / 2) on every shared date, but B's history starts
// 10 days later. Positionally, B[0] is paired with A[0] — ten days apart.
const prices = path(200);
const seriesA = prices.map((value, i) => ({ time: T0 + i * DAY, value }));
const seriesB = prices.slice(10).map((v, i) => ({ time: T0 + (i + 10) * DAY, value: v / 2 }));

describe("time-keyed inputs are joined on timestamps", () => {
  it("analyzePair pairs prices observed on the same date", () => {
    const result = analyzePair(seriesA, seriesB);
    expect(result.cointegration.hedgeRatio).toBeCloseTo(2, 9);
    expect(result.cointegration.rSquared).toBeCloseTo(1, 9);
    // Only the 190 shared dates are used.
    expect(result.spreadSeries).toHaveLength(190);
    expect(result.spreadSeries[0].time).toBe(seriesB[0].time);
  });

  it("analyzeCorrelation sees the two identical return streams as perfectly correlated", () => {
    const result = analyzeCorrelation(seriesA, seriesB, { window: 30 });
    for (const point of result.rollingCorrelation) expect(point.pearson).toBeCloseTo(1, 9);
    expect(result.leadLag.optimalLag).toBe(0);
  });
});

describe("analyzeLeadLag aligns bare return arrays on their trailing window", () => {
  it("finds no lag between a history and its own later part", () => {
    const returns = path(120).map((p, i, a) => (i === 0 ? 0 : p / a[i - 1] - 1));
    const result = analyzeLeadLag(returns, returns.slice(20), { maxLag: 5 });
    expect(result.optimalLag).toBe(0);
    expect(result.maxCorrelation).toBeCloseTo(1, 9);
  });
});

describe("analyzeLeadLag on histories shorter than maxLag", () => {
  it("only tries lags that leave at least 5 overlapping pairs", () => {
    // Lags of |lag| >= n used to slice past the arrays' ends and pair
    // mismatched fragments.
    for (let n = 5; n <= 12; n++) {
      const r = Array.from({ length: n }, (_, i) => Math.sin(i) * 0.01);
      const result = analyzeLeadLag(r, r, { maxLag: 10 });
      const lags = result.crossCorrelation.map((c) => c.lag);
      const bound = Math.min(10, n - 5);
      expect(lags).toEqual(Array.from({ length: 2 * bound + 1 }, (_, i) => i - bound));
    }
  });

  it("lets analyzeCorrelation run on a few bars", () => {
    expect(() => analyzeCorrelation(seriesA.slice(0, 9), seriesA.slice(0, 9))).not.toThrow();
  });
});

describe("parallel arrays must have the same length", () => {
  const a = [1, 2, 3, 4, 5, 6];
  const b = [2, 1, 4, 3, 6];

  it.each([
    ["pearsonCorrelation", () => pearsonCorrelation(a, b)],
    ["spearmanRankCorrelation", () => spearmanRankCorrelation(a, b)],
    ["olsRegression", () => olsRegression(a, b)],
    ["linearRegression", () => linearRegression(a, b)],
    ["spearmanCorrelation", () => spearmanCorrelation(a, b)],
    ["rollingCorrelation", () => rollingCorrelation(a, a, b, 3)],
    ["detectIntermarketDivergence", () => detectIntermarketDivergence(a, b, a)],
    ["conditionalDrawdown", () => conditionalDrawdown(a, a, b)],
  ])("%s throws on a length mismatch", (name, call) => {
    expect(call).toThrow(new RegExp(`^${name}: .* must have the same length`));
  });
});
