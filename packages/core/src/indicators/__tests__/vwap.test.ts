import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { vwap } from "../volume/vwap";

describe("vwap", () => {
  // Helper to create candles with OHLCV data
  const makeCandles = (
    data: Array<{ high: number; low: number; close: number; volume: number }>,
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));

  it("should calculate VWAP correctly", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100, volume: 1000 },
      { high: 120, low: 100, close: 110, volume: 2000 },
      { high: 130, low: 110, close: 120, volume: 1500 },
    ]);

    const result = vwap(candles);

    // Typical Price = (High + Low + Close) / 3
    // TP1 = (110 + 90 + 100) / 3 = 100
    // TP2 = (120 + 100 + 110) / 3 = 110
    // TP3 = (130 + 110 + 120) / 3 = 120

    // VWAP = cumulative(TP * V) / cumulative(V)
    // Session VWAP resets each day (different date per candle)
    // Day 1: TP=100, VWAP = 100 * 1000 / 1000 = 100
    expect(result[0].value.vwap).toBe(100);

    // Day 2: TP=110, session reset, so VWAP = 110 * 2000 / 2000 = 110
    expect(result[1].value.vwap).toBe(110);

    // Day 3: TP=120, session reset, so VWAP = 120 * 1500 / 1500 = 120
    expect(result[2].value.vwap).toBe(120);
  });

  it("should return upper and lower bands", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100, volume: 1000 },
      { high: 120, low: 100, close: 110, volume: 2000 },
      { high: 130, low: 110, close: 120, volume: 1500 },
    ]);

    const result = vwap(candles);

    // All values should have upper and lower bands after first data point
    result.forEach((r) => {
      expect(r.value.vwap).not.toBeNull();
      expect(r.value.upper).not.toBeNull();
      expect(r.value.lower).not.toBeNull();
      // Upper should be above VWAP, lower below
      if (r.value.vwap !== null && r.value.upper !== null && r.value.lower !== null) {
        expect(r.value.upper).toBeGreaterThanOrEqual(r.value.vwap);
        expect(r.value.lower).toBeLessThanOrEqual(r.value.vwap);
      }
    });
  });

  it("should calculate rolling VWAP", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100, volume: 1000 },
      { high: 120, low: 100, close: 110, volume: 2000 },
      { high: 130, low: 110, close: 120, volume: 1500 },
      { high: 140, low: 120, close: 130, volume: 1000 },
    ]);

    const result = vwap(candles, { resetPeriod: "rolling", period: 2 });

    // First result should be null (not enough data)
    expect(result[0].value.vwap).toBeNull();

    // Second result uses last 2 candles
    expect(result[1].value.vwap).not.toBeNull();

    // Rolling VWAP only uses last 'period' candles
    expect(result[3].value.vwap).not.toBeNull();
  });

  it("should reset on session change", () => {
    // Create candles across two days
    const candles: NormalizedCandle[] = [
      {
        time: new Date("2024-01-01T10:00:00Z").getTime(),
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1000,
      },
      {
        time: new Date("2024-01-01T11:00:00Z").getTime(),
        open: 100,
        high: 120,
        low: 100,
        close: 110,
        volume: 2000,
      },
      {
        time: new Date("2024-01-02T10:00:00Z").getTime(),
        open: 110,
        high: 130,
        low: 110,
        close: 120,
        volume: 1500,
      },
      {
        time: new Date("2024-01-02T11:00:00Z").getTime(),
        open: 120,
        high: 140,
        low: 120,
        close: 130,
        volume: 1000,
      },
    ];

    const result = vwap(candles, { resetPeriod: "session" });

    // Day 2 starts fresh
    // TP3 = (130 + 110 + 120) / 3 = 120
    expect(result[2].value.vwap).toBe(120);
  });

  it("should handle empty array", () => {
    expect(vwap([])).toEqual([]);
  });

  it("should handle zero volume", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100, volume: 0 }]);

    const result = vwap(candles);
    expect(result[0].value.vwap).toBeNull();
  });
});
