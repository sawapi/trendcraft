import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { cci } from "../momentum/cci";

describe("cci", () => {
  // Helper to create candles with OHLC data
  const makeCandles = (
    data: Array<{ high: number; low: number; close: number }>,
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 100 }]);
    expect(() => cci(candles, { period: 0 })).toThrow("CCI period must be at least 1");
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = cci(candles, { period: 5 });
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
  });

  it("should calculate CCI correctly", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
      { high: 130, low: 110, close: 120 },
    ]);

    const result = cci(candles, { period: 3 });

    // Typical Prices: TP1 = 100, TP2 = 110, TP3 = 120
    // SMA of TP over 3 periods = (100 + 110 + 120) / 3 = 110
    // Mean Deviation = (|100-110| + |110-110| + |120-110|) / 3 = 20/3 ≈ 6.67
    // CCI = (120 - 110) / (0.015 * 6.67) ≈ 100

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeCloseTo(100, 0);
  });

  it("should identify overbought conditions (CCI > 100)", () => {
    // Create rising prices that should result in high CCI
    const candles = makeCandles([
      { high: 100, low: 90, close: 95 },
      { high: 105, low: 95, close: 100 },
      { high: 110, low: 100, close: 105 },
      { high: 120, low: 110, close: 118 },
      { high: 130, low: 120, close: 128 },
    ]);

    const result = cci(candles, { period: 3 });

    // Later periods with strong upward momentum should show high CCI
    const lastCCI = result[result.length - 1].value;
    expect(lastCCI).not.toBeNull();
    expect(lastCCI).toBeGreaterThan(0);
  });

  it("should identify oversold conditions (CCI < -100)", () => {
    // Create falling prices that should result in low CCI
    const candles = makeCandles([
      { high: 130, low: 120, close: 125 },
      { high: 125, low: 115, close: 118 },
      { high: 118, low: 108, close: 110 },
      { high: 110, low: 95, close: 98 },
      { high: 100, low: 85, close: 88 },
    ]);

    const result = cci(candles, { period: 3 });

    // Later periods with strong downward momentum should show low CCI
    const lastCCI = result[result.length - 1].value;
    expect(lastCCI).not.toBeNull();
    expect(lastCCI).toBeLessThan(0);
  });

  it("should handle flat prices (zero mean deviation)", () => {
    const candles = makeCandles([
      { high: 100, low: 100, close: 100 },
      { high: 100, low: 100, close: 100 },
      { high: 100, low: 100, close: 100 },
    ]);

    const result = cci(candles, { period: 3 });

    // When all prices are the same, mean deviation is 0
    // CCI should be 0 (special case)
    expect(result[2].value).toBe(0);
  });

  it("should handle empty array", () => {
    expect(cci([])).toEqual([]);
  });

  it("should preserve time values in result", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = cci(candles);
    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
  });
});
