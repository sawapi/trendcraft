/**
 * Timezone utilities for session detection.
 *
 * Uses the runtime's built-in `Intl.DateTimeFormat` (zero external deps)
 * to convert a UTC epoch ms into local date/time for any IANA timezone.
 * DST is handled automatically by the runtime's tzdata.
 */

/**
 * Local calendar date and clock time in some timezone.
 *
 * `month` is 1-based, matching how a date is written rather than
 * `Date.getMonth()`.
 */
export type TzDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/**
 * Returns the local date and time for the given UTC epoch milliseconds in the
 * specified IANA timezone (e.g. "America/New_York", "Asia/Tokyo").
 *
 * - For "UTC" (or empty / undefined input), uses the native getUTC* accessors
 *   to avoid the Intl.DateTimeFormat allocation cost.
 * - For other zones, uses Intl.DateTimeFormat.formatToParts with DST applied
 *   automatically.
 *
 * The calendar date matters as much as the clock time: on a DST fall-back day
 * the local clock repeats an hour, so the time alone cannot tell one part of a
 * session from another, while the date it belongs to still can.
 *
 * @param epochMs - Time in UTC epoch milliseconds
 * @param timezone - IANA timezone identifier (default "UTC")
 *
 * @example
 * ```ts
 * // 2026-03-01 14:00 UTC = 09:00 New York EST (winter)
 * getTzDateTime(Date.UTC(2026, 2, 1, 14, 0), "America/New_York");
 * // => { year: 2026, month: 3, day: 1, hour: 9, minute: 0 }
 * ```
 */
export function getTzDateTime(epochMs: number, timezone = "UTC"): TzDateTime {
  if (!timezone || timezone === "UTC") {
    const d = new Date(epochMs);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    };
  }

  const fmt = getCachedFormatter(timezone);
  const parts = fmt.formatToParts(epochMs);
  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = Number(p.value);
    else if (p.type === "minute") minute = Number(p.value);
    else if (p.type === "year") year = Number(p.value);
    else if (p.type === "month") month = Number(p.value);
    else if (p.type === "day") day = Number(p.value);
  }
  // Some locales render midnight as "24" — normalize to 0.
  if (hour === 24) hour = 0;
  return { year, month, day, hour, minute };
}

/**
 * Returns the local { hour, minute } for the given UTC epoch milliseconds
 * in the specified IANA timezone (e.g. "America/New_York", "Asia/Tokyo").
 *
 * @param epochMs - Time in UTC epoch milliseconds
 * @param timezone - IANA timezone identifier (default "UTC")
 *
 * @example
 * ```ts
 * // 2026-03-01 14:00 UTC = 09:00 New York EST (winter)
 * getTzHourMinute(Date.UTC(2026, 2, 1, 14, 0), "America/New_York");
 * // => { hour: 9, minute: 0 }
 *
 * // 2026-03-15 14:00 UTC = 10:00 New York EDT (after DST)
 * getTzHourMinute(Date.UTC(2026, 2, 15, 14, 0), "America/New_York");
 * // => { hour: 10, minute: 0 }
 * ```
 */
export function getTzHourMinute(
  epochMs: number,
  timezone = "UTC",
): { hour: number; minute: number } {
  const { hour, minute } = getTzDateTime(epochMs, timezone);
  return { hour, minute };
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getCachedFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formatterCache.set(timezone, fmt);
  }
  return fmt;
}
