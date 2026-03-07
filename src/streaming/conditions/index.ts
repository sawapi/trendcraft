/**
 * Streaming Conditions
 *
 * Condition evaluation and combinators for streaming pipelines.
 */

export type {
  IndicatorSnapshot,
  StreamingConditionFn,
  StreamingPresetCondition,
  StreamingCombinedCondition,
  StreamingCondition,
} from "./types";

export { and, or, not, evaluateStreamingCondition } from "./core";

export {
  rsiBelow,
  rsiAbove,
  smaGoldenCross,
  smaDeadCross,
  macdPositive,
  macdNegative,
  priceAbove,
  priceBelow,
  indicatorAbove,
  indicatorBelow,
  dmiBullish,
  dmiBearish,
} from "./presets";

export { getNumber, getField, resolveNumber } from "../snapshot-utils";
export { crossOver, crossUnder } from "./cross";
export type { ValueExtractor } from "./cross";
