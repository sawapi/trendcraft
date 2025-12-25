/**
 * Optimization Types
 *
 * Types for backtest optimization including grid search and walk-forward analysis.
 */

import type { BacktestResult } from "./index";

/**
 * Parameter range for optimization
 */
export type ParameterRange = {
  /** Parameter name (used as key in params object) */
  name: string;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step size */
  step: number;
};

/**
 * Optimization evaluation metrics
 */
export type OptimizationMetric =
  | "sharpe"
  | "calmar"
  | "mar"
  | "profitFactor"
  | "recoveryFactor"
  | "returns"
  | "winRate"
  | "tradeCount"
  | "maxDrawdown";

/**
 * Constraint for filtering optimization results
 */
export type OptimizationConstraint = {
  /** Metric to constrain */
  metric: OptimizationMetric;
  /** Comparison operator */
  operator: ">" | ">=" | "<" | "<=" | "==";
  /** Threshold value */
  value: number;
};

/**
 * Single optimization result entry
 */
export type OptimizationResultEntry = {
  /** Parameter values for this run */
  params: Record<string, number>;
  /** Score based on selected metric */
  score: number;
  /** All calculated metrics */
  metrics: Record<OptimizationMetric, number>;
  /** Full backtest result */
  backtest: BacktestResult;
  /** Whether all constraints were satisfied */
  passedConstraints: boolean;
};

/**
 * Grid search result
 */
export type GridSearchResult = {
  /** Best parameters found */
  bestParams: Record<string, number>;
  /** Best score achieved */
  bestScore: number;
  /** Metric used for optimization */
  metric: OptimizationMetric;
  /** Total number of parameter combinations */
  totalCombinations: number;
  /** Number of combinations that passed constraints */
  validCombinations: number;
  /** All optimization results */
  results: OptimizationResultEntry[];
};

/**
 * Options for grid search
 */
export type GridSearchOptions = {
  /** Metric to optimize (default: "sharpe") */
  metric?: OptimizationMetric;
  /** Constraints to filter results */
  constraints?: OptimizationConstraint[];
  /** Maximum combinations to test (default: 10000) */
  maxCombinations?: number;
  /** Progress callback */
  progressCallback?: (current: number, total: number) => void;
  /** Whether to keep all results or only valid ones (default: false) */
  keepAllResults?: boolean;
};

/**
 * Walk-forward period result
 */
export type WalkForwardPeriod = {
  /** Training period start timestamp */
  trainStart: number;
  /** Training period end timestamp */
  trainEnd: number;
  /** Test period start timestamp */
  testStart: number;
  /** Test period end timestamp */
  testEnd: number;
  /** Best parameters from training */
  bestParams: Record<string, number>;
  /** Metrics from training period (in-sample) */
  inSampleMetrics: Record<OptimizationMetric, number>;
  /** Metrics from test period (out-of-sample) */
  outOfSampleMetrics: Record<OptimizationMetric, number>;
  /** Full backtest result from test period */
  testBacktest: BacktestResult;
};

/**
 * Walk-forward analysis result
 */
export type WalkForwardResult = {
  /** Results for each walk-forward period */
  periods: WalkForwardPeriod[];
  /** Aggregate metrics across all periods */
  aggregateMetrics: {
    /** Average in-sample metrics */
    avgInSample: Record<OptimizationMetric, number>;
    /** Average out-of-sample metrics */
    avgOutOfSample: Record<OptimizationMetric, number>;
    /** Stability ratio (out-of-sample / in-sample performance) */
    stabilityRatio: number;
  };
  /** Recommendation based on analysis */
  recommendation: {
    /** Whether optimized parameters are recommended */
    useOptimizedParams: boolean;
    /** Reason for recommendation */
    reason: string;
    /** Suggested parameters (if recommended) */
    suggestedParams?: Record<string, number>;
  };
};

/**
 * Options for walk-forward analysis
 */
export type WalkForwardOptions = {
  /** Training window size in candles (default: 252 for ~1 year daily) */
  windowSize?: number;
  /** Step size in candles (default: 63 for ~1 quarter daily) */
  stepSize?: number;
  /** Test period size in candles (default: 63 for ~1 quarter daily) */
  testSize?: number;
  /** Metric to optimize (default: "sharpe") */
  metric?: OptimizationMetric;
  /** Constraints to filter results */
  constraints?: OptimizationConstraint[];
  /** Progress callback */
  progressCallback?: (period: number, total: number) => void;
};
