/**
 * Sort comparator by time that puts rows with a non-finite time last, in their
 * existing order. Subtracting such times gives NaN, which leaves the order of
 * a plain `a.time - b.time` sort undefined.
 */
export function compareTimeNonFiniteLast(a: { time: number }, b: { time: number }): number {
  const aBad = Number(!Number.isFinite(a.time));
  const bBad = Number(!Number.isFinite(b.time));
  return aBad - bBad || (aBad ? 0 : a.time - b.time);
}
