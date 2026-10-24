import { describe, expect, it } from "vitest";
import { calculateSpread } from "../spread";

describe("calculateSpread (unit)", () => {
  it("handles zero hedge ratio", () => {
    const seriesY = [100, 102, 104];
    const seriesX = [50, 51, 52];
    const times = [1, 2, 3];

    const result = calculateSpread(seriesY, seriesX, 0, 0, times);

    // spread = Y - 0*X - 0 = Y
    expect(result[0].spread).toBe(100);
    expect(result[1].spread).toBe(102);
    expect(result[2].spread).toBe(104);
  });

  it("handles negative hedge ratio", () => {
    const seriesY = [100, 100, 100];
    const seriesX = [50, 50, 50];
    const times = [1, 2, 3];

    const result = calculateSpread(seriesY, seriesX, -1, 0, times);

    // spread = Y - (-1)*X = Y + X = 150
    expect(result[0].spread).toBe(150);
  });

  it("handles rolling window of 1", () => {
    const seriesY = [100, 110, 90, 100, 120];
    const seriesX = [50, 50, 50, 50, 50];
    const times = [1, 2, 3, 4, 5];

    const result = calculateSpread(seriesY, seriesX, 1, 50, times, { rollingWindow: 1 });

    // With window=1, each spread is the only element → stdDev=0 → zScore=0
    for (const point of result) {
      expect(point.stdDev).toBe(0);
      expect(point.zScore).toBe(0);
    }
  });

  it("returns zScore=0 and stdDev=0 when all spreads are identical", () => {
    const seriesY = [200, 200, 200, 200, 200];
    const seriesX = [100, 100, 100, 100, 100];
    const times = [1, 2, 3, 4, 5];

    const result = calculateSpread(seriesY, seriesX, 1, 100, times);

    // All spreads = 200 - 100 - 100 = 0
    for (const point of result) {
      expect(point.spread).toBe(0);
      expect(point.stdDev).toBe(0);
      expect(point.zScore).toBe(0);
    }
  });

  it("rejects series that are not the same length as each other and as times", () => {
    // Truncating to the shorter series paired seriesY's first bars with
    // whichever bars seriesX happened to start at.
    const seriesY = [100, 102, 104, 106, 108, 110];
    const seriesX = [50, 51, 52];
    const times = [1, 2, 3, 4, 5, 6];

    expect(() => calculateSpread(seriesY, seriesX, 1, 0, times)).toThrow(
      /calculateSpread: seriesY, seriesX and times must have the same length/,
    );
    expect(() => calculateSpread(seriesY, seriesY, 1, 0, times.slice(1))).toThrow(/times: 5/);
  });
});
