import { describe, expect, it } from "vitest";
import { garmanKlass } from "../../indicators";
import type { NormalizedCandle } from "../../types";

function makeOHLCCandles(
  data: { open: number; high: number; low: number; close: number }[],
  time0 = 1000,
  step = 86400,
): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: time0 + i * step,
    open: d.open,
    high: d.high,
    low: d.low,
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

describe("garmanKlass", () => {
  it("should return empty array for empty input", () => {
    expect(garmanKlass([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    expect(() => garmanKlass(candles, { period: 0 })).toThrow(
      "Garman-Klass period must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeSimpleCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const result = garmanKlass(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    const candles = makeSimpleCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const result = garmanKlass(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(4); // period - 1
  });

  it("should work with default options (period=20, annualFactor=252)", () => {
    const candles = makeSimpleCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const result = garmanKlass(candles);
    expect(result).toHaveLength(25);
    expect(result[18].value).toBeNull();
    expect(result[19].value).not.toBeNull();
  });

  it("should calculate GK volatility using OHLC data", () => {
    // Single bar GK: 0.5*ln(H/L)^2 - (2*ln2-1)*ln(C/O)^2
    const data = [{ open: 100, high: 110, low: 90, close: 105 }];
    const candles = makeOHLCCandles(data);
    const result = garmanKlass(candles, { period: 1, annualFactor: 1 });

    const logHL = Math.log(110 / 90);
    const logCO = Math.log(105 / 100);
    const ln2 = Math.log(2);
    const gkVal = 0.5 * logHL * logHL - (2 * ln2 - 1) * logCO * logCO;
    const expected = Math.sqrt(gkVal) * 100;

    expect(result[0].value).toBeCloseTo(expected, 4);
  });

  it("should be higher for wider ranges", () => {
    const narrow = makeOHLCCandles(
      Array.from({ length: 5 }, () => ({ open: 100, high: 101, low: 99, close: 100 })),
    );
    const wide = makeOHLCCandles(
      Array.from({ length: 5 }, () => ({ open: 100, high: 120, low: 80, close: 100 })),
    );
    const narrowGK = garmanKlass(narrow, { period: 3 });
    const wideGK = garmanKlass(wide, { period: 3 });
    expect(wideGK[4].value!).toBeGreaterThan(narrowGK[4].value!);
  });

  it("should always return non-negative values", () => {
    const candles = makeSimpleCandles(Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i) * 5));
    const result = garmanKlass(candles, { period: 5 });
    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should preserve time values", () => {
    const candles = makeSimpleCandles([10, 20, 30, 40, 50]);
    const result = garmanKlass(candles, { period: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
