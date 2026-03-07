/**
 * Snapshot Value Extraction Utilities
 *
 * Type-safe helpers for extracting values from `IndicatorSnapshot`,
 * which uses `{ [key: string]: unknown }` internally.
 *
 * @example
 * ```ts
 * // Simple numeric indicator
 * getNumber(snapshot, "rsi");        // number | null
 *
 * // Compound indicator sub-field
 * getField(snapshot, "bb", "lower"); // number | null
 *
 * // Dot-path resolution (auto-delegates to getField)
 * resolveNumber(snapshot, "bb.lower"); // number | null
 * resolveNumber(snapshot, "rsi");      // number | null
 * ```
 */

import type { IndicatorSnapshot } from "./conditions/types";

/**
 * Safely extract a numeric value from the snapshot.
 *
 * Returns `null` when the key is missing, undefined, or not a number.
 *
 * @param snapshot - Indicator snapshot
 * @param key - Top-level snapshot key
 *
 * @example
 * ```ts
 * const rsi = getNumber(snapshot, "rsi"); // 42.5 | null
 * ```
 */
export function getNumber(
  snapshot: IndicatorSnapshot,
  key: string,
): number | null {
  const val = snapshot[key];
  return typeof val === "number" ? val : null;
}

/**
 * Safely extract a numeric sub-field from a compound indicator value.
 *
 * Works with indicators that store objects (MACD, Bollinger Bands, DMI, etc.).
 * Returns `null` when the key is missing, the value is not an object,
 * or the field does not exist / is not a number.
 *
 * @param snapshot - Indicator snapshot
 * @param key - Top-level snapshot key (e.g., "bb", "macd", "dmi")
 * @param field - Sub-field name (e.g., "lower", "histogram", "plusDi")
 *
 * @example
 * ```ts
 * getField(snapshot, "bb", "lower");       // number | null
 * getField(snapshot, "macd", "histogram"); // number | null
 * getField(snapshot, "dmi", "adx");        // number | null
 * ```
 */
export function getField(
  snapshot: IndicatorSnapshot,
  key: string,
  field: string,
): number | null {
  const val = snapshot[key];
  if (val == null || typeof val !== "object") return null;
  const fieldVal = (val as Record<string, unknown>)[field];
  return typeof fieldVal === "number" ? fieldVal : null;
}

/**
 * Resolve a dot-separated path to a numeric value.
 *
 * - `"rsi"` delegates to `getNumber(snapshot, "rsi")`
 * - `"bb.lower"` delegates to `getField(snapshot, "bb", "lower")`
 *
 * Only one level of nesting is supported (matches the snapshot structure).
 *
 * @param snapshot - Indicator snapshot
 * @param path - Dot-separated path (e.g., "rsi", "bb.lower", "macd.histogram")
 *
 * @example
 * ```ts
 * resolveNumber(snapshot, "rsi");            // getNumber(snapshot, "rsi")
 * resolveNumber(snapshot, "macd.histogram"); // getField(snapshot, "macd", "histogram")
 * ```
 */
export function resolveNumber(
  snapshot: IndicatorSnapshot,
  path: string,
): number | null {
  const dotIndex = path.indexOf(".");
  if (dotIndex === -1) {
    return getNumber(snapshot, path);
  }
  const key = path.slice(0, dotIndex);
  const field = path.slice(dotIndex + 1);
  return getField(snapshot, key, field);
}
