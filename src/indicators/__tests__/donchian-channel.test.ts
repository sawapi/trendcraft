import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { donchianChannel } from "../volatility/donchian-channel";

describe("donchianChannel", () => {
  // Helper to create candles
  const makeCandles = (data: { high: number; low: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: (d.high + d.low) / 2,
      high: d.high,
      low: d.low,
      close: (d.high + d.low) / 2,
      volume: 1000,
    }));

  it("should return null for initial periods", () => {
    const candles = makeCandles([
      { high: 110, low: 90 },
      { high: 115, low: 95 },
      { high: 120, low: 100 },
    ]);

    const result = donchianChannel(candles, { period: 5 });
    expect(result[0].value.upper).toBeNull();
    expect(result[0].value.middle).toBeNull();
    expect(result[0].value.lower).toBeNull();
  });

  it("should calculate correct upper (highest high)", () => {
    const candles = makeCandles([
      { high: 100, low: 90 },
      { high: 110, low: 95 },
      { high: 105, low: 92 },
      { high: 115, low: 100 }, // Highest high = 115
      { high: 108, low: 98 },
    ]);

    const result = donchianChannel(candles, { period: 5 });
    expect(result[4].value.upper).toBe(115);
  });

  it("should calculate correct lower (lowest low)", () => {
    const candles = makeCandles([
      { high: 100, low: 90 }, // Lowest low = 90
      { high: 110, low: 95 },
      { high: 105, low: 92 },
      { high: 115, low: 100 },
      { high: 108, low: 98 },
    ]);

    const result = donchianChannel(candles, { period: 5 });
    expect(result[4].value.lower).toBe(90);
  });

  it("should calculate correct middle (average of upper and lower)", () => {
    const candles = makeCandles([
      { high: 100, low: 90 },
      { high: 110, low: 95 },
      { high: 105, low: 92 },
      { high: 115, low: 100 },
      { high: 108, low: 98 },
    ]);

    const result = donchianChannel(candles, { period: 5 });
    // Upper = 115, Lower = 90, Middle = (115 + 90) / 2 = 102.5
    expect(result[4].value.middle).toBe(102.5);
  });

  it("should update values as window slides", () => {
    const candles = makeCandles([
      { high: 100, low: 90 },
      { high: 110, low: 80 },
      { high: 105, low: 85 },
      { high: 115, low: 95 }, // Period 3: upper=115, lower=80
      { high: 120, low: 100 }, // Period 3: upper=120, lower=85 (80 dropped)
    ]);

    const result = donchianChannel(candles, { period: 3 });

    // At index 3: window is [1,2,3], upper=115, lower=80
    expect(result[3].value.upper).toBe(115);
    expect(result[3].value.lower).toBe(80);

    // At index 4: window is [2,3,4], upper=120, lower=85
    expect(result[4].value.upper).toBe(120);
    expect(result[4].value.lower).toBe(85);
  });

  it("should handle flat market (same high/low)", () => {
    const candles = makeCandles(Array.from({ length: 10 }, () => ({ high: 100, low: 90 })));

    const result = donchianChannel(candles, { period: 5 });
    const lastValue = result[result.length - 1].value;

    expect(lastValue.upper).toBe(100);
    expect(lastValue.lower).toBe(90);
    expect(lastValue.middle).toBe(95);
  });

  it("should handle empty candles", () => {
    expect(donchianChannel([])).toEqual([]);
  });

  it("should throw for invalid period", () => {
    const candles = makeCandles([{ high: 100, low: 90 }]);
    expect(() => donchianChannel(candles, { period: 0 })).toThrow();
  });

  it("should use default period of 20", () => {
    const candles = makeCandles(
      Array.from({ length: 25 }, (_, i) => ({
        high: 100 + i,
        low: 90 + i,
      })),
    );

    const result = donchianChannel(candles);

    // First 19 values should be null
    expect(result[18].value.upper).toBeNull();
    expect(result[19].value.upper).not.toBeNull();
  });

  it("should preserve time from candles", () => {
    const candles = makeCandles([
      { high: 100, low: 90 },
      { high: 110, low: 95 },
      { high: 105, low: 92 },
    ]);

    const result = donchianChannel(candles, { period: 3 });
    expect(result[2].time).toBe(candles[2].time);
  });
});
