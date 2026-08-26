/**
 * Browser-compatible stock screening functions
 *
 * This module contains only browser-safe code without Node.js fs dependencies.
 */

// Import all conditions for CLI name resolution
import * as conditions from "../backtest/conditions";
import { evaluateCondition } from "../backtest/conditions/core";
import { buildMtfSetup, updateMtfIndices } from "../core/mtf-context";
import { rsi } from "../indicators/momentum/rsi";
import { calculateAtrPercentDetail } from "../indicators/volatility/atr-filter";
import { volumeMa } from "../indicators/volume/volume-ma";
import type { Condition, NormalizedCandle } from "../types";
import { err, ok, type Result, tcError } from "../types/result";
import type {
  ScreeningCriteria,
  ScreeningResult,
  ScreeningSeriesPoint,
  ScreeningSeriesResult,
  ScreenStockOptions,
  ScreenStockSeriesOptions,
} from "./types";

/**
 * An optional metric is reported only when it is a real number.
 *
 * Every field of `ScreeningResult.metrics` is optional precisely so that
 * "could not evaluate" has a representation of its own. A non-finite value
 * would put a number-typed nothing in a slot callers format and compare.
 */
function finiteOrAbsent(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * The headline fields of a {@link ScreeningResult} that must be real numbers
 * for the result to be reportable: every formatter prints them, and
 * `atrPercent` is the key results are ranked by.
 *
 * Unlike `metrics`, these are not optional — a result that cannot supply them
 * is not a result, so `runScreening` skips the symbol instead.
 */
const REQUIRED_FINITE_FIELDS = ["currentPrice", "timestamp", "atrPercent"] as const;

/**
 * Name the first headline field that is not usable, or `null` when the result
 * is fully reportable.
 *
 * Checks that `currentPrice`, `timestamp` and `atrPercent` are real numbers,
 * and that `atrSampleCount` is a positive whole number of bars — a finite
 * `atrPercent` backed by no measurement is a placeholder, not a reading.
 *
 * @param result - A result produced by {@link screenStock}
 * @returns The offending field name, or `null`
 *
 * @example
 * ```ts
 * import { firstUncomputableField, screenStock } from "trendcraft";
 *
 * const screened = screenStock("AAAA", candles, criteria);
 * const bad = firstUncomputableField(screened);
 * if (bad !== null) console.log(`${screened.ticker}: ${bad} is not computable`);
 * ```
 */
export function firstUncomputableField(result: ScreeningResult): string | null {
  for (const field of REQUIRED_FINITE_FIELDS) {
    if (!Number.isFinite(result[field])) return field;
  }
  // A finite `atrPercent` is not necessarily a measured one: with fewer
  // candles than the ATR period, or no bar with a positive close, it is a
  // substituted 0 that no finiteness check can tell from a flat series.
  //
  // Checking `=== 0` would only catch the shape this package produces. The
  // count arrives from outside at runtime too: this function is exported,
  // JavaScript callers are not held to the type, and through JSON a field
  // that predates this release is simply absent while a `NaN` arrives as
  // `null`. All of those are `!== 0`. A count is a whole number of bars.
  if (!Number.isInteger(result.atrSampleCount) || result.atrSampleCount <= 0) {
    return "atrPercent";
  }
  return null;
}

/**
 * Screen a single stock against criteria
 *
 * @param ticker - Stock ticker symbol
 * @param candles - Normalized candle data
 * @param criteria - Entry/exit conditions
 * @param options - Additional options
 * @returns Screening result for the stock
 *
 * @example
 * ```ts
 * import { screenStock } from "trendcraft/screening";
 * import { and, goldenCrossCondition, deadCrossCondition, volumeAnomalyCondition } from "trendcraft";
 *
 * const result = screenStock("6758.T", candles, {
 *   entry: and(goldenCrossCondition(5, 25), volumeAnomalyCondition(2.0, 20)),
 *   exit: deadCrossCondition(5, 25),
 * });
 *
 * if (result.entrySignal) {
 *   console.log(`Entry signal for ${result.ticker}!`);
 * }
 * ```
 */
export function screenStock(
  ticker: string,
  candles: NormalizedCandle[],
  criteria: ScreeningCriteria,
  options: ScreenStockOptions = {},
): ScreeningResult {
  const { includeCandles = false, mtfTimeframes } = options;

  if (candles.length === 0) {
    throw new Error("No candle data");
  }

  const lastIndex = candles.length - 1;
  const lastCandle = candles[lastIndex];
  const indicators: Record<string, unknown> = {};

  // Build MTF context (if requested) and align it to the latest bar.
  const mtf = buildMtfSetup(candles, mtfTimeframes);
  if (mtf) {
    updateMtfIndices(mtf.context, mtf.indexMap, lastIndex, lastCandle.time);
  }

  // Evaluate entry condition on latest bar
  const entrySignal = evaluateCondition(
    criteria.entry,
    indicators,
    lastCandle,
    lastIndex,
    candles,
    mtf?.context,
  );

  // Evaluate exit condition if provided
  const exitSignal = criteria.exit
    ? evaluateCondition(criteria.exit, indicators, lastCandle, lastIndex, candles, mtf?.context)
    : false;

  // Calculate ATR%. `sampleCount === 0` means nothing could be measured, in
  // which case `atrPercent` is a placeholder 0 rather than a flat reading.
  const { atrPercent, sampleCount: atrSampleCount } = calculateAtrPercentDetail(candles);

  // Calculate additional metrics
  const rsiData = rsi(candles, { period: 14 });
  const rsi14 = rsiData[lastIndex]?.value ?? undefined;

  // `1` would mean "volume is exactly average" — a real reading — so it
  // cannot double as "no average to compare against". Report the absence the
  // way `rsi14` above does, which is what the optional field type and both
  // formatters already expect.
  const volMaData = volumeMa(candles, { period: 20 });
  // The average must be finite as well as positive: an overflowing volume
  // column makes it `Infinity`, and `Infinity / Infinity` is `NaN` while
  // `1e308 / Infinity` is a perfectly plausible-looking `0`.
  const avgVolume = volMaData[lastIndex]?.value ?? null;
  const volumeRatio =
    avgVolume !== null && Number.isFinite(avgVolume) && avgVolume > 0
      ? lastCandle.volume / avgVolume
      : undefined;

  return {
    ticker,
    entrySignal,
    exitSignal,
    currentPrice: lastCandle.close,
    timestamp: lastCandle.time,
    atrPercent,
    atrSampleCount,
    metrics: {
      rsi14: finiteOrAbsent(rsi14),
      volume: finiteOrAbsent(lastCandle.volume),
      volumeRatio: finiteOrAbsent(volumeRatio),
    },
    candles: includeCandles ? candles : undefined,
  };
}

/**
 * Screen a single stock across every bar of its history, reporting when the
 * criteria matched as of each bar — rather than only the latest bar as
 * {@link screenStock} does. Useful for finding *when* a stock first matched,
 * backtesting a screen, or screening as of a past date (`result.points[i]`).
 *
 * Each bar is evaluated with the same per-bar condition evaluator the backtest
 * engine uses, so the result is identical to what a backtest would see at that
 * bar. Like the backtest engine, indicators are computed once over the full
 * series; this is point-in-time correct for causal indicators (moving averages,
 * RSI, …) but, for non-causal ones (e.g. Ichimoku's forward-displaced spans,
 * swing points that need future bars to confirm), a match near the right edge
 * can reflect data that would not yet have been known live — the same caveat
 * that applies to backtesting.
 *
 * Unlike {@link screenStock}, this does not throw on empty input — it returns an
 * empty `points` array, since a screen over zero bars is naturally empty.
 *
 * @param ticker - Stock ticker symbol
 * @param candles - Normalized candle data
 * @param criteria - Entry/exit conditions
 * @returns Per-bar screen results, one entry per candle
 *
 * @example
 * ```ts
 * import { screenStockSeries } from "trendcraft/screening";
 * import { goldenCrossCondition, deadCrossCondition } from "trendcraft";
 *
 * const { points } = screenStockSeries("6758.T", candles, {
 *   entry: goldenCrossCondition(5, 25),
 *   exit: deadCrossCondition(5, 25),
 * });
 * const entryBars = points.filter((p) => p.entrySignal);
 * ```
 */
export function screenStockSeries(
  ticker: string,
  candles: NormalizedCandle[],
  criteria: ScreeningCriteria,
  options: ScreenStockSeriesOptions = {},
): ScreeningSeriesResult {
  const { mtfTimeframes } = options;

  // One shared indicator cache across all bars, matching the backtest engine:
  // each indicator is computed once over the full series and read by index.
  const indicators: Record<string, unknown> = {};
  const mtf = buildMtfSetup(candles, mtfTimeframes);
  const points: ScreeningSeriesPoint[] = [];

  for (let index = 0; index < candles.length; index++) {
    const candle = candles[index];
    // Advance MTF indices to this bar so conditions see only closed HTF data.
    if (mtf) {
      updateMtfIndices(mtf.context, mtf.indexMap, index, candle.time);
    }
    points.push({
      index,
      time: candle.time,
      close: candle.close,
      entrySignal: evaluateCondition(
        criteria.entry,
        indicators,
        candle,
        index,
        candles,
        mtf?.context,
      ),
      exitSignal: criteria.exit
        ? evaluateCondition(criteria.exit, indicators, candle, index, candles, mtf?.context)
        : false,
    });
  }

  return { ticker, points };
}

// ============================================
// CLI Helper: Condition Name Mappings
// ============================================

/**
 * Available condition presets for CLI
 */
export const CONDITION_PRESETS: Record<string, () => Condition> = {
  // Moving Average Cross
  goldenCross: () => conditions.goldenCross(5, 25),
  deadCross: () => conditions.deadCross(5, 25),
  goldenCross25_75: () => conditions.goldenCross(25, 75),
  deadCross25_75: () => conditions.deadCross(25, 75),

  // RSI
  rsiBelow30: () => conditions.rsiBelow(30),
  rsiBelow40: () => conditions.rsiBelow(40),
  rsiAbove60: () => conditions.rsiAbove(60),
  rsiAbove70: () => conditions.rsiAbove(70),

  // MACD
  macdCrossUp: () => conditions.macdCrossUp(),
  macdCrossDown: () => conditions.macdCrossDown(),

  // Perfect Order
  perfectOrderBullish: () => conditions.perfectOrderBullish({ periods: [5, 25, 75] }),
  perfectOrderBearish: () => conditions.perfectOrderBearish({ periods: [5, 25, 75] }),
  perfectOrderCollapsed: () => conditions.perfectOrderCollapsed({ periods: [5, 25, 75] }),
  perfectOrderActiveBullish: () => conditions.perfectOrderActiveBullish({ periods: [5, 25, 75] }),

  // Volume
  volumeAnomaly: () => conditions.volumeAnomalyCondition(2.0, 20),
  volumeAbove1_5x: () => conditions.volumeRatioAbove(1.5, 20),
  volumeAbove2x: () => conditions.volumeRatioAbove(2.0, 20),
  volumeConfirmsTrend: () => conditions.volumeConfirmsTrend(),

  // Range/Pattern
  rangeBreakout: () => conditions.rangeBreakout(),
  rangeConfirmed: () => conditions.rangeConfirmed(),
  inRangeBound: () => conditions.inRangeBound(),

  // Bollinger
  bollingerBreakoutUp: () => conditions.bollingerBreakout("upper"),
  bollingerBreakoutDown: () => conditions.bollingerBreakout("lower"),

  // Price
  priceAboveSma25: () => conditions.priceAboveSma(25),
  priceBelowSma25: () => conditions.priceBelowSma(25),

  // Stochastics
  stochBelow20: () => conditions.stochBelow(20),
  stochAbove80: () => conditions.stochAbove(80),
  stochCrossUp: () => conditions.stochCrossUp(),
  stochCrossDown: () => conditions.stochCrossDown(),

  // DMI/ADX
  dmiBullish: () => conditions.dmiBullish(),
  dmiBearish: () => conditions.dmiBearish(),
  adxStrong: () => conditions.adxStrong(25),

  // Volatility
  atrPercentAbove2_3: () => conditions.atrPercentAbove(2.3),
  atrPercentAbove3: () => conditions.atrPercentAbove(3.0),

  // Perfect Order Extended
  perfectOrderActiveBearish: () => conditions.perfectOrderActiveBearish({ periods: [5, 25, 75] }),
  perfectOrderBullishConfirmed: () =>
    conditions.perfectOrderBullishConfirmed({ periods: [5, 25, 75] }),
  perfectOrderBearishConfirmed: () =>
    conditions.perfectOrderBearishConfirmed({ periods: [5, 25, 75] }),
  perfectOrderConfirmationFormed: () =>
    conditions.perfectOrderConfirmationFormed({ periods: [5, 25, 75] }),
  perfectOrderBreakdown: () => conditions.perfectOrderBreakdown({ periods: [5, 25, 75] }),
  perfectOrderMaCollapsed: () => conditions.perfectOrderMaCollapsed({ periods: [5, 25, 75] }),
  perfectOrderPreBullish: () => conditions.perfectOrderPreBullish({ periods: [5, 25, 75] }),
  perfectOrderPreBearish: () => conditions.perfectOrderPreBearish({ periods: [5, 25, 75] }),
  perfectOrderPullbackEntry: () => conditions.perfectOrderPullbackEntry({ periods: [5, 25, 75] }),
  perfectOrderPullbackSellEntry: () =>
    conditions.perfectOrderPullbackSellEntry({ periods: [5, 25, 75] }),
  poPlusEntry: () => conditions.poPlusEntry({ periods: [5, 25, 75] }),
  pbEntry: () => conditions.pbEntry({ periods: [5, 25, 75] }),
  poPlusPbEntry: () => conditions.poPlusPbEntry({ periods: [5, 25, 75] }),

  // Validated MA Cross
  validatedGoldenCross: () => conditions.validatedGoldenCross(),
  validatedDeadCross: () => conditions.validatedDeadCross(),

  // Price Extended
  priceDroppedAtr: () => conditions.priceDroppedAtr(),

  // Range-Bound Extended
  rangeForming: () => conditions.rangeForming(),
  breakoutRiskUp: () => conditions.breakoutRiskUp(),
  breakoutRiskDown: () => conditions.breakoutRiskDown(),
  tightRange: () => conditions.tightRange(),
  rangeScoreAbove: () => conditions.rangeScoreAbove(70),

  // Advanced Volume
  volumeExtreme: () => conditions.volumeExtreme(),
  volumeDivergence: () => conditions.volumeDivergence(),
  bullishVolumeDivergence: () => conditions.bullishVolumeDivergence(),
  bearishVolumeDivergence: () => conditions.bearishVolumeDivergence(),
  volumeTrendConfidence: () => conditions.volumeTrendConfidence(),
  nearPoc: () => conditions.nearPoc(),
  inValueArea: () => conditions.inValueArea(),
  breakoutVah: () => conditions.breakoutVah(),
  breakdownVal: () => conditions.breakdownVal(),
  priceAbovePoc: () => conditions.priceAbovePoc(),
  priceBelowPoc: () => conditions.priceBelowPoc(),
  cmfAbove: () => conditions.cmfAbove(0.05),
  cmfBelow: () => conditions.cmfBelow(-0.05),
  obvRising: () => conditions.obvRising(),
  obvFalling: () => conditions.obvFalling(),
  obvCrossUp: () => conditions.obvCrossUp(),
  obvCrossDown: () => conditions.obvCrossDown(),

  // Volatility Regime
  volatilityExpanding: () => conditions.volatilityExpanding(),
  volatilityContracting: () => conditions.volatilityContracting(),
  volatilityAbove: () => conditions.volatilityAbove(0.7),
  volatilityBelow: () => conditions.volatilityBelow(0.3),
  atrPercentileAbove: () => conditions.atrPercentileAbove(75),
  atrPercentileBelow: () => conditions.atrPercentileBelow(25),
  atrPercentBelow: () => conditions.atrPercentBelow(1.0),

  // Price Patterns
  anyBullishPattern: () => conditions.anyBullishPattern(),
  anyBearishPattern: () => conditions.anyBearishPattern(),
  doubleTopDetected: () => conditions.doubleTopDetected(),
  doubleBottomDetected: () => conditions.doubleBottomDetected(),
  headShouldersDetected: () => conditions.headShouldersDetected(),
  inverseHeadShouldersDetected: () => conditions.inverseHeadShouldersDetected(),
  cupHandleDetected: () => conditions.cupHandleDetected(),

  // Smart Money Concepts (SMC)
  priceAtBullishOrderBlock: () => conditions.priceAtBullishOrderBlock(),
  priceAtBearishOrderBlock: () => conditions.priceAtBearishOrderBlock(),
  orderBlockCreated: () => conditions.orderBlockCreated(),
  liquiditySweepDetected: () => conditions.liquiditySweepDetected(),
  liquiditySweepRecovered: () => conditions.liquiditySweepRecovered(),
  hasRecentSweeps: () => conditions.hasRecentSweeps(),
};

/**
 * Get list of available condition preset names
 */
export function getAvailableConditions(): string[] {
  return Object.keys(CONDITION_PRESETS);
}

/**
 * Create screening criteria from condition names (for CLI)
 *
 * @param entryNames - Array of entry condition names
 * @param exitNames - Optional array of exit condition names
 * @returns Screening criteria
 *
 * @example
 * ```ts
 * const criteria = createCriteriaFromNames(
 *   ["goldenCross", "volumeAnomaly"],
 *   ["deadCross"]
 * );
 * ```
 */
export function createCriteriaFromNames(
  entryNames: string[],
  exitNames?: string[],
): ScreeningCriteria {
  const getCondition = (name: string): Condition => {
    const factory = CONDITION_PRESETS[name];
    if (!factory) {
      const available = getAvailableConditions().join(", ");
      throw new Error(`Unknown condition: "${name}". Available: ${available}`);
    }
    return factory();
  };

  const entryConditions = entryNames.map(getCondition);
  const entry =
    entryConditions.length === 1 ? entryConditions[0] : conditions.and(...entryConditions);

  let exit: Condition | undefined;
  if (exitNames && exitNames.length > 0) {
    const exitConditions = exitNames.map(getCondition);
    exit = exitConditions.length === 1 ? exitConditions[0] : conditions.and(...exitConditions);
  }

  return {
    name: entryNames.join(" + "),
    entry,
    exit,
  };
}

/**
 * Safe variant of screenStock that returns a Result instead of throwing.
 *
 * @example
 * ```ts
 * const result = screenStockSafe("6758.T", candles, criteria);
 * if (result.ok) {
 *   console.log(result.value.entrySignal);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function screenStockSafe(
  ticker: string,
  candles: NormalizedCandle[],
  criteria: ScreeningCriteria,
  options: ScreenStockOptions = {},
): Result<ScreeningResult> {
  try {
    return ok(screenStock(ticker, candles, criteria, options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("No candle data")
      ? ("NO_DATA" as const)
      : ("SCREENING_FAILED" as const);
    return err(tcError(code, message, { ticker }, error instanceof Error ? error : undefined));
  }
}
