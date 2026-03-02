/**
 * TimeGuard — Trading Session Time Management
 *
 * Enforces trading windows, force-close timing, and blackout periods
 * for day trading automation.
 *
 * @example
 * ```ts
 * const guard = createTimeGuard({
 *   tradingWindows: [
 *     { startMs: 9 * 3600_000, endMs: 11.5 * 3600_000 },
 *     { startMs: 12.5 * 3600_000, endMs: 15 * 3600_000 },
 *   ],
 *   timezoneOffsetMs: 9 * 3600_000, // JST
 *   forceCloseBeforeEndMs: 5 * 60_000,
 * });
 *
 * const result = guard.check(Date.now());
 * if (!result.allowed) console.log('Outside trading hours:', result.reason);
 * if (result.shouldForceClose) closeAllPositions();
 * ```
 */

import type {
  TimeGuardOptions,
  TimeGuardState,
  TimeGuardCheckResult,
  TimeGuard,
  BlackoutPeriod,
  TradingWindow,
} from "./types";

const MS_PER_DAY = 86_400_000;

/**
 * Get the local time-of-day offset in ms from midnight for a given timestamp.
 */
function getLocalTimeOfDay(time: number, timezoneOffsetMs: number): number {
  return ((time + timezoneOffsetMs) % MS_PER_DAY + MS_PER_DAY) % MS_PER_DAY;
}

/**
 * Check if a local time-of-day falls within a trading window.
 * Supports overnight windows where startMs > endMs (e.g., 22:00 - 06:00).
 */
function isInWindow(localTimeMs: number, window: TradingWindow): boolean {
  if (window.startMs <= window.endMs) {
    // Normal window (e.g., 9:00 - 15:00)
    return localTimeMs >= window.startMs && localTimeMs < window.endMs;
  }
  // Overnight window (e.g., 22:00 - 06:00)
  return localTimeMs >= window.startMs || localTimeMs < window.endMs;
}

/**
 * Calculate the time remaining until the current window ends.
 * Returns the remaining ms, or -1 if not in any window.
 */
function getTimeUntilWindowEnd(
  localTimeMs: number,
  window: TradingWindow,
): number {
  if (!isInWindow(localTimeMs, window)) return -1;

  if (window.startMs <= window.endMs) {
    return window.endMs - localTimeMs;
  }
  // Overnight: if we're past start, end is tomorrow
  if (localTimeMs >= window.startMs) {
    return MS_PER_DAY - localTimeMs + window.endMs;
  }
  // Before end (early morning part of overnight window)
  return window.endMs - localTimeMs;
}

/**
 * Create a TimeGuard instance for trading session time management.
 *
 * @param options - Time guard configuration
 * @param fromState - Optional saved state to restore from
 * @returns A TimeGuard instance
 *
 * @example
 * ```ts
 * const guard = createTimeGuard({
 *   tradingWindows: [
 *     { startMs: 9 * 3600_000, endMs: 11.5 * 3600_000 },
 *   ],
 *   timezoneOffsetMs: 9 * 3600_000,
 *   forceCloseBeforeEndMs: 5 * 60_000,
 * });
 *
 * // Add blackout for economic announcement
 * guard.addBlackout({
 *   startTime: Date.parse('2024-01-15T19:00:00Z'),
 *   endTime: Date.parse('2024-01-15T19:30:00Z'),
 *   reason: 'FOMC announcement',
 * });
 * ```
 */
export function createTimeGuard(
  options: TimeGuardOptions,
  fromState?: TimeGuardState,
): TimeGuard {
  const timezoneOffsetMs = options.timezoneOffsetMs ?? 0;
  const forceCloseBeforeEndMs = options.forceCloseBeforeEndMs ?? 0;
  const blackoutPeriods: BlackoutPeriod[] = fromState?.blackoutPeriods
    ? [...fromState.blackoutPeriods]
    : options.blackoutPeriods
      ? [...options.blackoutPeriods]
      : [];

  return {
    check(time: number): TimeGuardCheckResult {
      // 1. Check blackout periods
      for (const blackout of blackoutPeriods) {
        if (time >= blackout.startTime && time < blackout.endTime) {
          return {
            allowed: false,
            shouldForceClose: true,
            reason: blackout.reason
              ? `Blackout: ${blackout.reason}`
              : "Blackout period active",
          };
        }
      }

      // 2. Calculate local time-of-day
      const localTimeMs = getLocalTimeOfDay(time, timezoneOffsetMs);

      // 3. Check trading windows
      let inAnyWindow = false;
      let shouldForceClose = false;

      for (const window of options.tradingWindows) {
        if (isInWindow(localTimeMs, window)) {
          inAnyWindow = true;

          // 4. Check force-close zone
          if (forceCloseBeforeEndMs > 0) {
            const remaining = getTimeUntilWindowEnd(localTimeMs, window);
            if (remaining >= 0 && remaining <= forceCloseBeforeEndMs) {
              shouldForceClose = true;
            }
          }
          break;
        }
      }

      if (!inAnyWindow) {
        return {
          allowed: false,
          shouldForceClose: false,
          reason: "Outside trading window",
        };
      }

      if (shouldForceClose) {
        return {
          allowed: false,
          shouldForceClose: true,
          reason: "Force-close zone: trading window ending soon",
        };
      }

      return { allowed: true, shouldForceClose: false };
    },

    addBlackout(period: BlackoutPeriod) {
      blackoutPeriods.push(period);
    },

    getState(): TimeGuardState {
      return {
        blackoutPeriods: [...blackoutPeriods],
      };
    },
  };
}
