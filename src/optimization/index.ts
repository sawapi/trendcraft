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
  // Pareto
  ParetoObjective,
  ParetoOptions,
  ParetoResultEntry,
  ParetoResult,
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
  gridSearchSafe,
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
  walkForwardAnalysisSafe,
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
} from "./combination-search";
export type {
  ConditionDefinition,
  CombinationResultEntry,
  CombinationSearchResult,
  CombinationSearchOptions,
} from "./combination-search";

// Condition Pools & Combination Search Utilities
export {
  combinationSearchSafe,
  getTopCombinations,
  formatCombinationResult,
  summarizeCombinationSearch,
  createEntryConditionPool,
  createExitConditionPool,
} from "./condition-pools";

// Monte Carlo Simulation
export {
  runMonteCarloSimulation,
  runMonteCarloSimulationSafe,
  calculateStatistics,
  formatMonteCarloResult,
  summarizeMonteCarloResult,
} from "./monte-carlo";

// Anchored Walk-Forward Analysis
export {
  anchoredWalkForwardAnalysis,
  anchoredWalkForwardAnalysisSafe,
  generateAWFBoundaries,
  calculateAWFPeriodCount,
  summarizeAWFResult,
  formatAWFResult,
  getAWFEquityCurve,
} from "./anchored-walkforward";

// Pareto (Multi-Objective) Optimization
export {
  paretoOptimization,
  paretoOptimizationSafe,
  fastNonDominatedSort,
  crowdingDistance,
  summarizeParetoResult,
} from "./pareto";
