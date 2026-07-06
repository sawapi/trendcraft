/**
 * Shared constants for optimization-layer helpers.
 */

/**
 * Default capital applied when a strategy factory's options omit `capital`
 * (`BacktestOptions` requires it). Single owner — grid search, walk-forward,
 * Pareto, and robustness sensitivity must all backtest against the same
 * default so their scores stay comparable.
 */
export const DEFAULT_BACKTEST_CAPITAL = 100000;
