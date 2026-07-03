/**
 * Serialization — Convert StrategyJSON to/from JSON strings
 *
 * @example
 * ```ts
 * import { serializeStrategy, parseStrategy } from "trendcraft";
 *
 * const json = serializeStrategy(strategyJson);
 * const parsed = parseStrategy(json);
 * ```
 */

import { err, ok, type Result, tcError } from "../types/result";
import type { ConditionRegistry } from "./registry";
import type { StrategyJSON } from "./types";
import { validateConditionSpec, validateStrategyJSON } from "./validate";

/**
 * Serialize a StrategyJSON to a formatted JSON string.
 *
 * @param strategy - The strategy object to serialize
 * @returns Formatted JSON string (2-space indent)
 *
 * @example
 * ```ts
 * const jsonString = serializeStrategy({
 *   $schema: "trendcraft/strategy",
 *   version: 1,
 *   id: "my-strategy",
 *   name: "Golden Cross",
 *   entry: { name: "goldenCross" },
 *   exit: { name: "deadCross" },
 * });
 * ```
 */
export function serializeStrategy(strategy: StrategyJSON): string {
  return JSON.stringify(strategy, null, 2);
}

/**
 * Parse a JSON string into a StrategyJSON object.
 *
 * Always validates the `$schema` and `version` fields. When a
 * `registry` is provided, additionally validates the structural
 * shape (`validateStrategyJSON`) and the entry / exit
 * `ConditionSpec` trees (`validateConditionSpec`) against the
 * registry — surfacing unknown conditions, missing required params,
 * out-of-range values, and malformed `not` arity at parse time
 * instead of deferring them to `loadStrategy()` / runtime.
 *
 * Without a `registry`, behavior is unchanged: only schema and
 * version are checked. Pass the registry whenever the caller has
 * one available (most LLM / MCP / file-load paths do).
 *
 * @param json - JSON string to parse
 * @param registry - Optional ConditionRegistry for full validation
 * @returns Parsed StrategyJSON
 * @throws Error if the JSON is invalid, has wrong schema/version,
 *   or (when `registry` is given) fails structural / condition
 *   validation. Errors from registry validation are aggregated into
 *   a single message with one bullet per finding.
 *
 * @example
 * ```ts
 * // Minimal parse (back-compat).
 * const s = parseStrategy(jsonString);
 *
 * // Strict: catch unknown conditions / bad params upfront.
 * const s2 = parseStrategy(jsonString, backtestRegistry);
 * ```
 */
export function parseStrategy<T = unknown>(
  json: string,
  registry?: ConditionRegistry<T>,
): StrategyJSON {
  const parsed = JSON.parse(json);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Invalid strategy: expected JSON object, got ${parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed}`,
    );
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.$schema !== "trendcraft/strategy") {
    throw new Error(
      `Invalid strategy schema: expected "trendcraft/strategy", got "${String(obj.$schema)}"`,
    );
  }

  if (obj.version !== 1) {
    throw new Error(`Unsupported strategy version: ${String(obj.version)} (supported: 1)`);
  }

  if (registry) {
    const errors = collectValidationErrors(obj, registry);
    if (errors.length > 0) {
      throw new Error(`Invalid strategy:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    }
  }

  return obj as unknown as StrategyJSON;
}

/**
 * Safe variant of `parseStrategy` that returns a `Result` instead of
 * throwing. Distinguishes the failure mode via error code:
 *
 * - `INVALID_JSON` — `JSON.parse` failed
 * - `INVALID_SCHEMA` — `$schema` is not `"trendcraft/strategy"`
 * - `UNSUPPORTED_VERSION` — `version` is not `1`
 * - `INVALID_STRUCTURE` — `validateStrategyJSON` flagged structural
 *   issues (missing `id` / `name` / `entry` / `exit`, etc.)
 * - `INVALID_CONDITION` — `validateConditionSpec` flagged registry
 *   issues (unknown condition, bad params, malformed `not` arity)
 *
 * @example
 * ```ts
 * const result = parseStrategySafe(jsonString, backtestRegistry);
 * if (result.ok) {
 *   loadStrategy(result.value, backtestRegistry);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export function parseStrategySafe<T = unknown>(
  json: string,
  registry?: ConditionRegistry<T>,
): Result<StrategyJSON> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(tcError("INVALID_JSON", `Failed to parse JSON: ${message}`));
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return err(
      tcError(
        "INVALID_SCHEMA",
        `Invalid strategy: expected JSON object, got ${parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed}`,
      ),
    );
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.$schema !== "trendcraft/strategy") {
    return err(
      tcError(
        "INVALID_SCHEMA",
        `Invalid strategy schema: expected "trendcraft/strategy", got "${String(obj.$schema)}"`,
      ),
    );
  }

  if (obj.version !== 1) {
    return err(
      tcError(
        "UNSUPPORTED_VERSION",
        `Unsupported strategy version: ${String(obj.version)} (supported: 1)`,
      ),
    );
  }

  if (registry) {
    const structErrors = validateStrategyJSON(obj);
    if (!structErrors.valid) {
      return err(
        tcError(
          "INVALID_STRUCTURE",
          `Invalid strategy structure:\n${structErrors.errors.map((e) => `  - ${e}`).join("\n")}`,
        ),
      );
    }

    const condErrors = collectConditionErrors(obj, registry);
    if (condErrors.length > 0) {
      return err(
        tcError(
          "INVALID_CONDITION",
          `Invalid strategy conditions:\n${condErrors.map((e) => `  - ${e}`).join("\n")}`,
        ),
      );
    }
  }

  return ok(obj as unknown as StrategyJSON);
}

/**
 * Run both structural and condition validation against `registry`,
 * returning the flat list of errors. Used by both `parseStrategy`
 * (which collapses into a single throw) and `parseStrategySafe`
 * (which classifies by structural vs condition).
 */
function collectValidationErrors<T>(
  obj: Record<string, unknown>,
  registry: ConditionRegistry<T>,
): string[] {
  const errors: string[] = [];

  const struct = validateStrategyJSON(obj);
  if (!struct.valid) {
    errors.push(...struct.errors);
    // Don't dive into condition validation if the structural shape
    // is broken — `obj.entry` / `obj.exit` may not be ConditionSpec.
    return errors;
  }

  errors.push(...collectConditionErrors(obj, registry));
  return errors;
}

function collectConditionErrors<T>(
  obj: Record<string, unknown>,
  registry: ConditionRegistry<T>,
): string[] {
  const errors: string[] = [];
  const strategy = obj as unknown as StrategyJSON;
  for (const bucket of ["entry", "exit"] as const) {
    const result = validateConditionSpec(strategy[bucket], registry);
    if (!result.valid) {
      errors.push(...result.errors.map((e) => `${bucket}.${e}`));
    }
  }
  return errors;
}
