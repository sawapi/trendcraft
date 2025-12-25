/**
 * Stock Screener Engine
 *
 * Screens multiple stocks against entry/exit conditions using the existing
 * backtest condition system.
 */

import { evaluateCondition } from "../backtest/conditions/core";
import { rsi } from "../indicators/momentum/rsi";
import { calculateAtrPercent } from "../indicators/volatility/atr-filter";
import { volumeMa } from "../indicators/volume/volume-ma";
import type { Condition, NormalizedCandle } from "../types";
import { getCsvFiles, loadCsvDirectory } from "./csv-loader";
import type {
  ScreeningCriteria,
  ScreeningOptions,
  ScreeningResult,
  ScreeningSessionResult,
} from "./types";

// Import all conditions for CLI name resolution
import * as conditions from "../backtest/conditions";

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
 * import { and, goldenCross, volumeAnomalyCondition } from "trendcraft";
 *
 * const result = screenStock("6758.T", candles, {
 *   entry: and(goldenCross(5, 25), volumeAnomalyCondition(2.0, 20)),
 *   exit: deadCross(5, 25),
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
  options: { includeCandles?: boolean } = {},
): ScreeningResult {
  const { includeCandles = false } = options;

  if (candles.length === 0) {
    throw new Error("No candle data");
  }

  const lastIndex = candles.length - 1;
  const lastCandle = candles[lastIndex];
  const indicators: Record<string, unknown> = {};

  // Evaluate entry condition on latest bar
  const entrySignal = evaluateCondition(criteria.entry, indicators, lastCandle, lastIndex, candles);

  // Evaluate exit condition if provided
  const exitSignal = criteria.exit
    ? evaluateCondition(criteria.exit, indicators, lastCandle, lastIndex, candles)
    : false;

  // Calculate ATR%
  const atrPercent = calculateAtrPercent(candles);

  // Calculate additional metrics
  const rsiData = rsi(candles, { period: 14 });
  const rsi14 = rsiData[lastIndex]?.value ?? undefined;

  const volMaData = volumeMa(candles, { period: 20 });
  const avgVolume = volMaData[lastIndex]?.value ?? 0;
  const volumeRatio = avgVolume && avgVolume > 0 ? lastCandle.volume / avgVolume : 1;

  return {
    ticker,
    entrySignal,
    exitSignal,
    currentPrice: lastCandle.close,
    timestamp: lastCandle.time,
    atrPercent,
    metrics: {
      rsi14: rsi14 ?? undefined,
      volume: lastCandle.volume,
      volumeRatio,
    },
    candles: includeCandles ? candles : undefined,
  };
}

/**
 * Run screening session across all CSV files in directory
 *
 * @param options - Screening options
 * @returns Complete screening session result
 *
 * @example
 * ```ts
 * import { runScreening } from "trendcraft/screening";
 * import { and, goldenCross, volumeAnomalyCondition } from "trendcraft";
 *
 * const results = await runScreening({
 *   dataPath: "./data",
 *   criteria: {
 *     name: "GC + Volume",
 *     entry: and(goldenCross(5, 25), volumeAnomalyCondition(2.0, 20)),
 *     exit: deadCross(5, 25),
 *   },
 *   minAtrPercent: 2.3,
 * });
 *
 * console.log(`Found ${results.summary.entrySignals} entry signals`);
 * ```
 */
export function runScreening(options: ScreeningOptions): ScreeningSessionResult {
  const {
    dataPath,
    criteria,
    minDataPoints = 100,
    minAtrPercent,
    includeCandles = false,
    onProgress,
  } = options;

  const startTime = Date.now();

  // Load all CSV files
  const { results: loadedStocks, errors: loadErrors } = loadCsvDirectory(dataPath, {
    onProgress,
  });

  const screeningResults: ScreeningResult[] = [];
  const skipped: Array<{ ticker: string; reason: string }> = [];

  // Add load errors to skipped
  for (const err of loadErrors) {
    skipped.push({ ticker: err.ticker, reason: err.error });
  }

  // Screen each stock
  for (const stock of loadedStocks) {
    // Check minimum data points
    if (stock.candles.length < minDataPoints) {
      skipped.push({
        ticker: stock.ticker,
        reason: `Insufficient data (${stock.candles.length} < ${minDataPoints})`,
      });
      continue;
    }

    try {
      const result = screenStock(stock.ticker, stock.candles, criteria, { includeCandles });

      // Check ATR% filter
      if (minAtrPercent !== undefined && result.atrPercent < minAtrPercent) {
        skipped.push({
          ticker: stock.ticker,
          reason: `ATR% too low (${result.atrPercent.toFixed(2)}% < ${minAtrPercent}%)`,
        });
        continue;
      }

      screeningResults.push(result);
    } catch (e) {
      skipped.push({ ticker: stock.ticker, reason: String(e) });
    }
  }

  // Sort results: entry signals first, then by ATR% descending
  screeningResults.sort((a, b) => {
    if (a.entrySignal !== b.entrySignal) {
      return a.entrySignal ? -1 : 1;
    }
    if (a.exitSignal !== b.exitSignal) {
      return a.exitSignal ? -1 : 1;
    }
    return b.atrPercent - a.atrPercent;
  });

  const processingTimeMs = Date.now() - startTime;

  return {
    timestamp: startTime,
    criteria: {
      name: criteria.name,
      entryDescription: getConditionDescription(criteria.entry),
      exitDescription: criteria.exit ? getConditionDescription(criteria.exit) : undefined,
    },
    options: {
      dataPath,
      minDataPoints,
      minAtrPercent,
    },
    summary: {
      totalFiles: getCsvFiles(dataPath).length,
      processedFiles: loadedStocks.length,
      skippedFiles: skipped.length,
      entrySignals: screeningResults.filter((r) => r.entrySignal).length,
      exitSignals: screeningResults.filter((r) => r.exitSignal).length,
      processingTimeMs,
    },
    results: screeningResults,
    skipped,
  };
}

/**
 * Get human-readable description of a condition
 */
function getConditionDescription(condition: Condition): string {
  if (typeof condition === "function") {
    return "Custom function";
  }
  if (condition.type === "preset") {
    return condition.name;
  }
  if (condition.type === "mtf-preset") {
    return condition.name;
  }
  // Combined condition
  const combined = condition;
  const childDescs = combined.conditions.map((c) => getConditionDescription(c as Condition));
  if (combined.type === "not") {
    return `NOT(${childDescs[0]})`;
  }
  return `${combined.type.toUpperCase()}(${childDescs.join(", ")})`;
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
