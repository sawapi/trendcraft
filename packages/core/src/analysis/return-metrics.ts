/**
 * Return-distribution and rolling performance metrics.
 *
 * These operate on a bare array of periodic returns expressed as fractions
 * (e.g. `0.012` for +1.2%), matching the empyrical / quantstats convention.
 * The caller chooses the granularity — pass daily returns for daily-resolution
 * metrics, monthly returns for monthly ones.
 *
 * Conventions (deliberately mirroring empyrical / quantstats so values are
 * comparable to the Python canon):
 * - An undefined ratio (zero or empty denominator) returns `NaN`, except
 *   `profitFactorFromReturns`, which returns `Infinity` when there are gains
 *   but no losses and `0` when everything is flat — the quantstats scalar
 *   behaviour. That `Infinity` propagates into `commonSenseRatio`.
 * - Percentiles use linear interpolation between order statistics (numpy
 *   `linear` / pandas default), and rolling standard deviations use the
 *   sample estimator (ddof = 1).
 */

/**
 * Percentile of an ascending-sorted array using linear interpolation
 * (numpy `linear` / pandas `quantile` default).
 *
 * A pre-sorted, `[0, 1]`-quantile, `NaN`-on-empty variant used internally so
 * `tailRatio` can sort once and sample two quantiles. The canonical public
 * percentile is `percentile` in `core/statistics.ts` (`[0, 100]`, sorts
 * internally, `0` on empty); this is not re-exported from the package barrel.
 *
 * @param sortedAsc - Values sorted in ascending order
 * @param q - Quantile in [0, 1]
 * @returns Interpolated percentile, or `NaN` for an empty array
 */
export function percentileLinear(sortedAsc: number[], q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sortedAsc[0];
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (pos - lo) * (sortedAsc[hi] - sortedAsc[lo]);
}

/**
 * Options for the Omega ratio.
 */
export type OmegaOptions = {
  /** Per-period risk-free return subtracted from each observation (default 0). */
  riskFree?: number;
  /** Annualised minimum acceptable return / threshold τ (default 0). */
  requiredReturn?: number;
  /** Periods per year used to de-annualise `requiredReturn` (default 252). */
  periodsPerYear?: number;
};

/**
 * Omega ratio — probability-weighted ratio of gains to losses relative to a
 * threshold τ. Equals the area of the return distribution above τ divided by
 * the area below it. An Omega above 1 means gains beyond the threshold
 * outweigh shortfalls below it.
 *
 * Mirrors empyrical's `omega_ratio`: `requiredReturn` is treated as an
 * annualised rate and de-annualised to per-period τ, then subtracted (along
 * with the per-period `riskFree`) from every observation.
 *
 * @param returns - Periodic returns as fractions
 * @param options - Threshold and annualisation options
 * @returns Omega ratio, or `NaN` when fewer than two observations or no
 *   observations fall below the threshold
 *
 * @example
 * ```ts
 * import { omegaRatio } from "trendcraft";
 *
 * const omega = omegaRatio([0.01, -0.005, 0.008, -0.002]);
 * ```
 */
export function omegaRatio(returns: number[], options: OmegaOptions = {}): number {
  const { riskFree = 0, requiredReturn = 0, periodsPerYear = 252 } = options;
  if (returns.length < 2) return Number.NaN;

  let returnThreshold: number;
  if (periodsPerYear === 1) {
    returnThreshold = requiredReturn;
  } else if (requiredReturn <= -1) {
    return Number.NaN;
  } else {
    returnThreshold = (1 + requiredReturn) ** (1 / periodsPerYear) - 1;
  }

  let numer = 0;
  let denom = 0;
  for (const r of returns) {
    const excess = r - riskFree - returnThreshold;
    if (excess > 0) numer += excess;
    else if (excess < 0) denom -= excess;
  }

  return denom > 0 ? numer / denom : Number.NaN;
}

/**
 * Tail ratio — the magnitude of the right tail relative to the left tail,
 * `|percentile(cutoff)| / |percentile(1 - cutoff)|`. A value above 1 means
 * the best returns are larger in magnitude than the worst.
 *
 * Matches quantstats' `tail_ratio` (default cutoff 0.95, i.e. 95th vs 5th
 * percentile, linear-interpolated).
 *
 * @param returns - Periodic returns as fractions
 * @param cutoff - Upper percentile in (0.5, 1) (default 0.95)
 * @returns Tail ratio, or `NaN` when empty or the lower percentile is 0
 *
 * @example
 * ```ts
 * import { tailRatio } from "trendcraft";
 *
 * const tr = tailRatio(dailyReturns); // 95th / 5th percentile
 * ```
 */
export function tailRatio(returns: number[], cutoff = 0.95): number {
  if (returns.length === 0) return Number.NaN;
  const sorted = [...returns].sort((a, b) => a - b);
  const upper = percentileLinear(sorted, cutoff);
  const lower = percentileLinear(sorted, 1 - cutoff);
  if (!Number.isFinite(upper) || !Number.isFinite(lower) || lower === 0) return Number.NaN;
  return Math.abs(upper / lower);
}

/**
 * Gain-to-pain ratio (Jack Schwager) — `sum(returns) / |sum(losing returns)|`.
 * The canonical Schwager form uses monthly returns; pass a monthly series for
 * that, or any other granularity for a comparable measure at that resolution.
 *
 * @param returns - Periodic returns as fractions
 * @returns Gain-to-pain ratio, or `NaN` when there are no losing periods
 *
 * @example
 * ```ts
 * import { gainToPainRatio } from "trendcraft";
 *
 * const gpr = gainToPainRatio(monthlyReturns);
 * ```
 */
export function gainToPainRatio(returns: number[]): number {
  if (returns.length === 0) return Number.NaN;
  let total = 0;
  let downside = 0;
  for (const r of returns) {
    total += r;
    if (r < 0) downside -= r;
  }
  return downside > 0 ? total / downside : Number.NaN;
}

/**
 * Profit factor from a returns series — `sum(gains) / |sum(losses)|`, where a
 * zero return counts as a gain (quantstats `>= 0` convention). Returns
 * `Infinity` when there are gains but no losses, and `0` when every return is
 * zero.
 *
 * This is the returns-based profit factor used by `commonSenseRatio` and
 * `cpcIndex`. It is distinct from the trade-based profit factor on
 * `BacktestResult`, which divides winning trade P&L by losing trade P&L.
 *
 * @param returns - Periodic returns as fractions
 * @returns Returns-based profit factor
 */
export function profitFactorFromReturns(returns: number[]): number {
  let gains = 0;
  let losses = 0;
  for (const r of returns) {
    if (r >= 0) gains += r;
    else losses -= r;
  }
  if (losses === 0) return gains === 0 ? 0 : Number.POSITIVE_INFINITY;
  return gains / losses;
}

/**
 * Win rate from a returns series — `count(r > 0) / count(r !== 0)`. Zero
 * returns are excluded from the denominator. Returns `0` when there are no
 * non-zero returns.
 *
 * @param returns - Periodic returns as fractions
 * @returns Win rate as a fraction in [0, 1]
 */
export function winRateFromReturns(returns: number[]): number {
  let wins = 0;
  let nonZero = 0;
  for (const r of returns) {
    if (r === 0) continue;
    nonZero++;
    if (r > 0) wins++;
  }
  return nonZero === 0 ? 0 : wins / nonZero;
}

/**
 * Payoff ratio from a returns series — `mean(gains) / |mean(losses)|`
 * (quantstats `payoff_ratio` / `win_loss_ratio`).
 *
 * @param returns - Periodic returns as fractions
 * @returns Payoff ratio, or `NaN` when there are no losing periods
 */
export function payoffRatioFromReturns(returns: number[]): number {
  let winSum = 0;
  let winCount = 0;
  let lossSum = 0;
  let lossCount = 0;
  for (const r of returns) {
    if (r > 0) {
      winSum += r;
      winCount++;
    } else if (r < 0) {
      lossSum += r;
      lossCount++;
    }
  }
  if (lossCount === 0) return Number.NaN;
  const avgWin = winCount === 0 ? Number.NaN : winSum / winCount;
  const avgLoss = lossSum / lossCount;
  return avgWin / Math.abs(avgLoss);
}

/**
 * Common-sense ratio (quantstats) — `profitFactor * tailRatio`. Combines the
 * win/loss balance with the relative size of the extreme tails. Inherits the
 * `Infinity`/`NaN` edge behaviour of its components.
 *
 * @param returns - Periodic returns as fractions
 * @param cutoff - Tail-ratio cutoff (default 0.95)
 * @returns Common-sense ratio
 */
export function commonSenseRatio(returns: number[], cutoff = 0.95): number {
  return profitFactorFromReturns(returns) * tailRatio(returns, cutoff);
}

/**
 * CPC index (quantstats `cpc_index`) — `profitFactor * winRate * payoffRatio`.
 * A composite quality score; `NaN` when there are no losing periods (the
 * payoff ratio is undefined).
 *
 * @param returns - Periodic returns as fractions
 * @returns CPC index
 */
export function cpcIndex(returns: number[]): number {
  return (
    profitFactorFromReturns(returns) * winRateFromReturns(returns) * payoffRatioFromReturns(returns)
  );
}

/**
 * Sample standard deviation (ddof = 1). Returns 0 for fewer than two values.
 * Shared by the rolling metrics here and the annualised volatility in the
 * tearsheet report; not part of the public barrel.
 */
export function sampleStd(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= n;
  let sumSq = 0;
  for (const v of values) sumSq += (v - mean) ** 2;
  return Math.sqrt(sumSq / (n - 1));
}

/**
 * Options for rolling Sharpe / volatility.
 */
export type RollingOptions = {
  /** Window length in periods (default 126, ~6 trading months). */
  window?: number;
  /** Annual risk-free rate as a fraction, de-annualised internally (default 0). */
  riskFree?: number;
  /** Periods per year for annualisation (default 252). */
  periodsPerYear?: number;
  /** Whether to annualise the Sharpe (default true). Volatility is always annualised. */
  annualize?: boolean;
};

/**
 * Rolling annualised Sharpe ratio over a trailing window (quantstats
 * `rolling_sharpe`). The first `window - 1` entries are `NaN` (insufficient
 * data), so the result aligns index-for-index with `returns`. A flat window
 * (zero sample volatility) also yields `NaN`, per the module's
 * undefined-ratio convention.
 *
 * @param returns - Periodic returns as fractions
 * @param options - Window and annualisation options
 * @returns Rolling Sharpe series, same length as `returns`
 *
 * @example
 * ```ts
 * import { rollingSharpe } from "trendcraft";
 *
 * const series = rollingSharpe(dailyReturns, { window: 63 });
 * ```
 */
export function rollingSharpe(returns: number[], options: RollingOptions = {}): number[] {
  const { window = 126, riskFree = 0, periodsPerYear = 252, annualize = true } = options;
  if (window < 1) throw new Error("rollingSharpe: window must be at least 1");

  const perPeriodRf = riskFree === 0 ? 0 : (1 + riskFree) ** (1 / periodsPerYear) - 1;
  const excess = perPeriodRf === 0 ? returns : returns.map((r) => r - perPeriodRf);
  const scale = annualize ? Math.sqrt(periodsPerYear) : 1;

  const out: number[] = new Array(returns.length).fill(Number.NaN);
  for (let i = window - 1; i < excess.length; i++) {
    const slice = excess.slice(i - window + 1, i + 1);
    let mean = 0;
    for (const v of slice) mean += v;
    mean /= window;
    const sd = sampleStd(slice);
    out[i] = sd === 0 ? Number.NaN : (mean / sd) * scale;
  }
  return out;
}

/**
 * Rolling annualised volatility over a trailing window (quantstats
 * `rolling_volatility`): sample standard deviation times `sqrt(periodsPerYear)`.
 * The first `window - 1` entries are `NaN`.
 *
 * @param returns - Periodic returns as fractions
 * @param options - Window and annualisation options (`riskFree`/`annualize` ignored)
 * @returns Rolling volatility series, same length as `returns`
 */
export function rollingVolatility(returns: number[], options: RollingOptions = {}): number[] {
  const { window = 126, periodsPerYear = 252 } = options;
  if (window < 1) throw new Error("rollingVolatility: window must be at least 1");

  const scale = Math.sqrt(periodsPerYear);
  const out: number[] = new Array(returns.length).fill(Number.NaN);
  for (let i = window - 1; i < returns.length; i++) {
    out[i] = sampleStd(returns.slice(i - window + 1, i + 1)) * scale;
  }
  return out;
}

/**
 * Geometric annualised return of a returns series (empyrical `annual_return`):
 * `prod(1 + r) ^ (periodsPerYear / n) - 1`. Returns `NaN` for an empty series.
 */
function annualizedReturnFraction(returns: number[], periodsPerYear: number): number {
  if (returns.length === 0) return Number.NaN;
  let ending = 1;
  for (const r of returns) ending *= 1 + r;
  const years = returns.length / periodsPerYear;
  return ending ** (1 / years) - 1;
}

/**
 * Up/down capture ratios versus a benchmark (empyrical `up_capture` /
 * `down_capture`). Each leg filters to the periods where the benchmark return
 * is strictly positive (up) or strictly negative (down), then divides the
 * strategy's geometric annualised return by the benchmark's over those
 * periods. A leg with no qualifying periods is `NaN`.
 *
 * @param returns - Strategy periodic returns as fractions
 * @param benchmark - Benchmark periodic returns, aligned index-for-index
 * @param periodsPerYear - Periods per year for annualisation (default 252)
 * @returns `{ up, down, ratio }` where `ratio = up / down`
 * @throws If the two series differ in length
 *
 * @example
 * ```ts
 * import { captureRatios } from "trendcraft";
 *
 * const { up, down, ratio } = captureRatios(stratReturns, benchmarkReturns);
 * ```
 */
export function captureRatios(
  returns: number[],
  benchmark: number[],
  periodsPerYear = 252,
): { up: number; down: number; ratio: number } {
  if (returns.length !== benchmark.length) {
    throw new Error(
      `captureRatios: returns (${returns.length}) and benchmark (${benchmark.length}) must be the same length`,
    );
  }

  const upStrat: number[] = [];
  const upBench: number[] = [];
  const downStrat: number[] = [];
  const downBench: number[] = [];
  for (let i = 0; i < benchmark.length; i++) {
    if (benchmark[i] > 0) {
      upStrat.push(returns[i]);
      upBench.push(benchmark[i]);
    } else if (benchmark[i] < 0) {
      downStrat.push(returns[i]);
      downBench.push(benchmark[i]);
    }
  }

  const up =
    annualizedReturnFraction(upStrat, periodsPerYear) /
    annualizedReturnFraction(upBench, periodsPerYear);
  const down =
    annualizedReturnFraction(downStrat, periodsPerYear) /
    annualizedReturnFraction(downBench, periodsPerYear);
  return { up, down, ratio: up / down };
}
