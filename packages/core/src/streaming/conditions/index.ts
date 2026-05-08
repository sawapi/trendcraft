/**
 * Streaming Conditions
 *
 * Condition evaluation and combinators for streaming pipelines.
 */

export { getField, getNumber, resolveNumber } from "../snapshot-utils";
// Bollinger Bands conditions
export {
  bollingerBreakout,
  bollingerExpansion,
  bollingerSqueeze,
  bollingerTouch,
} from "./bollinger";
export { and, evaluateStreamingCondition, not, or } from "./core";
export type { ValueExtractor } from "./cross";
export { crossOver, crossUnder } from "./cross";
// DMI/ADX conditions
export { adxRising, adxStrong, dmiCrossDown, dmiCrossUp } from "./dmi";
// Donchian Channel conditions
export {
  donchianBreakoutHigh,
  donchianBreakoutLow,
  donchianMiddleCrossDown,
  donchianMiddleCrossUp,
} from "./donchian";
// Keltner Channel conditions
export { keltnerBreakout, keltnerSqueeze, keltnerTouch } from "./keltner";
// MACD conditions
export { macdCrossDown, macdCrossUp, macdHistogramFalling, macdHistogramRising } from "./macd";
// Perfect Order conditions
export {
  perfectOrderBearish,
  perfectOrderBullish,
  perfectOrderCollapsed,
  perfectOrderForming,
} from "./perfect-order";
export type { RegimeFilterOptions, RegimeMultipliers, VolatilityLevel } from "./presets";
export {
  dmiBearish,
  dmiBullish,
  getRegimeSizeMultiplier,
  indicatorAbove,
  indicatorBelow,
  macdNegative,
  macdPositive,
  priceAbove,
  priceBelow,
  regimeFilter,
  rsiAbove,
  rsiBelow,
  smaDeadCross,
  smaGoldenCross,
} from "./presets";
// Price conditions
export { newHigh, newLow, priceDroppedAtr, priceGainedAtr } from "./price";
// Stochastics conditions
export { stochAbove, stochBelow, stochCrossDown, stochCrossUp } from "./stochastics";
// Trend conditions
export {
  ichimokuBearish,
  ichimokuBullish,
  sarFlip,
  supertrendBearish,
  supertrendBullish,
  supertrendFlip,
} from "./trend";
export type {
  IndicatorSnapshot,
  StreamingCombinedCondition,
  StreamingCondition,
  StreamingConditionFn,
  StreamingPresetCondition,
} from "./types";
// Volatility conditions
export {
  atrPercentAbove,
  atrPercentBelow,
  volatilityContracting,
  volatilityExpanding,
} from "./volatility";
// Volume conditions
export {
  cmfAbove,
  cmfBelow,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  obvRising,
  volumeAboveAvg,
} from "./volume";
