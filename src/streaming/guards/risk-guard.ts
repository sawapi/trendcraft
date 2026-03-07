/**
 * RiskGuard — Circuit Breaker for Day Trading
 *
 * Enforces daily loss limits, trade count limits, and consecutive loss
 * cooldowns to protect against runaway losses in automated trading.
 *
 * @example
 * ```ts
 * const guard = createRiskGuard({
 *   maxDailyLoss: -50000,
 *   maxDailyTrades: 20,
 *   maxConsecutiveLosses: 3,
 *   cooldownMs: 30 * 60_000,
 * });
 *
 * const { allowed, reason } = guard.check(Date.now());
 * if (!allowed) console.log('Blocked:', reason);
 *
 * // After closing a trade:
 * guard.reportTrade(-200, Date.now());
 * ```
 */

import type { RiskGuard, RiskGuardOptions, RiskGuardState } from "./types";

const MS_PER_DAY = 86_400_000;

/**
 * Compute the day number for a given timestamp, adjusted by resetTimeOffsetMs.
 * This ensures the day boundary aligns with the trading session reset time.
 */
function getDayNumber(time: number, resetTimeOffsetMs: number): number {
  return Math.floor((time - resetTimeOffsetMs) / MS_PER_DAY);
}

/**
 * Create a RiskGuard instance (circuit breaker).
 *
 * @param options - Risk guard configuration
 * @param fromState - Optional saved state to restore from
 * @returns A RiskGuard instance
 *
 * @example
 * ```ts
 * const guard = createRiskGuard({
 *   maxDailyLoss: -5000,
 *   maxDailyTrades: 10,
 *   maxConsecutiveLosses: 3,
 *   cooldownMs: 30 * 60_000,
 *   resetTimeOffsetMs: 0,
 * });
 *
 * // Check before entering a trade
 * const result = guard.check(Date.now());
 * if (result.allowed) {
 *   // Place order...
 * }
 *
 * // Report trade result
 * guard.reportTrade(-200, Date.now());
 *
 * // Persist state
 * const state = guard.getState();
 * const restored = createRiskGuard(options, state);
 * ```
 */
export function createRiskGuard(options: RiskGuardOptions, fromState?: RiskGuardState): RiskGuard {
  const resetTimeOffsetMs = options.resetTimeOffsetMs ?? 0;

  let dailyPnl = fromState?.dailyPnl ?? 0;
  let dailyTradeCount = fromState?.dailyTradeCount ?? 0;
  let consecutiveLosses = fromState?.consecutiveLosses ?? 0;
  let lastResetDay = fromState?.lastResetDay ?? -1;
  let cooldownUntil = fromState?.cooldownUntil ?? 0;
  let peakEquity = fromState?.peakEquity ?? 0;
  let currentEquity = fromState?.currentEquity ?? 0;

  function maybeResetDay(time: number): void {
    const currentDay = getDayNumber(time, resetTimeOffsetMs);
    if (currentDay !== lastResetDay) {
      dailyPnl = 0;
      dailyTradeCount = 0;
      consecutiveLosses = 0;
      cooldownUntil = 0;
      lastResetDay = currentDay;
    }
  }

  return {
    check(time: number) {
      // Auto-reset on day boundary
      maybeResetDay(time);

      // Check cooldown
      if (cooldownUntil > 0) {
        if (time < cooldownUntil) {
          return {
            allowed: false,
            reason: `Cooldown active until ${new Date(cooldownUntil).toISOString()}`,
          };
        }
        // Cooldown expired — reset consecutive losses and cooldown
        consecutiveLosses = 0;
        cooldownUntil = 0;
      }

      // Check max drawdown from peak equity
      if (options.maxDrawdownPercent !== undefined && peakEquity > 0 && currentEquity > 0) {
        const drawdownPercent = ((peakEquity - currentEquity) / peakEquity) * 100;
        if (drawdownPercent >= options.maxDrawdownPercent) {
          return {
            allowed: false,
            reason: `Max drawdown reached: ${drawdownPercent.toFixed(1)}% >= ${options.maxDrawdownPercent}%`,
          };
        }
      }

      // Check daily loss limit
      if (options.maxDailyLoss !== undefined && dailyPnl <= options.maxDailyLoss) {
        return {
          allowed: false,
          reason: `Daily loss limit reached: ${dailyPnl} <= ${options.maxDailyLoss}`,
        };
      }

      // Check daily trade count
      if (options.maxDailyTrades !== undefined && dailyTradeCount >= options.maxDailyTrades) {
        return {
          allowed: false,
          reason: `Daily trade limit reached: ${dailyTradeCount} >= ${options.maxDailyTrades}`,
        };
      }

      // Check consecutive losses
      if (
        options.maxConsecutiveLosses !== undefined &&
        consecutiveLosses >= options.maxConsecutiveLosses
      ) {
        // Activate cooldown if configured and not already active
        if (options.cooldownMs !== undefined && cooldownUntil === 0) {
          cooldownUntil = time + options.cooldownMs;
          return {
            allowed: false,
            reason: `${consecutiveLosses} consecutive losses, cooldown until ${new Date(cooldownUntil).toISOString()}`,
          };
        }
        return {
          allowed: false,
          reason: `Consecutive loss limit reached: ${consecutiveLosses} >= ${options.maxConsecutiveLosses}`,
        };
      }

      return { allowed: true };
    },

    reportTrade(pnl: number, time: number) {
      maybeResetDay(time);
      dailyPnl += pnl;
      dailyTradeCount++;
      if (pnl < 0) {
        consecutiveLosses++;
      } else {
        consecutiveLosses = 0;
        // Reset cooldown on a winning trade
        cooldownUntil = 0;
      }
    },

    updateEquity(equity: number, _time: number) {
      currentEquity = equity;
      if (equity > peakEquity) {
        peakEquity = equity;
      }
    },

    checkPositionSize(positionValue: number) {
      if (options.maxPositionPercent !== undefined && currentEquity > 0) {
        const positionPercent = (Math.abs(positionValue) / currentEquity) * 100;
        if (positionPercent > options.maxPositionPercent) {
          return {
            allowed: false,
            reason: `Position size ${positionPercent.toFixed(1)}% exceeds limit ${options.maxPositionPercent}%`,
          };
        }
      }
      return { allowed: true };
    },

    reset() {
      dailyPnl = 0;
      dailyTradeCount = 0;
      consecutiveLosses = 0;
      cooldownUntil = 0;
      lastResetDay = -1;
      peakEquity = 0;
      currentEquity = 0;
    },

    getState(): RiskGuardState {
      return {
        dailyPnl,
        dailyTradeCount,
        consecutiveLosses,
        lastResetDay,
        cooldownUntil,
        peakEquity,
        currentEquity,
      };
    },
  };
}
