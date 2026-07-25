/**
 * Annualisation of Sharpe / Sortino across every backtest result path.
 *
 * "Annualised" only means something relative to a frequency. Five places used
 * `sqrt(252)` on a series with one observation per **trade**, which says a
 * trade is a day: the same equity path packaged as 21-day trades scored
 * `sqrt(21)` — over four times — higher than the same path marked daily, and
 * the value did not move at all when the same trades were spread over ten
 * years instead of one. Strategies of different trade frequency were therefore
 * ranked against each other on numbers that were not comparable.
 *
 * The property tested throughout: a ratio must depend on the equity path and
 * the calendar time it covers, not on how that path is chopped into trades.
 */
import { describe, expect, it } from "vitest";
import {
  periodsPerYearFromSpan,
  sharpeFromReturns,
  sortinoFromReturns,
} from "../analysis/return-metrics";
import { calculateRuntimeMetrics } from "../analysis/runtime-metrics";
import { calculateStats } from "../backtest/engine-utils";
import { portfolioBacktest } from "../backtest/portfolio";
import type { BacktestSettings, ConditionFn, NormalizedCandle, Trade } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const START = 1_700_000_000_000;

const SETTINGS: BacktestSettings = {
  fillMode: "same-bar-close",
  slTpMode: "close-only",
  slippage: 0,
  commission: 0,
  commissionRate: 0,
  taxRate: 0,
};

/** Deterministic pseudo-random daily returns, mean slightly positive. */
function dailyReturns(n: number, seed = 42): number[] {
  let a = seed;
  const rnd = () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
  return Array.from({ length: n }, () => (rnd() - 0.48) * 0.02);
}

/** Equity path from a daily return stream, starting at `initial`. */
function equityFrom(returns: number[], initial = 100_000): number[] {
  const curve = [initial];
  for (const r of returns) curve.push(curve[curve.length - 1] * (1 + r));
  return curve;
}

/**
 * Package one equity path into trades of `holding` bars each: entry at the
 * start of a chunk, exit at its end. The path itself is untouched.
 */
function packageTrades(equity: number[], holding: number, dayMs = DAY): Trade[] {
  const trades: Trade[] = [];
  for (let start = 0; start + holding < equity.length; start += holding) {
    const end = start + holding;
    const pnl = equity[end] - equity[start];
    trades.push({
      entryTime: START + start * dayMs,
      entryPrice: equity[start],
      exitTime: START + end * dayMs,
      exitPrice: equity[end],
      return: pnl,
      returnPercent: (pnl / equity[start]) * 100,
      holdingDays: holding,
    });
  }
  return trades;
}

const tradeReturnFractions = (trades: Trade[]) => trades.map((t) => t.returnPercent / 100);

describe("periodsPerYearFromSpan", () => {
  it("recovers the frequency of the series it is given", () => {
    // 252 daily returns covering one calendar year.
    const oneYear = 365.25 * DAY;
    expect(periodsPerYearFromSpan(252, START, START + oneYear)).toBeCloseTo(252, 6);
    // The same calendar year sampled 12 times.
    expect(periodsPerYearFromSpan(12, START, START + oneYear)).toBeCloseTo(12, 6);
  });

  it("falls back to daily bars when the span is unusable", () => {
    expect(periodsPerYearFromSpan(1, START, START + DAY)).toBe(252);
    expect(periodsPerYearFromSpan(10, START, START)).toBe(252);
    expect(periodsPerYearFromSpan(10, undefined, undefined)).toBe(252);
  });
});

describe("sortinoFromReturns", () => {
  it("penalises only downside and is undefined without any", () => {
    const returns = [0.01, -0.02, 0.015, -0.005, 0.02];
    const sortino = sortinoFromReturns(returns, { periodsPerYear: 252 });
    const sharpe = sharpeFromReturns(returns, { periodsPerYear: 252 });

    // Downside deviation ignores the upside spread, so it is the smaller
    // denominator here and the Sortino is correspondingly larger.
    expect(sortino).toBeGreaterThan(sharpe);
    expect(Number.isFinite(sortino)).toBe(true);

    expect(sortinoFromReturns([0.01, 0.02, 0.03])).toBeNaN();
    expect(sortinoFromReturns([0.01])).toBeNaN();
  });

  it("scales with the square root of the annualisation frequency", () => {
    const returns = [0.01, -0.02, 0.015, -0.005, 0.02];
    const daily = sortinoFromReturns(returns, { periodsPerYear: 252 });
    const monthly = sortinoFromReturns(returns, { periodsPerYear: 12 });

    expect(daily / monthly).toBeCloseTo(Math.sqrt(252 / 12), 10);
  });
});

describe("backtest result ratios are independent of trade packaging", () => {
  const returns = dailyReturns(504);
  const equity = equityFrom(returns);

  function statsFor(holding: number) {
    const trades = packageTrades(equity, holding);
    return calculateStats(
      trades,
      tradeReturnFractions(trades),
      100_000,
      equity[equity.length - 1],
      5,
      SETTINGS,
      [],
      { firstTime: START, lastTime: START + (equity.length - 1) * DAY },
      equity,
    );
  }

  it("reports the same Sharpe and Sortino for 1-, 5- and 21-day trades", () => {
    const daily = statsFor(1);
    const weekly = statsFor(5);
    const monthly = statsFor(21);

    // Same path, same final capital — only the chopping differs.
    expect(weekly.finalCapital).toBe(daily.finalCapital);
    expect(monthly.finalCapital).toBe(daily.finalCapital);

    expect(weekly.sharpeRatio).toBeCloseTo(daily.sharpeRatio, 10);
    expect(monthly.sharpeRatio).toBeCloseTo(daily.sharpeRatio, 10);
    expect(weekly.sortinoRatio).toBeCloseTo(daily.sortinoRatio, 10);
    expect(monthly.sortinoRatio).toBeCloseTo(daily.sortinoRatio, 10);
  });

  it("matches the canonical Sharpe of the underlying daily returns", () => {
    const barReturns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      barReturns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }
    const canonical = sharpeFromReturns(barReturns, {
      periodsPerYear: periodsPerYearFromSpan(
        barReturns.length,
        START,
        START + (equity.length - 1) * DAY,
      ),
    });

    expect(statsFor(21).sharpeRatio).toBeCloseTo(Math.round(canonical * 100) / 100, 10);
  });

  it("shrinks when the same path is stretched over a longer calendar span", () => {
    const trades = packageTrades(equity, 21);
    const oneYearSpan = { firstTime: START, lastTime: START + (equity.length - 1) * DAY };
    const tenYearSpan = { firstTime: START, lastTime: START + (equity.length - 1) * 10 * DAY };

    const short = calculateStats(
      trades,
      tradeReturnFractions(trades),
      100_000,
      equity[equity.length - 1],
      5,
      SETTINGS,
      [],
      oneYearSpan,
      equity,
    );
    const long = calculateStats(
      trades,
      tradeReturnFractions(trades),
      100_000,
      equity[equity.length - 1],
      5,
      SETTINGS,
      [],
      tenYearSpan,
      equity,
    );

    // Ten times the calendar time for the same path: the annualised ratio must
    // fall by sqrt(10), not stay put. `sharpeRatio` is rounded to two decimals
    // on the way out, which is worth a couple of percent on a ratio this size,
    // so the bound is a band rather than an equality.
    const ratio = short.sharpeRatio / long.sharpeRatio;
    expect(ratio).toBeGreaterThan(Math.sqrt(10) * 0.97);
    expect(ratio).toBeLessThan(Math.sqrt(10) * 1.03);
  });

  it("falls back to trade frequency when no equity curve is available", () => {
    const trades = packageTrades(equity, 21);
    const withoutCurve = calculateStats(
      trades,
      tradeReturnFractions(trades),
      100_000,
      equity[equity.length - 1],
      5,
      SETTINGS,
      [],
      { firstTime: START, lastTime: START + (equity.length - 1) * DAY },
    );

    // An approximation of the same quantity, not the inflated per-trade value:
    // 24 monthly trades a year annualise by sqrt(~12), not sqrt(252).
    const perTrade = tradeReturnFractions(trades);
    const inflated = sharpeFromReturns(perTrade, { periodsPerYear: 252 });
    expect(Math.abs(withoutCurve.sharpeRatio)).toBeLessThan(Math.abs(inflated) / 3);
  });
});

describe("calculateRuntimeMetrics annualises by observed trade frequency", () => {
  const returns = dailyReturns(504, 7);
  const equity = equityFrom(returns);

  it("reports the same Sharpe for daily and monthly trade packaging", () => {
    const daily = calculateRuntimeMetrics(packageTrades(equity, 1), { initialCapital: 100_000 });
    const monthly = calculateRuntimeMetrics(packageTrades(equity, 21), { initialCapital: 100_000 });

    expect(monthly.totalReturnPercent).toBeCloseTo(daily.totalReturnPercent, 6);
    // Packaging changes the observation count, so the ratios are not identical
    // the way an equity-curve-based figure would be — but they must be the
    // same order of magnitude rather than differing by sqrt(21).
    expect(monthly.sharpeRatio / daily.sharpeRatio).toBeGreaterThan(0.5);
    expect(monthly.sharpeRatio / daily.sharpeRatio).toBeLessThan(2);
    expect(monthly.sortinoRatio / daily.sortinoRatio).toBeGreaterThan(0.5);
    expect(monthly.sortinoRatio / daily.sortinoRatio).toBeLessThan(2);
  });

  it("falls to a lower annualised Sharpe when the same trades span ten years", () => {
    const short = calculateRuntimeMetrics(packageTrades(equity, 21), { initialCapital: 100_000 });
    const stretched = calculateRuntimeMetrics(packageTrades(equity, 21, 10 * DAY), {
      initialCapital: 100_000,
    });

    expect(short.sharpeRatio / stretched.sharpeRatio).toBeCloseTo(Math.sqrt(10), 1);
  });
});

describe("portfolio Sharpe covers the whole backtest window", () => {
  /** Candles from a price path, one bar per day. */
  function candlesFrom(prices: number[]): NormalizedCandle[] {
    return prices.map((close, i) => ({
      time: START + i * DAY,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));
  }

  function sharpeOver(totalBars: number): number {
    // The same traded stretch either way: the first 24 bars move and are
    // traded in and out of, the rest of the window is flat and untraded.
    const traded = Array.from({ length: 24 }, (_, i) => 100 + i + (i % 3) * 2);
    const prices = Array.from({ length: totalBars }, (_, i) =>
      i < traded.length ? traded[i] : traded[traded.length - 1],
    );
    const datasets = [
      { symbol: "A", candles: candlesFrom(prices) },
      { symbol: "B", candles: candlesFrom(prices.map((p) => p * 2)) },
    ];
    // In for two bars, out for two, so several trades close at distinct times.
    const entry: ConditionFn = (_i, _c, index) => index < traded.length && index % 4 === 0;
    const exit: ConditionFn = (_i, _c, index) => index % 4 === 2;
    return portfolioBacktest(datasets, entry, exit, {
      capital: 20_000,
      allocation: { type: "equal" },
      tradeOptions: { fillMode: "same-bar-close" },
    }).portfolio.sharpeRatio;
  }

  /** Buy on the first bar, hold to the end — one trade, one realized step. */
  function holdThroughout(prices: number[]): number {
    const datasets = [
      { symbol: "A", candles: candlesFrom(prices) },
      { symbol: "B", candles: candlesFrom(prices.map((p) => p * 2)) },
    ];
    const entry: ConditionFn = () => true;
    const never: ConditionFn = () => false;
    return portfolioBacktest(datasets, entry, never, {
      capital: 20_000,
      allocation: { type: "equal" },
      tradeOptions: { fillMode: "same-bar-close" },
    }).portfolio.sharpeRatio;
  }

  it("distinguishes a calm path from a violent one with the same P&L", () => {
    // Both paths start at 100 and end at 120; one drifts, the other lurches.
    const calm = Array.from({ length: 41 }, (_, i) => 100 + i * 0.5);
    const violent = Array.from({ length: 41 }, (_, i) =>
      i === 40 ? 120 : 100 + i * 0.5 + (i % 2 === 0 ? 12 : -12),
    );

    const calmSharpe = holdThroughout(calm);
    const violentSharpe = holdThroughout(violent);

    // A realized-P&L curve sees one step for either path and cannot tell them
    // apart — it has a single return observation, so the ratio is undefined.
    expect(calmSharpe).toBeGreaterThan(0);
    expect(violentSharpe).toBeLessThan(calmSharpe);
  });

  it("falls when the same trades are followed by a long flat tail", () => {
    const short = sharpeOver(24);
    const withIdleTail = sharpeOver(220);

    // Capital was tied up for twenty times as long for the same P&L, so the
    // annualised figure has to come down. Before, the curve ended at the last
    // trade exit and the idle tail was invisible.
    expect(short).toBeGreaterThan(0);
    expect(withIdleTail).toBeGreaterThan(0);
    expect(withIdleTail).toBeLessThan(short / 2);
  });
});
