import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { openingRange } from "../price/opening-range";

describe("openingRange", () => {
  it("should return empty for empty input", () => {
    expect(openingRange([])).toEqual([]);
  });

  it("should detect opening range and breakout with intraday data", () => {
    // 5-minute candles within a single day
    const dayStart = new Date("2024-01-15T09:30:00Z").getTime();
    const fiveMin = 5 * 60 * 1000;

    const candles: NormalizedCandle[] = [
      // Opening range (first 30 min = 6 bars of 5-min)
      { time: dayStart, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
      { time: dayStart + fiveMin, open: 101, high: 103, low: 100, close: 102, volume: 1000 },
      { time: dayStart + fiveMin * 2, open: 102, high: 105, low: 101, close: 104, volume: 1000 },
      { time: dayStart + fiveMin * 3, open: 104, high: 106, low: 103, close: 105, volume: 1000 },
      { time: dayStart + fiveMin * 4, open: 105, high: 107, low: 104, close: 106, volume: 1000 },
      { time: dayStart + fiveMin * 5, open: 106, high: 108, low: 105, close: 107, volume: 1000 },
      // After opening range — breakout above
      { time: dayStart + fiveMin * 6, open: 107, high: 110, low: 107, close: 110, volume: 2000 },
      { time: dayStart + fiveMin * 7, open: 110, high: 112, low: 109, close: 111, volume: 1500 },
    ];

    const result = openingRange(candles, { minutes: 30 });

    expect(result).toHaveLength(8);

    // During opening range (first 6 bars, 0-25 min), high/low should track
    expect(result[0].value.high).toBe(102);
    expect(result[0].value.low).toBe(99);
    expect(result[0].value.breakout).toBeNull();

    // After OR, breakout should be detected
    // OR high = 108, OR low = 99
    expect(result[6].value.high).toBe(108);
    expect(result[6].value.low).toBe(99);
    expect(result[6].value.breakout).toBe("above"); // close 110 > OR high 108
  });

  it("should detect breakout below", () => {
    const dayStart = new Date("2024-01-15T09:30:00Z").getTime();
    const fiveMin = 5 * 60 * 1000;

    const candles: NormalizedCandle[] = [
      // Opening range
      { time: dayStart, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
      { time: dayStart + fiveMin, open: 101, high: 103, low: 100, close: 102, volume: 1000 },
      { time: dayStart + fiveMin * 2, open: 102, high: 104, low: 101, close: 103, volume: 1000 },
      { time: dayStart + fiveMin * 3, open: 103, high: 104, low: 102, close: 103, volume: 1000 },
      { time: dayStart + fiveMin * 4, open: 103, high: 104, low: 102, close: 103, volume: 1000 },
      { time: dayStart + fiveMin * 5, open: 103, high: 104, low: 102, close: 103, volume: 1000 },
      // After opening range — breakdown
      { time: dayStart + fiveMin * 6, open: 100, high: 100, low: 95, close: 96, volume: 3000 },
    ];

    const result = openingRange(candles, { minutes: 30 });

    // OR high = 104, OR low = 99
    expect(result[6].value.breakout).toBe("below"); // close 96 < OR low 99
  });

  it("should return null breakout when price stays within range", () => {
    const dayStart = new Date("2024-01-15T09:30:00Z").getTime();
    const fiveMin = 5 * 60 * 1000;

    const candles: NormalizedCandle[] = [
      { time: dayStart, open: 100, high: 105, low: 95, close: 100, volume: 1000 },
      { time: dayStart + fiveMin, open: 100, high: 104, low: 96, close: 100, volume: 1000 },
      { time: dayStart + fiveMin * 2, open: 100, high: 103, low: 97, close: 100, volume: 1000 },
      { time: dayStart + fiveMin * 3, open: 100, high: 103, low: 97, close: 100, volume: 1000 },
      { time: dayStart + fiveMin * 4, open: 100, high: 103, low: 97, close: 100, volume: 1000 },
      { time: dayStart + fiveMin * 5, open: 100, high: 103, low: 97, close: 100, volume: 1000 },
      // Price stays within OR range
      { time: dayStart + fiveMin * 6, open: 100, high: 103, low: 97, close: 100, volume: 1000 },
    ];

    const result = openingRange(candles, { minutes: 30 });
    expect(result[6].value.breakout).toBeNull(); // close 100 within [95, 105]
  });

  it("should reset on new session (day)", () => {
    const day1 = new Date("2024-01-15T09:30:00Z").getTime();
    const day2 = new Date("2024-01-16T09:30:00Z").getTime();
    const fiveMin = 5 * 60 * 1000;

    const candles: NormalizedCandle[] = [
      // Day 1
      { time: day1, open: 100, high: 105, low: 95, close: 100, volume: 1000 },
      { time: day1 + fiveMin * 6, open: 100, high: 110, low: 100, close: 109, volume: 1000 },
      // Day 2 — new session, different OR
      { time: day2, open: 200, high: 210, low: 195, close: 200, volume: 1000 },
      { time: day2 + fiveMin * 6, open: 200, high: 215, low: 200, close: 215, volume: 1000 },
    ];

    const result = openingRange(candles, { minutes: 30 });

    // Day 2 should have its own OR
    expect(result[2].value.high).toBe(210);
    expect(result[2].value.low).toBe(195);
    expect(result[3].value.breakout).toBe("above"); // close 215 > OR high 210
  });

  it("should support fixed session reset period", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < 10; i++) {
      candles.push({
        time: 1700000000000 + i * 60000,
        open: 100,
        high: 102 + i,
        low: 98 - i,
        close: 100,
        volume: 1000,
      });
    }

    const result = openingRange(candles, { minutes: 3, sessionResetPeriod: 5 });
    expect(result).toHaveLength(10);

    // Second session resets at index 5
    // OR for second session should start fresh
    expect(result[5].value.high).toBe(107); // high at index 5
    expect(result[5].value.low).toBe(93); // low at index 5
  });
});
