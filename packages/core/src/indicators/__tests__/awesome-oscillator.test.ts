import { describe, expect, it } from "vitest";
import { awesomeOscillator } from "../../indicators";
import type { NormalizedCandle } from "../../types";

function makeCandles(
  data: { high: number; low: number }[],
  time0 = 1000,
  step = 86400,
): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: time0 + i * step,
    open: (d.high + d.low) / 2,
    high: d.high,
    low: d.low,
    close: (d.high + d.low) / 2,
    volume: 1000 + i * 100,
  }));
}

function makeSimpleCandles(closes: number[], time0 = 1000, step = 86400) {
  return closes.map((c, i) => ({
    time: time0 + i * step,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000 + i * 100,
  }));
}

describe("awesomeOscillator", () => {
  it("should return empty array for empty input", () => {
    expect(awesomeOscillator([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    expect(() => awesomeOscillator(candles, { fastPeriod: 0 })).toThrow(
      "Awesome Oscillator periods must be at least 1",
    );
  });

  it("should throw when fast >= slow", () => {
    const candles = makeSimpleCandles([10, 20, 30]);
    expect(() => awesomeOscillator(candles, { fastPeriod: 10, slowPeriod: 10 })).toThrow(
      "Fast period must be less than slow period",
    );
    expect(() => awesomeOscillator(candles, { fastPeriod: 15, slowPeriod: 10 })).toThrow(
      "Fast period must be less than slow period",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeSimpleCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = awesomeOscillator(candles, { fastPeriod: 3, slowPeriod: 10 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // nulls = slowPeriod - 1
    const candles = makeSimpleCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = awesomeOscillator(candles, { fastPeriod: 3, slowPeriod: 10 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(9);
  });

  it("should work with default options (fast=5, slow=34)", () => {
    const candles = makeSimpleCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = awesomeOscillator(candles);
    expect(result).toHaveLength(40);
    expect(result[32].value).toBeNull();
    expect(result[33].value).not.toBeNull();
  });

  it("should calculate AO = SMA(median,fast) - SMA(median,slow)", () => {
    // fast=2, slow=3, median = (high+low)/2
    // All candles have high=c+1, low=c-1, so median = c
    const closes = [10, 20, 30, 40];
    const candles = makeSimpleCandles(closes);
    const result = awesomeOscillator(candles, { fastPeriod: 2, slowPeriod: 3 });

    // medians = [10, 20, 30, 40]
    // At i=2: fastSMA = (20+30)/2 = 25, slowSMA = (10+20+30)/3 = 20, AO = 5
    expect(result[2].value).toBeCloseTo(5, 4);
    // At i=3: fastSMA = (30+40)/2 = 35, slowSMA = (20+30+40)/3 = 30, AO = 5
    expect(result[3].value).toBeCloseTo(5, 4);
  });

  it("should preserve time values", () => {
    const candles = makeSimpleCandles([10, 20, 30, 40, 50]);
    const result = awesomeOscillator(candles, { fastPeriod: 2, slowPeriod: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
