import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { fractals } from "../price/fractals";

describe("fractals", () => {
  const makeCandles = (data: { high: number; low: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: (d.high + d.low) / 2,
      high: d.high,
      low: d.low,
      close: (d.high + d.low) / 2,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([{ high: 10, low: 5 }]);
    expect(() => fractals(candles, { period: 0 })).toThrow("Fractals period must be at least 1");
  });

  it("should detect up fractal (classic 5-bar pattern)", () => {
    // Bar 2 has highest high → up fractal
    const candles = makeCandles([
      { high: 10, low: 8 },
      { high: 11, low: 9 },
      { high: 15, low: 10 }, // Up fractal
      { high: 12, low: 9 },
      { high: 10, low: 8 },
    ]);

    const result = fractals(candles, { period: 2 });
    expect(result[2].value.upFractal).toBe(true);
    expect(result[2].value.upPrice).toBe(15);
  });

  it("should detect down fractal (classic 5-bar pattern)", () => {
    // Bar 2 has lowest low → down fractal
    const candles = makeCandles([
      { high: 10, low: 8 },
      { high: 11, low: 7 },
      { high: 12, low: 5 }, // Down fractal
      { high: 11, low: 7 },
      { high: 10, low: 8 },
    ]);

    const result = fractals(candles, { period: 2 });
    expect(result[2].value.downFractal).toBe(true);
    expect(result[2].value.downPrice).toBe(5);
  });

  it("should detect both up and down fractals simultaneously", () => {
    // Bar 2 has both highest high and lowest low
    const candles = makeCandles([
      { high: 10, low: 8 },
      { high: 11, low: 7 },
      { high: 15, low: 3 }, // Both
      { high: 12, low: 7 },
      { high: 10, low: 8 },
    ]);

    const result = fractals(candles, { period: 2 });
    expect(result[2].value.upFractal).toBe(true);
    expect(result[2].value.downFractal).toBe(true);
  });

  it("should not detect fractal at edges", () => {
    const candles = makeCandles([
      { high: 20, low: 1 }, // Highest high / lowest low but at edge
      { high: 10, low: 5 },
      { high: 11, low: 6 },
      { high: 10, low: 5 },
      { high: 20, low: 1 }, // At edge
    ]);

    const result = fractals(candles, { period: 2 });
    expect(result[0].value.upFractal).toBe(false);
    expect(result[0].value.downFractal).toBe(false);
    expect(result[4].value.upFractal).toBe(false);
    expect(result[4].value.downFractal).toBe(false);
  });

  it("should not detect fractal when neighbor has equal value", () => {
    const candles = makeCandles([
      { high: 10, low: 8 },
      { high: 15, low: 9 }, // Same high as center
      { high: 15, low: 10 }, // NOT a fractal (neighbor is equal)
      { high: 12, low: 9 },
      { high: 10, low: 8 },
    ]);

    const result = fractals(candles, { period: 2 });
    expect(result[2].value.upFractal).toBe(false);
  });

  it("should work with period=1 (3-bar pattern)", () => {
    const candles = makeCandles([
      { high: 10, low: 8 },
      { high: 15, low: 5 }, // Fractal with 1-bar lookback
      { high: 10, low: 8 },
    ]);

    const result = fractals(candles, { period: 1 });
    expect(result[1].value.upFractal).toBe(true);
    expect(result[1].value.downFractal).toBe(true);
  });

  it("should handle empty array", () => {
    expect(fractals([])).toEqual([]);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { high: 10, low: 5 },
      { high: 12, low: 6 },
      { high: 15, low: 4 },
      { high: 12, low: 6 },
      { high: 10, low: 5 },
    ]);
    const result = fractals(candles);

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
