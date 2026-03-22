/**
 * Backtest Condition Registry
 *
 * Registers all 105+ backtest conditions into a ConditionRegistry instance.
 * This enables JSON-based strategy serialization and UI-driven condition selection.
 *
 * @example
 * ```ts
 * import { backtestRegistry } from "trendcraft";
 *
 * // List all available conditions
 * const all = backtestRegistry.list();
 *
 * // List by category
 * const trendConditions = backtestRegistry.list("trend");
 *
 * // Hydrate from JSON spec
 * import { and, or, not } from "trendcraft";
 * const condition = backtestRegistry.hydrate(
 *   { name: "goldenCross", params: { shortPeriod: 10 } },
 *   { and, or, not },
 * );
 * ```
 */

import type { HarmonicPatternType, PatternType } from "../signals/patterns/types";
import type { Condition } from "../types";
import { ConditionRegistry } from "./registry";

import { bollingerBreakout, bollingerTouch } from "../backtest/conditions/bollinger";
import { adxStrong, dmiBearish, dmiBullish } from "../backtest/conditions/dmi";
import {
  pbrAbove,
  pbrBelow,
  pbrBetween,
  perAbove,
  perBelow,
  perBetween,
} from "../backtest/conditions/fundamentals";
// Import all condition factories
import {
  deadCross,
  goldenCross,
  validatedDeadCross,
  validatedGoldenCross,
} from "../backtest/conditions/ma-cross";
import { macdCrossDown, macdCrossUp } from "../backtest/conditions/macd";
import {
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
  doubleTopDetected,
  flagDetected,
  harmonicPatternDetected,
  headShouldersDetected,
  inverseHeadShouldersDetected,
  patternConfidenceAbove,
  patternConfirmed,
  patternDetected,
  patternWithinBars,
  triangleDetected,
  wedgeDetected,
} from "../backtest/conditions/patterns";
import {
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
} from "../backtest/conditions/perfect-order";
import { priceAboveSma, priceBelowSma, priceDroppedAtr } from "../backtest/conditions/price";
import {
  breakoutRiskDown,
  breakoutRiskUp,
  inRangeBound,
  rangeBreakout,
  rangeConfirmed,
  rangeForming,
  rangeScoreAbove,
  tightRange,
} from "../backtest/conditions/range-bound";
import { rsiAbove, rsiBelow } from "../backtest/conditions/rsi";
import {
  hasActiveOrderBlocks,
  hasRecentSweeps,
  liquiditySweepDetected,
  liquiditySweepRecovered,
  orderBlockCreated,
  orderBlockMitigated,
  priceAtBearishOrderBlock,
  priceAtBullishOrderBlock,
  priceAtOrderBlock,
  sweepDepthAbove,
} from "../backtest/conditions/smc";
import {
  stochAbove,
  stochBelow,
  stochCrossDown,
  stochCrossUp,
} from "../backtest/conditions/stochastics";
import {
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
} from "../backtest/conditions/volatility";
import { volumeAboveAvg } from "../backtest/conditions/volume";
import {
  breakdownVal,
  breakoutVah,
  inValueArea,
  nearPoc,
  priceAbovePoc,
  priceBelowPoc,
  volumeAnomalyCondition,
  volumeExtreme,
  volumeRatioAbove,
} from "../backtest/conditions/volume-advanced";
import {
  bearishVolumeDivergence,
  bullishVolumeDivergence,
  cmfAbove,
  cmfBelow,
  obvCrossDown,
  obvCrossUp,
  obvFalling,
  obvRising,
  volumeConfirmsTrend,
  volumeDivergence,
  volumeTrendConfidence,
} from "../backtest/conditions/volume-advanced";

/**
 * Pre-built registry containing all backtest conditions
 */
export const backtestRegistry = new ConditionRegistry<Condition>();

// ============================================
// MA Cross
// ============================================

backtestRegistry.register({
  name: "goldenCross",
  displayName: "Golden Cross",
  category: "trend",
  params: {
    shortPeriod: { type: "number", default: 5, min: 1, description: "Short MA period" },
    longPeriod: { type: "number", default: 25, min: 1, description: "Long MA period" },
  },
  create: (p) => goldenCross((p.shortPeriod as number) ?? 5, (p.longPeriod as number) ?? 25),
});

backtestRegistry.register({
  name: "deadCross",
  displayName: "Dead Cross",
  category: "trend",
  params: {
    shortPeriod: { type: "number", default: 5, min: 1, description: "Short MA period" },
    longPeriod: { type: "number", default: 25, min: 1, description: "Long MA period" },
  },
  create: (p) => deadCross((p.shortPeriod as number) ?? 5, (p.longPeriod as number) ?? 25),
});

backtestRegistry.register({
  name: "validatedGoldenCross",
  displayName: "Validated Golden Cross",
  category: "trend",
  params: {
    shortPeriod: { type: "number", default: 5, min: 1 },
    longPeriod: { type: "number", default: 25, min: 1 },
    volumeMaPeriod: { type: "number", default: 20, min: 1 },
    trendPeriod: { type: "number", default: 5, min: 1 },
    minScore: { type: "number", default: 50, min: 0, max: 100 },
  },
  create: (p) =>
    validatedGoldenCross({
      shortPeriod: p.shortPeriod as number,
      longPeriod: p.longPeriod as number,
      volumeMaPeriod: p.volumeMaPeriod as number,
      trendPeriod: p.trendPeriod as number,
      minScore: p.minScore as number,
    }),
});

backtestRegistry.register({
  name: "validatedDeadCross",
  displayName: "Validated Dead Cross",
  category: "trend",
  params: {
    shortPeriod: { type: "number", default: 5, min: 1 },
    longPeriod: { type: "number", default: 25, min: 1 },
    volumeMaPeriod: { type: "number", default: 20, min: 1 },
    trendPeriod: { type: "number", default: 5, min: 1 },
    minScore: { type: "number", default: 50, min: 0, max: 100 },
  },
  create: (p) =>
    validatedDeadCross({
      shortPeriod: p.shortPeriod as number,
      longPeriod: p.longPeriod as number,
      volumeMaPeriod: p.volumeMaPeriod as number,
      trendPeriod: p.trendPeriod as number,
      minScore: p.minScore as number,
    }),
});

// ============================================
// RSI
// ============================================

backtestRegistry.register({
  name: "rsiBelow",
  displayName: "RSI Below",
  category: "momentum",
  params: {
    threshold: { type: "number", default: 30, min: 0, max: 100, description: "RSI threshold" },
    period: { type: "number", default: 14, min: 1, description: "RSI period" },
  },
  create: (p) => rsiBelow((p.threshold as number) ?? 30, (p.period as number) ?? 14),
});

backtestRegistry.register({
  name: "rsiAbove",
  displayName: "RSI Above",
  category: "momentum",
  params: {
    threshold: { type: "number", default: 70, min: 0, max: 100, description: "RSI threshold" },
    period: { type: "number", default: 14, min: 1, description: "RSI period" },
  },
  create: (p) => rsiAbove((p.threshold as number) ?? 70, (p.period as number) ?? 14),
});

// ============================================
// MACD
// ============================================

backtestRegistry.register({
  name: "macdCrossUp",
  displayName: "MACD Cross Up",
  category: "momentum",
  params: {
    fast: { type: "number", default: 12, min: 1 },
    slow: { type: "number", default: 26, min: 1 },
    signal: { type: "number", default: 9, min: 1 },
  },
  create: (p) =>
    macdCrossUp((p.fast as number) ?? 12, (p.slow as number) ?? 26, (p.signal as number) ?? 9),
});

backtestRegistry.register({
  name: "macdCrossDown",
  displayName: "MACD Cross Down",
  category: "momentum",
  params: {
    fast: { type: "number", default: 12, min: 1 },
    slow: { type: "number", default: 26, min: 1 },
    signal: { type: "number", default: 9, min: 1 },
  },
  create: (p) =>
    macdCrossDown((p.fast as number) ?? 12, (p.slow as number) ?? 26, (p.signal as number) ?? 9),
});

// ============================================
// Bollinger Bands
// ============================================

backtestRegistry.register({
  name: "bollingerBreakout",
  displayName: "Bollinger Breakout",
  category: "volatility",
  params: {
    band: {
      type: "string",
      default: "lower",
      enum: ["upper", "lower"],
      description: "Band to check",
    },
    period: { type: "number", default: 20, min: 1 },
    stdDev: { type: "number", default: 2, min: 0.1 },
  },
  create: (p) =>
    bollingerBreakout(
      (p.band as "upper" | "lower") ?? "lower",
      (p.period as number) ?? 20,
      (p.stdDev as number) ?? 2,
    ),
});

backtestRegistry.register({
  name: "bollingerTouch",
  displayName: "Bollinger Touch",
  category: "volatility",
  params: {
    band: {
      type: "string",
      default: "lower",
      enum: ["upper", "lower"],
      description: "Band to check",
    },
    period: { type: "number", default: 20, min: 1 },
    stdDev: { type: "number", default: 2, min: 0.1 },
  },
  create: (p) =>
    bollingerTouch(
      (p.band as "upper" | "lower") ?? "lower",
      (p.period as number) ?? 20,
      (p.stdDev as number) ?? 2,
    ),
});

// ============================================
// Price
// ============================================

backtestRegistry.register({
  name: "priceAboveSma",
  displayName: "Price Above SMA",
  category: "trend",
  params: {
    period: { type: "number", default: 200, min: 1, required: true, description: "SMA period" },
  },
  create: (p) => priceAboveSma((p.period as number) ?? 200),
});

backtestRegistry.register({
  name: "priceBelowSma",
  displayName: "Price Below SMA",
  category: "trend",
  params: {
    period: { type: "number", default: 200, min: 1, required: true, description: "SMA period" },
  },
  create: (p) => priceBelowSma((p.period as number) ?? 200),
});

backtestRegistry.register({
  name: "priceDroppedAtr",
  displayName: "Price Dropped ATR",
  category: "volatility",
  params: {
    multiplier: { type: "number", default: 2.0, min: 0.1 },
    lookback: { type: "number", default: 10, min: 1 },
    atrPeriod: { type: "number", default: 14, min: 1 },
  },
  create: (p) =>
    priceDroppedAtr(
      (p.multiplier as number) ?? 2.0,
      (p.lookback as number) ?? 10,
      (p.atrPeriod as number) ?? 14,
    ),
});

// ============================================
// Perfect Order (Basic)
// ============================================

const poParams = {
  periods: { type: "number" as const, description: "MA periods (array via JSON)" },
};

backtestRegistry.register({
  name: "perfectOrderBullish",
  displayName: "Perfect Order Bullish",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderBullish(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderBearish",
  displayName: "Perfect Order Bearish",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderBearish(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderCollapsed",
  displayName: "Perfect Order Collapsed",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderCollapsed(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderActiveBullish",
  displayName: "Perfect Order Active Bullish",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderActiveBullish(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderActiveBearish",
  displayName: "Perfect Order Active Bearish",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderActiveBearish(p.periods ? { periods: p.periods as number[] } : {}),
});

// ============================================
// Perfect Order (Enhanced)
// ============================================

backtestRegistry.register({
  name: "perfectOrderBullishConfirmed",
  displayName: "PO Bullish Confirmed",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderBullishConfirmed(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderBearishConfirmed",
  displayName: "PO Bearish Confirmed",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderBearishConfirmed(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderConfirmationFormed",
  displayName: "PO Confirmation Formed",
  category: "trend",
  params: poParams,
  create: (p) =>
    perfectOrderConfirmationFormed(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderBreakdown",
  displayName: "PO Breakdown",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderBreakdown(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderMaCollapsed",
  displayName: "PO MA Collapsed",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderMaCollapsed(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderPreBullish",
  displayName: "PO Pre-Bullish",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderPreBullish(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderPreBearish",
  displayName: "PO Pre-Bearish",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderPreBearish(p.periods ? { periods: p.periods as number[] } : {}),
});

// ============================================
// Perfect Order (Pullback / Entry)
// ============================================

backtestRegistry.register({
  name: "perfectOrderPullbackEntry",
  displayName: "PO Pullback Entry (Buy)",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderPullbackEntry(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "perfectOrderPullbackSellEntry",
  displayName: "PO Pullback Entry (Sell)",
  category: "trend",
  params: poParams,
  create: (p) => perfectOrderPullbackSellEntry(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "poPlusEntry",
  displayName: "PO+ Entry",
  category: "trend",
  params: poParams,
  create: (p) => poPlusEntry(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "pbEntry",
  displayName: "PB Entry",
  category: "trend",
  params: poParams,
  create: (p) => pbEntry(p.periods ? { periods: p.periods as number[] } : {}),
});

backtestRegistry.register({
  name: "poPlusPbEntry",
  displayName: "PO+ PB Entry",
  category: "trend",
  params: poParams,
  create: (p) => poPlusPbEntry(p.periods ? { periods: p.periods as number[] } : {}),
});

// ============================================
// Stochastics
// ============================================

backtestRegistry.register({
  name: "stochBelow",
  displayName: "Stoch %K Below",
  category: "momentum",
  params: {
    threshold: { type: "number", default: 20, min: 0, max: 100 },
    kPeriod: { type: "number", default: 14, min: 1 },
    dPeriod: { type: "number", default: 3, min: 1 },
  },
  create: (p) =>
    stochBelow(
      (p.threshold as number) ?? 20,
      (p.kPeriod as number) ?? 14,
      (p.dPeriod as number) ?? 3,
    ),
});

backtestRegistry.register({
  name: "stochAbove",
  displayName: "Stoch %K Above",
  category: "momentum",
  params: {
    threshold: { type: "number", default: 80, min: 0, max: 100 },
    kPeriod: { type: "number", default: 14, min: 1 },
    dPeriod: { type: "number", default: 3, min: 1 },
  },
  create: (p) =>
    stochAbove(
      (p.threshold as number) ?? 80,
      (p.kPeriod as number) ?? 14,
      (p.dPeriod as number) ?? 3,
    ),
});

backtestRegistry.register({
  name: "stochCrossUp",
  displayName: "Stoch Cross Up",
  category: "momentum",
  params: {
    kPeriod: { type: "number", default: 14, min: 1 },
    dPeriod: { type: "number", default: 3, min: 1 },
  },
  create: (p) => stochCrossUp((p.kPeriod as number) ?? 14, (p.dPeriod as number) ?? 3),
});

backtestRegistry.register({
  name: "stochCrossDown",
  displayName: "Stoch Cross Down",
  category: "momentum",
  params: {
    kPeriod: { type: "number", default: 14, min: 1 },
    dPeriod: { type: "number", default: 3, min: 1 },
  },
  create: (p) => stochCrossDown((p.kPeriod as number) ?? 14, (p.dPeriod as number) ?? 3),
});

// ============================================
// DMI / ADX
// ============================================

backtestRegistry.register({
  name: "dmiBullish",
  displayName: "DMI Bullish",
  category: "trend",
  params: {
    minAdx: { type: "number", default: 20, min: 0 },
    period: { type: "number", default: 14, min: 1 },
  },
  create: (p) => dmiBullish((p.minAdx as number) ?? 20, (p.period as number) ?? 14),
});

backtestRegistry.register({
  name: "dmiBearish",
  displayName: "DMI Bearish",
  category: "trend",
  params: {
    minAdx: { type: "number", default: 20, min: 0 },
    period: { type: "number", default: 14, min: 1 },
  },
  create: (p) => dmiBearish((p.minAdx as number) ?? 20, (p.period as number) ?? 14),
});

backtestRegistry.register({
  name: "adxStrong",
  displayName: "ADX Strong",
  category: "trend",
  params: {
    threshold: { type: "number", default: 25, min: 0 },
    period: { type: "number", default: 14, min: 1 },
  },
  isFilter: true,
  create: (p) => adxStrong((p.threshold as number) ?? 25, (p.period as number) ?? 14),
});

// ============================================
// Volume
// ============================================

backtestRegistry.register({
  name: "volumeAboveAvg",
  displayName: "Volume Above Average",
  category: "volume",
  params: {
    multiplier: { type: "number", default: 1.5, min: 0.1, description: "Volume multiplier" },
    period: { type: "number", default: 20, min: 1 },
  },
  isFilter: true,
  create: (p) => volumeAboveAvg((p.multiplier as number) ?? 1.5, (p.period as number) ?? 20),
});

// ============================================
// Volume Advanced (Anomaly / Profile)
// ============================================

backtestRegistry.register({
  name: "volumeAnomalyCondition",
  displayName: "Volume Anomaly",
  category: "volume",
  params: {
    threshold: { type: "number", default: 2.0, min: 0.1 },
    period: { type: "number", default: 20, min: 1 },
  },
  create: (p) => volumeAnomalyCondition((p.threshold as number) ?? 2.0, (p.period as number) ?? 20),
});

backtestRegistry.register({
  name: "volumeExtreme",
  displayName: "Volume Extreme",
  category: "volume",
  params: {
    threshold: { type: "number", default: 3.0, min: 0.1 },
    period: { type: "number", default: 20, min: 1 },
  },
  create: (p) => volumeExtreme((p.threshold as number) ?? 3.0, (p.period as number) ?? 20),
});

backtestRegistry.register({
  name: "volumeRatioAbove",
  displayName: "Volume Ratio Above",
  category: "volume",
  params: {
    minRatio: { type: "number", default: 1.5, min: 0.1 },
    period: { type: "number", default: 20, min: 1 },
  },
  create: (p) => volumeRatioAbove((p.minRatio as number) ?? 1.5, (p.period as number) ?? 20),
});

backtestRegistry.register({
  name: "nearPoc",
  displayName: "Near POC",
  category: "volume",
  params: {
    tolerance: { type: "number", default: 0.02, min: 0.001 },
    profilePeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => nearPoc((p.tolerance as number) ?? 0.02, (p.profilePeriod as number) ?? 20),
});

backtestRegistry.register({
  name: "inValueArea",
  displayName: "In Value Area",
  category: "volume",
  params: {
    profilePeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => inValueArea((p.profilePeriod as number) ?? 20),
});

backtestRegistry.register({
  name: "breakoutVah",
  displayName: "Breakout VAH",
  category: "volume",
  params: {
    profilePeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => breakoutVah((p.profilePeriod as number) ?? 20),
});

backtestRegistry.register({
  name: "breakdownVal",
  displayName: "Breakdown VAL",
  category: "volume",
  params: {
    profilePeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => breakdownVal((p.profilePeriod as number) ?? 20),
});

backtestRegistry.register({
  name: "priceAbovePoc",
  displayName: "Price Above POC",
  category: "volume",
  params: {
    profilePeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => priceAbovePoc((p.profilePeriod as number) ?? 20),
});

backtestRegistry.register({
  name: "priceBelowPoc",
  displayName: "Price Below POC",
  category: "volume",
  params: {
    profilePeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => priceBelowPoc((p.profilePeriod as number) ?? 20),
});

// ============================================
// Volume Advanced (Trend / CMF / OBV)
// ============================================

backtestRegistry.register({
  name: "volumeConfirmsTrend",
  displayName: "Volume Confirms Trend",
  category: "volume",
  params: {},
  create: () => volumeConfirmsTrend(),
});

backtestRegistry.register({
  name: "volumeDivergence",
  displayName: "Volume Divergence",
  category: "volume",
  params: {},
  create: () => volumeDivergence(),
});

backtestRegistry.register({
  name: "bullishVolumeDivergence",
  displayName: "Bullish Volume Divergence",
  category: "volume",
  params: {},
  create: () => bullishVolumeDivergence(),
});

backtestRegistry.register({
  name: "bearishVolumeDivergence",
  displayName: "Bearish Volume Divergence",
  category: "volume",
  params: {},
  create: () => bearishVolumeDivergence(),
});

backtestRegistry.register({
  name: "volumeTrendConfidence",
  displayName: "Volume Trend Confidence",
  category: "volume",
  params: {
    minConfidence: { type: "number", default: 60, min: 0, max: 100 },
  },
  create: (p) => volumeTrendConfidence((p.minConfidence as number) ?? 60),
});

backtestRegistry.register({
  name: "cmfAbove",
  displayName: "CMF Above",
  category: "volume",
  params: {
    threshold: { type: "number", default: 0 },
    period: { type: "number", default: 20, min: 1 },
  },
  create: (p) => cmfAbove((p.threshold as number) ?? 0, (p.period as number) ?? 20),
});

backtestRegistry.register({
  name: "cmfBelow",
  displayName: "CMF Below",
  category: "volume",
  params: {
    threshold: { type: "number", default: 0 },
    period: { type: "number", default: 20, min: 1 },
  },
  create: (p) => cmfBelow((p.threshold as number) ?? 0, (p.period as number) ?? 20),
});

backtestRegistry.register({
  name: "obvRising",
  displayName: "OBV Rising",
  category: "volume",
  params: {
    period: { type: "number", default: 10, min: 1 },
  },
  create: (p) => obvRising((p.period as number) ?? 10),
});

backtestRegistry.register({
  name: "obvFalling",
  displayName: "OBV Falling",
  category: "volume",
  params: {
    period: { type: "number", default: 10, min: 1 },
  },
  create: (p) => obvFalling((p.period as number) ?? 10),
});

backtestRegistry.register({
  name: "obvCrossUp",
  displayName: "OBV Cross Up",
  category: "volume",
  params: {
    shortPeriod: { type: "number", default: 5, min: 1 },
    longPeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => obvCrossUp((p.shortPeriod as number) ?? 5, (p.longPeriod as number) ?? 20),
});

backtestRegistry.register({
  name: "obvCrossDown",
  displayName: "OBV Cross Down",
  category: "volume",
  params: {
    shortPeriod: { type: "number", default: 5, min: 1 },
    longPeriod: { type: "number", default: 20, min: 1 },
  },
  create: (p) => obvCrossDown((p.shortPeriod as number) ?? 5, (p.longPeriod as number) ?? 20),
});

// ============================================
// Volatility Regime
// ============================================

backtestRegistry.register({
  name: "regimeIs",
  displayName: "Regime Is",
  category: "volatility",
  params: {
    regime: {
      type: "string",
      required: true,
      enum: ["low", "normal", "high", "extreme"],
      description: "Target regime",
    },
  },
  isFilter: true,
  create: (p) => regimeIs(p.regime as "low" | "normal" | "high" | "extreme"),
});

backtestRegistry.register({
  name: "regimeNot",
  displayName: "Regime Not",
  category: "volatility",
  params: {
    regime: { type: "string", required: true, enum: ["low", "normal", "high", "extreme"] },
  },
  isFilter: true,
  create: (p) => regimeNot(p.regime as "low" | "normal" | "high" | "extreme"),
});

backtestRegistry.register({
  name: "volatilityAbove",
  displayName: "Volatility Above",
  category: "volatility",
  params: {
    percentile: { type: "number", required: true, min: 0, max: 100 },
  },
  isFilter: true,
  create: (p) => volatilityAbove(p.percentile as number),
});

backtestRegistry.register({
  name: "volatilityBelow",
  displayName: "Volatility Below",
  category: "volatility",
  params: {
    percentile: { type: "number", required: true, min: 0, max: 100 },
  },
  isFilter: true,
  create: (p) => volatilityBelow(p.percentile as number),
});

backtestRegistry.register({
  name: "atrPercentileAbove",
  displayName: "ATR Percentile Above",
  category: "volatility",
  params: {
    percentile: { type: "number", required: true, min: 0, max: 100 },
  },
  isFilter: true,
  create: (p) => atrPercentileAbove(p.percentile as number),
});

backtestRegistry.register({
  name: "atrPercentileBelow",
  displayName: "ATR Percentile Below",
  category: "volatility",
  params: {
    percentile: { type: "number", required: true, min: 0, max: 100 },
  },
  isFilter: true,
  create: (p) => atrPercentileBelow(p.percentile as number),
});

backtestRegistry.register({
  name: "regimeConfidenceAbove",
  displayName: "Regime Confidence Above",
  category: "volatility",
  params: {
    confidence: { type: "number", required: true, min: 0, max: 100 },
  },
  isFilter: true,
  create: (p) => regimeConfidenceAbove(p.confidence as number),
});

backtestRegistry.register({
  name: "volatilityExpanding",
  displayName: "Volatility Expanding",
  category: "volatility",
  params: {
    threshold: { type: "number", default: 20, min: 0 },
    lookback: { type: "number", default: 5, min: 1 },
  },
  isFilter: true,
  create: (p) => volatilityExpanding((p.threshold as number) ?? 20, (p.lookback as number) ?? 5),
});

backtestRegistry.register({
  name: "volatilityContracting",
  displayName: "Volatility Contracting",
  category: "volatility",
  params: {
    threshold: { type: "number", default: 20, min: 0 },
    lookback: { type: "number", default: 5, min: 1 },
  },
  isFilter: true,
  create: (p) => volatilityContracting((p.threshold as number) ?? 20, (p.lookback as number) ?? 5),
});

backtestRegistry.register({
  name: "atrPercentAbove",
  displayName: "ATR% Above",
  category: "volatility",
  params: {
    threshold: { type: "number", default: 3.0, min: 0 },
  },
  isFilter: true,
  create: (p) => atrPercentAbove((p.threshold as number) ?? 3.0),
});

backtestRegistry.register({
  name: "atrPercentBelow",
  displayName: "ATR% Below",
  category: "volatility",
  params: {
    threshold: { type: "number", required: true, min: 0 },
  },
  isFilter: true,
  create: (p) => atrPercentBelow(p.threshold as number),
});

// ============================================
// Range-Bound
// ============================================

backtestRegistry.register({
  name: "inRangeBound",
  displayName: "In Range-Bound",
  category: "range",
  params: {},
  create: () => inRangeBound(),
});

backtestRegistry.register({
  name: "rangeForming",
  displayName: "Range Forming",
  category: "range",
  params: {},
  create: () => rangeForming(),
});

backtestRegistry.register({
  name: "rangeConfirmed",
  displayName: "Range Confirmed",
  category: "range",
  params: {},
  create: () => rangeConfirmed(),
});

backtestRegistry.register({
  name: "breakoutRiskUp",
  displayName: "Breakout Risk Up",
  category: "range",
  params: {},
  create: () => breakoutRiskUp(),
});

backtestRegistry.register({
  name: "breakoutRiskDown",
  displayName: "Breakout Risk Down",
  category: "range",
  params: {},
  create: () => breakoutRiskDown(),
});

backtestRegistry.register({
  name: "rangeBreakout",
  displayName: "Range Breakout",
  category: "range",
  params: {},
  create: () => rangeBreakout(),
});

backtestRegistry.register({
  name: "tightRange",
  displayName: "Tight Range",
  category: "range",
  params: {},
  create: () => tightRange(),
});

backtestRegistry.register({
  name: "rangeScoreAbove",
  displayName: "Range Score Above",
  category: "range",
  params: {
    threshold: { type: "number", default: 60, min: 0, max: 100 },
  },
  create: (p) => rangeScoreAbove((p.threshold as number) ?? 60),
});

// ============================================
// Patterns
// ============================================

backtestRegistry.register({
  name: "patternDetected",
  displayName: "Pattern Detected",
  category: "pattern",
  params: {
    type: { type: "string", required: true, description: "Pattern type name" },
  },
  create: (p) => patternDetected(p.type as PatternType),
});

backtestRegistry.register({
  name: "patternConfirmed",
  displayName: "Pattern Confirmed",
  category: "pattern",
  params: {
    type: { type: "string", required: true },
  },
  create: (p) => patternConfirmed(p.type as PatternType),
});

backtestRegistry.register({
  name: "anyBullishPattern",
  displayName: "Any Bullish Pattern",
  category: "pattern",
  params: {},
  create: () => anyBullishPattern(),
});

backtestRegistry.register({
  name: "anyBearishPattern",
  displayName: "Any Bearish Pattern",
  category: "pattern",
  params: {},
  create: () => anyBearishPattern(),
});

backtestRegistry.register({
  name: "patternConfidenceAbove",
  displayName: "Pattern Confidence Above",
  category: "pattern",
  params: {
    type: { type: "string", required: true },
    minConfidence: { type: "number", default: 70, min: 0, max: 100 },
  },
  create: (p) => patternConfidenceAbove(p.type as PatternType, (p.minConfidence as number) ?? 70),
});

backtestRegistry.register({
  name: "anyPatternConfidenceAbove",
  displayName: "Any Pattern Confidence Above",
  category: "pattern",
  params: {
    minConfidence: { type: "number", default: 70, min: 0, max: 100 },
  },
  create: (p) => anyPatternConfidenceAbove((p.minConfidence as number) ?? 70),
});

backtestRegistry.register({
  name: "patternWithinBars",
  displayName: "Pattern Within Bars",
  category: "pattern",
  params: {
    type: { type: "string", required: true },
    lookback: { type: "number", default: 5, min: 1 },
  },
  create: (p) => patternWithinBars(p.type as PatternType, (p.lookback as number) ?? 5),
});

backtestRegistry.register({
  name: "doubleTopDetected",
  displayName: "Double Top",
  category: "pattern",
  params: {},
  create: () => doubleTopDetected(),
});
backtestRegistry.register({
  name: "doubleBottomDetected",
  displayName: "Double Bottom",
  category: "pattern",
  params: {},
  create: () => doubleBottomDetected(),
});
backtestRegistry.register({
  name: "headShouldersDetected",
  displayName: "Head & Shoulders",
  category: "pattern",
  params: {},
  create: () => headShouldersDetected(),
});
backtestRegistry.register({
  name: "inverseHeadShouldersDetected",
  displayName: "Inverse H&S",
  category: "pattern",
  params: {},
  create: () => inverseHeadShouldersDetected(),
});
backtestRegistry.register({
  name: "cupHandleDetected",
  displayName: "Cup & Handle",
  category: "pattern",
  params: {},
  create: () => cupHandleDetected(),
});

backtestRegistry.register({
  name: "triangleDetected",
  displayName: "Triangle Detected",
  category: "pattern",
  params: {
    subtype: {
      type: "string",
      enum: ["ascending", "descending", "symmetrical"],
      description: "Triangle subtype",
    },
  },
  create: (p) =>
    triangleDetected(
      p.subtype as
        | "triangle_symmetrical"
        | "triangle_ascending"
        | "triangle_descending"
        | undefined,
    ),
});

backtestRegistry.register({
  name: "wedgeDetected",
  displayName: "Wedge Detected",
  category: "pattern",
  params: {
    subtype: { type: "string", enum: ["rising", "falling"], description: "Wedge subtype" },
  },
  create: (p) => wedgeDetected(p.subtype as "rising_wedge" | "falling_wedge" | undefined),
});

backtestRegistry.register({
  name: "channelDetected",
  displayName: "Channel Detected",
  category: "pattern",
  params: {
    subtype: {
      type: "string",
      enum: ["ascending", "descending", "horizontal"],
      description: "Channel subtype",
    },
  },
  create: (p) =>
    channelDetected(
      p.subtype as "channel_ascending" | "channel_descending" | "channel_horizontal" | undefined,
    ),
});

backtestRegistry.register({
  name: "flagDetected",
  displayName: "Flag Detected",
  category: "pattern",
  params: {
    subtype: { type: "string", enum: ["bull", "bear"], description: "Flag subtype" },
  },
  create: (p) =>
    flagDetected(
      p.subtype as "bull_flag" | "bear_flag" | "bull_pennant" | "bear_pennant" | undefined,
    ),
});

backtestRegistry.register({
  name: "bullFlagDetected",
  displayName: "Bull Flag",
  category: "pattern",
  params: {},
  create: () => bullFlagDetected(),
});
backtestRegistry.register({
  name: "bearFlagDetected",
  displayName: "Bear Flag",
  category: "pattern",
  params: {},
  create: () => bearFlagDetected(),
});

backtestRegistry.register({
  name: "harmonicPatternDetected",
  displayName: "Harmonic Pattern",
  category: "pattern",
  params: {
    subtype: {
      type: "string",
      enum: ["gartley", "bat", "butterfly", "crab", "abcd"],
      description: "Harmonic pattern subtype",
    },
  },
  create: (p) => harmonicPatternDetected(p.subtype as PatternType | undefined),
});

backtestRegistry.register({
  name: "bullishHarmonicDetected",
  displayName: "Bullish Harmonic",
  category: "pattern",
  params: {},
  create: () => bullishHarmonicDetected(),
});
backtestRegistry.register({
  name: "bearishHarmonicDetected",
  displayName: "Bearish Harmonic",
  category: "pattern",
  params: {},
  create: () => bearishHarmonicDetected(),
});

// ============================================
// SMC (Smart Money Concepts)
// ============================================

backtestRegistry.register({
  name: "priceAtBullishOrderBlock",
  displayName: "Price at Bullish OB",
  category: "smc",
  params: {},
  create: () => priceAtBullishOrderBlock(),
});
backtestRegistry.register({
  name: "priceAtBearishOrderBlock",
  displayName: "Price at Bearish OB",
  category: "smc",
  params: {},
  create: () => priceAtBearishOrderBlock(),
});
backtestRegistry.register({
  name: "priceAtOrderBlock",
  displayName: "Price at Order Block",
  category: "smc",
  params: {},
  create: () => priceAtOrderBlock(),
});

backtestRegistry.register({
  name: "orderBlockCreated",
  displayName: "Order Block Created",
  category: "smc",
  params: {
    type: { type: "string", enum: ["bullish", "bearish"], description: "OB type" },
  },
  create: (p) => orderBlockCreated(p.type as "bullish" | "bearish" | undefined),
});

backtestRegistry.register({
  name: "orderBlockMitigated",
  displayName: "Order Block Mitigated",
  category: "smc",
  params: {
    type: { type: "string", enum: ["bullish", "bearish"] },
  },
  create: (p) => orderBlockMitigated(p.type as "bullish" | "bearish" | undefined),
});

backtestRegistry.register({
  name: "hasActiveOrderBlocks",
  displayName: "Has Active Order Blocks",
  category: "smc",
  params: {
    type: { type: "string", enum: ["bullish", "bearish"] },
    minCount: { type: "number", default: 1, min: 1 },
  },
  create: (p) =>
    hasActiveOrderBlocks(p.type as "bullish" | "bearish" | undefined, (p.minCount as number) ?? 1),
});

backtestRegistry.register({
  name: "liquiditySweepDetected",
  displayName: "Liquidity Sweep Detected",
  category: "smc",
  params: {
    type: { type: "string", enum: ["bullish", "bearish"] },
  },
  create: (p) => liquiditySweepDetected(p.type as "bullish" | "bearish" | undefined),
});

backtestRegistry.register({
  name: "liquiditySweepRecovered",
  displayName: "Liquidity Sweep Recovered",
  category: "smc",
  params: {
    type: { type: "string", enum: ["bullish", "bearish"] },
  },
  create: (p) => liquiditySweepRecovered(p.type as "bullish" | "bearish" | undefined),
});

backtestRegistry.register({
  name: "hasRecentSweeps",
  displayName: "Has Recent Sweeps",
  category: "smc",
  params: {
    type: { type: "string", enum: ["bullish", "bearish"] },
    recoveredOnly: { type: "boolean", default: false },
    minCount: { type: "number", default: 1, min: 1 },
  },
  create: (p) =>
    hasRecentSweeps(
      p.type as "bullish" | "bearish" | undefined,
      (p.recoveredOnly as boolean) ?? false,
      (p.minCount as number) ?? 1,
    ),
});

backtestRegistry.register({
  name: "sweepDepthAbove",
  displayName: "Sweep Depth Above",
  category: "smc",
  params: {
    minDepth: { type: "number", required: true, min: 0, description: "Minimum sweep depth" },
    type: { type: "string", enum: ["bullish", "bearish"] },
  },
  create: (p) => sweepDepthAbove(p.minDepth as number, p.type as "bullish" | "bearish" | undefined),
});

// ============================================
// Fundamental
// ============================================

backtestRegistry.register({
  name: "perBelow",
  displayName: "PER Below",
  category: "fundamental",
  params: {
    threshold: { type: "number", required: true, description: "PER threshold" },
  },
  isFilter: true,
  create: (p) => perBelow(p.threshold as number),
});

backtestRegistry.register({
  name: "perAbove",
  displayName: "PER Above",
  category: "fundamental",
  params: {
    threshold: { type: "number", required: true },
  },
  isFilter: true,
  create: (p) => perAbove(p.threshold as number),
});

backtestRegistry.register({
  name: "perBetween",
  displayName: "PER Between",
  category: "fundamental",
  params: {
    min: { type: "number", required: true },
    max: { type: "number", required: true },
  },
  isFilter: true,
  create: (p) => perBetween(p.min as number, p.max as number),
});

backtestRegistry.register({
  name: "pbrBelow",
  displayName: "PBR Below",
  category: "fundamental",
  params: {
    threshold: { type: "number", required: true },
  },
  isFilter: true,
  create: (p) => pbrBelow(p.threshold as number),
});

backtestRegistry.register({
  name: "pbrAbove",
  displayName: "PBR Above",
  category: "fundamental",
  params: {
    threshold: { type: "number", required: true },
  },
  isFilter: true,
  create: (p) => pbrAbove(p.threshold as number),
});

backtestRegistry.register({
  name: "pbrBetween",
  displayName: "PBR Between",
  category: "fundamental",
  params: {
    min: { type: "number", required: true },
    max: { type: "number", required: true },
  },
  isFilter: true,
  create: (p) => pbrBetween(p.min as number, p.max as number),
});
