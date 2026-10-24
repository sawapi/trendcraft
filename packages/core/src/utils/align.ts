/**
 * Alignment rules for functions that take two or more series together.
 *
 * Pairing values by array index is only correct when the arrays describe the
 * same bars. Taking `Math.min(...lengths)` and reading from index 0 silently
 * pairs different dates as soon as the histories start at different times,
 * and the result (a correlation, a hedge ratio, a spread) still looks like a
 * valid number. Each multi-series function now states which rule it follows:
 *
 * - Inputs that carry timestamps are joined on them ({@link joinOnTime}).
 * - Parallel arrays that must describe the same bars are required to have the
 *   same length ({@link assertSameLength}); a mismatch is a caller bug that no
 *   positional rule can repair.
 */

/**
 * Throw unless every array has the same length.
 *
 * @param fn - Name of the public function, used in the error message
 * @param arrays - The parallel arrays, keyed by parameter name
 * @throws Error naming each array's length when they differ
 *
 * @example
 * ```ts
 * assertSameLength("pearsonCorrelation", { x: [1, 2, 3], y: [1, 2] });
 * // throws "pearsonCorrelation: x and y must have the same length (x: 3, y: 2)"
 * ```
 */
export function assertSameLength(fn: string, arrays: Record<string, readonly unknown[]>): void {
  const entries = Object.entries(arrays);
  if (entries.every(([, a]) => a.length === entries[0][1].length)) return;
  const names = entries.map(([name]) => name);
  const list =
    names.length === 2
      ? names.join(" and ")
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const lengths = entries.map(([name, a]) => `${name}: ${a.length}`).join(", ");
  throw new Error(`${fn}: ${list} must have the same length (${lengths})`);
}

/**
 * Inner-join two time-keyed series on their timestamps.
 *
 * Keeps only the times present in both, in the order of `a`, so each output
 * index pairs the two values observed at the same time. If a timestamp
 * repeats in `b`, its last value wins.
 *
 * @param a - First series
 * @param b - Second series
 * @returns The shared times and the matching values from each series
 *
 * @example
 * ```ts
 * const { times, a, b } = joinOnTime(
 *   [{ time: 1, value: 10 }, { time: 2, value: 11 }],
 *   [{ time: 2, value: 20 }, { time: 3, value: 21 }],
 * );
 * // times = [2], a = [11], b = [20]
 * ```
 */
export function joinOnTime(
  a: ReadonlyArray<{ time: number; value: number }>,
  b: ReadonlyArray<{ time: number; value: number }>,
): { times: number[]; a: number[]; b: number[] } {
  const byTime = new Map<number, number>();
  for (const point of b) byTime.set(point.time, point.value);

  const times: number[] = [];
  const valuesA: number[] = [];
  const valuesB: number[] = [];
  for (const point of a) {
    const other = byTime.get(point.time);
    if (other === undefined) continue;
    times.push(point.time);
    valuesA.push(point.value);
    valuesB.push(other);
  }
  return { times, a: valuesA, b: valuesB };
}
