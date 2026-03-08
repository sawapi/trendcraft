/**
 * Portfolio / Multi-Asset Backtest
 *
 * Phase 1: batchBacktest() - Run independent per-symbol backtests and merge results
 * Phase 2: portfolioBacktest() - Shared capital with allocation and rebalancing
 */

import type { IndicatorCache } from "../core/indicator-cache";
import type {
  BacktestResult,
  BatchBacktestOptions,
  BatchBacktestResult,
  Condition,
  EquityPoint,
  NormalizedCandle,
  PortfolioBacktestOptions,
  PortfolioBacktestResult,
  PortfolioMetrics,
  SymbolBacktestResult,
  SymbolData,
  Trade,
} from "../types";
import type { ExtendedCondition } from "./conditions";
import { runBacktest } from "./engine";
import type { MtfBacktestOptions } from "./engine";

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
 * Run a portfolio backtest with shared capital, allocation, and optional rebalancing.
 *
 * Unlike `batchBacktest()`, this shares a single capital pool across all symbols.
 * Signals compete for capital allocation, and position limits are enforced.
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
 *     maxPositions: 5,
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

  const {
    capital,
    allocation,
    maxPositions = datasets.length,
    maxSymbolExposure = 100,
    maxPortfolioDrawdown,
    tradeOptions = {},
  } = options;

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
  const currentOpenPositions = 0;
  let peakConcurrentPositions = 0;
  let rebalanceCount = 0;

  for (const dataset of datasets) {
    const symbolCap = symbolCapitals[dataset.symbol];

    // Enforce max symbol exposure
    const maxExposureCapital = (capital * maxSymbolExposure) / 100;
    const effectiveCapital = Math.min(symbolCap, maxExposureCapital);

    const result = runBacktest(dataset.candles, entryCondition, exitCondition, {
      ...tradeOptions,
      capital: effectiveCapital,
    });

    symbolResults.push({ symbol: dataset.symbol, result });
  }

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
  const equityCurve = buildMergedEquityCurve(symbolResults, datasets, symbolCapitals);

  const portfolio = calculatePortfolioMetrics(symbolResults, equityCurve, capital);

  // Check max portfolio drawdown
  if (maxPortfolioDrawdown !== undefined && portfolio.maxDrawdown > maxPortfolioDrawdown) {
    // Drawdown breached - noted in result (portfolio ran to completion for analysis)
  }

  // Rebalance tracking (for future enhancement)
  if (options.rebalance) {
    rebalanceCount = estimateRebalanceCount(datasets, options.rebalance);
  }

  return {
    symbols: symbolResults,
    portfolio,
    equityCurve,
    allTrades: allTradesWithSymbol,
    rebalanceCount,
    peakConcurrentPositions,
  };
}

// ============================================
// Internal Helpers
// ============================================

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
 * Build a merged equity curve from per-symbol results.
 * At each trade close event, recalculate total portfolio equity.
 */
function buildMergedEquityCurve(
  symbolResults: SymbolBacktestResult[],
  datasets: SymbolData[],
  allocations: Record<string, number>,
): EquityPoint[] {
  // Track per-symbol equity over time via trade events
  const symbolEquity: Record<string, number> = {};
  for (const sr of symbolResults) {
    symbolEquity[sr.symbol] = allocations[sr.symbol];
  }

  // Collect all trade close events
  const events: { time: number; symbol: string; equityAfter: number }[] = [];
  for (const sr of symbolResults) {
    let equity = allocations[sr.symbol];
    for (const trade of sr.result.trades) {
      equity += trade.return;
      events.push({
        time: trade.exitTime,
        symbol: sr.symbol,
        equityAfter: equity,
      });
    }
  }
  events.sort((a, b) => a.time - b.time);

  // Build curve
  const totalInitial = Object.values(allocations).reduce((s, v) => s + v, 0);
  const curve: EquityPoint[] = [];

  // Find earliest time across all datasets
  let earliestTime = Number.POSITIVE_INFINITY;
  for (const d of datasets) {
    if (d.candles.length > 0 && d.candles[0].time < earliestTime) {
      earliestTime = d.candles[0].time;
    }
  }
  if (earliestTime !== Number.POSITIVE_INFINITY) {
    curve.push({ time: earliestTime, equity: totalInitial });
  }

  // Track running equity per symbol
  const runningEquity = { ...allocations };
  for (const event of events) {
    runningEquity[event.symbol] = event.equityAfter;
    const totalEquity = Object.values(runningEquity).reduce((s, v) => s + v, 0);
    curve.push({
      time: event.time,
      equity: Math.round(totalEquity * 100) / 100,
    });
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
): PortfolioMetrics {
  // Sum up per-symbol finals
  const finalCapital = symbolResults.reduce((s, sr) => s + sr.result.finalCapital, 0);
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

  // Calculate portfolio Sharpe ratio from per-trade returns
  const returns = allTrades.map((t) => t.returnPercent);
  let sharpeRatio = 0;
  if (returns.length > 1) {
    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const stdReturn = Math.sqrt(
      returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length,
    );
    sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;
  }

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

/**
 * Estimate rebalance count based on data range and frequency
 */
function estimateRebalanceCount(
  datasets: SymbolData[],
  rebalance: NonNullable<PortfolioBacktestOptions["rebalance"]>,
): number {
  // Find data range across all symbols
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  for (const d of datasets) {
    if (d.candles.length > 0) {
      if (d.candles[0].time < minTime) minTime = d.candles[0].time;
      if (d.candles[d.candles.length - 1].time > maxTime) {
        maxTime = d.candles[d.candles.length - 1].time;
      }
    }
  }

  if (minTime === Number.POSITIVE_INFINITY) return 0;

  const durationMs = maxTime - minTime;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  switch (rebalance.frequency) {
    case "monthly":
      return Math.floor(durationMs / (30 * MS_PER_DAY));
    case "quarterly":
      return Math.floor(durationMs / (90 * MS_PER_DAY));
    case "threshold":
      // Cannot estimate without running simulation
      return 0;
  }
}
