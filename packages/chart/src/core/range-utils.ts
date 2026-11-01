/**
 * Range utilities — Duration-to-timestamp resolution for viewport control.
 */

import { fromWallClock, wallClock } from "./time-zone";
import type { RangeDuration } from "./types";

/**
 * Resolve a RangeDuration to a start timestamp (epoch ms), given the last candle time.
 * Returns null for "ALL" (caller should use fitContent). "YTD" starts at
 * January 1 in `timeZone` (UTC when omitted), the chart's `timeZone` option.
 */
export function resolveRangeDuration(
  duration: RangeDuration,
  lastTime: number,
  timeZone?: string,
): number | null {
  switch (duration) {
    case "ALL":
      return null;
    case "1D":
      return lastTime - 86_400_000;
    case "1W":
      return lastTime - 7 * 86_400_000;
    case "1M":
      return lastTime - 30 * 86_400_000;
    case "3M":
      return lastTime - 90 * 86_400_000;
    case "6M":
      return lastTime - 180 * 86_400_000;
    case "1Y":
      return lastTime - 365 * 86_400_000;
    case "YTD": {
      const year = wallClock(lastTime, timeZone).getUTCFullYear();
      return fromWallClock(Date.UTC(year, 0, 1), timeZone);
    }
  }
}
