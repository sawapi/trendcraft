import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { zigzag } from "../price/zigzag";

describe("zigzag", () => {
  const makeCandles = (
    data: { high: number; low: number }[],
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: (d.high + d.low) / 2,
      high: d.high,
      low: d.low,
      close: (d.high + d.low) / 2,
      volume: 1000,
    }));

  it("should throw if deviation is not positive", () => {
    const candles = makeCandles([{ high: 10, low: 5 }]);
    expect(() => zigzag(candles, { deviation: 0 })).toThrow(
      "Zigzag deviation must be positive",
    );
    expect(() => zigzag(candles, { deviation: -1 })).toThrow(
      "Zigzag deviation must be positive",
    );
  });

  it("should return all nulls for insufficient data", () => {
    const candles = makeCandles([{ high: 10, low: 5 }]);
    const result = zigzag(candles);

    expect(result[0].value.point).toBeNull();
  });

  it("should detect major swing points", () => {
    // Clear up-down-up pattern with >5% moves
    const candles = makeCandles([
      { high: 102, low: 98 },
      { high: 105, low: 100 },
      { high: 110, low: 105 },
      { high: 115, low: 110 }, // High point
      { high: 112, low: 108 },
      { high: 108, low: 104 },
      { high: 105, low: 100 }, // Low point (drop >5%)
      { high: 108, low: 104 },
      { high: 112, low: 108 },
      { high: 116, low: 112 },
    ]);

    const result = zigzag(candles, { deviation: 5 });
    const pivots = result.filter((r) => r.value.point !== null);

    // Should detect at least some pivots
    expect(pivots.length).toBeGreaterThan(0);

    // All pivots should have prices
    for (const p of pivots) {
      expect(p.value.price).not.toBeNull();
    }
  });

  it("should alternate between highs and lows", () => {
    // Large swings to ensure detection
    const candles = makeCandles([
      { high: 100, low: 95 },
      { high: 105, low: 100 },
      { high: 120, low: 115 }, // High
      { high: 115, low: 110 },
      { high: 105, low: 100 },
      { high: 100, low: 90 }, // Low
      { high: 105, low: 100 },
      { high: 110, low: 105 },
      { high: 120, low: 115 }, // High
    ]);

    const result = zigzag(candles, { deviation: 10 });
    const pivots = result.filter((r) => r.value.point !== null);

    // Check alternation: consecutive pivots should alternate
    for (let i = 1; i < pivots.length; i++) {
      expect(pivots[i].value.point).not.toBe(pivots[i - 1].value.point);
    }
  });

  it("should filter out small moves", () => {
    // Small moves within 5% should not create pivots
    const candles = makeCandles([
      { high: 100, low: 98 },
      { high: 101, low: 99 },
      { high: 102, low: 100 },
      { high: 101, low: 99 },
      { high: 100, low: 98 },
    ]);

    const result = zigzag(candles, { deviation: 5 });
    const pivots = result.filter((r) => r.value.point !== null);

    // Small moves should be filtered out
    expect(pivots.length).toBeLessThanOrEqual(1);
  });

  it("should handle empty array", () => {
    expect(zigzag([])).toEqual([]);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { high: 110, low: 100 },
      { high: 120, low: 110 },
      { high: 110, low: 100 },
    ]);
    const result = zigzag(candles);

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should include changePercent for pivots after the first", () => {
    // Large enough moves for 10% detection
    const candles = makeCandles([
      { high: 100, low: 90 },
      { high: 110, low: 100 },
      { high: 130, low: 120 },
      { high: 125, low: 115 },
      { high: 115, low: 105 },
      { high: 105, low: 95 },
      { high: 100, low: 85 },
      { high: 105, low: 95 },
      { high: 115, low: 105 },
      { high: 130, low: 120 },
    ]);

    const result = zigzag(candles, { deviation: 10 });
    const pivots = result.filter((r) => r.value.point !== null);

    // First pivot may have null changePercent, subsequent should have values
    if (pivots.length > 1) {
      expect(pivots[1].value.changePercent).not.toBeNull();
    }
  });
});
