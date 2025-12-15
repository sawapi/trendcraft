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
  // Evaluation helper
  evaluateCondition,
} from "./conditions";

export type { ValidatedCrossOptions, PerfectOrderConditionOptions } from "./conditions";

export { runBacktest } from "./engine";
