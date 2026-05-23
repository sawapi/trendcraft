/**
 * Shared helpers for swing-derived incremental indicators.
 *
 * The four indicators that wrap `createSwingPoints` (Fibonacci Retracement /
 * Extension, Channel Line, Auto Trend Line) all repeat the same patterns:
 * resolving `leftBars` / `rightBars` with snapshot-precedence over options,
 * validating `< 1` errors, levels-array handling for Fibonacci variants, and
 * bookkeeping helpers like a bounded push and a shallow array clone.
 *
 * These helpers exist purely to remove duplication. They do not change the
 * runtime behavior of any indicator — every parity / snapshot / peek test
 * across the four sister files passes unchanged after this refactor.
 */

/**
 * Validate `leftBars` / `rightBars` (both `>= 1`).
 *
 * Under the 0.4.0 State Contract the precedence merge
 * (defaults < snapshot.params < options) is done by `resolveResume`;
 * this helper only performs the shared range validation.
 */
export function validateSwingConfig(
  leftBars: number,
  rightBars: number,
): {
  leftBars: number;
  rightBars: number;
} {
  if (leftBars < 1) throw new Error("leftBars must be at least 1");
  if (rightBars < 1) throw new Error("rightBars must be at least 1");
  return { leftBars, rightBars };
}

/**
 * Validate a Fibonacci-style `levels: number[]` (non-empty array) and
 * return both the (defensively copied) levels array and a pre-computed
 * array of `String(ratio)` keys so the hot path can skip per-bar
 * coercion.
 */
export function resolveLevels(levels: readonly number[]): {
  levels: number[];
  ratioKeys: string[];
} {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error("levels must be a non-empty array");
  }
  const copy = levels.slice();
  return { levels: copy, ratioKeys: copy.map(String) };
}

/**
 * Push `item` and drop the oldest entries until the array length is at most
 * `maxLen`. Used to keep "last N" trackers bounded (e.g., last 2 swing highs).
 */
export function pushBounded<T>(arr: T[], item: T, maxLen: number): void {
  arr.push(item);
  while (arr.length > maxLen) arr.shift();
}

/**
 * Shallow-clone an array of plain objects. Equivalent to
 * `arr.map((p) => ({ ...p }))` but reads more clearly when used 6+ times in
 * a single file.
 */
export function cloneShallow<T extends object>(arr: readonly T[]): T[] {
  return arr.map((p) => ({ ...p }));
}
