import { describe, expect, it } from "vitest";
import {
  alwaysFalse,
  alwaysTrue,
  deadCross,
  goldenCross,
  rsiAbove,
  rsiBelow,
} from "../backtest/conditions";
import { batchBacktest, portfolioBacktest } from "../backtest/portfolio";
import type { NormalizedCandle, SymbolData } from "../types";

/** Generate synthetic candle data with a trend */
function generateCandles(
  count: number,
  startPrice: number,
  trend: "up" | "down" | "flat",
  startTime: number = Date.UTC(2024, 0, 1),
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = startPrice;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const change =
      trend === "up"
        ? Math.random() * 3 - 0.5 // Bias up
        : trend === "down"
          ? Math.random() * 3 - 2.5 // Bias down
          : Math.random() * 2 - 1; // Flat

    price = Math.max(1, price + change);
    const high = price + Math.random() * 2;
    const low = price - Math.random() * 2;
    const open = price + (Math.random() - 0.5);
    const volume = 1000000 + Math.random() * 500000;

    candles.push({
      time: startTime + i * MS_PER_DAY,
      open: Math.max(1, open),
      high: Math.max(1, high),
      low: Math.max(0.5, low),
      close: Math.max(1, price),
      volume,
    });
  }
  return candles;
}

function createDatasets(): SymbolData[] {
  return [
    { symbol: "AAPL", candles: generateCandles(200, 150, "up") },
    { symbol: "MSFT", candles: generateCandles(200, 300, "up") },
    { symbol: "GOOG", candles: generateCandles(200, 100, "flat") },
  ];
}

describe("batchBacktest", () => {
  it("should run independent backtests and return per-symbol results", () => {
    const datasets = createDatasets();
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = batchBacktest(datasets, entry, exit, {
      capital: 3_000_000,
      stopLoss: 5,
    });

    // Should have results for each symbol
    expect(result.symbols).toHaveLength(3);
    expect(result.symbols.map((s) => s.symbol)).toEqual(["AAPL", "MSFT", "GOOG"]);

    // Each symbol should get equal capital (3M / 3 = 1M each)
    for (const sr of result.symbols) {
      expect(sr.result.initialCapital).toBe(1_000_000);
    }

    // Portfolio metrics
    expect(result.portfolio.initialCapital).toBe(3_000_000);
    expect(typeof result.portfolio.totalReturnPercent).toBe("number");
    expect(typeof result.portfolio.maxDrawdown).toBe("number");
    expect(typeof result.portfolio.sharpeRatio).toBe("number");

    // Equity curve should start with initial capital
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.equityCurve[0].equity).toBe(3_000_000);

    // All trades should be sorted by entry time
    for (let i = 1; i < result.allTrades.length; i++) {
      expect(result.allTrades[i].entryTime).toBeGreaterThanOrEqual(
        result.allTrades[i - 1].entryTime,
      );
    }

    // Each trade should have a symbol tag
    for (const trade of result.allTrades) {
      expect(["AAPL", "MSFT", "GOOG"]).toContain(trade.symbol);
    }
  });

  it("should support custom allocation weights", () => {
    const datasets = createDatasets();
    const entry = rsiBelow(30);
    const exit = rsiAbove(70);

    const result = batchBacktest(datasets, entry, exit, {
      capital: 1_000_000,
      allocation: "custom",
      allocations: { AAPL: 0.5, MSFT: 0.3, GOOG: 0.2 },
    });

    expect(result.symbols[0].result.initialCapital).toBe(500_000);
    expect(result.symbols[1].result.initialCapital).toBe(300_000);
    expect(result.symbols[2].result.initialCapital).toBe(200_000);
  });

  it("should throw on empty datasets", () => {
    expect(() =>
      batchBacktest([], goldenCross(5, 25), deadCross(5, 25), {
        capital: 1_000_000,
      }),
    ).toThrow("At least one symbol dataset is required");
  });

  it("should throw on invalid allocation weights", () => {
    const datasets = createDatasets();

    expect(() =>
      batchBacktest(datasets, goldenCross(5, 25), deadCross(5, 25), {
        capital: 1_000_000,
        allocation: "custom",
        allocations: { AAPL: 0.5, MSFT: 0.3, GOOG: 0.1 }, // Sum = 0.9
      }),
    ).toThrow("must sum to 1.0");
  });

  it("should handle single symbol (degenerate case)", () => {
    const datasets = [{ symbol: "AAPL", candles: generateCandles(200, 100, "up") }];
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = batchBacktest(datasets, entry, exit, {
      capital: 1_000_000,
    });

    expect(result.symbols).toHaveLength(1);
    expect(result.portfolio.initialCapital).toBe(1_000_000);
    // Single-symbol portfolio result should match the individual result
    expect(result.portfolio.finalCapital).toBeCloseTo(result.symbols[0].result.finalCapital, 0);
  });

  it("should aggregate trade count correctly", () => {
    const datasets = createDatasets();
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = batchBacktest(datasets, entry, exit, {
      capital: 3_000_000,
    });

    const sumTrades = result.symbols.reduce((s, sr) => s + sr.result.tradeCount, 0);
    expect(result.portfolio.tradeCount).toBe(sumTrades);
    expect(result.allTrades.length).toBe(sumTrades);
  });
});

describe("portfolioBacktest", () => {
  it("should run with equal allocation and return portfolio result", () => {
    const datasets = createDatasets();
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = portfolioBacktest(datasets, entry, exit, {
      capital: 3_000_000,
      allocation: { type: "equal" },
      maxPositions: 3,
      tradeOptions: { stopLoss: 5 },
    });

    expect(result.symbols).toHaveLength(3);
    expect(result.portfolio.initialCapital).toBe(3_000_000);
    expect(typeof result.peakConcurrentPositions).toBe("number");
    expect(result.peakConcurrentPositions).toBeGreaterThanOrEqual(0);
    expect(result.rebalanceCount).toBe(0); // No rebalance configured
  });

  it("should support fixed weight allocation", () => {
    const datasets = createDatasets();
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = portfolioBacktest(datasets, entry, exit, {
      capital: 1_000_000,
      allocation: { type: "fixed", weights: { AAPL: 0.5, MSFT: 0.3, GOOG: 0.2 } },
    });

    expect(result.symbols[0].result.initialCapital).toBeLessThanOrEqual(500_000);
    expect(result.symbols[1].result.initialCapital).toBeLessThanOrEqual(300_000);
    expect(result.symbols[2].result.initialCapital).toBeLessThanOrEqual(200_000);
  });

  it("should enforce maxSymbolExposure", () => {
    const datasets = createDatasets();
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = portfolioBacktest(datasets, entry, exit, {
      capital: 3_000_000,
      allocation: { type: "equal" },
      maxSymbolExposure: 20, // Max 20% per symbol = 600K each
    });

    for (const sr of result.symbols) {
      expect(sr.result.initialCapital).toBeLessThanOrEqual(600_000);
    }
  });

  it("reports no rebalances, because none happen", () => {
    // `rebalance` is accepted but not yet enforced. It used to report a
    // calendar estimate (span / 30 days), which named events that never took
    // place: the allocation is fixed for the whole run.
    const datasets = createDatasets(); // 200 daily candles ≈ ~6-7 months
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);
    const options = {
      capital: 3_000_000,
      allocation: { type: "equal" as const },
    };

    const withRebalance = portfolioBacktest(datasets, entry, exit, {
      ...options,
      rebalance: { frequency: "monthly" as const },
    });
    const without = portfolioBacktest(datasets, entry, exit, options);

    expect(withRebalance.rebalanceCount).toBe(0);
    // Passing the option changes nothing about the simulation.
    expect(withRebalance.equityCurve).toEqual(without.equityCurve);
    expect(withRebalance.portfolio).toEqual(without.portfolio);
  });
});

describe("portfolioBacktest capital accounting", () => {
  const DAY = 24 * 60 * 60 * 1000;

  /** Flat bars at a constant price, optionally starting `startBar` days late. */
  function flatBars(count: number, price = 100, startBar = 0): NormalizedCandle[] {
    return Array.from({ length: count }, (_, i) => ({
      time: Date.UTC(2024, 0, 1) + (i + startBar) * DAY,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1000,
    }));
  }

  const never = alwaysFalse();

  it("holds capital withheld by maxSymbolExposure as portfolio cash", () => {
    // 3 equal-weight symbols want 1,000,000 each; a 25% cap allows 750,000, so
    // 750,000 of the 3,000,000 is never deployed. With no trades at all, the
    // portfolio has neither gained nor lost anything.
    const datasets = ["A", "B", "C"].map((symbol) => ({ symbol, candles: flatBars(30) }));

    const result = portfolioBacktest(datasets, never, never, {
      capital: 3_000_000,
      allocation: { type: "equal" },
      maxSymbolExposure: 25,
    });

    expect(result.portfolio.tradeCount).toBe(0);
    expect(result.portfolio.finalCapital).toBeCloseTo(3_000_000, 6);
    expect(result.portfolio.totalReturn).toBe(0);
    expect(result.portfolio.totalReturnPercent).toBe(0);
    expect(result.portfolio.maxDrawdown).toBe(0);
    expect(result.equityCurve[0].equity).toBeCloseTo(3_000_000, 6);
    // The sleeves really were capped — the cash is what makes the books balance.
    for (const sr of result.symbols) {
      expect(sr.result.initialCapital).toBeCloseTo(750_000, 6);
    }
  });

  it("rejects a dataset list that names the same symbol twice", () => {
    // Capital, allocation weights and the merged equity curve are keyed by
    // symbol, so a repeat collapses datasets on those paths while every sleeve
    // still runs and still counts — capital stops being conserved. Two equal
    // 500-capital sleeves against a 1,000 portfolio reported a 50% gain with
    // zero trades; with a 25% cap on top it reported a 50% loss instead.
    const datasets = [
      { symbol: "A", candles: flatBars(5) },
      { symbol: "B", candles: flatBars(5) },
      { symbol: "A", candles: flatBars(5) },
    ];

    expect(() =>
      portfolioBacktest(datasets, never, never, {
        capital: 1_000_000,
        allocation: { type: "equal" },
      }),
    ).toThrow(/Duplicate symbol\(s\) in datasets: A/);

    // The same guard covers the sibling entry point, whose merged curve
    // silently dropped one of the two sleeves.
    expect(() => batchBacktest(datasets, never, never, { capital: 1_000_000 })).toThrow(
      /Duplicate symbol\(s\) in datasets: A/,
    );

    // A unique list is unaffected.
    expect(() =>
      portfolioBacktest(datasets.slice(0, 2), never, never, {
        capital: 1_000_000,
        allocation: { type: "equal" },
      }),
    ).not.toThrow();
  });

  it("reports the same idle portfolio whether or not the cap binds", () => {
    const datasets = ["A", "B", "C"].map((symbol) => ({ symbol, candles: flatBars(30) }));
    const options = { capital: 3_000_000, allocation: { type: "equal" as const } };

    const capped = portfolioBacktest(datasets, never, never, {
      ...options,
      maxSymbolExposure: 25,
    });
    const uncapped = portfolioBacktest(datasets, never, never, options);

    expect(capped.portfolio.totalReturnPercent).toBe(uncapped.portfolio.totalReturnPercent);
    expect(capped.portfolio.maxDrawdown).toBe(uncapped.portfolio.maxDrawdown);
    expect(capped.equityCurve[0].equity).toBeCloseTo(uncapped.equityCurve[0].equity, 6);
  });

  it("fills a symbol's pre-first-bar equity with what it actually started with", () => {
    // B's data begins 10 bars late. Before that the merged curve has to stand
    // in for it — with the capped 500,000 it was started with, not the
    // 1,000,000 its weight asked for, or B's first bar shows a step down that
    // no trade caused.
    const datasets = [
      { symbol: "A", candles: flatBars(20) },
      { symbol: "B", candles: flatBars(10, 100, 10) },
    ];

    const result = portfolioBacktest(datasets, never, never, {
      capital: 2_000_000,
      allocation: { type: "equal" },
      maxSymbolExposure: 25,
    });

    const equities = result.equityCurve.map((p) => p.equity);
    expect(new Set(equities).size).toBe(1);
    expect(equities[0]).toBeCloseTo(2_000_000, 6);
  });

  it("keeps initialCapital and finalCapital on the same basis under a cap", () => {
    // A rises 20%, B and C are flat. Only A's capped sleeve can earn anything.
    const datasets = [
      { symbol: "A", candles: [...flatBars(15), ...flatBars(15, 120, 15)] },
      { symbol: "B", candles: flatBars(30) },
      { symbol: "C", candles: flatBars(30) },
    ];

    const result = portfolioBacktest(datasets, alwaysTrue(), never, {
      capital: 3_000_000,
      allocation: { type: "equal" },
      maxSymbolExposure: 25,
      tradeOptions: { fillMode: "same-bar-close", slTpMode: "close-only" },
    });

    const sleeves = result.symbols.reduce((s, sr) => s + sr.result.finalCapital, 0);
    const idleCash = 3_000_000 - result.symbols.reduce((s, sr) => s + sr.result.initialCapital, 0);
    expect(idleCash).toBeCloseTo(750_000, 6);
    expect(result.portfolio.finalCapital).toBeCloseTo(sleeves + idleCash, 2);
    expect(result.portfolio.initialCapital).toBe(3_000_000);
    // The last point of the merged curve is the portfolio's final worth.
    const lastEquity = result.equityCurve[result.equityCurve.length - 1].equity;
    expect(lastEquity).toBeCloseTo(result.portfolio.finalCapital, 2);
  });
});
