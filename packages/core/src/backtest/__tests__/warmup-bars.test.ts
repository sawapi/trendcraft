import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../core/random";
import { calculateAllMetrics } from "../../optimization/metrics";
import type { NormalizedCandle } from "../../types";
import { deadCross, goldenCross } from "../conditions/ma-cross";
import { runBacktest } from "../engine";
import { batchBacktest, portfolioBacktest } from "../portfolio";

/** Seeded random walk, so every run sees the same series. */
function randomWalk(n: number, seed = 11): NormalizedCandle[] {
  const rnd = mulberry32(seed);
  const start = Date.UTC(2020, 0, 1);
  let close = 100;
  return Array.from({ length: n }, (_, i) => {
    close *= 1 + (rnd() - 0.5) * 0.04;
    return {
      time: start + i * 86400000,
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1000,
    };
  });
}

describe("runBacktest warmupBars", () => {
  const candles = randomWalk(400);
  const entry = () => goldenCross(5, 60);
  const exit = () => deadCross(5, 60);

  it("is the default behaviour at 0", () => {
    const plain = runBacktest(candles, entry(), exit(), { capital: 100_000 });
    const zero = runBacktest(candles, entry(), exit(), { capital: 100_000, warmupBars: 0 });
    expect(zero).toEqual(plain);
  });

  it("reports only the evaluated window", () => {
    const w = 150;
    const result = runBacktest(candles, entry(), exit(), { capital: 100_000, warmupBars: w });

    expect(result.equityCurve).toHaveLength(candles.length - w);
    expect(result.firstBarTime).toBe(candles[w].time);
    expect(result.lastBarTime).toBe(candles[candles.length - 1].time);
    for (const trade of result.trades) {
      expect(trade.entryTime).toBeGreaterThanOrEqual(candles[w].time);
    }
  });

  it("can signal from the first bars of the window that a cold slice loses", () => {
    // A 60-bar cross needs 60 bars of history. Cold, the slice cannot cross
    // before its 60th bar; warm, it can cross anywhere in the window.
    const w = 150;
    const window = candles.slice(w);
    const cold = runBacktest(window, entry(), exit(), { capital: 100_000 });
    const warm = runBacktest(candles, entry(), exit(), { capital: 100_000, warmupBars: w });

    const coldFirst = cold.trades[0]?.entryTime ?? Number.POSITIVE_INFINITY;
    expect(coldFirst).toBeGreaterThanOrEqual(window[59].time);
    // Every trade the warm run takes after the cold run's horizon is one the
    // full-history run takes too: warm-up changes what the window can see,
    // not how a signal is traded.
    const full = runBacktest(candles, entry(), exit(), { capital: 100_000 });
    const fullEntries = new Set(full.trades.map((t) => t.entryTime));
    for (const trade of warm.trades) {
      expect(fullEntries.has(trade.entryTime)).toBe(true);
    }
    expect(warm.tradeCount).toBeGreaterThanOrEqual(cold.tradeCount);
  });

  it("starts flat even when the full run is in a position at the window start", () => {
    const full = runBacktest(candles, entry(), exit(), { capital: 100_000 });
    // Open the window one bar after a full-run entry, while that trade is held.
    const held = full.trades.find((t) => t.holdingDays >= 3);
    expect(held).toBeDefined();
    const w = candles.findIndex((c) => c.time === held?.entryTime) + 1;

    const warm = runBacktest(candles, entry(), exit(), { capital: 100_000, warmupBars: w });
    expect(warm.trades.some((t) => t.entryTime === held?.entryTime)).toBe(false);
    expect(warm.equityCurve?.[0]).toBe(100_000);
  });

  it("never trades the first evaluated bar, so the curve opens at capital", () => {
    // An always-true entry filled at the signal bar's close would, if the
    // first evaluated bar could trade, put that entry's fee and move before
    // the curve's first point — invisible to drawdown and returns.
    const always = () => () => true;
    const never = () => () => false;
    for (const w of [0, 26]) {
      const result = runBacktest(candles, always(), never(), {
        capital: 100_000,
        fillMode: "same-bar-close",
        commissionRate: 1,
        warmupBars: w,
      });
      expect(result.equityCurve?.[0]).toBe(100_000);
      expect(result.trades[0]?.entryTime).toBe(candles[w + 1].time);
    }
  });

  it("returns an empty result when fewer than two bars remain", () => {
    const result = runBacktest(candles, entry(), exit(), {
      capital: 100_000,
      warmupBars: candles.length - 1,
    });
    expect(result.tradeCount).toBe(0);
    expect(result.finalCapital).toBe(100_000);
  });

  it("rejects a negative or fractional value", () => {
    expect(() => runBacktest(candles, entry(), exit(), { capital: 1, warmupBars: -1 })).toThrow(
      /warmupBars/,
    );
    expect(() => runBacktest(candles, entry(), exit(), { capital: 1, warmupBars: 2.5 })).toThrow(
      /warmupBars/,
    );
  });

  it("refuses to score a warm run against the full candle array", () => {
    const w = 150;
    const result = runBacktest(candles, entry(), exit(), { capital: 100_000, warmupBars: w });
    expect(() => calculateAllMetrics(result, candles)).toThrow(/equityCurve has/);
    expect(() => calculateAllMetrics(result, candles.slice(w))).not.toThrow();
  });

  it("is rejected by batchBacktest and portfolioBacktest", () => {
    const datasets = [{ symbol: "A", candles }];
    // Bypass the type, which already excludes the option.
    const sneak = { warmupBars: 10 } as object;
    expect(() => batchBacktest(datasets, entry(), exit(), { capital: 100_000, ...sneak })).toThrow(
      /warmupBars is not supported/,
    );
    expect(() =>
      portfolioBacktest(datasets, entry(), exit(), {
        capital: 100_000,
        allocation: { type: "equal" },
        tradeOptions: sneak,
      }),
    ).toThrow(/warmupBars is not supported/);
  });
});
