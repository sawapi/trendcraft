import { describe, expect, it } from "vitest";
import { nvi } from "../../indicators";
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

describe("nvi", () => {
  it("should return empty array for empty input", () => {
    expect(nvi([])).toEqual([]);
  });

  it("should return output length matching input length", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 900 },
      { close: 105, volume: 800 },
    ]);
    const result = nvi(candles);
    expect(result).toHaveLength(candles.length);
  });

  it("should start with initial value (default 1000)", () => {
    const candles = makeCandles([{ close: 100, volume: 1000 }]);
    const result = nvi(candles);
    expect(result[0].value).toBe(1000);
  });

  it("should use custom initial value", () => {
    const candles = makeCandles([{ close: 100, volume: 1000 }]);
    const result = nvi(candles, { initialValue: 500 });
    expect(result[0].value).toBe(500);
  });

  it("should have no null values (no warmup needed)", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 900 },
      { close: 105, volume: 800 },
    ]);
    const result = nvi(candles);
    for (const r of result) {
      expect(r.value).not.toBeNull();
    }
  });

  it("should update only on days with lower volume", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 900 }, // volume down -> update NVI
      { close: 120, volume: 1100 }, // volume up -> no change
      { close: 115, volume: 800 }, // volume down -> update NVI
    ]);
    const result = nvi(candles);

    // i=0: NVI = 1000
    expect(result[0].value).toBe(1000);
    // i=1: vol < prev vol, priceChange = (110-100)/100 = 0.1
    // NVI = 1000 + 0.1 * 1000 = 1100
    expect(result[1].value).toBeCloseTo(1100, 6);
    // i=2: vol > prev vol, NVI unchanged = 1100
    expect(result[2].value).toBeCloseTo(1100, 6);
    // i=3: vol < prev vol, priceChange = (115-120)/120 = -0.04167
    // NVI = 1100 + (-0.04167) * 1100 = 1100 - 45.83 ≈ 1054.17
    expect(result[3].value).toBeCloseTo(1100 + (-5 / 120) * 1100, 2);
  });

  it("should not change when volume increases", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 150, volume: 2000 }, // volume up -> NVI unchanged despite price change
    ]);
    const result = nvi(candles);
    expect(result[1].value).toBe(1000);
  });

  it("should work with default options", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 900 },
    ]);
    const result = nvi(candles);
    expect(result[0].value).toBe(1000);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { close: 100, volume: 1000 },
      { close: 110, volume: 900 },
    ]);
    const result = nvi(candles);
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
