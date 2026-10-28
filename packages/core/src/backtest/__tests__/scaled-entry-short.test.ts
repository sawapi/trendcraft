import { describe, expect, it } from "vitest";
import { runBacktest } from "../engine";
import { runBacktestScaled } from "../scaled-entry";
import { at, makeCandles, never } from "./step-candles";

/** Flat bars with a ±1 band around each close */
function closes(...prices: number[]) {
  return makeCandles(prices.map((c) => ({ o: c, h: c + 1, l: c - 1, c })));
}

const TWO_SIGNAL_TRANCHES = { tranches: 2, strategy: "equal", intervalType: "signal" } as const;

describe("runBacktestScaled with direction: short", () => {
  it("profits from a falling market, like runBacktest", () => {
    // Closes fall 100 -> 90 -> 80. The multi-tranche path used to run this
    // as a long and report a loss.
    const candles = closes(100, 100, 90, 80);
    const options = { capital: 100_000, fillMode: "same-bar-close", direction: "short" } as const;

    const scaled = runBacktestScaled(candles, at(1), never, {
      ...options,
      scaledEntry: TWO_SIGNAL_TRANCHES,
    });
    const single = runBacktest(candles, at(1), never, options);

    expect(scaled.trades).toHaveLength(1);
    expect(scaled.trades[0].direction).toBe("short");
    expect(scaled.trades[0].returnPercent).toBeCloseTo(20, 10);
    expect(scaled.trades[0].returnPercent).toBeCloseTo(single.trades[0].returnPercent, 10);
    // Half the capital stayed reserved for the tranche that never filled.
    expect(scaled.totalReturnPercent).toBeCloseTo(10, 10);
    expect(scaled.settings.direction).toBe("short");
  });

  it("averages a second tranche into the short and settles against the average", () => {
    // Short 50,000 at 100, add the reserved 50,000 at 110, cover at 90.
    const candles = closes(100, 100, 110, 90);
    const result = runBacktestScaled(candles, at(1, 2), at(3), {
      capital: 100_000,
      fillMode: "same-bar-close",
      direction: "short",
      scaledEntry: TWO_SIGNAL_TRANCHES,
    });

    const shares = 50_000 / 100 + 50_000 / 110;
    const avgEntry = 100_000 / shares;
    const profit = (avgEntry - 90) * shares;

    expect(result.trades).toHaveLength(1);
    const [trade] = result.trades;
    expect(trade.entryPrice).toBeCloseTo(avgEntry, 8);
    expect(trade.exitPrice).toBe(90);
    expect(trade.return).toBeCloseTo(profit, 6);
    // finalCapital is reported rounded to cents.
    expect(result.finalCapital).toBeCloseTo(100_000 + profit, 2);

    // Marked to market, the short loses as price rises: at 110 the whole
    // 100,000 is short and the position is 5,000 underwater.
    expect(result.equityCurve?.[1]).toBeCloseTo(100_000, 6);
    expect(result.equityCurve?.[2]).toBeCloseTo(95_000, 6);
    expect(result.equityCurve?.[3]).toBeCloseTo(100_000 + profit, 6);
  });

  it("adds price-interval tranches on a rise for a short and on a drop for a long", () => {
    // A -5% interval: the long adds at 94 (<= 95), the short at 106 (>= 105).
    const candles = closes(100, 100, 94, 106, 106);
    const scaledEntry = {
      tranches: 2,
      strategy: "equal",
      intervalType: "price",
      priceInterval: -5,
    } as const;
    const base = { capital: 100_000, fillMode: "same-bar-close", scaledEntry } as const;

    const long = runBacktestScaled(candles, at(1), never, base);
    const short = runBacktestScaled(candles, at(1), never, { ...base, direction: "short" });

    expect(long.trades[0].entryPrice).toBeCloseTo(100_000 / (50_000 / 100 + 50_000 / 94), 8);
    expect(short.trades[0].entryPrice).toBeCloseTo(100_000 / (50_000 / 100 + 50_000 / 106), 8);
  });

  it("trails a short from the lowest price since entry", () => {
    // Lows reach 79, so a 5% trail sits at 82.95; the close of 85 crosses it.
    const candles = closes(100, 100, 90, 80, 85);
    const result = runBacktestScaled(candles, at(1), never, {
      capital: 100_000,
      fillMode: "same-bar-close",
      direction: "short",
      trailingStop: 5,
      scaledEntry: TWO_SIGNAL_TRANCHES,
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("trailing");
    expect(result.trades[0].exitPrice).toBe(85);
  });

  it("applies slippage against a short on both sides", () => {
    const candles = closes(100, 100, 90);
    const result = runBacktestScaled(candles, at(1), at(2), {
      capital: 100_000,
      fillMode: "same-bar-close",
      direction: "short",
      slippage: 1,
      scaledEntry: TWO_SIGNAL_TRANCHES,
    });

    // Sold short below the close, covered above it.
    expect(result.trades[0].entryPrice).toBeCloseTo(99, 10);
    expect(result.trades[0].exitPrice).toBeCloseTo(90.9, 10);
  });
  it("refuses a re-entry once a short has lost more than the account", () => {
    // The first short loses 150% (100 -> 400), leaving capital at -50,000.
    // Sizing the next entry from it gave negative shares, a long in effect.
    const candles = closes(100, 100, 400, 400, 100, 50, 50);
    const options = { capital: 100_000, fillMode: "same-bar-close", direction: "short" } as const;

    const scaled = runBacktestScaled(candles, at(1, 4), at(2, 6), {
      ...options,
      scaledEntry: TWO_SIGNAL_TRANCHES,
    });
    const single = runBacktest(candles, at(1, 4), at(2, 6), options);

    expect(single.trades).toHaveLength(1);
    expect(scaled.trades).toHaveLength(1);
    expect(scaled.trades[0].returnPercent).toBeCloseTo(single.trades[0].returnPercent, 10);
  });

  it("takes a partial profit on a two-tranche short from the average entry", () => {
    // Short 50,000 at 100 and 50,000 at 110; a 10% partial target sits at
    // 90% of the average entry (94.29), and the close of 94 reaches it.
    const candles = closes(100, 100, 110, 94, 94);
    const result = runBacktestScaled(candles, at(1, 2), never, {
      capital: 100_000,
      fillMode: "same-bar-close",
      direction: "short",
      partialTakeProfit: { threshold: 10, sellPercent: 50 },
      scaledEntry: TWO_SIGNAL_TRANCHES,
    });

    const shares = 50_000 / 100 + 50_000 / 110;
    const avgEntry = 100_000 / shares;

    expect(result.trades).toHaveLength(2);
    const [partial, rest] = result.trades;
    expect(partial.exitReason).toBe("partialTakeProfit");
    expect(partial.isPartial).toBe(true);
    expect(partial.exitPrice).toBe(94);
    expect(partial.return).toBeCloseTo((avgEntry - 94) * (shares / 2), 6);
    expect(rest.exitReason).toBe("endOfData");
    expect(rest.return).toBeCloseTo((avgEntry - 94) * (shares / 2), 6);
    expect(result.finalCapital).toBeCloseTo(100_000 + (avgEntry - 94) * shares, 2);
  });
});
