/**
 * Deflated Sharpe Ratio (DSR)
 *
 * Bailey & López de Prado (2014), "The Deflated Sharpe Ratio: Correcting
 * for Selection Bias, Backtest Overfitting and Non-Normality", Journal
 * of Portfolio Management.
 *
 * The DSR answers: given that this strategy's Sharpe ratio is the *best*
 * of N trials, and given the return distribution's non-normality and the
 * sample length, what is the probability that the true Sharpe exceeds
 * zero? It deflates an observed Sharpe by:
 * - selection bias: the more configurations you tried (N), the higher a
 *   Sharpe you expect to find by luck alone (the `expectedMaxSharpe`
 *   benchmark, SR0);
 * - non-normality: skew and fat tails inflate the uncertainty of a
 *   Sharpe estimate;
 * - sample length: shorter backtests give noisier Sharpe estimates.
 *
 * A DSR above ~0.95 is the usual bar for "this edge is unlikely to be a
 * backtest-overfitting artifact".
 *
 * All Sharpe inputs are **per-return (non-annualized)** and must share
 * the same return frequency as `skewness` / `kurtosis` / `sampleSize`.
 * Annualized Sharpes (e.g. `× √252`) must be divided back to per-return
 * units before use, or the `√(T − 1)` scaling is meaningless.
 *
 * No external dependencies.
 */

import { normalCdf } from "../core/statistics";

const EULER_MASCHERONI = 0.5772156649015329;
const E = Math.E;

/**
 * Inverse CDF (quantile / ppf) of the standard normal distribution.
 * Acklam's rational approximation (|error| < 1.15e-9 in the central
 * region). Returns ∓∞ at the boundaries.
 */
function normalPpf(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;

  // Coefficients for the rational approximation.
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  // Define break-points for the central vs. tail regions.
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/** Population mean. */
function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Population variance. */
function variance(xs: number[], mu = mean(xs)): number {
  return xs.reduce((s, v) => s + (v - mu) ** 2, 0) / xs.length;
}

/**
 * Sample skewness and **non-excess** kurtosis (3 for a normal
 * distribution), the moment convention the DSR formula expects.
 */
function moments(returns: number[]): { skewness: number; kurtosis: number } {
  const n = returns.length;
  const mu = mean(returns);
  const sigma = Math.sqrt(variance(returns, mu));
  if (n === 0 || sigma === 0) return { skewness: 0, kurtosis: 3 };
  let s3 = 0;
  let s4 = 0;
  for (const r of returns) {
    const d = (r - mu) / sigma;
    s3 += d * d * d;
    s4 += d * d * d * d;
  }
  return { skewness: s3 / n, kurtosis: s4 / n };
}

/**
 * Expected maximum Sharpe ratio (SR0) under the null hypothesis of zero
 * true Sharpe, given `trials` independent backtests whose per-return
 * Sharpe estimates have variance `trialSharpeVariance`.
 *
 * This is the selection-bias benchmark: with more trials you expect a
 * higher *best* Sharpe purely by chance, so a candidate must clear this
 * bar to be credible. Uses the extreme-value approximation from Bailey
 * & López de Prado with the Euler–Mascheroni constant.
 *
 * With `trials ≤ 1` there is no selection, so the benchmark is just
 * `trialSharpeMean` (0 by default).
 *
 * @param trials Number of independent strategy configurations evaluated (N)
 * @param trialSharpeVariance Variance of the per-return Sharpe estimates across trials
 * @param trialSharpeMean Mean of the trial Sharpe estimates (default 0, the null)
 * @returns Expected maximum (per-return) Sharpe ratio
 */
export function expectedMaxSharpe(
  trials: number,
  trialSharpeVariance: number,
  trialSharpeMean = 0,
): number {
  if (trials <= 1 || !(trialSharpeVariance > 0)) return trialSharpeMean;
  const sd = Math.sqrt(trialSharpeVariance);
  const maxZ =
    (1 - EULER_MASCHERONI) * normalPpf(1 - 1 / trials) +
    EULER_MASCHERONI * normalPpf(1 - 1 / (trials * E));
  return trialSharpeMean + sd * maxZ;
}

/**
 * Probabilistic Sharpe Ratio (PSR) — the probability that the true
 * (per-return) Sharpe ratio exceeds `benchmarkSharpe`, accounting for
 * sample length and the non-normality of returns.
 *
 * `PSR(SR*) = Φ( (SR̂ − SR*)·√(T − 1) / √(1 − γ₃·SR̂ + ((γ₄ − 1)/4)·SR̂²) )`
 *
 * where SR̂ is the observed Sharpe, γ₃ the skewness, and γ₄ the
 * (non-excess) kurtosis of the return series. The Deflated Sharpe Ratio
 * is just `PSR` with `benchmarkSharpe = expectedMaxSharpe(...)`.
 *
 * @param observedSharpe Observed per-return Sharpe (SR̂)
 * @param benchmarkSharpe Sharpe threshold to beat (SR*); 0 = "is the edge real at all?"
 * @param sampleSize Number of return observations (T ≥ 2)
 * @param skewness Skewness of the return series (default 0 = normal)
 * @param kurtosis Non-excess kurtosis of the return series (default 3 = normal)
 * @returns Probability in [0, 1], or `NaN` when undefined (T < 2 or non-positive variance term)
 */
export function probabilisticSharpe(
  observedSharpe: number,
  benchmarkSharpe: number,
  sampleSize: number,
  skewness = 0,
  kurtosis = 3,
): number {
  if (sampleSize < 2) return Number.NaN;
  const radicand = 1 - skewness * observedSharpe + ((kurtosis - 1) / 4) * observedSharpe ** 2;
  if (!(radicand > 0)) return Number.NaN;
  const z = ((observedSharpe - benchmarkSharpe) * Math.sqrt(sampleSize - 1)) / Math.sqrt(radicand);
  return normalCdf(z);
}

/** Parameters for {@link deflatedSharpe}. */
export type DeflatedSharpeParams = {
  /** Observed per-return (non-annualized) Sharpe ratio of the selected strategy (SR̂). */
  observedSharpe: number;
  /** Number of return observations the Sharpe was estimated from (T ≥ 2). */
  sampleSize: number;
  /** Number of independent strategy configurations evaluated (N). */
  trials: number;
  /** Variance of the per-return Sharpe estimates across the N trials. */
  trialSharpeVariance: number;
  /** Skewness of the return series (default 0 = normal). */
  skewness?: number;
  /** Non-excess kurtosis of the return series (default 3 = normal). */
  kurtosis?: number;
};

/**
 * Deflated Sharpe Ratio — the probability that the selected strategy's
 * true Sharpe is positive after correcting for selection bias (N
 * trials), non-normality, and sample length.
 *
 * Equivalent to `probabilisticSharpe(observedSharpe,
 * expectedMaxSharpe(trials, trialSharpeVariance), sampleSize, skewness,
 * kurtosis)`.
 *
 * Returns a probability in [0, 1]; values above ~0.95 indicate the
 * Sharpe is unlikely to be a multiple-testing artifact. All Sharpe
 * inputs must be in per-return (non-annualized) units.
 *
 * @example
 * ```ts
 * import { deflatedSharpe } from "trendcraft";
 *
 * // Best of 50 grid-search configs, per-return Sharpe 0.12 over 500 bars,
 * // trial Sharpes had variance 0.0025.
 * const dsr = deflatedSharpe({
 *   observedSharpe: 0.12,
 *   sampleSize: 500,
 *   trials: 50,
 *   trialSharpeVariance: 0.0025,
 * });
 * console.log(dsr < 0.95 ? "likely overfit" : "credible edge");
 * ```
 */
export function deflatedSharpe(params: DeflatedSharpeParams): number {
  const { observedSharpe, sampleSize, trials, trialSharpeVariance } = params;
  const skewness = params.skewness ?? 0;
  const kurtosis = params.kurtosis ?? 3;
  const sr0 = expectedMaxSharpe(trials, trialSharpeVariance);
  return probabilisticSharpe(observedSharpe, sr0, sampleSize, skewness, kurtosis);
}

/**
 * Convenience wrapper that derives every {@link deflatedSharpe} input
 * from raw data: the observed Sharpe, sample size, skewness, and
 * kurtosis from the selected strategy's `returns`, and the trial count
 * and Sharpe variance from `trialSharpes`.
 *
 * Both `returns` and `trialSharpes` must be expressed in the **same
 * per-return units** — i.e. `trialSharpes[i]` is each trial's
 * `mean(trialReturns) / stdDev(trialReturns)`, NOT an annualized figure.
 * The observed Sharpe is computed the same way from `returns`.
 *
 * @param returns Per-period return series of the selected strategy (decimals or percents — only the ratio matters)
 * @param trialSharpes Per-return Sharpe ratio of every trial evaluated (including the selected one)
 * @returns Deflated Sharpe probability in [0, 1], or `NaN` when undefined
 * @example
 * ```ts
 * import { deflatedSharpeFromReturns, extractTradeReturns } from "trendcraft";
 *
 * const returns = extractTradeReturns(bestResult);
 * const trialSharpes = gridResult.results.map((r) => perReturnSharpe(r));
 * const dsr = deflatedSharpeFromReturns(returns, trialSharpes);
 * ```
 */
export function deflatedSharpeFromReturns(returns: number[], trialSharpes: number[]): number {
  if (returns.length < 2) return Number.NaN;
  const mu = mean(returns);
  const sigma = Math.sqrt(variance(returns, mu));
  if (sigma === 0) return Number.NaN;
  const observedSharpe = mu / sigma;
  const { skewness, kurtosis } = moments(returns);
  return deflatedSharpe({
    observedSharpe,
    sampleSize: returns.length,
    trials: trialSharpes.length,
    trialSharpeVariance: trialSharpes.length > 0 ? variance(trialSharpes) : 0,
    skewness,
    kurtosis,
  });
}

/**
 * Per-return (non-annualized) Sharpe ratio: mean divided by the
 * *population* standard deviation of the raw return series — the unit
 * every PSR / DSR / PBO input in this library expects.
 *
 * Zero-variance series preserve ranking order instead of collapsing to 0:
 * a constant positive series returns `+Infinity` (it beats any finite
 * Sharpe — risk-free gain), a constant negative one `-Infinity`, and an
 * empty or constant-zero series `0`.
 */
export function perReturnSharpe(returns: number[]): number {
  if (returns.length === 0) return 0;
  const mu = mean(returns);
  const sd = Math.sqrt(variance(returns, mu));
  if (sd > 0) return mu / sd;
  if (mu > 0) return Number.POSITIVE_INFINITY;
  if (mu < 0) return Number.NEGATIVE_INFINITY;
  return 0;
}

/**
 * Minimum Track Record Length (MinTRL) — the shortest number of return
 * observations needed before the {@link probabilisticSharpe} of the
 * observed Sharpe clears `confidence` against `benchmarkSharpe`; i.e. how
 * long a track record must be before the edge is statistically
 * distinguishable from the benchmark.
 *
 * `MinTRL = 1 + (1 − γ₃·SR̂ + ((γ₄ − 1)/4)·SR̂²) · (Φ⁻¹(α) / (SR̂ − SR*))²`
 *
 * Exact inverse of the PSR formula: `probabilisticSharpe(SR̂, SR*, T)`
 * crosses `confidence` precisely at `T = MinTRL`. The result is a real
 * (fractional) observation count — `Math.ceil` it for a usable bar count.
 *
 * Returns `Infinity` when the observed Sharpe does not exceed the
 * benchmark (no track record length can establish the edge) and `NaN`
 * when the non-normality correction term is non-positive.
 *
 * @param observedSharpe Observed per-return (non-annualized) Sharpe (SR̂)
 * @param benchmarkSharpe Sharpe threshold to beat (SR*, default 0)
 * @param confidence Required PSR confidence level in (0.5, 1) (default 0.95)
 * @param skewness Skewness of the return series (default 0 = normal)
 * @param kurtosis Non-excess kurtosis of the return series (default 3 = normal)
 * @returns Minimum number of return observations (fractional)
 *
 * @example
 * ```ts
 * import { minTrackRecordLength } from "trendcraft";
 *
 * // Per-return Sharpe 0.1: how many bars until PSR(0) ≥ 95%?
 * const bars = Math.ceil(minTrackRecordLength(0.1));
 * // ≈ 274 observations
 * ```
 */
export function minTrackRecordLength(
  observedSharpe: number,
  benchmarkSharpe = 0,
  confidence = 0.95,
  skewness = 0,
  kurtosis = 3,
): number {
  // Confidence at or below 0.5 is meaningless for this one-sided test:
  // whenever SR̂ > SR*, PSR already exceeds 0.5 at any valid sample size,
  // and the squared quantile would silently answer for 1 - confidence.
  if (!(confidence > 0.5 && confidence < 1)) {
    throw new Error(`minTrackRecordLength: confidence must be in (0.5, 1), got ${confidence}`);
  }
  if (observedSharpe <= benchmarkSharpe) return Number.POSITIVE_INFINITY;
  const radicand = 1 - skewness * observedSharpe + ((kurtosis - 1) / 4) * observedSharpe ** 2;
  if (!(radicand > 0)) return Number.NaN;
  return 1 + radicand * (normalPpf(confidence) / (observedSharpe - benchmarkSharpe)) ** 2;
}
