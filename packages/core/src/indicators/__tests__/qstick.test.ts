import { describe, expect, it } from "vitest";
import { qstick } from "../../indicators";
import type { NormalizedCandle } from "../../types";

function makeCandles(
  data: { open: number; close: number }[],
  time0 = 1000,
  step = 86400,
): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: time0 + i * step,
    open: d.open,
    high: Math.max(d.open, d.close) + 1,
    low: Math.min(d.open, d.close) - 1,
    close: d.close,
    volume: 1000,
  }));
}

function makeSimpleCandles(closes: number[], time0 = 1000, step = 86400) {
  return closes.map((c, i) => ({
    time: time0 + i * step,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000,
  }));
}

describe("qstick", () => {
  it("should return empty array for empty input", () => {
    expect(qstick([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    expect(() => qstick(candles, { period: 0 })).toThrow("QStick period must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeSimpleCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = qstick(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // nulls = period - 1 (default 14)
    const candles = makeSimpleCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = qstick(candles);
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(13);
  });

  it("should work with default options (period=14)", () => {
    const candles = makeSimpleCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = qstick(candles);
    expect(result[13].value).not.toBeNull();
  });

  it("should calculate QStick = SMA(Close - Open)", () => {
    const data = [
      { open: 10, close: 12 }, // diff = 2
      { open: 11, close: 14 }, // diff = 3
      { open: 13, close: 10 }, // diff = -3
    ];
    const candles = makeCandles(data);
    const result = qstick(candles, { period: 3 });

    // SMA(2, 3, -3) = 2/3
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeCloseTo(2 / 3, 6);
  });

  it("should be positive when closes consistently above opens", () => {
    const data = Array.from({ length: 20 }, () => ({ open: 100, close: 105 }));
    const candles = makeCandles(data);
    const result = qstick(candles, { period: 5 });
    const lastVal = result[result.length - 1].value;
    expect(lastVal).toBeCloseTo(5, 6);
  });

  it("should be negative when closes consistently below opens", () => {
    const data = Array.from({ length: 20 }, () => ({ open: 105, close: 100 }));
    const candles = makeCandles(data);
    const result = qstick(candles, { period: 5 });
    const lastVal = result[result.length - 1].value;
    expect(lastVal).toBeCloseTo(-5, 6);
  });

  it("should preserve time values", () => {
    const candles = makeSimpleCandles([10, 20, 30, 40, 50]);
    const result = qstick(candles, { period: 2 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
