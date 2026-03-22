import { describe, expect, it } from "vitest";
import { coppockCurve } from "../../indicators";

function makeCandles(closes: number[], time0 = 1000, step = 86400) {
  return closes.map((c, i) => ({
    time: time0 + i * step,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000 + i * 100,
  }));
}

describe("coppockCurve", () => {
  it("should return empty array for empty input", () => {
    expect(coppockCurve([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => coppockCurve(candles, { wmaPeriod: 0 })).toThrow(
      "Coppock Curve periods must be at least 1",
    );
    expect(() => coppockCurve(candles, { longRocPeriod: 0 })).toThrow(
      "Coppock Curve periods must be at least 1",
    );
    expect(() => coppockCurve(candles, { shortRocPeriod: 0 })).toThrow(
      "Coppock Curve periods must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = coppockCurve(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have null values during warmup", () => {
    // Default: maxRocPeriod=14, wmaPeriod=10 => nulls = 14 + 10 - 1 = 23
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = coppockCurve(candles);
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(23);
  });

  it("should work with default options", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = coppockCurve(candles);
    expect(result[23].value).not.toBeNull();
  });

  it("should calculate correctly with small periods", () => {
    // wmaPeriod=2, longRocPeriod=3, shortRocPeriod=2
    const closes = [100, 110, 120, 130, 140, 150, 160];
    const candles = makeCandles(closes);
    const result = coppockCurve(candles, {
      wmaPeriod: 2,
      longRocPeriod: 3,
      shortRocPeriod: 2,
    });

    // maxRocPeriod=3, first combinedRoc at index 3
    // At i=3: longRoc = (130-100)/100*100=30, shortRoc = (130-110)/110*100 ≈ 18.18
    // combinedRoc[3] = 30 + 18.18 = 48.18
    // At i=4: longRoc = (140-110)/110*100 ≈ 27.27, shortRoc = (140-120)/120*100 ≈ 16.67
    // combinedRoc[4] = 27.27 + 16.67 = 43.94
    // WMA(2) at i=4: (1*48.18 + 2*43.94) / 3 = (48.18 + 87.88) / 3 ≈ 45.35
    expect(result[3].value).toBeNull(); // need wmaPeriod=2 valid combinedRoc values
    expect(result[4].value).not.toBeNull();
    expect(result[4].value!).toBeCloseTo(45.35, 0);
  });

  it("should be positive for consistently rising prices", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i * 5));
    const result = coppockCurve(candles);
    const lastVal = result[result.length - 1].value;
    expect(lastVal).not.toBeNull();
    expect(lastVal!).toBeGreaterThan(0);
  });

  it("should preserve time values", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = coppockCurve(candles, {
      wmaPeriod: 2,
      longRocPeriod: 2,
      shortRocPeriod: 1,
    });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
