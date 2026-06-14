/**
 * Signal detection and pattern recognition
 *
 * **Cross signals**: Golden/Dead cross detection with quality validation
 * **Divergence**: RSI, MACD, OBV divergence detection (bullish/bearish)
 * **Bollinger Squeeze**: Volatility contraction signals
 * **Perfect Order**: Multi-MA alignment detection (bullish/bearish)
 * **Range-Bound**: Detect consolidation zones and breakout risk
 * **Volume signals**: Volume breakout, accumulation, MA cross
 * **Candlestick patterns**: 20+ single/double/triple candle patterns
 * **Price patterns**: Double top/bottom, head & shoulders, cup with handle
 * **Signal lifecycle**: Cooldown, debounce, expiry management
 * **Trade signal converters**: Convert any signal to unified TradeSignal format
 */

export {
  bollingerSqueeze,
  type SqueezeOptions,
  type SqueezeSignal,
} from "./bollinger-squeeze";
// Candlestick Patterns
export {
  type CandlestickPattern,
  type CandlestickPatternName,
  type CandlestickPatternOptions,
  type CandlestickPatternValue,
  candlestickPatterns,
} from "./candlestick";
// Coaching
export {
  type CoachingDirection,
  type CoachingOptions,
  type CoachingSeverity,
  type CoachingSignal,
  detectCoachingSignals,
} from "./coaching";
export {
  type CrossOptions,
  type CrossSignalQuality,
  type CrossValidationOptions,
  crossOver,
  crossUnder,
  deadCross,
  goldenCross,
  validateCrossSignals,
} from "./cross";
export { cvdDivergence } from "./cvd-divergence";
export {
  type DivergenceClass,
  type DivergenceOptions,
  type DivergenceSignal,
  detectDivergence,
  macdDivergence,
  obvDivergence,
  rsiDivergence,
} from "./divergence";
// Signal Lifecycle
export {
  type CooldownConfig,
  createSignalManager,
  type DebounceConfig,
  type ExpiryConfig,
  type ManagedSignal,
  processSignalsBatch,
  type SignalKeyFn,
  type SignalManager,
  type SignalManagerOptions,
  type SignalManagerState,
  type SignalState,
} from "./lifecycle";
// Price Pattern Recognition
export {
  type ChannelOptions,
  type CupHandleOptions,
  classifyTrendlinePair,
  cupWithHandle,
  type DoublePatternOptions,
  detectChannel,
  detectFlag,
  detectHarmonicPatterns,
  detectTriangle,
  detectWedge,
  doubleBottom,
  doubleTop,
  type FlagOptions,
  filterPatterns,
  fitTrendline,
  fitTrendlinePair,
  type HarmonicPatternOptions,
  type HarmonicPatternType,
  type HeadShouldersOptions,
  headAndShoulders,
  inverseHeadAndShoulders,
  type PatternFilterOptions,
  type PatternKeyPoint,
  type PatternNeckline,
  type PatternSignal,
  type PatternType,
  type TrendlineFit,
  type TrendlinePairType,
  type TriangleOptions,
  type WedgeOptions,
} from "./patterns";
export {
  type PerfectOrderOptions,
  type PerfectOrderOptionsEnhanced,
  type PerfectOrderState,
  type PerfectOrderType,
  type PerfectOrderValue,
  type PerfectOrderValueEnhanced,
  perfectOrder,
  perfectOrderEnhanced,
  // Enhanced mode types
  type SlopeDirection,
} from "./perfect-order";
export {
  type RangeBoundOptions,
  type RangeBoundState,
  type RangeBoundValue,
  rangeBound,
  type TrendReason,
} from "./range-bound";
// Trade Signal Converters
export {
  fromCrossSignal,
  fromDivergenceSignal,
  fromPatternSignal,
  fromPipelineResult,
  fromScoreResult,
  fromSqueezeSignal,
} from "./trade-signal";
export {
  type VolumeAboveAverageOptions,
  type VolumeAboveAverageSignal,
  volumeAboveAverage,
} from "./volume-above-average";
export {
  type VolumeAccumulationOptions,
  type VolumeAccumulationSignal,
  volumeAccumulation,
} from "./volume-accumulation";
export {
  type VolumeBreakoutOptions,
  type VolumeBreakoutSignal,
  volumeBreakout,
} from "./volume-breakout";
export {
  type VolumeMaCrossOptions,
  type VolumeMaCrossSignal,
  volumeMaCross,
} from "./volume-ma-cross";
