/**
 * Unified Condition Module
 *
 * Define conditions once, use in both backtest and streaming contexts.
 */

export {
  defineUnifiedCondition,
  unifiedAnd,
  unifiedOr,
  unifiedNot,
} from "./unified";

export type {
  IndicatorAccessor,
  UnifiedConditionDef,
  UnifiedCondition,
} from "./unified";
