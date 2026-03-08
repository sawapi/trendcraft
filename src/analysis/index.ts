/**
 * Trade Analysis Module
 *
 * Provides comprehensive analysis functions for evaluating trading performance.
 */

export {
  // Main analysis functions
  calculateTradeStats,
  analyzeByExitReason,
  analyzeByHoldingPeriod,
  analyzeByTime,
  analyzeMfeMae,
  analyzeStreaks,
  analyzeAllTrades,
  // Types
  type TradeStats,
  type ExitReasonAnalysis,
  type HoldingPeriodAnalysis,
  type TimeAnalysis,
  type MfeMaeAnalysis,
  type StreakAnalysis,
  type TradeAnalysis,
} from "./edge-analysis";

// Runtime Metrics
export { calculateRuntimeMetrics } from "./runtime-metrics";
export type { RuntimeMetrics, RuntimeMetricsOptions } from "./runtime-metrics";

// Market Regime Detection
export { detectMarketRegime } from "./market-regime";
export type { MarketRegimeResult, MarketRegimeOptions } from "./market-regime";

// Drawdown Analysis
export { analyzeDrawdowns } from "./drawdown-analysis";
export type { DrawdownSummary } from "./drawdown-analysis";

// Pattern Projection Analysis
export {
  projectPatternOutcome,
  projectFromSeries,
  projectFromPatterns,
} from "./pattern-projection";
export type {
  PatternProjectionOptions,
  HitRate,
  PatternProjection,
  EventExtractor,
} from "./pattern-projection-types";
