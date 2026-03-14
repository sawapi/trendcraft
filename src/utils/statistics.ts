/**
 * Shared statistical primitives
 *
 * Small helpers used by multiple modules (alpha-decay, correlation, etc.).
 */

/**
 * Compute ranks for a numeric array, handling ties with average rank
 *
 * @param values - Array of numeric values
 * @returns Array of ranks (1-based, ties averaged)
 *
 * @example
 * ```ts
 * computeRanks([10, 30, 20]); // [1, 3, 2]
 * computeRanks([10, 10, 20]); // [1.5, 1.5, 3]
 * ```
 */
export function computeRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}
