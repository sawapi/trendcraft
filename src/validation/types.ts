/**
 * Data Quality Validation Types
 */

import type { NormalizedCandle } from "../types";

/** Severity levels for validation findings */
export type ValidationSeverity = "error" | "warning" | "info";

/** A single validation finding */
export type ValidationFinding = {
  /** Severity level */
  severity: ValidationSeverity;
  /** Finding category */
  category: "gap" | "duplicate" | "ohlc" | "spike" | "volume" | "stale" | "split";
  /** Human-readable message */
  message: string;
  /** Index in the candle array */
  index?: number;
  /** Timestamp of the affected candle */
  time?: number;
};

/** Validation result */
export type ValidationResult = {
  /** Whether the data passed validation (no errors) */
  valid: boolean;
  /** Total number of findings */
  totalFindings: number;
  /** Findings by severity */
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  info: ValidationFinding[];
  /** Cleaned candles (only if autoClean is enabled) */
  cleanedCandles?: NormalizedCandle[];
};

/** Options for validation */
export type ValidationOptions = {
  /** Enable gap detection (default: true) */
  gaps?: boolean | GapDetectionOptions;
  /** Enable duplicate detection (default: true) */
  duplicates?: boolean;
  /** Enable OHLC consistency check (default: true) */
  ohlc?: boolean;
  /** Enable price spike detection (default: true) */
  spikes?: boolean | SpikeDetectionOptions;
  /** Enable volume anomaly detection (default: true) */
  volumeAnomalies?: boolean | VolumeAnomalyOptions;
  /** Enable stale data detection (default: true) */
  stale?: boolean | StaleDetectionOptions;
  /** Enable stock split hint detection (default: false) */
  splits?: boolean;
  /** Auto-clean data (remove duplicates, sort by time) */
  autoClean?: boolean;
};

/** Options for gap detection */
export type GapDetectionOptions = {
  /** Maximum gap as multiple of expected interval (default: 3) */
  maxGapMultiplier?: number;
  /** Skip weekends (Sat/Sun) in gap calculation (default: true) */
  skipWeekends?: boolean;
};

/** Options for price spike detection */
export type SpikeDetectionOptions = {
  /** Maximum single-bar price change in percent (default: 20) */
  maxPriceChangePercent?: number;
};

/** Options for volume anomaly detection */
export type VolumeAnomalyOptions = {
  /** Z-score threshold for volume anomaly (default: 4) */
  zScoreThreshold?: number;
  /** Lookback period for mean/std calculation (default: 20) */
  lookback?: number;
};

/** Options for stale data detection */
export type StaleDetectionOptions = {
  /** Minimum consecutive bars with same close to flag (default: 5) */
  minConsecutive?: number;
};
