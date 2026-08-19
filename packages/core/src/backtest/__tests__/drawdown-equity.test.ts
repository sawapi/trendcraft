import { describe, expect, it } from "vitest";
import type { BacktestResult, NormalizedCandle } from "../../types";
import { alwaysFalse, alwaysTrue } from "../conditions";
import { runBacktest } from "../engine";
import { runBacktestScaled } from "../scaled-entry";

/**
 * Drawdown is a property of the mark-to-market equity path.
 *
 * These tests pin that `maxDrawdown`, `drawdownPeriods` and `equityCurve`
 * describe one and the same path. Before, drawdown was measured on the cash
 * balance, which is 0 while fully invested and jumps to the realized slice on
 * a partial exit — so a rising account could report a 45% drawdown and a
 * halving account could report none.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Flat OHLC bars: every price of the bar equals its close. */
function flat(closes: number[]): NormalizedCandle[] {
  return closes.map((c, i) => ({
    time: Date.UTC(2024, 0, 1) + i * DAY,
    open: c,
    high: c,
    low: c,
    close: c,
    volume: 1000,
  }));
}

/** Exit condition that fires on exactly one bar index. */
function exitAtBar(index: number) {
  return {
    type: "preset" as const,
    name: `exitAtBar(${index})`,
    evaluate: (_indicators: Record<string, unknown>, _candle: NormalizedCandle, i: number) =>
      i === index,
  };
}

/**
 * Deepest peak-to-trough decline of an equity curve, in percent, rounded the
 * way the engine rounds it. Deliberately independent of the engine's tracker:
 * it is the definition the result is checked against.
 */
function drawdownOfCurve(curve: number[]): number {
  let peak = Number.NEGATIVE_INFINITY;
  let worst = 0;
  for (const equity of curve) {
    if (equity > peak) peak = equity;
    if (peak > 0) {
      const depth = ((peak - equity) / peak) * 100;
      if (depth > worst) worst = depth;
    }
  }
  return Math.round(worst * 100) / 100;
}

/** The three drawdown fields of one result must describe one path. */
function expectDrawdownCoherent(result: BacktestResult): void {
  const curve = result.equityCurve;
  expect(curve).toBeDefined();
  expect(result.maxDrawdown).toBeCloseTo(drawdownOfCurve(curve as number[]), 10);
  const deepestPeriod =
    result.drawdownPeriods.length > 0
      ? Math.max(...result.drawdownPeriods.map((p) => p.maxDepthPercent))
      : 0;
  expect(result.maxDrawdown).toBeCloseTo(deepestPeriod, 10);
}

const RISING = [100, 101, 103, 106, 110, 115, 121, 128, 130];

describe("drawdown is measured on mark-to-market equity", () => {
  it("a partial take profit on a monotonically rising account reports no drawdown", () => {
    const result = runBacktest(flat(RISING), alwaysTrue(), alwaysFalse(), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
    });

    // The curve never declines by a cent...
    const curve = result.equityCurve as number[];
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    }
    // ...so the drawdown is 0, not the ~45% the still-invested half used to
    // register when only the realized cash was measured.
    expect(result.maxDrawdown).toBe(0);
    expect(result.drawdownPeriods).toEqual([]);
    expectDrawdownCoherent(result);
  });

  it("a two-level scale-out on the same rising account reports no drawdown", () => {
    const result = runBacktest(flat(RISING), alwaysTrue(), alwaysFalse(), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
      scaleOut: {
        levels: [
          { threshold: 5, sellPercent: 40 },
          { threshold: 15, sellPercent: 40 },
        ],
      },
    });

    expect(result.maxDrawdown).toBe(0);
    expect(result.drawdownPeriods).toEqual([]);
    expectDrawdownCoherent(result);
  });

  it("a drawdown taken while fully invested is visible", () => {
    // Held throughout: 1,000,000 -> 500,000 -> 1,100,000. Cash never moves
    // until the end-of-data close, so this used to report 0.
    const result = runBacktest(flat([100, 100, 50, 110, 110]), alwaysTrue(), alwaysFalse(), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
    });

    expect(result.maxDrawdown).toBe(50);
    expect(result.drawdownPeriods).toHaveLength(1);
    expect(result.drawdownPeriods[0].peakEquity).toBeCloseTo(1_000_000, 6);
    expect(result.drawdownPeriods[0].troughEquity).toBeCloseTo(500_000, 6);
    expectDrawdownCoherent(result);
  });

  it("a loss booked by the end-of-data close counts toward maxDrawdown", () => {
    // Trade 1: 100 -> 150 (+50%). Trade 2 enters at 150 and is still open when
    // the data ends at 100. The end-of-data close used to update the period
    // tracker but not the scalar, so the two contradicted each other.
    const candles = flat([100, 100, 120, 150, 150, 150, 140, 120, 100, 100]);
    const result = runBacktest(candles, alwaysTrue(), exitAtBar(3), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
    });

    expect(result.trades.map((t) => t.exitReason)).toEqual(["signal", "endOfData"]);
    expect(result.maxDrawdown).toBeCloseTo(33.33, 2);
    expectDrawdownCoherent(result);
  });

  it("closing the same path by signal instead of end-of-data gives the same drawdown", () => {
    const candles = flat([100, 100, 120, 150, 150, 150, 140, 120, 100, 100]);
    const options = {
      capital: 1_000_000,
      fillMode: "same-bar-close" as const,
      slTpMode: "close-only" as const,
    };
    const byEndOfData = runBacktest(candles, alwaysTrue(), exitAtBar(3), options);
    const bySignal = runBacktest(
      candles,
      alwaysTrue(),
      {
        type: "preset" as const,
        name: "exitAtBar3or9",
        evaluate: (_ind: Record<string, unknown>, _c: NormalizedCandle, i: number) =>
          i === 3 || i === 9,
      },
      options,
    );

    expect(bySignal.finalCapital).toBeCloseTo(byEndOfData.finalCapital, 6);
    expect(bySignal.maxDrawdown).toBe(byEndOfData.maxDrawdown);
  });

  it("a margin-call reduction is measured on equity, not on the cash it frees", () => {
    // 2x leverage into a crash: the account is reduced to maintenance rather
    // than liquidated, so shares stay open and the freed cash is not equity.
    const result = runBacktest(flat([100, 100, 90, 80, 70, 60, 60]), alwaysTrue(), alwaysFalse(), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
      margin: {
        leverage: 2,
        maintenanceMargin: 30,
        marginCallAction: "reduceToMaintenance",
        interestRate: 0,
      },
    });

    expectDrawdownCoherent(result);
    // Bar 2 is the trough: a 10% price fall at 2x is a 20% equity loss, and
    // the margin call closes ~98.5% of the position there, so the rest of the
    // fall barely moves the account. The freed cash is not a recovery.
    const curve = result.equityCurve as number[];
    expect(curve[2]).toBeCloseTo(800_000, 6);
    expect(result.maxDrawdown).toBeCloseTo(20.89, 2);
  });

  it("a short position's drawdown follows its equity", () => {
    const result = runBacktest(flat([100, 100, 130, 130, 100, 100]), alwaysTrue(), alwaysFalse(), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
      direction: "short",
    });

    expect(result.maxDrawdown).toBeGreaterThan(0);
    expectDrawdownCoherent(result);
  });

  it("exit costs on the end-of-data close do not invent a peak", () => {
    // Strictly rising and still open at the end, with a commission and a tax
    // that only bite at the close. The pre-close mark-to-market of the final
    // bar is the highest number the run ever sees, but it never reaches
    // equityCurve — the realized figure replaces it. Drawdown must read the
    // curve, not the transient.
    const result = runBacktest(flat([100, 100, 110, 120, 130]), alwaysTrue(), alwaysFalse(), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
      commissionRate: 1,
      taxRate: 20,
    });

    expectDrawdownCoherent(result);
    // The only decline in the curve is the entry commission on bar 1.
    expect(result.maxDrawdown).toBeCloseTo(1, 6);
  });

  it("runBacktestScaled reports an equity curve and a coherent drawdown", () => {
    const result = runBacktestScaled(flat(RISING), alwaysTrue(), alwaysFalse(), {
      capital: 1_000_000,
      fillMode: "same-bar-close",
      slTpMode: "close-only",
      scaledEntry: { tranches: 3, strategy: "equal", intervalType: "signal" },
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
    });

    expect(result.equityCurve).toHaveLength(RISING.length);
    expect(result.finalCapital).toBeGreaterThan(1_000_000);
    // Reserved capital counts as equity while it waits for its tranche, so a
    // partially-entered position is not a loss.
    expect(result.maxDrawdown).toBe(0);
    expectDrawdownCoherent(result);
  });

  it("runBacktestScaled sees a drawdown taken while invested", () => {
    const result = runBacktestScaled(
      flat([100, 100, 90, 60, 60, 90, 120, 120]),
      alwaysTrue(),
      alwaysFalse(),
      {
        capital: 1_000_000,
        fillMode: "same-bar-close",
        slTpMode: "close-only",
        scaledEntry: { tranches: 2, strategy: "equal", intervalType: "signal" },
      },
    );

    expect(result.maxDrawdown).toBeGreaterThan(10);
    expect(result.drawdownPeriods.length).toBeGreaterThan(0);
    expectDrawdownCoherent(result);
  });
});
