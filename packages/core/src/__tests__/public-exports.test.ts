import { describe, expect, it } from "vitest";
import * as trendcraft from "../index";
import type { BacktestResult } from "../types";

/**
 * Guards the package's public barrel (`src/index.ts`). Symbols referenced by a
 * shipped `@example` must actually be re-exported from the root, or a user
 * copy-pasting the documented usage hits a runtime TypeError.
 */
describe("public root exports", () => {
  it("re-exports extractTradeReturns (used by the deflatedSharpeFromReturns @example)", () => {
    expect(typeof trendcraft.extractTradeReturns).toBe("function");
  });

  it("extractTradeReturns returns per-trade decimal returns from a BacktestResult", () => {
    const result = {
      trades: [{ returnPercent: 5 }, { returnPercent: -2 }, { returnPercent: 0 }],
    } as unknown as BacktestResult;
    expect(trendcraft.extractTradeReturns(result)).toEqual([0.05, -0.02, 0]);
  });

  it("the documented Deflated Sharpe pipeline (extractTradeReturns → deflatedSharpeFromReturns) is callable from the root", () => {
    const best = {
      trades: Array.from({ length: 30 }, (_, i) => ({ returnPercent: i % 2 === 0 ? 3 : -1 })),
    } as unknown as BacktestResult;
    const returns = trendcraft.extractTradeReturns(best);
    const trialSharpes = [0.1, 0.2, 0.15, 0.05];
    const dsr = trendcraft.deflatedSharpeFromReturns(returns, trialSharpes);
    expect(typeof dsr).toBe("number");
    expect(dsr).toBeGreaterThanOrEqual(0);
    expect(dsr).toBeLessThanOrEqual(1);
  });
});
