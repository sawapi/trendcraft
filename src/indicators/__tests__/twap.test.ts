import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { twap } from "../volume/twap";

describe("twap", () => {
  const makeCandles = (
    data: { high: number; low: number; close: number; time?: number }[],
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: d.time ?? 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should return empty for empty input", () => {
    expect(twap([])).toEqual([]);
  });

  it("should compute TWAP correctly for a single bar", () => {
    const candles = makeCandles([{ high: 105, low: 95, close: 100 }]);
    const result = twap(candles);

    // TP = (105 + 95 + 100) / 3 = 100
    expect(result[0].value).toBe(100);
  });

  it("should compute cumulative TWAP within session", () => {
    // All in same day (same timestamp day)
    const baseTime = 1700000000000;
    const candles = makeCandles([
      { high: 102, low: 98, close: 100, time: baseTime },
      { high: 104, low: 100, close: 102, time: baseTime + 60000 },
      { high: 106, low: 102, close: 104, time: baseTime + 120000 },
    ]);
    const result = twap(candles);

    // TP1 = (102+98+100)/3 = 100
    // TP2 = (104+100+102)/3 = 102
    // TP3 = (106+102+104)/3 = 104
    expect(result[0].value).toBeCloseTo(100, 5);
    expect(result[1].value).toBeCloseTo(101, 5); // (100+102)/2
    expect(result[2].value).toBeCloseTo(102, 5); // (100+102+104)/3
  });

  it("should reset on new day", () => {
    const day1 = 1700000000000;
    const day2 = day1 + 86400000;
    const candles = makeCandles([
      { high: 102, low: 98, close: 100, time: day1 },
      { high: 106, low: 102, close: 104, time: day1 + 60000 },
      { high: 110, low: 106, close: 108, time: day2 }, // new day
    ]);
    const result = twap(candles);

    // Day 2 should reset: TP = (110+106+108)/3 = 108
    expect(result[2].value).toBeCloseTo(108, 5);
  });

  it("should reset every N candles when using numeric period", () => {
    const candles = makeCandles([
      { high: 102, low: 98, close: 100 },
      { high: 104, low: 100, close: 102 },
      { high: 106, low: 102, close: 104 }, // reset here (i=2, period=2)
      { high: 108, low: 104, close: 106 },
    ]);
    const result = twap(candles, { sessionResetPeriod: 2 });

    // After reset at i=2: TP = (106+102+104)/3 = 104
    expect(result[2].value).toBeCloseTo(104, 5);
  });

  it("should preserve timestamps", () => {
    const candles = makeCandles([
      { high: 102, low: 98, close: 100 },
      { high: 104, low: 100, close: 102 },
      { high: 106, low: 102, close: 104 },
    ]);
    const result = twap(candles);

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
