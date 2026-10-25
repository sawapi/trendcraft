/**
 * MCP-side input parameter guard.
 *
 * Indicator / signal calls accept a free-form `params: Record<string, unknown>`
 * because the underlying functions are heterogeneous. That flexibility is also
 * the main silent-failure surface for LLM-driven callers: a stringified
 * number, an `NaN` leaked into JSON, or a nested option blob is silently
 * consumed by the factory and the indicator falls back to defaults (or
 * NaN-out without throwing).
 *
 * This module catches the structural / wrong-type shapes upfront and turns
 * them into `INVALID_PARAMETER` errors. It is intentionally conservative:
 *
 * - Per-parameter range and type contracts stay with the indicator.
 * - Unknown / typo'd keys are NOT rejected — manifest `paramHints` is a
 *   curated tuning-knob hint, not an exhaustive option list (e.g. `source`
 *   is accepted by most indicators but rarely listed). Rejecting unknown
 *   keys here would block valid generic options like `source: "hlc3"`.
 *
 * The goal is to flag wrong shapes that would otherwise turn into a
 * downstream NaN or a default fallback that masquerades as success.
 */

import { getManifest } from "trendcraft/manifest";

const NUMBER_LIKE_KEY_RE =
  /period$|periods$|length$|signalPeriod$|smoothPeriod$|window$|threshold$|multiplier$|sigma$|stdDev$|kPeriod$|dPeriod$|fastPeriod$|slowPeriod$|shortPeriod$|longPeriod$|cyclePeriod$|step$|max$/i;

/**
 * How many object levels a param may nest below the top-level params object:
 * `session` (1) and its `breaks[i]` (2).
 */
const MAX_NESTING = 2;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== "object") return false;
  if (Array.isArray(x)) return false;
  return true;
}

/**
 * Throws `INVALID_PARAMETER: ...` when `params` is structurally broken.
 *
 * Specifically:
 * - non-object / array / primitive → reject
 * - `null` leaf value → reject
 * - nested object value → reject, unless the kind's manifest `paramHints`
 *   names that key (`vwap`'s `session`, `volatilityRegime`'s `thresholds`).
 *   Those advertised objects are accepted up to {@link MAX_NESTING} levels
 *   (`session.breaks[i]`) when every value in them passes the same leaf
 *   rules; deeper nesting → reject
 * - array containing a nested array, `null`, `NaN`, or a non-primitive
 *   element → reject (flat `number[]` / `string[]` / `boolean[]` are OK;
 *   an array of flat objects is OK only inside an advertised object)
 * - finite-number requirement for any numeric value
 * - string-where-number-expected on a numeric-style key
 *   (`{ period: "14" }`) → reject; we don't auto-coerce because the
 *   string form is more often a serialization bug than intent
 */
export function validateIndicatorParams(kind: string, params: unknown): void {
  if (params === undefined) return;
  if (!isPlainObject(params)) {
    throw new Error(
      `INVALID_PARAMETER: params for "${kind}" must be a plain object, got ${describeValue(params)}.`,
    );
  }

  const advertised = advertisedParamKeys(kind);
  for (const [name, value] of Object.entries(params)) {
    if (!isPlainObject(value)) {
      // Primitives and arrays of primitives only: objects, including objects
      // inside an array, are reserved for advertised object params.
      validateEntries(kind, "", { [name]: value }, 0);
      continue;
    }
    // A number-style key (`period`) never takes an object, advertised or not.
    if (!advertised.has(name) || NUMBER_LIKE_KEY_RE.test(name)) {
      throw new Error(
        `INVALID_PARAMETER: params.${name} for "${kind}" is a nested object — pass primitives only (object params are accepted only where get_indicator_manifest("${kind}").paramHints lists them).`,
      );
    }
    validateEntries(kind, `${name}.`, value, MAX_NESTING - 1);
  }
}

/**
 * Check each entry of a params object against the leaf rules above. While
 * `depth` is above 0, an entry may also be an object, or an array of objects,
 * whose entries are checked the same way one level down.
 */
function validateEntries(
  kind: string,
  prefix: string,
  params: Record<string, unknown>,
  depth: number,
): void {
  for (const [name, value] of Object.entries(params)) {
    const key = `${prefix}${name}`;
    if (value === null) {
      throw new Error(`INVALID_PARAMETER: params.${key} for "${kind}" is null.`);
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        for (const [i, v] of value.entries()) {
          if (isPlainObject(v) && depth > 0) {
            validateEntries(kind, `${key}[${i}].`, v, depth - 1);
            continue;
          }
          if (
            v === null ||
            (typeof v === "number" && !Number.isFinite(v)) ||
            (typeof v !== "number" && typeof v !== "string" && typeof v !== "boolean")
          ) {
            throw new Error(
              `INVALID_PARAMETER: params.${key} for "${kind}" must be an array of primitives (number / string / boolean).`,
            );
          }
        }
      } else if (depth > 0) {
        validateEntries(kind, `${key}.`, value as Record<string, unknown>, depth - 1);
      } else {
        throw new Error(
          `INVALID_PARAMETER: params.${key} for "${kind}" is nested too deeply — an object param may hold only primitives or arrays of primitives.`,
        );
      }
    } else if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(
        `INVALID_PARAMETER: params.${key} for "${kind}" is ${value} (not a finite number).`,
      );
    } else if (typeof value === "string" && NUMBER_LIKE_KEY_RE.test(name)) {
      throw new Error(
        `INVALID_PARAMETER: params.${key} for "${kind}" is a string ("${value}") but a number is expected.`,
      );
    }
  }
}

/** Param keys the kind's manifest advertises in `paramHints` (empty if none). */
function advertisedParamKeys(kind: string): Set<string> {
  try {
    return new Set(Object.keys(getManifest(kind)?.paramHints ?? {}));
  } catch {
    return new Set();
  }
}

function describeValue(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
