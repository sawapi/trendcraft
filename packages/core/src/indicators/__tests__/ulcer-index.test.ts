import { describe, expect, it } from "vitest";
import { ulcerIndex } from "../../indicators";

function makeCandles(closes: number[], time0 = 1_700_000_000_000, step = 86_400_000) {
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
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = ulcerIndex(candles, { period: 5 });
    expect(result).toHaveLength(candles.length);
  });

  it("warmup is 2*period - 1 (canonical Peter Martin formula)", () => {
    // Stage 1 needs `period` bars to compute the first rolling-max,
    // stage 2 needs `period` drawdowns; combined warmup = 2*period - 1
    // bars before the first non-null UI (i.e. first non-null at index
    // 2*period - 2).
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = ulcerIndex(candles, { period: 5 });
    const nullCount = result.filter((r) => r.value === null).length;
    expect(nullCount).toBe(8); // 2*5 - 2
    expect(result[7].value).toBeNull();
    expect(result[8].value).not.toBeNull();
  });

  it("default period=14 first non-null at index 26 (= 2*14 - 2)", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + i));
    const result = ulcerIndex(candles);
    expect(result).toHaveLength(40);
    expect(result[25].value).toBeNull();
    expect(result[26].value).not.toBeNull();
  });

  it("monotonically rising prices yield UI = 0 at every point with a full window", () => {
    // For every bar j with a full prices window, rolling_max[j] = close[j],
    // so drawdown[j] = 0. Therefore UI = sqrt(0/N) = 0 once stage-2 fills.
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const result = ulcerIndex(candles, { period: 3 });
    // First non-null at index 2*3 - 2 = 4
    for (let i = 4; i < result.length; i++) {
      expect(result[i].value).toBeCloseTo(0, 10);
    }
  });

  it("calculates correctly for a known sequence", () => {
    // period=3, closes = [100, 102, 101, 99, 98]
    // Stage 1: rolling_max[j] for j=2..4
    //   j=2: max(100,102,101) = 102 → dd[2] = (101-102)/102*100 = -0.98039...
    //   j=3: max(102,101, 99) = 102 → dd[3] = ( 99-102)/102*100 = -2.94117...
    //   j=4: max(101, 99, 98) = 101 → dd[4] = ( 98-101)/101*100 = -2.97029...
    // Stage 2: UI[i] = sqrt((dd[i-2]^2 + dd[i-1]^2 + dd[i]^2) / 3)
    //   First non-null at i = 2*3 - 2 = 4
    //   UI[4] = sqrt((0.98039^2 + 2.94117^2 + 2.97029^2) / 3)
    const closes = [100, 102, 101, 99, 98];
    const candles = makeCandles(closes);
    const result = ulcerIndex(candles, { period: 3 });
    const dd2 = ((101 - 102) / 102) * 100;
    const dd3 = ((99 - 102) / 102) * 100;
    const dd4 = ((98 - 101) / 101) * 100;
    const expectedUi4 = Math.sqrt((dd2 * dd2 + dd3 * dd3 + dd4 * dd4) / 3);
    expect(result[4].value).toBeCloseTo(expectedUi4, 10);
  });

  it("higher for more volatile drawdowns", () => {
    const stable = makeCandles([100, 99, 100, 99, 100, 99, 100, 99, 100]);
    const volatile = makeCandles([100, 80, 100, 80, 100, 80, 100, 80, 100]);
    const stableUI = ulcerIndex(stable, { period: 3 });
    const volatileUI = ulcerIndex(volatile, { period: 3 });
    const lastStable = stableUI[stableUI.length - 1].value;
    const lastVolatile = volatileUI[volatileUI.length - 1].value;
    expect(lastVolatile).not.toBeNull();
    expect(lastStable).not.toBeNull();
    expect(lastVolatile as number).toBeGreaterThan(lastStable as number);
  });

  it("preserves time values", () => {
    const candles = makeCandles([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const result = ulcerIndex(candles, { period: 3 });
    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
