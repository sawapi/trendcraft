/**
 * Trade Analysis Module
 *
 * Provides comprehensive analysis functions for evaluating trading performance.
 */

export type { BehaviorEquityPoint, BehaviorInsight } from "./behavior-insights";
// Behavior Insights
export { generateBehaviorInsights } from "./behavior-insights";
export type { DrawdownSummary } from "./drawdown-analysis";
// Drawdown Analysis
export { analyzeDrawdowns } from "./drawdown-analysis";
export {
  analyzeAllTrades,
  analyzeByExitReason,
  analyzeByHoldingPeriod,
  analyzeByTime,
  analyzeMfeMae,
  analyzeStreaks,
  // Main analysis functions
  calculateTradeStats,
  type ExitReasonAnalysis,
  type HoldingPeriodAnalysis,
  type MfeMaeAnalysis,
  type StreakAnalysis,
  type TimeAnalysis,
  type TradeAnalysis,
  // Types
  type TradeStats,
} from "./edge-analysis";
export type { MarketContext, MarketContextOptions } from "./market-context";
// Market Context
export { analyzeMarketContext } from "./market-context";
export type { MarketRegimeOptions, MarketRegimeResult } from "./market-regime";
// Market Regime Detection
export { detectMarketRegime } from "./market-regime";
// Pattern Projection Analysis
export {
  projectFromPatterns,
  projectFromSeries,
  projectPatternOutcome,
} from "./pattern-projection";
export type {
  EventExtractor,
  HitRate,
  PatternProjection,
  PatternProjectionOptions,
} from "./pattern-projection-types";
export type { RuntimeMetrics, RuntimeMetricsOptions } from "./runtime-metrics";
// Runtime Metrics
export { calculateRuntimeMetrics } from "./runtime-metrics";
