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
  /**
   * ATR% for volatility assessment.
   *
   * Finite in every result returned by `runScreening`, along with
   * `currentPrice` and `timestamp`: a symbol that cannot supply all three is
   * reported in `skipped` instead, because it can neither be filtered nor
   * ranked. Malformed OHLC rows take out different ones — a mid-series row
   * poisons every later ATR value through Wilder smoothing, while one on the
   * last row leaves ATR% intact and takes out `currentPrice`.
   *
   * A finite value is not automatically a measured one — with fewer candles
   * than the ATR period, or no bar with a positive close, the underlying
   * calculation substitutes `0`. `atrSampleCount` separates the two, and
   * `runScreening` skips a symbol whose count is 0.
   */
  atrPercent: number;
  /**
   * Bars that contributed to `atrPercent`. `0` means nothing could be
   * measured, so `atrPercent` is a placeholder rather than a reading —
   * `runScreening` skips such symbols.
   */
  atrSampleCount: number;
  /**
   * Additional computed metrics. `undefined` means the metric could not be
   * evaluated for this symbol, never a substituted value: `volumeRatio` is
   * absent during the 20-bar volume MA warm-up and for a symbol that never
   * traded, since `1` would mean "volume is exactly average".
   */
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
  /**
   * Minimum ATR% a symbol must reach to be reported (default: no minimum).
   *
   * Independently of this option, a symbol whose headline fields cannot be
   * computed is always skipped — see {@link ScreeningResult.atrPercent}.
   */
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
  /**
   * Summary statistics.
   *
   * `processedFiles` and `skippedFiles` partition `totalFiles`: every CSV in
   * the directory either produced a result or was skipped, never both.
   * `processedFiles === results.length` and `skippedFiles === skipped.length`.
   */
  summary: {
    /** CSV files the run loaded or failed to load */
    totalFiles: number;
    /** Files that screened all the way through — equals `results.length` */
    processedFiles: number;
    /** Files excluded at any stage — equals `skipped.length` */
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
