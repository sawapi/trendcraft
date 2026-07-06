/**
 * Screening module types
 */

import type { Condition, NormalizedCandle, TimeframeShorthand } from "../types";

/**
 * Screening criteria defining entry and exit conditions
 */
export type ScreeningCriteria = {
  /** Criteria name for display */
  name?: string;
  /** Entry condition - stock matches if this evaluates to true on latest bar */
  entry: Condition;
  /** Exit condition - optional, for identifying stocks to exit */
  exit?: Condition;
};

/**
 * Options for {@link screenStock} / {@link screenStockSafe}.
 */
export type ScreenStockOptions = {
  /** Include full candle data in the result (default: false). */
  includeCandles?: boolean;
  /**
   * Higher timeframes to make available to MTF conditions (e.g. `["1w"]`).
   * Without this, MTF conditions cannot evaluate and resolve to `false`.
   */
  mtfTimeframes?: TimeframeShorthand[];
};

/**
 * Options for {@link screenStockSeries}.
 */
export type ScreenStockSeriesOptions = {
  /**
   * Higher timeframes to make available to MTF conditions (e.g. `["1w"]`).
   * Without this, MTF conditions cannot evaluate and resolve to `false`.
   */
  mtfTimeframes?: TimeframeShorthand[];
};

/**
 * Single stock screening result
 */
export type ScreeningResult = {
  /** Stock ticker/identifier (from filename) */
  ticker: string;
  /** Whether entry condition was triggered */
  entrySignal: boolean;
  /** Whether exit condition was triggered (if exit provided) */
  exitSignal: boolean;
  /** Current price (latest close) */
  currentPrice: number;
  /** Latest candle timestamp */
  timestamp: number;
  /** ATR% for volatility assessment */
  atrPercent: number;
  /** Additional computed metrics */
  metrics: {
    rsi14?: number;
    volume?: number;
    volumeRatio?: number;
  };
  /** Full candle data (optional, for downstream analysis) */
  candles?: NormalizedCandle[];
};

/**
 * One bar of a time-series screen — whether the criteria matched as of that bar.
 */
export type ScreeningSeriesPoint = {
  /** Index of this bar in the input candles. */
  index: number;
  /** Bar timestamp. */
  time: number;
  /** Close price at this bar. */
  close: number;
  /** Whether the entry condition matched as of this bar. */
  entrySignal: boolean;
  /** Whether the exit condition matched as of this bar (false when no exit criteria). */
  exitSignal: boolean;
};

/**
 * Result of screening a single stock across every bar of its history.
 */
export type ScreeningSeriesResult = {
  /** Stock ticker/identifier. */
  ticker: string;
  /** Per-bar screen results, one entry per input candle, in chronological order. */
  points: ScreeningSeriesPoint[];
};

/**
 * Screening session options
 */
export type ScreeningOptions = {
  /** Path to directory containing CSV files */
  dataPath: string;
  /** Screening criteria */
  criteria: ScreeningCriteria;
  /** Minimum data points required (default: 100) */
  minDataPoints?: number;
  /** Filter by ATR% threshold (default: no filter) */
  minAtrPercent?: number;
  /** Include full candle data in results (default: false) */
  includeCandles?: boolean;
  /** Higher timeframes to make available to MTF conditions (e.g. `["1w"]`) */
  mtfTimeframes?: TimeframeShorthand[];
  /** Progress callback */
  onProgress?: (processed: number, total: number, ticker: string) => void;
};

/**
 * Complete screening session result
 */
export type ScreeningSessionResult = {
  /** Timestamp when screening started */
  timestamp: number;
  /** Criteria used */
  criteria: {
    name?: string;
    entryDescription: string;
    exitDescription?: string;
  };
  /** Options used */
  options: {
    dataPath: string;
    minDataPoints: number;
    minAtrPercent?: number;
  };
  /** Summary statistics */
  summary: {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    entrySignals: number;
    exitSignals: number;
    processingTimeMs: number;
  };
  /** Individual stock results */
  results: ScreeningResult[];
  /** Stocks that were skipped (insufficient data, etc.) */
  skipped: Array<{ ticker: string; reason: string }>;
};

/**
 * Output format options for CLI
 */
export type OutputFormat = "json" | "table" | "csv";

/**
 * CSV load result
 */
export type CsvLoadResult = {
  ticker: string;
  candles: NormalizedCandle[];
};

/**
 * CSV load error
 */
export type CsvLoadError = {
  ticker: string;
  error: string;
};
