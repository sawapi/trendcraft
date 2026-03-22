import { describe, expect, it } from "vitest";
import { sma } from "../../indicators/moving-average/sma";
import {
  atr as atrPlugin,
  macd as macdPlugin,
  rsi as rsiPlugin,
  sma as smaPlugin,
} from "../../indicators/plugins";
import type { NormalizedCandle, Series } from "../../types";
import { defineIndicator } from "../../types/plugin";
import type { IndicatorPlugin } from "../../types/plugin";
import { TrendCraft, TrendCraftMtf } from "../trendcraft";

// Helper to create simple candles
const makeCandles = (closes: number[]): NormalizedCandle[] =>
  closes.map((close, i) => ({
    time: 1700000000000 + i * 86400000,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000 + i * 100,
  }));

describe("Plugin System", () => {
  describe("defineIndicator", () => {
    it("should create a valid plugin definition", () => {
      const plugin = defineIndicator({
        name: "testSma" as const,
        compute: (candles, opts) => sma(candles, { period: opts.period }),
        defaultOptions: { period: 10 },
      });

      expect(plugin.name).toBe("testSma");
      expect(plugin.defaultOptions).toEqual({ period: 10 });
      expect(typeof plugin.compute).toBe("function");
    });

    it("should support custom buildKey", () => {
      const plugin = defineIndicator({
        name: "custom" as const,
        compute: (candles, opts) => sma(candles, { period: opts.period }),
        defaultOptions: { period: 20 },
        buildKey: (opts) => `myKey_${opts.period}`,
      });

      expect(plugin.buildKey?.({ period: 50 })).toBe("myKey_50");
    });
  });

  describe("TrendCraft.use()", () => {
    const candles = makeCandles([10, 20, 30, 40, 50, 60, 70]);

    it("should compute a custom plugin indicator", () => {
      const doubleClose = defineIndicator({
        name: "doubleClose" as const,
        compute: (candles) => candles.map((c) => ({ time: c.time, value: c.close * 2 })),
        defaultOptions: {},
      });

      const result = TrendCraft.from(candles).use(doubleClose).compute();

      expect(result.indicators["doubleClose_{}"]).toBeDefined();
      expect(result.indicators["doubleClose_{}"][0].value).toBe(20); // 10 * 2
      expect(result.indicators["doubleClose_{}"][6].value).toBe(140); // 70 * 2
    });

    it("should use custom buildKey for cache key", () => {
      const customSma = defineIndicator({
        name: "customSma" as const,
        compute: (candles, opts) => sma(candles, { period: opts.period }),
        defaultOptions: { period: 3 },
        buildKey: (opts) => `csma${opts.period}`,
      });

      const result = TrendCraft.from(candles).use(customSma, { period: 5 }).compute();

      expect(result.indicators.csma5).toBeDefined();
      expect(result.indicators.csma5).toHaveLength(7);
    });

    it("should merge partial options with defaults", () => {
      const customInd = defineIndicator({
        name: "test" as const,
        compute: (candles, opts) => sma(candles, { period: opts.period }),
        defaultOptions: { period: 10, source: "close" as const },
        buildKey: (opts) => `test_${opts.period}_${opts.source}`,
      });

      const result = TrendCraft.from(candles).use(customInd, { period: 3 }).compute();

      // Should use default source="close" and overridden period=3
      expect(result.indicators.test_3_close).toBeDefined();
    });

    it("should use default options when no options provided", () => {
      const result = TrendCraft.from(candles).use(smaPlugin).compute();

      // smaPlugin defaults: { period: 20, source: "close" } → key: sma20
      expect(result.indicators.sma20).toBeDefined();
    });

    it("should support chaining .use() with shorthands", () => {
      const customInd = defineIndicator({
        name: "dbl" as const,
        compute: (candles) => candles.map((c) => ({ time: c.time, value: c.close * 2 })),
        defaultOptions: {},
        buildKey: () => "dbl",
      });

      const result = TrendCraft.from(candles).sma(3).use(customInd).ema(3).compute();

      expect(result.indicators.sma3).toBeDefined();
      expect(result.indicators.dbl).toBeDefined();
      expect(result.indicators.ema3).toBeDefined();
    });
  });

  describe("Built-in plugins", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const candles = makeCandles(closes);

    it("should produce identical results via shorthand and .use()", () => {
      const shorthand = TrendCraft.from(candles).sma(5).compute();
      const plugin = TrendCraft.from(candles).use(smaPlugin, { period: 5 }).compute();

      expect(shorthand.indicators.sma5).toEqual(plugin.indicators.sma5);
    });

    it("rsiPlugin should match rsi shorthand", () => {
      const shorthand = TrendCraft.from(candles).rsi(14).compute();
      const plugin = TrendCraft.from(candles).use(rsiPlugin, { period: 14 }).compute();

      expect(shorthand.indicators.rsi14).toEqual(plugin.indicators.rsi14);
    });

    it("macdPlugin should match macd shorthand", () => {
      const shorthand = TrendCraft.from(candles).macd(12, 26, 9).compute();
      const plugin = TrendCraft.from(candles)
        .use(macdPlugin, { fast: 12, slow: 26, signal: 9 })
        .compute();

      expect(shorthand.indicators.macd_12_26_9).toEqual(plugin.indicators.macd_12_26_9);
    });

    it("atrPlugin should match atr shorthand", () => {
      const shorthand = TrendCraft.from(candles).atr(14).compute();
      const plugin = TrendCraft.from(candles).use(atrPlugin, { period: 14 }).compute();

      expect(shorthand.indicators.atr14).toEqual(plugin.indicators.atr14);
    });
  });

  describe("Cache behavior", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);

    it("should cache results for same key", () => {
      const tc = TrendCraft.from(candles).sma(3);
      const result1 = tc.compute();
      const result2 = tc.compute();

      // Same reference (cached)
      expect(result1.indicators.sma3).toBe(result2.indicators.sma3);
    });

    it("should cache custom plugin results", () => {
      const callCount = { value: 0 };
      const counting = defineIndicator({
        name: "counting" as const,
        compute: (candles) => {
          callCount.value++;
          return candles.map((c) => ({ time: c.time, value: c.close }));
        },
        defaultOptions: {},
        buildKey: () => "counting",
      });

      const tc = TrendCraft.from(candles).use(counting);
      tc.compute();
      tc.compute();

      // compute should only be called once (cached after first call)
      expect(callCount.value).toBe(1);
    });

    it("should clear plugin cache on clearCache()", () => {
      const callCount = { value: 0 };
      const counting = defineIndicator({
        name: "cnt" as const,
        compute: (candles) => {
          callCount.value++;
          return candles.map((c) => ({ time: c.time, value: c.close }));
        },
        defaultOptions: {},
        buildKey: () => "cnt",
      });

      const tc = TrendCraft.from(candles).use(counting);
      tc.compute();
      tc.clearCache();
      tc.compute();

      expect(callCount.value).toBe(2);
    });
  });

  describe("get() with plugins", () => {
    it("should retrieve plugin result by key", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const custom = defineIndicator({
        name: "myInd" as const,
        compute: (candles) => candles.map((c) => ({ time: c.time, value: c.close + 1 })),
        defaultOptions: {},
        buildKey: () => "myInd",
      });

      const tc = TrendCraft.from(candles).use(custom);
      const series = tc.get("myInd");

      expect(series).toBeDefined();
      expect(series?.[0].value).toBe(11); // 10 + 1
    });
  });

  describe("TrendCraftMtf.use()", () => {
    it("should preserve MTF context when using plugins", () => {
      const candles = makeCandles(Array.from({ length: 200 }, (_, i) => 100 + i));
      const mtf = TrendCraft.from(candles).withMtf(["weekly"]);

      expect(mtf).toBeInstanceOf(TrendCraftMtf);

      // .use() on MTF should preserve MTF type
      const withPlugin = mtf.use(smaPlugin, { period: 10 });
      expect(withPlugin).toBeInstanceOf(TrendCraftMtf);

      // strategy() should return MtfStrategyBuilder
      const strategy = withPlugin.strategy();
      expect(strategy).toBeDefined();
    });

    it("should chain .use() on MTF and compute", () => {
      const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
      const result = TrendCraft.from(candles)
        .withMtf(["weekly"])
        .use(smaPlugin, { period: 5 })
        .compute();

      expect(result.indicators.sma5).toBeDefined();
    });
  });

  describe("Type safety", () => {
    it("should accept IndicatorPlugin type", () => {
      // Type-level check: defineIndicator returns IndicatorPlugin
      const plugin: IndicatorPlugin<"test", { period: number }, number | null> = defineIndicator({
        name: "test" as const,
        compute: (candles, opts) => sma(candles, { period: opts.period }),
        defaultOptions: { period: 10 },
      });

      expect(plugin.name).toBe("test");
    });

    it("should allow re-export through package entry via plugins namespace", async () => {
      // Verify exports are accessible from the package root
      const mod = await import("../../index");

      expect(mod.defineIndicator).toBeDefined();
      expect(mod.plugins).toBeDefined();
      expect(mod.plugins.sma).toBeDefined();
      expect(mod.plugins.rsi).toBeDefined();
      expect(mod.plugins.macd).toBeDefined();
      expect(mod.plugins.atr).toBeDefined();
      expect(mod.plugins.bollingerBands).toBeDefined();
      expect(mod.plugins.volumeMa).toBeDefined();
      expect(mod.plugins.highest).toBeDefined();
      expect(mod.plugins.lowest).toBeDefined();
      expect(mod.plugins.returns).toBeDefined();
      expect(mod.plugins.parabolicSar).toBeDefined();
      expect(mod.plugins.keltnerChannel).toBeDefined();
      expect(mod.plugins.cmf).toBeDefined();
      expect(mod.plugins.volumeAnomaly).toBeDefined();
      expect(mod.plugins.volumeProfileSeries).toBeDefined();
      expect(mod.plugins.volumeTrend).toBeDefined();
    });
  });
});
