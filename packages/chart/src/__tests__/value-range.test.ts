import { describe, expect, it } from "vitest";
import { emptyRange, reduceRange } from "../core/value-range";

describe("reduceRange()", () => {
  it("returns min/max over the index window", () => {
    const [min, max] = reduceRange([10, 20, 30, 40, 50], 1, 4);
    expect(min).toBe(20);
    expect(max).toBe(40);
  });

  it("skips null/undefined values", () => {
    const [min, max] = reduceRange([5, null, 10, undefined, 15], 0, 5);
    expect(min).toBe(5);
    expect(max).toBe(15);
  });

  it("returns empty range for all-null input", () => {
    const [min, max] = reduceRange([null, null, null], 0, 3);
    expect(min).toBe(Number.POSITIVE_INFINITY);
    expect(max).toBe(Number.NEGATIVE_INFINITY);
  });

  it("clamps endIndex to values.length", () => {
    const [min, max] = reduceRange([1, 2, 3], 0, 100);
    expect(min).toBe(1);
    expect(max).toBe(3);
  });

  it("accumulates across multiple sources", () => {
    const first = reduceRange([10, 20], 0, 2);
    const merged = reduceRange([5, 25], 0, 2, first);
    expect(merged).toEqual([5, 25]);
  });

  it("never mutates the accumulator tuple it was passed", () => {
    const acc: [number, number] = [100, 100];
    const result = reduceRange([50, 150], 0, 2, acc);
    expect(acc).toEqual([100, 100]);
    expect(result).toEqual([50, 150]);
  });
});

describe("emptyRange()", () => {
  it("returns a fresh tuple each call (no shared state)", () => {
    const a = emptyRange();
    const b = emptyRange();
    expect(a).not.toBe(b);
    a[0] = 42;
    expect(b[0]).toBe(Number.POSITIVE_INFINITY);
  });
});
