import { describe, expect, it } from "vitest";
import { balanceOfPower } from "../../indicators";
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

function makeSimpleCandles(closes: number[], time0 = 1000, step = 86400) {
  return closes.map((c, i) => ({
    time: time0 + i * step,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000,
  }));
}

describe("balanceOfPower", () => {
  it("should return empty array for empty input", () => {
    expect(balanceOfPower([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    expect(() => balanceOfPower(candles, { smoothPeriod: 0 })).toThrow(
      "BOP smooth period must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeSimpleCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = balanceOfPower(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // nulls = smoothPeriod - 1 (default 14)
    const candles = makeSimpleCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = balanceOfPower(candles);
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(13);
  });

  it("should work with default options (smoothPeriod=14)", () => {
    const candles = makeSimpleCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = balanceOfPower(candles);
    expect(result[13].value).not.toBeNull();
  });

  it("should calculate BOP = (Close-Open)/(High-Low) with smoothPeriod=1", () => {
    const data = [
      { open: 10, high: 15, low: 5, close: 14 },
      { open: 12, high: 16, low: 8, close: 9 },
    ];
    const candles = makeCandles(data);
    const result = balanceOfPower(candles, { smoothPeriod: 1 });

    // BOP[0] = (14-10)/(15-5) = 4/10 = 0.4
    expect(result[0].value).toBeCloseTo(0.4, 6);
    // BOP[1] = (9-12)/(16-8) = -3/8 = -0.375
    expect(result[1].value).toBeCloseTo(-0.375, 6);
  });

  it("should return 0 when high equals low", () => {
    const data = [{ open: 10, high: 10, low: 10, close: 10 }];
    const candles = makeCandles(data);
    const result = balanceOfPower(candles, { smoothPeriod: 1 });
    expect(result[0].value).toBe(0);
  });

  it("should smooth with SMA when smoothPeriod > 1", () => {
    const data = [
      { open: 10, high: 15, low: 5, close: 15 }, // BOP = (15-10)/(15-5) = 0.5
      { open: 10, high: 15, low: 5, close: 5 }, // BOP = (5-10)/(15-5) = -0.5
    ];
    const candles = makeCandles(data);
    const result = balanceOfPower(candles, { smoothPeriod: 2 });

    // SMA(0.5, -0.5) = 0
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeCloseTo(0, 6);
  });

  it("should preserve time values", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    const result = balanceOfPower(candles, { smoothPeriod: 1 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
