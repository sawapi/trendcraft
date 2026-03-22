import { describe, expect, it } from "vitest";
import { ppo } from "../../indicators";

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

describe("ppo", () => {
  it("should return empty array for empty input", () => {
    expect(ppo([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => ppo(candles, { fastPeriod: 0 })).toThrow("PPO periods must be at least 1");
    expect(() => ppo(candles, { slowPeriod: 0 })).toThrow("PPO periods must be at least 1");
    expect(() => ppo(candles, { signalPeriod: 0 })).toThrow("PPO periods must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ppo(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should have null values during warmup", () => {
    // PPO needs slowPeriod-1 warmup (default 26)
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ppo(candles);
    expect(result[24].value).toBeNull(); // index 24 is null (slow-1=25)
    expect(result[25].value).not.toBeNull(); // first valid at index 25
  });

  it("should work with default options (fast=12, slow=26, signal=9)", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ppo(candles);
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });

  it("should return ppo, signal, and histogram values", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ppo(candles);
    const firstNonNull = result.find((r) => r.value !== null);
    expect(firstNonNull).toBeDefined();
    expect(firstNonNull!.value).toHaveProperty("ppo");
    expect(firstNonNull!.value).toHaveProperty("signal");
    expect(firstNonNull!.value).toHaveProperty("histogram");
  });

  it("should calculate PPO as percentage difference between EMAs", () => {
    // fast=3, slow=5, signal=2
    const closes = [100, 102, 104, 106, 108, 110, 112];
    const candles = makeCandles(closes);
    const result = ppo(candles, { fastPeriod: 3, slowPeriod: 5, signalPeriod: 2 });

    // PPO first valid at index 4 (slowPeriod-1)
    expect(result[3].value).toBeNull();
    const val = result[4].value;
    expect(val).not.toBeNull();
    // PPO = ((fastEMA - slowEMA) / slowEMA) * 100
    // For steadily rising prices, fast EMA > slow EMA => PPO > 0
    expect(val!.ppo).toBeGreaterThan(0);
  });

  it("should have histogram = ppo - signal when signal is available", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ppo(candles, { fastPeriod: 3, slowPeriod: 5, signalPeriod: 2 });

    const withSignal = result.filter((r) => r.value !== null && r.value.signal !== null);
    expect(withSignal.length).toBeGreaterThan(0);
    for (const r of withSignal) {
      expect(r.value!.histogram).toBeCloseTo(r.value!.ppo - r.value!.signal!, 10);
    }
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = ppo(candles, { fastPeriod: 2, slowPeriod: 3, signalPeriod: 2 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
