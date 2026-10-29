/**
 * Unified Condition DSL
 *
 * Define trading conditions once and use them in both backtest and
 * streaming contexts. Eliminates the need to maintain two parallel
 * implementations (backtest `Condition` and streaming `StreamingCondition`).
 *
 * @example
 * ```ts
 * import { defineUnifiedCondition } from "trendcraft";
 *
 * const rsiOversold = defineUnifiedCondition({
 *   name: "rsiOversold",
 *   requires: ["rsi"],
 *   evaluate: (ind) => {
 *     const rsi = ind.rsi;
 *     return typeof rsi === "number" && rsi < 30;
 *   },
 * });
 *
 * // Use in backtest
 * const backtestCondition = rsiOversold.toBacktestCondition();
 *
 * // Use in streaming pipeline
 * const streamingCondition = rsiOversold.toStreamingCondition();
 * ```
 */

import type { StreamingConditionContext, StreamingPresetCondition } from "../streaming/types";
import type { NormalizedCandle, PresetCondition } from "../types";

/**
 * A unified indicator accessor.
 *
 * In backtest mode this is `Record<string, unknown>` (the indicators object).
 * In streaming mode this is `IndicatorSnapshot` (also `Record<string, unknown>`).
 * Both are structurally identical — the key difference is how the surrounding
 * engine provides the data.
 */
export type IndicatorAccessor = Record<string, unknown>;

/**
 * Definition for a unified condition
 */
export type UnifiedConditionDef = {
  /** Human-readable name for the condition */
  name: string;
  /**
   * Indicator keys that this condition reads.
   * Purely informational — used for documentation and tooling.
   */
  requires: string[];
  /**
   * The evaluation function.
   *
   * Receives the indicator values (from either backtest or streaming)
   * and the current candle. Must return `true` when the condition is met.
   *
   * `context` is set in streaming: `{ mode: "peek" }` for a forming bar. A
   * condition that keeps state between bars should update it only when
   * `context?.mode !== "peek"`. In a backtest it is absent.
   */
  evaluate: (
    indicators: IndicatorAccessor,
    candle: NormalizedCandle,
    context?: StreamingConditionContext,
  ) => boolean;
};

/**
 * A unified condition that can be converted to both backtest and streaming conditions
 */
export type UnifiedCondition = {
  /** The original definition */
  readonly def: UnifiedConditionDef;
  /** Convert to a backtest `Condition` (PresetCondition) */
  toBacktestCondition: () => PresetCondition;
  /** Convert to a streaming `StreamingCondition` (StreamingPresetCondition) */
  toStreamingCondition: () => StreamingPresetCondition;
};

/**
 * Define a unified condition that works in both backtest and streaming modes.
 *
 * The `evaluate` function receives the indicator values (keyed by name)
 * and the current candle. The same function is used for both backtest
 * and streaming evaluation.
 *
 * @param def - Condition definition with name, requires, and evaluate
 * @returns A UnifiedCondition with `toBacktestCondition()` and `toStreamingCondition()`
 *
 * @example
 * ```ts
 * // Simple threshold condition
 * const rsiOversold = defineUnifiedCondition({
 *   name: "rsiOversold",
 *   requires: ["rsi"],
 *   evaluate: (ind) => {
 *     const rsi = ind.rsi;
 *     return typeof rsi === "number" && rsi < 30;
 *   },
 * });
 *
 * // Compound indicator access (dot-path style)
 * const bbLowerTouch = defineUnifiedCondition({
 *   name: "bbLowerTouch",
 *   requires: ["bb"],
 *   evaluate: (ind, candle) => {
 *     const bb = ind.bb as { lower?: number } | undefined;
 *     return bb?.lower != null && candle.close <= bb.lower;
 *   },
 * });
 *
 * // Cross detection (stateful, streaming). A peek at a forming bar must not
 * // move the previous value.
 * const macdCrossUp = defineUnifiedCondition({
 *   name: "macdCrossUp",
 *   requires: ["macd"],
 *   evaluate: (() => {
 *     let prevHist: number | null = null;
 *     return (ind, _candle, context) => {
 *       const macd = ind.macd as { histogram?: number } | undefined;
 *       const hist = macd?.histogram ?? null;
 *       const crossed = prevHist !== null && hist !== null && prevHist <= 0 && hist > 0;
 *       if (context?.mode !== "peek") prevHist = hist;
 *       return crossed;
 *     };
 *   })(),
 * });
 * ```
 *
 * State kept in a closure, as in the cross example, is reliable in streaming,
 * where every confirmed bar is evaluated. In a backtest it is not: the engine
 * evaluates the entry condition only while flat and the exit condition only
 * while a position is open, so the closure skips bars. For a backtest, read
 * the previous value from the indicators instead.
 */
export function defineUnifiedCondition(def: UnifiedConditionDef): UnifiedCondition {
  return {
    def,
    toBacktestCondition(): PresetCondition {
      return {
        type: "preset",
        name: def.name,
        evaluate: (indicators, candle, _index, _candles) => {
          return def.evaluate(indicators, candle);
        },
      };
    },
    toStreamingCondition(): StreamingPresetCondition {
      return {
        type: "preset",
        name: def.name,
        evaluate: (snapshot, candle, context) => {
          return def.evaluate(snapshot, candle, context);
        },
      };
    },
  };
}

/**
 * Combine multiple unified conditions with AND logic.
 *
 * Every condition is evaluated on every call, as streaming `and` does, so a
 * stateful condition is not skipped when an earlier one is false.
 *
 * @param conditions - Unified conditions to combine
 * @returns A new UnifiedCondition that requires all conditions to be true
 *
 * @example
 * ```ts
 * // oversoldCond / volumeSpikeCond: conditions from defineUnifiedCondition
 * const entry = unifiedAnd(oversoldCond, volumeSpikeCond);
 * const bt = entry.toBacktestCondition();
 * const st = entry.toStreamingCondition();
 * ```
 */
export function unifiedAnd(...conditions: UnifiedCondition[]): UnifiedCondition {
  return defineUnifiedCondition({
    name: `and(${conditions.map((c) => c.def.name).join(", ")})`,
    requires: [...new Set(conditions.flatMap((c) => c.def.requires))],
    evaluate: (indicators, candle, context) => {
      const results = conditions.map((c) => c.def.evaluate(indicators, candle, context));
      return results.every(Boolean);
    },
  });
}

/**
 * Combine multiple unified conditions with OR logic.
 *
 * Every condition is evaluated on every call, as streaming `or` does, so a
 * stateful condition is not skipped when an earlier one is true.
 *
 * @param conditions - Unified conditions to combine
 * @returns A new UnifiedCondition that requires any condition to be true
 *
 * @example
 * ```ts
 * const exit = unifiedOr(overboughtCond, stopLossCond);
 * ```
 */
export function unifiedOr(...conditions: UnifiedCondition[]): UnifiedCondition {
  return defineUnifiedCondition({
    name: `or(${conditions.map((c) => c.def.name).join(", ")})`,
    requires: [...new Set(conditions.flatMap((c) => c.def.requires))],
    evaluate: (indicators, candle, context) => {
      const results = conditions.map((c) => c.def.evaluate(indicators, candle, context));
      return results.some(Boolean);
    },
  });
}

/**
 * Negate a unified condition.
 *
 * @param condition - The condition to negate
 * @returns A new UnifiedCondition that is true when the original is false
 *
 * @example
 * ```ts
 * const notOverbought = unifiedNot(overboughtCond);
 * ```
 */
export function unifiedNot(condition: UnifiedCondition): UnifiedCondition {
  return defineUnifiedCondition({
    name: `not(${condition.def.name})`,
    requires: condition.def.requires,
    evaluate: (indicators, candle, context) => {
      return !condition.def.evaluate(indicators, candle, context);
    },
  });
}
