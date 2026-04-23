/**
 * Timezone utilities for session detection.
 *
 * Uses the runtime's built-in `Intl.DateTimeFormat` (zero external deps)
 * to convert a UTC epoch ms into local hour/minute for any IANA timezone.
 * DST is handled automatically by the runtime's tzdata.
 */

/**
 * Returns the local { hour, minute } for the given UTC epoch milliseconds
 * in the specified IANA timezone (e.g. "America/New_York", "Asia/Tokyo").
 *
 * - For "UTC" (or empty / undefined input), uses native getUTCHours/Minutes
 *   to avoid the Intl.DateTimeFormat allocation cost.
 * - For other zones, uses Intl.DateTimeFormat.formatToParts to extract
 *   the hour and minute fields with DST applied automatically.
 *
 * @param epochMs - Time in UTC epoch milliseconds
 * @param timezone - IANA timezone identifier (default "UTC")
 *
 * @example
 * ```ts
 * // 2026-03-08 14:00 UTC = 09:00 New York EST (winter)
 * getTzHourMinute(Date.UTC(2026, 2, 8, 14, 0), "America/New_York");
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
  if (!timezone || timezone === "UTC") {
    const d = new Date(epochMs);
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }

  const fmt = getCachedFormatter(timezone);
  const parts = fmt.formatToParts(epochMs);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = Number(p.value);
    else if (p.type === "minute") minute = Number(p.value);
  }
  // Some locales render midnight as "24" — normalize to 0.
  if (hour === 24) hour = 0;
  return { hour, minute };
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getCachedFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formatterCache.set(timezone, fmt);
  }
  return fmt;
}
