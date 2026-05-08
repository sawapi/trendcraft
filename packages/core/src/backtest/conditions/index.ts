/**
 * Preset conditions for backtest entry/exit
 *
 * This module re-exports all condition functions for backward compatibility.
 */

// Bollinger Bands conditions
export { bollingerBreakout, bollingerTouch } from "./bollinger";
export type { EvaluateConditionOptions, ExtendedCondition } from "./core";
// Core functions
export {
  alwaysFalse,
  alwaysTrue,
  and,
  evaluateCondition,
  getRequiredTimeframes,
  MtfContextRequiredError,
  not,
  or,
  requiresMtf,
} from "./core";
// DMI/ADX conditions
export { adxStrong, dmiBearish, dmiBullish } from "./dmi";
// Fundamental metrics conditions
export { pbrAbove, pbrBelow, pbrBetween, perAbove, perBelow, perBetween } from "./fundamentals";
// Moving Average Cross conditions
export {
  deadCross,
  goldenCross,
  type ValidatedCrossOptions,
  validatedDeadCross,
  validatedGoldenCross,
} from "./ma-cross";
// MACD conditions
export { macdCrossDown, macdCrossUp } from "./macd";
// Multi-Timeframe (MTF) conditions
export {
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
  weeklyDowntrend,
  weeklyPriceAboveEma,
  weeklyPriceAboveSma,
  weeklyPriceBelowSma,
  weeklyRsiAbove,
  weeklyRsiBelow,
  weeklyTrendStrong,
  weeklyUptrend,
} from "./mtf";
// Price Pattern conditions
export {
  anyBearishPattern,
  anyBullishPattern,
  anyPatternConfidenceAbove,
  bearFlagDetected,
  bearishHarmonicDetected,
  bullFlagDetected,
  bullishHarmonicDetected,
  channelDetected,
  cupHandleDetected,
  doubleBottomDetected,
  // Convenience conditions
  doubleTopDetected,
  flagDetected,
  harmonicPatternDetected,
  headShouldersDetected,
  inverseHeadShouldersDetected,
  type PatternConditionOptions,
  patternConfidenceAbove,
  patternConfirmed,
  patternDetected,
  patternWithinBars,
  triangleDetected,
  wedgeDetected,
} from "./patterns";
// Perfect Order conditions
export {
  type PerfectOrderConditionOptions,
  type PerfectOrderEnhancedConditionOptions,
  pbEntry,
  perfectOrderActiveBearish,
  perfectOrderActiveBullish,
  perfectOrderBearish,
  perfectOrderBearishConfirmed,
  perfectOrderBreakdown,
  perfectOrderBullish,
  perfectOrderBullishConfirmed,
  perfectOrderCollapsed,
  perfectOrderConfirmationFormed,
  perfectOrderMaCollapsed,
  perfectOrderPreBearish,
  perfectOrderPreBullish,
  perfectOrderPullbackEntry,
  perfectOrderPullbackSellEntry,
  poPlusEntry,
  poPlusPbEntry,
} from "./perfect-order";
// Price conditions
export { priceAboveSma, priceBelowSma, priceDroppedAtr } from "./price";

// Range-Bound conditions
export {
  breakoutRiskDown,
  breakoutRiskUp,
  inRangeBound,
  type RangeBoundConditionOptions,
  rangeBreakout,
  rangeConfirmed,
  rangeForming,
  rangeScoreAbove,
  tightRange,
} from "./range-bound";
// Relative Strength (RS) conditions
export {
  BENCHMARK_CACHE_KEY,
  mansfieldRSAbove,
  mansfieldRSBelow,
  outperformanceAbove,
  outperformanceBelow,
  type RSConditionOptions,
  rsAbove,
  rsBelow,
  rsFalling,
  rsNewHigh,
  rsNewLow,
  rsRatingAbove,
  rsRatingBelow,
  rsRising,
  setBenchmark,
} from "./relative-strength";
// RSI conditions
export { rsiAbove, rsiBelow } from "./rsi";
// Smart Money Concepts (SMC) conditions
export {
  hasActiveOrderBlocks,
  hasRecentSweeps,
  type LiquiditySweepConditionOptions,
  // Liquidity Sweep conditions
  liquiditySweepDetected,
  liquiditySweepRecovered,
  type OrderBlockConditionOptions,
  orderBlockCreated,
  orderBlockMitigated,
  priceAtBearishOrderBlock,
  // Order Block conditions
  priceAtBullishOrderBlock,
  priceAtOrderBlock,
  sweepDepthAbove,
} from "./smc";
// Stochastics conditions
export { stochAbove, stochBelow, stochCrossDown, stochCrossUp } from "./stochastics";
// Volatility Regime conditions
export {
  // ATR% Filter conditions
  atrPercentAbove,
  atrPercentBelow,
  atrPercentileAbove,
  atrPercentileBelow,
  regimeConfidenceAbove,
  regimeIs,
  regimeNot,
  volatilityAbove,
  volatilityBelow,
  volatilityContracting,
  volatilityExpanding,
} from "./volatility";
// Volume conditions
export { volumeAboveAvg } from "./volume";
// Advanced Volume conditions
export {
  bearishVolumeDivergence,
  breakdownVal,
  breakoutVah,
  bullishVolumeDivergence,
  // CMF conditions
  cmfAbove,
  cmfBelow,
  inValueArea,
  nearPoc,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  // OBV conditions
  obvRising,
  priceAbovePoc,
  priceBelowPoc,
  volumeAnomalyCondition,
  volumeConfirmsTrend,
  volumeDivergence,
  volumeExtreme,
  volumeRatioAbove,
  volumeTrendConfidence,
} from "./volume-advanced";
