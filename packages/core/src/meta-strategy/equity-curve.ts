/**
 * Equity Curve Trading
 *
 * Applies meta-strategy filters to backtest results by analyzing the equity curve.
 * When the equity curve is unhealthy (below MA, in drawdown, low win rate),
 * trades are skipped or reduced in size.
 *
 * @packageDocumentation
 */

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
  /** Max drawdown threshold to pause trading (default: 0.15 = 15%) */
  maxDrawdown?: number;
  /** Rolling window for win rate calculation (default: 20 trades) */
  winRateWindow?: number;
  /** Minimum win rate to continue trading (default: 0.4) */
  minWinRate?: number;
  /** Position size factor when filtered (0 = skip trade, 0.5 = half size) (default: 0) */
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
  /** Current drawdown from peak (0-1) */
  currentDrawdown: number;
  /** Rolling win rate (last N trades) */
  rollingWinRate: number;
  /** Overall health score (0-100) */
  healthScore: number;
  /** Equity curve series */
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

function getCurrentDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;
  let peak = equityCurve[0];
  for (const e of equityCurve) {
    if (e > peak) peak = e;
  }
  const current = equityCurve[equityCurve.length - 1];
  return peak > 0 ? (peak - current) / peak : 0;
}

function getDrawdownAt(equityCurve: number[], index: number): number {
  if (index < 0 || index >= equityCurve.length) return 0;
  let peak = equityCurve[0];
  for (let i = 1; i <= index; i++) {
    if (equityCurve[i] > peak) peak = equityCurve[i];
  }
  return peak > 0 ? (peak - equityCurve[index]) / peak : 0;
}

function getRollingWinRate(trades: Trade[], endIndex: number, window: number): number {
  const start = Math.max(0, endIndex - window + 1);
  const slice = trades.slice(start, endIndex + 1);
  if (slice.length === 0) return 1;
  const wins = slice.filter((t) => t.return > 0).length;
  return wins / slice.length;
}

function computeProfitFactor(grossProfit: number, grossLoss: number): number {
  if (grossLoss > 0) return grossProfit / grossLoss;
  return grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;
}

function rebuildResult(trades: Trade[], original: BacktestResult): BacktestResult {
  const initialCapital = original.initialCapital;
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
      profitFactor: 0,
      avgHoldingDays: 0,
      trades: [],
      drawdownPeriods: [],
    };
  }

  const totalReturn = trades.reduce((sum, t) => sum + t.return, 0);
  const finalCapital = initialCapital + totalReturn;
  const wins = trades.filter((t) => t.return > 0);
  const losses = trades.filter((t) => t.return <= 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.return, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.return, 0));

  // Max drawdown from equity curve
  const curve = buildEquityCurve(trades, initialCapital);
  let peak = curve[0];
  let maxDd = 0;
  for (const e of curve) {
    if (e > peak) peak = e;
    const dd = peak > 0 ? (peak - e) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  // Simple Sharpe from trade returns
  const tradeReturns = trades.map((t) => t.returnPercent / 100);
  const meanRet = tradeReturns.reduce((s, r) => s + r, 0) / tradeReturns.length;
  const variance = tradeReturns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / tradeReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (meanRet / stdDev) * Math.sqrt(252) : 0;

  return {
    initialCapital,
    finalCapital,
    totalReturn,
    totalReturnPercent: (totalReturn / initialCapital) * 100,
    tradeCount: trades.length,
    winRate: wins.length / trades.length,
    maxDrawdown: maxDd,
    sharpeRatio: sharpe,
    profitFactor: computeProfitFactor(grossProfit, grossLoss),
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
 * equity curve indicates poor strategy health (below MA, excessive drawdown,
 * low win rate, or a combination).
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
    maxDrawdown = 0.15,
    winRateWindow = 20,
    minWinRate = 0.4,
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

  // Build equity curve incrementally and decide for each trade
  const filteredTrades: Trade[] = [];
  let equity = result.initialCapital;
  // Track equity values after each trade for MA calculation
  const equityValues: number[] = [equity];
  let skipped = 0;

  // Pre-compute EMA if needed (need to do incrementally)
  let emaValue: number | null = null;

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];

    // Determine if trade passes filter
    let passes = true;

    if (type === "ma" || type === "combined") {
      let maValue: number | null = null;
      if (maType === "sma") {
        maValue = computeSma(equityValues, maPeriod, equityValues.length - 1);
      } else {
        // EMA: compute incrementally
        if (equityValues.length < maPeriod) {
          maValue = null;
        } else if (emaValue === null) {
          let sum = 0;
          for (let j = equityValues.length - maPeriod; j < equityValues.length; j++) {
            sum += equityValues[j];
          }
          emaValue = sum / maPeriod;
          maValue = emaValue;
        } else {
          const k = 2 / (maPeriod + 1);
          emaValue = equityValues[equityValues.length - 1] * k + emaValue * (1 - k);
          maValue = emaValue;
        }
      }
      if (maValue !== null && equity < maValue) {
        passes = false;
      }
    }

    if (type === "drawdown" || type === "combined") {
      const dd = getDrawdownAt(equityValues, equityValues.length - 1);
      if (dd > maxDrawdown) {
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
      equity += trade.return;
    } else if (filteredSizeFactor > 0) {
      const scaled = scaleTrade(trade, filteredSizeFactor);
      filteredTrades.push(scaled);
      equity += scaled.return;
      skipped++;
    } else {
      skipped++;
    }

    equityValues.push(equity);
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

  const currentDrawdown = getCurrentDrawdown(curve);

  const rollingWinRate =
    trades.length > 0 ? getRollingWinRate(trades, trades.length - 1, winRateWindow) : 1;

  // Health score: weighted composite
  const maScore = aboveMa ? 100 : 0;
  const ddScore = Math.max(0, 100 - currentDrawdown * 500); // 20% DD = 0
  const wrScore = Math.min(100, (rollingWinRate / 0.6) * 100); // 60% WR = 100
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
