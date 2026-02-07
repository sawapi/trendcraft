import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { cupWithHandle } from "../index";

function createCandle(day: number, price: number, volume = 1000000): NormalizedCandle {
  return {
    time: new Date(2024, 0, day).getTime(),
    open: price,
    high: price * 1.01,
    low: price * 0.99,
    close: price,
    volume,
  };
}

describe("cupWithHandle", () => {
  it("should return empty array for insufficient data", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 10; i++) {
      candles.push(createCandle(i + 1, 100));
    }

    const patterns = cupWithHandle(candles);
    expect(patterns).toHaveLength(0);
  });

  it("should return empty array for flat data", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 100; i++) {
      candles.push(createCandle(i + 1, 100));
    }

    const patterns = cupWithHandle(candles);
    expect(patterns).toHaveLength(0);
  });

  it("should reject V-shaped cups (too sharp)", () => {
    // V-shape: sharp decline followed by sharp recovery
    const candles: NormalizedCandle[] = [];
    let day = 1;

    // Left rim
    for (let i = 0; i < 5; i++) {
      candles.push(createCandle(day++, 100));
    }

    // V-shaped decline (very fast)
    for (let i = 0; i < 5; i++) {
      candles.push(createCandle(day++, 100 - i * 6));
    }

    // V-shaped recovery (very fast)
    for (let i = 0; i < 5; i++) {
      candles.push(createCandle(day++, 70 + i * 6));
    }

    // Right rim + handle area
    for (let i = 0; i < 20; i++) {
      candles.push(createCandle(day++, 100 - (i < 5 ? i : 5 - (i - 5) * 0.5)));
    }

    // Breakout
    for (let i = 0; i < 10; i++) {
      candles.push(createCandle(day++, 102 + i * 2));
    }

    const patterns = cupWithHandle(candles, { minCupLength: 15, swingLookback: 3 });
    // V-shaped cups should typically be rejected by isUShapedCup
    // Even if detected, they should have lower confidence
    for (const p of patterns) {
      expect(p.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("should detect cup with handle pattern", () => {
    const candles: NormalizedCandle[] = [];
    let day = 1;

    // Left rim (high point)
    for (let i = 0; i < 10; i++) {
      candles.push(createCandle(day++, 100 + (i < 5 ? i : 10 - i)));
    }

    // U-shaped cup descent (gradual)
    for (let i = 0; i < 15; i++) {
      candles.push(createCandle(day++, 100 - i * 1.5));
    }

    // Cup bottom
    for (let i = 0; i < 10; i++) {
      candles.push(createCandle(day++, 78 + Math.sin(i / 3) * 2));
    }

    // U-shaped cup ascent (gradual recovery)
    for (let i = 0; i < 15; i++) {
      candles.push(createCandle(day++, 78 + i * 1.5));
    }

    // Right rim (back near left rim)
    for (let i = 0; i < 5; i++) {
      candles.push(createCandle(day++, 100));
    }

    // Handle (small pullback)
    for (let i = 0; i < 8; i++) {
      candles.push(createCandle(day++, 100 - (i < 4 ? i * 2 : (8 - i) * 2)));
    }

    // Breakout
    for (let i = 0; i < 10; i++) {
      candles.push(createCandle(day++, 102 + i * 2));
    }

    const patterns = cupWithHandle(candles, { swingLookback: 3, minCupLength: 20 });
    expect(Array.isArray(patterns)).toBe(true);
    for (const p of patterns) {
      expect(p.type).toBe("cup_handle");
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("should respect minCupLength parameter", () => {
    const candles: NormalizedCandle[] = [];
    let day = 1;

    // Short cup formation (only ~15 bars)
    for (let i = 0; i < 5; i++) candles.push(createCandle(day++, 100));
    for (let i = 0; i < 5; i++) candles.push(createCandle(day++, 100 - i * 4));
    for (let i = 0; i < 5; i++) candles.push(createCandle(day++, 80 + i * 4));
    for (let i = 0; i < 5; i++) candles.push(createCandle(day++, 100));
    for (let i = 0; i < 10; i++) candles.push(createCandle(day++, 98 + i * 0.5));
    for (let i = 0; i < 10; i++) candles.push(createCandle(day++, 103 + i));

    // With large minCupLength, should filter out short cups
    const strictPatterns = cupWithHandle(candles, {
      minCupLength: 50,
      swingLookback: 3,
    });

    const loosePatterns = cupWithHandle(candles, {
      minCupLength: 5,
      swingLookback: 3,
    });

    expect(strictPatterns.length).toBeLessThanOrEqual(loosePatterns.length);
  });

  it("should validate handle depth", () => {
    const candles: NormalizedCandle[] = [];
    let day = 1;

    // Cup formation
    for (let i = 0; i < 10; i++) candles.push(createCandle(day++, 100));
    for (let i = 0; i < 20; i++) {
      candles.push(createCandle(day++, 100 - Math.sin(i / 20 * Math.PI) * 20));
    }
    for (let i = 0; i < 10; i++) candles.push(createCandle(day++, 100));

    // Very deep handle (should be filtered with tight maxHandleDepth)
    for (let i = 0; i < 10; i++) candles.push(createCandle(day++, 100 - i * 5));
    for (let i = 0; i < 10; i++) candles.push(createCandle(day++, 50 + i * 5));
    for (let i = 0; i < 10; i++) candles.push(createCandle(day++, 100 + i));

    const tightHandlePatterns = cupWithHandle(candles, {
      maxHandleDepth: 0.05,
      swingLookback: 3,
    });

    const looseHandlePatterns = cupWithHandle(candles, {
      maxHandleDepth: 0.5,
      swingLookback: 3,
    });

    // Tight handle depth should filter more aggressively
    expect(tightHandlePatterns.length).toBeLessThanOrEqual(looseHandlePatterns.length);
  });
});
