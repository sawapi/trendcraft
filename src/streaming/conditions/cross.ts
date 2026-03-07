/**
 * Generic Cross Detection Conditions
 *
 * Stateful condition factories that detect when one value crosses
 * above or below another. Works with any indicator via string keys,
 * dot-paths, numeric constants, or custom extractor functions.
 *
 * @example
 * ```ts
 * // SMA golden cross
 * const entry = crossOver("sma20", "sma50");
 *
 * // RSI recovery above 30
 * const recovery = crossOver("rsi", 30);
 *
 * // MACD signal line cross
 * const macdCross = crossOver("macd.macd", "macd.signal");
 *
 * // Custom extractor
 * const dmiCross = crossOver(
 *   (snap) => getField(snap, "dmi", "plusDi"),
 *   (snap) => getField(snap, "dmi", "minusDi"),
 * );
 * ```
 */

import type { NormalizedCandle } from "../../types";
import { resolveNumber } from "../snapshot-utils";
import type { IndicatorSnapshot, StreamingPresetCondition } from "./types";

/**
 * A value extractor for cross detection.
 *
 * - `string` — snapshot key or dot-path (e.g., `"rsi"`, `"bb.lower"`)
 * - `function` — custom extractor returning `number | null`
 */
export type ValueExtractor =
  | string
  | ((snapshot: IndicatorSnapshot, candle: NormalizedCandle) => number | null);

function toExtractorFn(
  v: ValueExtractor | number,
): (snapshot: IndicatorSnapshot, candle: NormalizedCandle) => number | null {
  if (typeof v === "number") {
    const constant = v;
    return () => constant;
  }
  if (typeof v === "string") {
    const path = v;
    return (snapshot) => resolveNumber(snapshot, path);
  }
  return v;
}

function formatName(v: ValueExtractor | number): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return "fn";
}

/**
 * Condition: value A crosses above value B.
 *
 * Detects the transition from `A <= B` to `A > B` between consecutive evaluations.
 * Returns `false` when either value is null (insufficient data).
 *
 * @param a - The value expected to cross above
 * @param b - The reference value (or constant threshold)
 *
 * @example
 * ```ts
 * const goldenCross = crossOver("sma20", "sma50");
 * const rsiRecovery = crossOver("rsi", 30);
 * ```
 */
export function crossOver(a: ValueExtractor, b: ValueExtractor | number): StreamingPresetCondition {
  const extractA = toExtractorFn(a);
  const extractB = toExtractorFn(b);
  let prevA: number | null = null;
  let prevB: number | null = null;

  return {
    type: "preset",
    name: `crossOver(${formatName(a)}, ${formatName(b)})`,
    evaluate: (snapshot, candle) => {
      const curA = extractA(snapshot, candle);
      const curB = extractB(snapshot, candle);

      const crossed =
        prevA !== null &&
        prevB !== null &&
        curA !== null &&
        curB !== null &&
        prevA <= prevB &&
        curA > curB;

      prevA = curA;
      prevB = curB;
      return crossed;
    },
  };
}

/**
 * Condition: value A crosses below value B.
 *
 * Detects the transition from `A >= B` to `A < B` between consecutive evaluations.
 * Returns `false` when either value is null (insufficient data).
 *
 * @param a - The value expected to cross below
 * @param b - The reference value (or constant threshold)
 *
 * @example
 * ```ts
 * const deadCross = crossUnder("sma20", "sma50");
 * const rsiOversold = crossUnder("rsi", 30);
 * ```
 */
export function crossUnder(
  a: ValueExtractor,
  b: ValueExtractor | number,
): StreamingPresetCondition {
  const extractA = toExtractorFn(a);
  const extractB = toExtractorFn(b);
  let prevA: number | null = null;
  let prevB: number | null = null;

  return {
    type: "preset",
    name: `crossUnder(${formatName(a)}, ${formatName(b)})`,
    evaluate: (snapshot, candle) => {
      const curA = extractA(snapshot, candle);
      const curB = extractB(snapshot, candle);

      const crossed =
        prevA !== null &&
        prevB !== null &&
        curA !== null &&
        curB !== null &&
        prevA >= prevB &&
        curA < curB;

      prevA = curA;
      prevB = curB;
      return crossed;
    },
  };
}
