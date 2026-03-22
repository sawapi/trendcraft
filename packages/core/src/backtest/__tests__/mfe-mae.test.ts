/**
 * MFE/MAE (Maximum Favorable/Adverse Excursion) Tests
 *
 * Verifies that MFE, MAE, and MFE Utilization are correctly tracked:
 * - MFE: Maximum unrealized profit percentage during the trade
 * - MAE: Maximum unrealized loss percentage during the trade
 * - MFE Utilization: Percentage of MFE that was captured (actualReturn / MFE)
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";

// Helper to create candles
const makeCandles = (
  data: Array<{ o: number; h: number; l: number; c: number }>,
  startTime = 1700000000000,
  intervalMs = 86400000,
): NormalizedCandle[] =>
  data.map((d, i) => ({
    time: startTime + i * intervalMs,
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: 1000,
  }));

// Always false condition (for exit)
const alwaysFalse = () => false;

describe("MFE/MAE Tracking", () => {
  describe("MFE (Maximum Favorable Excursion)", () => {
    it("should track maximum unrealized profit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 115, l: 99, c: 108 }, // 2: high reaches 115 (+15%)
        { o: 108, h: 112, l: 105, c: 106 }, // 3: high 112 (+12%)
        { o: 106, h: 110, l: 104, c: 105 }, // 4: exit at 105 (+5%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      // Exit at bar 4
      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 105 && candle.high === 110;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE should be 15% (high of 115 from entry of 100)
      expect(trade.mfe).toBe(15);
      // Return is 5%
      expect(trade.returnPercent).toBeCloseTo(5, 0);
    });

    it("should handle trade with no unrealized profit (MFE = 0)", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 100, l: 90, c: 92 }, // 2: price only goes down, high = entry
        { o: 92, h: 95, l: 88, c: 90 }, // 3: exit at 90 (-10%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 90;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE should be 0 (price never went above entry)
      expect(trade.mfe).toBe(0);
    });
  });

  describe("MAE (Maximum Adverse Excursion)", () => {
    it("should track maximum unrealized loss", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 102, l: 90, c: 95 }, // 2: low reaches 90 (-10%)
        { o: 95, h: 108, l: 93, c: 105 }, // 3: low 93 (-7%)
        { o: 105, h: 115, l: 104, c: 112 }, // 4: exit at 112 (+12%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 112;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MAE should be 10% (low of 90 from entry of 100)
      expect(trade.mae).toBe(10);
    });

    it("should handle trade with no unrealized loss (MAE = 0)", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 110, l: 100, c: 108 }, // 2: low = entry, price only goes up
        { o: 108, h: 115, l: 107, c: 112 }, // 3: exit at 112 (+12%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 112;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MAE should be 0 (price never went below entry)
      expect(trade.mae).toBe(0);
    });
  });

  describe("MFE Utilization", () => {
    it("should calculate MFE utilization correctly", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 120, l: 99, c: 115 }, // 2: high reaches 120 (+20%)
        { o: 115, h: 118, l: 108, c: 110 }, // 3: exit at 110 (+10%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 110;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE = 20%, Return = 10%, Utilization = 10/20 * 100 = 50%
      expect(trade.mfe).toBe(20);
      expect(trade.returnPercent).toBeCloseTo(10, 0);
      expect(trade.mfeUtilization).toBe(50);
    });

    it("should set MFE utilization to 0 for losing trade with positive MFE", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 110, l: 99, c: 105 }, // 2: high reaches 110 (+10%)
        { o: 105, h: 106, l: 90, c: 92 }, // 3: exit at 92 (-8%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 92;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE = 10%, Return = -8%, Utilization = 0 (captured none of potential profit)
      expect(trade.mfe).toBe(10);
      expect(trade.returnPercent).toBeCloseTo(-8, 0);
      expect(trade.mfeUtilization).toBe(0);
    });

    it("should not set MFE utilization when MFE is 0", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 100, l: 90, c: 92 }, // 2: price only goes down
        { o: 92, h: 95, l: 88, c: 90 }, // 3: exit at 90 (-10%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 90;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE = 0, so mfeUtilization should be undefined
      expect(trade.mfe).toBe(0);
      expect(trade.mfeUtilization).toBeUndefined();
    });

    it("should cap MFE utilization at 100%", () => {
      // This happens when return > MFE (e.g., due to commission effects)
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 105, l: 99, c: 105 }, // 2: high = 105 (+5%)
        // With same-bar-close, we exit at 105
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 105;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE = 5%, Return = 5%, Utilization = 100%
      expect(trade.mfe).toBe(5);
      expect(trade.mfeUtilization).toBe(100);
    });
  });

  describe("MFE/MAE with Different Exit Types", () => {
    it("should track MFE/MAE for stop loss exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 108, l: 98, c: 105 }, // 2: high 108 (+8%), low 98 (-2%)
        { o: 105, h: 106, l: 89, c: 90 }, // 3: stop loss triggered
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        stopLoss: 10, // 10% stop loss
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE should track high of 108 (+8%)
      expect(trade.mfe).toBe(8);
      // MAE should track low of 89 (-11%)
      expect(trade.mae).toBe(11);
      expect(trade.exitReason).toBe("stopLoss");
    });

    it("should track MFE/MAE for take profit exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 102, l: 95, c: 98 }, // 2: low 95 (-5%)
        { o: 98, h: 115, l: 97, c: 112 }, // 3: take profit triggered
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        takeProfit: 10, // 10% take profit
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE should track high of 115 (+15%)
      expect(trade.mfe).toBe(15);
      // MAE should track low of 95 (-5%)
      expect(trade.mae).toBe(5);
      expect(trade.exitReason).toBe("takeProfit");
    });

    it("should track MFE/MAE for end of data exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 110, l: 92, c: 105 }, // 2: high 110 (+10%), low 92 (-8%)
        { o: 105, h: 108, l: 103, c: 106 }, // 3: end of data at 106
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // MFE should track high of 110 (+10%)
      expect(trade.mfe).toBe(10);
      // MAE should track low of 92 (-8%)
      expect(trade.mae).toBe(8);
      expect(trade.exitReason).toBe("endOfData");
    });
  });

  describe("MFE/MAE with Partial Exits", () => {
    it("should track MFE/MAE for scale-out exits", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 100 }, // 1: entry at close 100
        { o: 100, h: 102, l: 95, c: 98 }, // 2: low 95 (-5%)
        { o: 98, h: 115, l: 97, c: 112 }, // 3: first scale-out (+10%)
        { o: 112, h: 125, l: 110, c: 122 }, // 4: second scale-out (+20%)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        scaleOut: {
          levels: [
            { threshold: 10, sellPercent: 50 },
            { threshold: 20, sellPercent: 100 },
          ],
        },
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(2);

      // First partial exit
      const trade1 = result.trades[0];
      expect(trade1.isPartial).toBe(true);
      expect(trade1.exitReason).toBe("scaleOut");
      // At the time of first exit, MFE was 15% (high of 115)
      expect(trade1.mfe).toBe(15);
      // MAE was 5% (low of 95)
      expect(trade1.mae).toBe(5);

      // Second (final) exit
      const trade2 = result.trades[1];
      expect(trade2.isPartial).toBe(false);
      expect(trade2.exitReason).toBe("scaleOut");
      // At the time of second exit, MFE was 25% (high of 125)
      expect(trade2.mfe).toBe(25);
      // MAE was still 5% (low of 95 was the worst)
      expect(trade2.mae).toBe(5);
    });
  });

  describe("MFE/MAE with Next-Bar-Open Fill Mode", () => {
    it("should track MFE/MAE correctly in next-bar-open mode", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry signal
        { o: 105, h: 115, l: 100, c: 110 }, // 2: entry at open 105, high 115 (+9.5%)
        { o: 110, h: 112, l: 95, c: 98 }, // 3: low 95 (-9.5%), exit signal
        { o: 98, h: 100, l: 96, c: 99 }, // 4: exit at open 98
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 98 && candle.high === 112;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "next-bar-open",
      });

      expect(result.trades.length).toBe(1);
      const trade = result.trades[0];

      // Entry at open of bar 2 (105)
      // MFE tracking starts from bar 2: high 115 = +9.52%, bar 3: high 112 = +6.67%
      // So MFE should be ~9.52%
      expect(trade.mfe).toBeCloseTo(9.52, 1);

      // MAE: bar 2 low 100 = -4.76%, bar 3 low 95 = -9.52%
      // So MAE should be ~9.52%
      expect(trade.mae).toBeCloseTo(9.52, 1);
    });
  });
});
