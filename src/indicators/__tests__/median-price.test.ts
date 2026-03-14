import { describe, expect, it } from "vitest";
import { medianPrice, typicalPrice, weightedClose } from "../../indicators";
import type { NormalizedCandle } from "../../types";

function makeCandles(
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

describe("medianPrice", () => {
  it("should return empty array for empty input", () => {
    expect(medianPrice([])).toEqual([]);
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles([
      { open: 10, high: 15, low: 5, close: 12 },
      { open: 11, high: 16, low: 6, close: 13 },
    ]);
    const result = medianPrice(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have no null values (no warmup needed)", () => {
    const candles = makeCandles([{ open: 10, high: 15, low: 5, close: 12 }]);
    const result = medianPrice(candles);
    expect(result[0].value).not.toBeNull();
  });

  it("should calculate (High + Low) / 2", () => {
    const candles = makeCandles([
      { open: 10, high: 20, low: 8, close: 15 },
      { open: 11, high: 25, low: 5, close: 13 },
    ]);
    const result = medianPrice(candles);
    expect(result[0].value).toBe((20 + 8) / 2); // 14
    expect(result[1].value).toBe((25 + 5) / 2); // 15
  });

  it("should preserve time values", () => {
    const candles = makeCandles([{ open: 10, high: 15, low: 5, close: 12 }]);
    const result = medianPrice(candles);
    expect(result[0].time).toBe(candles[0].time);
  });
});

describe("typicalPrice", () => {
  it("should return empty array for empty input", () => {
    expect(typicalPrice([])).toEqual([]);
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles([
      { open: 10, high: 15, low: 5, close: 12 },
      { open: 11, high: 16, low: 6, close: 13 },
    ]);
    const result = typicalPrice(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have no null values", () => {
    const candles = makeCandles([{ open: 10, high: 15, low: 5, close: 12 }]);
    const result = typicalPrice(candles);
    expect(result[0].value).not.toBeNull();
  });

  it("should calculate (High + Low + Close) / 3", () => {
    const candles = makeCandles([
      { open: 10, high: 20, low: 8, close: 14 },
      { open: 11, high: 25, low: 5, close: 12 },
    ]);
    const result = typicalPrice(candles);
    expect(result[0].value).toBe((20 + 8 + 14) / 3); // 14
    expect(result[1].value).toBe((25 + 5 + 12) / 3); // 14
  });

  it("should preserve time values", () => {
    const candles = makeCandles([{ open: 10, high: 15, low: 5, close: 12 }]);
    const result = typicalPrice(candles);
    expect(result[0].time).toBe(candles[0].time);
  });
});

describe("weightedClose", () => {
  it("should return empty array for empty input", () => {
    expect(weightedClose([])).toEqual([]);
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles([
      { open: 10, high: 15, low: 5, close: 12 },
      { open: 11, high: 16, low: 6, close: 13 },
    ]);
    const result = weightedClose(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have no null values", () => {
    const candles = makeCandles([{ open: 10, high: 15, low: 5, close: 12 }]);
    const result = weightedClose(candles);
    expect(result[0].value).not.toBeNull();
  });

  it("should calculate (High + Low + 2*Close) / 4", () => {
    const candles = makeCandles([
      { open: 10, high: 20, low: 8, close: 14 },
      { open: 11, high: 25, low: 5, close: 10 },
    ]);
    const result = weightedClose(candles);
    expect(result[0].value).toBe((20 + 8 + 14 * 2) / 4); // 14
    expect(result[1].value).toBe((25 + 5 + 10 * 2) / 4); // 12.5
  });

  it("should weight close more heavily than median price", () => {
    // When close > median, weighted close should be > median price
    const candles = makeCandles([
      { open: 10, high: 20, low: 10, close: 20 }, // median=15, weighted=(20+10+40)/4=17.5
    ]);
    const mp = medianPrice(candles);
    const wc = weightedClose(candles);
    expect(wc[0].value).toBeGreaterThan(mp[0].value);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([{ open: 10, high: 15, low: 5, close: 12 }]);
    const result = weightedClose(candles);
    expect(result[0].time).toBe(candles[0].time);
  });
});
