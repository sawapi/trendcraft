import { describe, expect, it } from "vitest";
import { calculateDailyReturns } from "../../optimization/metrics";
import type { NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";
import { at, stepCandles } from "./step-candles";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Compound a daily-returns series into a final equity from `capital`. */
function compound(capital: number, returns: number[]): number {
  return returns.reduce((eq, r) => eq * (1 + r), capital);
}

describe("runBacktest equityCurve", () => {
  it("is candle-aligned, starts at capital and ends at final capital", () => {
    const candles = stepCandles([
      { price: 100, bars: 5 },
      { price: 110, bars: 5 },
    ]);
    const result = runBacktest(candles, at(1), at(8), { capital: 100_000 });

    expect(result.equityCurve).toBeDefined();
    expect(result.equityCurve).toHaveLength(candles.length);
    expect(result.equityCurve?.[0]).toBe(100_000);
    expect(result.equityCurve?.[candles.length - 1]).toBeCloseTo(result.finalCapital, 6);
  });

  it("marks an open long up as the price rises", () => {
    const candles = stepCandles([
      { price: 100, bars: 5 },
      { price: 110, bars: 5 },
    ]);
    const result = runBacktest(candles, at(1), at(8), { capital: 100_000 });
    // Entry fills at bar 2 (100); bar 5 closes at 110 -> +10% on the open position.
    const curve = result.equityCurve ?? [];
    expect(curve[4]).toBeCloseTo(100_000, 6); // last bar before the step
    expect(curve[5]).toBeCloseTo(110_000, 6); // step to 110 marked to market
  });

  it("marks an open short up as the price falls", () => {
    const candles = stepCandles([
      { price: 100, bars: 5 },
      { price: 90, bars: 5 },
    ]);
    const result = runBacktest(candles, at(1), at(8), {
      capital: 100_000,
      direction: "short",
    });
    const curve = result.equityCurve ?? [];
    expect(curve[4]).toBeCloseTo(100_000, 6);
    expect(curve[5]).toBeCloseTo(110_000, 6); // a short gains 10% when price drops 10%
  });

  it("reconstructs daily returns that compound back to the final capital", () => {
    const candles = stepCandles([
      { price: 100, bars: 5 },
      { price: 110, bars: 5 },
      { price: 105, bars: 5 },
    ]);
    const result = runBacktest(candles, at(1), at(12), { capital: 100_000 });
    const returns = calculateDailyReturns(result, candles, 100_000);
    expect(compound(100_000, returns)).toBeCloseTo(result.finalCapital, 4);
  });
});

describe("runBacktest equityCurve — partial exits / scale-out", () => {
  function risingCandles(entryPrice: number, sequence: number[]): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const base = 1_700_000_000_000;
    // Bar 0 + entry-signal bar 1, both at entryPrice.
    candles.push({
      time: base,
      open: entryPrice,
      high: entryPrice * 1.01,
      low: entryPrice * 0.99,
      close: entryPrice,
      volume: 1_000_000,
    });
    candles.push({
      time: base + MS_PER_DAY,
      open: entryPrice,
      high: entryPrice * 1.01,
      low: entryPrice * 0.99,
      close: entryPrice,
      volume: 1_000_000,
    });
    for (let i = 0; i < sequence.length; i++) {
      const p = sequence[i];
      candles.push({
        time: base + (i + 2) * MS_PER_DAY,
        open: p,
        high: p * 1.01,
        low: p * 0.99,
        close: p,
        volume: 1_000_000,
      });
    }
    return candles;
  }

  // Entry at 100, then a staged climb that trips three scale-out levels.
  const candles = risingCandles(100, [103, 105, 108, 110, 115, 120, 125]);
  const result = runBacktest(candles, at(1), () => false, {
    capital: 1_000_000,
    scaleOut: {
      levels: [
        { threshold: 5, sellPercent: 33 },
        { threshold: 10, sellPercent: 50 },
        { threshold: 20, sellPercent: 100 },
      ],
    },
    fillMode: "same-bar-close",
    slTpMode: "intraday",
  });

  it("emits three partial trades sharing one entry", () => {
    expect(result.tradeCount).toBe(3);
    expect(result.trades.every((t) => t.entryTime === result.trades[0].entryTime)).toBe(true);
    expect(result.trades[0].isPartial).toBe(true);
    expect(result.trades[2].isPartial).toBe(false);
  });

  it("keeps the equity curve faithful through every partial exit", () => {
    const curve = result.equityCurve ?? [];
    expect(curve).toHaveLength(candles.length);
    expect(curve[0]).toBe(1_000_000);
    expect(curve[candles.length - 1]).toBeCloseTo(result.finalCapital, 4);

    // The reconstructed daily returns must compound to the true final capital.
    // A from-trades reconstruction that stops at the first partial exit would
    // drop the later legs' P&L and fall short here.
    const returns = calculateDailyReturns(result, candles, 1_000_000);
    expect(compound(1_000_000, returns)).toBeCloseTo(result.finalCapital, 4);

    // Prices only rise, so the faithful curve never steps down.
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-6);
    }
  });
});
