/**
 * Validation for the `source` option that picks which candle field an
 * indicator reads.
 *
 * An unknown source used to fall through `getPrice` to the close, so
 * `sma(candles, { source: "hcl3" })` returned a plain close SMA without a
 * word. The batch and incremental indicators check it on entry, whatever the
 * data, and `getPrice` / `getSourcePrice` reject it as a backstop.
 */

import type { PriceSource } from "../types";
import { assertOneOf, keywordError, keywords } from "./validate-keyword";

/** Every value `PriceSource` allows, in declaration order. */
export const PRICE_SOURCES = keywords<PriceSource>()([
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
  "volume",
]);

/**
 * Build the error for a value that is not a {@link PriceSource}.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The rejected value
 */
export function priceSourceError(label: string, value: unknown): Error {
  return keywordError(label, value, PRICE_SOURCES);
}

/**
 * Assert that a `source` option is a known {@link PriceSource}.
 *
 * @param label - Human-readable option name, used verbatim in the message
 *   (e.g. `"SMA source"`)
 * @param value - The option value to validate
 * @throws Error if `value` is not one of {@link PRICE_SOURCES}
 *
 * @example
 * ```ts
 * assertPriceSource("SMA source", "hlc3"); // ok
 * assertPriceSource("SMA source", "hcl3"); // throws: SMA source must be one of ...
 * ```
 */
export function assertPriceSource(label: string, value: unknown): asserts value is PriceSource {
  assertOneOf(label, value, PRICE_SOURCES);
}
