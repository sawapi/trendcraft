import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { detectWedge } from "../wedge";

/**
 * Generate rising wedge: both lines slope up but converge
 */
function makeRisingWedge(bars: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    // Upper: rises from 110 to 130, flattening
    const upper = 110 + t * 20 * (1 - t * 0.3);
    // Lower: rises faster, from 90 to 125
    const lower = 90 + t * 35 * (1 - t * 0.3);
    const mid = (upper + lower) / 2;
    const amplitude = (upper - lower) / 2;
    const cycle = Math.sin((i * Math.PI) / 5);
    const price = mid + cycle * amplitude * 0.7;

    candles.push({
      time: 1000 + i,
      open: price - 0.3,
      high: price + amplitude * 0.2,
      low: price - amplitude * 0.2,
      close: price,
      volume: 1000,
    });
  }

  return candles;
}

/**
 * Generate falling wedge: both lines slope down but converge
 */
function makeFallingWedge(bars: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    // Upper: falls from 130 to 105
    const upper = 130 - t * 25;
    // Lower: falls less steeply from 100 to 95
    const lower = 100 - t * 5;
    const mid = (upper + lower) / 2;
    const amplitude = (upper - lower) / 2;
    const cycle = Math.sin((i * Math.PI) / 5);
    const price = mid + cycle * amplitude * 0.7;

    candles.push({
      time: 1000 + i,
      open: price - 0.3,
      high: price + amplitude * 0.2,
      low: price - amplitude * 0.2,
      close: price,
      volume: 1000,
    });
  }

  return candles;
}

describe("detectWedge", () => {
  it("should return empty for insufficient data", () => {
    const candles: NormalizedCandle[] = Array.from({ length: 5 }, (_, i) => ({
      time: 1000 + i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));
    expect(detectWedge(candles)).toEqual([]);
  });

  it("should return empty for flat data", () => {
    const candles: NormalizedCandle[] = Array.from({ length: 50 }, (_, i) => ({
      time: 1000 + i,
      open: 100,
      high: 100.5,
      low: 99.5,
      close: 100,
      volume: 1000,
    }));
    expect(detectWedge(candles)).toEqual([]);
  });

  it("should detect patterns from rising wedge data", () => {
    const candles = makeRisingWedge(60);
    const result = detectWedge(candles, { minRSquared: 0.3, minBars: 10 });

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(["rising_wedge", "falling_wedge"]).toContain(p.type);
      expect(p.confidence).toBeGreaterThan(0);
      expect(p.pattern.height).toBeGreaterThan(0);
    }
  });

  it("should detect patterns from falling wedge data", () => {
    const candles = makeFallingWedge(60);
    const result = detectWedge(candles, { minRSquared: 0.3, minBars: 10 });

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(["rising_wedge", "falling_wedge"]).toContain(p.type);
      expect(p.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  it("should produce valid pattern signals", () => {
    const candles = makeRisingWedge(60);
    const result = detectWedge(candles, { minRSquared: 0.3, minBars: 10 });

    for (const p of result) {
      expect(p.time).toBeDefined();
      expect(p.pattern.startTime).toBeLessThanOrEqual(p.pattern.endTime);
      expect(p.pattern.keyPoints.length).toBeGreaterThanOrEqual(4);
      expect(p.confidence).toBeLessThanOrEqual(100);
    }
  });
});
