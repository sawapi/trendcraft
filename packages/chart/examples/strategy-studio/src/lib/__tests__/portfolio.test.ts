import type { StrategyJSON } from "trendcraft";
import { describe, expect, it } from "vitest";
import { defaultPortfolioInputs, runPortfolio, symbolEquityCurve } from "../portfolio";
import type { SampleSymbol, StudioCandle } from "../sample-data";

function makeCandles(n: number, basePrice = 100): StudioCandle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: 1700000000000 + i * 86400000,
    open: basePrice + i,
    high: basePrice + i + 2,
    low: basePrice + i - 2,
    close: basePrice + i + 1,
    volume: 1000,
  }));
}

const SYMBOLS: SampleSymbol[] = [
  { symbol: "A", label: "Symbol A", candles: makeCandles(40, 100) },
  { symbol: "B", label: "Symbol B", candles: makeCandles(40, 200) },
  { symbol: "C", label: "Symbol C", candles: makeCandles(40, 50) },
];

const ALWAYS_HOLD: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "always-hold",
  name: "Always Hold",
  entry: { name: "alwaysTrue" },
  exit: { name: "alwaysFalse" },
};

describe("runPortfolio", () => {
  it("returns empty when no strategy is supplied", () => {
    const out = runPortfolio(undefined, SYMBOLS, defaultPortfolioInputs(SYMBOLS));
    expect(out.kind).toBe("empty");
  });

  it("returns empty when symbol list is empty", () => {
    const out = runPortfolio(ALWAYS_HOLD, [], defaultPortfolioInputs([]));
    expect(out.kind).toBe("empty");
  });

  it("equal allocation splits capital evenly across symbols", () => {
    const inputs = defaultPortfolioInputs(SYMBOLS);
    inputs.capital = 30_000;
    const out = runPortfolio(ALWAYS_HOLD, SYMBOLS, inputs);
    if (out.kind !== "ok") throw new Error(`expected ok, got ${out.kind}: ${JSON.stringify(out)}`);
    expect(out.result.symbols).toHaveLength(3);
    for (const s of out.result.symbols) {
      expect(s.result.initialCapital).toBe(10_000);
    }
  });

  it("custom allocation honours per-symbol weights", () => {
    const inputs = defaultPortfolioInputs(SYMBOLS);
    inputs.capital = 100_000;
    inputs.allocation = "custom";
    inputs.customWeights = { A: 0.5, B: 0.3, C: 0.2 };
    const out = runPortfolio(ALWAYS_HOLD, SYMBOLS, inputs);
    if (out.kind !== "ok") throw new Error(`expected ok, got ${out.kind}: ${JSON.stringify(out)}`);
    const byId = new Map(out.result.symbols.map((s) => [s.symbol, s]));
    expect(byId.get("A")?.result.initialCapital).toBe(50_000);
    expect(byId.get("B")?.result.initialCapital).toBe(30_000);
    expect(byId.get("C")?.result.initialCapital).toBe(20_000);
  });

  it("portfolio total return aggregates per-symbol results", () => {
    const inputs = defaultPortfolioInputs(SYMBOLS);
    inputs.capital = 30_000;
    const out = runPortfolio(ALWAYS_HOLD, SYMBOLS, inputs);
    if (out.kind !== "ok") throw new Error("expected ok");
    const sumPerSymbol = out.result.symbols.reduce((s, sr) => s + sr.result.totalReturn, 0);
    expect(out.result.portfolio.totalReturn).toBeCloseTo(sumPerSymbol, 6);
  });

  it("propagates overrides (stops) into per-symbol backtests", () => {
    const inputs = defaultPortfolioInputs(SYMBOLS);
    const out = runPortfolio(ALWAYS_HOLD, SYMBOLS, inputs, { stopLoss: 1.5 });
    if (out.kind !== "ok") throw new Error("expected ok");
    for (const s of out.result.symbols) {
      expect(s.result.settings.stopLoss).toBe(1.5);
    }
  });

  it("respects per-symbol candle slice (regression for playhead alignment)", () => {
    // Each symbol is sliced before the panel calls runPortfolio, so passing
    // a shorter candle array should reduce the number of trades. The exact
    // count depends on goldenCross signals, but slicing to a tiny window
    // must not produce *more* trades than the full window.
    const fullInputs = defaultPortfolioInputs(SYMBOLS);
    const fullOut = runPortfolio(ALWAYS_HOLD, SYMBOLS, fullInputs);
    if (fullOut.kind !== "ok") throw new Error("expected ok");

    const shortSymbols = SYMBOLS.map((s) => ({ ...s, candles: s.candles.slice(0, 10) }));
    const shortOut = runPortfolio(ALWAYS_HOLD, shortSymbols, fullInputs);
    if (shortOut.kind !== "ok") throw new Error("expected ok");

    expect(shortOut.result.allTrades.length).toBeLessThanOrEqual(fullOut.result.allTrades.length);
  });

  it("portfolio capital input wins over strategy.backtest.capital and overrides", () => {
    // Regression for a panel bug where opts spread `backtestOptions`/`overrides`
    // *after* `capital`, silently overriding the panel's input. Both sources
    // carry a `capital` field via `buildStrategyJSON` and `overridesFromResult`.
    const strategyWithCapital: StrategyJSON = {
      ...ALWAYS_HOLD,
      backtest: { capital: 50_000 },
    };
    const inputs = defaultPortfolioInputs(SYMBOLS);
    inputs.capital = 99_000;
    const out = runPortfolio(strategyWithCapital, SYMBOLS, inputs, {
      capital: 1_000_000,
      stopLoss: 5,
    });
    if (out.kind !== "ok") throw new Error(`expected ok, got ${out.kind}`);
    // Equal allocation over 3 symbols → 99,000 / 3 = 33,000 each.
    for (const s of out.result.symbols) {
      expect(s.result.initialCapital).toBe(33_000);
    }
    // Overrides for non-capital fields still flow through.
    expect(out.result.symbols[0].result.settings.stopLoss).toBe(5);
  });
});

describe("symbolEquityCurve", () => {
  it("emits at least two points for no-trade symbols (sparkline visibility)", () => {
    // Sparkline renderer skips single-point series — for a symbol that took
    // no trades we still need a flat baseline so the row isn't a blank
    // canvas next to the metrics.
    const noTradeSymbol = {
      symbol: "Q",
      result: {
        initialCapital: 1000,
        finalCapital: 1000,
        totalReturn: 0,
        totalReturnPercent: 0,
        tradeCount: 0,
        winRate: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        profitFactor: 0,
        avgHoldingDays: 0,
        trades: [],
        settings: {
          fillMode: "next-bar-open" as const,
          slTpMode: "close-only" as const,
          slippage: 0,
          commission: 0,
          commissionRate: 0,
          taxRate: 0,
        },
        drawdownPeriods: [],
      },
    };
    const curve = symbolEquityCurve(noTradeSymbol);
    expect(curve).toEqual([1000, 1000]);
  });

  it("starts at the symbol's initialCapital and accumulates trade returns", () => {
    const inputs = defaultPortfolioInputs(SYMBOLS);
    inputs.capital = 30_000;
    const out = runPortfolio(ALWAYS_HOLD, SYMBOLS, inputs);
    if (out.kind !== "ok") throw new Error("expected ok");
    for (const s of out.result.symbols) {
      const curve = symbolEquityCurve(s);
      // Length = trade close events + 1 seed point. With alwaysHold there's
      // exactly one trade per symbol, force-closed at end of stream.
      expect(curve[0]).toBe(s.result.initialCapital);
      expect(curve.length).toBe(s.result.trades.length + 1);
      expect(curve[curve.length - 1]).toBeCloseTo(
        s.result.initialCapital + s.result.totalReturn,
        2,
      );
    }
  });
});
