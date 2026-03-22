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
import type { ConditionSpec, ParamDef, StrategyJSON } from "./types";

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

  // Check required params
  for (const [key, def] of Object.entries(entry.params)) {
    if (def.required && params[key] === undefined && def.default === undefined) {
      errors.push(`${prefix}.${key}: required parameter missing`);
    }
  }

  // Check provided params
  for (const [key, value] of Object.entries(params)) {
    const def = entry.params[key];
    if (!def) {
      errors.push(`${prefix}.${key}: unknown parameter`);
      continue;
    }

    validateParam(`${prefix}.${key}`, value, def, errors);
  }
}

function validateParam(path: string, value: unknown, def: ParamDef, errors: string[]): void {
  // Type check
  const actualType = typeof value;
  if (actualType !== def.type) {
    errors.push(`${path}: expected ${def.type}, got ${actualType}`);
    return;
  }

  // Number range checks
  if (def.type === "number" && typeof value === "number") {
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
