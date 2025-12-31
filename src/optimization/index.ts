/**
 * Optimization Module
 *
 * Provides tools for backtest optimization including grid search
 * and walk-forward analysis.
 */

// Types
export type {
  ParameterRange,
  OptimizationMetric,
  OptimizationConstraint,
  OptimizationResultEntry,
  GridSearchResult,
  GridSearchOptions,
  WalkForwardPeriod,
  WalkForwardResult,
  WalkForwardOptions,
  // Monte Carlo
  MonteCarloOptions,
  MonteCarloResult,
  MetricStatistics,
  // Anchored Walk-Forward
  AnchoredWalkForwardOptions,
  AWFPeriod,
  AWFResult,
} from "../types/optimization";

// Metrics
export {
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateMAR,
  calculateRecoveryFactor,
  annualizeReturn,
  calculateAllMetrics,
  calculateDailyReturns,
  extractTradeReturns,
  getMetricValue,
  checkConstraint,
} from "./metrics";

// Grid Search
export {
  gridSearch,
  generateParameterCombinations,
  countCombinations,
  param,
  constraint,
  getTopResults,
  summarizeGridSearch,
} from "./grid-search";
export type { StrategyFactory } from "./grid-search";

// Walk-Forward Analysis
export {
  walkForwardAnalysis,
  calculatePeriodCount,
  generatePeriodBoundaries,
  summarizeWalkForward,
  getOutOfSampleEquityCurve,
} from "./walkforward";

// Combination Search
export {
  combinationSearch,
  generateCombinations,
  countTotalCombinations,
  getTopCombinations,
  formatCombinationResult,
  summarizeCombinationSearch,
  createEntryConditionPool,
  createExitConditionPool,
} from "./combination-search";
export type {
  ConditionDefinition,
  CombinationResultEntry,
  CombinationSearchResult,
  CombinationSearchOptions,
} from "./combination-search";

// Monte Carlo Simulation
export {
  runMonteCarloSimulation,
  calculateStatistics,
  formatMonteCarloResult,
  summarizeMonteCarloResult,
} from "./monte-carlo";

// Anchored Walk-Forward Analysis
export {
  anchoredWalkForwardAnalysis,
  generateAWFBoundaries,
  calculateAWFPeriodCount,
  summarizeAWFResult,
  formatAWFResult,
  getAWFEquityCurve,
} from "./anchored-walkforward";
