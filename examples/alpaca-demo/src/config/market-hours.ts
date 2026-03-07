/**
 * US stock market hours for TimeGuard configuration
 *
 * Regular session: 9:30 - 16:00 ET
 * EST = UTC-5, EDT = UTC-4 (auto-detect based on current date)
 */

const HOUR = 3_600_000;
const MINUTE = 60_000;

/**
 * Get the current US Eastern timezone offset in milliseconds.
 * Handles EST (-5h) / EDT (-4h) automatically.
 */
export function getEasternOffsetMs(): number {
  // Use a date in the current period to detect DST
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDst = now.getTimezoneOffset() < stdOffset;

  // ET offset: EST = -5h, EDT = -4h
  return isDst ? -4 * HOUR : -5 * HOUR;
}

/**
 * US regular market hours TimeGuard config
 *
 * - Trading window: 9:30 - 16:00 ET
 * - Force-close 5 minutes before market close (15:55)
 * - No overnight positions
 */
export const US_MARKET_HOURS = {
  tradingWindows: [
    {
      startMs: 9 * HOUR + 30 * MINUTE, // 9:30
      endMs: 16 * HOUR,                // 16:00
    },
  ],
  timezoneOffsetMs: getEasternOffsetMs(),
  forceCloseBeforeEndMs: 5 * MINUTE,
};
