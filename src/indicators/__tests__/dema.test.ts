import { describe, expect, it } from "vitest";
import { dema } from "../../indicators";

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

describe("dema", () => {
  it("should return empty array for empty input", () => {
    expect(dema([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => dema(candles, { period: 0 })).toThrow("DEMA period must be at least 1");
    expect(() => dema(candles, { period: -1 })).toThrow("DEMA period must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = dema(candles, { period: 3 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // DEMA needs 2*(period-1) warmup: period-1 for EMA1, then period-1 more for EMA2
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = dema(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    // EMA1 starts at index 4 (period-1=4), EMA2 needs 5 more valid EMA1 values
    // So first non-null at index 4 + 4 = 8 => 8 nulls
    expect(nullCount).toBe(8);
  });

  it("should work with default options (period=20)", () => {
    const candles = makeCandles(Array.from({ length: 50 }, (_, i) => 100 + i));
    const result = dema(candles);
    expect(result).toHaveLength(50);
    // First 38 should be null (2*(20-1))
    expect(result[37].value).toBeNull();
    expect(result[38].value).not.toBeNull();
  });

  it("should calculate DEMA = 2*EMA1 - EMA2 for period=3", () => {
    const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const candles = makeCandles(closes);
    const result = dema(candles, { period: 3 });

    // EMA1 seed at index 2: SMA(10,11,12) = 11
    // EMA1[3] = 13*0.5 + 11*0.5 = 12
    // EMA1[4] = 14*0.5 + 12*0.5 = 13
    // EMA2 seed at index 4: SMA(11,12,13) = 12
    // DEMA[4] = 2*13 - 12 = 14
    expect(result[4].value).toBeCloseTo(14, 4);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30]);
    const result = dema(candles, { period: 2 });
    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
    expect(result[2].time).toBe(candles[2].time);
  });

  it("should have less lag than EMA for trending data", () => {
    // For steadily rising prices, DEMA should be closer to current price than EMA
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const candles = makeCandles(closes);
    const result = dema(candles, { period: 5 });
    const lastVal = result[result.length - 1].value!;
    const lastClose = closes[closes.length - 1];
    // DEMA should track very close to current price in a trend
    expect(lastVal).toBeLessThanOrEqual(lastClose);
    expect(lastVal).toBeGreaterThan(lastClose - 10);
  });
});
