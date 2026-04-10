/**
 * Export Verification Tests
 *
 * Ensures all public API entry points export the expected symbols.
 * These tests catch broken exports before publishing.
 */

import { describe, expect, it } from "vitest";

describe("Export verification", () => {
  describe("main entry (@trendcraft/chart)", () => {
    it("exports createChart function", async () => {
      const mod = await import("../index");
      expect(typeof mod.createChart).toBe("function");
    });

    it("exports theme constants", async () => {
      const mod = await import("../index");
      expect(mod.DARK_THEME).toBeDefined();
      expect(mod.LIGHT_THEME).toBeDefined();
    });

    it("exports plugin system", async () => {
      const mod = await import("../index");
      expect(typeof mod.defineSeriesRenderer).toBe("function");
      expect(typeof mod.definePrimitive).toBe("function");
      expect(typeof mod.SeriesRegistry).toBe("function");
      expect(typeof mod.RendererRegistry).toBe("function");
      expect(typeof mod.DrawHelper).toBe("function");
    });

    it("exports live feed integration", async () => {
      const mod = await import("../index");
      expect(typeof mod.connectLiveFeed).toBe("function");
      expect(typeof mod.connectIndicators).toBe("function");
    });

    it("exports i18n utilities", async () => {
      const mod = await import("../index");
      expect(typeof mod.mergeLocale).toBe("function");
      expect(mod.DEFAULT_LOCALE).toBeDefined();
    });

    it("exports visualization plugins", async () => {
      const mod = await import("../index");
      expect(typeof mod.createRegimeHeatmap).toBe("function");
      expect(typeof mod.createSmcLayer).toBe("function");
      expect(typeof mod.createWyckoffPhase).toBe("function");
      expect(typeof mod.createSrConfluence).toBe("function");
      expect(typeof mod.createTradeAnalysis).toBe("function");
      expect(typeof mod.createSessionZones).toBe("function");
    });
  });

  describe("headless entry (@trendcraft/chart/headless)", () => {
    it("exports core data classes", async () => {
      const mod = await import("../headless");
      expect(typeof mod.DataLayer).toBe("function");
      expect(typeof mod.TimeScale).toBe("function");
      expect(typeof mod.PriceScale).toBe("function");
      expect(typeof mod.LayoutEngine).toBe("function");
      expect(typeof mod.Viewport).toBe("function");
    });

    it("exports format utilities", async () => {
      const mod = await import("../headless");
      expect(typeof mod.autoFormatPrice).toBe("function");
      expect(typeof mod.autoFormatTime).toBe("function");
      expect(typeof mod.formatCrosshairTime).toBe("function");
      expect(typeof mod.formatVolume).toBe("function");
      expect(typeof mod.detectPrecision).toBe("function");
      expect(typeof mod.fixedPriceFormatter).toBe("function");
    });

    it("exports decimation functions", async () => {
      const mod = await import("../headless");
      expect(typeof mod.lttb).toBe("function");
      expect(typeof mod.decimateCandles).toBe("function");
      expect(typeof mod.getDecimationTarget).toBe("function");
    });

    it("exports introspection and presets", async () => {
      const mod = await import("../headless");
      expect(typeof mod.introspect).toBe("function");
      expect(mod.INDICATOR_PRESETS).toBeDefined();
      expect(typeof mod.SeriesRegistry).toBe("function");
      expect(mod.defaultRegistry).toBeDefined();
    });

    it("exports theme constants", async () => {
      const mod = await import("../headless");
      expect(mod.DARK_THEME).toBeDefined();
      expect(mod.LIGHT_THEME).toBeDefined();
    });

    it("exports live feed integration", async () => {
      const mod = await import("../headless");
      expect(typeof mod.connectLiveFeed).toBe("function");
    });
  });

  describe("react entry (@trendcraft/chart/react)", () => {
    it("exports TrendChart component", async () => {
      const mod = await import("../../react/TrendChart");
      expect(mod.TrendChart).toBeDefined();
    });
  });

  describe("vue entry (@trendcraft/chart/vue)", () => {
    it("exports TrendChart component", async () => {
      const mod = await import("../../vue/TrendChart");
      expect(mod.TrendChart).toBeDefined();
    });
  });
});
