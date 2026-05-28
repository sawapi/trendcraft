import { type BacktestResult, type MonteCarloResult, runMonteCarloSimulation } from "trendcraft";

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
