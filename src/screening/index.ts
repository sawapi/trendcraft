/**
 * Stock Screening Module
 *
 * Provides screening functionality to find stocks matching entry/exit conditions
 * across multiple CSV files.
 *
 * @example
 * ```ts
 * import { runScreening, screenStock } from "trendcraft/screening";
 * import { and, goldenCross, volumeAnomalyCondition } from "trendcraft";
 *
 * // Screen multiple stocks
 * const results = runScreening({
 *   dataPath: "./data",
 *   criteria: {
 *     name: "GC + Volume",
 *     entry: and(goldenCross(5, 25), volumeAnomalyCondition(2.0, 20)),
 *     exit: deadCross(5, 25),
 *   },
 *   minAtrPercent: 2.3,
 * });
 *
 * // Screen single stock
 * const result = screenStock("6758.T", candles, {
 *   entry: goldenCross(5, 25),
 * });
 * ```
 */

// Types
export type {
  ScreeningCriteria,
  ScreeningResult,
  ScreeningOptions,
  ScreeningSessionResult,
  OutputFormat,
  CsvLoadResult,
  CsvLoadError,
} from "./types";

// Core functions
export {
  screenStock,
  runScreening,
  createCriteriaFromNames,
  getAvailableConditions,
  CONDITION_PRESETS,
} from "./screener";

// CSV utilities
export { parseCsv, loadCsvFile, getCsvFiles, loadCsvDirectory } from "./csv-loader";

// Formatters
export { formatTable, formatJson, formatCsv } from "./formatters";
