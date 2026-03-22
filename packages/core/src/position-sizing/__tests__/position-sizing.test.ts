import { describe, expect, it } from "vitest";
import { atrBasedSize, calculateAtrStopDistance, recommendedAtrMultiplier } from "../atr-based";
import { fixedFractionalSize, fractionForPositionCount, maxPositions } from "../fixed-fractional";
import { calculateKellyPercent, kellySize } from "../kelly";
import { calculateStopDistance, riskBasedSize, riskPerShare } from "../risk-based";

describe("Position Sizing", () => {
  describe("Risk-Based Sizing", () => {
    it("should calculate correct position size based on risk", () => {
      const result = riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        stopLossPrice: 48,
        riskPercent: 1,
      });

      // Risk $1000 (1% of 100k), stop distance $2
      // Shares = 1000 / 2 = 500
      expect(result.shares).toBe(500);
      expect(result.positionValue).toBe(25000); // 500 * 50
      expect(result.riskAmount).toBe(1000);
      expect(result.stopPrice).toBe(48);
      expect(result.method).toBe("risk-based");
    });

    it("should respect maxPositionPercent constraint", () => {
      const result = riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        stopLossPrice: 49.9, // Very tight stop = large position
        riskPercent: 1,
        maxPositionPercent: 10, // Cap at 10%
      });

      // Without cap: 1000 / 0.10 = 10000 shares = $500k position
      // With 10% cap: max $10k = 200 shares
      expect(result.shares).toBe(200);
      expect(result.positionValue).toBe(10000);
    });

    it("should return 0 when calculated shares are below minShares", () => {
      // If calculated shares < minShares, don't trade (return 0)
      const result = riskBasedSize({
        accountSize: 10000,
        entryPrice: 100,
        stopLossPrice: 95,
        riskPercent: 0.5, // $50 risk, $5 stop = 10 shares
        minShares: 20, // But minimum is 20
      });

      // Can't meet minimum, so don't trade
      expect(result.shares).toBe(0);
    });

    it("should return calculated shares when above minShares", () => {
      const result = riskBasedSize({
        accountSize: 100000,
        entryPrice: 100,
        stopLossPrice: 95,
        riskPercent: 1, // $1000 risk, $5 stop = 200 shares
        minShares: 50, // Minimum is 50
      });

      // 200 > 50, so trade is valid
      expect(result.shares).toBe(200);
    });

    it("should handle fractional shares when roundShares is false", () => {
      const result = riskBasedSize({
        accountSize: 100000,
        entryPrice: 33,
        stopLossPrice: 30,
        riskPercent: 1,
        roundShares: false,
      });

      // 1000 / 3 = 333.333...
      expect(result.shares).toBeCloseTo(333.333, 2);
    });

    it("should throw error for invalid stop loss", () => {
      expect(() =>
        riskBasedSize({
          accountSize: 100000,
          entryPrice: 50,
          stopLossPrice: 55, // Stop above entry for long
          riskPercent: 1,
        }),
      ).toThrow();
    });

    it("should handle short positions correctly", () => {
      const result = riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        stopLossPrice: 52, // Stop above entry for short
        riskPercent: 1,
        direction: "short",
      });

      expect(result.shares).toBe(500);
      expect(result.stopPrice).toBe(52);
    });

    describe("utility functions", () => {
      it("calculateStopDistance should return absolute distance", () => {
        expect(calculateStopDistance(50, 48)).toBe(2);
        expect(calculateStopDistance(48, 50)).toBe(2); // Absolute
      });

      it("riskPerShare should return risk per share", () => {
        expect(riskPerShare(1000, 500)).toBe(2);
      });
    });
  });

  describe("ATR-Based Sizing", () => {
    it("should calculate correct position size based on ATR", () => {
      const result = atrBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        atrValue: 2.5,
        atrMultiplier: 2,
        riskPercent: 1,
      });

      // Stop distance = 2.5 * 2 = 5
      // Risk $1000 / $5 = 200 shares
      expect(result.shares).toBe(200);
      expect(result.positionValue).toBe(10000);
      expect(result.stopPrice).toBe(45); // 50 - 5
    });

    it("should handle short positions", () => {
      const result = atrBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        atrValue: 2.5,
        atrMultiplier: 2,
        riskPercent: 1,
        direction: "short",
      });

      expect(result.stopPrice).toBe(55); // 50 + 5
    });

    it("should throw for zero or negative ATR", () => {
      expect(() =>
        atrBasedSize({
          accountSize: 100000,
          entryPrice: 50,
          atrValue: 0,
          atrMultiplier: 2,
          riskPercent: 1,
        }),
      ).toThrow();
    });

    describe("utility functions", () => {
      it("calculateAtrStopDistance should return ATR-based distance", () => {
        expect(calculateAtrStopDistance(2.5, 2)).toBe(5);
      });

      it("recommendedAtrMultiplier should return reasonable values", () => {
        expect(recommendedAtrMultiplier("conservative")).toBeGreaterThanOrEqual(2);
        expect(recommendedAtrMultiplier("moderate")).toBeGreaterThan(1);
        expect(recommendedAtrMultiplier("aggressive")).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Kelly Criterion", () => {
    it("should calculate correct Kelly percentage", () => {
      // 60% win rate, 1.5 win/loss ratio
      // Kelly = 0.6 - 0.4/1.5 = 0.6 - 0.267 = 0.333 = 33.3%
      const kelly = calculateKellyPercent(0.6, 1.5);
      expect(kelly).toBeCloseTo(33.33, 1);
    });

    it("should return 0 for negative edge", () => {
      // 40% win rate, 1.0 win/loss ratio
      // Kelly = 0.4 - 0.6/1.0 = -0.2 (clamped to 0)
      const kelly = calculateKellyPercent(0.4, 1.0);
      expect(kelly).toBe(0);
    });

    it("should calculate position size with half Kelly", () => {
      const result = kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: 0.6,
        winLossRatio: 1.5,
        kellyFraction: 0.5, // Half Kelly
      });

      // Full Kelly = 33.3%, Half = 16.67%
      // Position = 100000 * 0.1667 = 16670
      // Shares = 16670 / 50 = 333
      expect(result.shares).toBe(333);
      expect(result.method).toBe("kelly");
    });

    it("should respect maxKellyPercent cap", () => {
      const result = kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: 0.8, // Very high win rate
        winLossRatio: 2.0, // Great ratio = very high Kelly
        kellyFraction: 1.0, // Full Kelly
        maxKellyPercent: 20, // But cap at 20%
      });

      // Position should be capped at 20% = $20000 = 400 shares
      expect(result.shares).toBe(400);
    });

    it("should return 0 shares for negative edge", () => {
      const result = kellySize({
        accountSize: 100000,
        entryPrice: 50,
        winRate: 0.3, // Low win rate
        winLossRatio: 0.8, // Poor ratio
      });

      expect(result.shares).toBe(0);
    });

    it("should throw for invalid win rate", () => {
      expect(() =>
        kellySize({
          accountSize: 100000,
          entryPrice: 50,
          winRate: 1.5, // Invalid
          winLossRatio: 1.0,
        }),
      ).toThrow();
    });
  });

  describe("Fixed Fractional", () => {
    it("should allocate fixed percentage of account", () => {
      const result = fixedFractionalSize({
        accountSize: 100000,
        entryPrice: 50,
        fractionPercent: 10,
      });

      // 10% of 100k = 10000 / 50 = 200 shares
      expect(result.shares).toBe(200);
      expect(result.positionValue).toBe(10000);
      expect(result.method).toBe("fixed-fractional");
    });

    it("should respect maxPositionPercent", () => {
      const result = fixedFractionalSize({
        accountSize: 100000,
        entryPrice: 50,
        fractionPercent: 30,
        maxPositionPercent: 20,
      });

      // Would be 30% but capped at 20%
      expect(result.shares).toBe(400); // 20000 / 50
    });

    it("should throw for invalid fraction", () => {
      expect(() =>
        fixedFractionalSize({
          accountSize: 100000,
          entryPrice: 50,
          fractionPercent: 0,
        }),
      ).toThrow();

      expect(() =>
        fixedFractionalSize({
          accountSize: 100000,
          entryPrice: 50,
          fractionPercent: 150,
        }),
      ).toThrow();
    });

    describe("utility functions", () => {
      it("maxPositions should calculate positions that fit", () => {
        expect(maxPositions(100000, 10)).toBe(10);
        expect(maxPositions(100000, 25)).toBe(4);
        expect(maxPositions(100000, 33.33)).toBe(3);
      });

      it("fractionForPositionCount should calculate fraction", () => {
        expect(fractionForPositionCount(5)).toBe(20);
        expect(fractionForPositionCount(10)).toBe(10);
      });

      it("fractionForPositionCount should throw for invalid input", () => {
        expect(() => fractionForPositionCount(0)).toThrow();
        expect(() => fractionForPositionCount(-1)).toThrow();
      });
    });
  });

  describe("Common Edge Cases", () => {
    it("should throw for zero account size", () => {
      expect(() =>
        riskBasedSize({
          accountSize: 0,
          entryPrice: 50,
          stopLossPrice: 48,
          riskPercent: 1,
        }),
      ).toThrow();
    });

    it("should throw for zero entry price", () => {
      expect(() =>
        fixedFractionalSize({
          accountSize: 100000,
          entryPrice: 0,
          fractionPercent: 10,
        }),
      ).toThrow();
    });

    it("should throw for negative entry price", () => {
      expect(() =>
        atrBasedSize({
          accountSize: 100000,
          entryPrice: -50,
          atrValue: 2,
          atrMultiplier: 2,
          riskPercent: 1,
        }),
      ).toThrow();
    });
  });

  describe("Result Properties", () => {
    it("should include all required properties in result", () => {
      const result = riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        stopLossPrice: 48,
        riskPercent: 1,
      });

      expect(result).toHaveProperty("shares");
      expect(result).toHaveProperty("positionValue");
      expect(result).toHaveProperty("riskAmount");
      expect(result).toHaveProperty("riskPercent");
      expect(result).toHaveProperty("stopPrice");
      expect(result).toHaveProperty("method");
    });

    it("should calculate correct riskPercent in result", () => {
      const result = riskBasedSize({
        accountSize: 100000,
        entryPrice: 50,
        stopLossPrice: 48,
        riskPercent: 1,
      });

      expect(result.riskPercent).toBe(1);
    });
  });
});
