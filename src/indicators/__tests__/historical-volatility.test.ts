import { describe, expect, it } from "vitest";
import { historicalVolatility } from "../../indicators";

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

describe("historicalVolatility", () => {
  it("should return empty array for empty input", () => {
    expect(historicalVolatility([])).toEqual([]);
  });

  it("should throw on invalid period (< 2)", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => historicalVolatility(candles, { period: 1 })).toThrow(
      "Historical Volatility period must be at least 2",
    );
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = historicalVolatility(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // First valid at index = period (needs period log returns starting from index 1)
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = historicalVolatility(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(5);
  });

  it("should work with default options (period=20, annualFactor=252)", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = historicalVolatility(candles);
    expect(result).toHaveLength(30);
    expect(result[19].value).toBeNull();
    expect(result[20].value).not.toBeNull();
  });

  it("should return 0 for constant prices", () => {
    const closes = Array.from({ length: 10 }, () => 100);
    const candles = makeCandles(closes);
    const result = historicalVolatility(candles, { period: 3 });
    // log returns are all 0, std dev = 0
    const lastVal = result[result.length - 1].value;
    expect(lastVal).toBe(0);
  });

  it("should calculate annualized volatility correctly", () => {
    // Two log returns: ln(110/100) and ln(121/110) = ln(1.1) both
    const closes = [100, 110, 121];
    const candles = makeCandles(closes);
    const result = historicalVolatility(candles, { period: 2, annualFactor: 252 });

    // logReturns = [null, ln(1.1), ln(1.1)]
    // mean = ln(1.1), variance = 0, HV = 0
    expect(result[2].value).toBeCloseTo(0, 4);
  });

  it("should be higher for more volatile prices", () => {
    const stable = makeCandles([100, 101, 100, 101, 100, 101]);
    const volatile = makeCandles([100, 120, 80, 120, 80, 120]);
    const stableHV = historicalVolatility(stable, { period: 3 });
    const volatileHV = historicalVolatility(volatile, { period: 3 });
    expect(volatileHV[5].value!).toBeGreaterThan(stableHV[5].value!);
  });

  it("should respect annualFactor parameter", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const hv252 = historicalVolatility(candles, { period: 3, annualFactor: 252 });
    const hv52 = historicalVolatility(candles, { period: 3, annualFactor: 52 });
    // sqrt(252) > sqrt(52), so hv252 should be larger
    expect(hv252[5].value!).toBeGreaterThan(hv52[5].value!);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = historicalVolatility(candles, { period: 2 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
