import { describe, expect, it } from "vitest";
import { median, percentile, quartiles } from "../statistics";

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("returns the only value for a single-element array", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  it("interpolates linearly between adjacent sorted values", () => {
    // [10, 20] at p=50 → midpoint = 15
    expect(percentile([10, 20], 50)).toBe(15);
    // [10, 20] at p=25 → quarter of the way from 10 to 20 = 12.5
    expect(percentile([10, 20], 25)).toBe(12.5);
  });

  it("does not mutate the input array", () => {
    const values = [3, 1, 4, 1, 5, 9, 2, 6];
    const before = [...values];
    percentile(values, 50);
    expect(values).toEqual(before);
  });

  it("sorts unsorted input internally", () => {
    // [3, 1, 4, 1, 5, 9, 2, 6] sorted = [1, 1, 2, 3, 4, 5, 6, 9]
    // p=50 → idx = 0.5 * 7 = 3.5 → sorted[3] + 0.5*(sorted[4]-sorted[3]) = 3 + 0.5*1 = 3.5
    expect(percentile([3, 1, 4, 1, 5, 9, 2, 6], 50)).toBe(3.5);
  });

  it("handles p=0 (minimum) and p=100 (maximum)", () => {
    const values = [10, 20, 30, 40, 50];
    expect(percentile(values, 0)).toBe(10);
    expect(percentile(values, 100)).toBe(50);
  });

  it("throws on out-of-range or NaN percentile", () => {
    expect(() => percentile([1, 2, 3], -1)).toThrow(/p must be/);
    expect(() => percentile([1, 2, 3], 101)).toThrow(/p must be/);
    expect(() => percentile([1, 2, 3], Number.NaN)).toThrow(/p must be/);
    expect(() => percentile([1, 2, 3], Number.POSITIVE_INFINITY)).toThrow(/p must be/);
  });

  it("matches the legacy linear-interpolation algorithm exactly (regression)", () => {
    // Sample from real grid-search scoring distributions; expected
    // values were captured from the previous private getPercentile in
    // monte-carlo.ts before consolidation.
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 25)).toBe(3.25); // idx 2.25 → 3 + 0.25 * 1
    expect(percentile(sorted, 75)).toBe(7.75); // idx 6.75 → 7 + 0.75 * 1
    expect(percentile(sorted, 5)).toBeCloseTo(1.45, 10); // idx 0.45 → 1 + 0.45 * 1
    expect(percentile(sorted, 95)).toBeCloseTo(9.55, 10);
  });
});

describe("median", () => {
  it("equals percentile(values, 50)", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(percentile([1, 2, 3, 4, 5], 50));
    expect(median([3, 1, 4, 1, 5, 9, 2, 6])).toBe(percentile([3, 1, 4, 1, 5, 9, 2, 6], 50));
  });

  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });
});

describe("quartiles", () => {
  it("returns [Q1, Q2, Q3] = [p25, p50, p75]", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const [q1, q2, q3] = quartiles(values);
    expect(q1).toBe(percentile(values, 25));
    expect(q2).toBe(percentile(values, 50));
    expect(q3).toBe(percentile(values, 75));
  });

  it("returns [0, 0, 0] for empty array", () => {
    expect(quartiles([])).toEqual([0, 0, 0]);
  });
});
