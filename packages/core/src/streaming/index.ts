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
  LiveIndicatorFactory,
  LiveCandleOptions,
  LiveTickEvent,
  LiveCandleCompleteEvent,
  LiveCandleEventMap,
  LiveCandleState,
  LiveCandle,
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
  dmiBullish,
  dmiBearish,
  regimeFilter,
  getRegimeSizeMultiplier,
  getNumber,
  getField,
  resolveNumber,
  crossOver,
  crossUnder,
  // Bollinger
  bollingerBreakout,
  bollingerTouch,
  bollingerSqueeze,
  bollingerExpansion,
  // Stochastics
  stochBelow,
  stochAbove,
  stochCrossUp,
  stochCrossDown,
  // MACD
  macdCrossUp,
  macdCrossDown,
  macdHistogramRising,
  macdHistogramFalling,
  // DMI/ADX
  adxStrong,
  adxRising,
  dmiCrossUp,
  dmiCrossDown,
  // Volume
  volumeAboveAvg,
  cmfAbove,
  cmfBelow,
  obvRising,
  obvFalling,
  obvCrossUp,
  obvCrossDown,
  // Volatility
  atrPercentAbove,
  atrPercentBelow,
  volatilityExpanding,
  volatilityContracting,
  // Trend
  supertrendBullish,
  supertrendBearish,
  supertrendFlip,
  ichimokuBullish,
  ichimokuBearish,
  sarFlip,
  // Price
  priceDroppedAtr,
  priceGainedAtr,
  newHigh,
  newLow,
  // Perfect Order
  perfectOrderBullish,
  perfectOrderBearish,
  perfectOrderForming,
  perfectOrderCollapsed,
  // Keltner
  keltnerBreakout,
  keltnerTouch,
  keltnerSqueeze,
  // Donchian
  donchianBreakoutHigh,
  donchianBreakoutLow,
  donchianMiddleCrossUp,
  donchianMiddleCrossDown,
} from "./conditions";
export type {
  ValueExtractor,
  VolatilityLevel,
  RegimeFilterOptions,
  RegimeMultipliers,
} from "./conditions";

// Phase 3: Pipeline & MTF
export { createPipeline } from "./pipeline";
export { createStreamingMtf } from "./mtf";
export type { StreamingMtfOptions } from "./mtf";

// Phase 4: Session
export { createTradingSession } from "./session";

// LiveCandle (lightweight live candle + indicator manager)
export { createLiveCandle } from "./live-candle";

// Live indicator presets (zero-config for connectLiveFeed)
export { livePresets } from "./live-presets";
export type { LivePreset } from "./live-presets";

// Phase 5: Guards (Risk Management & Time Control)
export {
  createRiskGuard,
  createTimeGuard,
  createGuardedSession,
  createPortfolioGuard,
} from "./guards";
export type {
  RiskGuardOptions,
  RiskGuardState,
  RiskGuardCheckResult,
  RiskGuard,
  TradingWindow,
  BlackoutPeriod,
  TimeGuardOptions,
  TimeGuardState,
  TimeGuardCheckResult,
  TimeGuard,
  PortfolioGuardOptions,
  PortfolioGuardState,
  PortfolioGuardCheckResult,
  PortfolioExposure,
  PortfolioGuard,
  GuardedSessionOptions,
  GuardedSessionState,
  BlockedEvent,
  ForceCloseEvent,
  GuardedTradingSession,
} from "./guards";

// Signal Emitter
export { createSignalEmitter } from "./signal-emitter";
export type { SignalEmitterOptions, SignalEmitter } from "./signal-emitter";

// Phase 6: Position Management
export {
  createPositionTracker,
  createManagedSession,
} from "./position-manager";
export type {
  ManagedPosition,
  AccountState,
  FillRecord,
  PositionSizingConfig,
  PositionManagerOptions,
  OpenPositionOptions,
  UpdatePriceResult,
  ClosedTradeResult,
  PositionTrackerState,
  PositionTracker,
  PositionTrackerOptions,
  PositionEvent,
  ManagedEvent,
  ManagedSessionState,
  ManagedSession,
} from "./position-manager";
