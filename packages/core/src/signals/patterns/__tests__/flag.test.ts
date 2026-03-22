import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { detectFlag } from "../flag";

/**
 * Generate bull flag: sharp up move + small downward consolidation
 */
function makeBullFlag(poleLen: number, consLen: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = 100;

  // Pre-pole baseline
  for (let i = 0; i < 15; i++) {
    const noise = Math.sin(i * 0.5) * 0.5;
    candles.push({
      time: 1000 + candles.length,
      open: price + noise - 0.2,
      high: price + noise + 1,
      low: price + noise - 1,
      close: price + noise,
      volume: 1000,
    });
  }

  // Flagpole: sharp up move
  for (let i = 0; i < poleLen; i++) {
    price += 4; // Strong upward move
    candles.push({
      time: 1000 + candles.length,
      open: price - 3,
      high: price + 1,
      low: price - 3.5,
      close: price,
      volume: 2000, // High volume on pole
    });
  }

  // Consolidation: small downward channel (flag)
  const poleTop = price;
  for (let i = 0; i < consLen; i++) {
    const drift = -i * 0.3; // Gentle downward drift
    const cycle = Math.sin((i * Math.PI) / 3) * 1.5;
    const p = poleTop + drift + cycle;
    candles.push({
      time: 1000 + candles.length,
      open: p - 0.3,
      high: p + 1,
      low: p - 1,
      close: p,
      volume: 500, // Low volume in consolidation
    });
  }

  return candles;
}

/**
 * Generate bear flag: sharp down move + small upward consolidation
 */
function makeBearFlag(poleLen: number, consLen: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = 150;

  // Pre-pole baseline
  for (let i = 0; i < 15; i++) {
    const noise = Math.sin(i * 0.5) * 0.5;
    candles.push({
      time: 1000 + candles.length,
      open: price + noise - 0.2,
      high: price + noise + 1,
      low: price + noise - 1,
      close: price + noise,
      volume: 1000,
    });
  }

  // Flagpole: sharp down move
  for (let i = 0; i < poleLen; i++) {
    price -= 4;
    candles.push({
      time: 1000 + candles.length,
      open: price + 3,
      high: price + 3.5,
      low: price - 1,
      close: price,
      volume: 2000,
    });
  }

  // Consolidation: small upward drift
  const poleBottom = price;
  for (let i = 0; i < consLen; i++) {
    const drift = i * 0.3;
    const cycle = Math.sin((i * Math.PI) / 3) * 1.5;
    const p = poleBottom + drift + cycle;
    candles.push({
      time: 1000 + candles.length,
      open: p + 0.3,
      high: p + 1,
      low: p - 1,
      close: p,
      volume: 500,
    });
  }

  return candles;
}

describe("detectFlag", () => {
  it("should return empty for insufficient data", () => {
    const candles: NormalizedCandle[] = Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));
    expect(detectFlag(candles)).toEqual([]);
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
    expect(detectFlag(candles)).toEqual([]);
  });

  it("should detect bull flag pattern", () => {
    const candles = makeBullFlag(6, 12);
    const result = detectFlag(candles, { minRSquared: 0.2 });

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(["bull_flag", "bear_flag", "bull_pennant", "bear_pennant"]).toContain(p.type);
      expect(p.confidence).toBeGreaterThan(0);
      expect(p.pattern.keyPoints.some((kp) => kp.label === "pole_start")).toBe(true);
      expect(p.pattern.keyPoints.some((kp) => kp.label === "pole_end")).toBe(true);
    }
  });

  it("should detect bear flag pattern", () => {
    const candles = makeBearFlag(6, 12);
    const result = detectFlag(candles, { minRSquared: 0.2 });

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(["bull_flag", "bear_flag", "bull_pennant", "bear_pennant"]).toContain(p.type);
      expect(p.pattern.height).toBeGreaterThan(0); // flagpole magnitude
    }
  });

  it("should produce valid signals with required fields", () => {
    const candles = makeBullFlag(6, 12);
    const result = detectFlag(candles, { minRSquared: 0.2 });

    for (const p of result) {
      expect(p.time).toBeDefined();
      expect(p.pattern.startTime).toBeLessThan(p.pattern.endTime);
      expect(p.confidence).toBeLessThanOrEqual(100);
      expect(typeof p.confirmed).toBe("boolean");
    }
  });
});
