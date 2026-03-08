import { describe, expect, it } from "vitest";
import { deadCross, goldenCross, rsiAbove, rsiBelow } from "../backtest/conditions";
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

  it("should estimate rebalance count for monthly frequency", () => {
    const datasets = createDatasets(); // 200 daily candles ≈ ~6-7 months
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = portfolioBacktest(datasets, entry, exit, {
      capital: 3_000_000,
      allocation: { type: "equal" },
      rebalance: { frequency: "monthly" },
    });

    expect(result.rebalanceCount).toBeGreaterThanOrEqual(5);
    expect(result.rebalanceCount).toBeLessThanOrEqual(8);
  });
});
