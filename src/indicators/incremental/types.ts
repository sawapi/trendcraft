/**
 * Incremental Indicator Types
 *
 * Types for stateful, O(1) per-candle indicator computation.
 */

import type { IndicatorValue, NormalizedCandle } from "../../types";

/**
 * Stateful incremental indicator that processes one candle at a time.
 *
 * @typeParam TValue - Output value type (e.g., number, { k: number; d: number })
 * @typeParam TState - Internal state type (JSON-serializable for persistence)
 *
 * @example
 * ```ts
 * const sma20 = createSma({ period: 20 });
 * for (const candle of stream) {
 *   const result = sma20.next(candle);
 *   if (sma20.isWarmedUp) console.log(result.value);
 * }
 * ```
 */
export type IncrementalIndicator<TValue, TState = unknown> = {
  /** Advance state by one candle and return the computed value */
  next(candle: NormalizedCandle): IndicatorValue<TValue>;
  /** Preview value for a candle without advancing state */
  peek(candle: NormalizedCandle): IndicatorValue<TValue>;
  /** Return a JSON-serializable snapshot of internal state */
  getState(): TState;
  /** Number of candles processed so far */
  readonly count: number;
  /** True when enough candles have been processed for valid output */
  readonly isWarmedUp: boolean;
};

/**
 * Options for creating an incremental indicator with optional warm-up
 *
 * @typeParam TState - State type for restoration
 */
export type WarmUpOptions<TState> = {
  /** Restore from a previously saved state snapshot */
  fromState?: TState;
  /** Process these candles on creation to warm up the indicator */
  warmUp?: NormalizedCandle[];
};
