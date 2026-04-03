/**
 * Range utilities — Duration-to-timestamp resolution for viewport control.
 */

import type { RangeDuration } from "./types";

/**
 * Resolve a RangeDuration to a start timestamp (epoch ms), given the last candle time.
 * Returns null for "ALL" (caller should use fitContent).
 */
export function resolveRangeDuration(duration: RangeDuration, lastTime: number): number | null {
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
      const d = new Date(lastTime);
      return Date.UTC(d.getUTCFullYear(), 0, 1);
    }
  }
}
