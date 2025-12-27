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

// Browser-compatible functions (no fs dependency)
export {
  screenStock,
  createCriteriaFromNames,
  getAvailableConditions,
  CONDITION_PRESETS,
} from "./screen-stock";

// Node.js-only functions (require fs)
export { runScreening } from "./screener";

// CSV utilities
// parseCsv is browser-safe (from csv-parser.ts)
export { parseCsv } from "./csv-parser";
// These require Node.js fs (from csv-loader.ts)
export { loadCsvFile, getCsvFiles, loadCsvDirectory } from "./csv-loader";

// Formatters (browser-compatible)
export { formatTable, formatJson, formatCsv } from "./formatters";
