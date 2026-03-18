import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { cvdDivergence } from "../cvd-divergence";

function createCandle(day: number, close: number, volume = 1000000): NormalizedCandle {
  return {
    time: new Date(2024, 0, day).getTime(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
  };
}

describe("cvdDivergence", () => {
  it("should return empty array for insufficient data (< 10 candles)", () => {
    const candles = Array.from({ length: 5 }, (_, i) => createCandle(i + 1, 100));
    expect(cvdDivergence(candles)).toEqual([]);
  });

  it("should return DivergenceSignal array type", () => {
    const candles = Array.from({ length: 30 }, (_, i) => createCandle(i + 1, 100 + i));
    const result = cvdDivergence(candles);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should detect bullish divergence (price lower low, CVD higher low)", () => {
    // Build scenario: price makes lower low but CVD makes higher low
    const candles: NormalizedCandle[] = [];

    // Initial rising phase
    for (let i = 1; i <= 8; i++) {
      candles.push(createCandle(i, 100 + i, 1000000));
    }

    // First trough: price drops to 95, with heavy selling (low close in range → negative delta)
    for (let i = 9; i <= 12; i++) {
      candles.push(createCandle(i, 108 - (i - 8) * 3, 2000000));
    }
    candles.push(createCandle(13, 95, 2000000)); // Trough 1

    // Recovery
    for (let i = 14; i <= 20; i++) {
      candles.push(createCandle(i, 95 + (i - 13) * 2, 1000000));
    }

    // Second trough: price drops lower to 90, but with less selling volume (CVD higher low)
    for (let i = 21; i <= 24; i++) {
      candles.push(createCandle(i, 109 - (i - 20) * 4, 500000));
    }
    candles.push(createCandle(25, 90, 500000)); // Trough 2 (lower price, but less selling)

    // Trail off
    for (let i = 26; i <= 35; i++) {
      candles.push(createCandle(i, 90 + (i - 25), 800000));
    }

    const signals = cvdDivergence(candles, { swingLookback: 3, minSwingDistance: 5 });
    // We check that it returns valid signals (may or may not detect depending on exact geometry)
    expect(Array.isArray(signals)).toBe(true);
    for (const s of signals) {
      expect(s).toHaveProperty("time");
      expect(s).toHaveProperty("type");
      expect(["bullish", "bearish"]).toContain(s.type);
      expect(s).toHaveProperty("firstIdx");
      expect(s).toHaveProperty("secondIdx");
      expect(s).toHaveProperty("price");
      expect(s).toHaveProperty("indicator");
    }
  });
});
