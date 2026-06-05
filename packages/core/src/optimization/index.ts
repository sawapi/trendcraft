/**
 * Optimization Module
 *
 * Provides tools for backtest optimization including grid search
 * and walk-forward analysis.
 */

// Types
export type {
  // Anchored Walk-Forward
  AnchoredWalkForwardOptions,
  AWFPeriod,
  AWFResult,
  GridSearchOptions,
  GridSearchResult,
  MetricStatistics,
  // Monte Carlo
  MonteCarloOptions,
  MonteCarloResult,
  OptimizationConstraint,
  OptimizationMetric,
  OptimizationResultEntry,
  ParameterRange,
  // Pareto
  ParetoObjective,
  ParetoOptions,
  ParetoResult,
  ParetoResultEntry,
  WalkForwardOptions,
  WalkForwardPeriod,
  WalkForwardResult,
} from "../types/optimization";
// Anchored Walk-Forward Analysis
export {
  anchoredWalkForwardAnalysis,
  anchoredWalkForwardAnalysisSafe,
  calculateAWFPeriodCount,
  formatAWFResult,
  generateAWFBoundaries,
  getAWFEquityCurve,
  summarizeAWFResult,
} from "./anchored-walkforward";
export type {
  CombinationResultEntry,
  CombinationSearchOptions,
  CombinationSearchResult,
  ConditionDefinition,
} from "./combination-search";
// Combination Search
export {
  combinationSearch,
  countTotalCombinations,
  generateCombinations,
} from "./combination-search";
// Condition Pools & Combination Search Utilities
export {
  combinationSearchSafe,
  createEntryConditionPool,
  createExitConditionPool,
  formatCombinationResult,
  getTopCombinations,
  summarizeCombinationSearch,
} from "./condition-pools";
export type { StrategyFactory } from "./grid-search";
// Grid Search
export {
  constraint,
  countCombinations,
  GRID_SEARCH_EPSILON_FACTOR,
  generateParameterCombinations,
  getTopResults,
  gridSearch,
  gridSearchSafe,
  param,
  summarizeGridSearch,
} from "./grid-search";
export type { PathParameterRange } from "./grid-search-json";
// Grid Search — JSON-first wrapper
export { gridSearchFromJSON, gridSearchFromJSONSafe } from "./grid-search-json";
// Metrics
export {
  annualizeReturn,
  calculateAllMetrics,
  calculateCalmarRatio,
  calculateDailyReturns,
  calculateMAR,
  calculateRecoveryFactor,
  calculateSharpeRatio,
  checkConstraint,
  extractTradeReturns,
  getMetricValue,
} from "./metrics";
// Monte Carlo Simulation
export {
  calculateStatistics,
  formatMonteCarloResult,
  runMonteCarloSimulation,
  runMonteCarloSimulationSafe,
  summarizeMonteCarloResult,
} from "./monte-carlo";
// Pareto (Multi-Objective) Optimization
export {
  crowdingDistance,
  fastNonDominatedSort,
  paretoOptimization,
  paretoOptimizationSafe,
  summarizeParetoResult,
} from "./pareto";
export type {
  DnaGrade,
  DnaGradeItem,
  DnaGradeReport,
  GenomeSegment,
  RecommendedParams,
  SafeZone,
  SensitivityData,
  SensitivityPair,
  SensitivitySingle,
} from "./strategy-dna";
// Strategy DNA — post-optimization analytics
export {
  buildGenomeSegments,
  computeDnaGrade,
  computeRecommendedParams,
  extractSensitivityData,
} from "./strategy-dna";
// Walk-Forward Analysis
export {
  calculatePeriodCount,
  generatePeriodBoundaries,
  getOutOfSampleEquityCurve,
  stitchOosEquity,
  summarizeWalkForward,
  walkForwardAnalysis,
  walkForwardAnalysisSafe,
  wfeRatio,
} from "./walkforward";
// Walk-Forward — JSON-first wrapper
export {
  walkForwardAnalysisFromJSON,
  walkForwardAnalysisFromJSONSafe,
} from "./walkforward-json";
