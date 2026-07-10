/**
 * Fill-bar position management must not use pre-fill price action.
 *
 * When a pending limit/stop order fills mid-bar, the fill bar's high/low
 * include price action from BEFORE the order filled — a position opened at
 * 90 on a bar that spiked to 110 first never owned that spike. Peak/trough
 * seeding and same-bar stop/TP/trailing checks must only use post-fill
 * knowledge (the fill price and the close); otherwise a single wide fill
 * bar manufactures profitable same-bar exits and inflated MFE.
 *
 * Scenario (all tests): signal at bar 1, limit buy at 90; bar 2
 * {open 100, high 110, low 89, close 95} fills the order at 90.
 * Post-fill price never exceeds 95, so no profit-side trigger above 95 may
 * fire, and MFE is at most (95-90)/90 = 5.56%.
 */
import { describe, expect, it } from "vitest";
import { runBacktest } from "../engine";
import { at, makeCandles, never } from "./step-candles";

const candles = makeCandles([
  { o: 100, h: 100, l: 100, c: 100 },
  { o: 100, h: 100, l: 100, c: 100 }, // signal bar
  // Fill bar: the pre-fill spike to 110 is price action the position never
  // owned; the low 89 fills the limit 90.
  { o: 100, h: 110, l: 89, c: 95 },
  { o: 95, h: 95, l: 95, c: 95 },
  { o: 95, h: 95, l: 95, c: 95 },
]);

const base = {
  capital: 100000,
  orderType: { type: "limit" as const, price: 90 },
};

describe("fill-bar position management (mid-bar fills)", () => {
  it("trailing stop (intraday) does not exit on the fill bar from the pre-fill peak", () => {
    const result = runBacktest(candles, at(1), never, {
      ...base,
      trailingStop: 5,
      slTpMode: "intraday",
    });
    expect(result.trades.length).toBe(1);
    const trade = result.trades[0];
    expect(trade.entryPrice).toBeCloseTo(90, 10);
    // Pre-fix: same-bar 'trailing' exit at 104.5 (= 110 * 0.95, a price the
    // position never saw). Post-fill path (90..95) never touches the trail.
    expect(trade.exitReason).toBe("endOfData");
    expect(trade.exitPrice).toBeCloseTo(95, 10);
  });

  it("take profit (intraday) does not trigger from the pre-fill high", () => {
    const result = runBacktest(candles, at(1), never, {
      ...base,
      takeProfit: 10,
      slTpMode: "intraday",
    });
    expect(result.trades.length).toBe(1);
    // Pre-fix: TP 99 (= 90 * 1.10) 'triggered' by the pre-fill high 110.
    // Post-fill prices (90..95) never reach 99.
    expect(result.trades[0].exitReason).toBe("endOfData");
  });

  it("trailing stop (close-only) is not armed by the pre-fill peak either", () => {
    const result = runBacktest(candles, at(1), never, {
      ...base,
      trailingStop: 5,
      slTpMode: "close-only",
    });
    expect(result.trades.length).toBe(1);
    // Pre-fix: peak seeded at 110 -> trail 104.5; every later close (95) is
    // below it, so the position exits immediately on the next bar. Correct
    // peak is 95 -> trail 90.25, never touched.
    expect(result.trades[0].exitReason).toBe("endOfData");
  });

  it("MFE reflects only post-fill price action", () => {
    const result = runBacktest(candles, at(1), never, { ...base });
    expect(result.trades.length).toBe(1);
    // Pre-fix: mfe 22.22% from the pre-fill high 110. Post-fill max profit
    // is (95-90)/90 = 5.56%.
    expect(result.trades[0].mfe ?? 0).toBeLessThanOrEqual(5.56);
  });

  it("next-bar-open entries still use the full bar (fill at open owns the whole bar)", () => {
    // Same shape but entered via next-bar-open (no orderType): fill at bar-2
    // open 100; the whole bar is post-fill, so intraday TP may legitimately
    // trigger from the bar's high.
    const result = runBacktest(candles, at(1), never, {
      capital: 100000,
      takeProfit: 5,
      slTpMode: "intraday",
    });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitReason).toBe("takeProfit");
  });
});
