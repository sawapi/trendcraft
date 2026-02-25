import { describe, expect, it } from "vitest";
import { IndicatorCache, createCachedIndicators } from "../indicator-cache";

describe("IndicatorCache", () => {
  describe("get / set", () => {
    it("returns undefined for missing key", () => {
      const cache = new IndicatorCache();
      const candles = [{ time: 1 }];
      expect(cache.get("sma_20", candles)).toBeUndefined();
    });

    it("stores and retrieves a value", () => {
      const cache = new IndicatorCache();
      const candles = [{ time: 1 }];
      const smaValues = [1, 2, 3];

      cache.set("sma_20", candles, smaValues);
      expect(cache.get<number[]>("sma_20", candles)).toBe(smaValues);
    });

    it("returns undefined for same key but different candle reference", () => {
      const cache = new IndicatorCache();
      const candles1 = [{ time: 1 }];
      const candles2 = [{ time: 1 }];

      cache.set("sma_20", candles1, [1, 2, 3]);
      expect(cache.get("sma_20", candles2)).toBeUndefined();
    });

    it("stores different values for different keys on same candles", () => {
      const cache = new IndicatorCache();
      const candles = [{ time: 1 }];

      cache.set("sma_20", candles, [10, 20]);
      cache.set("rsi_14", candles, [50, 60]);

      expect(cache.get<number[]>("sma_20", candles)).toEqual([10, 20]);
      expect(cache.get<number[]>("rsi_14", candles)).toEqual([50, 60]);
    });

    it("stores values for different candle arrays independently", () => {
      const cache = new IndicatorCache();
      const candlesA = [{ time: 1 }];
      const candlesB = [{ time: 2 }];

      cache.set("sma_20", candlesA, [100]);
      cache.set("sma_20", candlesB, [200]);

      expect(cache.get<number[]>("sma_20", candlesA)).toEqual([100]);
      expect(cache.get<number[]>("sma_20", candlesB)).toEqual([200]);
    });

    it("overwrites existing value for same key and candles", () => {
      const cache = new IndicatorCache();
      const candles = [{ time: 1 }];

      cache.set("sma_20", candles, [1]);
      cache.set("sma_20", candles, [2]);

      expect(cache.get<number[]>("sma_20", candles)).toEqual([2]);
    });
  });

  describe("size", () => {
    it("returns 0 for empty cache", () => {
      const cache = new IndicatorCache();
      expect(cache.size).toBe(0);
    });

    it("counts unique indicator keys", () => {
      const cache = new IndicatorCache();
      const candles = [{ time: 1 }];

      cache.set("sma_20", candles, [1]);
      expect(cache.size).toBe(1);

      cache.set("rsi_14", candles, [50]);
      expect(cache.size).toBe(2);
    });

    it("does not increase for same key with different candles", () => {
      const cache = new IndicatorCache();
      const candlesA = [{ time: 1 }];
      const candlesB = [{ time: 2 }];

      cache.set("sma_20", candlesA, [1]);
      cache.set("sma_20", candlesB, [2]);

      expect(cache.size).toBe(1);
    });
  });

  describe("clear", () => {
    it("removes all cached data", () => {
      const cache = new IndicatorCache();
      const candles = [{ time: 1 }];

      cache.set("sma_20", candles, [1]);
      cache.set("rsi_14", candles, [50]);
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("sma_20", candles)).toBeUndefined();
      expect(cache.get("rsi_14", candles)).toBeUndefined();
    });
  });
});

describe("createCachedIndicators", () => {
  it("returns plain object when no cache provided", () => {
    const candles = [{ time: 1 }];
    const indicators = createCachedIndicators(candles);

    indicators["sma_20"] = [1, 2, 3];
    expect(indicators["sma_20"]).toEqual([1, 2, 3]);
  });

  it("returns Proxy when cache provided", () => {
    const cache = new IndicatorCache();
    const candles = [{ time: 1 }];
    const indicators = createCachedIndicators(candles, cache);

    indicators["sma_20"] = [10, 20, 30];

    // Value accessible through proxy
    expect(indicators["sma_20"]).toEqual([10, 20, 30]);
    // Value also stored in shared cache
    expect(cache.get<number[]>("sma_20", candles)).toEqual([10, 20, 30]);
  });

  it("reads from shared cache when local value is missing", () => {
    const cache = new IndicatorCache();
    const candles = [{ time: 1 }];

    // Pre-populate cache
    cache.set("rsi_14", candles, [55, 60, 65]);

    const indicators = createCachedIndicators(candles, cache);

    // Should read from cache even though nothing was set locally
    expect(indicators["rsi_14"]).toEqual([55, 60, 65]);
  });

  it("prefers local value over shared cache", () => {
    const cache = new IndicatorCache();
    const candles = [{ time: 1 }];

    cache.set("sma_20", candles, [100]);

    const indicators = createCachedIndicators(candles, cache);
    // First read populates local from cache
    expect(indicators["sma_20"]).toEqual([100]);

    // Update cache directly with different value
    cache.set("sma_20", candles, [999]);

    // Local value should still be returned (was cached locally on first read)
    expect(indicators["sma_20"]).toEqual([100]);
  });

  it("returns undefined for keys not in local or cache", () => {
    const cache = new IndicatorCache();
    const candles = [{ time: 1 }];
    const indicators = createCachedIndicators(candles, cache);

    expect(indicators["nonexistent"]).toBeUndefined();
  });

  it("shares data between multiple proxy instances on same candles", () => {
    const cache = new IndicatorCache();
    const candles = [{ time: 1 }];

    const indicators1 = createCachedIndicators(candles, cache);
    const indicators2 = createCachedIndicators(candles, cache);

    // Write through first proxy
    indicators1["sma_20"] = [10, 20];

    // Read through second proxy (should find in shared cache)
    expect(indicators2["sma_20"]).toEqual([10, 20]);
  });

  it("does not share data between different candle references", () => {
    const cache = new IndicatorCache();
    const candlesA = [{ time: 1 }];
    const candlesB = [{ time: 2 }];

    const indicatorsA = createCachedIndicators(candlesA, cache);
    const indicatorsB = createCachedIndicators(candlesB, cache);

    indicatorsA["sma_20"] = [10];
    expect(indicatorsB["sma_20"]).toBeUndefined();
  });
});
