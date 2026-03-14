import { describe, expect, it } from "vitest";
import { zlema } from "../../indicators";

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

describe("zlema", () => {
  it("should return empty array for empty input", () => {
    expect(zlema([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => zlema(candles, { period: 0 })).toThrow("ZLEMA period must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = zlema(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = zlema(candles, { period: 5 });
    // lag = floor((5-1)/2) = 2, first valid at index period-1 = 4
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(4); // indices 0,1,2,3
  });

  it("should work with default options (period=20)", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = zlema(candles);
    expect(result).toHaveLength(30);
    expect(result[18].value).toBeNull();
    expect(result[19].value).not.toBeNull();
  });

  it("should apply zero-lag adjustment using lag=floor((period-1)/2)", () => {
    // period=3, lag=floor(2/2)=1
    // adjustedPrice[i] = price[i] + (price[i] - price[i-1])
    const closes = [10, 12, 14, 16, 18];
    const candles = makeCandles(closes);
    const result = zlema(candles, { period: 3 });

    // lag=1, adjusted prices from i=1:
    // adj[1] = 12+(12-10) = 14, adj[2] = 14+(14-12) = 16
    // Seed at i=2 (period-1): SMA of adj[1..2] = (14+16)/2 = 15
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeCloseTo(15, 4);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = zlema(candles, { period: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
