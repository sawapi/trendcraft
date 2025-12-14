import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { volumeMa } from "../volume/volume-ma";

describe("volumeMa", () => {
  const makeCandles = (volumes: number[]): NormalizedCandle[] =>
    volumes.map((volume, i) => ({
      time: 1700000000000 + i * 86400000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([1000, 1100, 1200]);
    expect(() => volumeMa(candles, { period: 0 })).toThrow();
  });

  it("should return empty array for empty input", () => {
    expect(volumeMa([], { period: 3 })).toEqual([]);
  });

  it("should calculate SMA of volume correctly", () => {
    const candles = makeCandles([1000, 2000, 3000, 4000, 5000]);
    const result = volumeMa(candles, { period: 3, type: "sma" });

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBe(2000); // (1000 + 2000 + 3000) / 3
    expect(result[3].value).toBe(3000); // (2000 + 3000 + 4000) / 3
    expect(result[4].value).toBe(4000); // (3000 + 4000 + 5000) / 3
  });

  it("should calculate EMA of volume correctly", () => {
    const candles = makeCandles([1000, 2000, 3000, 4000, 5000]);
    const result = volumeMa(candles, { period: 3, type: "ema" });

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBe(2000); // First EMA = SMA

    // EMA should respond to increasing volume
    expect(result[3].value).toBeGreaterThan(2000);
    expect(result[4].value).toBeGreaterThan(result[3].value!);
  });

  it("should use SMA by default", () => {
    const candles = makeCandles([1000, 2000, 3000]);

    const resultDefault = volumeMa(candles, { period: 2 });
    const resultSma = volumeMa(candles, { period: 2, type: "sma" });

    expect(resultDefault).toEqual(resultSma);
  });
});
