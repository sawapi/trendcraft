import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { dpo } from "../momentum/dpo";

describe("dpo", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => dpo(candles, { period: 0 })).toThrow("DPO period must be at least 1");
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = dpo(candles, { period: 20 });
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should calculate DPO correctly", () => {
    // DPO = Price[i] - SMA[i + shift] where shift = floor(period/2) + 1
    // With period=4, shift=3, SMA available from index 3
    // DPO[0] = Price[0] - SMA[3]
    const closes = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
    const candles = makeCandles(closes);
    const result = dpo(candles, { period: 4 });

    // shift = floor(4/2) + 1 = 3
    // SMA[3] = (10+12+14+16)/4 = 13
    // DPO[0] = 10 - 13 = -3
    expect(result[0].value).toBeCloseTo(-3, 5);

    // SMA[4] = (12+14+16+18)/4 = 15
    // DPO[1] = 12 - 15 = -3
    expect(result[1].value).toBeCloseTo(-3, 5);
  });

  it("should return null for last bars where SMA is not available", () => {
    const closes = [10, 12, 14, 16, 18, 20, 22];
    const candles = makeCandles(closes);
    const result = dpo(candles, { period: 4 });

    // shift = 3, so last 3 bars should be null (no SMA available)
    // Actually: DPO[i] uses SMA[i+3]. Last SMA is at index 6.
    // DPO[3] uses SMA[6] which is available
    // DPO[4] uses SMA[7] which is out of bounds → null
    expect(result[result.length - 1].value).toBeNull();
    expect(result[result.length - 2].value).toBeNull();
    expect(result[result.length - 3].value).toBeNull();
  });

  it("should handle empty array", () => {
    expect(dpo([], { period: 5 })).toEqual([]);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
    const result = dpo(candles, { period: 4 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should return zero DPO for constant prices", () => {
    const candles = makeCandles([100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    const result = dpo(candles, { period: 4 });

    // All valid DPO values should be 0 since price == SMA
    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeCloseTo(0, 10);
      }
    }
  });
});
