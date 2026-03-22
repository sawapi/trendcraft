/**
 * Data Quality Validation module
 *
 * Provides tools for detecting data quality issues in candle data:
 * gaps, duplicates, OHLC inconsistencies, price spikes, volume
 * anomalies, stale data, and stock split hints.
 */

export type {
  ValidationResult,
  ValidationFinding,
  ValidationOptions,
  ValidationSeverity,
  GapDetectionOptions,
  SpikeDetectionOptions,
  VolumeAnomalyOptions,
  StaleDetectionOptions,
} from "./types";
export { validateCandles } from "./validate";
export { detectGaps } from "./gap-detection";
export { detectDuplicates, removeDuplicates } from "./duplicate-detection";
export {
  detectOhlcErrors,
  detectPriceSpikes,
  detectVolumeAnomalies,
} from "./outlier-detection";
export { detectStaleData } from "./stale-detection";
export { detectSplitHints } from "./split-detection";
