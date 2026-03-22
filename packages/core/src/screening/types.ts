/**
 * Screening module types
 */

import type { Condition, NormalizedCandle } from "../types";

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
  /** Maximum concurrent file processing (default: 10) */
  concurrency?: number;
  /** Include full candle data in results (default: false) */
  includeCandles?: boolean;
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
