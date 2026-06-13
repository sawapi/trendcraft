import { describe, expect, it } from "vitest";
import { runBacktest } from "../engine";
import { at, stepCandles } from "./step-candles";

// Same layout as sizing-integration.test.ts — entry signal at bar 20 fills
// at bar 21's open, exit signal at bar 32 fills at bar 33's open.
const UP_20 = stepCandles([
  { price: 100, bars: 30 },
  { price: 120, bars: 10 },
]);
const DOWN_10 = stepCandles([
  { price: 100, bars: 30 },
  { price: 90, bars: 10 },
]);
const ENTRY = at(20);
const EXIT = at(32);
const CAPITAL = 1_000_000;
const MARGIN_2X = { leverage: 2, maintenanceMargin: 0.25, marginCallAction: "liquidate" as const };

/**
 * Leveraged equity accounting: exit proceeds include the loan-funded
 * notional, so the borrowed principal must be repaid when the position
 * closes. 1M capital at 2x buys 20,000 shares @100 (borrowing 1M).
 */
describe("backtest margin loan repayment", () => {
  it("repays the borrowed principal on a winning trade (2x, +20% → equity 1.4M, not 2.4M)", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, { capital: CAPITAL, margin: MARGIN_2X });
    // 20,000 shares @100 → exit 120: proceeds 2.4M − 1M loan = 1.4M.
    // Before the fix this reported 2.4M (loan never left the account).
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_400_000, 6);
  });

  it("amplifies losses correctly (2x, -10% → equity 0.8M)", () => {
    const result = runBacktest(DOWN_10, ENTRY, EXIT, { capital: CAPITAL, margin: MARGIN_2X });
    // 20,000 shares @100 → exit 90: proceeds 1.8M − 1M loan = 0.8M
    expect(result.finalCapital).toBeCloseTo(800_000, 6);
  });

  it("2x leverage doubles the P&L of the unlevered run", () => {
    const levered = runBacktest(UP_20, ENTRY, EXIT, { capital: CAPITAL, margin: MARGIN_2X });
    const unlevered = runBacktest(UP_20, ENTRY, EXIT, { capital: CAPITAL });
    expect(levered.finalCapital - CAPITAL).toBeCloseTo(2 * (unlevered.finalCapital - CAPITAL), 6);
  });

  it("repays the loan proportionally across partial exits (partial TP + final exit)", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      margin: MARGIN_2X,
      partialTakeProfit: { threshold: 20, sellPercent: 50 },
    });
    // Half closed at the +20% partial TP, half at the exit signal — both at
    // 120, so the final equity must equal the single-exit case exactly
    expect(result.trades.length).toBe(2);
    expect(result.finalCapital).toBeCloseTo(1_400_000, 6);
  });

  it("still deducts margin interest on top of the loan repayment", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      margin: { ...MARGIN_2X, interestRate: 0.0365 },
    });
    // Entry fills bar 21, exit fills bar 33 → 12 holding days on a 1M loan
    // at 0.01%/day = 1,200 interest
    expect(result.finalCapital).toBeCloseTo(1_400_000 - 1_200, 6);
  });

  it("repays the loan on a margin-call liquidation", () => {
    const crash = stepCandles([
      { price: 100, bars: 30 },
      { price: 60, bars: 10 },
    ]);
    const result = runBacktest(crash, ENTRY, at(38), { capital: CAPITAL, margin: MARGIN_2X });
    // At 60: equity 1.2M − 1M = 0.2M is 16.7% of position value < 25%
    // maintenance → liquidate. Proceeds 1.2M − 1M loan = 0.2M
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitReason).toBe("marginCall");
    expect(result.finalCapital).toBeCloseTo(200_000, 6);
  });

  it("does NOT margin-call a deeply profitable leveraged short", () => {
    const crash = stepCandles([
      { price: 100, bars: 30 },
      { price: 60, bars: 10 },
    ]);
    const result = runBacktest(crash, ENTRY, at(35), {
      capital: CAPITAL,
      direction: "short",
      margin: MARGIN_2X,
    });
    // Short 20,000 @100, covered @60: equity RISES as price falls
    // (2M proceeds + 800k unrealized − 1M loan), so no maintenance breach.
    // Proceeds 2M + 800k profit − 1M loan = 1.8M
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitReason).toBe("signal");
    expect(result.finalCapital).toBeCloseTo(1_800_000, 6);
  });

  it("margin-calls a leveraged short when the price moves up against it", () => {
    const squeeze = stepCandles([
      { price: 100, bars: 30 },
      { price: 130, bars: 10 },
    ]);
    const result = runBacktest(squeeze, ENTRY, at(38), {
      capital: CAPITAL,
      direction: "short",
      margin: MARGIN_2X,
    });
    // At 130: equity = 2M + (2M − 2.6M) − 1M = 0.4M, which is 15.4% of the
    // 2.6M cover liability < 25% maintenance → liquidate.
    // Proceeds 2M − 600k loss − 1M loan = 0.4M
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitReason).toBe("marginCall");
    expect(result.finalCapital).toBeCloseTo(400_000, 6);
  });

  it("charges interest on each repaid tranche for exactly its outstanding days", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, {
      capital: CAPITAL,
      margin: { ...MARGIN_2X, interestRate: 0.0365 },
      partialTakeProfit: { threshold: 20, sellPercent: 50 },
    });
    // Partial closes half at bar 30 (9 days): tranche interest 1M × 0.01%/day
    // × 9 × 0.5 = 450, repay 500k. Full close at bar 33 (12 days): interest
    // 500k × 0.01%/day × 12 = 600, repay 500k. Final = 1.4M − 450 − 600.
    // Charging full-period interest only at the final close would give
    // 1.4M − 1,200 instead.
    expect(result.trades.length).toBe(2);
    expect(result.finalCapital).toBeCloseTo(1_400_000 - 450 - 600, 6);
  });

  it("reduceToMaintenance sells just enough to restore the maintenance ratio", () => {
    const crash = stepCandles([
      { price: 100, bars: 30 },
      { price: 60, bars: 10 },
    ]);
    const result = runBacktest(crash, ENTRY, at(38), {
      capital: CAPITAL,
      margin: { ...MARGIN_2X, marginCallAction: "reduceToMaintenance" },
    });
    // At 60 the ratio is 200k/1.2M ≈ 16.7% → sell f = 1 − 0.167/0.25 = 1/3
    // of the position (one partial marginCall trade, no second call since
    // the ratio lands exactly on 25%). A fair-value reduction keeps equity
    // at 200k, so with no price recovery the final capital matches the
    // liquidation path — but the account stays in the market.
    expect(result.trades.length).toBe(2);
    expect(result.trades[0].exitReason).toBe("marginCall");
    expect(result.trades[0].isPartial).toBe(true);
    expect(result.trades[1].exitReason).toBe("signal");
    expect(result.finalCapital).toBeCloseTo(200_000, 6);
  });

  it("reduceToMaintenance keeps upside that a liquidation would forfeit", () => {
    const dipAndRecover = stepCandles([
      { price: 100, bars: 30 },
      { price: 60, bars: 5 },
      { price: 100, bars: 5 },
    ]);
    const reduced = runBacktest(dipAndRecover, ENTRY, at(38), {
      capital: CAPITAL,
      margin: { ...MARGIN_2X, marginCallAction: "reduceToMaintenance" },
    });
    const liquidated = runBacktest(dipAndRecover, ENTRY, at(38), {
      capital: CAPITAL,
      margin: MARGIN_2X,
    });
    // The reduced account still holds 13,333 shares through the recovery
    // back to 100; the liquidated one is flat from 60 onward.
    expect(reduced.finalCapital).toBeGreaterThan(liquidated.finalCapital);
  });

  it("works for short positions (2x short, -20% move → equity 1.4M)", () => {
    const down20 = stepCandles([
      { price: 100, bars: 30 },
      { price: 80, bars: 10 },
    ]);
    const result = runBacktest(down20, ENTRY, EXIT, {
      capital: CAPITAL,
      direction: "short",
      margin: MARGIN_2X,
    });
    // 20,000 shares short @100 → cover 80: entry value 2M + 400k profit
    // − 1M loan = 1.4M
    expect(result.finalCapital).toBeCloseTo(1_400_000, 6);
  });

  it("leaves unlevered backtests untouched (no margin config)", () => {
    const result = runBacktest(UP_20, ENTRY, EXIT, { capital: CAPITAL });
    expect(result.finalCapital).toBeCloseTo(1_200_000, 6);
  });
});
