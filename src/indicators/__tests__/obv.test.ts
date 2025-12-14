import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { obv } from "../volume/obv";

describe("obv", () => {
  // Helper to create candles
  const makeCandles = (data: { close: number; volume: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.close + 5,
      low: d.close - 5,
      close: d.close,
      volume: d.volume,
    }));

  it("should start OBV at 0", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
    ]);

    const result = obv(candles);
    expect(result[0].value).toBe(0);
  });

  it("should add volume on price increase", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 2000 }, // Price up, add volume
    ]);

    const result = obv(candles);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(2000);
  });

  it("should subtract volume on price decrease", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 90, volume: 2000 }, // Price down, subtract volume
    ]);

    const result = obv(candles);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(-2000);
  });

  it("should keep OBV unchanged when price is flat", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 100, volume: 2000 }, // Price unchanged
    ]);

    const result = obv(candles);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(0);
  });

  it("should accumulate OBV correctly over multiple candles", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 1000 }, // +1000
      { close: 120, volume: 2000 }, // +2000 = 3000
      { close: 115, volume: 500 },  // -500 = 2500
      { close: 125, volume: 1500 }, // +1500 = 4000
    ]);

    const result = obv(candles);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(1000);
    expect(result[2].value).toBe(3000);
    expect(result[3].value).toBe(2500);
    expect(result[4].value).toBe(4000);
  });

  it("should handle empty candles", () => {
    expect(obv([])).toEqual([]);
  });

  it("should handle single candle", () => {
    const candles = makeCandles([{ close: 100, volume: 1000 }]);
    const result = obv(candles);

    expect(result.length).toBe(1);
    expect(result[0].value).toBe(0);
  });

  it("should handle large volume values", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000000000 },
      { close: 110, volume: 2000000000 },
    ]);

    const result = obv(candles);
    expect(result[1].value).toBe(2000000000);
  });

  it("should preserve time from candles", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 2000 },
    ]);

    const result = obv(candles);
    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
  });
});
