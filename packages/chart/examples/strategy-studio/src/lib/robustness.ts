import {
  type BacktestResult,
  deflatedSharpeFromReturns,
  type GridSearchResult,
  type MonteCarloResult,
  runMonteCarloSimulation,
} from "trendcraft";

/**
 * Default Monte Carlo iteration count. 1000 is the industry-canonical
 * baseline (AmiBroker / StrategyQuant / BuildAlpha all default here):
 * enough for stable 5th/95th percentile estimates without a perceptible
 * pause on a few-hundred-trade backtest.
 */
export const DEFAULT_MC_ITERATIONS = 1000;

/**
 * Discriminated result of a Monte Carlo run, mirroring
 * `OptimizationComputation` so the panel can render `empty` / `error`
 * states with their own messages instead of collapsing to a generic
 * "no data" caption.
 */
export type MonteCarloComputation =
  | { kind: "idle" }
  | { kind: "ok"; result: MonteCarloResult; iterations: number }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

/**
 * Run trade-shuffle Monte Carlo over the last backtest's trades via
 * core's `runMonteCarloSimulation`.
 *
 * The wrapper exists for Studio-specific empty-state handling: core
 * throws when there are fewer than 2 trades, but Studio treats "no
 * backtest yet" and "too few trades" as user-recoverable conditions
 * (`kind: "empty"`), not errors.
 *
 * A `seed` is always supplied so a given backtest + iteration count
 * reproduces the same distribution across re-runs — clicking Run twice
 * on an unchanged strategy should not shuffle the verdict. Users who
 * want to observe sampling variance can vary the iteration count.
 */
export function runMonteCarlo(
  lastBacktest: BacktestResult | undefined,
  options: { iterations?: number; seed?: number } = {},
): MonteCarloComputation {
  if (!lastBacktest) {
    return { kind: "empty", message: "Run a backtest first to enable Monte Carlo" };
  }
  if (lastBacktest.trades.length < 2) {
    return {
      kind: "empty",
      message: "Need at least 2 trades for Monte Carlo simulation",
    };
  }
  const iterations = options.iterations ?? DEFAULT_MC_ITERATIONS;
  try {
    const result = runMonteCarloSimulation(lastBacktest, {
      simulations: iterations,
      seed: options.seed ?? 42,
    });
    return { kind: "ok", result, iterations };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Per-return (non-annualized) Sharpe of a trade-return series, using the
 * population variance (`/N`) that core's Deflated Sharpe math uses. Kept
 * consistent so the selected strategy's trial Sharpe equals the observed
 * Sharpe core recomputes internally — a mismatched `/(N-1)` here would
 * desync the two and bias the correction.
 */
function perReturnSharpe(returns: number[]): number {
  if (returns.length < 2) return Number.NaN;
  const mu = returns.reduce((s, r) => s + r, 0) / returns.length;
  const sigma = Math.sqrt(returns.reduce((s, r) => s + (r - mu) ** 2, 0) / returns.length);
  return sigma === 0 ? Number.NaN : mu / sigma;
}

/** Per-trade returns as decimals (a trivial read of the public ledger). */
function tradeReturns(result: BacktestResult): number[] {
  return result.trades.map((t) => t.returnPercent / 100);
}

/**
 * Result of the Deflated Sharpe correction over a grid search. `empty`
 * mirrors the other robustness computations so the panel can explain why
 * a probability can't be produced rather than rendering a bare "—".
 */
export type DeflatedSharpeComputation =
  | {
      kind: "ok";
      /** P(true Sharpe > 0) after correcting for selection over N trials, in [0, 1]. */
      probability: number;
      /** Per-return Sharpe of the selected (highest-scoring) combination. */
      observedSharpe: number;
      /** Number of trials whose Sharpe entered the selection-bias correction. */
      trials: number;
      /** Trade count of the selected combination (the DSR sample size). */
      sampleSize: number;
    }
  | { kind: "empty"; message: string };

/**
 * Deflated Sharpe Ratio for the optimization's chosen strategy — the
 * probability its Sharpe survives correction for selection bias (having
 * picked the best of N grid combinations), non-normal returns, and the
 * sample length (Bailey & López de Prado 2014).
 *
 * The grid search is exactly the multiple-testing setup the DSR was
 * designed for: trying many parameter sets inflates the best in-sample
 * Sharpe purely by chance, and a raw Sharpe headline never shows that. We
 * feed every grid combination's per-return Sharpe in as the trial set, so
 * a wide grid that found one lucky peak deflates harder than a narrow grid
 * that found a broadly-good region.
 *
 * The heavy lifting is core's `deflatedSharpeFromReturns`; this wrapper
 * only shapes the grid result into (selected returns, trial Sharpes) and
 * adds Studio's empty-state handling. The selected combination is the
 * highest-scoring one (by whatever metric the grid optimized), picked by
 * score rather than assuming the array is pre-sorted.
 */
export function computeDeflatedSharpe(result: GridSearchResult): DeflatedSharpeComputation {
  const entries = result.results;
  if (entries.length < 2) {
    return {
      kind: "empty",
      message: "Need ≥ 2 parameter combinations to correct for selection bias",
    };
  }
  const best = entries.reduce((a, b) => (b.score > a.score ? b : a));
  const selectedReturns = tradeReturns(best.backtest);
  if (selectedReturns.length < 2) {
    return {
      kind: "empty",
      message: "Selected combination has too few trades for a Sharpe estimate",
    };
  }
  // Each grid combination contributes one per-return Sharpe; combinations
  // with too few trades to estimate one (NaN) drop out of the trial set
  // rather than poisoning its variance.
  const trialSharpes = entries
    .map((e) => perReturnSharpe(tradeReturns(e.backtest)))
    .filter(Number.isFinite);
  // The grid had ≥ 2 combinations, but if all but one were dropped for
  // too few trades, the trial set collapses to a single Sharpe — and a
  // one-element set carries no spread, so `deflatedSharpeFromReturns`
  // would compute a zero selection-bias benchmark and report an
  // uncorrected probability as if the grid had not been searched. Reject
  // it so the "Best of 1 grid combos" no-op never reaches the UI.
  if (trialSharpes.length < 2) {
    return {
      kind: "empty",
      message: "Need ≥ 2 combinations with enough trades to correct for selection bias",
    };
  }
  const probability = deflatedSharpeFromReturns(selectedReturns, trialSharpes);
  if (!Number.isFinite(probability)) {
    return {
      kind: "empty",
      message: "Deflated Sharpe is undefined for this grid (zero-variance returns)",
    };
  }
  return {
    kind: "ok",
    probability,
    observedSharpe: perReturnSharpe(selectedReturns),
    trials: trialSharpes.length,
    sampleSize: selectedReturns.length,
  };
}
