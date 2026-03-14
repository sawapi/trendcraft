import { describe, expect, it } from "vitest";
import { cmo } from "../../indicators";

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

describe("cmo", () => {
  it("should return empty array for empty input", () => {
    expect(cmo([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => cmo(candles, { period: 0 })).toThrow("CMO period must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = cmo(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // First valid at index = period (needs period changes, starting from index 1)
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = cmo(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(5);
  });

  it("should work with default options (period=14)", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = cmo(candles);
    expect(result).toHaveLength(20);
    expect(result[13].value).toBeNull();
    expect(result[14].value).not.toBeNull();
  });

  it("should return +100 for all-up movement", () => {
    const closes = [100, 101, 102, 103, 104, 105];
    const candles = makeCandles(closes);
    const result = cmo(candles, { period: 3 });

    // All changes are positive: sumUp=3, sumDown=0
    // CMO = 100 * (3-0)/(3+0) = 100
    expect(result[3].value).toBeCloseTo(100, 4);
  });

  it("should return -100 for all-down movement", () => {
    const closes = [105, 104, 103, 102, 101, 100];
    const candles = makeCandles(closes);
    const result = cmo(candles, { period: 3 });

    // All changes are negative: sumUp=0, sumDown=3
    // CMO = 100 * (0-3)/(0+3) = -100
    expect(result[3].value).toBeCloseTo(-100, 4);
  });

  it("should return 0 for equal up and down movement", () => {
    // Changes: +2, -2, +2, -2
    const closes = [100, 102, 100, 102, 100];
    const candles = makeCandles(closes);
    const result = cmo(candles, { period: 4 });

    // sumUp=4, sumDown=4 => CMO = 100*(4-4)/(4+4) = 0
    expect(result[4].value).toBeCloseTo(0, 4);
  });

  it("should be bounded between -100 and +100", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const candles = makeCandles(closes);
    const result = cmo(candles, { period: 5 });
    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeGreaterThanOrEqual(-100);
        expect(r.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = cmo(candles, { period: 2 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
