/**
 * Volume Profile Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { volumeProfile, volumeProfileSeries } from "../volume-profile";

// Helper to create test candles
function createCandles(
  data: Array<{ high: number; low: number; close: number; volume: number }>,
): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: 1_700_000_000_000 + i * 86_400_000,
    open: d.low + (d.high - d.low) * 0.3,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
  }));
}

// Create uniform candles for simple tests
function createUniformCandles(count: number, volume = 100): NormalizedCandle[] {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      time: 1_700_000_000_000 + i * 86_400_000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume,
    }));
}

describe("volumeProfile", () => {
  describe("basic functionality", () => {
    it("should return empty profile for empty input", () => {
      const result = volumeProfile([]);
      expect(result.levels).toEqual([]);
      expect(result.poc).toBe(0);
      expect(result.vah).toBe(0);
      expect(result.val).toBe(0);
    });

    it("should return profile with all required fields", () => {
      const candles = createUniformCandles(10);
      const result = volumeProfile(candles);

      expect(result).toHaveProperty("levels");
      expect(result).toHaveProperty("poc");
      expect(result).toHaveProperty("vah");
      expect(result).toHaveProperty("val");
      expect(result).toHaveProperty("periodHigh");
      expect(result).toHaveProperty("periodLow");
    });

    it("should create correct number of levels", () => {
      const candles = createUniformCandles(10);

      const result12 = volumeProfile(candles, { levels: 12 });
      expect(result12.levels).toHaveLength(12);

      const result24 = volumeProfile(candles, { levels: 24 });
      expect(result24.levels).toHaveLength(24);
    });

    it("should throw error for levels < 2", () => {
      const candles = createUniformCandles(10);
      expect(() => volumeProfile(candles, { levels: 1 })).toThrow();
    });
  });

  describe("POC (Point of Control) calculation", () => {
    it("should identify POC at price level with highest volume", () => {
      // Create candles with high volume at specific price level
      const candles = createCandles([
        { high: 110, low: 100, close: 105, volume: 100 },
        { high: 115, low: 105, close: 110, volume: 100 },
        { high: 120, low: 110, close: 115, volume: 500 }, // High volume here
        { high: 125, low: 115, close: 120, volume: 100 },
        { high: 130, low: 120, close: 125, volume: 100 },
      ]);

      const result = volumeProfile(candles, { levels: 10 });

      // POC should be around 110-115 area where high volume candle traded
      expect(result.poc).toBeGreaterThanOrEqual(110);
      expect(result.poc).toBeLessThanOrEqual(120);
    });

    it("should return POC within price range", () => {
      const candles = createUniformCandles(10);
      const result = volumeProfile(candles);

      expect(result.poc).toBeGreaterThanOrEqual(result.periodLow);
      expect(result.poc).toBeLessThanOrEqual(result.periodHigh);
    });
  });

  describe("Value Area calculation", () => {
    it("should calculate VAH and VAL", () => {
      const candles = createUniformCandles(20);
      const result = volumeProfile(candles, { valueAreaPercent: 0.7 });

      expect(result.vah).toBeGreaterThan(0);
      expect(result.val).toBeGreaterThan(0);
      expect(result.vah).toBeGreaterThan(result.val);
    });

    it("should have VAL <= POC <= VAH", () => {
      const candles = createUniformCandles(20);
      const result = volumeProfile(candles);

      expect(result.val).toBeLessThanOrEqual(result.poc);
      expect(result.poc).toBeLessThanOrEqual(result.vah);
    });

    it("should respect valueAreaPercent setting", () => {
      const candles = createUniformCandles(30);

      // Smaller value area percentage should result in tighter range
      const result50 = volumeProfile(candles, { valueAreaPercent: 0.5 });
      const result90 = volumeProfile(candles, { valueAreaPercent: 0.9 });

      const range50 = result50.vah - result50.val;
      const range90 = result90.vah - result90.val;

      expect(range90).toBeGreaterThanOrEqual(range50);
    });

    it("should contain Value Area within period range", () => {
      const candles = createUniformCandles(20);
      const result = volumeProfile(candles);

      expect(result.val).toBeGreaterThanOrEqual(result.periodLow);
      expect(result.vah).toBeLessThanOrEqual(result.periodHigh);
    });
  });

  describe("volume levels", () => {
    it("should have correct level structure", () => {
      const candles = createUniformCandles(10);
      const result = volumeProfile(candles, { levels: 10 });

      for (const level of result.levels) {
        expect(level).toHaveProperty("priceLow");
        expect(level).toHaveProperty("priceHigh");
        expect(level).toHaveProperty("priceMid");
        expect(level).toHaveProperty("volume");
        expect(level).toHaveProperty("volumePercent");
      }
    });

    it("should have levels that sum to 100% volume", () => {
      const candles = createUniformCandles(20);
      const result = volumeProfile(candles);

      const totalPercent = result.levels.reduce((sum, l) => sum + l.volumePercent, 0);
      expect(totalPercent).toBeCloseTo(100, 1);
    });

    it("should have contiguous price levels", () => {
      const candles = createUniformCandles(10);
      const result = volumeProfile(candles, { levels: 10 });

      for (let i = 1; i < result.levels.length; i++) {
        expect(result.levels[i].priceLow).toBeCloseTo(result.levels[i - 1].priceHigh, 5);
      }
    });

    it("should have priceMid between priceLow and priceHigh", () => {
      const candles = createUniformCandles(10);
      const result = volumeProfile(candles);

      for (const level of result.levels) {
        expect(level.priceMid).toBeGreaterThan(level.priceLow);
        expect(level.priceMid).toBeLessThan(level.priceHigh);
      }
    });
  });

  describe("period handling", () => {
    it("should use only last N candles when period is specified", () => {
      const candles = createCandles([
        { high: 50, low: 40, close: 45, volume: 1000 }, // Old data at lower price
        { high: 55, low: 45, close: 50, volume: 1000 },
        { high: 110, low: 100, close: 105, volume: 100 }, // Recent data at higher price
        { high: 115, low: 105, close: 110, volume: 100 },
        { high: 120, low: 110, close: 115, volume: 100 },
      ]);

      const resultAll = volumeProfile(candles);
      const resultLast3 = volumeProfile(candles, { period: 3 });

      // Period=3 should only use last 3 candles (higher price range)
      expect(resultLast3.periodLow).toBeGreaterThan(resultAll.periodLow);
    });

    it("should use all candles when period is not specified", () => {
      const candles = createUniformCandles(50);
      const result = volumeProfile(candles);

      // Total volume should include all candles
      const totalVolume = result.levels.reduce((sum, l) => sum + l.volume, 0);
      expect(totalVolume).toBeCloseTo(50 * 100, 1); // 50 candles * 100 volume each
    });
  });

  describe("edge cases", () => {
    it("should handle single candle", () => {
      const candles = createUniformCandles(1);
      const result = volumeProfile(candles);

      expect(result.poc).toBeGreaterThan(0);
      expect(result.levels.length).toBeGreaterThan(0);
    });

    it("should handle all same prices", () => {
      const candles = createCandles([
        { high: 100, low: 100, close: 100, volume: 100 },
        { high: 100, low: 100, close: 100, volume: 100 },
        { high: 100, low: 100, close: 100, volume: 100 },
      ]);

      const result = volumeProfile(candles);
      expect(result.poc).toBe(100);
    });

    it("should handle zero volumes", () => {
      const candles = createCandles([
        { high: 110, low: 100, close: 105, volume: 0 },
        { high: 115, low: 105, close: 110, volume: 0 },
      ]);

      const result = volumeProfile(candles);
      expect(result).toBeDefined();
    });

    it("should handle very wide price range", () => {
      const candles = createCandles([
        { high: 10, low: 5, close: 8, volume: 100 },
        { high: 1000, low: 500, close: 750, volume: 100 },
      ]);

      const result = volumeProfile(candles, { levels: 24 });
      expect(result.levels).toHaveLength(24);
    });
  });
});

describe("volumeProfileSeries", () => {
  describe("basic functionality", () => {
    it("should return empty array for empty input", () => {
      const result = volumeProfileSeries([]);
      expect(result).toEqual([]);
    });

    it("should return series with same length as input", () => {
      const candles = createUniformCandles(30);
      const result = volumeProfileSeries(candles, { period: 10 });
      expect(result).toHaveLength(30);
    });

    it("should return null values before period is reached", () => {
      const candles = createUniformCandles(15);
      const result = volumeProfileSeries(candles, { period: 10 });

      for (let i = 0; i < 9; i++) {
        expect(result[i].value).toBeNull();
      }
      expect(result[9].value).not.toBeNull();
    });
  });

  describe("rolling window behavior", () => {
    it("should calculate profile for each candle using rolling window", () => {
      const candles = createUniformCandles(20);
      const result = volumeProfileSeries(candles, { period: 10 });

      // Check that each valid result has profile data
      for (let i = 9; i < result.length; i++) {
        const profile = result[i].value;
        expect(profile).not.toBeNull();
        expect(profile?.poc).toBeGreaterThan(0);
        expect(profile?.levels.length).toBeGreaterThan(0);
      }
    });

    it("should have different values as window slides over different data", () => {
      // Create candles with changing price levels
      const candles = createCandles([
        ...Array(10)
          .fill(null)
          .map(() => ({ high: 110, low: 100, close: 105, volume: 100 })),
        ...Array(10)
          .fill(null)
          .map(() => ({ high: 160, low: 150, close: 155, volume: 100 })),
      ]);

      const result = volumeProfileSeries(candles, { period: 10 });

      // POC should change as window moves from low price area to high price area
      const pocAt10 = result[9].value?.poc;
      const pocAt19 = result[19].value?.poc;

      expect(pocAt10).toBeDefined();
      expect(pocAt19).toBeDefined();
      expect(pocAt19).toBeGreaterThan(pocAt10!);
    });
  });

  describe("time preservation", () => {
    it("should preserve candle timestamps", () => {
      const candles = createUniformCandles(15);
      const result = volumeProfileSeries(candles, { period: 10 });

      for (let i = 0; i < candles.length; i++) {
        expect(result[i].time).toBe(candles[i].time);
      }
    });
  });

  describe("options inheritance", () => {
    it("should respect levels option", () => {
      const candles = createUniformCandles(15);
      const result = volumeProfileSeries(candles, { period: 10, levels: 12 });

      const validProfile = result[10].value;
      expect(validProfile?.levels).toHaveLength(12);
    });

    it("should respect valueAreaPercent option", () => {
      const candles = createUniformCandles(20);

      const result70 = volumeProfileSeries(candles, { period: 10, valueAreaPercent: 0.7 });
      const result50 = volumeProfileSeries(candles, { period: 10, valueAreaPercent: 0.5 });

      const profile70 = result70[15].value!;
      const profile50 = result50[15].value!;

      const range70 = profile70.vah - profile70.val;
      const range50 = profile50.vah - profile50.val;

      // 70% should have wider value area than 50%
      expect(range70).toBeGreaterThanOrEqual(range50);
    });
  });
});

describe("zero-range bars", () => {
  const flat = (prices: number[], volumes: number[]) =>
    createCandles(prices.map((p, i) => ({ high: p, low: p, close: p, volume: volumes[i] })));
  const binVolumes = (candles: NormalizedCandle[]) =>
    volumeProfile(candles, { levels: 4 }).levels.map((l) => l.volume);

  it("puts all of a flat bar's volume in the level at its price", () => {
    // Bins of 2.5 from 100: [100,102.5) [102.5,105) [105,107.5) [107.5,110].
    // These flat bars used to reach no bin at all.
    expect(binVolumes(flat([100, 110, 100, 110], [0, 1000, 0, 1000]))).toEqual([0, 0, 0, 2000]);
    expect(binVolumes(flat([100, 105, 110], [0, 1000, 0]))).toEqual([0, 0, 1000, 0]);
  });

  it("keeps every unit of window volume when flat and ranged bars mix", () => {
    const candles = [
      ...createCandles([{ high: 102, low: 98, close: 100, volume: 500 }]),
      ...flat([110], [1000]).map((c) => ({ ...c, time: c.time + 86_400_000 })),
    ];
    const levels = volumeProfile(candles, { levels: 4 }).levels;
    expect(levels.reduce((sum, l) => sum + l.volume, 0)).toBeCloseTo(1500, 9);
    expect(levels[3].volume).toBe(1000);
  });

  it("gives the single profile and the rolling series the same answer on a window", () => {
    const candles = createCandles(
      [100, 103, 110, 103, 106, 101, 110, 104].map((p, i) => ({
        // every other bar is flat
        high: i % 2 === 0 ? p : p + 2,
        low: i % 2 === 0 ? p : p - 2,
        close: p,
        volume: 100 * (i + 1),
      })),
    );
    const period = 4;
    const series = volumeProfileSeries(candles, { period, levels: 6 });
    for (let end = period; end <= candles.length; end++) {
      const single = volumeProfile(candles.slice(0, end), { period, levels: 6 });
      expect(series[end - 1].value).toEqual(single);
    }
  });
});

describe("period validation", () => {
  const candles = createUniformCandles(10);

  it("rejects a period that is not a positive integer in both entry points", () => {
    for (const period of [2.5, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => volumeProfile(candles, { period }), String(period)).toThrow(/period/);
      expect(() => volumeProfileSeries(candles, { period }), String(period)).toThrow(/period/);
    }
  });

  it("still reads an omitted period as all candles", () => {
    expect(volumeProfile(candles).levels.reduce((s, l) => s + l.volume, 0)).toBeCloseTo(1000, 9);
  });
});
