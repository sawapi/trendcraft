import { describe, expect, it } from "vitest";
import { runBacktest } from "../engine";
import { at, stepCandles } from "./step-candles";

const CAPITAL = 1_000_000;
// Flat price, so every change in equity is interest.
const FLAT = stepCandles([{ price: 100, bars: 80 }]);
// 1M capital at 2x borrows 1M. 36.5% a year is 0.1% a day: 1,000 a day.
const MARGIN = {
  leverage: 2,
  maintenanceMargin: 0.25,
  marginCallAction: "liquidate" as const,
  interestRate: 0.365,
};

describe("margin interest while the position is open", () => {
  it("shows in the equity curve day by day, not all at once at the exit", () => {
    // Entry signal at bar 20 fills at bar 21's open; exit at bar 33's open.
    const result = runBacktest(FLAT, at(20), at(32), { capital: CAPITAL, margin: MARGIN });

    expect(result.finalCapital).toBeCloseTo(CAPITAL - 12 * 1_000, 6);
    const curve = result.equityCurve ?? [];
    // Six days into the hold, six days of interest are already owed.
    expect(curve[27]).toBeCloseTo(CAPITAL - 6 * 1_000, 6);
    // The curve declines steadily instead of jumping at the exit bar.
    for (let i = 22; i <= 32; i++) {
      expect(curve[i] - curve[i - 1]).toBeCloseTo(-1_000, 6);
    }
  });

  it("counts toward a margin call even when the price never moves", () => {
    // 2x opens at a margin ratio of 0.5. At 1% a day on the 1M loan, equity
    // falls below 40% of the 2M position after a little over 20 days.
    const result = runBacktest(FLAT, at(20), at(78), {
      capital: CAPITAL,
      margin: { ...MARGIN, maintenanceMargin: 0.4, interestRate: 3.65 },
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("marginCall");
  });

  it("leaves the trade's return and the final capital as they were", () => {
    const withInterest = runBacktest(FLAT, at(20), at(32), { capital: CAPITAL, margin: MARGIN });
    expect(withInterest.trades[0].return).toBeCloseTo(-12 * 1_000, 6);
  });
});
