/**
 * Regime-conditioned performance attribution.
 *
 * Slices a completed backtest's per-bar returns by the market regime active on
 * each bar and reports a performance table per regime, plus the empirical
 * regime transition matrix observed over the candle window.
 *
 * Attribution is **bar/return-level**, the convention shared by pyfolio,
 * quantstats and Alphalens (grouping period returns by a categorical label):
 * each daily return is assigned to the regime of the bar it is realised on,
 * then the headline statistics are aggregated within each regime. A position
 * held across a regime change therefore has its P&L split across regimes, which
 * is the intended behaviour. The per-regime `tradeCount` is a separate,
 * explicitly trade-level view (counted by the regime at trade entry).
 *
 * **Look-ahead caveat.** When the regime labels come from an HMM (or any model)
 * fitted with smoothing / Viterbi over the full sequence, each label embeds
 * future information, and a model fitted once on the whole sample also leaks
 * its parameters across time. A regime-attribution table built on such labels
 * is *descriptive* — "where returns landed across regimes" — not a tradeable,
 * ex-ante claim. Use filtered (causal) labels or a walk-forward re-fit before
 * drawing tradeable conclusions.
 *
 * **Small samples.** Rare regimes yield unreliable per-regime Sharpe,
 * volatility and especially max drawdown. Always read each row's `bars` (and
 * `tradeCount`) before trusting its ratios; the transition `counts` matrix is
 * returned alongside the probabilities for the same reason.
 */

import { calculateDailyReturns } from "../optimization/metrics";
import type { BacktestResult, NormalizedCandle, Series } from "../types";
import {
  annualizedReturnFraction,
  sampleStd,
  sharpeFromReturns,
  winRateFromReturns,
} from "./return-metrics";

/** Minimal per-bar regime label (structurally satisfied by `HmmRegimeValue`). */
export type RegimeLabel = {
  /** Zero-based regime/state index. */
  regime: number;
  /** Human-readable regime label. */
  label: string;
};

/** Options for {@link backtestByRegime}. */
export type RegimeAttributionOptions = {
  /** Candles the backtest ran on (to reconstruct the daily equity returns). */
  candles: NormalizedCandle[];
  /**
   * Per-bar regime labels aligned index-for-index with `candles`
   * (e.g. the output of `hmmRegimes(candles)`).
   */
  regimes: Series<RegimeLabel>;
  /** Starting capital (default: `result.initialCapital`). */
  initialCapital?: number;
  /** Annual risk-free rate as a fraction (default 0). */
  riskFree?: number;
  /** Periods per year for annualisation (default 252). */
  periodsPerYear?: number;
};

/** Bar/return-level performance statistics for a single regime. */
export type RegimeStats = {
  /** Zero-based regime/state index. */
  regime: number;
  /** Human-readable regime label. */
  label: string;
  /** Number of daily returns attributed to this regime. */
  bars: number;
  /** Share of the return series spent in this regime, in [0, 1]. */
  fractionOfPeriod: number;
  /** Compounded return earned while in this regime, in percent. */
  totalReturnPercent: number;
  /** Geometric annualised return over the regime's bars, in percent (`NaN` if no bars). */
  annualizedReturnPercent: number;
  /** Annualised volatility over the regime's bars, in percent. */
  annualizedVolatilityPercent: number;
  /** Annualised Sharpe over the regime's bars (`NaN` for fewer than two bars or zero volatility). */
  sharpeRatio: number;
  /** Regime-local max drawdown of the in-regime equity sub-curve, in percent (≤ 0). */
  maxDrawdownPercent: number;
  /** Win rate over the regime's non-zero returns, in [0, 1]. */
  winRate: number;
  /** Trades whose entry bar fell in this regime (trade-level, entry-attributed). */
  tradeCount: number;
};

/** Empirical regime transition matrix over the candle window. */
export type RegimeTransition = {
  /** Regime labels; index = matrix row/column. */
  labels: string[];
  /** Regime/state indices matching `labels`, ascending. */
  states: number[];
  /** Bar-to-bar transition counts, `counts[from][to]`. */
  counts: number[][];
  /**
   * Row-stochastic transition probabilities, `matrix[from][to]`, each row
   * summing to 1 (a row with no observed transitions is all zeros). The
   * diagonal is the regime's persistence / self-transition probability.
   */
  matrix: number[][];
};

/** Regime-conditioned attribution of a backtest result. */
export type RegimeAttributionReport = {
  /** Per-regime performance table, ascending by state index. */
  regimes: RegimeStats[];
  /** Empirical regime transition matrix observed over the candles. */
  transition: RegimeTransition;
};

/** Regime-local max drawdown (percent, ≤ 0) of an equity curve built from `returns`. */
function maxDrawdownPercentFromReturns(returns: number[]): number {
  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  for (const r of returns) {
    equity *= 1 + r;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (equity - peak) / peak : 0;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd * 100;
}

/**
 * Attribute a backtest's performance to the market regime active on each bar.
 *
 * @param result - The backtest result to attribute
 * @param options - Candles, per-bar regime labels and annualisation options
 * @returns A per-regime performance table plus the empirical transition matrix
 * @throws If `regimes` is not aligned index-for-index with `candles`
 *
 * @example
 * ```ts
 * import { runBacktest, hmmRegimes, backtestByRegime } from "trendcraft";
 *
 * const result = runBacktest(candles, entry, exit, { capital: 100_000 });
 * const regimes = hmmRegimes(candles, { numStates: 3 });
 * const attribution = backtestByRegime(result, { candles, regimes });
 * for (const r of attribution.regimes) {
 *   console.log(r.label, r.bars, r.sharpeRatio, r.maxDrawdownPercent);
 * }
 * ```
 */
export function backtestByRegime(
  result: BacktestResult,
  options: RegimeAttributionOptions,
): RegimeAttributionReport {
  const {
    candles,
    regimes,
    initialCapital = result.initialCapital,
    riskFree = 0,
    periodsPerYear = 252,
  } = options;

  if (regimes.length !== candles.length) {
    throw new Error(
      `backtestByRegime: regimes (${regimes.length}) must be aligned index-for-index with candles (${candles.length})`,
    );
  }

  // The empirical transition matrix and the state list are derived from the
  // full per-bar regime sequence (independent of trades), so the stat table and
  // the transition matrix share the same ordered set of states.
  const stateLabels = new Map<number, string>();
  for (const point of regimes) {
    if (!stateLabels.has(point.value.regime)) {
      stateLabels.set(point.value.regime, point.value.label);
    }
  }
  const states = [...stateLabels.keys()].sort((a, b) => a - b);
  // `states` is built from the map's keys, so every lookup resolves.
  const labels = states.map((s) => stateLabels.get(s) as string);
  const stateIndex = new Map<number, number>(states.map((s, i) => [s, i]));
  const n = states.length;

  const counts: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 1; i < regimes.length; i++) {
    const from = stateIndex.get(regimes[i - 1].value.regime);
    const to = stateIndex.get(regimes[i].value.regime);
    if (from !== undefined && to !== undefined) counts[from][to]++;
  }
  const matrix = counts.map((row) => {
    const rowSum = row.reduce((acc, c) => acc + c, 0);
    return rowSum === 0 ? row.map(() => 0) : row.map((c) => c / rowSum);
  });

  // Reconstruct the daily returns. A valid no-trade backtest produces none;
  // keep it candle-aligned (flat) so attribution still covers every bar.
  const rawReturns = calculateDailyReturns(result, candles, initialCapital);
  const returns =
    rawReturns.length === 0 && candles.length >= 2
      ? new Array<number>(candles.length - 1).fill(0)
      : rawReturns;

  // Bar/return-level bucketing: returns[i] is realised on candle i+1, so it is
  // attributed to that bar's regime.
  const byState: number[][] = states.map(() => []);
  for (let i = 0; i < returns.length; i++) {
    const idx = stateIndex.get(regimes[i + 1].value.regime);
    if (idx !== undefined) byState[idx].push(returns[i]);
  }

  // Trade-level (entry-attributed) counts: map each entry bar's time to its regime.
  const tradeCounts = new Array<number>(n).fill(0);
  const timeToState = new Map<number, number>();
  for (const point of regimes) timeToState.set(point.time, point.value.regime);
  for (const trade of result.trades) {
    const state = timeToState.get(trade.entryTime);
    if (state === undefined) continue;
    const idx = stateIndex.get(state);
    if (idx !== undefined) tradeCounts[idx]++;
  }

  const total = returns.length;

  const regimeStats: RegimeStats[] = states.map((state, idx) => {
    const r = byState[idx];
    const bars = r.length;

    let compounded = 1;
    for (const v of r) compounded *= 1 + v;

    return {
      regime: state,
      label: labels[idx],
      bars,
      fractionOfPeriod: total > 0 ? bars / total : 0,
      totalReturnPercent: (compounded - 1) * 100,
      annualizedReturnPercent: annualizedReturnFraction(r, periodsPerYear) * 100,
      annualizedVolatilityPercent: sampleStd(r) * Math.sqrt(periodsPerYear) * 100,
      sharpeRatio: sharpeFromReturns(r, { riskFree, periodsPerYear }),
      maxDrawdownPercent: maxDrawdownPercentFromReturns(r),
      winRate: winRateFromReturns(r),
      tradeCount: tradeCounts[idx],
    };
  });

  return {
    regimes: regimeStats,
    transition: { labels, states, counts, matrix },
  };
}
