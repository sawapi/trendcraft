import { describe, expect, it } from "vitest";
import { tema } from "../../indicators";

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

describe("tema", () => {
  it("should return empty array for empty input", () => {
    expect(tema([])).toEqual([]);
  });

  it("should throw on invalid period", () => {
    const candles = makeCandles([10, 20, 30]);
    expect(() => tema(candles, { period: 0 })).toThrow("TEMA period must be at least 1");
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = tema(candles, { period: 3 });
    expect(result).toHaveLength(candles.length);
  });

  it("should have correct number of null values for warmup", () => {
    // TEMA needs 3*(period-1) warmup: EMA1, EMA2, EMA3 each need period-1
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = tema(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    // EMA1 first valid at index 4, EMA2 at 8, EMA3 at 12 => 12 nulls
    expect(nullCount).toBe(12);
  });

  it("should work with default options (period=20)", () => {
    const candles = makeCandles(Array.from({ length: 80 }, (_, i) => 100 + i));
    const result = tema(candles);
    expect(result).toHaveLength(80);
    // 3*(20-1) = 57 nulls
    expect(result[56].value).toBeNull();
    expect(result[57].value).not.toBeNull();
  });

  it("should calculate TEMA = 3*EMA1 - 3*EMA2 + EMA3 for period=2", () => {
    const closes = [10, 12, 14, 16, 18, 20];
    const candles = makeCandles(closes);
    const result = tema(candles, { period: 2 });

    // multiplier = 2/3
    // EMA1: seed at i=1: SMA(10,12)=11; EMA1[2]=14*(2/3)+11*(1/3)=13; EMA1[3]=16*(2/3)+13*(1/3)=15
    // EMA2: seed at i=2 (first valid EMA1 pair): SMA(11,13)=12; EMA2[3]=15*(2/3)+12*(1/3)=14
    // EMA3: seed at i=3 (first valid EMA2 pair): SMA(12,14)=13
    // TEMA[3] = 3*15 - 3*14 + 13 = 45-42+13 = 16
    expect(result[3].value).toBeCloseTo(16, 4);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([10, 20, 30]);
    const result = tema(candles, { period: 2 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should throw on non-integer period", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => tema(candles, { period: 20.5 })).toThrow("TEMA period must be an integer");
  });
});
