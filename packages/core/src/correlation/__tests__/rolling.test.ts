import { describe, expect, it } from "vitest";
import { rollingCorrelation, spearmanRankCorrelation } from "../rolling";

describe("spearmanRankCorrelation (unit)", () => {
  it("handles tied ranks correctly", () => {
    // x has ties: [1, 1, 3]
    const x = [1, 1, 3];
    const y = [1, 2, 3];

    const r = spearmanRankCorrelation(x, y);
    // Should still produce a valid correlation
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
    // Monotonic-ish, so correlation should be positive
    expect(r).toBeGreaterThan(0.5);
  });

  it("returns 0 when all values are identical", () => {
    const x = [5, 5, 5, 5];
    const y = [1, 2, 3, 4];

    // All x ranks are the same → zero variance in ranks → 0 correlation
    expect(spearmanRankCorrelation(x, y)).toBe(0);
  });

  it("returns 0 for n < 2", () => {
    expect(spearmanRankCorrelation([1], [2])).toBe(0);
    expect(spearmanRankCorrelation([], [])).toBe(0);
  });
});

describe("rollingCorrelation (unit)", () => {
  it("returns empty when window > n", () => {
    const a = [0.01, 0.02, 0.03];
    const b = [0.01, 0.02, 0.03];
    const times = [1, 2, 3];

    const result = rollingCorrelation(a, b, times, 10);
    expect(result).toHaveLength(0);
  });

  it("returns exactly 1 point when window = n", () => {
    const a = [0.01, -0.01, 0.02, -0.02, 0.03];
    const b = [0.02, -0.02, 0.04, -0.04, 0.06];
    const times = [1, 2, 3, 4, 5];

    const result = rollingCorrelation(a, b, times, 5);
    expect(result).toHaveLength(1);
    expect(result[0].pearson).toBeCloseTo(1, 5);
  });

  it("timestamp matches the last bar of each window", () => {
    const n = 10;
    const a = Array.from({ length: n }, (_, i) => i * 0.01);
    const b = Array.from({ length: n }, (_, i) => i * 0.02);
    const times = Array.from({ length: n }, (_, i) => 1000 + i);

    const result = rollingCorrelation(a, b, times, 5);
    // First result should have time of index 4 (window 0-4)
    expect(result[0].time).toBe(1004);
    // Last result should have time of last index
    expect(result[result.length - 1].time).toBe(1009);
  });
});
