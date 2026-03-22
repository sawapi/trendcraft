/**
 * PortfolioGuard — Cross-Symbol Risk Management
 *
 * Manages portfolio-level risk across multiple symbols, enforcing
 * total exposure limits, per-symbol exposure limits, max open positions,
 * and portfolio-wide drawdown protection.
 *
 * @example
 * ```ts
 * import { createPortfolioGuard } from "trendcraft";
 *
 * const guard = createPortfolioGuard({
 *   maxTotalExposure: 200,    // max 2x leverage
 *   maxSymbolExposure: 25,    // max 25% per symbol
 *   maxOpenPositions: 10,
 *   maxPortfolioDrawdown: 15, // halt at 15% drawdown
 * });
 *
 * guard.updateEquity(100_000);
 * if (guard.canOpenPosition("AAPL", 20_000)) {
 *   guard.reportPositionOpen("AAPL", 20_000);
 * }
 * guard.reportPositionClose("AAPL", 20_000, 500);
 * ```
 */

import type {
  PortfolioGuard,
  PortfolioGuardCheckResult,
  PortfolioGuardOptions,
  PortfolioGuardState,
} from "./types";

/**
 * Create a PortfolioGuard instance for cross-symbol risk management.
 *
 * @param options - Portfolio guard configuration
 * @param fromState - Optional saved state to restore from
 * @returns A PortfolioGuard instance
 *
 * @example
 * ```ts
 * const guard = createPortfolioGuard({
 *   maxTotalExposure: 200,
 *   maxSymbolExposure: 25,
 *   maxOpenPositions: 10,
 *   maxPortfolioDrawdown: 15,
 * });
 *
 * // Check before opening a position
 * const { allowed, reason } = guard.canOpenPosition("AAPL", 25_000);
 * if (allowed) {
 *   guard.reportPositionOpen("AAPL", 25_000);
 * }
 *
 * // After closing
 * guard.reportPositionClose("AAPL", 25_000, 1200);
 *
 * // Persist state
 * const state = guard.getState();
 * const restored = createPortfolioGuard(options, state);
 * ```
 */
export function createPortfolioGuard(
  options: PortfolioGuardOptions,
  fromState?: PortfolioGuardState,
): PortfolioGuard {
  // Symbol -> total notional exposure
  const symbolExposure = new Map<string, number>(
    fromState?.symbolExposure ? Object.entries(fromState.symbolExposure) : [],
  );
  let totalEquity = fromState?.totalEquity ?? 0;
  let peakEquity = fromState?.peakEquity ?? 0;
  let openPositionCount = fromState?.openPositionCount ?? 0;

  function getTotalExposure(): number {
    let total = 0;
    for (const notional of symbolExposure.values()) {
      total += notional;
    }
    return total;
  }

  function getExposurePercent(notional: number): number {
    if (totalEquity <= 0) return 0;
    return (notional / totalEquity) * 100;
  }

  return {
    canOpenPosition(symbol: string, notional: number): PortfolioGuardCheckResult {
      // Check max open positions
      if (options.maxOpenPositions !== undefined && openPositionCount >= options.maxOpenPositions) {
        return {
          allowed: false,
          reason: `Max open positions reached: ${openPositionCount} >= ${options.maxOpenPositions}`,
        };
      }

      // Check portfolio drawdown
      if (options.maxPortfolioDrawdown !== undefined && peakEquity > 0 && totalEquity > 0) {
        const drawdownPercent = ((peakEquity - totalEquity) / peakEquity) * 100;
        if (drawdownPercent >= options.maxPortfolioDrawdown) {
          return {
            allowed: false,
            reason: `Portfolio drawdown ${drawdownPercent.toFixed(1)}% >= limit ${options.maxPortfolioDrawdown}%`,
          };
        }
      }

      if (totalEquity <= 0) {
        return { allowed: true };
      }

      // Check total exposure
      if (options.maxTotalExposure !== undefined) {
        const currentExposure = getTotalExposure();
        const newTotalExposurePercent = getExposurePercent(currentExposure + notional);
        if (newTotalExposurePercent > options.maxTotalExposure) {
          return {
            allowed: false,
            reason: `Total exposure ${newTotalExposurePercent.toFixed(1)}% would exceed limit ${options.maxTotalExposure}%`,
          };
        }
      }

      // Check per-symbol exposure
      if (options.maxSymbolExposure !== undefined) {
        const currentSymbolExposure = symbolExposure.get(symbol) ?? 0;
        const newSymbolExposurePercent = getExposurePercent(currentSymbolExposure + notional);
        if (newSymbolExposurePercent > options.maxSymbolExposure) {
          return {
            allowed: false,
            reason: `Symbol ${symbol} exposure ${newSymbolExposurePercent.toFixed(1)}% would exceed limit ${options.maxSymbolExposure}%`,
          };
        }
      }

      // Check correlated exposure
      if (options.maxCorrelatedExposure !== undefined && options.correlationGroups) {
        for (const group of options.correlationGroups) {
          if (!group.includes(symbol)) continue;
          let groupExposure = 0;
          for (const s of group) {
            groupExposure += symbolExposure.get(s) ?? 0;
          }
          const newGroupExposurePercent = getExposurePercent(groupExposure + notional);
          if (newGroupExposurePercent > options.maxCorrelatedExposure) {
            return {
              allowed: false,
              reason: `Correlated group exposure ${newGroupExposurePercent.toFixed(1)}% would exceed limit ${options.maxCorrelatedExposure}%`,
            };
          }
        }
      }

      return { allowed: true };
    },

    reportPositionOpen(symbol: string, notional: number): void {
      const current = symbolExposure.get(symbol) ?? 0;
      symbolExposure.set(symbol, current + notional);
      openPositionCount++;
    },

    reportPositionClose(symbol: string, notional: number, pnl: number): void {
      const current = symbolExposure.get(symbol) ?? 0;
      const updated = current - notional;
      if (updated <= 0) {
        symbolExposure.delete(symbol);
      } else {
        symbolExposure.set(symbol, updated);
      }
      openPositionCount = Math.max(0, openPositionCount - 1);
      totalEquity += pnl;
      if (totalEquity > peakEquity) {
        peakEquity = totalEquity;
      }
    },

    updateEquity(equity: number): void {
      totalEquity = equity;
      if (equity > peakEquity) {
        peakEquity = equity;
      }
    },

    getExposure() {
      const bySymbol: Record<string, number> = {};
      for (const [symbol, notional] of symbolExposure) {
        bySymbol[symbol] = totalEquity > 0 ? (notional / totalEquity) * 100 : 0;
      }
      return {
        totalPercent: totalEquity > 0 ? getExposurePercent(getTotalExposure()) : 0,
        bySymbol,
        openPositions: openPositionCount,
      };
    },

    reset(): void {
      symbolExposure.clear();
      openPositionCount = 0;
      totalEquity = 0;
      peakEquity = 0;
    },

    getState(): PortfolioGuardState {
      const exposure: Record<string, number> = {};
      for (const [symbol, notional] of symbolExposure) {
        exposure[symbol] = notional;
      }
      return {
        symbolExposure: exposure,
        totalEquity,
        peakEquity,
        openPositionCount,
      };
    },
  };
}
