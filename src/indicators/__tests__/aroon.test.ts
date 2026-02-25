import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { aroon } from "../momentum/aroon";

describe("aroon", () => {
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

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([{ high: 110, low: 90 }]);
    expect(() => aroon(candles, { period: 0 })).toThrow("Aroon period must be at least 1");
  });

  it("should return empty for empty input", () => {
    expect(aroon([])).toEqual([]);
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { high: 110, low: 90 },
      { high: 115, low: 95 },
      { high: 120, low: 100 },
    ]);
    const result = aroon(candles, { period: 5 });

    for (const r of result) {
      expect(r.value.up).toBeNull();
      expect(r.value.down).toBeNull();
      expect(r.value.oscillator).toBeNull();
    }
  });

  it("should calculate Aroon correctly with period=3", () => {
    // Build a sequence where the highest high and lowest low positions are known
    const candles = makeCandles([
      { high: 100, low: 90 }, // 0
      { high: 110, low: 85 }, // 1 - highest high in [0..3]
      { high: 105, low: 80 }, // 2 - lowest low in [0..3]
      { high: 108, low: 88 }, // 3 - first valid (period=3)
    ]);

    const result = aroon(candles, { period: 3 });

    // index 3: lookback over [0,1,2,3]
    // Highest high = 110 at index 1 → bars since = 3-1 = 2
    // Lowest low = 80 at index 2 → bars since = 3-2 = 1
    // Aroon Up = (3-2)/3 * 100 = 33.33
    // Aroon Down = (3-1)/3 * 100 = 66.67
    // Oscillator = 33.33 - 66.67 = -33.33
    expect(result[3].value.up).toBeCloseTo(33.33, 1);
    expect(result[3].value.down).toBeCloseTo(66.67, 1);
    expect(result[3].value.oscillator).toBeCloseTo(-33.33, 1);
  });

  it("should return 100 for Aroon Up when current bar is highest", () => {
    const candles = makeCandles([
      { high: 100, low: 90 },
      { high: 105, low: 85 },
      { high: 110, low: 80 },
      { high: 120, low: 95 }, // Current is highest high
    ]);

    const result = aroon(candles, { period: 3 });

    // Highest at current bar (index 3), bars since = 0
    // Aroon Up = (3-0)/3 * 100 = 100
    expect(result[3].value.up).toBe(100);
  });

  it("should return 100 for Aroon Down when current bar is lowest", () => {
    const candles = makeCandles([
      { high: 120, low: 100 },
      { high: 115, low: 95 },
      { high: 110, low: 90 },
      { high: 105, low: 70 }, // Current is lowest low
    ]);

    const result = aroon(candles, { period: 3 });

    // Lowest at current bar (index 3), bars since = 0
    // Aroon Down = (3-0)/3 * 100 = 100
    expect(result[3].value.down).toBe(100);
  });

  it("should have oscillator = up - down", () => {
    const candles = makeCandles(
      Array.from({ length: 30 }, (_, i) => ({
        high: 100 + Math.sin(i * 0.5) * 10,
        low: 90 + Math.sin(i * 0.5) * 10,
      })),
    );

    const result = aroon(candles, { period: 5 });
    const valid = result.filter((r) => r.value.up !== null);

    for (const r of valid) {
      expect(r.value.oscillator).toBeCloseTo(r.value.up! - r.value.down!, 10);
    }
  });

  it("should keep values in range [0, 100] for up and down", () => {
    const candles = makeCandles(
      Array.from({ length: 50 }, (_, i) => ({
        high: 100 + Math.random() * 20,
        low: 80 + Math.random() * 10,
      })),
    );

    const result = aroon(candles, { period: 10 });
    const valid = result.filter((r) => r.value.up !== null);

    for (const r of valid) {
      expect(r.value.up!).toBeGreaterThanOrEqual(0);
      expect(r.value.up!).toBeLessThanOrEqual(100);
      expect(r.value.down!).toBeGreaterThanOrEqual(0);
      expect(r.value.down!).toBeLessThanOrEqual(100);
    }
  });

  it("should keep oscillator in range [-100, 100]", () => {
    const candles = makeCandles(
      Array.from({ length: 50 }, (_, i) => ({
        high: 100 + Math.random() * 20,
        low: 80 + Math.random() * 10,
      })),
    );

    const result = aroon(candles, { period: 10 });
    const valid = result.filter((r) => r.value.oscillator !== null);

    for (const r of valid) {
      expect(r.value.oscillator!).toBeGreaterThanOrEqual(-100);
      expect(r.value.oscillator!).toBeLessThanOrEqual(100);
    }
  });

  it("should use default period of 25", () => {
    const candles = makeCandles(
      Array.from({ length: 30 }, (_, i) => ({
        high: 100 + i,
        low: 90 + i,
      })),
    );

    const result = aroon(candles);

    // With default period=25, indices < 25 should be null
    for (let i = 0; i < 25; i++) {
      expect(result[i].value.up).toBeNull();
    }
    // Index 25 should be valid
    expect(result[25].value.up).not.toBeNull();
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { high: 110, low: 90 },
      { high: 115, low: 95 },
      { high: 120, low: 100 },
    ]);
    const result = aroon(candles, { period: 2 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
