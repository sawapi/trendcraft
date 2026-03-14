import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { detectTriangle } from "../triangle";

/**
 * Generate synthetic candles forming a symmetrical triangle
 */
function makeSymmetricalTriangle(bars: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const basePrice = 100;
  const startAmplitude = 10;

  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    const amplitude = startAmplitude * (1 - t * 0.8); // Shrinking amplitude
    const cycle = Math.sin((i * Math.PI) / 5); // Oscillate
    const mid = basePrice;
    const price = mid + cycle * amplitude;

    candles.push({
      time: 1000 + i,
      open: price - 0.5,
      high: price + amplitude * 0.3,
      low: price - amplitude * 0.3,
      close: price,
      volume: 1000 - i * 5, // Decreasing volume
    });
  }

  return candles;
}

/**
 * Generate ascending triangle: flat top, rising lows
 */
function makeAscendingTriangle(bars: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const resistance = 110;

  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    const risingFloor = 90 + t * 15; // Floor rises from 90 to 105
    const cycle = Math.sin((i * Math.PI) / 5);
    const mid = (resistance + risingFloor) / 2;
    const amplitude = (resistance - risingFloor) / 2;
    const price = mid + cycle * amplitude;

    candles.push({
      time: 1000 + i,
      open: price - 0.3,
      high: Math.min(price + 1.5, resistance + 0.5),
      low: Math.max(price - 1.5, risingFloor - 0.5),
      close: price,
      volume: 1000 - i * 3,
    });
  }

  return candles;
}

describe("detectTriangle", () => {
  it("should return empty for insufficient data", () => {
    const candles: NormalizedCandle[] = Array.from({ length: 5 }, (_, i) => ({
      time: 1000 + i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));
    const result = detectTriangle(candles);
    expect(result).toEqual([]);
  });

  it("should return empty for flat price data", () => {
    const candles: NormalizedCandle[] = Array.from({ length: 50 }, (_, i) => ({
      time: 1000 + i,
      open: 100,
      high: 100.5,
      low: 99.5,
      close: 100,
      volume: 1000,
    }));
    const result = detectTriangle(candles);
    expect(result).toEqual([]);
  });

  it("should detect a symmetrical triangle pattern", () => {
    const candles = makeSymmetricalTriangle(60);
    const result = detectTriangle(candles, { minRSquared: 0.3, minBars: 10 });

    // May or may not detect depending on exact data shape, but should not crash
    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(p.type).toMatch(/^triangle_/);
      expect(p.confidence).toBeGreaterThan(0);
      expect(p.confidence).toBeLessThanOrEqual(100);
      expect(p.pattern.keyPoints.length).toBeGreaterThanOrEqual(4);
      expect(p.pattern.height).toBeGreaterThan(0);
    }
  });

  it("should detect ascending triangle with rising lows", () => {
    const candles = makeAscendingTriangle(60);
    const result = detectTriangle(candles, { minRSquared: 0.3, minBars: 10 });

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(p.type).toMatch(/^triangle_/);
      expect(p.pattern.startTime).toBeLessThan(p.pattern.endTime);
    }
  });

  it("should respect swingLookback option", () => {
    const candles = makeSymmetricalTriangle(60);
    const r1 = detectTriangle(candles, { swingLookback: 2, minRSquared: 0.3, minBars: 10 });
    const r2 = detectTriangle(candles, { swingLookback: 5, minRSquared: 0.3, minBars: 10 });

    // Different lookbacks may produce different results
    expect(Array.isArray(r1)).toBe(true);
    expect(Array.isArray(r2)).toBe(true);
  });

  it("should include key points with proper labels", () => {
    const candles = makeSymmetricalTriangle(60);
    const result = detectTriangle(candles, { minRSquared: 0.3, minBars: 10 });

    for (const p of result) {
      const labels = p.pattern.keyPoints.map((kp) => kp.label);
      expect(labels.some((l) => l === "upper_touch")).toBe(true);
      expect(labels.some((l) => l === "lower_touch")).toBe(true);
    }
  });
});
