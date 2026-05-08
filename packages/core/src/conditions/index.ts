/**
 * Unified Condition Module
 *
 * Define conditions once, use in both backtest and streaming contexts.
 */

export type {
  IndicatorAccessor,
  UnifiedCondition,
  UnifiedConditionDef,
} from "./unified";
export {
  defineUnifiedCondition,
  unifiedAnd,
  unifiedNot,
  unifiedOr,
} from "./unified";
