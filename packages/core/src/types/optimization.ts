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
  /**
   * Best parameters found, or `null` if no combination satisfied the
   * configured constraints. Previously fell back to `{}`, which was
   * indistinguishable from the legitimate "no params to optimize"
   * case (empty `parameterRanges`). Use `result.bestParams ?? {}` to
   * preserve the prior behavior in callers that don't care about the
   * distinction.
   */
  bestParams: Record<string, number> | null;
  /**
   * Best score achieved, or `null` if no combination satisfied the
   * configured constraints. Previously fell back to `0`, which callers
   * mistook as "the optimum is zero". Use `result.bestScore ?? 0` to
   * preserve the prior behavior.
   */
  bestScore: number | null;
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
  /**
   * Structural validity predicate for a parameter combination. When
   * provided, combinations it rejects are skipped *before* backtesting —
   * they never run, never enter `results`, and don't count toward
   * `validCombinations`. Use it for cross-parameter invariants that no
   * per-field range can express (e.g. `shortPeriod < longPeriod`), the
   * exhaustive-grid analogue of vectorbt's parameter mask. The metric
   * `constraints` above filter *after* backtesting on realized metrics;
   * this filters *before*, on the parameters themselves.
   */
  paramFilter?: (params: Record<string, number>) => boolean;
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
  /**
   * Structural validity predicate for a parameter combination, forwarded
   * to each window's internal {@link GridSearchOptions.paramFilter}.
   * Combinations it rejects are never optimized in any window, so a
   * structurally-invalid set (e.g. `shortPeriod >= longPeriod`) can't be
   * chosen as a window's best parameters.
   */
  paramFilter?: (params: Record<string, number>) => boolean;
};

// ============================================
// Monte Carlo Simulation Types
// ============================================

/**
 * Monte Carlo simulation options
 */
export type MonteCarloOptions = {
  /** Number of simulations to run (default: 1000) */
  simulations?: number;
  /** Random seed for reproducibility (optional) */
  seed?: number;
  /** Confidence level for percentile calculations (default: 0.95) */
  confidenceLevel?: number;
  /**
   * Resampling method (default: `"bootstrap"`).
   *
   * - `"bootstrap"`: draw N trades with replacement. The same trade can
   *   appear multiple times or not at all, so total return, Sharpe, and
   *   profit factor all vary across simulations — the basis for
   *   outcome-uncertainty estimates (return distribution, probability of
   *   loss). This is the canonical method for "how reliable is this
   *   edge?".
   * - `"shuffle"`: permute the existing trades (no replacement). The
   *   multiset of returns is unchanged, so total return / Sharpe /
   *   profit factor are identical across simulations and only the
   *   path-dependent max drawdown varies. Use this to study sequence
   *   risk (clustering of losing trades) specifically.
   */
  method?: "shuffle" | "bootstrap";
  /**
   * Drawdown level (as a positive percent) treated as "ruin" for the
   * {@link MonteCarloResult.downside}.`riskOfRuin` figure. A simulation
   * counts toward risk of ruin when its path-dependent max drawdown
   * reaches or exceeds this level. Default `50` (a 50% peak-to-trough
   * loss), matching the threshold used by mainstream backtest Monte
   * Carlo tooling (BuildAlpha, AmiBroker).
   */
  ruinThreshold?: number;
  /** Progress callback */
  progressCallback?: (current: number, total: number) => void;
};

/**
 * Statistical summary for a metric
 */
export type MetricStatistics = {
  /** Mean value */
  mean: number;
  /** Median value */
  median: number;
  /** Standard deviation */
  stdDev: number;
  /** 5th percentile */
  percentile5: number;
  /** 25th percentile (Q1) */
  percentile25: number;
  /** 75th percentile (Q3) */
  percentile75: number;
  /** 95th percentile */
  percentile95: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
};

/**
 * Monte Carlo simulation result
 */
export type MonteCarloResult = {
  /** Original backtest result for comparison */
  originalResult: {
    sharpe: number;
    maxDrawdown: number;
    totalReturnPercent: number;
    profitFactor: number;
  };
  /** Statistics for each metric across simulations */
  statistics: {
    sharpe: MetricStatistics;
    maxDrawdown: MetricStatistics;
    totalReturnPercent: MetricStatistics;
    profitFactor: MetricStatistics;
  };
  /** Number of simulations run */
  simulationCount: number;
  /**
   * Downside-risk summary measured directly on the resampled outcomes —
   * the headline figures for "how risky is this edge?". These replace
   * the previous permutation-test `pValue` / `isSignificant` framing,
   * which forced a binary significance verdict onto a resampling
   * distribution and compared mismatched Sharpe formulas. The
   * distribution-based figures below are what mainstream backtest Monte
   * Carlo tooling reports (StrategyQuant, AmiBroker, BuildAlpha).
   */
  downside: {
    /** Fraction of simulations that ended profitable (total return > 0). */
    probProfit: number;
    /** Fraction of simulations that lost money (total return ≤ 0) = `1 - probProfit`. */
    probLoss: number;
    /**
     * Fraction of simulations whose path-dependent max drawdown reached
     * or exceeded {@link ruinThreshold}. Meaningful under both methods
     * (drawdown is path-dependent), unlike `probLoss` which collapses to
     * 0/1 under `"shuffle"` because the return multiset is fixed.
     */
    riskOfRuin: number;
    /** Drawdown level (positive percent) used as the ruin threshold. */
    ruinThreshold: number;
  };
  /** Confidence interval for expected performance */
  confidenceInterval: {
    sharpe: { lower: number; upper: number };
    returns: { lower: number; upper: number };
    maxDrawdown: { lower: number; upper: number };
  };
  /**
   * Human-readable, method-aware interpretation of the distribution. No
   * binary significance flag — bootstrap describes outcome uncertainty
   * (profitability + ruin), shuffle describes sequence risk (drawdown).
   */
  assessment: {
    reason: string;
    confidenceLevel: number;
  };
};

// ============================================
// Anchored Walk-Forward Types
// ============================================

// ============================================
// Pareto (Multi-Objective) Optimization Types
// ============================================

/**
 * Single objective for Pareto optimization
 */
export type ParetoObjective = {
  /** Metric to optimize */
  metric: OptimizationMetric;
  /** Direction of optimization */
  direction: "maximize" | "minimize";
};

/**
 * Options for Pareto optimization
 */
export type ParetoOptions = {
  /** Objectives to optimize (2-4) */
  objectives: ParetoObjective[];
  /** Constraints to filter results */
  constraints?: OptimizationConstraint[];
  /** Maximum combinations to test (default: 10000) */
  maxCombinations?: number;
  /** Progress callback */
  progressCallback?: (current: number, total: number) => void;
};

/**
 * Single result entry with Pareto front information
 */
export type ParetoResultEntry = OptimizationResultEntry & {
  /** Pareto front index (0 = first front / non-dominated) */
  frontIndex: number;
  /** Crowding distance for diversity preservation */
  crowdingDistance: number;
};

/**
 * Pareto optimization result
 */
export type ParetoResult = {
  /** Solutions on the first Pareto front (non-dominated) */
  paretoFront: ParetoResultEntry[];
  /** All evaluated solutions with front assignments */
  allResults: ParetoResultEntry[];
  /** Objectives used */
  objectives: ParetoObjective[];
  /** Total parameter combinations evaluated */
  totalCombinations: number;
  /** Combinations that passed constraints */
  validCombinations: number;
};

/**
 * Anchored Walk-Forward options
 */
export type AnchoredWalkForwardOptions = {
  /** Training start date (epoch ms) - fixed anchor point */
  anchorDate: number;
  /** Initial training period size in candles (default: 504 for ~2 years) */
  initialTrainSize?: number;
  /** Training period expansion step in candles (default: 252 for ~1 year) */
  expansionStep?: number;
  /** Test period size in candles (default: 252 for ~1 year) */
  testSize?: number;
  /** Metric to optimize (default: "sharpe") */
  metric?: OptimizationMetric;
  /** Constraints for optimization */
  constraints?: OptimizationConstraint[];
  /** Progress callback */
  progressCallback?: (period: number, total: number, phase: "train" | "test") => void;
};

/**
 * Anchored Walk-Forward period result
 */
export type AWFPeriod = {
  /** Period number (1-indexed) */
  periodNumber: number;
  /** Training period start timestamp */
  trainStart: number;
  /** Training period end timestamp */
  trainEnd: number;
  /** Training candle count */
  trainCandleCount: number;
  /** Test period start timestamp */
  testStart: number;
  /** Test period end timestamp */
  testEnd: number;
  /** Test candle count */
  testCandleCount: number;
  /** Best entry conditions found */
  bestEntryConditions: string[];
  /** Best exit conditions found */
  bestExitConditions: string[];
  /** In-sample metrics */
  inSampleMetrics: Record<OptimizationMetric, number>;
  /** Out-of-sample metrics */
  outOfSampleMetrics: Record<OptimizationMetric, number>;
  /** Full backtest result from test period */
  testBacktest: BacktestResult;
};

/**
 * Anchored Walk-Forward analysis result
 */
export type AWFResult = {
  /** Results for each AWF period */
  periods: AWFPeriod[];
  /** Aggregate performance metrics */
  aggregateMetrics: {
    /** Average in-sample metrics across all periods */
    avgInSample: Record<OptimizationMetric, number>;
    /** Average out-of-sample metrics across all periods */
    avgOutOfSample: Record<OptimizationMetric, number>;
    /** Stability ratio (OOS / IS performance) */
    stabilityRatio: number;
    /** Standard deviation of OOS returns */
    oosReturnStdDev: number;
  };
  /** Stability analysis */
  stabilityAnalysis: {
    /** How often each condition appears in best results (percentage) */
    conditionFrequency: Record<string, number>;
    /** Most stable entry conditions (appear in >50% of periods) */
    stableEntryConditions: string[];
    /** Most stable exit conditions (appear in >50% of periods) */
    stableExitConditions: string[];
    /** Consistency score (0-100) */
    consistencyScore: number;
  };
  /** Final recommendation */
  recommendation: {
    /** Whether to use optimized conditions */
    useOptimized: boolean;
    /** Recommended entry conditions */
    entryConditions: string[];
    /** Recommended exit conditions */
    exitConditions: string[];
    /** Reason for recommendation */
    reason: string;
  };
};
