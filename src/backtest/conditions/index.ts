/**
 * Preset conditions for backtest entry/exit
 *
 * This module re-exports all condition functions for backward compatibility.
 */

// Core functions
export { evaluateCondition, and, or, not } from "./core";

// Moving Average Cross conditions
export {
  goldenCross,
  deadCross,
  validatedGoldenCross,
  validatedDeadCross,
  type ValidatedCrossOptions,
} from "./ma-cross";

// RSI conditions
export { rsiBelow, rsiAbove } from "./rsi";

// MACD conditions
export { macdCrossUp, macdCrossDown } from "./macd";

// Bollinger Bands conditions
export { bollingerBreakout, bollingerTouch } from "./bollinger";

// Price conditions
export { priceAboveSma, priceBelowSma } from "./price";

// Perfect Order conditions
export {
  perfectOrderBullish,
  perfectOrderBearish,
  perfectOrderCollapsed,
  perfectOrderActiveBullish,
  perfectOrderActiveBearish,
  perfectOrderBullishConfirmed,
  perfectOrderBearishConfirmed,
  perfectOrderConfirmationFormed,
  perfectOrderBreakdown,
  perfectOrderMaCollapsed,
  perfectOrderPreBullish,
  perfectOrderPreBearish,
  perfectOrderPullbackEntry,
  perfectOrderPullbackSellEntry,
  poPlusEntry,
  pbEntry,
  poPlusPbEntry,
  type PerfectOrderConditionOptions,
  type PerfectOrderEnhancedConditionOptions,
} from "./perfect-order";

// Stochastics conditions
export { stochBelow, stochAbove, stochCrossUp, stochCrossDown } from "./stochastics";

// DMI/ADX conditions
export { dmiBullish, dmiBearish, adxStrong } from "./dmi";

// Volume conditions
export { volumeAboveAvg } from "./volume";

// Range-Bound conditions
export {
  inRangeBound,
  rangeForming,
  rangeConfirmed,
  breakoutRiskUp,
  breakoutRiskDown,
  rangeBreakout,
  tightRange,
  rangeScoreAbove,
  type RangeBoundConditionOptions,
} from "./range-bound";
