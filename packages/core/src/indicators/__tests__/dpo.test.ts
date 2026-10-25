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

  it("centered: Price[i] - SMA[i + shift]", () => {
    // shift = floor(period/2) + 1; with period=4, shift=3, SMA available from index 3
    // DPO[0] = Price[0] - SMA[3]
    const closes = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
    const candles = makeCandles(closes);
    const result = dpo(candles, { period: 4, centered: true });

    // shift = floor(4/2) + 1 = 3
    // SMA[3] = (10+12+14+16)/4 = 13
    // DPO[0] = 10 - 13 = -3
    expect(result[0].value).toBeCloseTo(-3, 5);

    // SMA[4] = (12+14+16+18)/4 = 15
    // DPO[1] = 12 - 15 = -3
    expect(result[1].value).toBeCloseTo(-3, 5);
  });

  it("centered: null for the last bars, whose SMA is not available", () => {
    const closes = [10, 12, 14, 16, 18, 20, 22];
    const candles = makeCandles(closes);
    const result = dpo(candles, { period: 4, centered: true });

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

  describe("causal default (TA-Lib TA_DPO formula)", () => {
    const closes = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 25, 21, 24, 30, 27];
    const candles = makeCandles(closes);

    it("is Price[i - shift] - SMA[i]", () => {
      // period=4, shift=3: the first value is at i=3 (SMA[3] and Price[0]).
      const result = dpo(candles, { period: 4 });
      expect(result.slice(0, 3).map((r) => r.value)).toEqual([null, null, null]);
      expect(result[3].value).toBeCloseTo(10 - 13, 10);
      for (let i = 3; i < closes.length; i++) {
        const sma = (closes[i] + closes[i - 1] + closes[i - 2] + closes[i - 3]) / 4;
        expect(result[i].value).toBeCloseTo(closes[i - 3] - sma, 10);
      }
    });

    it("holds the centered values, shift bars later", () => {
      const causal = dpo(candles, { period: 4 });
      const centered = dpo(candles, { period: 4, centered: true });
      for (let i = 0; i + 3 < closes.length; i++) {
        expect(causal[i + 3].value).toBe(centered[i].value);
      }
    });

    it("never changes a bar's value when later bars arrive", () => {
      // The centered form read bars after i, so cutting the series at i
      // changed or erased bar i's value.
      const full = dpo(candles, { period: 4 });
      for (let k = 1; k <= closes.length; k++) {
        const prefix = dpo(candles.slice(0, k), { period: 4 });
        expect(prefix[k - 1].value).toBe(full[k - 1].value);
      }
    });
  });
});
