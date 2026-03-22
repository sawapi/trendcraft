/**
 * Incremental Regime Indicator Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../../types";
import { createRegime } from "../regime";

const MS_PER_DAY = 86400000;

function generateCandles(
  count: number,
  opts?: { trend?: "up" | "down"; volatility?: "high" | "low" },
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let baseTime = new Date("2020-01-01").getTime();
  let price = 100;
  let seed = 42;
  function random(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  const trendBias = opts?.trend === "up" ? 0.3 : opts?.trend === "down" ? -0.3 : 0;
  const volMult = opts?.volatility === "high" ? 20 : opts?.volatility === "low" ? 0.05 : 1;

  for (let i = 0; i < count; i++) {
    const change = (random() - 0.5) * 2 * volMult + trendBias;
    const open = price;
    const close = price * (1 + change / 100);
    const spread = Math.abs(open - close) + price * 0.005 * volMult;
    const high = Math.max(open, close) + spread * random();
    const low = Math.min(open, close) - spread * random();
    const volume = Math.floor(100000 + random() * 900000);

    candles.push({
      time: baseTime,
      open: Math.round(open * 10000) / 10000,
      high: Math.round(high * 10000) / 10000,
      low: Math.round(low * 10000) / 10000,
      close: Math.round(close * 10000) / 10000,
      volume,
    });

    price = close;
    baseTime += MS_PER_DAY;
  }

  return candles;
}

describe("createRegime", () => {
  it("should return null values during warm-up", () => {
    const regime = createRegime({ lookback: 50 });
    const candles = generateCandles(10);

    for (const candle of candles) {
      const result = regime.next(candle);
      // Not enough data yet for ADX
      expect(result.value).toBeNull();
    }

    expect(regime.isWarmedUp).toBe(false);
  });

  it("should produce values after warm-up", () => {
    const regime = createRegime({ lookback: 50, atrPeriod: 7, bbPeriod: 10, dmiPeriod: 7 });
    const candles = generateCandles(200);

    let firstNonNull: number | null = null;
    for (let i = 0; i < candles.length; i++) {
      const result = regime.next(candles[i]);
      if (result.value !== null && firstNonNull === null) {
        firstNonNull = i;
      }
    }

    expect(firstNonNull).not.toBeNull();
    expect(regime.isWarmedUp).toBe(true);

    // Check the last value has the expected shape
    const last = regime.peek(candles[candles.length - 1]);
    expect(last.value).not.toBeNull();
    expect(["low", "normal", "high"]).toContain(last.value!.volatility);
    expect(["bullish", "bearish", "sideways"]).toContain(last.value!.trend);
    expect(last.value!.trendStrength).toBeGreaterThanOrEqual(0);
    expect(last.value!.trendStrength).toBeLessThanOrEqual(100);
  });

  it("should detect high volatility in volatile data", () => {
    const regime = createRegime({ lookback: 50, atrPeriod: 7, bbPeriod: 10, dmiPeriod: 7 });

    // Generate a single continuous series: calm then volatile
    const baseTime = new Date("2020-01-01").getTime();
    let price = 100;
    let seed = 42;
    function random(): number {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    }

    // 100 calm candles
    for (let i = 0; i < 100; i++) {
      const change = (random() - 0.5) * 0.1; // very small moves
      const open = price;
      const close = price * (1 + change / 100);
      const high = Math.max(open, close) * (1 + random() * 0.001);
      const low = Math.min(open, close) * (1 - random() * 0.001);
      regime.next({
        time: baseTime + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 100000,
      });
      price = close;
    }

    // 60 highly volatile candles
    let lastValue: ReturnType<typeof regime.next>["value"] = null;
    for (let i = 0; i < 60; i++) {
      const change = (random() - 0.5) * 20; // huge moves
      const open = price;
      const close = price * (1 + change / 100);
      const spread = Math.abs(open - close) * 2;
      const high = Math.max(open, close) + spread * random();
      const low = Math.min(open, close) - spread * random();
      const result = regime.next({
        time: baseTime + (100 + i) * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 100000,
      });
      if (result.value !== null) lastValue = result.value;
      price = close;
    }

    expect(lastValue).not.toBeNull();
    expect(lastValue!.volatility).toBe("high");
  });

  it("should detect bullish trend in uptrending data", () => {
    const regime = createRegime({ lookback: 50, atrPeriod: 7, bbPeriod: 10, dmiPeriod: 7 });
    const candles = generateCandles(200, { trend: "up" });

    let lastValue: ReturnType<typeof regime.next>["value"] = null;
    for (const candle of candles) {
      const result = regime.next(candle);
      if (result.value !== null) lastValue = result.value;
    }

    expect(lastValue).not.toBeNull();
    expect(lastValue!.trend).toBe("bullish");
  });

  it("should roundtrip state via getState/fromState", () => {
    const regime1 = createRegime({ lookback: 50, atrPeriod: 7, bbPeriod: 10, dmiPeriod: 7 });
    const candles = generateCandles(200);

    // Process first half
    const splitAt = 100;
    for (let i = 0; i < splitAt; i++) {
      regime1.next(candles[i]);
    }

    // Save state, roundtrip through JSON
    const state = JSON.parse(JSON.stringify(regime1.getState()));

    // Create new indicator from state
    const regime2 = createRegime(
      { lookback: 50, atrPeriod: 7, bbPeriod: 10, dmiPeriod: 7 },
      { fromState: state },
    );

    // Process second half with both
    for (let i = splitAt; i < candles.length; i++) {
      const r1 = regime1.next(candles[i]);
      const r2 = regime2.next(candles[i]);
      expect(r2.value).toEqual(r1.value);
    }
  });

  it("should support warmUp option", () => {
    const candles = generateCandles(200);
    const splitAt = 100;

    const regime1 = createRegime({ lookback: 50, atrPeriod: 7, bbPeriod: 10, dmiPeriod: 7 });
    for (const candle of candles) {
      regime1.next(candle);
    }

    const regime2 = createRegime(
      { lookback: 50, atrPeriod: 7, bbPeriod: 10, dmiPeriod: 7 },
      { warmUp: candles.slice(0, splitAt) },
    );
    for (let i = splitAt; i < candles.length; i++) {
      regime2.next(candles[i]);
    }

    // Both should produce the same final state
    const last1 = regime1.peek(candles[candles.length - 1]);
    const last2 = regime2.peek(candles[candles.length - 1]);
    expect(last2.value).toEqual(last1.value);
  });
});
