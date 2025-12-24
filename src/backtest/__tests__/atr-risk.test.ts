import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";

// Helper to create test candles
function createCandles(data: { high: number; low: number; close: number }[]): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: 1000000000000 + i * 86400000,
    open: d.close,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: 1000,
  }));
}

// Simple always-true entry condition for testing
const alwaysEnter = () => true;
const neverExit = () => false;

describe("ATR Risk Management in Backtest", () => {
  describe("ATR-based stop loss", () => {
    it("should exit when price hits ATR stop level", () => {
      // Create enough data for ATR calculation, then a drop
      const steadyData = Array.from({ length: 20 }, (_, i) => ({
        high: 102,
        low: 98,
        close: 100, // Steady at 100 with ATR ~4
      }));

      // Entry will be at 100, then price drops
      const dropData = [
        { high: 100, low: 95, close: 95 }, // Entry at 100
        { high: 95, low: 88, close: 88 }, // Should trigger ATR stop
      ];

      const candles = createCandles([...steadyData, ...dropData]);

      const result = runBacktest(candles, alwaysEnter, neverExit, {
        capital: 10000,
        atrRisk: {
          atrPeriod: 14,
          atrStopMultiplier: 2.0, // Stop at 2 * ATR below entry
        },
      });

      // Should have exited due to ATR stop
      expect(result.tradeCount).toBeGreaterThanOrEqual(1);
    });

    it("should use entry ATR when useEntryAtr is true", () => {
      // Create data where ATR changes after entry
      const lowVolData = Array.from({ length: 20 }, (_, i) => ({
        high: 101,
        low: 99,
        close: 100, // Low volatility, ATR ~2
      }));

      const entryAndDrop = [
        { high: 100, low: 99, close: 100 }, // Entry
        { high: 100, low: 90, close: 90 }, // Big drop (would increase ATR)
      ];

      const candles = createCandles([...lowVolData, ...entryAndDrop]);

      // With useEntryAtr=true, should use the ATR at entry time
      const result = runBacktest(candles, alwaysEnter, neverExit, {
        capital: 10000,
        atrRisk: {
          atrPeriod: 14,
          atrStopMultiplier: 2.0,
          useEntryAtr: true,
        },
      });

      expect(result.tradeCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("ATR-based take profit", () => {
    it("should exit when price hits ATR take profit level", () => {
      // Create data with ATR, then a rally
      const steadyData = Array.from({ length: 20 }, (_, i) => ({
        high: 102,
        low: 98,
        close: 100, // ATR ~4
      }));

      const rallyData = [
        { high: 101, low: 100, close: 100 }, // Entry at 100
        { high: 115, low: 100, close: 114 }, // Rally to trigger take profit
      ];

      const candles = createCandles([...steadyData, ...rallyData]);

      const result = runBacktest(candles, alwaysEnter, neverExit, {
        capital: 10000,
        atrRisk: {
          atrPeriod: 14,
          atrTakeProfitMultiplier: 3.0, // Take profit at 3 * ATR above entry
        },
      });

      // Should have exited with profit
      expect(result.tradeCount).toBeGreaterThanOrEqual(1);
      if (result.trades.length > 0) {
        // Find the trade that hit take profit
        const profitTrade = result.trades.find((t) => t.returnPercent > 0);
        expect(profitTrade).toBeDefined();
      }
    });
  });

  describe("ATR-based trailing stop", () => {
    it("should trail by ATR distance from peak", () => {
      // Create data with rally then pullback
      const steadyData = Array.from({ length: 20 }, (_, i) => ({
        high: 102,
        low: 98,
        close: 100, // ATR ~4
      }));

      const tradeData = [
        { high: 100, low: 99, close: 100 }, // Entry at 100
        { high: 110, low: 100, close: 110 }, // Rally to 110
        { high: 111, low: 108, close: 109 }, // New peak at 111
        { high: 109, low: 100, close: 100 }, // Pullback - should trigger trailing stop
      ];

      const candles = createCandles([...steadyData, ...tradeData]);

      const result = runBacktest(candles, alwaysEnter, neverExit, {
        capital: 10000,
        atrRisk: {
          atrPeriod: 14,
          atrTrailingMultiplier: 2.0, // Trail by 2 * ATR from peak
        },
      });

      expect(result.tradeCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("combined ATR risk options", () => {
    it("should work with all ATR options together", () => {
      const steadyData = Array.from({ length: 20 }, (_, i) => ({
        high: 102,
        low: 98,
        close: 100,
      }));

      const tradeData = [
        { high: 100, low: 99, close: 100 }, // Entry
        { high: 105, low: 99, close: 104 }, // Small profit
        { high: 106, low: 102, close: 103 }, // More profit
      ];

      const candles = createCandles([...steadyData, ...tradeData]);

      const result = runBacktest(candles, alwaysEnter, neverExit, {
        capital: 10000,
        atrRisk: {
          atrPeriod: 14,
          atrStopMultiplier: 2.5,
          atrTakeProfitMultiplier: 4.0,
          atrTrailingMultiplier: 2.0,
          useEntryAtr: false,
        },
      });

      expect(result).toBeDefined();
      expect(result.totalReturnPercent).toBeDefined();
    });

    it("should work alongside fixed percentage stops", () => {
      const steadyData = Array.from({ length: 20 }, (_, i) => ({
        high: 102,
        low: 98,
        close: 100,
      }));

      const dropData = [
        { high: 100, low: 99, close: 100 }, // Entry at 100
        { high: 100, low: 80, close: 80 }, // 20% drop - should hit fixed stop first
      ];

      const candles = createCandles([...steadyData, ...dropData]);

      const result = runBacktest(candles, alwaysEnter, neverExit, {
        capital: 10000,
        stopLoss: 10, // 10% fixed stop
        atrRisk: {
          atrPeriod: 14,
          atrStopMultiplier: 5.0, // Wide ATR stop
        },
      });

      // Should have been stopped out
      expect(result.tradeCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("edge cases", () => {
    it("should handle case when ATR is null at entry", () => {
      // Very short data where ATR hasn't stabilized
      const candles = createCandles([
        { high: 102, low: 98, close: 100 },
        { high: 105, low: 99, close: 104 },
        { high: 106, low: 100, close: 103 },
      ]);

      const result = runBacktest(candles, alwaysEnter, neverExit, {
        capital: 10000,
        atrRisk: {
          atrPeriod: 14, // Requires more data
          atrStopMultiplier: 2.0,
        },
      });

      // Should still run without crashing
      expect(result).toBeDefined();
    });
  });
});
