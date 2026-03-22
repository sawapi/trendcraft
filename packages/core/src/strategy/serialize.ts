/**
 * Serialization — Convert StrategyJSON to/from JSON strings
 *
 * @example
 * ```ts
 * import { serializeStrategy, parseStrategy } from "trendcraft";
 *
 * const json = serializeStrategy(strategy);
 * const parsed = parseStrategy(json);
 * ```
 */

import type { StrategyJSON } from "./types";

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
 * Validates the $schema and version fields.
 *
 * @param json - JSON string to parse
 * @returns Parsed StrategyJSON
 * @throws Error if the JSON is invalid or has wrong schema/version
 *
 * @example
 * ```ts
 * const strategy = parseStrategy('{"$schema":"trendcraft/strategy","version":1,...}');
 * ```
 */
export function parseStrategy(json: string): StrategyJSON {
  const obj = JSON.parse(json) as Record<string, unknown>;

  if (obj.$schema !== "trendcraft/strategy") {
    throw new Error(
      `Invalid strategy schema: expected "trendcraft/strategy", got "${String(obj.$schema)}"`,
    );
  }

  if (obj.version !== 1) {
    throw new Error(`Unsupported strategy version: ${String(obj.version)} (supported: 1)`);
  }

  return obj as unknown as StrategyJSON;
}
