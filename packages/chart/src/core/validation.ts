/**
 * Shape predicates for public-API inputs.
 *
 * The chart never throws on bad input; methods log via the host's `_warn`
 * helper (which emits the `error` event with a {@link ChartErrorCode}) and
 * skip the offending entry. Predicates here return a structured result so
 * the caller can decide whether to surface the issue once or per-element.
 */
import type { SignalMarker, TradeMarker } from "./types";

export type ShapeIssue = {
  /** Index of the offending entry in the input array, or -1 for top-level errors. */
  index: number;
  /** Single-line description of what was wrong. */
  reason: string;
};

export type ShapeCheck<T> =
  | { ok: true; value: T[]; issues?: ShapeIssue[] }
  | { ok: false; reason: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

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
 * Validate `addSignals` input. Each entry must have a finite epoch-ms `time`
 * and `type` of `'buy'` or `'sell'`.
 */
export function checkSignals(input: unknown): ShapeCheck<SignalMarker> {
  if (!Array.isArray(input)) return { ok: false, reason: "expected an array" };
  const issues: ShapeIssue[] = [];
  let valid: SignalMarker[] | null = null;
  for (let i = 0; i < input.length; i++) {
    const m = input[i];
    let reason: string | null = null;
    if (!isObject(m) || !("time" in m) || !("type" in m)) {
      reason = "missing time or type";
    } else if (m.type !== "buy" && m.type !== "sell") {
      reason = `type must be 'buy' or 'sell', got ${String(m.type)}`;
    } else if (!isFiniteNumber(m.time)) {
      reason = "time must be a finite number (epoch ms)";
    }
    if (reason !== null) {
      if (valid === null) valid = input.slice(0, i) as SignalMarker[];
      issues.push({ index: i, reason });
    } else if (valid !== null) {
      valid.push(m as SignalMarker);
    }
  }
  return issues.length === 0
    ? { ok: true, value: input as SignalMarker[] }
    : { ok: true, value: valid ?? [], issues };
}

/**
 * Validate `addTrades` input. Each entry must have entry/exit times and
 * prices, all of which must be finite numbers (epoch ms for times).
 */
export function checkTrades(input: unknown): ShapeCheck<TradeMarker> {
  if (!Array.isArray(input)) return { ok: false, reason: "expected an array" };
  const issues: ShapeIssue[] = [];
  let valid: TradeMarker[] | null = null;
  for (let i = 0; i < input.length; i++) {
    const t = input[i];
    let reason: string | null = null;
    if (
      !isObject(t) ||
      !("entryTime" in t) ||
      !("exitTime" in t) ||
      !("entryPrice" in t) ||
      !("exitPrice" in t)
    ) {
      reason = "missing entryTime/exitTime/entryPrice/exitPrice";
    } else if (!isFiniteNumber(t.entryTime) || !isFiniteNumber(t.exitTime)) {
      reason = "entryTime and exitTime must be finite numbers (epoch ms)";
    } else if (!isFiniteNumber(t.entryPrice) || !isFiniteNumber(t.exitPrice)) {
      reason = "entryPrice and exitPrice must be finite numbers";
    }
    if (reason !== null) {
      if (valid === null) valid = input.slice(0, i) as TradeMarker[];
      issues.push({ index: i, reason });
    } else if (valid !== null) {
      valid.push(t as TradeMarker);
    }
  }
  return issues.length === 0
    ? { ok: true, value: input as TradeMarker[] }
    : { ok: true, value: valid ?? [], issues };
}

/**
 * Validate `addBacktest` input. Confirms the required scalar fields are
 * finite numbers and that `trades` is an array; element-level shape inside
 * `trades` is not checked here — bad rows are dropped at render time.
 */
export function checkBacktest(input: unknown): { ok: true } | { ok: false; reason: string } {
  if (!isObject(input)) return { ok: false, reason: "expected an object" };
  const requiredNumbers = [
    "initialCapital",
    "finalCapital",
    "totalReturnPercent",
    "tradeCount",
    "winRate",
    "maxDrawdown",
  ] as const;
  for (const k of requiredNumbers) {
    const v = input[k];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return { ok: false, reason: `${k} must be a finite number` };
    }
  }
  if (!Array.isArray(input.trades)) {
    return { ok: false, reason: "trades must be an array" };
  }
  if (!Array.isArray(input.drawdownPeriods)) {
    return { ok: false, reason: "drawdownPeriods must be an array" };
  }
  return { ok: true };
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
