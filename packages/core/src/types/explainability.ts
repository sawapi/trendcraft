/**
 * Signal Explainability types
 *
 * Types for tracing why a signal fired, which indicators contributed,
 * their values, which conditions passed/failed, with human-readable narrative.
 */

/**
 * Individual condition trace
 *
 * Captures the evaluation result of a single condition including
 * indicator values at the time of evaluation.
 */
export type ConditionTrace = {
  /** Condition name (e.g., "rsiBelow(30)") */
  name: string;
  /** Whether this condition passed */
  passed: boolean;
  /** Indicator values at the time of evaluation */
  indicatorValues: Record<string, unknown>;
  /** Human-readable reason */
  reason: string;
  /** Child traces for combined conditions (and/or/not) */
  children?: ConditionTrace[];
  /** Condition type */
  type: "preset" | "combined" | "mtf-preset" | "function";
};

/**
 * Full signal explanation
 *
 * Contains the complete trace of a signal evaluation including
 * all contributing factors and a human-readable narrative.
 *
 * @example
 * ```ts
 * import { explainSignal, rsiBelow, rsiAbove } from "trendcraft";
 *
 * const explanation = explainSignal(candles, 50, rsiBelow(30), rsiAbove(70));
 * console.log(explanation.narrative);
 * // => "Entry signal did not fire. rsiBelow(30): failed (rsi14 = 45.2)."
 * ```
 */
export type SignalExplanation = {
  /** Signal type: entry or exit */
  signalType: "entry" | "exit";
  /** Whether the signal fired */
  fired: boolean;
  /** Timestamp */
  time: number;
  /** Current candle data */
  candle: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  /** Root condition trace */
  trace: ConditionTrace;
  /** Summary of contributing factors (leaf conditions only) */
  contributions: Array<{
    name: string;
    passed: boolean;
    indicatorValues: Record<string, unknown>;
  }>;
  /** Human-readable narrative */
  narrative: string;
};

/**
 * Options for explanation
 */
export type ExplainOptions = {
  /** Include indicator values in trace (default: true) */
  includeValues?: boolean;
  /** Maximum depth for combined condition traces (default: 10) */
  maxDepth?: number;
  /** Language for narrative (default: "en") */
  language?: "en" | "ja";
};
