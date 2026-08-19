/**
 * Portfolio / Multi-Asset Backtest
 *
 * Phase 1: batchBacktest() - Run independent per-symbol backtests and merge results
 * Phase 2: portfolioBacktest() - Weighted allocation with a per-symbol exposure
 *          cap. The allocation is fixed for the whole run; nothing rebalances.
 */

import { periodsPerYearFromSpan, sharpeFromReturns } from "../analysis/return-metrics";
import type { IndicatorCache } from "../core/indicator-cache";
import type {
  BatchBacktestOptions,
  BatchBacktestResult,
  Condition,
  EquityPoint,
  PortfolioBacktestOptions,
  PortfolioBacktestResult,
  PortfolioMetrics,
  SymbolBacktestResult,
  SymbolData,
  Trade,
} from "../types";
import type { ExtendedCondition } from "./conditions";
import type { MtfBacktestOptions } from "./engine";
import { runBacktest } from "./engine";

// ============================================
// Phase 1: Batch Backtest (Independent)
// ============================================

/**
 * Run independent backtests for multiple symbols and merge results into portfolio metrics.
 *
 * Each symbol runs its own backtest with its allocated capital.
 * Results are aggregated with a merged equity curve and portfolio-level statistics.
 *
 * @param datasets - Array of symbol data (symbol + candles)
 * @param entryCondition - Entry condition (shared across all symbols)
 * @param exitCondition - Exit condition (shared across all symbols)
 * @param options - Batch backtest options (capital, allocation, SL/TP, etc.)
 * @param cache - Optional shared indicator cache
 * @returns Batch backtest result with per-symbol and portfolio metrics
 *
 * @example
 * ```ts
 * import { batchBacktest, goldenCrossCondition, deadCrossCondition } from "trendcraft";
 *
 * const datasets = [
 *   { symbol: "AAPL", candles: aaplCandles },
 *   { symbol: "MSFT", candles: msftCandles },
 *   { symbol: "GOOG", candles: googCandles },
 * ];
 *
 * const result = batchBacktest(
 *   datasets,
 *   goldenCrossCondition(5, 25),
 *   deadCrossCondition(5, 25),
 *   { capital: 3_000_000, stopLoss: 5, takeProfit: 15 },
 * );
 *
 * console.log(`Portfolio Return: ${result.portfolio.totalReturnPercent}%`);
 * console.log(`Max Drawdown: ${result.portfolio.maxDrawdown}%`);
 * for (const s of result.symbols) {
 *   console.log(`  ${s.symbol}: ${s.result.totalReturnPercent}%`);
 * }
 * ```
 */
export function batchBacktest(
  datasets: SymbolData[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: BatchBacktestOptions | (BatchBacktestOptions & Omit<MtfBacktestOptions, "capital">),
  cache?: IndicatorCache,
): BatchBacktestResult {
  if (datasets.length === 0) {
    throw new Error("At least one symbol dataset is required");
  }
  assertUniqueSymbols(datasets);

  // Calculate per-symbol capital allocation
  const allocations = calculateAllocations(datasets, options);

  // Run independent backtests per symbol
  const symbolResults: SymbolBacktestResult[] = datasets.map((dataset) => {
    const symbolCapital = allocations[dataset.symbol];
    const backtestOptions = {
      ...options,
      capital: symbolCapital,
    };

    const result = runBacktest(
      dataset.candles,
      entryCondition,
      exitCondition,
      backtestOptions,
      cache,
    );

    return {
      symbol: dataset.symbol,
      result,
    };
  });

  // Merge all trades with symbol tags
  const allTrades = mergeAndSortTrades(symbolResults);

  // Build merged equity curve
  const equityCurve = buildMergedEquityCurve(symbolResults, datasets, allocations);

  // Calculate portfolio metrics
  const portfolio = calculatePortfolioMetrics(symbolResults, equityCurve, options.capital);

  return {
    symbols: symbolResults,
    portfolio,
    equityCurve,
    allTrades,
  };
}

// ============================================
// Phase 2: Portfolio Backtest (Shared Capital)
// ============================================

/**
 * Run a portfolio backtest with weight-based capital allocation and exposure constraints.
 *
 * Unlike `batchBacktest()`, this applies portfolio-level allocation and exposure
 * constraints. Allocation is static: total capital is split across symbols by the
 * weights from the `allocation` strategy, and `maxSymbolExposure` caps each
 * symbol's share of total capital. Capital the cap keeps out of the market is
 * held as portfolio cash and stays in the equity curve and in `finalCapital`.
 * Symbols are currently backtested independently against their allocated
 * capital (no shared capital pool or signal competition yet).
 *
 * Three options are accepted but not yet enforced: `maxPositions` (concurrent
 * positions are reported via `peakConcurrentPositions` instead),
 * `maxPortfolioDrawdown` (the run always goes to completion), and `rebalance`
 * (allocation never changes, so `rebalanceCount` is always 0).
 *
 * @param datasets - Array of symbol data
 * @param entryCondition - Entry condition
 * @param exitCondition - Exit condition
 * @param options - Portfolio backtest options
 * @returns Portfolio backtest result
 *
 * @example
 * ```ts
 * import { portfolioBacktest, goldenCrossCondition, deadCrossCondition } from "trendcraft";
 *
 * const result = portfolioBacktest(
 *   datasets,
 *   goldenCrossCondition(5, 25),
 *   deadCrossCondition(5, 25),
 *   {
 *     capital: 3_000_000,
 *     allocation: { type: "equal" },
 *     maxPositions: 5, // accepted but not yet enforced
 *     maxSymbolExposure: 25,
 *     tradeOptions: { stopLoss: 5, takeProfit: 15 },
 *   },
 * );
 *
 * console.log(`Return: ${result.portfolio.totalReturnPercent}%`);
 * console.log(`Peak Positions: ${result.peakConcurrentPositions}`);
 * ```
 */
export function portfolioBacktest(
  datasets: SymbolData[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: PortfolioBacktestOptions,
): PortfolioBacktestResult {
  if (datasets.length === 0) {
    throw new Error("At least one symbol dataset is required");
  }
  assertUniqueSymbols(datasets);

  // `maxPositions`, `maxPortfolioDrawdown` and `rebalance` are documented on
  // the option type but not yet wired through the backtest loop, so they are
  // deliberately not read here — see the option type's JSDoc for what each one
  // will do once it lands.
  const { capital, allocation, maxSymbolExposure = 100, tradeOptions = {} } = options;

  // Calculate target weights
  const weights = calculateWeights(datasets, allocation);

  // Allocate capital per symbol based on weights
  const symbolCapitals: Record<string, number> = {};
  for (const d of datasets) {
    symbolCapitals[d.symbol] = capital * weights[d.symbol];
  }

  // Run independent backtests per symbol with allocated capital
  // (Phase 2 simplified: independent runs with weight-based allocation + position limits)
  const symbolResults: SymbolBacktestResult[] = [];
  let peakConcurrentPositions = 0;

  // Capital each symbol is actually started with, after the exposure cap. It
  // is what the merged equity curve must fill in before a symbol's first bar,
  // and what the undeployed remainder is measured against.
  const effectiveCapitals: Record<string, number> = {};

  for (const dataset of datasets) {
    const symbolCap = symbolCapitals[dataset.symbol];

    // Enforce max symbol exposure
    const maxExposureCapital = (capital * maxSymbolExposure) / 100;
    const effectiveCapital = Math.min(symbolCap, maxExposureCapital);
    effectiveCapitals[dataset.symbol] = effectiveCapital;

    const result = runBacktest(dataset.candles, entryCondition, exitCondition, {
      ...tradeOptions,
      capital: effectiveCapital,
    });

    symbolResults.push({ symbol: dataset.symbol, result });
  }

  // Whatever `maxSymbolExposure` kept out of the market stays on the books as
  // portfolio cash. Dropping it would report a portfolio that placed no trades
  // at all as having lost exactly the capital the cap withheld.
  const deployed = Object.values(effectiveCapitals).reduce((s, c) => s + c, 0);
  const idleCash = capital - deployed;

  // Track concurrent positions from all trades
  const allTradesWithSymbol = mergeAndSortTrades(symbolResults);
  const positionEvents: { time: number; delta: number }[] = [];
  for (const trade of allTradesWithSymbol) {
    positionEvents.push({ time: trade.entryTime, delta: 1 });
    positionEvents.push({ time: trade.exitTime, delta: -1 });
  }
  positionEvents.sort((a, b) => a.time - b.time || a.delta - b.delta);

  let concurrent = 0;
  for (const ev of positionEvents) {
    concurrent += ev.delta;
    if (concurrent > peakConcurrentPositions) {
      peakConcurrentPositions = concurrent;
    }
  }

  // Build equity curve and portfolio metrics
  const equityCurve = buildMergedEquityCurve(symbolResults, datasets, effectiveCapitals, idleCash);

  const portfolio = calculatePortfolioMetrics(symbolResults, equityCurve, capital, idleCash);

  return {
    symbols: symbolResults,
    portfolio,
    equityCurve,
    allTrades: allTradesWithSymbol,
    // Allocation is fixed for the whole run, so no rebalance ever happens.
    // Reporting a calendar estimate here claimed events that never took place.
    rebalanceCount: 0,
    peakConcurrentPositions,
  };
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Reject a dataset list that names the same symbol twice.
 *
 * Capital, allocation weights and the merged equity curve are all keyed by
 * symbol, so a repeated name silently collapses several datasets into one on
 * those paths while every sleeve still runs and still counts toward the
 * result — capital stops being conserved. Two datasets for one instrument have
 * no defined meaning here anyway, so this is a caller error, not a mode to
 * support.
 */
function assertUniqueSymbols(datasets: SymbolData[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const dataset of datasets) {
    if (seen.has(dataset.symbol)) duplicates.add(dataset.symbol);
    seen.add(dataset.symbol);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `Duplicate symbol(s) in datasets: ${[...duplicates].sort().join(", ")}. ` +
        "Each symbol must appear at most once — capital allocation and the merged " +
        "equity curve are keyed by symbol.",
    );
  }
}

/**
 * Calculate per-symbol capital allocations
 */
function calculateAllocations(
  datasets: SymbolData[],
  options: BatchBacktestOptions,
): Record<string, number> {
  const allocations: Record<string, number> = {};

  if (options.allocation === "custom" && options.allocations) {
    // Validate weights sum to ~1.0
    const totalWeight = Object.values(options.allocations).reduce((s, w) => s + w, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`Allocation weights must sum to 1.0 (got ${totalWeight.toFixed(4)})`);
    }

    for (const dataset of datasets) {
      const weight = options.allocations[dataset.symbol];
      if (weight === undefined) {
        throw new Error(`Missing allocation weight for symbol "${dataset.symbol}"`);
      }
      allocations[dataset.symbol] = options.capital * weight;
    }
  } else {
    // Equal allocation
    const perSymbol = options.capital / datasets.length;
    for (const dataset of datasets) {
      allocations[dataset.symbol] = perSymbol;
    }
  }

  return allocations;
}

/**
 * Calculate target weights from allocation strategy
 */
function calculateWeights(
  datasets: SymbolData[],
  allocation: PortfolioBacktestOptions["allocation"],
): Record<string, number> {
  const weights: Record<string, number> = {};

  switch (allocation.type) {
    case "equal": {
      const w = 1 / datasets.length;
      for (const d of datasets) weights[d.symbol] = w;
      break;
    }
    case "fixed": {
      const totalWeight = Object.values(allocation.weights).reduce((s, w) => s + w, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error(`Fixed weights must sum to 1.0 (got ${totalWeight.toFixed(4)})`);
      }
      for (const d of datasets) {
        const w = allocation.weights[d.symbol];
        if (w === undefined) {
          throw new Error(`Missing weight for symbol "${d.symbol}"`);
        }
        weights[d.symbol] = w;
      }
      break;
    }
    case "riskParity": {
      // Simplified risk parity: use equal weights as baseline
      // (Full risk parity requires covariance matrix which is out of scope)
      const w = 1 / datasets.length;
      for (const d of datasets) weights[d.symbol] = w;
      break;
    }
    default:
      throw new Error("Unknown allocation type");
  }

  return weights;
}

/**
 * Merge trades from all symbols, tagged with symbol name, sorted by entry time
 */
function mergeAndSortTrades(symbolResults: SymbolBacktestResult[]): (Trade & { symbol: string })[] {
  const allTrades: (Trade & { symbol: string })[] = [];
  for (const sr of symbolResults) {
    for (const trade of sr.result.trades) {
      allTrades.push({ ...trade, symbol: sr.symbol });
    }
  }
  allTrades.sort((a, b) => a.entryTime - b.entryTime);
  return allTrades;
}

/**
 * Merge the per-symbol equity curves into one portfolio curve.
 *
 * Each symbol's backtest emits mark-to-market equity at every candle close, so
 * merging those — rather than stepping the portfolio only when a trade closes —
 * is what makes the curve reflect what the portfolio was actually worth on any
 * given bar. A realized-P&L step curve hides every price move made while a
 * position is open: a strategy that buys near the start and sells at the end
 * produces one step regardless of how violent the ride was, which leaves
 * nothing for a risk metric to measure.
 *
 * Symbols need not share a calendar. The curve carries every timestamp any
 * dataset has, and a symbol that has no bar at that timestamp holds its last
 * known equity (the capital it was started with, before its first bar).
 *
 * `allocations` must be the capital each symbol was actually started with, not
 * the target weights: those two differ once `maxSymbolExposure` binds, and a
 * filler larger than the sleeve's real starting capital shows up as a step
 * down on the symbol's first bar that no trade caused.
 *
 * `idleCash` is portfolio capital that was never deployed to any symbol. It
 * sits at every point of the curve, so a constraint that leaves cash on the
 * sidelines dilutes the portfolio's return rather than vanishing from it.
 */
function buildMergedEquityCurve(
  symbolResults: SymbolBacktestResult[],
  datasets: SymbolData[],
  allocations: Record<string, number>,
  idleCash = 0,
): EquityPoint[] {
  const curveBySymbol = new Map<string, { times: number[]; equity: number[] }>();
  for (const dataset of datasets) {
    const result = symbolResults.find((sr) => sr.symbol === dataset.symbol)?.result;
    const times = dataset.candles.map((c) => c.time);
    const equity = result?.equityCurve;
    if (equity && equity.length === times.length) {
      curveBySymbol.set(dataset.symbol, { times, equity });
      continue;
    }
    // No per-bar curve (a hand-built result): fall back to stepping the
    // symbol's equity at each trade exit, which is all the information there is.
    const stepTimes: number[] = [];
    const stepEquity: number[] = [];
    let running = allocations[dataset.symbol] ?? 0;
    for (const trade of result?.trades ?? []) {
      running += trade.return;
      stepTimes.push(trade.exitTime);
      stepEquity.push(running);
    }
    curveBySymbol.set(dataset.symbol, { times: stepTimes, equity: stepEquity });
  }

  const allTimes = [...new Set(datasets.flatMap((d) => d.candles.map((c) => c.time)))].sort(
    (a, b) => a - b,
  );
  if (allTimes.length === 0) return [];

  // One cursor per symbol, advanced in step with the merged timeline.
  const cursors = new Map<string, number>();
  for (const symbol of curveBySymbol.keys()) cursors.set(symbol, -1);

  const curve: EquityPoint[] = [];
  for (const time of allTimes) {
    let total = idleCash;
    for (const [symbol, series] of curveBySymbol) {
      let cursor = cursors.get(symbol) as number;
      while (cursor + 1 < series.times.length && series.times[cursor + 1] <= time) cursor++;
      cursors.set(symbol, cursor);
      total += cursor < 0 ? (allocations[symbol] ?? 0) : series.equity[cursor];
    }
    curve.push({ time, equity: Math.round(total * 100) / 100 });
  }

  return curve;
}

/**
 * Calculate aggregated portfolio metrics from per-symbol results and merged equity curve
 */
function calculatePortfolioMetrics(
  symbolResults: SymbolBacktestResult[],
  equityCurve: EquityPoint[],
  totalCapital: number,
  idleCash = 0,
): PortfolioMetrics {
  // Sum up per-symbol finals, plus whatever capital was never deployed. Both
  // sides of the return have to stand on the same capital: `totalCapital` is
  // the whole portfolio, so the cash a constraint held back belongs here too.
  const finalCapital = symbolResults.reduce((s, sr) => s + sr.result.finalCapital, 0) + idleCash;
  const totalReturn = finalCapital - totalCapital;
  const totalReturnPercent = (totalReturn / totalCapital) * 100;

  // Aggregate trades
  const allTrades: Trade[] = [];
  for (const sr of symbolResults) {
    allTrades.push(...sr.result.trades);
  }

  const tradeCount = allTrades.length;
  const winningTrades = allTrades.filter((t) => t.return > 0);
  const losingTrades = allTrades.filter((t) => t.return <= 0);
  const winRate = tradeCount > 0 ? (winningTrades.length / tradeCount) * 100 : 0;

  const totalProfit = winningTrades.reduce((s, t) => s + t.return, 0);
  const totalLoss = Math.abs(losingTrades.reduce((s, t) => s + t.return, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999.99 : 0;

  const avgHoldingDays =
    tradeCount > 0 ? allTrades.reduce((s, t) => s + t.holdingDays, 0) / tradeCount : 0;

  // Calculate max drawdown from equity curve
  let peakEquity = totalCapital;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.equity > peakEquity) peakEquity = point.equity;
    const dd = ((peakEquity - point.equity) / peakEquity) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Portfolio Sharpe from the merged mark-to-market equity curve. Pooling
  // per-trade returns across symbols measured cross-sectional trade dispersion
  // rather than portfolio risk, and — being unanchored in time — reported the
  // same number whether those trades spanned three months or eight years.
  const portfolioReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    portfolioReturns.push(prev !== 0 ? (equityCurve[i].equity - prev) / prev : 0);
  }
  const periodsPerYear = periodsPerYearFromSpan(
    portfolioReturns.length,
    equityCurve[0]?.time,
    equityCurve[equityCurve.length - 1]?.time,
  );
  const sharpe = sharpeFromReturns(portfolioReturns, { periodsPerYear });
  const sharpeRatio = Number.isFinite(sharpe) ? sharpe : 0;

  return {
    initialCapital: totalCapital,
    finalCapital: Math.round(finalCapital * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
    tradeCount,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    profitFactor: Math.round(Math.min(profitFactor, 999.99) * 100) / 100,
    avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
  };
}
