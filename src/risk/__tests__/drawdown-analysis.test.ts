import { describe, it, expect } from "vitest";
import {
  drawdownDistribution,
  conditionalDrawdown,
  estimateRecoveryTime,
  ulcerPerformanceIndex,
} from "../drawdown-analysis";

// ---------------------------------------------------------------------------
// drawdownDistribution
// ---------------------------------------------------------------------------
describe("drawdownDistribution", () => {
  it("returns zeros for an empty array", () => {
    const result = drawdownDistribution([]);
    expect(result.bins).toEqual([]);
    expect(result.median).toBe(0);
    expect(result.percentile95).toBe(0);
    expect(result.percentile99).toBe(0);
  });

  it("computes bins, median, and percentile95 for a 10-element array", () => {
    const depths = [2, 5, 8, 3, 12, 1, 7, 4, 15, 6];
    const result = drawdownDistribution(depths);

    // Default 10 bins over range [1, 15]
    expect(result.bins.length).toBe(10);

    // Total count across bins must equal input length
    const totalCount = result.bins.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(10);

    // Frequencies must sum to 1
    const totalFreq = result.bins.reduce((s, b) => s + b.frequency, 0);
    expect(totalFreq).toBeCloseTo(1, 10);

    // Sorted: [1,2,3,4,5,6,7,8,12,15] → median = (5+6)/2 = 5.5
    expect(result.median).toBeCloseTo(5.5, 10);

    // 95th percentile should be between 12 and 15
    expect(result.percentile95).toBeGreaterThanOrEqual(12);
    expect(result.percentile95).toBeLessThanOrEqual(15);
  });

  it("handles a single-value array", () => {
    const result = drawdownDistribution([7]);
    expect(result.bins.length).toBe(10);
    expect(result.median).toBe(7);
    expect(result.percentile95).toBe(7);
    expect(result.percentile99).toBe(7);
    // All counts in one bin
    const totalCount = result.bins.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(1);
  });

  it("supports a custom number of bins", () => {
    const depths = [2, 5, 8, 3, 12, 1, 7, 4, 15, 6];
    const result = drawdownDistribution(depths, 5);
    expect(result.bins.length).toBe(5);
    const totalCount = result.bins.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// conditionalDrawdown
// ---------------------------------------------------------------------------
describe("conditionalDrawdown", () => {
  it("returns all zeros for empty inputs", () => {
    const result = conditionalDrawdown([], [], []);
    expect(result.highVolatility).toEqual({ avgDepth: 0, count: 0, maxDepth: 0 });
    expect(result.lowVolatility).toEqual({ avgDepth: 0, count: 0, maxDepth: 0 });
    expect(result.trending).toEqual({ avgDepth: 0, count: 0, maxDepth: 0 });
    expect(result.ranging).toEqual({ avgDepth: 0, count: 0, maxDepth: 0 });
  });

  it("segments correctly by volatility and trend regime", () => {
    // 6 bars: alternate low/high volatility, alternate small/large returns
    const returns = [0.01, -0.05, 0.02, -0.08, 0.01, -0.06];
    const drawdowns = [1, 5, 2, 8, 1, 6];
    const volatilities = [0.1, 0.5, 0.1, 0.6, 0.2, 0.4];

    const result = conditionalDrawdown(returns, drawdowns, volatilities);

    // High volatility bars (vol >= median): should have some entries
    expect(result.highVolatility.count).toBeGreaterThan(0);
    expect(result.lowVolatility.count).toBeGreaterThan(0);

    // Trending bars (abs return >= median abs return): should have entries
    expect(result.trending.count).toBeGreaterThan(0);
    expect(result.ranging.count).toBeGreaterThan(0);

    // Total segmented count should equal total non-zero drawdown bars
    const nonZeroDd = drawdowns.filter((d) => d !== 0).length;
    expect(result.highVolatility.count + result.lowVolatility.count).toBe(nonZeroDd);
    expect(result.trending.count + result.ranging.count).toBe(nonZeroDd);

    // Max depths should be <= overall max
    expect(result.highVolatility.maxDepth).toBeLessThanOrEqual(8);
    expect(result.lowVolatility.maxDepth).toBeLessThanOrEqual(8);
  });

  it("ignores zero-drawdown bars", () => {
    const returns = [0.01, -0.02, 0.03];
    const drawdowns = [0, 5, 0];
    const volatilities = [0.1, 0.5, 0.3];

    const result = conditionalDrawdown(returns, drawdowns, volatilities);

    // Only 1 non-zero drawdown bar
    const total = result.highVolatility.count + result.lowVolatility.count;
    expect(total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// estimateRecoveryTime
// ---------------------------------------------------------------------------
describe("estimateRecoveryTime", () => {
  it("returns zero with no history", () => {
    const result = estimateRecoveryTime(10, []);
    expect(result.estimatedBars).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.historicalRecoveries).toEqual([]);
  });

  it("finds exact matches within +/-50%", () => {
    const history = [
      { depth: 10, recoveryBars: 20 },
      { depth: 12, recoveryBars: 30 },
      { depth: 8, recoveryBars: 10 },
    ];
    // currentDrawdown=10 → range [5, 15], all three match
    const result = estimateRecoveryTime(10, history);
    expect(result.estimatedBars).toBe(Math.round((20 + 30 + 10) / 3));
    expect(result.historicalRecoveries).toEqual([20, 30, 10]);
    // 3 matches → confidence = 3/5 = 0.6
    expect(result.confidence).toBeCloseTo(0.6, 10);
  });

  it("falls back to scaled average when no matches exist", () => {
    const history = [
      { depth: 50, recoveryBars: 100 },
      { depth: 60, recoveryBars: 120 },
    ];
    // currentDrawdown=5 → range [2.5, 7.5], no matches
    const result = estimateRecoveryTime(5, history);

    // avgDepth = 55, depthRatio = 5/55, avgBars = 110, scaled ≈ 10
    const expectedBars = Math.round(110 * (5 / 55));
    expect(result.estimatedBars).toBe(expectedBars);
    // Fallback confidence = min(1, 2/5) * 0.5 = 0.4 * 0.5 = 0.2
    expect(result.confidence).toBeCloseTo(0.2, 10);
    expect(result.historicalRecoveries).toEqual([100, 120]);
  });

  it("caps confidence at 1.0 with 5+ matches", () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      depth: 10 + i,
      recoveryBars: 20 + i * 2,
    }));
    const result = estimateRecoveryTime(10, history);
    expect(result.confidence).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ulcerPerformanceIndex
// ---------------------------------------------------------------------------
describe("ulcerPerformanceIndex", () => {
  it("returns UPI > 0 for a rising equity curve with minor dips", () => {
    // Generally rising but with small drawdowns so Ulcer Index > 0
    const equity = [100, 102, 99, 101, 105, 103, 108, 106, 110, 112, 109, 115];
    const upi = ulcerPerformanceIndex(equity);
    expect(upi).toBeGreaterThan(0);
  });

  it("returns 0 for a short equity curve", () => {
    expect(ulcerPerformanceIndex([])).toBe(0);
    expect(ulcerPerformanceIndex([100])).toBe(0);
  });

  it("returns 0 for a flat equity curve", () => {
    const equity = Array.from({ length: 20 }, () => 100);
    const upi = ulcerPerformanceIndex(equity);
    expect(upi).toBe(0);
  });
});
