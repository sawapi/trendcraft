/**
 * Shape predicates for public-API inputs.
 *
 * The chart never throws on bad input; methods log via the host's `_warn`
 * helper (which emits the `error` event with a {@link ChartErrorCode}) and
 * skip the offending entry. Predicates here return a structured result so
 * the caller can decide whether to surface the issue once or per-element.
 */

export type ShapeIssue = {
  /** Index of the offending entry in the input array, or -1 for top-level errors. */
  index: number;
  /** Single-line description of what was wrong. */
  reason: string;
};

export type ShapeCheck<T> =
  | { ok: true; value: T[]; issues?: ShapeIssue[] }
  | { ok: false; reason: string };

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * True when all four OHLC fields are finite. Canvas silently swallows draw
 * calls with `NaN` / `±Infinity` coordinates, so renderers skip any bar that
 * fails this check rather than leaving an invisible gap with no error. Used by
 * the candlestick and overlay-candle renderers, which share the exact guard.
 */
export function isFiniteOHLC(c: {
  open: number;
  high: number;
  low: number;
  close: number;
}): boolean {
  return (
    Number.isFinite(c.open) &&
    Number.isFinite(c.high) &&
    Number.isFinite(c.low) &&
    Number.isFinite(c.close)
  );
}

/**
 * Coerce a list of issues into a single human-readable detail object suitable
 * for the `error` event payload. Truncates to `max` samples to avoid flooding
 * console output when many entries are bad.
 */
export function summarizeIssues(issues: ShapeIssue[] | undefined, max = 3): unknown {
  if (!issues || issues.length === 0) return undefined;
  const samples = issues
    .slice(0, max)
    .map((i) => (i.index >= 0 ? `[${i.index}] ${i.reason}` : i.reason));
  const omitted = issues.length - samples.length;
  return omitted > 0
    ? { rejected: issues.length, samples, omitted }
    : { rejected: issues.length, samples };
}
