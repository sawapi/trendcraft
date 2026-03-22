/**
 * Stock Screener Engine (Node.js-only)
 *
 * This module contains Node.js-specific screening functions that require
 * filesystem access. For browser-compatible functions, use screen-stock.ts.
 */

import type { Condition } from "../types";
import { type Result, err, ok, tcError } from "../types/result";
import { getCsvFiles, loadCsvDirectory } from "./csv-loader";
import { screenStock } from "./screen-stock";
import type { ScreeningOptions, ScreeningResult, ScreeningSessionResult } from "./types";

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

/**
 * Safe variant of runScreening that returns a Result instead of throwing.
 *
 * @example
 * ```ts
 * const result = runScreeningSafe(options);
 * if (result.ok) {
 *   console.log(result.value.summary);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function runScreeningSafe(options: ScreeningOptions): Result<ScreeningSessionResult> {
  try {
    return ok(runScreening(options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(
      tcError(
        "SCREENING_FAILED",
        message,
        { dataPath: options.dataPath },
        error instanceof Error ? error : undefined,
      ),
    );
  }
}
