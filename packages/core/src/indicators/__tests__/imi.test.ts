import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { imi } from "../momentum/imi";

describe("imi", () => {
  const makeCandles = (data: { open: number; close: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.open,
      high: Math.max(d.open, d.close) + 1,
      low: Math.min(d.open, d.close) - 1,
      close: d.close,
      volume: 1000,
    }));

  it("should return empty for empty input", () => {
    expect(imi([])).toEqual([]);
  });

  it("should throw if period < 1", () => {
    const candles = makeCandles([{ open: 100, close: 101 }]);
    expect(() => imi(candles, { period: 0 })).toThrow();
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { open: 100, close: 101 },
      { open: 100, close: 102 },
    ]);
    const result = imi(candles, { period: 14 });
    expect(result).toHaveLength(2);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should return 100 for all bullish candles", () => {
    // All candles: close > open
    const data: { open: number; close: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ open: 100, close: 105 });
    }
    const candles = makeCandles(data);
    const result = imi(candles, { period: 14 });

    // After warmup, IMI should be 100 (all gains, no losses)
    const lastValue = result[result.length - 1].value;
    expect(lastValue).toBe(100);
  });

  it("should return 0 for all bearish candles", () => {
    const data: { open: number; close: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ open: 105, close: 100 });
    }
    const candles = makeCandles(data);
    const result = imi(candles, { period: 14 });

    const lastValue = result[result.length - 1].value;
    expect(lastValue).toBe(0);
  });

  it("should return 50 for equal gains and losses", () => {
    // Alternating bullish and bearish candles with equal magnitude
    const data: { open: number; close: number }[] = [];
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        data.push({ open: 100, close: 105 }); // gain = 5
      } else {
        data.push({ open: 105, close: 100 }); // loss = 5
      }
    }
    const candles = makeCandles(data);
    const result = imi(candles, { period: 14 });

    const lastValue = result[result.length - 1].value;
    expect(lastValue).toBe(50);
  });

  it("should return 50 when open equals close for all bars", () => {
    const data: { open: number; close: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ open: 100, close: 100 }); // doji
    }
    const candles = makeCandles(data);
    const result = imi(candles, { period: 14 });

    // gains=0, losses=0, total=0 → return 50
    const lastValue = result[result.length - 1].value;
    expect(lastValue).toBe(50);
  });

  it("should produce values between 0 and 100", () => {
    const data: { open: number; close: number }[] = [];
    for (let i = 0; i < 30; i++) {
      data.push({
        open: 100 + Math.sin(i) * 5,
        close: 100 + Math.cos(i) * 5,
      });
    }
    const candles = makeCandles(data);
    const result = imi(candles, { period: 14 });

    result.forEach((r) => {
      if (r.value !== null) {
        expect(r.value).toBeGreaterThanOrEqual(0);
        expect(r.value).toBeLessThanOrEqual(100);
      }
    });
  });

  it("should preserve timestamps", () => {
    const data: { open: number; close: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ open: 100, close: 101 });
    }
    const candles = makeCandles(data);
    const result = imi(candles, { period: 14 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should calculate correctly by hand for period=3", () => {
    // Bar 0: open=100, close=103 → gain=3, loss=0
    // Bar 1: open=102, close=100 → gain=0, loss=2
    // Bar 2: open=101, close=104 → gain=3, loss=0
    // Sum gains = 3+0+3 = 6, sum losses = 0+2+0 = 2
    // IMI = 100 * 6 / (6+2) = 75
    const candles = makeCandles([
      { open: 100, close: 103 },
      { open: 102, close: 100 },
      { open: 101, close: 104 },
    ]);
    const result = imi(candles, { period: 3 });

    expect(result[2].value).toBe(75);
  });
});
