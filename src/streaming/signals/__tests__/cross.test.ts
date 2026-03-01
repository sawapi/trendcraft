import { describe, it, expect } from "vitest";
import { createCrossOverDetector, createCrossUnderDetector } from "../cross";
import { crossOver, crossUnder } from "../../../signals/cross";
import type { Series } from "../../../types";

describe("createCrossOverDetector", () => {
  it("should return false on first call (no previous data)", () => {
    const d = createCrossOverDetector();
    expect(d.next(10, 20)).toBe(false);
  });

  it("should detect crossover (A goes from below to above B)", () => {
    const d = createCrossOverDetector();
    d.next(10, 20); // A < B
    expect(d.next(25, 20)).toBe(true); // A > B (crossed over)
  });

  it("should detect crossover from equal", () => {
    const d = createCrossOverDetector();
    d.next(20, 20); // A == B
    expect(d.next(21, 20)).toBe(true); // A > B
  });

  it("should not fire when already above", () => {
    const d = createCrossOverDetector();
    d.next(25, 20); // A > B
    expect(d.next(30, 20)).toBe(false); // still above, no cross
  });

  it("should not fire when crossing under", () => {
    const d = createCrossOverDetector();
    d.next(25, 20); // A > B
    expect(d.next(15, 20)).toBe(false); // A < B (cross under, not over)
  });

  it("should handle null values", () => {
    const d = createCrossOverDetector();
    expect(d.next(null, 20)).toBe(false);
    expect(d.next(25, null)).toBe(false);
    d.next(10, 20);
    expect(d.next(null, 20)).toBe(false);
  });

  it("should support peek without advancing state", () => {
    const d = createCrossOverDetector();
    d.next(10, 20);
    expect(d.peek(25, 20)).toBe(true);
    // State is not advanced, so next with same values should also detect
    expect(d.next(25, 20)).toBe(true);
    // Now state advanced, so same values won't trigger again
    expect(d.next(25, 20)).toBe(false);
  });

  it("should match batch crossOver results", () => {
    const seriesA: Series<number | null> = [
      { time: 0, value: 10 },
      { time: 1, value: 15 },
      { time: 2, value: 22 },
      { time: 3, value: 18 },
      { time: 4, value: 25 },
      { time: 5, value: 12 },
      { time: 6, value: 21 },
    ];
    const seriesB: Series<number | null> = [
      { time: 0, value: 20 },
      { time: 1, value: 20 },
      { time: 2, value: 20 },
      { time: 3, value: 20 },
      { time: 4, value: 20 },
      { time: 5, value: 20 },
      { time: 6, value: 20 },
    ];

    const batchResult = crossOver(seriesA, seriesB);
    const d = createCrossOverDetector();
    for (let i = 0; i < seriesA.length; i++) {
      const incremental = d.next(seriesA[i].value, seriesB[i].value);
      expect(incremental).toBe(batchResult[i].value);
    }
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const d1 = createCrossOverDetector();
      d1.next(10, 20);
      const state = JSON.parse(JSON.stringify(d1.getState()));

      const d2 = createCrossOverDetector(state);
      expect(d2.next(25, 20)).toBe(true);
    });
  });
});

describe("createCrossUnderDetector", () => {
  it("should return false on first call", () => {
    const d = createCrossUnderDetector();
    expect(d.next(20, 10)).toBe(false);
  });

  it("should detect crossunder (A goes from above to below B)", () => {
    const d = createCrossUnderDetector();
    d.next(25, 20); // A > B
    expect(d.next(15, 20)).toBe(true); // A < B (crossed under)
  });

  it("should detect crossunder from equal", () => {
    const d = createCrossUnderDetector();
    d.next(20, 20); // A == B
    expect(d.next(19, 20)).toBe(true); // A < B
  });

  it("should not fire when already below", () => {
    const d = createCrossUnderDetector();
    d.next(15, 20); // A < B
    expect(d.next(10, 20)).toBe(false);
  });

  it("should match batch crossUnder results", () => {
    const seriesA: Series<number | null> = [
      { time: 0, value: 25 },
      { time: 1, value: 22 },
      { time: 2, value: 18 },
      { time: 3, value: 22 },
      { time: 4, value: 15 },
      { time: 5, value: 25 },
      { time: 6, value: 19 },
    ];
    const seriesB: Series<number | null> = [
      { time: 0, value: 20 },
      { time: 1, value: 20 },
      { time: 2, value: 20 },
      { time: 3, value: 20 },
      { time: 4, value: 20 },
      { time: 5, value: 20 },
      { time: 6, value: 20 },
    ];

    const batchResult = crossUnder(seriesA, seriesB);
    const d = createCrossUnderDetector();
    for (let i = 0; i < seriesA.length; i++) {
      const incremental = d.next(seriesA[i].value, seriesB[i].value);
      expect(incremental).toBe(batchResult[i].value);
    }
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const d1 = createCrossUnderDetector();
      d1.next(25, 20);
      const state = JSON.parse(JSON.stringify(d1.getState()));

      const d2 = createCrossUnderDetector(state);
      expect(d2.next(15, 20)).toBe(true);
    });
  });
});
