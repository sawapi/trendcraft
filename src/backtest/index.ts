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
  // Evaluation helper
  evaluateCondition,
} from "./conditions";

export type {
  ValidatedCrossOptions,
  PerfectOrderConditionOptions,
  PerfectOrderEnhancedConditionOptions,
  RangeBoundConditionOptions,
} from "./conditions";

export { runBacktest } from "./engine";
