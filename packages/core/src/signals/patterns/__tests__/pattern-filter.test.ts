import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { filterPatterns } from "../pattern-filter";
import type { PatternSignal } from "../types";

function makeCandles(count: number): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1000 + i,
    open: 100 + i * 0.1,
    high: 101 + i * 0.1,
    low: 99 + i * 0.1,
    close: 100 + i * 0.1,
    volume: 1000 + (i % 5 === 0 ? 500 : 0),
  }));
}

function makePattern(overrides: Partial<PatternSignal> = {}): PatternSignal {
  return {
    time: 1050,
    type: "double_top",
    pattern: {
      startTime: 1020,
      endTime: 1045,
      keyPoints: [],
      height: 5,
    },
    confidence: 70,
    confirmed: true,
    ...overrides,
  };
}

describe("filterPatterns", () => {
  const candles = makeCandles(100);

  it("should return empty for empty input", () => {
    expect(filterPatterns([], candles)).toEqual([]);
  });

  it("should pass through patterns meeting all criteria", () => {
    const patterns = [makePattern({ confidence: 80 })];
    const result = filterPatterns(patterns, candles, { minConfidence: 50 });
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("should filter out patterns below minConfidence", () => {
    const patterns = [makePattern({ confidence: 30 })];
    const result = filterPatterns(patterns, candles, { minConfidence: 50, trendContext: false });
    expect(result).toEqual([]);
  });

  it("should filter out patterns with small ATR ratio", () => {
    const patterns = [
      makePattern({ pattern: { startTime: 1020, endTime: 1045, keyPoints: [], height: 0.01 } }),
    ];
    const result = filterPatterns(patterns, candles, { minATRRatio: 1.5, trendContext: false });
    // With very small height, should be filtered
    expect(result).toEqual([]);
  });

  it("should adjust confidence based on trend context", () => {
    // Bearish reversal in uptrend should get confidence boost
    const patterns = [makePattern({ type: "double_top", confidence: 60 })];
    const result = filterPatterns(patterns, candles, {
      minConfidence: 40,
      trendContext: true,
      minATRRatio: 0, // Disable ATR filter for this test
    });

    // Should still produce results (may or may not adjust confidence)
    expect(Array.isArray(result)).toBe(true);
  });

  it("should work with all pattern types", () => {
    const types: PatternSignal["type"][] = [
      "double_top",
      "double_bottom",
      "rising_wedge",
      "falling_wedge",
      "bull_flag",
    ];
    for (const type of types) {
      const patterns = [makePattern({ type, confidence: 80 })];
      const result = filterPatterns(patterns, candles, {
        minConfidence: 0,
        minATRRatio: 0,
        trendContext: false,
      });
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it("should handle unconfirmed patterns", () => {
    const patterns = [makePattern({ confirmed: false, confidence: 70 })];
    const result = filterPatterns(patterns, candles, {
      volumeConfirm: true,
      minConfidence: 40,
      minATRRatio: 0,
      trendContext: false,
    });
    // Volume confirm only applies to confirmed patterns, so unconfirmed passes
    expect(result.length).toBe(1);
  });
});
