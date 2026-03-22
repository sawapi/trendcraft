import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { zigzag } from "../price/zigzag";

describe("zigzag", () => {
  const makeCandles = (data: { high: number; low: number }[]): NormalizedCandle[] =>
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
    expect(() => zigzag(candles, { deviation: 0 })).toThrow("Zigzag deviation must be positive");
    expect(() => zigzag(candles, { deviation: -1 })).toThrow("Zigzag deviation must be positive");
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

  it("should work with ATR-based threshold", () => {
    // Create a clear swing pattern with ATR mode
    const candles = makeCandles([
      { high: 100, low: 95 },
      { high: 105, low: 100 },
      { high: 110, low: 105 },
      { high: 120, low: 115 },
      { high: 125, low: 118 },
      { high: 130, low: 123 }, // High area
      { high: 128, low: 120 },
      { high: 122, low: 115 },
      { high: 115, low: 108 },
      { high: 108, low: 100 },
      { high: 102, low: 95 },
      { high: 98, low: 90 }, // Low area
      { high: 100, low: 93 },
      { high: 105, low: 98 },
      { high: 110, low: 103 },
      { high: 118, low: 110 },
      { high: 125, low: 118 },
      { high: 132, low: 125 },
      { high: 138, low: 130 },
      { high: 140, low: 133 },
    ]);

    const result = zigzag(candles, { useAtr: true, atrPeriod: 5, atrMultiplier: 2 });
    const pivots = result.filter((r) => r.value.point !== null);

    // Should detect at least some pivots with ATR mode
    expect(pivots.length).toBeGreaterThan(0);

    // All pivots should have valid prices
    for (const p of pivots) {
      expect(p.value.price).not.toBeNull();
      expect(p.value.price).toBeGreaterThan(0);
    }

    // Pivots should alternate
    for (let i = 1; i < pivots.length; i++) {
      expect(pivots[i].value.point).not.toBe(pivots[i - 1].value.point);
    }
  });

  it("should detect specific pivot positions with percentage mode", () => {
    // Well-defined V-shape: up to index 3 (high=120), down to index 7 (low=85), up again
    const candles = makeCandles([
      { high: 100, low: 95 }, // 0
      { high: 108, low: 102 }, // 1
      { high: 115, low: 108 }, // 2
      { high: 120, low: 113 }, // 3 - peak (high=120)
      { high: 115, low: 108 }, // 4
      { high: 108, low: 100 }, // 5
      { high: 100, low: 92 }, // 6
      { high: 92, low: 85 }, // 7 - trough (low=85)
      { high: 95, low: 88 }, // 8
      { high: 102, low: 95 }, // 9
      { high: 110, low: 103 }, // 10
      { high: 118, low: 112 }, // 11
    ]);

    const result = zigzag(candles, { deviation: 10 });
    const pivots = result.filter((r) => r.value.point !== null);

    // Should find the high at index 3 and the low at index 7
    const highPivot = result.find((r) => r.value.point === "high" && r.value.price === 120);
    const lowPivot = result.find((r) => r.value.point === "low" && r.value.price === 85);

    expect(highPivot).toBeDefined();
    expect(lowPivot).toBeDefined();

    // Verify pivot prices match actual candle extremes
    expect(highPivot?.time).toBe(candles[3].time);
    expect(lowPivot?.time).toBe(candles[7].time);
  });

  it("should use percentage fallback during ATR warmup", () => {
    // With atrPeriod=5, first 5 bars have no ATR → falls back to percentage.
    // Start flat, then create a clear up-down-up pattern so trend initialization
    // happens cleanly during warmup.
    const candles = makeCandles([
      { high: 102, low: 98 }, // 0 - flat start
      { high: 103, low: 99 }, // 1
      { high: 104, low: 100 }, // 2
      { high: 105, low: 101 }, // 3
      { high: 106, low: 102 }, // 4
      { high: 115, low: 108 }, // 5 - ATR becomes available, big up
      { high: 125, low: 118 }, // 6
      { high: 135, low: 128 }, // 7 - peak area
      { high: 130, low: 122 }, // 8
      { high: 120, low: 112 }, // 9
      { high: 110, low: 102 }, // 10
      { high: 100, low: 92 }, // 11 - trough area
      { high: 108, low: 100 }, // 12
      { high: 118, low: 110 }, // 13
      { high: 128, low: 120 }, // 14
    ]);

    const result = zigzag(candles, { useAtr: true, atrPeriod: 5, atrMultiplier: 2 });
    const pivots = result.filter((r) => r.value.point !== null);

    // Should still produce pivots even with ATR warmup period
    expect(pivots.length).toBeGreaterThanOrEqual(2);

    // All pivots should have valid prices
    for (const p of pivots) {
      expect(p.value.price).not.toBeNull();
      expect(p.value.price).toBeGreaterThan(0);
    }
  });

  it("should initialize trend with flat price action (fallback)", () => {
    // Very small moves that won't exceed 5% threshold
    const candles = makeCandles(
      Array.from({ length: 30 }, (_, i) => ({
        high: 100 + (i % 2) * 0.5,
        low: 99.5 + (i % 2) * 0.5,
      })),
    );

    // With 5% deviation, these tiny moves won't trigger normal initialization
    // The fallback should kick in after maxInitBars
    const result = zigzag(candles, { deviation: 5 });

    // Should not throw and should return valid result
    expect(result.length).toBe(30);
  });
});
