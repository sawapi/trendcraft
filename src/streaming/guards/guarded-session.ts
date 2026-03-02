/**
 * GuardedSession — TradingSession with Risk and Time Guards
 *
 * Wraps a standard TradingSession with RiskGuard (circuit breaker) and
 * TimeGuard (session time management). Entry signals are checked against
 * guards before being emitted, and force-close events are injected when
 * trading windows are about to end.
 *
 * @example
 * ```ts
 * const session = createGuardedSession(
 *   {
 *     intervalMs: 60_000,
 *     pipeline: {
 *       indicators: [
 *         { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *       ],
 *       entry: rsiBelow(30),
 *       exit: rsiAbove(70),
 *     },
 *   },
 *   {
 *     riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 20 },
 *     timeGuard: {
 *       tradingWindows: [{ startMs: 9 * 3600_000, endMs: 15 * 3600_000 }],
 *       timezoneOffsetMs: 9 * 3600_000,
 *       forceCloseBeforeEndMs: 5 * 60_000,
 *     },
 *   },
 * );
 *
 * const events = session.onTrade({ time: Date.now(), price: 100, volume: 10 });
 * for (const e of events) {
 *   if (e.type === 'blocked') console.log('Blocked:', e.reason);
 *   if (e.type === 'force-close') closeAllPositions();
 * }
 *
 * // Report trade results for risk tracking
 * session.riskGuard?.reportTrade(-200, Date.now());
 * ```
 */

import type { SessionEvent, SessionOptions, Trade } from "../types";
import type {
  GuardedSessionOptions,
  GuardedSessionState,
  GuardedTradingSession,
  RiskGuard,
  TimeGuard,
} from "./types";
import { createTradingSession } from "../session";
import { createRiskGuard } from "./risk-guard";
import { createTimeGuard } from "./time-guard";

/**
 * Create a guarded trading session with risk and time management.
 *
 * @param sessionOptions - Standard session configuration
 * @param guardOptions - Guard configuration (risk and/or time)
 * @param fromState - Optional saved state to restore from
 * @returns A GuardedTradingSession instance
 *
 * @example
 * ```ts
 * const session = createGuardedSession(
 *   {
 *     intervalMs: 60_000,
 *     pipeline: {
 *       indicators: [
 *         { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *       ],
 *       entry: rsiBelow(30),
 *       exit: rsiAbove(70),
 *     },
 *   },
 *   {
 *     riskGuard: { maxDailyLoss: -50000 },
 *     timeGuard: {
 *       tradingWindows: [{ startMs: 9 * 3600_000, endMs: 15 * 3600_000 }],
 *       timezoneOffsetMs: 9 * 3600_000,
 *     },
 *   },
 * );
 * ```
 */
export function createGuardedSession(
  sessionOptions: SessionOptions,
  guardOptions: GuardedSessionOptions,
  fromState?: GuardedSessionState,
): GuardedTradingSession {
  const inner = createTradingSession(
    sessionOptions,
    fromState?.sessionState,
  );

  const riskGuard: RiskGuard | null = guardOptions.riskGuard
    ? createRiskGuard(guardOptions.riskGuard, fromState?.riskGuardState)
    : null;

  const timeGuard: TimeGuard | null = guardOptions.timeGuard
    ? createTimeGuard(guardOptions.timeGuard, fromState?.timeGuardState)
    : null;

  /**
   * Filter and transform events from the inner session:
   * - Block entry events when guards deny trading
   * - Inject force-close events when time guard signals
   * - Pass through all other events unchanged
   */
  function applyGuards(
    events: SessionEvent[],
    trade: Trade,
  ): SessionEvent[] {
    const result: SessionEvent[] = [];
    let forceCloseEmitted = false;

    // Check time guard for force-close (once per onTrade call)
    if (timeGuard) {
      const timeCheck = timeGuard.check(trade.time);
      if (timeCheck.shouldForceClose && !forceCloseEmitted) {
        // Find the candle from events, or use the first candle-bearing event
        const candleEvent = events.find(
          (e) => e.type === "candle" || e.type === "entry" || e.type === "exit" || e.type === "partial",
        );
        if (candleEvent) {
          const candle = candleEvent.candle;
          const snapshot = "snapshot" in candleEvent ? candleEvent.snapshot : {};
          result.push({
            type: "force-close",
            reason: timeCheck.reason ?? "Trading window ending soon",
            candle,
            snapshot,
          });
          forceCloseEmitted = true;
        }
      }
    }

    for (const event of events) {
      if (event.type === "entry") {
        // Check time guard
        if (timeGuard) {
          const timeCheck = timeGuard.check(trade.time);
          if (!timeCheck.allowed) {
            result.push({
              type: "blocked",
              reason: timeCheck.reason ?? "Outside trading window",
              candle: event.candle,
            });
            continue;
          }
        }

        // Check risk guard
        if (riskGuard) {
          const riskCheck = riskGuard.check(trade.time);
          if (!riskCheck.allowed) {
            result.push({
              type: "blocked",
              reason: riskCheck.reason ?? "Risk limit reached",
              candle: event.candle,
            });
            continue;
          }
        }

        // Entry allowed
        result.push(event);
      } else {
        // Non-entry events pass through
        result.push(event);
      }
    }

    return result;
  }

  return {
    onTrade(trade: Trade): SessionEvent[] {
      const events = inner.onTrade(trade);
      return applyGuards(events, trade);
    },

    close(): SessionEvent[] {
      return inner.close();
    },

    riskGuard,
    timeGuard,

    getState(): GuardedSessionState {
      return {
        sessionState: inner.getState(),
        riskGuardState: riskGuard?.getState(),
        timeGuardState: timeGuard?.getState(),
      };
    },
  };
}
