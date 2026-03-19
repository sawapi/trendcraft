/**
 * Backtest module
 */

export {
  // Condition combinators
  and,
  or,
  not,
  // Preset conditions
  goldenCross,
  deadCross,
  rsiBelow,
  rsiAbove,
  macdCrossUp,
  macdCrossDown,
  bollingerBreakout,
  bollingerTouch,
  priceAboveSma,
  priceBelowSma,
  priceDroppedAtr,
  // Validated conditions (with damashi detection)
  validatedGoldenCross,
  validatedDeadCross,
  // Perfect Order conditions
  perfectOrderBullish,
  perfectOrderBearish,
  perfectOrderCollapsed,
  perfectOrderActiveBullish,
  perfectOrderActiveBearish,
  // Enhanced Perfect Order conditions
  perfectOrderBullishConfirmed,
  perfectOrderBearishConfirmed,
  perfectOrderConfirmationFormed,
  perfectOrderBreakdown,
  perfectOrderMaCollapsed,
  perfectOrderPreBullish,
  perfectOrderPreBearish,
  // Perfect Order Pullback conditions
  perfectOrderPullbackEntry,
  perfectOrderPullbackSellEntry,
  // PO+ and PB entry conditions (using pre-computed flags)
  poPlusEntry,
  pbEntry,
  poPlusPbEntry,
  // Stochastics conditions
  stochBelow,
  stochAbove,
  stochCrossUp,
  stochCrossDown,
  // DMI/ADX conditions
  dmiBullish,
  dmiBearish,
  adxStrong,
  // Volume conditions
  volumeAboveAvg,
  // Range-Bound (Box Range) conditions
  inRangeBound,
  rangeForming,
  rangeConfirmed,
  breakoutRiskUp,
  breakoutRiskDown,
  rangeBreakout,
  tightRange,
  rangeScoreAbove,
  // Advanced Volume conditions
  volumeAnomalyCondition,
  volumeExtreme,
  volumeRatioAbove,
  nearPoc,
  inValueArea,
  breakoutVah,
  breakdownVal,
  priceAbovePoc,
  priceBelowPoc,
  volumeConfirmsTrend,
  volumeDivergence,
  bullishVolumeDivergence,
  bearishVolumeDivergence,
  volumeTrendConfidence,
  // CMF conditions
  cmfAbove,
  cmfBelow,
  // OBV conditions
  obvRising,
  obvFalling,
  obvCrossUp,
  obvCrossDown,
  // Multi-Timeframe (MTF) conditions
  weeklyRsiAbove,
  weeklyRsiBelow,
  monthlyRsiAbove,
  monthlyRsiBelow,
  mtfRsiAbove,
  mtfRsiBelow,
  weeklyPriceAboveSma,
  weeklyPriceBelowSma,
  monthlyPriceAboveSma,
  monthlyPriceBelowSma,
  mtfPriceAboveSma,
  mtfPriceBelowSma,
  weeklyPriceAboveEma,
  mtfPriceAboveEma,
  weeklyTrendStrong,
  monthlyTrendStrong,
  mtfTrendStrong,
  weeklyUptrend,
  weeklyDowntrend,
  mtfUptrend,
  mtfDowntrend,
  mtfCondition,
  // MTF helpers
  requiresMtf,
  getRequiredTimeframes,
  // Evaluation helper
  evaluateCondition,
  // Volatility Regime conditions
  regimeIs,
  regimeNot,
  volatilityAbove,
  volatilityBelow,
  atrPercentileAbove,
  atrPercentileBelow,
  regimeConfidenceAbove,
  volatilityExpanding,
  volatilityContracting,
  // ATR% Filter conditions
  atrPercentAbove,
  atrPercentBelow,
  // Relative Strength (RS) conditions
  rsAbove,
  rsBelow,
  rsRising,
  rsFalling,
  rsNewHigh,
  rsNewLow,
  rsRatingAbove,
  rsRatingBelow,
  mansfieldRSAbove,
  mansfieldRSBelow,
  outperformanceAbove,
  outperformanceBelow,
  setBenchmark,
  BENCHMARK_CACHE_KEY,
  // Price Pattern conditions
  patternDetected,
  patternConfirmed,
  anyBullishPattern,
  anyBearishPattern,
  patternConfidenceAbove,
  anyPatternConfidenceAbove,
  patternWithinBars,
  doubleTopDetected,
  doubleBottomDetected,
  headShouldersDetected,
  inverseHeadShouldersDetected,
  cupHandleDetected,
  triangleDetected,
  wedgeDetected,
  channelDetected,
  flagDetected,
  bullFlagDetected,
  bearFlagDetected,
  // Fundamental conditions (PER/PBR)
  perBelow,
  perAbove,
  perBetween,
  pbrBelow,
  pbrAbove,
  pbrBetween,
  // Smart Money Concepts (SMC) conditions
  priceAtBullishOrderBlock,
  priceAtBearishOrderBlock,
  priceAtOrderBlock,
  orderBlockCreated,
  orderBlockMitigated,
  hasActiveOrderBlocks,
  liquiditySweepDetected,
  liquiditySweepRecovered,
  hasRecentSweeps,
  sweepDepthAbove,
} from "./conditions";

export type {
  ValidatedCrossOptions,
  PerfectOrderConditionOptions,
  PerfectOrderEnhancedConditionOptions,
  RangeBoundConditionOptions,
  ExtendedCondition,
  RSConditionOptions,
  PatternConditionOptions,
  OrderBlockConditionOptions,
  LiquiditySweepConditionOptions,
} from "./conditions";

export { runBacktest } from "./engine";
export { runBacktestScaled } from "./scaled-entry";
export type { ScaledBacktestOptions } from "./scaled-entry";

// Dynamic Slippage Model
export { calculateDynamicSlippage, resolveSlippageModel } from "./slippage-model";
export type { SlippageModel, FixedSlippageModel, VolatilitySlippageModel, VolumeSlippageModel, CompositeSlippageModel } from "./slippage-model";

// Order Types (Limit/Stop)
export {
  tryFillOrder,
  resolvePrice,
  resolveTimeInForce,
  // Preset limit/stop strategies
  limitBelowClose,
  limitAboveClose,
  limitAtrBelow,
  limitAtrAbove,
  limitAtLow,
  limitAtHigh,
  stopAboveHigh,
  stopBelowLow,
  stopAtrAbove,
  stopAtrBelow,
} from "./order-types";
export type { OrderType, MarketOrder, LimitOrder, StopOrder, StopLimitOrder, PendingOrder, FillResult, LimitPriceFunc, StopPriceFunc, TimeInForce } from "./order-types";

// Margin/Leverage
export { createMarginState, calculateBuyingPower, updateMarginState, accrueInterest, checkMarginCall } from "./margin";
export type { MarginConfig, MarginState } from "./margin";

// Volume Constraint (re-export from engine-utils)
export { applyVolumeConstraint } from "./engine-utils";

// Portfolio / Multi-Asset Backtest
export { batchBacktest, portfolioBacktest } from "./portfolio";

// Scoring
export { scoreBacktestResult } from "./scoring";
export type { BacktestScore, ScoreBreakdownEntry, ScoreWeights, ScoreOptions } from "./scoring";
