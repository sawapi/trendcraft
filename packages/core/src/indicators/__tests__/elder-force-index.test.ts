import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { elderForceIndex } from "../volume/elder-force-index";

describe("elderForceIndex", () => {
  const makeCandles = (data: { close: number; volume: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.close + 1,
      low: d.close - 1,
      close: d.close,
      volume: d.volume,
    }));

  it("should return empty for empty input", () => {
    expect(elderForceIndex([])).toEqual([]);
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 101, volume: 1200 },
    ]);
    const result = elderForceIndex(candles, { period: 13 });
    // With period=13, first 12 values should be null
    expect(result).toHaveLength(2);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should throw if period < 1", () => {
    const candles = makeCandles([{ close: 100, volume: 1000 }]);
    expect(() => elderForceIndex(candles, { period: 0 })).toThrow();
  });

  it("should produce non-null values with enough data", () => {
    const data: { close: number; volume: number }[] = [];
    for (let i = 0; i < 30; i++) {
      data.push({ close: 100 + i * 0.5, volume: 1000 + i * 100 });
    }
    const candles = makeCandles(data);
    const result = elderForceIndex(candles, { period: 13 });

    expect(result).toHaveLength(30);
    // Last value should be non-null
    expect(result[result.length - 1].value).not.toBeNull();

    // In a rising market, force index should be positive
    expect(result[result.length - 1].value!).toBeGreaterThan(0);
  });

  it("should preserve timestamps", () => {
    const data: { close: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ close: 100 + i, volume: 1000 });
    }
    const candles = makeCandles(data);
    const result = elderForceIndex(candles, { period: 13 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should handle zero volume", () => {
    const data: { close: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ close: 100 + i, volume: i === 5 ? 0 : 1000 });
    }
    const candles = makeCandles(data);
    const result = elderForceIndex(candles, { period: 13 });
    // Should not crash
    expect(result).toHaveLength(20);
  });
});
