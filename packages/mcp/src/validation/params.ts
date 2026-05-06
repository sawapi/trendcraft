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

const NUMBER_LIKE_KEY_RE =
  /period$|periods$|length$|signalPeriod$|smoothPeriod$|window$|threshold$|multiplier$|sigma$|stdDev$|kPeriod$|dPeriod$|fastPeriod$|slowPeriod$|shortPeriod$|longPeriod$|cyclePeriod$|step$|max$/i;

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
 * - nested object value → reject
 * - array containing a nested array, `null`, `NaN`, or a non-primitive
 *   element → reject (flat `number[]` / `string[]` / `boolean[]` are OK)
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

  for (const [key, value] of Object.entries(params)) {
    if (value === null) {
      throw new Error(`INVALID_PARAMETER: params.${key} for "${kind}" is null.`);
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        for (const v of value) {
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
      } else {
        throw new Error(
          `INVALID_PARAMETER: params.${key} for "${kind}" is a nested object — pass primitives only.`,
        );
      }
    } else if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(
        `INVALID_PARAMETER: params.${key} for "${kind}" is ${value} (not a finite number).`,
      );
    } else if (typeof value === "string" && NUMBER_LIKE_KEY_RE.test(key)) {
      throw new Error(
        `INVALID_PARAMETER: params.${key} for "${kind}" is a string ("${value}") but a number is expected.`,
      );
    }
  }
}

function describeValue(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
