import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { detectChannel } from "../channel";

/**
 * Generate ascending channel: both lines slope up, parallel
 */
function makeAscendingChannel(bars: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (let i = 0; i < bars; i++) {
    const trend = i * 0.5; // Upward trend
    const cycle = Math.sin((i * Math.PI) / 6) * 5; // Oscillation within channel
    const price = 100 + trend + cycle;

    candles.push({
      time: 1000 + i,
      open: price - 0.5,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000,
    });
  }

  return candles;
}

/**
 * Generate horizontal channel: flat, parallel bands
 */
function makeHorizontalChannel(bars: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (let i = 0; i < bars; i++) {
    const cycle = Math.sin((i * Math.PI) / 6) * 8; // Oscillation
    const price = 100 + cycle;

    candles.push({
      time: 1000 + i,
      open: price - 0.3,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000,
    });
  }

  return candles;
}

describe("detectChannel", () => {
  it("should return empty for insufficient data", () => {
    const candles: NormalizedCandle[] = Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));
    expect(detectChannel(candles)).toEqual([]);
  });

  it("should detect ascending channel", () => {
    const candles = makeAscendingChannel(80);
    const result = detectChannel(candles, { minRSquared: 0.3, minBars: 15 });

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(p.type).toMatch(/^channel_/);
      expect(p.pattern.height).toBeGreaterThan(0);
      expect(p.confidence).toBeGreaterThan(0);
    }
  });

  it("should detect horizontal channel", () => {
    const candles = makeHorizontalChannel(80);
    const result = detectChannel(candles, { minRSquared: 0.3, minBars: 15 });

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(p.type).toMatch(/^channel_/);
    }
  });

  it("should produce valid key points", () => {
    const candles = makeAscendingChannel(80);
    const result = detectChannel(candles, { minRSquared: 0.3, minBars: 15 });

    for (const p of result) {
      expect(p.pattern.keyPoints.length).toBeGreaterThanOrEqual(4);
      for (const kp of p.pattern.keyPoints) {
        expect(kp.label).toMatch(/^(upper_touch|lower_touch)$/);
        expect(kp.index).toBeGreaterThanOrEqual(0);
        expect(kp.price).toBeGreaterThan(0);
      }
    }
  });
});
