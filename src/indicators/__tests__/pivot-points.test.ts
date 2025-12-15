import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { pivotPoints } from "../price/pivot-points";

describe("pivotPoints", () => {
  // Helper to create candles with OHLC data
  const makeCandles = (data: Array<{ open: number; high: number; low: number; close: number }>): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should return null for first candle (no previous data)", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 105 },
    ]);

    const result = pivotPoints(candles);
    expect(result[0].value.pivot).toBeNull();
    expect(result[0].value.r1).toBeNull();
    expect(result[0].value.s1).toBeNull();
  });

  it("should calculate standard pivot points correctly", () => {
    const candles = makeCandles([
      { open: 100, high: 120, low: 80, close: 100 }, // Previous day
      { open: 105, high: 125, low: 85, close: 110 }, // Current day
    ]);

    const result = pivotPoints(candles);

    // Pivot = (High + Low + Close) / 3 = (120 + 80 + 100) / 3 = 100
    expect(result[1].value.pivot).toBe(100);

    // R1 = 2 × Pivot - Low = 2 × 100 - 80 = 120
    expect(result[1].value.r1).toBe(120);

    // R2 = Pivot + (High - Low) = 100 + 40 = 140
    expect(result[1].value.r2).toBe(140);

    // R3 = High + 2 × (Pivot - Low) = 120 + 2 × 20 = 160
    expect(result[1].value.r3).toBe(160);

    // S1 = 2 × Pivot - High = 2 × 100 - 120 = 80
    expect(result[1].value.s1).toBe(80);

    // S2 = Pivot - (High - Low) = 100 - 40 = 60
    expect(result[1].value.s2).toBe(60);

    // S3 = Low - 2 × (High - Pivot) = 80 - 2 × 20 = 40
    expect(result[1].value.s3).toBe(40);
  });

  it("should calculate fibonacci pivot points", () => {
    const candles = makeCandles([
      { open: 100, high: 120, low: 80, close: 100 },
      { open: 105, high: 125, low: 85, close: 110 },
    ]);

    const result = pivotPoints(candles, { method: "fibonacci" });

    // Pivot = (120 + 80 + 100) / 3 = 100
    // Range = 40
    expect(result[1].value.pivot).toBe(100);
    expect(result[1].value.r1).toBeCloseTo(100 + 0.382 * 40, 2); // 115.28
    expect(result[1].value.r2).toBeCloseTo(100 + 0.618 * 40, 2); // 124.72
    expect(result[1].value.s1).toBeCloseTo(100 - 0.382 * 40, 2); // 84.72
    expect(result[1].value.s2).toBeCloseTo(100 - 0.618 * 40, 2); // 75.28
  });

  it("should calculate woodie pivot points", () => {
    const candles = makeCandles([
      { open: 100, high: 120, low: 80, close: 100 },
      { open: 105, high: 125, low: 85, close: 110 },
    ]);

    const result = pivotPoints(candles, { method: "woodie" });

    // Woodie Pivot = (High + Low + 2 × Open of current day) / 4
    // = (120 + 80 + 2 × 105) / 4 = 410 / 4 = 102.5
    expect(result[1].value.pivot).toBe(102.5);
  });

  it("should calculate camarilla pivot points", () => {
    const candles = makeCandles([
      { open: 100, high: 120, low: 80, close: 100 },
      { open: 105, high: 125, low: 85, close: 110 },
    ]);

    const result = pivotPoints(candles, { method: "camarilla" });

    // Camarilla uses close-based calculations
    // Range = 40
    expect(result[1].value.r1).toBeCloseTo(100 + 40 * (1.1 / 12), 2); // 103.67
    expect(result[1].value.r2).toBeCloseTo(100 + 40 * (1.1 / 6), 2);  // 107.33
    expect(result[1].value.r3).toBeCloseTo(100 + 40 * (1.1 / 4), 2);  // 111
    expect(result[1].value.s1).toBeCloseTo(100 - 40 * (1.1 / 12), 2); // 96.33
  });

  it("should calculate demark pivot points", () => {
    // DeMark uses prev candle's high/low/close and current candle's open
    // Close < Open (of current day): X = High + 2 × Low + Close
    const candles1 = makeCandles([
      { open: 100, high: 120, low: 80, close: 100 }, // Previous day
      { open: 110, high: 125, low: 85, close: 110 }, // Current day, close(100) < open(110)
    ]);

    const result1 = pivotPoints(candles1, { method: "demark" });
    // prev close (100) < curr open (110), so:
    // X = High + 2 × Low + Close = 120 + 160 + 100 = 380
    // Pivot = X / 4 = 95
    expect(result1[1].value.pivot).toBe(95);

    // Close > Open (of current day): X = 2 × High + Low + Close
    const candles2 = makeCandles([
      { open: 100, high: 120, low: 80, close: 100 }, // Previous day
      { open: 90, high: 125, low: 85, close: 110 },  // Current day, close(100) > open(90)
    ]);

    const result2 = pivotPoints(candles2, { method: "demark" });
    // prev close (100) > curr open (90), so:
    // X = 2 × High + Low + Close = 240 + 80 + 100 = 420
    // Pivot = X / 4 = 105
    expect(result2[1].value.pivot).toBe(105);

    // DeMark only has R1/S1
    expect(result1[1].value.r2).toBeNull();
    expect(result1[1].value.s2).toBeNull();
  });

  it("should handle empty array", () => {
    expect(pivotPoints([])).toEqual([]);
  });

  it("should preserve time values in result", () => {
    const candles = makeCandles([
      { open: 100, high: 110, low: 90, close: 105 },
      { open: 105, high: 115, low: 95, close: 110 },
    ]);

    const result = pivotPoints(candles);
    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
  });

  it("should calculate support and resistance hierarchy correctly", () => {
    const candles = makeCandles([
      { open: 100, high: 120, low: 80, close: 100 },
      { open: 105, high: 125, low: 85, close: 110 },
    ]);

    const result = pivotPoints(candles);

    // Resistance should be: R3 > R2 > R1 > Pivot
    expect(result[1].value.r3).toBeGreaterThan(result[1].value.r2!);
    expect(result[1].value.r2).toBeGreaterThan(result[1].value.r1!);
    expect(result[1].value.r1).toBeGreaterThan(result[1].value.pivot!);

    // Support should be: S3 < S2 < S1 < Pivot
    expect(result[1].value.s3).toBeLessThan(result[1].value.s2!);
    expect(result[1].value.s2).toBeLessThan(result[1].value.s1!);
    expect(result[1].value.s1).toBeLessThan(result[1].value.pivot!);
  });
});
