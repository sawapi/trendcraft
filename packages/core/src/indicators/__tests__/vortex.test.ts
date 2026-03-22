import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { vortex } from "../trend/vortex";

describe("vortex", () => {
  const makeCandles = (data: { high: number; low: number; close: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100 }]);
    expect(() => vortex(candles, { period: 0 })).toThrow("Vortex period must be at least 1");
  });

  it("should return empty for empty input", () => {
    expect(vortex([])).toEqual([]);
  });

  it("should return null for first bar", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100 }]);
    const result = vortex(candles, { period: 1 });

    expect(result[0].value.viPlus).toBeNull();
    expect(result[0].value.viMinus).toBeNull();
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 112, low: 92, close: 105 },
      { high: 115, low: 95, close: 108 },
    ]);
    const result = vortex(candles, { period: 5 });

    for (const r of result) {
      expect(r.value.viPlus).toBeNull();
      expect(r.value.viMinus).toBeNull();
    }
  });

  it("should calculate VI+ and VI- correctly with period=2", () => {
    const candles = makeCandles([
      { high: 100, low: 90, close: 95 },
      { high: 105, low: 88, close: 102 },
      { high: 110, low: 92, close: 107 },
    ]);

    const result = vortex(candles, { period: 2 });

    // Bar 1: VM+ = |105 - 90| = 15, VM- = |88 - 100| = 12, TR = max(17, |105-95|, |88-95|) = 17
    // Bar 2: VM+ = |110 - 88| = 22, VM- = |92 - 105| = 13, TR = max(18, |110-102|, |92-102|) = 18

    // At index 2 (period=2), sum over bars 1 and 2:
    // sum VM+ = 15 + 22 = 37
    // sum VM- = 12 + 13 = 25
    // sum TR = 17 + 18 = 35
    // VI+ = 37/35 ≈ 1.057
    // VI- = 25/35 ≈ 0.714
    expect(result[2].value.viPlus).toBeCloseTo(37 / 35, 3);
    expect(result[2].value.viMinus).toBeCloseTo(25 / 35, 3);
  });

  it("should show VI+ > VI- in strong uptrend", () => {
    const candles = makeCandles(
      Array.from({ length: 20 }, (_, i) => ({
        high: 100 + i * 3,
        low: 90 + i * 3,
        close: 95 + i * 3,
      })),
    );

    const result = vortex(candles, { period: 5 });
    const valid = result.filter((r) => r.value.viPlus !== null);

    // In a strong uptrend, VI+ should exceed VI-
    const lateValues = valid.slice(-5);
    for (const r of lateValues) {
      expect(r.value.viPlus!).toBeGreaterThan(r.value.viMinus!);
    }
  });

  it("should show VI- > VI+ in strong downtrend", () => {
    const candles = makeCandles(
      Array.from({ length: 20 }, (_, i) => ({
        high: 200 - i * 3,
        low: 190 - i * 3,
        close: 195 - i * 3,
      })),
    );

    const result = vortex(candles, { period: 5 });
    const valid = result.filter((r) => r.value.viPlus !== null);

    const lateValues = valid.slice(-5);
    for (const r of lateValues) {
      expect(r.value.viMinus!).toBeGreaterThan(r.value.viPlus!);
    }
  });

  it("should produce positive VI values", () => {
    const candles = makeCandles(
      Array.from({ length: 30 }, (_, i) => ({
        high: 100 + Math.sin(i * 0.3) * 10 + 10,
        low: 100 + Math.sin(i * 0.3) * 10 - 10,
        close: 100 + Math.sin(i * 0.3) * 10,
      })),
    );

    const result = vortex(candles, { period: 7 });
    const valid = result.filter((r) => r.value.viPlus !== null);

    for (const r of valid) {
      expect(r.value.viPlus!).toBeGreaterThanOrEqual(0);
      expect(r.value.viMinus!).toBeGreaterThanOrEqual(0);
    }
  });

  it("should use default period of 14", () => {
    const candles = makeCandles(
      Array.from({ length: 20 }, (_, i) => ({
        high: 110 + i,
        low: 90 + i,
        close: 100 + i,
      })),
    );

    const result = vortex(candles);

    // First bar always null, then bars < period also null
    for (let i = 0; i < 14; i++) {
      expect(result[i].value.viPlus).toBeNull();
    }
    // Index 14 should be valid
    expect(result[14].value.viPlus).not.toBeNull();
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 115, low: 95, close: 105 },
      { high: 120, low: 100, close: 110 },
    ]);
    const result = vortex(candles, { period: 2 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
