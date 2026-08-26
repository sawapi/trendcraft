/**
 * Shape and type inspection shared by the readers of an untrusted
 * `ConditionSpec`.
 *
 * A leaf module on purpose: `validate.ts` already imports `./registry`, so
 * neither of those two can own helpers the other needs, and `types.ts` is a
 * pure type module.
 */

import type { ParamDef } from "./types";

/**
 * A type name a strategy author can act on.
 *
 * `typeof` reports `"object"` for both arrays and `null`, so an array passed
 * where a number belonged would otherwise be reported as "got object".
 */
export function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * `true` for a non-null, non-array object — the only shape a `ConditionSpec`
 * node may take.
 *
 * `in` throws on a primitive, so every reader of an untrusted spec needs this
 * before touching it.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `true` when the param holds exactly one number.
 *
 * `type` names the ELEMENT type when `array` is set, so `type === "number"`
 * alone does not mean "scalar number" — an array param would pass such a gate
 * and fail much later, in a message about something else.
 */
export function isScalarNumberParam(def: ParamDef): boolean {
  return def.type === "number" && !def.array;
}
