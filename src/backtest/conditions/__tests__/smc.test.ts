import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  priceAtBullishOrderBlock,
  priceAtBearishOrderBlock,
  priceAtOrderBlock,
  orderBlockCreated,
  orderBlockMitigated,
  hasActiveOrderBlocks,
  liquiditySweepDetected,
  liquiditySweepRecovered,
  hasRecentSweeps,
  sweepDepthAbove,
} from "../smc";

const makeCandles = (
  data: Array<{ o: number; h: number; l: number; c: number }>,
): NormalizedCandle[] =>
  data.map((d, i) => ({
    time: 1700000000000 + i * 86400000,
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: 1000,
  }));

describe("SMC Conditions", () => {
  describe("Order Block Conditions", () => {
    describe("priceAtBullishOrderBlock", () => {
      it("should return PresetCondition object", () => {
        const condition = priceAtBullishOrderBlock();
        expect(condition.type).toBe("preset");
        expect(condition.name).toBe("priceAtBullishOrderBlock");
        expect(typeof condition.evaluate).toBe("function");
      });

      it("should detect when price is at bullish OB zone", () => {
        // Create OB and then return to it
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 }, // 0
          { o: 101, h: 110, l: 100, c: 108 }, // 1 - swing high
          { o: 108, h: 107, l: 103, c: 104 }, // 2 - bearish
          { o: 104, h: 105, l: 100, c: 101 }, // 3 - bearish (OB: 100-105)
          { o: 101, h: 115, l: 106, c: 112 }, // 4 - BOS
          { o: 112, h: 118, l: 110, c: 116 }, // 5
          { o: 116, h: 117, l: 102, c: 108 }, // 6 - price dips into OB zone
        ]);

        const condition = priceAtBullishOrderBlock({ swingPeriod: 1, partialMitigation: false });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[6], 6, candles);
        expect(result).toBe(true);
      });
    });

    describe("priceAtBearishOrderBlock", () => {
      it("should return PresetCondition object", () => {
        const condition = priceAtBearishOrderBlock();
        expect(condition.type).toBe("preset");
        expect(condition.name).toBe("priceAtBearishOrderBlock");
      });

      it("should detect when price is at bearish OB zone", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 }, // 0
          { o: 101, h: 103, l: 90, c: 92 }, // 1 - swing low at 90
          { o: 92, h: 97, l: 91, c: 95 }, // 2 - bullish
          { o: 95, h: 100, l: 94, c: 99 }, // 3 - bullish (OB: 94-100)
          { o: 99, h: 93, l: 85, c: 86 }, // 4 - bearish BOS
          { o: 86, h: 88, l: 84, c: 87 }, // 5
          { o: 87, h: 97, l: 86, c: 93 }, // 6 - price rises into OB zone
        ]);

        const condition = priceAtBearishOrderBlock({ swingPeriod: 1, partialMitigation: false });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[6], 6, candles);
        expect(result).toBe(true);
      });
    });

    describe("priceAtOrderBlock", () => {
      it("should detect either bullish or bearish OB", () => {
        const condition = priceAtOrderBlock();
        expect(condition.name).toBe("priceAtOrderBlock");
      });
    });

    describe("orderBlockCreated", () => {
      it("should detect when new OB is created", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 110, l: 100, c: 108 }, // swing high
          { o: 108, h: 107, l: 103, c: 104 },
          { o: 104, h: 103, l: 100, c: 101 },
          { o: 101, h: 115, l: 108, c: 112 }, // BOS - OB created
        ]);

        const condition = orderBlockCreated("bullish", { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        // BOS bar should have new OB
        const result = condition.evaluate(indicators, candles[4], 4, candles);
        expect(result).toBe(true);

        // Previous bar should not have new OB
        const result2 = condition.evaluate(indicators, candles[3], 3, candles);
        expect(result2).toBe(false);
      });

      it("should filter by type when specified", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 110, l: 100, c: 108 },
          { o: 108, h: 107, l: 103, c: 104 },
          { o: 104, h: 103, l: 100, c: 101 },
          { o: 101, h: 115, l: 108, c: 112 }, // Bullish BOS
        ]);

        // Check for bearish OB (should be false)
        const condition = orderBlockCreated("bearish", { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[4], 4, candles);
        expect(result).toBe(false);
      });
    });

    describe("orderBlockMitigated", () => {
      it("should detect when OB is mitigated", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 110, l: 100, c: 108 },
          { o: 108, h: 107, l: 103, c: 104 },
          { o: 104, h: 103, l: 100, c: 101 },
          { o: 101, h: 115, l: 108, c: 112 }, // OB created
          { o: 112, h: 118, l: 110, c: 116 },
          { o: 116, h: 117, l: 99, c: 102 }, // Price goes through OB zone
        ]);

        const condition = orderBlockMitigated("bullish", { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[6], 6, candles);
        expect(result).toBe(true);
      });
    });

    describe("hasActiveOrderBlocks", () => {
      it("should check for active OBs", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 110, l: 100, c: 108 },
          { o: 108, h: 107, l: 103, c: 104 },
          { o: 104, h: 103, l: 100, c: 101 },
          { o: 101, h: 115, l: 108, c: 112 }, // OB created
          { o: 112, h: 118, l: 110, c: 116 }, // OB still active
        ]);

        const condition = hasActiveOrderBlocks("bullish", 1, { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[5], 5, candles);
        expect(result).toBe(true);
      });
    });
  });

  describe("Liquidity Sweep Conditions", () => {
    describe("liquiditySweepDetected", () => {
      it("should return PresetCondition object", () => {
        const condition = liquiditySweepDetected();
        expect(condition.type).toBe("preset");
        expect(condition.name).toBe("liquiditySweepDetected(any)");
        expect(typeof condition.evaluate).toBe("function");
      });

      it("should detect bullish sweep", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 103, l: 101, c: 102 },
          { o: 102, h: 104, l: 90, c: 92 }, // swing low at 90
          { o: 92, h: 98, l: 91, c: 96 },
          { o: 96, h: 100, l: 95, c: 99 },
          { o: 99, h: 102, l: 98, c: 101 },
          { o: 101, h: 103, l: 100, c: 102 },
          { o: 102, h: 104, l: 85, c: 95 }, // sweep below 90, recovers above
        ]);

        const condition = liquiditySweepDetected("bullish", { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[7], 7, candles);
        expect(result).toBe(true);
      });

      it("should filter by type", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 103, l: 101, c: 102 },
          { o: 102, h: 104, l: 90, c: 92 }, // swing low
          { o: 92, h: 98, l: 91, c: 96 },
          { o: 96, h: 100, l: 95, c: 99 },
          { o: 99, h: 102, l: 98, c: 101 },
          { o: 101, h: 103, l: 100, c: 102 },
          { o: 102, h: 104, l: 85, c: 95 }, // bullish sweep
        ]);

        // Check for bearish sweep (should be false)
        const condition = liquiditySweepDetected("bearish", { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[7], 7, candles);
        expect(result).toBe(false);
      });
    });

    describe("liquiditySweepRecovered", () => {
      it("should detect sweep recovery", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 103, l: 101, c: 102 },
          { o: 102, h: 104, l: 90, c: 92 }, // swing low
          { o: 92, h: 98, l: 91, c: 96 },
          { o: 96, h: 100, l: 95, c: 99 },
          { o: 99, h: 102, l: 98, c: 101 },
          { o: 101, h: 103, l: 100, c: 102 },
          { o: 102, h: 103, l: 85, c: 87 }, // sweep without immediate recovery
          { o: 87, h: 95, l: 86, c: 93 }, // recovery above 90
        ]);

        const condition = liquiditySweepRecovered("bullish", { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[8], 8, candles);
        expect(result).toBe(true);
      });
    });

    describe("hasRecentSweeps", () => {
      it("should track recent sweeps", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 103, l: 101, c: 102 },
          { o: 102, h: 104, l: 90, c: 92 },
          { o: 92, h: 98, l: 91, c: 96 },
          { o: 96, h: 100, l: 95, c: 99 },
          { o: 99, h: 102, l: 98, c: 101 },
          { o: 101, h: 103, l: 100, c: 102 },
          { o: 102, h: 104, l: 85, c: 95 }, // sweep
          { o: 95, h: 98, l: 94, c: 97 }, // next bar
        ]);

        const condition = hasRecentSweeps("bullish", true, 1, { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};

        const result = condition.evaluate(indicators, candles[8], 8, candles);
        expect(result).toBe(true);
      });
    });

    describe("sweepDepthAbove", () => {
      it("should filter by sweep depth", () => {
        const candles = makeCandles([
          { o: 100, h: 102, l: 99, c: 101 },
          { o: 101, h: 103, l: 101, c: 102 },
          { o: 102, h: 104, l: 100, c: 102 }, // swing low at 100
          { o: 102, h: 105, l: 102, c: 104 },
          { o: 104, h: 106, l: 103, c: 105 },
          { o: 105, h: 107, l: 104, c: 106 },
          { o: 106, h: 108, l: 105, c: 107 },
          { o: 107, h: 108, l: 95, c: 105 }, // sweep to 95 (5% below 100)
        ]);

        // 5% depth condition should pass
        const condition5 = sweepDepthAbove(5, "bullish", { swingPeriod: 1 });
        const indicators: Record<string, unknown> = {};
        const result5 = condition5.evaluate(indicators, candles[7], 7, candles);
        expect(result5).toBe(true);

        // 10% depth condition should fail
        const condition10 = sweepDepthAbove(10, "bullish", { swingPeriod: 1 });
        const indicators2: Record<string, unknown> = {};
        const result10 = condition10.evaluate(indicators2, candles[7], 7, candles);
        expect(result10).toBe(false);
      });
    });
  });

  describe("Indicator Caching", () => {
    it("should cache indicator calculations", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 110, l: 100, c: 108 },
        { o: 108, h: 107, l: 103, c: 104 },
        { o: 104, h: 103, l: 100, c: 101 },
        { o: 101, h: 115, l: 108, c: 112 },
      ]);

      const condition = priceAtBullishOrderBlock({ swingPeriod: 1 });
      const indicators: Record<string, unknown> = {};

      // First call
      condition.evaluate(indicators, candles[4], 4, candles);

      // Indicators should be cached
      const cacheKey = 'orderBlock_{"swingPeriod":1}';
      expect(indicators[cacheKey]).toBeDefined();

      // Second call should use cached data
      const cachedData = indicators[cacheKey];
      condition.evaluate(indicators, candles[3], 3, candles);
      expect(indicators[cacheKey]).toBe(cachedData);
    });
  });
});
