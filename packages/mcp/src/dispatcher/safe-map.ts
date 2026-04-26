/**
 * Maps indicator `kind` to a safe-wrapped implementation from `trendcraft/safe`.
 *
 * The `trendcraft/safe` module exports each wrapper under the canonical kind
 * name (rsi, ema, ichimoku, ...). We import as a namespace and look up by
 * key — keeping the dispatcher table data-driven rather than hand-rolled.
 *
 * Returns `undefined` for kinds that have no safe wrapper (e.g. SMC, Wyckoff,
 * session, regime indicators not yet promoted to `trendcraft/safe`).
 */

import * as safeApi from "trendcraft/safe";

type AnyResultFn = (...args: unknown[]) => unknown;

const SAFE_LOOKUP = safeApi as unknown as Record<string, unknown>;

/** Reserved keys exported from trendcraft/safe that are not indicator wrappers. */
const NON_INDICATOR_KEYS = new Set([
  "ok",
  "err",
  "unwrap",
  "unwrapOr",
  "mapResult",
  "flatMap",
  "default",
]);

export function getSafeIndicator(kind: string): AnyResultFn | undefined {
  if (NON_INDICATOR_KEYS.has(kind)) return undefined;
  const fn = SAFE_LOOKUP[kind];
  return typeof fn === "function" ? (fn as AnyResultFn) : undefined;
}

let _supportedKindsCache: string[] | null = null;
let _supportedKindsSetCache: Set<string> | null = null;

export function listSupportedKinds(): string[] {
  if (_supportedKindsCache) return _supportedKindsCache;
  _supportedKindsCache = Object.keys(SAFE_LOOKUP)
    .filter((k) => !NON_INDICATOR_KEYS.has(k))
    .filter((k) => typeof SAFE_LOOKUP[k] === "function")
    .sort();
  return _supportedKindsCache;
}

export function supportedKindsSet(): Set<string> {
  if (_supportedKindsSetCache) return _supportedKindsSetCache;
  _supportedKindsSetCache = new Set(listSupportedKinds());
  return _supportedKindsSetCache;
}
