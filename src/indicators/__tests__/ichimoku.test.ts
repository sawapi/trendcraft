import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { ichimoku } from "../trend/ichimoku";

describe("ichimoku", () => {
  // Helper to create candles with OHLC data
  const makeCandles = (data: Array<{ high: number; low: number; close: number }>): NormalizedCandle[] =>
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
    expect(() => ichimoku(candles, { tenkanPeriod: 0 })).toThrow("Ichimoku periods must be at least 1");
    expect(() => ichimoku(candles, { kijunPeriod: 0 })).toThrow("Ichimoku periods must be at least 1");
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = ichimoku(candles, { tenkanPeriod: 5 });
    expect(result[0].value.tenkan).toBeNull();
    expect(result[1].value.tenkan).toBeNull();
  });

  it("should calculate Tenkan-sen correctly", () => {
    // Create 10 candles to test 9-period Tenkan
    const candles = makeCandles([
      { high: 100, low: 90, close: 95 },
      { high: 105, low: 85, close: 100 },
      { high: 110, low: 95, close: 105 },
      { high: 115, low: 100, close: 110 },
      { high: 120, low: 105, close: 115 },
      { high: 125, low: 110, close: 120 },
      { high: 130, low: 115, close: 125 },
      { high: 135, low: 120, close: 130 },
      { high: 140, low: 125, close: 135 },
    ]);

    const result = ichimoku(candles, { tenkanPeriod: 9 });

    // Tenkan at index 8 (first valid): (highest high + lowest low) / 2
    // Highest high in period: 140, Lowest low: 85
    // Tenkan = (140 + 85) / 2 = 112.5
    expect(result[8].value.tenkan).toBe(112.5);
  });

  it("should calculate Kijun-sen correctly", () => {
    // Use smaller period for easier testing
    const candles = makeCandles([
      { high: 100, low: 80, close: 90 },
      { high: 110, low: 85, close: 95 },
      { high: 115, low: 90, close: 100 },
    ]);

    const result = ichimoku(candles, { tenkanPeriod: 2, kijunPeriod: 3 });

    // Kijun at index 2: (highest high + lowest low) / 2 over 3 periods
    // Highest: 115, Lowest: 80
    // Kijun = (115 + 80) / 2 = 97.5
    expect(result[2].value.kijun).toBe(97.5);
  });

  it("should calculate Senkou Span A with displacement", () => {
    // Create enough candles for displacement calculation
    const data = Array.from({ length: 30 }, (_, i) => ({
      high: 100 + i * 2,
      low: 80 + i * 2,
      close: 90 + i * 2,
    }));
    const candles = makeCandles(data);

    const result = ichimoku(candles, { tenkanPeriod: 9, kijunPeriod: 9, displacement: 5 });

    // Senkou A at current index uses values calculated 'displacement' bars ago
    // At index 14, it uses tenkan and kijun from index 9
    const idx = 14;
    const sourceIdx = idx - 5;

    // Verify Senkou A is calculated
    expect(result[idx].value.senkouA).not.toBeNull();
  });

  it("should handle chikou span (lagging line)", () => {
    const data = Array.from({ length: 30 }, (_, i) => ({
      high: 100 + i,
      low: 90 + i,
      close: 95 + i,
    }));
    const candles = makeCandles(data);

    const result = ichimoku(candles, { displacement: 5 });

    // Chikou at index 20 shows close price from index 25
    expect(result[20].value.chikou).toBe(candles[25].close);

    // Last few candles won't have chikou (no future data)
    expect(result[result.length - 1].value.chikou).toBeNull();
  });

  it("should handle empty array", () => {
    expect(ichimoku([])).toEqual([]);
  });

  it("should preserve time values in result", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100 },
      { high: 120, low: 100, close: 110 },
    ]);

    const result = ichimoku(candles);
    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
  });
});
