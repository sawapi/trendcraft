import { describe, expect, it } from "vitest";
import { pvt } from "../../indicators";
import type { NormalizedCandle } from "../../types";

function makeCandles(
  data: { close: number; volume: number }[],
  time0 = 1000,
  step = 86400,
): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: time0 + i * step,
    open: d.close - 0.5,
    high: d.close + 1,
    low: d.close - 1,
    close: d.close,
    volume: d.volume,
  }));
}

describe("pvt", () => {
  it("should return empty array for empty input", () => {
    expect(pvt([])).toEqual([]);
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 1200 },
      { close: 105, volume: 900 },
    ]);
    const result = pvt(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should start with 0 at the first bar", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 1200 },
    ]);
    const result = pvt(candles);
    expect(result[0].value).toBe(0);
  });

  it("should have no null values (except none - PVT has no warmup)", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 1200 },
      { close: 105, volume: 900 },
    ]);
    const result = pvt(candles);
    for (const r of result) {
      expect(r.value).not.toBeNull();
    }
  });

  it("should calculate PVT correctly", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 1200 },
      { close: 105, volume: 900 },
    ]);
    const result = pvt(candles);

    // PVT[0] = 0
    expect(result[0].value).toBe(0);
    // PVT[1] = 0 + 1200 * ((110 - 100) / 100) = 0 + 120 = 120
    expect(result[1].value).toBeCloseTo(120, 6);
    // PVT[2] = 120 + 900 * ((105 - 110) / 110) = 120 + 900 * (-5/110) = 120 - 40.909 ≈ 79.09
    expect(result[2].value).toBeCloseTo(120 - (900 * 5) / 110, 4);
  });

  it("should increase with rising prices and volume", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 2000 },
      { close: 120, volume: 2000 },
    ]);
    const result = pvt(candles);
    expect(result[1].value!).toBeGreaterThan(result[0].value!);
    expect(result[2].value!).toBeGreaterThan(result[1].value!);
  });

  it("should decrease with falling prices", () => {
    const candles = makeCandles([
      { close: 120, volume: 1000 },
      { close: 110, volume: 2000 },
      { close: 100, volume: 2000 },
    ]);
    const result = pvt(candles);
    expect(result[1].value!).toBeLessThan(result[0].value!);
    expect(result[2].value!).toBeLessThan(result[1].value!);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 1200 },
    ]);
    const result = pvt(candles);
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
