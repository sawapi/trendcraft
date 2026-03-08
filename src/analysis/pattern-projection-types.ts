/**
 * Pattern Projection Types
 *
 * Type definitions for pattern outcome projection analysis.
 */

/**
 * Options for pattern projection analysis
 */
export type PatternProjectionOptions = {
  /** Number of bars to project forward (default: 20) */
  horizon?: number;
  /** Confidence level for bounds (default: 0.95) */
  confidenceLevel?: number;
  /** Return thresholds for hit rate calculation (default: [1, 2, 5, 10]) */
  thresholds?: number[];
};

/**
 * Hit rate for a specific return threshold
 */
export type HitRate = {
  /** Return threshold in percent */
  threshold: number;
  /** Percentage of events that reached this threshold within the horizon */
  rate: number;
};

/**
 * Result of pattern projection analysis
 */
export type PatternProjection = {
  /** Total number of pattern events found */
  patternCount: number;
  /** Number of events with sufficient forward data */
  validCount: number;
  /** Average return by bar offset (index 0 = 1 bar after event) */
  avgReturnByBar: number[];
  /** Median return by bar offset */
  medianReturnByBar: number[];
  /** Upper confidence bound by bar offset */
  upperBound: number[];
  /** Lower confidence bound by bar offset */
  lowerBound: number[];
  /** Hit rates for each threshold */
  hitRates: HitRate[];
};

/**
 * Extracts event information from a generic event type
 */
export type EventExtractor<T> = (event: T) => {
  /** Timestamp of the event */
  time: number;
  /** Direction of the event (bearish returns are inverted) */
  direction?: "bullish" | "bearish";
};
