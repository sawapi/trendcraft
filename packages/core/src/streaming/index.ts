/**
 * Streaming Module
 *
 * Real-time trading infrastructure for TrendCraft.
 * Provides tick-to-candle aggregation, incremental signal detection,
 * condition evaluation, pipeline orchestration, and session management.
 */

// Phase 1: Candle aggregation
export { createCandleAggregator } from "./candle-aggregator";
export { createCandleResampler } from "./candle-resampler";
export type {
  RegimeFilterOptions,
  RegimeMultipliers,
  ValueExtractor,
  VolatilityLevel,
} from "./conditions";
// Phase 3: Conditions
export {
  adxRising,
  // DMI/ADX
  adxStrong,
  and,
  // Volatility
  atrPercentAbove,
  atrPercentBelow,
  // Bollinger
  bollingerBreakout,
  bollingerExpansion,
  bollingerSqueeze,
  bollingerTouch,
  cmfAbove,
  cmfBelow,
  crossOver,
  crossUnder,
  dmiBearish,
  dmiBullish,
  dmiCrossDown,
  dmiCrossUp,
  // Donchian
  donchianBreakoutHigh,
  donchianBreakoutLow,
  donchianMiddleCrossDown,
  donchianMiddleCrossUp,
  evaluateStreamingCondition,
  getField,
  getNumber,
  getRegimeSizeMultiplier,
  ichimokuBearish,
  ichimokuBullish,
  indicatorAbove,
  indicatorBelow,
  // Keltner
  keltnerBreakout,
  keltnerSqueeze,
  keltnerTouch,
  macdCrossDown,
  // MACD
  macdCrossUp,
  macdHistogramFalling,
  macdHistogramRising,
  macdNegative,
  macdPositive,
  newHigh,
  newLow,
  not,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  obvRising,
  or,
  perfectOrderBearish,
  // Perfect Order
  perfectOrderBullish,
  perfectOrderCollapsed,
  perfectOrderForming,
  priceAbove,
  priceBelow,
  // Price
  priceDroppedAtr,
  priceGainedAtr,
  regimeFilter,
  resolveNumber,
  rsiAbove,
  rsiBelow,
  sarFlip,
  smaDeadCross,
  smaGoldenCross,
  stochAbove,
  // Stochastics
  stochBelow,
  stochCrossDown,
  stochCrossUp,
  supertrendBearish,
  // Trend
  supertrendBullish,
  supertrendFlip,
  volatilityContracting,
  volatilityExpanding,
  // Volume
  volumeAboveAvg,
} from "./conditions";
export type {
  BlackoutPeriod,
  BlockedEvent,
  ForceCloseEvent,
  GuardedSessionOptions,
  GuardedSessionState,
  GuardedTradingSession,
  PortfolioExposure,
  PortfolioGuard,
  PortfolioGuardCheckResult,
  PortfolioGuardOptions,
  PortfolioGuardState,
  RiskGuard,
  RiskGuardCheckResult,
  RiskGuardOptions,
  RiskGuardState,
  TimeGuard,
  TimeGuardCheckResult,
  TimeGuardOptions,
  TimeGuardState,
  TradingWindow,
} from "./guards";
// Phase 5: Guards (Risk Management & Time Control)
export {
  createGuardedSession,
  createPortfolioGuard,
  createRiskGuard,
  createTimeGuard,
} from "./guards";
export type { IndicatorCategory, IndicatorPreset, ParamSchema } from "./indicator-presets";
// Unified indicator presets (static compute + incremental factory)
export { getIndicatorPreset, indicatorPresets } from "./indicator-presets";
// LiveCandle (lightweight live candle + indicator manager)
export { createLiveCandle } from "./live-candle";
export type { LivePreset } from "./live-presets";
// Live indicator presets (factory + metadata + defaults)
export { livePresets } from "./live-presets";
export type { StreamingMtfOptions } from "./mtf";
export { createStreamingMtf } from "./mtf";
// Phase 3: Pipeline & MTF
export { createPipeline } from "./pipeline";
export type {
  AccountState,
  ClosedTradeResult,
  FillRecord,
  ManagedEvent,
  ManagedPosition,
  ManagedSession,
  ManagedSessionState,
  OpenPositionOptions,
  PositionEvent,
  PositionManagerOptions,
  PositionSizingConfig,
  PositionTracker,
  PositionTrackerOptions,
  PositionTrackerState,
  UpdatePriceResult,
} from "./position-manager";
// Phase 6: Position Management
export {
  createManagedSession,
  createPositionTracker,
} from "./position-manager";
// Phase 4: Session
export { createTradingSession } from "./session";
export type { SignalEmitter, SignalEmitterOptions } from "./signal-emitter";
// Signal Emitter
export { createSignalEmitter } from "./signal-emitter";
export type { DivergenceDetectorOptions, SqueezeDetectorOptions } from "./signals";
// Phase 2: Signal detectors
export {
  createCrossOverDetector,
  createCrossUnderDetector,
  createDivergenceDetector,
  createSqueezeDetector,
  createThresholdDetector,
} from "./signals";
// Types
export type {
  CandleAggregator,
  CandleAggregatorOptions,
  CandleAggregatorState,
  CandleResampler,
  CandleResamplerOptions,
  CandleResamplerState,
  CrossDetector,
  CrossDetectorState,
  DivergenceDetector,
  DivergenceDetectorState,
  DivergenceResult,
  IndicatorSnapshot,
  LiveCandle,
  LiveCandleCompleteEvent,
  LiveCandleEventMap,
  LiveCandleOptions,
  LiveCandleState,
  LiveIndicatorFactory,
  LiveTickEvent,
  MtfSnapshot,
  PipelineIndicatorConfig,
  PipelineOptions,
  PipelineResult,
  PipelineState,
  SessionEvent,
  SessionOptions,
  SessionState,
  SqueezeDetector,
  SqueezeDetectorState,
  StreamingCombinedCondition,
  StreamingCondition,
  StreamingConditionFn,
  StreamingMtf,
  StreamingMtfState,
  StreamingMtfTimeframeConfig,
  StreamingPipeline,
  StreamingPresetCondition,
  ThresholdDetector,
  ThresholdDetectorState,
  Trade,
  TradingSession,
} from "./types";
