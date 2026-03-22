/**
 * Signal Explainability Engine
 *
 * Traces why a signal fired, which indicators contributed, their values,
 * which conditions passed/failed, with human-readable narrative.
 *
 * @example
 * ```ts
 * import { explainSignal, rsiBelow, rsiAbove, and, goldenCrossCondition } from "trendcraft";
 *
 * const entry = and(goldenCrossCondition(), rsiBelow(40));
 * const exit = rsiAbove(70);
 *
 * const explanation = explainSignal(candles, 50, entry, exit);
 * console.log(explanation.narrative);
 * console.log(explanation.contributions);
 * ```
 */

export { traceCondition } from "./trace";
export { explainSignal, explainCondition } from "./explain";
export { generateNarrative } from "./narrative";
