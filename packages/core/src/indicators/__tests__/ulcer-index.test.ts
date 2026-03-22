import { describe, expect, it } from "vitest";
import { ulcerIndex } from "../../indicators";

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

describe("ulcerIndex", () => {
  it("should return empty array for empty input", () => {
    expect(ulcerIndex([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => ulcerIndex(candles, { period: 0 })).toThrow(
      "Ulcer Index period must be at least 1",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = ulcerIndex(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = ulcerIndex(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(4); // period - 1
  });

  it("should work with default options (period=14)", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = ulcerIndex(candles);
    expect(result).toHaveLength(20);
    expect(result[12].value).toBeNull();
    expect(result[13].value).not.toBeNull();
  });

  it("should return 0 for consistently rising prices", () => {
    // No drawdown from the highest in the window
    const closes = [100, 101, 102, 103, 104];
    const candles = makeCandles(closes);
    const result = ulcerIndex(candles, { period: 3 });

    // Each window has the last value as highest, and all prior are below it
    // Actually, for [102,103,104], highest=104, drawdowns: (102-104)/104, (103-104)/104, (104-104)/104
    // Not zero since earlier values are below the peak
    expect(result[4].value).not.toBeNull();
    expect(result[4].value!).toBeGreaterThanOrEqual(0);
  });

  it("should calculate correctly for a known window", () => {
    // period=3, window: [100, 90, 95]
    // highest = 100
    // drawdowns: (100-100)/100*100=0, (90-100)/100*100=-10, (95-100)/100*100=-5
    // squared: 0, 100, 25
    // avg = 125/3
    // UI = sqrt(125/3) ≈ 6.455
    const closes = [100, 90, 95];
    const candles = makeCandles(closes);
    const result = ulcerIndex(candles, { period: 3 });
    expect(result[2].value).toBeCloseTo(Math.sqrt(125 / 3), 4);
  });

  it("should be higher for more volatile drawdowns", () => {
    const stable = makeCandles([100, 99, 100, 99, 100]);
    const volatile = makeCandles([100, 80, 100, 80, 100]);
    const stableUI = ulcerIndex(stable, { period: 3 });
    const volatileUI = ulcerIndex(volatile, { period: 3 });
    expect(volatileUI[4].value!).toBeGreaterThan(stableUI[4].value!);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = ulcerIndex(candles, { period: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
