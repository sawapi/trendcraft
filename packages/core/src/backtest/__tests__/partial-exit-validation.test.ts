import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PresetCondition } from "../../types";
import { runBacktest } from "../engine";
import { runBacktestScaled } from "../scaled-entry";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Flat candles (open = high = low = close) so every fill price in a test is
 * exactly the listed number.
 */
function flatCandles(closes: number[]): NormalizedCandle[] {
  const baseTime = Date.UTC(2024, 0, 1);

  return closes.map((close, i) => ({
    time: baseTime + i * DAY,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000000,
  }));
}

const enterAtBar1: PresetCondition = {
  type: "preset",
  name: "enterAtBar1",
  evaluate: (_indicators, _candle, index) => index === 1,
};

const neverExit: PresetCondition = {
  type: "preset",
  name: "neverExit",
  evaluate: () => false,
};

// Enter at 100, then rise past the +5% partial take profit threshold.
const RISE_PAST_THRESHOLD = [100, 100, 110, 110, 110];

describe("partial exits", () => {
  describe("sellPercent: 100 closes the position", () => {
    it("records one trade in the standard engine, not a zero-share second one", () => {
      // 100,000 buys (100,000 - 10 commission) / 100 = 999.9 shares. Selling
      // all of them at 110 returns 109,989 less a 10 exit commission.
      // Leaving the emptied position open charged a second exit commission and
      // appended a trade with no shares and a null return.
      const result = runBacktest(flatCandles(RISE_PAST_THRESHOLD), enterAtBar1, neverExit, {
        capital: 100000,
        commission: 10,
        fillMode: "same-bar-close",
        partialTakeProfit: { threshold: 5, sellPercent: 100 },
      });

      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].exitReason).toBe("partialTakeProfit");
      expect(result.trades[0].isPartial).toBeFalsy();
      expect(result.finalCapital).toBeCloseTo(109979, 6);
    });

    it("records one trade in the scaled engine and releases the reserved capital", () => {
      // Tranche 1 commits 50,000 of the 100,000, buying (50,000 - 10) / 100 =
      // 499.9 shares; 50,000 stays reserved for a tranche that is never
      // entered. Selling everything at 110 returns 54,989 less a 10 exit
      // commission, plus the released reserve.
      const result = runBacktestScaled(flatCandles(RISE_PAST_THRESHOLD), enterAtBar1, neverExit, {
        capital: 100000,
        commission: 10,
        fillMode: "same-bar-close",
        partialTakeProfit: { threshold: 5, sellPercent: 100 },
        scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
      });

      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].exitReason).toBe("partialTakeProfit");
      expect(result.trades[0].isPartial).toBeFalsy();
      expect(result.finalCapital).toBeCloseTo(104979, 6);
    });

    it("still takes a real partial exit below 100", () => {
      const result = runBacktest(flatCandles(RISE_PAST_THRESHOLD), enterAtBar1, neverExit, {
        capital: 100000,
        commission: 10,
        fillMode: "same-bar-close",
        partialTakeProfit: { threshold: 5, sellPercent: 50 },
      });

      // Partial exit, then the remainder closes at the end of the data.
      expect(result.tradeCount).toBe(2);
      expect(result.trades[0].isPartial).toBe(true);
      expect(result.trades[0].exitPercent).toBe(50);
      expect(result.trades[1].exitReason).toBe("endOfData");
    });
  });

  describe("sell percentages outside (0, 100] are rejected", () => {
    const candles = flatCandles(RISE_PAST_THRESHOLD);

    for (const sellPercent of [150, 100.5, 0, -10, Number.NaN]) {
      it(`rejects partialTakeProfit.sellPercent: ${sellPercent}`, () => {
        expect(() =>
          runBacktest(candles, enterAtBar1, neverExit, {
            capital: 100000,
            partialTakeProfit: { threshold: 5, sellPercent },
          }),
        ).toThrow(/partialTakeProfit\.sellPercent must be greater than 0 and at most 100/);
      });
    }

    it("rejects an over-100 scale-out level, which sold shares the position never held", () => {
      // Selling 150% of the position at a profit credited the account for
      // shares it did not own: 100,000 of capital ended the run at 164,973.
      expect(() =>
        runBacktest(candles, enterAtBar1, neverExit, {
          capital: 100000,
          commission: 10,
          fillMode: "same-bar-close",
          scaleOut: { levels: [{ threshold: 5, sellPercent: 150 }] },
        }),
      ).toThrow(/scaleOut\.levels\[0\]\.sellPercent must be greater than 0 and at most 100/);
    });

    it("names the offending scale-out level", () => {
      expect(() =>
        runBacktest(candles, enterAtBar1, neverExit, {
          capital: 100000,
          scaleOut: {
            levels: [
              { threshold: 5, sellPercent: 50 },
              { threshold: 10, sellPercent: 0 },
            ],
          },
        }),
      ).toThrow(/scaleOut\.levels\[1\]\.sellPercent/);
    });

    it("keeps accepting 100 on a scale-out level, which means 'sell the rest'", () => {
      expect(() =>
        runBacktest(candles, enterAtBar1, neverExit, {
          capital: 100000,
          scaleOut: { levels: [{ threshold: 5, sellPercent: 100 }] },
        }),
      ).not.toThrow();
    });

    it("rejects through the scaled entry point as well", () => {
      expect(() =>
        runBacktestScaled(candles, enterAtBar1, neverExit, {
          capital: 100000,
          partialTakeProfit: { threshold: 5, sellPercent: 150 },
          scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
        }),
      ).toThrow(/partialTakeProfit\.sellPercent must be greater than 0 and at most 100/);
    });
  });
});
