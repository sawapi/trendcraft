/**
 * Streaming Module
 *
 * Real-time trading infrastructure for TrendCraft.
 * Provides tick-to-candle aggregation, incremental signal detection,
 * condition evaluation, pipeline orchestration, and session management.
 */

// Types
export type {
  Trade,
  CandleAggregator,
  CandleAggregatorOptions,
  CandleAggregatorState,
  CandleResampler,
  CandleResamplerOptions,
  CandleResamplerState,
  CrossDetector,
  CrossDetectorState,
  ThresholdDetector,
  ThresholdDetectorState,
  SqueezeDetector,
  SqueezeDetectorState,
  DivergenceDetector,
  DivergenceDetectorState,
  DivergenceResult,
  IndicatorSnapshot,
  StreamingConditionFn,
  StreamingPresetCondition,
  StreamingCombinedCondition,
  StreamingCondition,
  PipelineIndicatorConfig,
  PipelineOptions,
  PipelineResult,
  PipelineState,
  StreamingPipeline,
  StreamingMtfTimeframeConfig,
  StreamingMtfState,
  MtfSnapshot,
  StreamingMtf,
  SessionEvent,
  SessionOptions,
  SessionState,
  TradingSession,
} from "./types";

// Phase 1: Candle aggregation
export { createCandleAggregator } from "./candle-aggregator";
export { createCandleResampler } from "./candle-resampler";

// Phase 2: Signal detectors
export {
  createCrossOverDetector,
  createCrossUnderDetector,
  createThresholdDetector,
  createSqueezeDetector,
  createDivergenceDetector,
} from "./signals";
export type { SqueezeDetectorOptions } from "./signals";
export type { DivergenceDetectorOptions } from "./signals";

// Phase 3: Conditions
export {
  and,
  or,
  not,
  evaluateStreamingCondition,
  rsiBelow,
  rsiAbove,
  smaGoldenCross,
  smaDeadCross,
  macdPositive,
  macdNegative,
  priceAbove,
  priceBelow,
  indicatorAbove,
  indicatorBelow,
} from "./conditions";

// Phase 3: Pipeline & MTF
export { createPipeline } from "./pipeline";
export { createStreamingMtf } from "./mtf";
export type { StreamingMtfOptions } from "./mtf";

// Phase 4: Session
export { createTradingSession } from "./session";
