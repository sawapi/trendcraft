import { describe, expect, it } from "vitest";
import { alwaysFalse, alwaysTrue, deadCross, goldenCross } from "../backtest/conditions";
import { batchBacktest, portfolioBacktest } from "../backtest/portfolio";
import { mulberry32 } from "../core/random";
import type { NormalizedCandle, PortfolioBacktestOptions, SymbolData } from "../types";

/** Generate synthetic candle data with a trend */
function generateCandles(
  count: number,
  startPrice: number,
  trend: "up" | "down" | "flat",
  startTime: number = Date.UTC(2024, 0, 1),
): NormalizedCandle[] {
  // Seeded so the fixture is the same on every run: an unseeded draw made assertions on the generated data flaky.
  const random = mulberry32(count + startPrice * 7 + { up: 1, down: 2, flat: 3 }[trend]);
  const candles: NormalizedCandle[] = [];
  let price = startPrice;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // An unbroken climb never lets the 5-bar MA dip under the 25-bar one, so
    // goldenCross(5, 25) would never fire: the up trend pulls back for the
    // last 6 bars of every 30.
    const pullback = trend === "up" && i % 30 >= 24;
    const change = pullback
      ? random() * 3 - 3.5
      : trend === "up"
        ? random() * 3 - 0.5 // Bias up
        : trend === "down"
          ? random() * 3 - 2.5 // Bias down
          : random() * 2 - 1; // Flat

    price = Math.max(1, price + change);
    const high = price + random() * 2;
    const low = price - random() * 2;
    const open = price + (random() - 0.5);
    const volume = 1000000 + random() * 500000;

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
      // Every symbol trades, so the ordering and tagging checks below see all three.
      expect(sr.result.tradeCount, sr.symbol).toBeGreaterThan(0);
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

    // Each trade carries the tag of the symbol that made it
    for (const sr of result.symbols) {
      const tagged = result.allTrades.filter((t) => t.symbol === sr.symbol);
      expect(
        tagged.map((t) => t.entryTime),
        sr.symbol,
      ).toEqual(sr.result.trades.map((t) => t.entryTime));
    }
  });

  it("should support custom allocation weights", () => {
    const datasets = createDatasets();
    const entry = goldenCross(5, 25);
    const exit = deadCross(5, 25);

    const result = batchBacktest(datasets, entry, exit, {
      capital: 1_000_000,
      allocation: "custom",
      allocations: { AAPL: 0.5, MSFT: 0.3, GOOG: 0.2 },
    });

    expect(result.symbols[0].result.initialCapital).toBe(500_000);
    expect(result.symbols[1].result.initialCapital).toBe(300_000);
    expect(result.symbols[2].result.initialCapital).toBe(200_000);
    // The weights size real positions, not idle sleeves.
    for (const sr of result.symbols) expect(sr.result.tradeCount, sr.symbol).toBeGreaterThan(0);
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
    // With no trades both sides would be the untouched 1,000,000.
    expect(result.symbols[0].result.tradeCount).toBeGreaterThan(0);
    expect(result.symbols[0].result.finalCapital).not.toBeCloseTo(1_000_000, 0);
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
    for (const sr of result.symbols) expect(sr.result.tradeCount, sr.symbol).toBeGreaterThan(0);
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
      tradeOptions: { stopLoss: 5 },
    });

    expect(result.symbols).toHaveLength(3);
    expect(result.portfolio.initialCapital).toBe(3_000_000);
    expect(result.portfolio.tradeCount).toBeGreaterThan(0);
    // Recount the peak from the per-symbol trades: the most positions open at
    // any entry, where a position exiting on that bar no longer counts. The
    // seeded fixture has all three symbols in at once.
    const trades = result.symbols.flatMap((sr) => sr.result.trades);
    const recount = Math.max(
      ...trades.map(
        (t) => trades.filter((u) => u.entryTime <= t.entryTime && t.entryTime < u.exitTime).length,
      ),
    );
    expect(result.peakConcurrentPositions).toBe(recount);
    expect(result.peakConcurrentPositions).toBe(3);
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

  // Each of these used to be accepted and silently ignored, so a run that
  // asked for, say, at most 3 positions reported the figures of a strategy
  // with no such limit.
  for (const [name, value, instead] of [
    ["maxPositions", 3, "peakConcurrentPositions"],
    ["maxPortfolioDrawdown", 15, "createPortfolioGuard"],
  ] as const) {
    it(`rejects ${name}, which is not supported yet`, () => {
      expect(() =>
        portfolioBacktest(createDatasets(), goldenCross(5, 25), deadCross(5, 25), {
          capital: 3_000_000,
          allocation: { type: "equal" },
          [name]: value,
        }),
      ).toThrow(new RegExp(`\`${name}\`: not supported yet[^\\n]*${instead}`));
    });
  }

  it("names every unsupported option at once", () => {
    // Reporting only the first would make a caller fix one and hit the next.
    expect(() =>
      portfolioBacktest(createDatasets(), goldenCross(5, 25), deadCross(5, 25), {
        capital: 3_000_000,
        allocation: { type: "equal" },
        maxPositions: 3,
        maxPortfolioDrawdown: 15,
        rebalance: { frequency: "monthly" },
      } as unknown as Parameters<typeof portfolioBacktest>[3]),
    ).toThrow(/`maxPositions`[\s\S]*`maxPortfolioDrawdown`[\s\S]*`rebalance`: removed/);
  });

  it("rejects the removed rebalance option instead of ignoring it", () => {
    // It is gone from the type, but a caller without types would otherwise
    // have it silently ignored, as before.
    const options = {
      capital: 3_000_000,
      allocation: { type: "equal" },
      rebalance: { frequency: "monthly" },
    } as unknown as Parameters<typeof portfolioBacktest>[3];
    expect(() =>
      portfolioBacktest(createDatasets(), goldenCross(5, 25), deadCross(5, 25), options),
    ).toThrow(/`rebalance`: removed/);
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

  it("does not count a position that exits on the bar another one enters", () => {
    // A holds bars 1–3 and B bars 3–5: A's exit and B's entry share bar 3, so
    // at most one position is ever open. Counting the entry before the exit
    // would report 2. The two symbols are told apart by their bar counts.
    const isA = (candles: NormalizedCandle[]) => candles.length === 8;
    const result = portfolioBacktest(
      [
        { symbol: "A", candles: flatBars(8) },
        { symbol: "B", candles: flatBars(9) },
      ],
      {
        type: "preset",
        name: "entry",
        evaluate: (_i, _c, index, candles) => index === (isA(candles) ? 1 : 3),
      },
      {
        type: "preset",
        name: "exit",
        evaluate: (_i, _c, index, candles) => index === (isA(candles) ? 3 : 5),
      },
      {
        capital: 2_000_000,
        allocation: { type: "equal" },
        tradeOptions: { fillMode: "same-bar-close", slTpMode: "close-only" },
      },
    );
    const [first, second] = result.allTrades;
    // Stimulus: one trade exits on the bar the other enters.
    expect(result.allTrades).toHaveLength(2);
    expect(first.exitTime).toBe(second.entryTime);
    expect(result.peakConcurrentPositions).toBe(1);
  });

  describe("peakConcurrentPositions orders same-bar fills by when in the bar they happen", () => {
    /** Flat bars at 100; `lows` maps bar index → that bar's low. */
    const bars = (count: number, lows: Record<number, number>) =>
      flatBars(count).map((c, i) => ({ ...c, low: lows[i] ?? c.low }));
    // Symbols are told apart by their bar counts (conditions get no symbol).
    const by = (candles: NormalizedCandle[], a: number, b: number) =>
      candles.length === 8 ? a : b;

    it("counts a limit entry during the bar as overlapping a close exit that bar", () => {
      // A's limit fills on bar 2 and A exits at bar 3's close. B's limit fills
      // during bar 3, so both are held from then to the close: 2 at once. By
      // timestamp alone the exit counted first and the peak read 1.
      const result = portfolioBacktest(
        [
          { symbol: "A", candles: bars(8, { 2: 90 }) },
          { symbol: "B", candles: bars(9, { 3: 90 }) },
        ],
        {
          type: "preset",
          name: "entry",
          evaluate: (_i, _c, index, candles) => index === by(candles, 1, 2),
        },
        {
          type: "preset",
          name: "exit",
          evaluate: (_i, _c, index, candles) => index === by(candles, 3, 6),
        },
        {
          capital: 2_000_000,
          allocation: { type: "equal" },
          tradeOptions: {
            fillMode: "same-bar-close",
            orderType: { type: "limit", price: 95 },
          },
        },
      );
      const [a, b] = result.allTrades;
      // Stimulus: A exits on the bar B's limit fills.
      expect(result.allTrades).toHaveLength(2);
      expect(a.exitTime).toBe(b.entryTime);
      expect(a.exitReason).toBe("signal");
      expect(result.peakConcurrentPositions).toBe(2);
    });

    it("counts the entry first when a stop and a limit both fill during the bar", () => {
      // A's stop and B's limit both fill during bar 3; OHLC cannot say which
      // came first, so the entry counts first and the peak errs high (2).
      const result = portfolioBacktest(
        [
          { symbol: "A", candles: bars(8, { 2: 90, 3: 80 }) },
          { symbol: "B", candles: bars(9, { 3: 90 }) },
        ],
        {
          type: "preset",
          name: "entry",
          evaluate: (_i, _c, index, candles) => index === by(candles, 1, 2),
        },
        { type: "preset", name: "exit", evaluate: () => false },
        {
          capital: 2_000_000,
          allocation: { type: "equal" },
          tradeOptions: {
            fillMode: "same-bar-close",
            slTpMode: "intraday",
            stopLoss: 10,
            orderType: { type: "limit", price: 95 },
          },
        },
      );
      const [a, b] = result.allTrades;
      // Stimulus: A's stop fires on the bar B's limit fills.
      expect(a.exitReason).toBe("stopLoss");
      expect(a.exitTime).toBe(b.entryTime);
      expect(result.peakConcurrentPositions).toBe(2);
    });

    it("puts a limit filled at the close (timeInForce cls) after a stop during the bar", () => {
      // B's order fills at bar 3's close, after A's stop took A out during
      // bar 3: never both held. Placing every limit fill during the bar
      // counted B in first and read 2.
      const result = portfolioBacktest(
        [
          { symbol: "A", candles: bars(8, { 3: 80 }) },
          { symbol: "B", candles: bars(9, {}) },
        ],
        {
          type: "preset",
          name: "entry",
          evaluate: (_i, _c, index, candles) => index === by(candles, 1, 2),
        },
        { type: "preset", name: "exit", evaluate: () => false },
        {
          capital: 2_000_000,
          allocation: { type: "equal" },
          tradeOptions: {
            fillMode: "same-bar-close",
            slTpMode: "intraday",
            stopLoss: 10,
            orderType: { type: "limit", price: 95 },
            timeInForce: "cls",
          },
        },
      );
      const [a, b] = result.allTrades;
      // Stimulus: A's stop fires on the bar B's order fills at the close.
      expect(a.exitReason).toBe("stopLoss");
      expect(a.exitTime).toBe(b.entryTime);
      expect(result.peakConcurrentPositions).toBe(1);
    });

    for (const [label, tradeOptions] of [
      ["a partial take profit", { partialTakeProfit: { threshold: 5, sellPercent: 50 } }],
      ["a scale-out", { scaleOut: { levels: [{ threshold: 5, sellPercent: 50 }] } }],
    ] as [string, PortfolioBacktestOptions["tradeOptions"]][]) {
      it(`counts a position once through ${label}`, () => {
        // One symbol: in at bar 1's close, 110 from bar 3 (part sold), out at
        // bar 5. Every Trade of the position carries its entry time, so each
        // was counted as another position held.
        const candles = flatBars(8).map((c, i) =>
          i >= 3 ? { ...c, open: 110, high: 110, low: 110, close: 110 } : c,
        );
        const result = portfolioBacktest(
          [{ symbol: "A", candles }],
          { type: "preset", name: "entry", evaluate: (_i, _c, index) => index === 1 },
          { type: "preset", name: "exit", evaluate: (_i, _c, index) => index === 5 },
          {
            capital: 1_000_000,
            allocation: { type: "equal" },
            tradeOptions: { fillMode: "same-bar-close", ...tradeOptions },
          },
        );
        // Stimulus: the position closed in two Trades, the first partial.
        expect(result.allTrades).toHaveLength(2);
        expect(result.allTrades[0].isPartial).toBe(true);
        expect(result.peakConcurrentPositions).toBe(1);
      });
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

describe("portfolioBacktest profit factor", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const bars = (prices: number[]): NormalizedCandle[] =>
    prices.map((p, i) => ({
      time: Date.UTC(2024, 0, 1) + i * DAY,
      open: p,
      high: p,
      low: p,
      close: p,
      volume: 1000,
    }));
  const run = (b: number[]) =>
    portfolioBacktest(
      [
        { symbol: "A", candles: bars([100, 100, 100, 300, 300]) },
        { symbol: "B", candles: bars(b) },
      ],
      alwaysTrue(),
      alwaysFalse(),
      {
        capital: 2_000_000,
        allocation: { type: "equal" },
        tradeOptions: { fillMode: "same-bar-close", slTpMode: "close-only" },
      },
    );

  it("reports a large ratio as it is, like runBacktest", () => {
    // A gains 2,000,000 and B loses 100: a ratio of 20,000. It used to be
    // capped at 999.99, which also stood for a run with no loss at all.
    const result = run([100, 100, 100, 99.99, 99.99]);
    expect(result.portfolio.tradeCount).toBe(2);
    expect(result.portfolio.profitFactor).toBeCloseTo(20_000, 0);
  });

  it("reports Infinity when no trade lost", () => {
    const result = run([100, 100, 100, 110, 110]);
    expect(result.portfolio.tradeCount).toBe(2);
    expect(result.portfolio.profitFactor).toBe(Number.POSITIVE_INFINITY);
  });
});
