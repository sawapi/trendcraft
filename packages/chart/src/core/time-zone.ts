/**
 * Wall-clock reading of an epoch time in a given IANA time zone.
 *
 * Every time label (axis, crosshair) and the date boundaries of the two-row
 * axis read the calendar through {@link wallClock}, so they agree on one
 * clock: the chart's `timeZone` option, or the browser's local zone when it
 * is not set.
 */

/**
 * Offsets are cached per 15-minute bucket. Nearly every zone transition
 * falls on a bucket boundary; for the few that do not (historical ones in a
 * handful of zones, e.g. America/Goose_Bay, Asia/Gaza), a bucket whose two
 * ends disagree is not cached and the offset is read for the exact second.
 */
const BUCKET_MS = 15 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();
const offsets = new Map<string, number>();

/**
 * A Date whose UTC fields (`getUTCFullYear()`, `getUTCHours()`, ...) read the
 * wall clock of `time` in `timeZone`, or in the browser's local zone when
 * `timeZone` is omitted.
 */
export function wallClock(time: number, timeZone?: string): Date {
  return new Date(
    time + (timeZone ? zoneOffset(time, timeZone) : -new Date(time).getTimezoneOffset() * 60_000),
  );
}

/** Offset of `timeZone` from UTC at `time`, in ms. */
function zoneOffset(time: number, timeZone: string): number {
  const at = Math.floor(time / BUCKET_MS) * BUCKET_MS;
  const key = timeZone + at;
  let off = offsets.get(key);
  if (off === undefined) {
    off = offsetAt(at, timeZone);
    if (offsetAt(at + BUCKET_MS - 1000, timeZone) !== off) {
      return offsetAt(Math.floor(time / 1000) * 1000, timeZone);
    }
    if (offsets.size >= 4096) offsets.clear();
    offsets.set(key, off);
  }
  return off;
}

/** Offset at a whole second `t` (formatToParts has second resolution). */
function offsetAt(t: number, timeZone: string): number {
  const p: Record<string, number> = {};
  for (const { type, value } of zoneFormatter(timeZone).formatToParts(t)) p[type] = +value;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
}

/** Throws a RangeError for a name the runtime does not know. */
function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Whether the runtime knows `timeZone` as an IANA zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    zoneFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}
