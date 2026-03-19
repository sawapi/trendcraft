export { calculateVaR, rollingVaR } from "./var";
export type {
  VarMethod,
  VarOptions,
  VarResult,
  RollingVarOptions,
  RollingVarValue,
} from "./var";
export { riskParityAllocation, correlationAdjustedSize } from "./risk-parity";
export type {
  RiskParityOptions,
  RiskParityResult,
  CorrelationAdjustedSizeOptions,
  CorrelationAdjustedSizeResult,
} from "./risk-parity";

// Stress Testing
export {
  stressTest,
  runAllStressTests,
  generateShockedReturns,
  calculateMetricsFromReturns,
  PRESET_SCENARIOS,
} from "./stress-test";
export type {
  ReturnShock,
  StressScenario,
  StressTestResult,
  StressTestSummary,
} from "./stress-test";

// Deep Drawdown Analysis
export {
  drawdownDistribution,
  conditionalDrawdown,
  estimateRecoveryTime,
  ulcerPerformanceIndex,
} from "./drawdown-analysis";
export type {
  DrawdownBin,
  DrawdownDistribution,
  ConditionalDrawdownResult,
  RecoveryEstimate,
} from "./drawdown-analysis";
