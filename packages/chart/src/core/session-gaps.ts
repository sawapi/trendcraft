/**
 * Session gap helpers — resolve the `timeScale.sessionGaps` option and find
 * where gaps go for the index-based `"dayBoundary"` layout.
 */

import { dayKey } from "./time-zone";
import type { CandleData, SessionGapsOptions } from "./types";

export type ResolvedSessionGapsOptions = Required<Omit<SessionGapsOptions, "timeZone">> &
  Pick<SessionGapsOptions, "timeZone">;

/** Fill in the defaults. `timeZone` is passed through as given (validated by the caller). */
export function resolveSessionGapsOptions(
  input: boolean | SessionGapsOptions | undefined,
): ResolvedSessionGapsOptions {
  if (!input) {
    return {
      mode: "off",
      sizeBars: 1,
      intradayThresholdMs: 6 * 60 * 60 * 1000,
      gapThresholdMs: 0,
    };
  }
  const opts: SessionGapsOptions = input === true ? {} : input;
  return {
    mode: opts.mode ?? "timeGap",
    sizeBars: opts.sizeBars ?? 1,
    intradayThresholdMs: opts.intradayThresholdMs ?? 6 * 60 * 60 * 1000,
    gapThresholdMs: opts.gapThresholdMs ?? 0,
    timeZone: opts.timeZone || undefined,
  };
}

/** Median interval between bars in ms, sampled at up to ~64 points (Infinity when none). */
export function medianBarInterval(candles: readonly CandleData[]): number {
  const deltas: number[] = [];
  const stride = Math.max(1, Math.floor(candles.length / 64));
  for (let i = stride; i < candles.length; i += stride) {
    const d = candles[i].time - candles[i - stride].time;
    if (d > 0) deltas.push(d / stride);
  }
  if (deltas.length === 0) return Number.POSITIVE_INFINITY;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
}

/**
 * Gap positions for `mode: "dayBoundary"`: one before every bar whose
 * calendar day differs from the previous bar's. The day is read in
 * `opts.timeZone`, else in `chartTimeZone` (the chart's `timeZone` option),
 * else in UTC, so the gaps line up with the date row of the time axis.
 */
export function computeDayBoundaryGaps(
  candles: readonly CandleData[],
  opts: ResolvedSessionGapsOptions,
  chartTimeZone?: string,
): Array<{ index: number; size: number }> {
  const timeZone = opts.timeZone ?? chartTimeZone;
  const gaps: Array<{ index: number; size: number }> = [];
  let prevDay = -1;
  for (let i = 0; i < candles.length; i++) {
    const day = dayKey(candles[i].time, timeZone);
    if (prevDay >= 0 && day !== prevDay) {
      gaps.push({ index: i, size: opts.sizeBars });
    }
    prevDay = day;
  }
  return gaps;
}
