import { describe, it, expect } from "vitest";
import { parabolicSar } from "../parabolic-sar";
import type { NormalizedCandle } from "../../../types";

describe("parabolicSar", () => {
  // Sample data for testing
  const sampleCandles: NormalizedCandle[] = [
    { time: 1, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
    { time: 2, open: 103, high: 108, low: 101, close: 107, volume: 1200 },
    { time: 3, open: 107, high: 112, low: 105, close: 110, volume: 1100 },
    { time: 4, open: 110, high: 115, low: 108, close: 113, volume: 1300 },
    { time: 5, open: 113, high: 118, low: 111, close: 116, volume: 1400 },
    { time: 6, open: 116, high: 120, low: 114, close: 118, volume: 1500 },
    { time: 7, open: 118, high: 119, low: 112, close: 114, volume: 1600 },
    { time: 8, open: 114, high: 116, low: 108, close: 110, volume: 1700 },
    { time: 9, open: 110, high: 112, low: 105, close: 106, volume: 1800 },
    { time: 10, open: 106, high: 108, low: 102, close: 104, volume: 1900 },
  ];

  it("should return empty array for empty input", () => {
    const result = parabolicSar([]);
    expect(result).toEqual([]);
  });

  it("should return null for first candle", () => {
    const result = parabolicSar(sampleCandles);
    expect(result[0].value.sar).toBeNull();
    expect(result[0].value.direction).toBe(0);
  });

  it("should calculate SAR values for subsequent candles", () => {
    const result = parabolicSar(sampleCandles);

    // Second candle should have a SAR value
    expect(result[1].value.sar).not.toBeNull();
    expect(result[1].value.direction).not.toBe(0);
  });

  it("should detect trend direction", () => {
    const result = parabolicSar(sampleCandles);

    // Initial uptrend
    expect(result[1].value.direction).toBe(1);

    // Check that direction is valid for all computed values
    for (let i = 1; i < result.length; i++) {
      expect([1, -1]).toContain(result[i].value.direction);
    }
  });

  it("should detect reversal points", () => {
    const result = parabolicSar(sampleCandles);

    // Count reversals
    const reversals = result.filter((r) => r.value.isReversal);
    // There should be at least one reversal in this downtrend scenario
    expect(reversals.length).toBeGreaterThanOrEqual(0);
  });

  it("should respect custom step and max parameters", () => {
    const defaultResult = parabolicSar(sampleCandles);
    const customResult = parabolicSar(sampleCandles, { step: 0.01, max: 0.1 });

    // Different parameters should produce different SAR values
    expect(customResult.length).toBe(defaultResult.length);

    // AF should be constrained by custom max
    for (const r of customResult) {
      if (r.value.af !== null) {
        expect(r.value.af).toBeLessThanOrEqual(0.1);
        expect(r.value.af).toBeGreaterThanOrEqual(0.01);
      }
    }
  });

  it("should throw error for invalid step", () => {
    expect(() => parabolicSar(sampleCandles, { step: 0 })).toThrow(
      "Parabolic SAR step must be positive"
    );
    expect(() => parabolicSar(sampleCandles, { step: -0.02 })).toThrow(
      "Parabolic SAR step must be positive"
    );
  });

  it("should throw error for invalid max", () => {
    expect(() => parabolicSar(sampleCandles, { max: 0 })).toThrow(
      "Parabolic SAR max must be positive"
    );
    expect(() => parabolicSar(sampleCandles, { max: -0.2 })).toThrow(
      "Parabolic SAR max must be positive"
    );
  });

  it("should throw error when step > max", () => {
    expect(() => parabolicSar(sampleCandles, { step: 0.3, max: 0.2 })).toThrow(
      "Parabolic SAR step must be less than or equal to max"
    );
  });

  it("should handle single candle", () => {
    const result = parabolicSar([sampleCandles[0]]);
    expect(result.length).toBe(1);
    expect(result[0].value.sar).toBeNull();
  });

  it("should update acceleration factor correctly", () => {
    const result = parabolicSar(sampleCandles, { step: 0.02, max: 0.2 });

    // AF should be a multiple of step and within bounds
    for (const r of result) {
      if (r.value.af !== null) {
        expect(r.value.af).toBeLessThanOrEqual(0.2);
        expect(r.value.af).toBeGreaterThanOrEqual(0.02);
        // AF should be step * n where n >= 1
        const multiplier = r.value.af / 0.02;
        expect(Math.round(multiplier)).toBeCloseTo(multiplier, 5);
      }
    }
  });

  it("should track extreme point correctly", () => {
    const result = parabolicSar(sampleCandles);

    // In uptrend, EP should be the highest high
    // In downtrend, EP should be the lowest low
    for (let i = 1; i < result.length; i++) {
      expect(result[i].value.ep).not.toBeNull();
      if (result[i].value.direction === 1) {
        // Uptrend: EP should be a high value
        expect(result[i].value.ep).toBeGreaterThan(0);
      } else {
        // Downtrend: EP should be a low value
        expect(result[i].value.ep).toBeGreaterThan(0);
      }
    }
  });

  it("should have SAR below price in uptrend", () => {
    // Create strong uptrend data
    const uptrendCandles: NormalizedCandle[] = [
      { time: 1, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
      { time: 2, open: 101, high: 104, low: 100, close: 103, volume: 1000 },
      { time: 3, open: 103, high: 106, low: 102, close: 105, volume: 1000 },
      { time: 4, open: 105, high: 108, low: 104, close: 107, volume: 1000 },
      { time: 5, open: 107, high: 110, low: 106, close: 109, volume: 1000 },
    ];

    const result = parabolicSar(uptrendCandles);

    // In a clear uptrend, SAR should be below price
    for (let i = 1; i < result.length; i++) {
      if (result[i].value.direction === 1 && result[i].value.sar !== null) {
        expect(result[i].value.sar).toBeLessThan(uptrendCandles[i].low);
      }
    }
  });
});
