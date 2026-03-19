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
  /** P-value: probability of achieving original result by chance */
  pValue: {
    sharpe: number;
    returns: number;
  };
  /** Confidence interval for expected performance */
  confidenceInterval: {
    sharpe: { lower: number; upper: number };
    returns: { lower: number; upper: number };
    maxDrawdown: { lower: number; upper: number };
  };
  /** Assessment of whether strategy is statistically significant */
  assessment: {
    isSignificant: boolean;
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
