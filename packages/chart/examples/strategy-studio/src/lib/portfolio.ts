import {
  type BatchBacktestOptions,
  type BatchBacktestResult,
  backtestRegistry,
  batchBacktest,
  loadStrategy,
  normalizeCandles,
  type StrategyJSON,
  type SymbolBacktestResult,
  type SymbolData,
} from "trendcraft";
import type { SampleSymbol } from "./sample-data";

export type AllocationMode = "equal" | "custom";

export type PortfolioInputs = {
  capital: number;
  allocation: AllocationMode;
  /** Per-symbol weight in [0, 1] when `allocation` is "custom". Sums to 1.0. */
  customWeights: Record<string, number>;
};

export function defaultPortfolioInputs(symbols: ReadonlyArray<SampleSymbol>): PortfolioInputs {
  const n = symbols.length || 1;
  const weight = 1 / n;
  const customWeights: Record<string, number> = {};
  for (const s of symbols) customWeights[s.symbol] = weight;
  return {
    capital: 300_000,
    allocation: "equal",
    customWeights,
  };
}

export type PortfolioComputation =
  | { kind: "ok"; result: BatchBacktestResult }
  | { kind: "empty" }
  | { kind: "error"; message: string };

/**
 * Run `batchBacktest` against a set of symbol datasets. Returns `kind: "empty"`
 * when there's no strategy to apply yet (user hasn't run anything and no
 * fallback was provided). All symbol candles are normalised once up front.
 *
 * `overrides` carries the user's actual backtest assumptions (stops, fill
 * mode, commission, etc.) extracted from a previous result via
 * `overridesFromResult` — same pattern as MetaStrategyPanel so the rotation
 * comparison is apples-to-apples with the user's solo backtest.
 */
export function runPortfolio(
  strategy: StrategyJSON | undefined,
  symbols: ReadonlyArray<SampleSymbol>,
  inputs: PortfolioInputs,
  overrides: Partial<BatchBacktestOptions> = {},
): PortfolioComputation {
  if (!strategy) return { kind: "empty" };
  if (symbols.length === 0) return { kind: "empty" };
  try {
    const { entry, exit, backtestOptions } = loadStrategy(strategy, backtestRegistry);
    const datasets: SymbolData[] = symbols.map((s) => ({
      symbol: s.symbol,
      candles: normalizeCandles(s.candles),
    }));
    // Order matters: spread strategy/builder defaults and solo-backtest
    // overrides first, then re-assert `capital` so the panel's input wins.
    // Both `buildStrategyJSON` and `overridesFromResult` carry a `capital`
    // field, and without this re-assertion the panel's "Capital total $"
    // control would be silently ignored.
    const opts: BatchBacktestOptions = {
      ...backtestOptions,
      ...overrides,
      capital: inputs.capital,
      allocation: inputs.allocation,
      ...(inputs.allocation === "custom" ? { allocations: inputs.customWeights } : {}),
    };
    const result = batchBacktest(datasets, entry, exit, opts);
    return { kind: "ok", result };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Build a per-symbol equity curve as a `number[]` (cumulative equity) for
 * the sparkline. `batchBacktest` only returns trade-close events; we seed
 * with `initialCapital` and, for symbols that took no trades, emit a
 * second flat point so the sparkline renderer (which skips single-point
 * series) still draws a visible baseline.
 */
export function symbolEquityCurve(symbol: SymbolBacktestResult): number[] {
  const initial = symbol.result.initialCapital;
  const out: number[] = [initial];
  let equity = initial;
  for (const trade of symbol.result.trades) {
    equity += trade.return;
    out.push(equity);
  }
  if (out.length === 1) out.push(initial);
  return out;
}
