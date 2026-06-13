/**
 * Backtest module
 */

export type {
  ExtendedCondition,
  LiquiditySweepConditionOptions,
  OrderBlockConditionOptions,
  PatternConditionOptions,
  PerfectOrderConditionOptions,
  PerfectOrderEnhancedConditionOptions,
  RangeBoundConditionOptions,
  RSConditionOptions,
  ValidatedCrossOptions,
} from "./conditions";
export {
  adxStrong,
  alwaysFalse,
  // Always-true / always-false primitives
  alwaysTrue,
  // Condition combinators
  and,
  anyBearishPattern,
  anyBullishPattern,
  anyPatternConfidenceAbove,
  // ATR% Filter conditions
  atrPercentAbove,
  atrPercentBelow,
  atrPercentileAbove,
  atrPercentileBelow,
  BENCHMARK_CACHE_KEY,
  bearFlagDetected,
  bearishHarmonicDetected,
  bearishVolumeDivergence,
  bollingerBreakout,
  bollingerTouch,
  breakdownVal,
  breakoutRiskDown,
  breakoutRiskUp,
  breakoutVah,
  bullFlagDetected,
  bullishHarmonicDetected,
  bullishVolumeDivergence,
  channelDetected,
  // CMF conditions
  cmfAbove,
  cmfBelow,
  cupHandleDetected,
  deadCross,
  dmiBearish,
  // DMI/ADX conditions
  dmiBullish,
  doubleBottomDetected,
  doubleTopDetected,
  // Evaluation helper
  evaluateCondition,
  flagDetected,
  getRequiredTimeframes,
  // Preset conditions
  goldenCross,
  harmonicPatternDetected,
  hasActiveOrderBlocks,
  hasRecentSweeps,
  headShouldersDetected,
  // Range-Bound (Box Range) conditions
  inRangeBound,
  inValueArea,
  inverseHeadShouldersDetected,
  liquiditySweepDetected,
  liquiditySweepRecovered,
  macdCrossDown,
  macdCrossUp,
  mansfieldRSAbove,
  mansfieldRSBelow,
  monthlyPriceAboveSma,
  monthlyPriceBelowSma,
  monthlyRsiAbove,
  monthlyRsiBelow,
  monthlyTrendStrong,
  mtfCondition,
  mtfDowntrend,
  mtfPriceAboveEma,
  mtfPriceAboveSma,
  mtfPriceBelowSma,
  mtfRsiAbove,
  mtfRsiBelow,
  mtfTrendStrong,
  mtfUptrend,
  nearPoc,
  not,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  // OBV conditions
  obvRising,
  or,
  orderBlockCreated,
  orderBlockMitigated,
  outperformanceAbove,
  outperformanceBelow,
  patternConfidenceAbove,
  patternConfirmed,
  // Price Pattern conditions
  patternDetected,
  patternWithinBars,
  pbEntry,
  pbrAbove,
  pbrBelow,
  pbrBetween,
  perAbove,
  // Fundamental conditions (PER/PBR)
  perBelow,
  perBetween,
  perfectOrderActiveBearish,
  perfectOrderActiveBullish,
  perfectOrderBearish,
  perfectOrderBearishConfirmed,
  perfectOrderBreakdown,
  // Perfect Order conditions
  perfectOrderBullish,
  // Enhanced Perfect Order conditions
  perfectOrderBullishConfirmed,
  perfectOrderCollapsed,
  perfectOrderConfirmationFormed,
  perfectOrderMaCollapsed,
  perfectOrderPreBearish,
  perfectOrderPreBullish,
  // Perfect Order Pullback conditions
  perfectOrderPullbackEntry,
  perfectOrderPullbackSellEntry,
  // PO+ and PB entry conditions (using pre-computed flags)
  poPlusEntry,
  poPlusPbEntry,
  priceAbovePoc,
  priceAboveSma,
  priceAtBearishOrderBlock,
  // Smart Money Concepts (SMC) conditions
  priceAtBullishOrderBlock,
  priceAtOrderBlock,
  priceBelowPoc,
  priceBelowSma,
  priceDroppedAtr,
  rangeBreakout,
  rangeConfirmed,
  rangeForming,
  rangeScoreAbove,
  regimeConfidenceAbove,
  // Volatility Regime conditions
  regimeIs,
  regimeNot,
  // MTF helpers
  requiresMtf,
  // Relative Strength (RS) conditions
  rsAbove,
  rsBelow,
  rsFalling,
  rsiAbove,
  rsiBelow,
  rsNewHigh,
  rsNewLow,
  rsRatingAbove,
  rsRatingBelow,
  rsRising,
  setBenchmark,
  stochAbove,
  // Stochastics conditions
  stochBelow,
  stochCrossDown,
  stochCrossUp,
  sweepDepthAbove,
  tightRange,
  triangleDetected,
  validatedDeadCross,
  // Validated conditions (with damashi detection)
  validatedGoldenCross,
  volatilityAbove,
  volatilityBelow,
  volatilityContracting,
  volatilityExpanding,
  // Volume conditions
  volumeAboveAvg,
  // Advanced Volume conditions
  volumeAnomalyCondition,
  volumeConfirmsTrend,
  volumeDivergence,
  volumeExtreme,
  volumeRatioAbove,
  volumeTrendConfidence,
  wedgeDetected,
  weeklyDowntrend,
  weeklyPriceAboveEma,
  weeklyPriceAboveSma,
  weeklyPriceBelowSma,
  // Multi-Timeframe (MTF) conditions
  weeklyRsiAbove,
  weeklyRsiBelow,
  weeklyTrendStrong,
  weeklyUptrend,
} from "./conditions";

export { runBacktest } from "./engine";
// Volume Constraint (re-export from engine-utils)
export { applyVolumeConstraint } from "./engine-utils";
export type { MarginConfig, MarginState } from "./margin";
// Margin/Leverage
export {
  accrueInterest,
  calculateBuyingPower,
  checkMarginCall,
  createMarginState,
  repayLoan,
  updateMarginState,
} from "./margin";
export type {
  FillResult,
  LimitOrder,
  LimitPriceFunc,
  MarketOrder,
  OrderType,
  PendingOrder,
  StopLimitOrder,
  StopOrder,
  StopPriceFunc,
  TimeInForce,
} from "./order-types";

// Order Types (Limit/Stop)
export {
  limitAboveClose,
  limitAtHigh,
  limitAtLow,
  limitAtrAbove,
  limitAtrBelow,
  // Preset limit/stop strategies
  limitBelowClose,
  resolvePrice,
  resolveTimeInForce,
  stopAboveHigh,
  stopAtrAbove,
  stopAtrBelow,
  stopBelowLow,
  tryFillOrder,
} from "./order-types";
// Portfolio / Multi-Asset Backtest
export { batchBacktest, portfolioBacktest } from "./portfolio";
export type { ScaledBacktestOptions } from "./scaled-entry";
export { runBacktestScaled } from "./scaled-entry";
export type { BacktestScore, ScoreBreakdownEntry, ScoreOptions, ScoreWeights } from "./scoring";
// Scoring
export { scoreBacktestResult } from "./scoring";
export type {
  CompositeSlippageModel,
  FixedSlippageModel,
  SlippageModel,
  VolatilitySlippageModel,
  VolumeSlippageModel,
} from "./slippage-model";
// Dynamic Slippage Model
export { calculateDynamicSlippage, resolveSlippageModel } from "./slippage-model";
