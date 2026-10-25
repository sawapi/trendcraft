/**
 * Shared min/max helpers for series price-range computation.
 * Each `*PriceRange` in src/series/ delegates to these to avoid
 * duplicating the same null-safe reduction loop in every renderer.
 */

/** Running min/max accumulator. Pass between calls to accumulate across sources. */
export type MinMax = [min: number, max: number];

/** Fresh identity accumulator — always allocate, never share (tuples are mutable). */
export function emptyRange(): MinMax {
  return [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
}

/**
 * Reduce a numeric array (with null/undefined/non-finite gaps) into its min/max over
 * [startIndex, endIndex). Accepts an accumulator for multi-source ranges.
 */
export function reduceRange(
  values: readonly (number | null | undefined)[],
  startIndex: number,
  endIndex: number,
  acc: MinMax = emptyRange(),
): MinMax {
  let [min, max] = acc;
  const lim = Math.min(endIndex, values.length);
  for (let i = startIndex; i < lim; i++) {
    const v = values[i];
    // Non-finite values are gaps too: one Infinity would stretch the range
    // and blank every other value on the pane.
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}
