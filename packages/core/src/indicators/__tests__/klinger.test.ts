import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { klinger } from "../volume/klinger";

describe("klinger", () => {
  const makeCandles = (
    data: { high: number; low: number; close: number; volume: number }[],
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));

  it("should return empty for empty input", () => {
    expect(klinger([])).toEqual([]);
  });

  it("should throw if any period < 1", () => {
    const candles = makeCandles([{ high: 101, low: 99, close: 100, volume: 1000 }]);
    expect(() => klinger(candles, { shortPeriod: 0 })).toThrow();
    expect(() => klinger(candles, { longPeriod: 0 })).toThrow();
    expect(() => klinger(candles, { signalPeriod: 0 })).toThrow();
  });

  it("should return null kvo for insufficient data", () => {
    const data: { high: number; low: number; close: number; volume: number }[] = [];
    for (let i = 0; i < 10; i++) {
      data.push({ high: 102 + i, low: 98 + i, close: 100 + i, volume: 10000 });
    }
    const candles = makeCandles(data);
    const result = klinger(candles);

    // With default periods (34, 55, 13), early values are null
    expect(result[0].value.kvo).toBeNull();
  });

  it("should produce non-null values with enough data", () => {
    const data: { high: number; low: number; close: number; volume: number }[] = [];
    for (let i = 0; i < 100; i++) {
      data.push({
        high: 102 + i + Math.sin(i) * 3,
        low: 98 + i + Math.sin(i) * 3,
        close: 100 + i + Math.sin(i) * 3,
        volume: 10000 + i * 100,
      });
    }
    const candles = makeCandles(data);
    const result = klinger(candles);

    const last = result[result.length - 1].value;
    expect(last.kvo).not.toBeNull();
    expect(last.signal).not.toBeNull();
    expect(last.histogram).not.toBeNull();
  });

  it("should have histogram = kvo - signal", () => {
    const data: { high: number; low: number; close: number; volume: number }[] = [];
    for (let i = 0; i < 100; i++) {
      data.push({
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
        volume: 50000,
      });
    }
    const candles = makeCandles(data);
    const result = klinger(candles);

    for (const r of result) {
      const { kvo, signal, histogram } = r.value;
      if (kvo !== null && signal !== null && histogram !== null) {
        expect(histogram).toBeCloseTo(kvo - signal, 10);
      }
    }
  });

  it("should preserve timestamps", () => {
    const data: { high: number; low: number; close: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ high: 102 + i, low: 98 + i, close: 100 + i, volume: 10000 });
    }
    const candles = makeCandles(data);
    const result = klinger(candles);

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
