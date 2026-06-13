/**
 * Tearsheet report — a single aggregated view of a backtest's performance,
 * combining the engine's headline statistics with the return-distribution,
 * rolling and drawdown metrics that a quant tearsheet is expected to carry.
 *
 * The distribution and rolling metrics are computed from the daily equity
 * returns reconstructed by `calculateDailyReturns` (mark-to-market on close),
 * so they are a daily-resolution approximation, while the headline ratios and
 * the drawdown table come straight from the engine result.
 */

import { calculateDailyReturns } from "../optimization/metrics";
import type { BacktestResult, NormalizedCandle } from "../types";
import { analyzeDrawdowns, type DrawdownSummary } from "./drawdown-analysis";
import {
  captureRatios,
  gainToPainRatio,
  omegaRatio,
  payoffRatioFromReturns,
  profitFactorFromReturns,
  rollingSharpe,
  rollingVolatility,
  sampleStd,
  tailRatio,
  winRateFromReturns,
} from "./return-metrics";

/** Daily-resolution series bundled with a tearsheet report. */
export type TearsheetSeries = {
  /** Daily equity returns as fractions (length = candles.length - 1). */
  returns: number[];
  /** Reconstructed equity curve, starting at `initialCapital`. */
  equity: number[];
  /** Underwater curve: percent drawdown from the running peak (≤ 0). */
  underwaterPercent: number[];
  /** Rolling annualised Sharpe (leading `window - 1` entries are NaN). */
  rollingSharpe: number[];
  /** Rolling annualised volatility in percent (leading entries NaN). */
  rollingVolatilityPercent: number[];
};

/** Aggregated tearsheet metrics for a backtest result. */
export type TearsheetReport = {
  // Headline — straight from the engine result
  initialCapital: number;
  finalCapital: number;
  totalReturnPercent: number;
  cagrPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdownPercent: number;
  /** Trade-based profit factor (winning trade P&L / losing trade P&L). */
  profitFactor: number;
  winRatePercent: number;
  tradeCount: number;

  // Return-distribution metrics — from the daily returns
  annualizedVolatilityPercent: number;
  omega: number;
  tailRatio: number;
  gainToPainRatio: number;
  /** Returns-based profit factor × tail ratio. */
  commonSenseRatio: number;
  /** Returns-based profit factor × win rate × payoff ratio. */
  cpcIndex: number;
  /** Ulcer Index: RMS of the percent underwater curve (Martin, /N). */
  ulcerIndex: number;
  /**
   * Ulcer Performance Index: (CAGR − risk-free) / Ulcer Index, using the
   * engine's calendar-based CAGR. This differs from the standalone
   * `ulcerPerformanceIndex(equityCurve)` in `risk/`, whose numerator is a
   * bar-count annualisation of the equity endpoints.
   */
  ulcerPerformanceIndex: number;

  /** Up/down capture vs the supplied benchmark, or `null` when none given. */
  capture: { up: number; down: number; ratio: number } | null;

  /** Drawdown summary derived from the engine's drawdown periods. */
  drawdowns: DrawdownSummary;

  series: TearsheetSeries;
};

/** Options for {@link report}. */
export type ReportOptions = {
  /** Candles the backtest ran on (required to reconstruct the equity curve). */
  candles: NormalizedCandle[];
  /** Starting capital (default: `result.initialCapital`). */
  initialCapital?: number;
  /** Annual risk-free rate as a fraction (default 0). */
  riskFree?: number;
  /** Periods per year for annualisation (default 252). */
  periodsPerYear?: number;
  /** Rolling-window length in periods (default 126). */
  rollingWindow?: number;
  /** Annualised minimum acceptable return for Omega (default 0). */
  requiredReturn?: number;
  /**
   * Benchmark daily returns aligned to the strategy's daily returns
   * (length `candles.length - 1`). Enables the capture ratios.
   */
  benchmarkReturns?: number[];
};

/**
 * Build a comprehensive tearsheet report from a backtest result.
 *
 * @param result - The backtest result to analyse
 * @param options - Reconstruction and metric options (candles required)
 * @returns Aggregated headline, distribution, capture and drawdown metrics
 *   plus the daily equity/underwater/rolling series
 *
 * @example
 * ```ts
 * import { runBacktest, report } from "trendcraft";
 *
 * const result = runBacktest(candles, entry, exit, { capital: 100_000 });
 * const sheet = report(result, { candles });
 * console.log(sheet.omega, sheet.tailRatio, sheet.ulcerPerformanceIndex);
 * ```
 */
export function report(result: BacktestResult, options: ReportOptions): TearsheetReport {
  const {
    candles,
    initialCapital = result.initialCapital,
    riskFree = 0,
    periodsPerYear = 252,
    rollingWindow = 126,
    requiredReturn = 0,
    benchmarkReturns,
  } = options;

  const rawReturns = calculateDailyReturns(result, candles, initialCapital);
  // A valid backtest with no trades produces no daily returns; keep the series
  // candle-aligned (flat at initial capital) so the documented length holds
  // and a candle-length benchmark still lines up for the capture ratios.
  const returns =
    rawReturns.length === 0 && candles.length >= 2
      ? new Array<number>(candles.length - 1).fill(0)
      : rawReturns;

  // Reconstruct the equity curve and underwater curve from the daily returns.
  const equity: number[] = new Array(returns.length + 1);
  equity[0] = initialCapital;
  for (let i = 0; i < returns.length; i++) equity[i + 1] = equity[i] * (1 + returns[i]);

  const underwaterPercent: number[] = new Array(equity.length);
  let peak = equity[0];
  let sumSqDd = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) peak = equity[i];
    const dd = peak > 0 ? ((equity[i] - peak) / peak) * 100 : 0;
    underwaterPercent[i] = dd;
    sumSqDd += dd * dd;
  }

  // Ulcer Index (Martin): RMS of the percent underwater curve over all points.
  const ulcerIndex = equity.length > 0 ? Math.sqrt(sumSqDd / equity.length) : 0;
  const ulcerPerformanceIndex =
    ulcerIndex > 0 ? (result.cagrPercent - riskFree * 100) / ulcerIndex : Number.NaN;

  const annualizedVolatilityPercent = sampleStd(returns) * Math.sqrt(periodsPerYear) * 100;

  // Compute the shared building blocks once; the common-sense and CPC ratios
  // are exactly these factors combined (see return-metrics.ts), so deriving
  // them here avoids re-walking and re-sorting the returns inside the
  // composite helpers.
  const profitFactor = profitFactorFromReturns(returns);
  const tail = tailRatio(returns);
  const winRate = winRateFromReturns(returns);
  const payoff = payoffRatioFromReturns(returns);

  const capture =
    benchmarkReturns !== undefined
      ? captureRatios(returns, benchmarkReturns, periodsPerYear)
      : null;

  return {
    initialCapital,
    finalCapital: result.finalCapital,
    totalReturnPercent: result.totalReturnPercent,
    cagrPercent: result.cagrPercent,
    sharpeRatio: result.sharpeRatio,
    sortinoRatio: result.sortinoRatio,
    calmarRatio: result.calmarRatio,
    maxDrawdownPercent: result.maxDrawdown,
    profitFactor: result.profitFactor,
    winRatePercent: result.winRate,
    tradeCount: result.tradeCount,

    annualizedVolatilityPercent,
    omega: omegaRatio(returns, { riskFree, requiredReturn, periodsPerYear }),
    tailRatio: tail,
    gainToPainRatio: gainToPainRatio(returns),
    commonSenseRatio: profitFactor * tail,
    cpcIndex: profitFactor * winRate * payoff,
    ulcerIndex,
    ulcerPerformanceIndex,

    capture,

    drawdowns: analyzeDrawdowns(result.drawdownPeriods),

    series: {
      returns,
      equity,
      underwaterPercent,
      rollingSharpe: rollingSharpe(returns, {
        window: rollingWindow,
        riskFree,
        periodsPerYear,
      }),
      rollingVolatilityPercent: rollingVolatility(returns, {
        window: rollingWindow,
        periodsPerYear,
      }).map((v) => v * 100),
    },
  };
}
