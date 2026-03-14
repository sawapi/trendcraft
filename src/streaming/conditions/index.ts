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
  regimeFilter,
  getRegimeSizeMultiplier,
} from "./presets";
export type { VolatilityLevel, RegimeFilterOptions, RegimeMultipliers } from "./presets";

export { getNumber, getField, resolveNumber } from "../snapshot-utils";
export { crossOver, crossUnder } from "./cross";
export type { ValueExtractor } from "./cross";

// Bollinger Bands conditions
export {
  bollingerBreakout,
  bollingerTouch,
  bollingerSqueeze,
  bollingerExpansion,
} from "./bollinger";

// Stochastics conditions
export { stochBelow, stochAbove, stochCrossUp, stochCrossDown } from "./stochastics";

// MACD conditions
export { macdCrossUp, macdCrossDown, macdHistogramRising, macdHistogramFalling } from "./macd";

// DMI/ADX conditions
export { adxStrong, adxRising, dmiCrossUp, dmiCrossDown } from "./dmi";

// Volume conditions
export {
  volumeAboveAvg,
  cmfAbove,
  cmfBelow,
  obvRising,
  obvFalling,
  obvCrossUp,
  obvCrossDown,
} from "./volume";

// Volatility conditions
export {
  atrPercentAbove,
  atrPercentBelow,
  volatilityExpanding,
  volatilityContracting,
} from "./volatility";

// Trend conditions
export {
  supertrendBullish,
  supertrendBearish,
  supertrendFlip,
  ichimokuBullish,
  ichimokuBearish,
  sarFlip,
} from "./trend";

// Price conditions
export { priceDroppedAtr, priceGainedAtr, newHigh, newLow } from "./price";

// Perfect Order conditions
export {
  perfectOrderBullish,
  perfectOrderBearish,
  perfectOrderForming,
  perfectOrderCollapsed,
} from "./perfect-order";

// Keltner Channel conditions
export { keltnerBreakout, keltnerTouch, keltnerSqueeze } from "./keltner";

// Donchian Channel conditions
export {
  donchianBreakoutHigh,
  donchianBreakoutLow,
  donchianMiddleCrossUp,
  donchianMiddleCrossDown,
} from "./donchian";
