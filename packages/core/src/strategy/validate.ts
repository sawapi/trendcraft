/**
 * Validation — Validate ConditionSpec and StrategyJSON against registry schemas
 *
 * @example
 * ```ts
 * import { validateConditionSpec, validateStrategyJSON, backtestRegistry } from "trendcraft";
 *
 * const result = validateConditionSpec(
 *   { name: "rsiBelow", params: { threshold: "not-a-number" } },
 *   backtestRegistry,
 * );
 * // { valid: false, errors: ['rsiBelow.threshold: expected number, got string'] }
 * ```
 */

import type { ConditionRegistry } from "./registry";
import type { ConditionSpec, ParamDef } from "./types";
import { describeType, isPlainObject } from "./utils";

/**
 * Validation result
 */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validate a ConditionSpec against a registry.
 *
 * Checks:
 * - Condition name exists in registry
 * - Parameter types match schema
 * - Required parameters are present
 * - Number values are within min/max range
 * - Enum values are in the allowed set
 * - Combinator structure is valid (recursive)
 *
 * @param spec - The condition spec to validate
 * @param registry - The registry to validate against
 * @returns Validation result with any errors found
 */
export function validateConditionSpec<T = unknown>(
  spec: ConditionSpec,
  registry: ConditionRegistry<T>,
): ValidationResult {
  const errors: string[] = [];
  validateSpecRecursive(spec, registry, errors, "");
  return { valid: errors.length === 0, errors };
}

function validateSpecRecursive<T>(
  spec: ConditionSpec,
  registry: ConditionRegistry<T>,
  errors: string[],
  path: string,
): void {
  // `in` throws on a primitive or null, and a combinator's `conditions` array
  // is a very ordinary place for one to appear — a bare condition NAME where
  // an object belonged is exactly what a hand-written or generated strategy
  // gets wrong. A validator must report that, not crash on it.
  if (!isPlainObject(spec)) {
    // Children are handed a path ending in `.` for the next token to consume
    // (`and[0].` + `goldenCross`). This branch has no token to append, so the
    // separator would dangle: `and[0].: expected condition object`.
    const at = path.replace(/\.$/, "") || "condition";
    errors.push(`${at}: expected condition object, got ${describeType(spec)}`);
    return;
  }

  // Combinator node
  if ("op" in spec) {
    if (!["and", "or", "not"].includes(spec.op)) {
      errors.push(`${path}op: invalid operator "${spec.op}"`);
      return;
    }

    if (!Array.isArray(spec.conditions) || spec.conditions.length === 0) {
      errors.push(`${path}${spec.op}: conditions must be a non-empty array`);
      return;
    }

    if (spec.op === "not" && spec.conditions.length !== 1) {
      errors.push(`${path}not: must have exactly 1 condition, got ${spec.conditions.length}`);
    }

    for (let i = 0; i < spec.conditions.length; i++) {
      validateSpecRecursive(spec.conditions[i], registry, errors, `${path}${spec.op}[${i}].`);
    }
    return;
  }

  // Leaf node
  const prefix = path ? `${path}${spec.name}` : spec.name;

  const entry = registry.get(spec.name);
  if (!entry) {
    errors.push(`${prefix}: unknown condition`);
    return;
  }

  const params = spec.params ?? {};
  // `Object.entries(42)` is `[]` and `Object.entries("ab")` yields index keys,
  // so an ill-shaped container silently became "no params" or nonsense ones.
  if (spec.params !== undefined && !isPlainObject(spec.params)) {
    errors.push(`${prefix}.params: expected an object, got ${describeType(spec.params)}`);
    return;
  }

  // Check required params
  for (const [key, def] of Object.entries(entry.params)) {
    if (def.required && params[key] === undefined && def.default === undefined) {
      errors.push(`${prefix}.${key}: required parameter missing`);
    }
  }

  // Check provided params
  for (const [key, value] of Object.entries(params)) {
    // `entry.params[key]` would resolve `toString` / `constructor` through
    // Object.prototype and treat the inherited function as a param definition,
    // reporting `expected undefined, got number`.
    if (!Object.hasOwn(entry.params, key)) {
      errors.push(`${prefix}.${key}: unknown parameter`);
      continue;
    }
    const def = entry.params[key];

    validateParam(`${prefix}.${key}`, value, def, errors);
  }
}

function validateParam(path: string, value: unknown, def: ParamDef, errors: string[]): void {
  if (def.array) {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected ${def.type}[], got ${describeType(value)}`);
      return;
    }
    if (def.minItems !== undefined && value.length < def.minItems) {
      errors.push(`${path}: expected at least ${def.minItems} items, got ${value.length}`);
    }
    if (def.maxItems !== undefined && value.length > def.maxItems) {
      errors.push(`${path}: expected at most ${def.maxItems} items, got ${value.length}`);
    }
    if (def.minDistinct !== undefined) {
      const distinct = new Set(value).size;
      if (distinct < def.minDistinct) {
        errors.push(
          `${path}: expected at least ${def.minDistinct} distinct values, got ${distinct}`,
        );
      }
    }
    // Element constraints are the same ones a scalar of this type would get.
    const elementDef: ParamDef = { ...def, array: false };
    value.forEach((item, i) => validateParam(`${path}[${i}]`, item, elementDef, errors));
    return;
  }

  // Type check
  const actualType = typeof value;
  if (actualType !== def.type) {
    errors.push(`${path}: expected ${def.type}, got ${describeType(value)}`);
    return;
  }

  // Number range checks
  if (def.type === "number" && typeof value === "number") {
    // `integer` was documented as a UI hint and enforced nowhere, so a param
    // that declares it still accepted `5.5` and failed inside the indicator.
    if (def.integer === true && !Number.isInteger(value)) {
      errors.push(`${path}: expected an integer, got ${value}`);
    }
    if (def.min !== undefined && value < def.min) {
      errors.push(`${path}: value ${value} is below minimum ${def.min}`);
    }
    if (def.max !== undefined && value > def.max) {
      errors.push(`${path}: value ${value} exceeds maximum ${def.max}`);
    }
  }

  // Enum check
  if (def.enum && !def.enum.includes(value)) {
    errors.push(
      `${path}: value ${JSON.stringify(value)} not in allowed values [${def.enum.map((v) => JSON.stringify(v)).join(", ")}]`,
    );
  }
}

/**
 * Validate a StrategyJSON object structure.
 *
 * Checks required fields and version. Does NOT validate conditions
 * against a registry (use validateConditionSpec for that).
 *
 * @param json - The strategy JSON to validate
 * @returns Validation result
 */
export function validateStrategyJSON(json: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof json !== "object" || json === null) {
    return { valid: false, errors: ["Strategy must be an object"] };
  }

  const obj = json as Record<string, unknown>;

  if (obj.$schema !== "trendcraft/strategy") {
    errors.push(`$schema: expected "trendcraft/strategy", got ${JSON.stringify(obj.$schema)}`);
  }

  if (obj.version !== 1) {
    errors.push(`version: expected 1, got ${JSON.stringify(obj.version)}`);
  }

  if (typeof obj.id !== "string" || obj.id.length === 0) {
    errors.push("id: required non-empty string");
  }

  if (typeof obj.name !== "string" || obj.name.length === 0) {
    errors.push("name: required non-empty string");
  }

  if (!obj.entry || typeof obj.entry !== "object") {
    errors.push("entry: required condition spec");
  }

  if (!obj.exit || typeof obj.exit !== "object") {
    errors.push("exit: required condition spec");
  }

  return { valid: errors.length === 0, errors };
}
