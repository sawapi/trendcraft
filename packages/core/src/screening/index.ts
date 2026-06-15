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
 * // Screen multiple stocks (Node.js only)
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
 * // Screen single stock (browser-compatible)
 * const result = screenStock("6758.T", candles, {
 *   entry: goldenCross(5, 25),
 * });
 * ```
 */

// These require Node.js fs (from csv-loader.ts)
export { getCsvFiles, loadCsvDirectory, loadCsvFile } from "./csv-loader";
// CSV utilities
// parseCsv is browser-safe (from csv-parser.ts)
export { parseCsv } from "./csv-parser";
// Formatters (browser-compatible)
export { formatCsv, formatJson, formatTable } from "./formatters";
// Browser-compatible functions (no fs dependency)
export {
  CONDITION_PRESETS,
  createCriteriaFromNames,
  getAvailableConditions,
  screenStock,
  screenStockSafe,
  screenStockSeries,
} from "./screen-stock";
// Node.js-only functions (require fs)
export { runScreening, runScreeningSafe } from "./screener";
// Types
export type {
  CsvLoadError,
  CsvLoadResult,
  OutputFormat,
  ScreeningCriteria,
  ScreeningOptions,
  ScreeningResult,
  ScreeningSeriesPoint,
  ScreeningSeriesResult,
  ScreeningSessionResult,
  ScreenStockOptions,
  ScreenStockSeriesOptions,
} from "./types";
