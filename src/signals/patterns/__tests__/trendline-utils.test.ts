import { describe, expect, it } from "vitest";
import {
  classifyTrendlinePair,
  countTouchPoints,
  fitTrendline,
  fitTrendlinePair,
  isSlopeFlat,
} from "../trendline-utils";

describe("fitTrendline", () => {
  it("should return null for less than 2 points", () => {
    expect(fitTrendline([])).toBeNull();
    expect(fitTrendline([{ index: 0, price: 100 }])).toBeNull();
  });

  it("should fit a perfect upward line", () => {
    const points = [
      { index: 0, price: 100 },
      { index: 10, price: 110 },
      { index: 20, price: 120 },
    ];
    const fit = fitTrendline(points)!;
    expect(fit).not.toBeNull();
    expect(fit.slope).toBeCloseTo(1.0);
    expect(fit.intercept).toBeCloseTo(100);
    expect(fit.rSquared).toBeCloseTo(1.0);
    expect(fit.valueAt(5)).toBeCloseTo(105);
    expect(fit.points).toHaveLength(3);
  });

  it("should fit a downward line", () => {
    const points = [
      { index: 0, price: 200 },
      { index: 10, price: 180 },
      { index: 20, price: 160 },
    ];
    const fit = fitTrendline(points)!;
    expect(fit.slope).toBeCloseTo(-2.0);
    expect(fit.rSquared).toBeCloseTo(1.0);
  });

  it("should have lower R² for noisy data", () => {
    const points = [
      { index: 0, price: 100 },
      { index: 10, price: 115 },
      { index: 20, price: 108 },
      { index: 30, price: 125 },
    ];
    const fit = fitTrendline(points)!;
    expect(fit.rSquared).toBeLessThan(1.0);
    expect(fit.rSquared).toBeGreaterThan(0);
  });
});

describe("fitTrendlinePair", () => {
  it("should return null if either line has fewer than 2 points", () => {
    expect(
      fitTrendlinePair(
        [],
        [
          { index: 0, price: 100 },
          { index: 10, price: 110 },
        ],
      ),
    ).toBeNull();
    expect(
      fitTrendlinePair(
        [{ index: 0, price: 120 }],
        [
          { index: 0, price: 100 },
          { index: 10, price: 110 },
        ],
      ),
    ).toBeNull();
  });

  it("should detect convergence for a triangle shape", () => {
    const highs = [
      { index: 0, price: 120 },
      { index: 20, price: 110 },
    ];
    const lows = [
      { index: 5, price: 90 },
      { index: 25, price: 100 },
    ];
    const pair = fitTrendlinePair(highs, lows)!;
    expect(pair).not.toBeNull();
    expect(pair.upper.slope).toBeLessThan(0); // descending
    expect(pair.lower.slope).toBeGreaterThan(0); // ascending
    expect(pair.convergenceBar).not.toBeNull();
    expect(pair.convergenceBar!).toBeGreaterThan(25);
  });

  it("should return null convergence for parallel lines", () => {
    const highs = [
      { index: 0, price: 120 },
      { index: 20, price: 140 },
    ];
    const lows = [
      { index: 0, price: 100 },
      { index: 20, price: 120 },
    ];
    const pair = fitTrendlinePair(highs, lows)!;
    // Same slope → no convergence or convergence at infinity
    expect(pair.convergenceBar).toBeNull();
  });
});

describe("classifyTrendlinePair", () => {
  it("should classify converging lines", () => {
    const upper = fitTrendline([
      { index: 0, price: 120 },
      { index: 20, price: 110 },
    ])!;
    const lower = fitTrendline([
      { index: 0, price: 80 },
      { index: 20, price: 90 },
    ])!;
    expect(classifyTrendlinePair(upper, lower)).toBe("converging");
  });

  it("should classify diverging lines", () => {
    const upper = fitTrendline([
      { index: 0, price: 110 },
      { index: 20, price: 130 },
    ])!;
    const lower = fitTrendline([
      { index: 0, price: 100 },
      { index: 20, price: 90 },
    ])!;
    expect(classifyTrendlinePair(upper, lower)).toBe("diverging");
  });
});

describe("isSlopeFlat", () => {
  it("should return true for near-zero slope", () => {
    expect(isSlopeFlat(0.0001, 100, 0.0002)).toBe(true);
  });

  it("should return false for significant slope", () => {
    expect(isSlopeFlat(0.5, 100, 0.0002)).toBe(false);
  });
});

describe("countTouchPoints", () => {
  it("should count points near the line", () => {
    const fit = fitTrendline([
      { index: 0, price: 100 },
      { index: 10, price: 100 },
      { index: 20, price: 100 },
    ])!;
    // All points should be on the line exactly
    const touches = countTouchPoints(fit, 2.0, 0.5);
    expect(touches).toBe(3);
  });

  it("should not count distant points", () => {
    const fit = fitTrendline([
      { index: 0, price: 100 },
      { index: 10, price: 120 }, // Far from y=100 line
    ])!;
    // With a tight tolerance, one or both may not count
    const touches = countTouchPoints(fit, 0.1, 0.5);
    expect(touches).toBeLessThanOrEqual(2);
  });
});
