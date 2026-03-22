import { describe, expect, it } from "vitest";
import type { Candle } from "../../types";
import { getPrice, normalizeCandle, normalizeCandles, normalizeTime } from "../normalize";

describe("normalizeTime", () => {
  it("should pass through epoch milliseconds", () => {
    const time = 1700000000000;
    expect(normalizeTime(time)).toBe(time);
  });

  it("should convert epoch seconds to milliseconds", () => {
    const seconds = 1700000000;
    expect(normalizeTime(seconds)).toBe(1700000000000);
  });

  it("should parse ISO string", () => {
    const iso = "2023-11-14T12:00:00.000Z";
    expect(normalizeTime(iso)).toBe(Date.parse(iso));
  });

  it("should throw on invalid time string", () => {
    expect(() => normalizeTime("invalid")).toThrow("Invalid time format");
  });
});

describe("normalizeCandle", () => {
  it("should normalize candle with epoch ms time", () => {
    const candle: Candle = {
      time: 1700000000000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1000,
    };

    const result = normalizeCandle(candle);

    expect(result).toEqual({
      time: 1700000000000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1000,
    });
  });

  it("should normalize candle with ISO string time", () => {
    const candle: Candle = {
      time: "2023-11-14T12:00:00.000Z",
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1000,
    };

    const result = normalizeCandle(candle);

    expect(result.time).toBe(Date.parse("2023-11-14T12:00:00.000Z"));
    expect(result.close).toBe(105);
  });
});

describe("normalizeCandles", () => {
  it("should normalize and sort candles by time", () => {
    const candles: Candle[] = [
      { time: 1700000002000, open: 102, high: 112, low: 92, close: 107, volume: 1002 },
      { time: 1700000000000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: 1700000001000, open: 101, high: 111, low: 91, close: 106, volume: 1001 },
    ];

    const result = normalizeCandles(candles);

    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(1700000000000);
    expect(result[1].time).toBe(1700000001000);
    expect(result[2].time).toBe(1700000002000);
  });

  it("should handle empty array", () => {
    expect(normalizeCandles([])).toEqual([]);
  });
});

describe("getPrice", () => {
  const candle = {
    time: 1700000000000,
    open: 100,
    high: 120,
    low: 80,
    close: 110,
    volume: 1000,
  };

  it("should return open price", () => {
    expect(getPrice(candle, "open")).toBe(100);
  });

  it("should return high price", () => {
    expect(getPrice(candle, "high")).toBe(120);
  });

  it("should return low price", () => {
    expect(getPrice(candle, "low")).toBe(80);
  });

  it("should return close price", () => {
    expect(getPrice(candle, "close")).toBe(110);
  });

  it("should return volume", () => {
    expect(getPrice(candle, "volume")).toBe(1000);
  });

  it("should calculate hl2 (high + low) / 2", () => {
    expect(getPrice(candle, "hl2")).toBe(100); // (120 + 80) / 2
  });

  it("should calculate hlc3 (high + low + close) / 3", () => {
    expect(getPrice(candle, "hlc3")).toBeCloseTo(103.33, 2); // (120 + 80 + 110) / 3
  });

  it("should calculate ohlc4 (open + high + low + close) / 4", () => {
    expect(getPrice(candle, "ohlc4")).toBe(102.5); // (100 + 120 + 80 + 110) / 4
  });
});
