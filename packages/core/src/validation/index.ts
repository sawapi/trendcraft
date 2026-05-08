/**
 * Data Quality Validation module
 *
 * Provides tools for detecting data quality issues in candle data:
 * gaps, duplicates, OHLC inconsistencies, price spikes, volume
 * anomalies, stale data, and stock split hints.
 */

export { detectDuplicates, removeDuplicates } from "./duplicate-detection";
export { detectGaps } from "./gap-detection";
export {
  detectOhlcErrors,
  detectPriceSpikes,
  detectVolumeAnomalies,
} from "./outlier-detection";
export { detectSplitHints } from "./split-detection";
export { detectStaleData } from "./stale-detection";
export type {
  GapDetectionOptions,
  SpikeDetectionOptions,
  StaleDetectionOptions,
  ValidationFinding,
  ValidationOptions,
  ValidationResult,
  ValidationSeverity,
  VolumeAnomalyOptions,
} from "./types";
export { validateCandles } from "./validate";
