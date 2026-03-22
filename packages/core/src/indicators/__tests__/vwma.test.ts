import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { sma } from "../moving-average/sma";
import { vwma } from "../moving-average/vwma";

describe("vwma", () => {
  const makeCandles = (data: { close: number; volume: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.close,
      low: d.close,
      close: d.close,
      volume: d.volume,
    }));

  it("should calculate VWMA correctly with manual verification", () => {
    const candles = makeCandles([
      { close: 10, volume: 100 },
      { close: 20, volume: 200 },
      { close: 30, volume: 300 },
      { close: 40, volume: 100 },
      { close: 50, volume: 500 },
    ]);
    const result = vwma(candles, { period: 3 });

    expect(result).toHaveLength(5);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    // (10*100 + 20*200 + 30*300) / (100+200+300) = 14000/600 = 23.333...
    expect(result[2].value).toBeCloseTo(23.3333, 3);
    // (20*200 + 30*300 + 40*100) / (200+300+100) = 17000/600 = 28.333...
    expect(result[3].value).toBeCloseTo(28.3333, 3);
    // (30*300 + 40*100 + 50*500) / (300+100+500) = 38000/900 = 42.222...
    expect(result[4].value).toBeCloseTo(42.2222, 3);
  });

  it("should equal SMA when volume is uniform", () => {
    const closes = [10, 20, 30, 40, 50];
    const candles = makeCandles(closes.map((c) => ({ close: c, volume: 1000 })));

    const vwmaResult = vwma(candles, { period: 3 });
    const smaResult = sma(candles, { period: 3 });

    for (let i = 0; i < vwmaResult.length; i++) {
      if (vwmaResult[i].value === null) {
        expect(smaResult[i].value).toBeNull();
      } else {
        expect(vwmaResult[i].value).toBeCloseTo(smaResult[i].value as number, 10);
      }
    }
  });

  it("should return null for zero-volume window", () => {
    const candles = makeCandles([
      { close: 10, volume: 0 },
      { close: 20, volume: 0 },
      { close: 30, volume: 0 },
    ]);
    const result = vwma(candles, { period: 3 });

    expect(result[2].value).toBeNull();
  });

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([{ close: 100, volume: 1000 }]);
    expect(() => vwma(candles, { period: 0 })).toThrow("VWMA period must be at least 1");
  });

  it("should handle empty array", () => {
    expect(vwma([], { period: 5 })).toEqual([]);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { close: 10, volume: 100 },
      { close: 20, volume: 200 },
      { close: 30, volume: 300 },
    ]);
    const result = vwma(candles, { period: 2 });

    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
    expect(result[2].time).toBe(candles[2].time);
  });

  it("should handle period 1", () => {
    const candles = makeCandles([
      { close: 10, volume: 100 },
      { close: 20, volume: 200 },
    ]);
    const result = vwma(candles, { period: 1 });

    // VWMA with period 1 = price itself (price * volume / volume)
    expect(result[0].value).toBe(10);
    expect(result[1].value).toBe(20);
  });

  it("should return all null when data is shorter than period", () => {
    const candles = makeCandles([
      { close: 10, volume: 100 },
      { close: 20, volume: 200 },
    ]);
    const result = vwma(candles, { period: 5 });

    expect(result).toHaveLength(2);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
  });

  it("should throw on non-integer period", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 101, volume: 1000 },
      { close: 102, volume: 1000 },
    ]);
    expect(() => vwma(candles, { period: 5.5 })).toThrow("VWMA period must be an integer");
  });
});
