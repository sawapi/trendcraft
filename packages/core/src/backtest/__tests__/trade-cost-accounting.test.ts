/**
 * Every cost of a round trip belongs to the trade that incurred it.
 *
 * `Trade.return` used to carry only the exit commission and tax: the entry
 * commission (and, under margin, the interest) left the account without
 * appearing on any trade, so the trades summed to more than the account
 * made, and win rate / profit factor counted fee-losing trades as winners.
 * The invariant pinned here is that the trades account for the whole change
 * in capital.
 */

import { describe, expect, it } from "vitest";
import { runMonteCarloSimulation } from "../../optimization/monte-carlo";
import type { BacktestOptions, BacktestResult, NormalizedCandle } from "../../types";
import { deadCross, goldenCross } from "../conditions/ma-cross";
import { runBacktest } from "../engine";
import { runBacktestScaled } from "../scaled-entry";

const DAY = 86_400_000;

// Oscillating closes with a slight downward drift, so the MA cross trades
// often and some of the trades lose.
function sawtooth(n: number): NormalizedCandle[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: n }, (_, i) => {
    const close = 100 - i * 0.05 + 6 * Math.sin(i / 3);
    return {
      time: start + i * DAY,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000_000,
    };
  });
}

function sumOfTradeReturns(result: BacktestResult): number {
  return result.trades.reduce((sum, t) => sum + t.return, 0);
}

function expectTradesAccountForCapital(result: BacktestResult): void {
  expect(result.tradeCount).toBeGreaterThan(3);
  // finalCapital is rounded to the cent.
  expect(sumOfTradeReturns(result)).toBeCloseTo(result.finalCapital - result.initialCapital, 1);
}

describe("trades account for every cost", () => {
  const candles = sawtooth(200);
  const entry = goldenCross(2, 5);
  const exit = deadCross(2, 5);

  const scenarios: Array<[string, BacktestOptions]> = [
    ["a fixed commission", { capital: 100_000, commission: 50 }],
    ["a percentage commission", { capital: 100_000, commissionRate: 0.5 }],
    [
      "commission, tax and slippage together",
      { capital: 100_000, commission: 5, commissionRate: 0.2, taxRate: 20, slippage: 0.1 },
    ],
    [
      "fractional sizing",
      {
        capital: 100_000,
        commissionRate: 0.5,
        sizing: { method: "fixed-fractional", fractionPercent: 20 },
      },
    ],
    [
      "a volume-constrained (below full) fill",
      {
        capital: 100_000,
        commissionRate: 0.5,
        volumeConstraint: { maxVolumePercent: 0.05 },
      },
    ],
    [
      "a partial take-profit",
      {
        capital: 100_000,
        commissionRate: 0.3,
        partialTakeProfit: { threshold: 2, sellPercent: 50 },
      },
    ],
    [
      "scale-out levels",
      {
        capital: 100_000,
        commissionRate: 0.3,
        scaleOut: {
          levels: [
            { threshold: 1.5, sellPercent: 30 },
            { threshold: 3, sellPercent: 50 },
          ],
        },
      },
    ],
    ["a short position", { capital: 100_000, commissionRate: 0.5, direction: "short" }],
    [
      "margin interest",
      {
        capital: 100_000,
        commissionRate: 0.2,
        margin: {
          leverage: 2,
          maintenanceMargin: 0.25,
          marginCallAction: "liquidate",
          interestRate: 0.08,
        },
      },
    ],
    [
      "a margin-call reduction with interest",
      {
        capital: 100_000,
        commissionRate: 0.2,
        fillMode: "same-bar-close",
        margin: {
          leverage: 3,
          maintenanceMargin: 0.3,
          marginCallAction: "reduceToMaintenance",
          interestRate: 0.08,
        },
      },
    ],
  ];

  it.each(scenarios)("with %s", (_label, options) => {
    expectTradesAccountForCapital(runBacktest(candles, entry, exit, options));
  });

  it("in a multi-tranche scaled entry", () => {
    const run = (tranches: number) =>
      runBacktestScaled(candles, entry, exit, {
        capital: 100_000,
        commissionRate: 0.5,
        scaledEntry: { tranches, strategy: "equal", intervalType: "price", priceInterval: -1 },
      });
    const result = run(3);
    expectTradesAccountForCapital(result);
    // Later tranches really were bought (and paid their own commission).
    expect(result.finalCapital).not.toBeCloseTo(run(1).finalCapital, 0);
  });
});

describe("the entry commission is charged to the trade", () => {
  it("counts a trade whose gain does not cover both commissions as a loss", () => {
    // Enter at 100, exit at 100.8: +0.8% gross (~796 on ~995 shares),
    // against ~500 to enter and ~501 to exit. With only the exit fee charged
    // the trade read as a ~295 win; with both it is a ~205 loss.
    const start = Date.UTC(2024, 0, 1);
    const closes = [100, 100, 100, 100.8, 100.8];
    const candles: NormalizedCandle[] = closes.map((close, i) => ({
      time: start + i * DAY,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));
    const result = runBacktest(
      candles,
      (_ind, _c, i) => i === 1,
      (_ind, _c, i) => i === 3,
      { capital: 100_000, commissionRate: 0.5, fillMode: "same-bar-close" },
    );

    expect(result.tradeCount).toBe(1);
    expect(result.trades[0].return).toBeLessThan(0);
    expect(result.winRate).toBe(0);
    expect(result.finalCapital).toBeLessThan(100_000);
  });

  it("lets Monte Carlo shuffle reproduce the engine's return with commission", () => {
    const result = runBacktest(sawtooth(200), goldenCross(2, 5), deadCross(2, 5), {
      capital: 100_000,
      commissionRate: 0.5,
      sizing: { method: "fixed-fractional", fractionPercent: 20 },
    });
    const mc = runMonteCarloSimulation(result, { simulations: 50, method: "shuffle", seed: 3 });

    const engineReturn =
      ((result.finalCapital - result.initialCapital) / result.initialCapital) * 100;
    expect(mc.statistics.totalReturnPercent.mean).toBeCloseTo(engineReturn, 3);
  });
});
