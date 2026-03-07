/**
 * Signal detection utilities
 */

export {
  crossOver,
  crossUnder,
  goldenCross,
  deadCross,
  validateCrossSignals,
  type CrossOptions,
  type CrossValidationOptions,
  type CrossSignalQuality,
} from "./cross";

export {
  obvDivergence,
  rsiDivergence,
  macdDivergence,
  detectDivergence,
  type DivergenceSignal,
  type DivergenceOptions,
} from "./divergence";

export {
  bollingerSqueeze,
  type SqueezeSignal,
  type SqueezeOptions,
} from "./bollinger-squeeze";

export {
  perfectOrder,
  perfectOrderEnhanced,
  type PerfectOrderType,
  type PerfectOrderValue,
  type PerfectOrderOptions,
  // Enhanced mode types
  type SlopeDirection,
  type PerfectOrderState,
  type PerfectOrderValueEnhanced,
  type PerfectOrderOptionsEnhanced,
} from "./perfect-order";

export {
  rangeBound,
  type TrendReason,
  type RangeBoundState,
  type RangeBoundValue,
  type RangeBoundOptions,
} from "./range-bound";

export {
  volumeBreakout,
  type VolumeBreakoutSignal,
  type VolumeBreakoutOptions,
} from "./volume-breakout";

export {
  volumeAccumulation,
  type VolumeAccumulationSignal,
  type VolumeAccumulationOptions,
} from "./volume-accumulation";

export {
  volumeMaCross,
  type VolumeMaCrossSignal,
  type VolumeMaCrossOptions,
} from "./volume-ma-cross";

export {
  volumeAboveAverage,
  type VolumeAboveAverageSignal,
  type VolumeAboveAverageOptions,
} from "./volume-above-average";

// Candlestick Patterns
export {
  candlestickPatterns,
  type CandlestickPattern,
  type CandlestickPatternName,
  type CandlestickPatternOptions,
  type CandlestickPatternValue,
} from "./candlestick";

// Trade Signal Converters
export {
  fromCrossSignal,
  fromDivergenceSignal,
  fromSqueezeSignal,
  fromPatternSignal,
  fromScoreResult,
  fromPipelineResult,
} from "./trade-signal";

// Price Pattern Recognition
export {
  doubleTop,
  doubleBottom,
  headAndShoulders,
  inverseHeadAndShoulders,
  cupWithHandle,
  type PatternType,
  type PatternKeyPoint,
  type PatternNeckline,
  type PatternSignal,
  type DoublePatternOptions,
  type HeadShouldersOptions,
  type CupHandleOptions,
} from "./patterns";

// Signal Lifecycle
export {
  createSignalManager,
  processSignalsBatch,
  type SignalState,
  type ManagedSignal,
  type CooldownConfig,
  type DebounceConfig,
  type ExpiryConfig,
  type SignalKeyFn,
  type SignalManagerOptions,
  type SignalManagerState,
  type SignalManager,
} from "./lifecycle";
