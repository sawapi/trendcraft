/**
 * Validation for options that take one of a fixed set of keywords.
 *
 * A `switch` over such an option used to end in a `default` that quietly
 * picked a fallback, so a misspelt keyword produced a result for a different
 * setting than the one asked for. These options are checked on entry instead.
 */

import type { PositionDirection } from "../types";
import { showValue } from "./validate-period";

declare const keywordListBrand: unique symbol;

/**
 * A keyword list built by {@link keywords}. The brand means an inline literal
 * cannot be passed where a list is expected: its element type would be
 * inferred from the literal, so a union member it leaves out would go
 * unnoticed.
 */
export type KeywordList<T extends string> = readonly T[] & {
  readonly [keywordListBrand]: true;
};

/**
 * Build the error for a value outside an option's keywords.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The rejected value
 * @param allowed - The keywords the option accepts
 */
export function keywordError(label: string, value: unknown, allowed: KeywordList<string>): Error {
  const list = allowed.map((k) => JSON.stringify(k)).join(", ");
  return new Error(`${label} must be one of ${list}, got ${showValue(value)}`);
}

/**
 * Assert that an option is one of its keywords.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @param allowed - The keywords the option accepts
 * @throws Error if `value` is not one of `allowed`
 *
 * @example
 * ```ts
 * const UNITS = keywords<"day" | "week">()(["day", "week"]);
 * assertOneOf("timeframe unit", "week", UNITS); // ok
 * assertOneOf("timeframe unit", "wek", UNITS); // throws
 * ```
 */
export function assertOneOf<T extends string>(
  label: string,
  value: unknown,
  allowed: KeywordList<T>,
): asserts value is T {
  if (!(typeof value === "string" && (allowed as readonly string[]).includes(value))) {
    throw keywordError(label, value, allowed);
  }
}

/**
 * Declare the keyword list for a string union, checked against the union at
 * compile time in both directions: a value outside `T` is a type error, and so
 * is a list that leaves a member of `T` out. Without the second check a new
 * union member would compile and then be rejected at runtime.
 *
 * @example
 * ```ts
 * type Unit = "day" | "week";
 * const UNITS = keywords<Unit>()(["day", "week"]); // ok
 * // keywords<Unit>()(["day"]); // type error: "week" is missing
 * ```
 */
export function keywords<T extends string>() {
  return <const L extends readonly T[]>(
    list: L &
      ([Exclude<T, L[number]>] extends [never] ? unknown : { missing: Exclude<T, L[number]> }),
  ): KeywordList<T> => list as unknown as KeywordList<T>;
}

/** Every value `PositionDirection` allows. */
export const POSITION_DIRECTIONS = keywords<PositionDirection>()(["long", "short"]);

/**
 * Assert that a direction is `"long"` or `"short"`. Directions are read with a
 * single comparison (`=== "long"` or `=== "short"`), so any other value was
 * treated as whichever side that comparison left over.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The direction to validate
 * @throws Error if `value` is neither `"long"` nor `"short"`
 */
export function assertPositionDirection(
  label: string,
  value: unknown,
): asserts value is PositionDirection {
  assertOneOf(label, value, POSITION_DIRECTIONS);
}
