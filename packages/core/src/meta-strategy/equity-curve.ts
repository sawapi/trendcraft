/**
 * Equity Curve Trading
 *
 * Applies meta-strategy filters to backtest results by analyzing the equity curve.
 * When the strategy's equity curve is unhealthy (below MA, in drawdown, low win
 * rate), trades are skipped or reduced in size. The curve the filters read is
 * the strategy's own — every signal at full size, including the ones the
 * filter declines — so a pause ends when the strategy recovers. That curve is
 * reconstructed from `trades` (initial capital plus each trade's realized
 * return, one point per trade); the backtest's mark-to-market
 * `result.equityCurve` is not used.
 *
 * @packageDocumentation
 */

import { profitFactorFromReturns } from "../analysis/return-metrics";
import { depthPercent } from "../backtest/drawdown-tracker";
import {
  annualizedRatios,
  computeExtendedMetrics,
  ZERO_EXTENDED_METRICS,
} from "../backtest/engine-utils";
import type { BacktestResult, EquityPoint, Trade } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Equity curve filter type */
export type EquityCurveFilterType = "ma" | "drawdown" | "winRate" | "combined";

/** Options for equity curve filtering */
export type EquityCurveFilterOptions = {
  /** Filter type (default: 'ma') */
  type?: EquityCurveFilterType;
  /** MA period for equity curve in number of trades (default: 20) */
  maPeriod?: number;
  /** MA type (default: 'sma') */
  maType?: "sma" | "ema";
  /** Max drawdown threshold to pause trading, in percent (default: 15 = 15%) */
  maxDrawdown?: number;
  /** Rolling window for win rate calculation (default: 20 trades) */
  winRateWindow?: number;
  /** Minimum win rate to continue trading, in percent (default: 40 = 40%) */
  minWinRate?: number;
  /** Position size factor when filtered, as fraction (0 = skip trade, 0.5 = half size, default: 0) */
  filteredSizeFactor?: number;
};

/** Result of equity curve filter analysis */
export type EquityCurveAnalysis = {
  /** Original backtest result */
  original: BacktestResult;
  /** Filtered backtest result */
  filtered: BacktestResult;
  /** Number of trades skipped or reduced */
  tradesSkipped: number;
  /** Improvement metrics (filtered - original) */
  improvement: {
    returnPercent: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
  };
};

/** Equity curve health assessment */
export type EquityCurveHealthResult = {
  /** Whether equity is above its MA */
  aboveMa: boolean;
  /** Current drawdown from peak as percentage (0-100), matching BacktestResult.maxDrawdown */
  currentDrawdown: number;
  /** Rolling win rate as percentage (0-100), matching BacktestResult.winRate */
  rollingWinRate: number;
  /** Overall health score (0-100) */
  healthScore: number;
  /** Equity curve reconstructed from `trades` (one point per trade exit), not `result.equityCurve` */
  equityCurve: EquityPoint[];
  /** MA of equity curve */
  equityMa: (number | null)[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEquityCurve(trades: Trade[], initialCapital: number): number[] {
  const curve: number[] = [initialCapital];
  let equity = initialCapital;
  for (const trade of trades) {
    equity += trade.return;
    curve.push(equity);
  }
  return curve;
}

function computeSma(values: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sum += values[i];
  }
  return sum / period;
}

function computeEma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (ema === null) {
      // Seed with SMA
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      ema = sum / period;
      result.push(ema);
    } else {
      ema = values[i] * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

// All drawdown / win-rate helpers below report values as percent (0-100) to
// stay consistent with `BacktestResult.{maxDrawdown,winRate}` and with the
// public `EquityCurveFilterOptions.{maxDrawdown,minWinRate}` thresholds. A
// single scale across the equity-curve API keeps health readings, filter
// options, and rebuilt result fields directly comparable.

/** Current drawdown of a curve from its running peak, in percent (the curve always has its start). */
function getCurrentDrawdown(equityCurve: number[]): number {
  let peak = equityCurve[0];
  for (const e of equityCurve) {
    if (e > peak) peak = e;
  }
  return depthPercent(peak, equityCurve[equityCurve.length - 1]);
}

function getRollingWinRate(trades: Trade[], endIndex: number, window: number): number {
  const start = Math.max(0, endIndex - window + 1);
  const slice = trades.slice(start, endIndex + 1);
  if (slice.length === 0) return 100;
  const wins = slice.filter((t) => t.return > 0).length;
  return (wins / slice.length) * 100;
}

function rebuildResult(trades: Trade[], original: BacktestResult): BacktestResult {
  const initialCapital = original.initialCapital;
  // Preserve the backtest's time window — the filter removes trades
  // but doesn't change the underlying candle span, so CAGR / exposure
  // must be recomputed against the *same* (firstBarTime, lastBarTime).
  const span =
    original.lastBarTime > original.firstBarTime
      ? { firstTime: original.firstBarTime, lastTime: original.lastBarTime }
      : undefined;

  if (trades.length === 0) {
    return {
      ...original,
      finalCapital: initialCapital,
      totalReturn: 0,
      totalReturnPercent: 0,
      tradeCount: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      ...ZERO_EXTENDED_METRICS,
      profitFactor: 0,
      avgHoldingDays: 0,
      trades: [],
      drawdownPeriods: [],
    };
  }

  const totalReturn = trades.reduce((sum, t) => sum + t.return, 0);
  const finalCapital = initialCapital + totalReturn;
  const wins = trades.filter((t) => t.return > 0);

  // Max drawdown from equity curve
  const curve = buildEquityCurve(trades, initialCapital);
  let peak = curve[0];
  let maxDrawdownPercent = 0;
  for (const e of curve) {
    if (e > peak) peak = e;
    const dd = depthPercent(peak, e);
    if (dd > maxDrawdownPercent) maxDrawdownPercent = dd;
  }

  // Sharpe from the trade returns, annualised by the frequency those trades
  // actually occurred at — the shared owner the unfiltered backtest uses, so
  // `original` and `filtered` stay comparable cell-by-cell.
  const tradeReturns = trades.map((t) => t.returnPercent / 100);
  const { sharpeRatio: sharpe } = annualizedRatios(trades, tradeReturns, span);

  // Reuse the canonical metric helper so filter results match the
  // shape an unfiltered backtest produces — important for the panel
  // that diffs `original` vs `filtered` cell-by-cell.
  const extended = computeExtendedMetrics(
    trades,
    tradeReturns,
    initialCapital,
    finalCapital,
    maxDrawdownPercent,
    span,
  );

  return {
    initialCapital,
    finalCapital,
    totalReturn,
    totalReturnPercent: (totalReturn / initialCapital) * 100,
    tradeCount: trades.length,
    // winRate and maxDrawdown follow the BacktestResult contract: percentage
    // (0-100), not fraction (0-1). Aligning with runBacktest so callers can
    // compare both shapes directly (e.g. applyEquityCurveFilter.improvement).
    winRate: (wins.length / trades.length) * 100,
    maxDrawdown: maxDrawdownPercent,
    sharpeRatio: sharpe,
    ...extended,
    firstBarTime: original.firstBarTime,
    lastBarTime: original.lastBarTime,
    profitFactor: profitFactorFromReturns(trades.map((t) => t.return)),
    avgHoldingDays: trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length,
    trades,
    settings: original.settings,
    drawdownPeriods: [],
  };
}

function scaleTrade(trade: Trade, factor: number): Trade {
  return {
    ...trade,
    return: trade.return * factor,
    returnPercent: trade.returnPercent * factor,
  };
}

// ---------------------------------------------------------------------------
// Main functions
// ---------------------------------------------------------------------------

/**
 * Apply equity curve filter to a backtest result.
 *
 * Re-simulates the trade sequence, skipping or reducing trades when the
 * strategy's equity curve indicates poor health (below MA, excessive drawdown,
 * low win rate, or a combination). The health checks read the strategy's own
 * curve — every trade at full size, reconstructed from `result.trades` — not
 * the filtered one, so a pause ends as soon as the strategy recovers.
 *
 * @param result - Original backtest result
 * @param options - Filter options
 * @returns Analysis comparing original and filtered results
 *
 * @example
 * ```ts
 * import { runBacktest, applyEquityCurveFilter } from "trendcraft";
 *
 * const result = runBacktest(candles, entry, exit, { capital: 100000 });
 * const analysis = applyEquityCurveFilter(result, {
 *   type: 'ma',
 *   maPeriod: 10,
 *   filteredSizeFactor: 0,
 * });
 * console.log('Trades skipped:', analysis.tradesSkipped);
 * console.log('DD improvement:', analysis.improvement.maxDrawdown);
 * ```
 */
export function applyEquityCurveFilter(
  result: BacktestResult,
  options: EquityCurveFilterOptions = {},
): EquityCurveAnalysis {
  const {
    type = "ma",
    maPeriod = 20,
    maType = "sma",
    maxDrawdown = 15,
    winRateWindow = 20,
    minWinRate = 40,
    filteredSizeFactor = 0,
  } = options;

  const trades = result.trades;
  if (trades.length === 0) {
    const empty = rebuildResult([], result);
    return {
      original: result,
      filtered: empty,
      tradesSkipped: 0,
      improvement: { returnPercent: 0, maxDrawdown: 0, sharpeRatio: 0, profitFactor: 0 },
    };
  }

  // Every decision reads the strategy's own equity curve — each signal at
  // full size, including the ones the filter declines — never the filtered
  // curve. A filter that reads its own censored output closes on itself: in
  // skip mode the filtered curve stops moving the moment a trade is skipped,
  // so a drawdown pause could never end; an SMA pause ended only because the
  // window filled up with the frozen value, and an EMA pause — which only
  // decays toward that value — effectively never ended. The win-rate branch
  // always read the unfiltered trades; MA and drawdown now do the same.
  // systemCurve[i] is the equity after trades 0..i-1 — the state trade i is
  // decided on. The MA over it is causal, so ma[i] uses the same history.
  const systemCurve = buildEquityCurve(trades, result.initialCapital);
  const usesMa = type === "ma" || type === "combined";
  const ma: (number | null)[] = !usesMa
    ? []
    : maType === "ema"
      ? computeEma(systemCurve, maPeriod)
      : systemCurve.map((_, idx) => computeSma(systemCurve, maPeriod, idx));

  const filteredTrades: Trade[] = [];
  let skipped = 0;
  let peak = systemCurve[0];

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const equity = systemCurve[i];
    if (equity > peak) peak = equity;

    // Determine if trade passes filter
    let passes = true;

    if (usesMa) {
      const maValue = ma[i];
      if (maValue !== null && equity < maValue) {
        passes = false;
      }
    }

    if (type === "drawdown" || type === "combined") {
      if (depthPercent(peak, equity) > maxDrawdown) {
        passes = false;
      }
    }

    if (type === "winRate" || type === "combined") {
      if (i >= winRateWindow) {
        const wr = getRollingWinRate(trades, i - 1, winRateWindow);
        if (wr < minWinRate) {
          passes = false;
        }
      }
    }

    if (passes) {
      filteredTrades.push(trade);
    } else {
      skipped++;
      if (filteredSizeFactor > 0) filteredTrades.push(scaleTrade(trade, filteredSizeFactor));
    }
  }

  const filtered = rebuildResult(filteredTrades, result);

  return {
    original: result,
    filtered,
    tradesSkipped: skipped,
    improvement: {
      returnPercent: filtered.totalReturnPercent - result.totalReturnPercent,
      maxDrawdown: result.maxDrawdown - filtered.maxDrawdown,
      sharpeRatio: filtered.sharpeRatio - result.sharpeRatio,
      profitFactor: filtered.profitFactor - result.profitFactor,
    },
  };
}

/**
 * Assess the current health of a strategy's equity curve.
 *
 * Returns whether equity is above its MA, the current drawdown, rolling
 * win rate, and a composite health score (0-100).
 *
 * @param result - Backtest result to analyze
 * @param options - Assessment options
 * @returns Equity curve health assessment
 *
 * @example
 * ```ts
 * const health = equityCurveHealth(result, { maPeriod: 10 });
 * if (health.healthScore < 40) {
 *   console.log('Strategy is underperforming — consider pausing');
 * }
 * ```
 */
export function equityCurveHealth(
  result: BacktestResult,
  options: Pick<EquityCurveFilterOptions, "maPeriod" | "maType" | "winRateWindow"> = {},
): EquityCurveHealthResult {
  const { maPeriod = 20, maType = "sma", winRateWindow = 20 } = options;

  const trades = result.trades;
  const initialCapital = result.initialCapital;
  const curve = buildEquityCurve(trades, initialCapital);

  // Compute MA series
  let maValues: (number | null)[];
  if (maType === "ema") {
    maValues = computeEma(curve, maPeriod);
  } else {
    maValues = curve.map((_, idx) => computeSma(curve, maPeriod, idx));
  }

  const currentEquity = curve[curve.length - 1];
  const currentMa = maValues[maValues.length - 1];
  const aboveMa = currentMa !== null ? currentEquity >= currentMa : true;

  // Drawdown / win-rate helpers already report percent (0-100); coefficients
  // are scaled accordingly so the composite output stays numerically identical
  // to the pre-fix version.
  const currentDrawdown = getCurrentDrawdown(curve);

  const rollingWinRate =
    trades.length > 0 ? getRollingWinRate(trades, trades.length - 1, winRateWindow) : 100;

  const maScore = aboveMa ? 100 : 0;
  const ddScore = Math.max(0, 100 - currentDrawdown * 5); // 20% DD = 0
  const wrScore = Math.min(100, (rollingWinRate / 60) * 100); // 60% WR = 100
  const healthScore = Math.round(maScore * 0.4 + ddScore * 0.3 + wrScore * 0.3);

  const equityCurve: EquityPoint[] = [];
  // Use trade exit times for equity points
  equityCurve.push({ time: trades.length > 0 ? trades[0].entryTime : 0, equity: initialCapital });
  for (let i = 0; i < trades.length; i++) {
    equityCurve.push({ time: trades[i].exitTime, equity: curve[i + 1] });
  }

  return {
    aboveMa,
    currentDrawdown,
    rollingWinRate,
    healthScore,
    equityCurve,
    equityMa: maValues,
  };
}
