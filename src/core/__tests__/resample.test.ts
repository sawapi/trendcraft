import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { parseTimeframe, resample } from "../resample";

describe("parseTimeframe", () => {
  it("should pass through Timeframe object", () => {
    const tf = { value: 1, unit: "day" as const };
    expect(parseTimeframe(tf)).toEqual(tf);
  });

  it("should parse minute shorthands", () => {
    expect(parseTimeframe("1m")).toEqual({ value: 1, unit: "minute" });
    expect(parseTimeframe("5m")).toEqual({ value: 5, unit: "minute" });
    expect(parseTimeframe("15m")).toEqual({ value: 15, unit: "minute" });
    expect(parseTimeframe("30m")).toEqual({ value: 30, unit: "minute" });
  });

  it("should parse hour shorthands", () => {
    expect(parseTimeframe("1h")).toEqual({ value: 1, unit: "hour" });
    expect(parseTimeframe("4h")).toEqual({ value: 4, unit: "hour" });
  });

  it("should parse day/week/month shorthands", () => {
    expect(parseTimeframe("1d")).toEqual({ value: 1, unit: "day" });
    expect(parseTimeframe("daily")).toEqual({ value: 1, unit: "day" });
    expect(parseTimeframe("1w")).toEqual({ value: 1, unit: "week" });
    expect(parseTimeframe("weekly")).toEqual({ value: 1, unit: "week" });
    expect(parseTimeframe("1M")).toEqual({ value: 1, unit: "month" });
    expect(parseTimeframe("monthly")).toEqual({ value: 1, unit: "month" });
  });

  it("should throw on unknown shorthand", () => {
    // @ts-expect-error Testing invalid input
    expect(() => parseTimeframe("invalid")).toThrow("Unknown timeframe shorthand");
  });
});

describe("resample", () => {
  // Helper to create candle at specific date
  const makeCandle = (dateStr: string, ohlcv: [number, number, number, number, number]): NormalizedCandle => ({
    time: Date.parse(dateStr),
    open: ohlcv[0],
    high: ohlcv[1],
    low: ohlcv[2],
    close: ohlcv[3],
    volume: ohlcv[4],
  });

  it("should return empty array for empty input", () => {
    expect(resample([], "weekly")).toEqual([]);
  });

  it("should aggregate daily candles to weekly", () => {
    // Monday to Friday of the same week
    const dailyCandles: NormalizedCandle[] = [
      makeCandle("2023-11-13T00:00:00Z", [100, 110, 95, 105, 1000]), // Monday
      makeCandle("2023-11-14T00:00:00Z", [105, 115, 100, 108, 1100]), // Tuesday
      makeCandle("2023-11-15T00:00:00Z", [108, 120, 105, 115, 1200]), // Wednesday
      makeCandle("2023-11-16T00:00:00Z", [115, 118, 110, 112, 900]), // Thursday
      makeCandle("2023-11-17T00:00:00Z", [112, 125, 110, 122, 1500]), // Friday
    ];

    const weekly = resample(dailyCandles, "weekly");

    expect(weekly).toHaveLength(1);
    expect(weekly[0].open).toBe(100); // First candle's open
    expect(weekly[0].high).toBe(125); // Highest high
    expect(weekly[0].low).toBe(95); // Lowest low
    expect(weekly[0].close).toBe(122); // Last candle's close
    expect(weekly[0].volume).toBe(5700); // Sum of volumes
  });

  it("should create multiple weekly candles for multiple weeks", () => {
    const dailyCandles: NormalizedCandle[] = [
      // Week 1 (Nov 13-17)
      makeCandle("2023-11-13T00:00:00Z", [100, 110, 95, 105, 1000]),
      makeCandle("2023-11-14T00:00:00Z", [105, 115, 100, 110, 1000]),
      // Week 2 (Nov 20-24)
      makeCandle("2023-11-20T00:00:00Z", [110, 120, 105, 115, 1000]),
      makeCandle("2023-11-21T00:00:00Z", [115, 125, 110, 120, 1000]),
    ];

    const weekly = resample(dailyCandles, "weekly");

    expect(weekly).toHaveLength(2);
    expect(weekly[0].close).toBe(110); // Week 1 close
    expect(weekly[1].close).toBe(120); // Week 2 close
  });

  it("should aggregate to monthly", () => {
    const dailyCandles: NormalizedCandle[] = [
      makeCandle("2023-11-01T00:00:00Z", [100, 110, 95, 105, 1000]),
      makeCandle("2023-11-15T00:00:00Z", [105, 120, 100, 115, 1500]),
      makeCandle("2023-11-30T00:00:00Z", [115, 125, 110, 120, 2000]),
      makeCandle("2023-12-01T00:00:00Z", [120, 130, 115, 125, 1000]), // Next month
    ];

    const monthly = resample(dailyCandles, "monthly");

    expect(monthly).toHaveLength(2);
    // November
    expect(monthly[0].open).toBe(100);
    expect(monthly[0].high).toBe(125);
    expect(monthly[0].low).toBe(95);
    expect(monthly[0].close).toBe(120);
    expect(monthly[0].volume).toBe(4500);
    // December
    expect(monthly[1].open).toBe(120);
    expect(monthly[1].close).toBe(125);
  });

  it("should aggregate hourly to 4-hour", () => {
    const hourlyCandles: NormalizedCandle[] = [
      makeCandle("2023-11-14T00:00:00Z", [100, 105, 98, 103, 100]),
      makeCandle("2023-11-14T01:00:00Z", [103, 108, 101, 106, 110]),
      makeCandle("2023-11-14T02:00:00Z", [106, 110, 104, 108, 120]),
      makeCandle("2023-11-14T03:00:00Z", [108, 112, 106, 110, 130]),
      makeCandle("2023-11-14T04:00:00Z", [110, 115, 108, 113, 140]), // New 4h bar
    ];

    const fourHour = resample(hourlyCandles, "4h");

    expect(fourHour).toHaveLength(2);
    // First 4h bar (00:00-03:00)
    expect(fourHour[0].open).toBe(100);
    expect(fourHour[0].high).toBe(112);
    expect(fourHour[0].low).toBe(98);
    expect(fourHour[0].close).toBe(110);
    expect(fourHour[0].volume).toBe(460);
    // Second 4h bar (04:00-07:00)
    expect(fourHour[1].open).toBe(110);
    expect(fourHour[1].close).toBe(113);
  });
});
