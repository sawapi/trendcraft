/**
 * Streaming Condition Registry
 *
 * Registers streaming conditions into a ConditionRegistry instance.
 * Same ConditionSpec JSON format, but create() returns StreamingCondition.
 *
 * @example
 * ```ts
 * import { streamingRegistry } from "trendcraft";
 * import { and, or, not } from "trendcraft/streaming";
 *
 * const condition = streamingRegistry.hydrate(
 *   { name: "rsiBelow", params: { threshold: 30 } },
 *   { and, or, not },
 * );
 * ```
 */

import type { StreamingCondition } from "../streaming/types";
import { ConditionRegistry } from "./registry";

import {
  bollingerBreakout,
  bollingerExpansion,
  bollingerSqueeze,
  bollingerTouch,
} from "../streaming/conditions/bollinger";
import { crossOver, crossUnder } from "../streaming/conditions/cross";
import { adxRising, adxStrong, dmiCrossDown, dmiCrossUp } from "../streaming/conditions/dmi";
import {
  donchianBreakoutHigh,
  donchianBreakoutLow,
  donchianMiddleCrossDown,
  donchianMiddleCrossUp,
} from "../streaming/conditions/donchian";
import { keltnerBreakout, keltnerSqueeze, keltnerTouch } from "../streaming/conditions/keltner";
import {
  macdCrossDown,
  macdCrossUp,
  macdHistogramFalling,
  macdHistogramRising,
} from "../streaming/conditions/macd";
import {
  perfectOrderBearish,
  perfectOrderBullish,
  perfectOrderCollapsed,
  perfectOrderForming,
} from "../streaming/conditions/perfect-order";
// Import streaming condition factories
import {
  dmiBearish,
  dmiBullish,
  indicatorAbove,
  indicatorBelow,
  macdNegative,
  macdPositive,
  priceAbove,
  priceBelow,
  rsiAbove,
  rsiBelow,
} from "../streaming/conditions/presets";
import { newHigh, newLow, priceDroppedAtr, priceGainedAtr } from "../streaming/conditions/price";
import {
  stochAbove,
  stochBelow,
  stochCrossDown,
  stochCrossUp,
} from "../streaming/conditions/stochastics";
import {
  ichimokuBearish,
  ichimokuBullish,
  sarFlip,
  supertrendBearish,
  supertrendBullish,
  supertrendFlip,
} from "../streaming/conditions/trend";
import {
  atrPercentAbove,
  atrPercentBelow,
  volatilityContracting,
  volatilityExpanding,
} from "../streaming/conditions/volatility";
import {
  cmfAbove,
  cmfBelow,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  obvRising,
  volumeAboveAvg,
} from "../streaming/conditions/volume";

/**
 * Pre-built registry containing all streaming conditions
 */
export const streamingRegistry = new ConditionRegistry<StreamingCondition>();

// ============================================
// RSI
// ============================================

streamingRegistry.register({
  name: "rsiBelow",
  displayName: "RSI Below",
  category: "momentum",
  params: {
    threshold: { type: "number", required: true, min: 0, max: 100 },
    key: { type: "string", default: "rsi" },
  },
  create: (p) => rsiBelow(p.threshold as number, (p.key as string) ?? "rsi"),
});

streamingRegistry.register({
  name: "rsiAbove",
  displayName: "RSI Above",
  category: "momentum",
  params: {
    threshold: { type: "number", required: true, min: 0, max: 100 },
    key: { type: "string", default: "rsi" },
  },
  create: (p) => rsiAbove(p.threshold as number, (p.key as string) ?? "rsi"),
});

// ============================================
// MACD
// ============================================

streamingRegistry.register({
  name: "macdPositive",
  displayName: "MACD Positive",
  category: "momentum",
  params: { key: { type: "string", default: "macd" } },
  create: (p) => macdPositive((p.key as string) ?? "macd"),
});

streamingRegistry.register({
  name: "macdNegative",
  displayName: "MACD Negative",
  category: "momentum",
  params: { key: { type: "string", default: "macd" } },
  create: (p) => macdNegative((p.key as string) ?? "macd"),
});

streamingRegistry.register({
  name: "macdCrossUp",
  displayName: "MACD Cross Up",
  category: "momentum",
  params: { key: { type: "string", default: "macd" } },
  create: (p) => macdCrossUp((p.key as string) ?? "macd"),
});

streamingRegistry.register({
  name: "macdCrossDown",
  displayName: "MACD Cross Down",
  category: "momentum",
  params: { key: { type: "string", default: "macd" } },
  create: (p) => macdCrossDown((p.key as string) ?? "macd"),
});

streamingRegistry.register({
  name: "macdHistogramRising",
  displayName: "MACD Histogram Rising",
  category: "momentum",
  params: { key: { type: "string", default: "macd" } },
  create: (p) => macdHistogramRising((p.key as string) ?? "macd"),
});

streamingRegistry.register({
  name: "macdHistogramFalling",
  displayName: "MACD Histogram Falling",
  category: "momentum",
  params: { key: { type: "string", default: "macd" } },
  create: (p) => macdHistogramFalling((p.key as string) ?? "macd"),
});

// ============================================
// Price
// ============================================

streamingRegistry.register({
  name: "priceAbove",
  displayName: "Price Above",
  category: "trend",
  params: {
    indicatorKey: { type: "string", required: true, description: "Snapshot key for indicator" },
  },
  create: (p) => priceAbove(p.indicatorKey as string),
});

streamingRegistry.register({
  name: "priceBelow",
  displayName: "Price Below",
  category: "trend",
  params: {
    indicatorKey: { type: "string", required: true, description: "Snapshot key for indicator" },
  },
  create: (p) => priceBelow(p.indicatorKey as string),
});

streamingRegistry.register({
  name: "indicatorAbove",
  displayName: "Indicator Above",
  category: "trend",
  params: {
    indicatorKey: { type: "string", required: true },
    threshold: { type: "number", required: true },
  },
  create: (p) => indicatorAbove(p.indicatorKey as string, p.threshold as number),
});

streamingRegistry.register({
  name: "indicatorBelow",
  displayName: "Indicator Below",
  category: "trend",
  params: {
    indicatorKey: { type: "string", required: true },
    threshold: { type: "number", required: true },
  },
  create: (p) => indicatorBelow(p.indicatorKey as string, p.threshold as number),
});

// ============================================
// Cross Detection
// ============================================

streamingRegistry.register({
  name: "crossOver",
  displayName: "Cross Over",
  category: "trend",
  params: {
    a: { type: "string", required: true, description: "First value key or number" },
    b: { type: "string", required: true, description: "Second value key or number" },
  },
  create: (p) =>
    crossOver(p.a as string, Number.isNaN(Number(p.b)) ? (p.b as string) : Number(p.b)),
});

streamingRegistry.register({
  name: "crossUnder",
  displayName: "Cross Under",
  category: "trend",
  params: {
    a: { type: "string", required: true },
    b: { type: "string", required: true },
  },
  create: (p) =>
    crossUnder(p.a as string, Number.isNaN(Number(p.b)) ? (p.b as string) : Number(p.b)),
});

// ============================================
// DMI / ADX
// ============================================

streamingRegistry.register({
  name: "dmiBullish",
  displayName: "DMI Bullish",
  category: "trend",
  params: {
    threshold: { type: "number", default: 25, min: 0 },
    key: { type: "string", default: "dmi" },
  },
  create: (p) => dmiBullish((p.threshold as number) ?? 25, (p.key as string) ?? "dmi"),
});

streamingRegistry.register({
  name: "dmiBearish",
  displayName: "DMI Bearish",
  category: "trend",
  params: {
    threshold: { type: "number", default: 25, min: 0 },
    key: { type: "string", default: "dmi" },
  },
  create: (p) => dmiBearish((p.threshold as number) ?? 25, (p.key as string) ?? "dmi"),
});

streamingRegistry.register({
  name: "adxStrong",
  displayName: "ADX Strong",
  category: "trend",
  params: {
    threshold: { type: "number", default: 25, min: 0 },
    key: { type: "string", default: "dmi" },
  },
  isFilter: true,
  create: (p) => adxStrong((p.threshold as number) ?? 25, (p.key as string) ?? "dmi"),
});

streamingRegistry.register({
  name: "adxRising",
  displayName: "ADX Rising",
  category: "trend",
  params: { key: { type: "string", default: "dmi" } },
  create: (p) => adxRising((p.key as string) ?? "dmi"),
});

streamingRegistry.register({
  name: "dmiCrossUp",
  displayName: "DMI Cross Up",
  category: "trend",
  params: { key: { type: "string", default: "dmi" } },
  create: (p) => dmiCrossUp((p.key as string) ?? "dmi"),
});

streamingRegistry.register({
  name: "dmiCrossDown",
  displayName: "DMI Cross Down",
  category: "trend",
  params: { key: { type: "string", default: "dmi" } },
  create: (p) => dmiCrossDown((p.key as string) ?? "dmi"),
});

// ============================================
// Bollinger Bands
// ============================================

streamingRegistry.register({
  name: "bollingerBreakout",
  displayName: "Bollinger Breakout",
  category: "volatility",
  params: {
    band: { type: "string", required: true, enum: ["upper", "lower"] },
    key: { type: "string", default: "bb" },
  },
  create: (p) => bollingerBreakout(p.band as "upper" | "lower", (p.key as string) ?? "bb"),
});

streamingRegistry.register({
  name: "bollingerTouch",
  displayName: "Bollinger Touch",
  category: "volatility",
  params: {
    band: { type: "string", required: true, enum: ["upper", "lower"] },
    tolerance: { type: "number", default: 0.1, min: 0 },
    key: { type: "string", default: "bb" },
  },
  create: (p) =>
    bollingerTouch(
      p.band as "upper" | "lower",
      (p.tolerance as number) ?? 0.1,
      (p.key as string) ?? "bb",
    ),
});

streamingRegistry.register({
  name: "bollingerSqueeze",
  displayName: "Bollinger Squeeze",
  category: "volatility",
  params: {
    threshold: { type: "number", default: 0.1, min: 0 },
    key: { type: "string", default: "bb" },
  },
  create: (p) => bollingerSqueeze((p.threshold as number) ?? 0.1, (p.key as string) ?? "bb"),
});

streamingRegistry.register({
  name: "bollingerExpansion",
  displayName: "Bollinger Expansion",
  category: "volatility",
  params: {
    threshold: { type: "number", default: 0.2, min: 0 },
    key: { type: "string", default: "bb" },
  },
  create: (p) => bollingerExpansion((p.threshold as number) ?? 0.2, (p.key as string) ?? "bb"),
});

// ============================================
// Stochastics
// ============================================

streamingRegistry.register({
  name: "stochBelow",
  displayName: "Stoch Below",
  category: "momentum",
  params: {
    threshold: { type: "number", default: 20, min: 0, max: 100 },
    key: { type: "string", default: "stochastics" },
  },
  create: (p) => stochBelow((p.threshold as number) ?? 20, (p.key as string) ?? "stochastics"),
});

streamingRegistry.register({
  name: "stochAbove",
  displayName: "Stoch Above",
  category: "momentum",
  params: {
    threshold: { type: "number", default: 80, min: 0, max: 100 },
    key: { type: "string", default: "stochastics" },
  },
  create: (p) => stochAbove((p.threshold as number) ?? 80, (p.key as string) ?? "stochastics"),
});

streamingRegistry.register({
  name: "stochCrossUp",
  displayName: "Stoch Cross Up",
  category: "momentum",
  params: { key: { type: "string", default: "stochastics" } },
  create: (p) => stochCrossUp((p.key as string) ?? "stochastics"),
});

streamingRegistry.register({
  name: "stochCrossDown",
  displayName: "Stoch Cross Down",
  category: "momentum",
  params: { key: { type: "string", default: "stochastics" } },
  create: (p) => stochCrossDown((p.key as string) ?? "stochastics"),
});

// ============================================
// Volume
// ============================================

streamingRegistry.register({
  name: "volumeAboveAvg",
  displayName: "Volume Above Avg",
  category: "volume",
  params: {
    multiplier: { type: "number", default: 1.5, min: 0.1 },
    key: { type: "string", default: "volumeAnomaly" },
  },
  isFilter: true,
  create: (p) =>
    volumeAboveAvg((p.multiplier as number) ?? 1.5, (p.key as string) ?? "volumeAnomaly"),
});

streamingRegistry.register({
  name: "cmfAbove",
  displayName: "CMF Above",
  category: "volume",
  params: { threshold: { type: "number", default: 0.05 }, key: { type: "string", default: "cmf" } },
  create: (p) => cmfAbove((p.threshold as number) ?? 0.05, (p.key as string) ?? "cmf"),
});
streamingRegistry.register({
  name: "cmfBelow",
  displayName: "CMF Below",
  category: "volume",
  params: {
    threshold: { type: "number", default: -0.05 },
    key: { type: "string", default: "cmf" },
  },
  create: (p) => cmfBelow((p.threshold as number) ?? -0.05, (p.key as string) ?? "cmf"),
});
streamingRegistry.register({
  name: "obvRising",
  displayName: "OBV Rising",
  category: "volume",
  params: { key: { type: "string", default: "obv" } },
  create: (p) => obvRising((p.key as string) ?? "obv"),
});
streamingRegistry.register({
  name: "obvFalling",
  displayName: "OBV Falling",
  category: "volume",
  params: { key: { type: "string", default: "obv" } },
  create: (p) => obvFalling((p.key as string) ?? "obv"),
});
streamingRegistry.register({
  name: "obvCrossUp",
  displayName: "OBV Cross Up",
  category: "volume",
  params: {
    signalKey: { type: "string", default: "obvSignal" },
    key: { type: "string", default: "obv" },
  },
  create: (p) => obvCrossUp((p.signalKey as string) ?? "obvSignal", (p.key as string) ?? "obv"),
});
streamingRegistry.register({
  name: "obvCrossDown",
  displayName: "OBV Cross Down",
  category: "volume",
  params: {
    signalKey: { type: "string", default: "obvSignal" },
    key: { type: "string", default: "obv" },
  },
  create: (p) => obvCrossDown((p.signalKey as string) ?? "obvSignal", (p.key as string) ?? "obv"),
});

// ============================================
// Volatility
// ============================================

streamingRegistry.register({
  name: "atrPercentAbove",
  displayName: "ATR% Above",
  category: "volatility",
  params: {
    threshold: { type: "number", default: 2.0, min: 0 },
    key: { type: "string", default: "atr" },
  },
  isFilter: true,
  create: (p) => atrPercentAbove((p.threshold as number) ?? 2.0, (p.key as string) ?? "atr"),
});

streamingRegistry.register({
  name: "atrPercentBelow",
  displayName: "ATR% Below",
  category: "volatility",
  params: {
    threshold: { type: "number", default: 1.0, min: 0 },
    key: { type: "string", default: "atr" },
  },
  isFilter: true,
  create: (p) => atrPercentBelow((p.threshold as number) ?? 1.0, (p.key as string) ?? "atr"),
});

streamingRegistry.register({
  name: "volatilityExpanding",
  displayName: "Volatility Expanding",
  category: "volatility",
  params: { key: { type: "string", default: "atr" } },
  isFilter: true,
  create: (p) => volatilityExpanding((p.key as string) ?? "atr"),
});
streamingRegistry.register({
  name: "volatilityContracting",
  displayName: "Volatility Contracting",
  category: "volatility",
  params: { key: { type: "string", default: "atr" } },
  isFilter: true,
  create: (p) => volatilityContracting((p.key as string) ?? "atr"),
});

// ============================================
// Trend
// ============================================

streamingRegistry.register({
  name: "supertrendBullish",
  displayName: "Supertrend Bullish",
  category: "trend",
  params: { key: { type: "string", default: "supertrend" } },
  create: (p) => supertrendBullish((p.key as string) ?? "supertrend"),
});
streamingRegistry.register({
  name: "supertrendBearish",
  displayName: "Supertrend Bearish",
  category: "trend",
  params: { key: { type: "string", default: "supertrend" } },
  create: (p) => supertrendBearish((p.key as string) ?? "supertrend"),
});
streamingRegistry.register({
  name: "supertrendFlip",
  displayName: "Supertrend Flip",
  category: "trend",
  params: { key: { type: "string", default: "supertrend" } },
  create: (p) => supertrendFlip((p.key as string) ?? "supertrend"),
});
streamingRegistry.register({
  name: "ichimokuBullish",
  displayName: "Ichimoku Bullish",
  category: "trend",
  params: { key: { type: "string", default: "ichimoku" } },
  create: (p) => ichimokuBullish((p.key as string) ?? "ichimoku"),
});
streamingRegistry.register({
  name: "ichimokuBearish",
  displayName: "Ichimoku Bearish",
  category: "trend",
  params: { key: { type: "string", default: "ichimoku" } },
  create: (p) => ichimokuBearish((p.key as string) ?? "ichimoku"),
});
streamingRegistry.register({
  name: "sarFlip",
  displayName: "SAR Flip",
  category: "trend",
  params: { key: { type: "string", default: "parabolicSar" } },
  create: (p) => sarFlip((p.key as string) ?? "parabolicSar"),
});

// ============================================
// Price (Streaming)
// ============================================

streamingRegistry.register({
  name: "priceDroppedAtr",
  displayName: "Price Dropped ATR",
  category: "volatility",
  params: {
    multiplier: { type: "number", default: 1.0, min: 0.1 },
    key: { type: "string", default: "atr" },
  },
  create: (p) => priceDroppedAtr((p.multiplier as number) ?? 1.0, (p.key as string) ?? "atr"),
});

streamingRegistry.register({
  name: "priceGainedAtr",
  displayName: "Price Gained ATR",
  category: "volatility",
  params: {
    multiplier: { type: "number", default: 1.0, min: 0.1 },
    key: { type: "string", default: "atr" },
  },
  create: (p) => priceGainedAtr((p.multiplier as number) ?? 1.0, (p.key as string) ?? "atr"),
});

streamingRegistry.register({
  name: "newHigh",
  displayName: "New High",
  category: "trend",
  params: { key: { type: "string", default: "donchian" } },
  create: (p) => newHigh((p.key as string) ?? "donchian"),
});
streamingRegistry.register({
  name: "newLow",
  displayName: "New Low",
  category: "trend",
  params: { key: { type: "string", default: "donchian" } },
  create: (p) => newLow((p.key as string) ?? "donchian"),
});

// ============================================
// Perfect Order (Streaming)
// ============================================

streamingRegistry.register({
  name: "perfectOrderBullish",
  displayName: "PO Bullish",
  category: "trend",
  params: { key: { type: "string", default: "emaRibbon" } },
  create: (p) => perfectOrderBullish((p.key as string) ?? "emaRibbon"),
});
streamingRegistry.register({
  name: "perfectOrderBearish",
  displayName: "PO Bearish",
  category: "trend",
  params: { key: { type: "string", default: "emaRibbon" } },
  create: (p) => perfectOrderBearish((p.key as string) ?? "emaRibbon"),
});
streamingRegistry.register({
  name: "perfectOrderForming",
  displayName: "PO Forming",
  category: "trend",
  params: { key: { type: "string", default: "emaRibbon" } },
  create: (p) => perfectOrderForming((p.key as string) ?? "emaRibbon"),
});
streamingRegistry.register({
  name: "perfectOrderCollapsed",
  displayName: "PO Collapsed",
  category: "trend",
  params: { key: { type: "string", default: "emaRibbon" } },
  create: (p) => perfectOrderCollapsed((p.key as string) ?? "emaRibbon"),
});

// ============================================
// Keltner Channel
// ============================================

streamingRegistry.register({
  name: "keltnerBreakout",
  displayName: "Keltner Breakout",
  category: "volatility",
  params: {
    band: { type: "string", required: true, enum: ["upper", "lower"] },
    key: { type: "string", default: "keltner" },
  },
  create: (p) => keltnerBreakout(p.band as "upper" | "lower", (p.key as string) ?? "keltner"),
});

streamingRegistry.register({
  name: "keltnerTouch",
  displayName: "Keltner Touch",
  category: "volatility",
  params: {
    band: { type: "string", required: true, enum: ["upper", "lower"] },
    tolerance: { type: "number", default: 0.1, min: 0 },
    key: { type: "string", default: "keltner" },
  },
  create: (p) =>
    keltnerTouch(
      p.band as "upper" | "lower",
      (p.tolerance as number) ?? 0.1,
      (p.key as string) ?? "keltner",
    ),
});

streamingRegistry.register({
  name: "keltnerSqueeze",
  displayName: "Keltner Squeeze (TTM)",
  category: "volatility",
  params: {
    bbKey: { type: "string", default: "bb" },
    keltnerKey: { type: "string", default: "keltner" },
  },
  create: (p) => keltnerSqueeze((p.bbKey as string) ?? "bb", (p.keltnerKey as string) ?? "keltner"),
});

// ============================================
// Donchian Channel
// ============================================

streamingRegistry.register({
  name: "donchianBreakoutHigh",
  displayName: "Donchian Breakout High",
  category: "trend",
  params: { key: { type: "string", default: "donchian" } },
  create: (p) => donchianBreakoutHigh((p.key as string) ?? "donchian"),
});
streamingRegistry.register({
  name: "donchianBreakoutLow",
  displayName: "Donchian Breakout Low",
  category: "trend",
  params: { key: { type: "string", default: "donchian" } },
  create: (p) => donchianBreakoutLow((p.key as string) ?? "donchian"),
});
streamingRegistry.register({
  name: "donchianMiddleCrossUp",
  displayName: "Donchian Middle Cross Up",
  category: "trend",
  params: { key: { type: "string", default: "donchian" } },
  create: (p) => donchianMiddleCrossUp((p.key as string) ?? "donchian"),
});
streamingRegistry.register({
  name: "donchianMiddleCrossDown",
  displayName: "Donchian Middle Cross Down",
  category: "trend",
  params: { key: { type: "string", default: "donchian" } },
  create: (p) => donchianMiddleCrossDown((p.key as string) ?? "donchian"),
});
