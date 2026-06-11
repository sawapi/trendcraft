/**
 * Backtest position sizing
 *
 * Maps a BacktestSizingConfig to a share count for a single entry, reusing
 * the standalone position-sizing functions so backtest and streaming
 * (managed-session) sizing stay numerically identical.
 */

import { atrBasedSize } from "../position-sizing/atr-based";
import { fixedFractionalSize } from "../position-sizing/fixed-fractional";
import { kellySize } from "../position-sizing/kelly";
import { riskBasedSize } from "../position-sizing/risk-based";
import type { BacktestSizingConfig, BacktestSizingContext } from "../types";

/**
 * Calculate the number of shares for an entry under the given sizing config.
 *
 * Returns 0 to skip the entry (ATR not warmed up, zero/negative Kelly edge,
 * custom callback declined, or non-positive equity). The caller clamps the
 * result to available buying power.
 *
 * @param config - Sizing configuration from BacktestOptions
 * @param ctx - Entry context (equity, price, ATR, closed trades, ...)
 * @param stopDistance - Absolute stop distance implied by the engine's stop
 *   configuration (stopLoss percent or ATR stop), or null when no stop is set.
 *   Only used by the "risk-based" method.
 */
export function calculateSizedShares(
  config: BacktestSizingConfig,
  ctx: BacktestSizingContext,
  stopDistance: number | null,
): number {
  if (ctx.equity <= 0 || ctx.entryPrice <= 0) return 0;

  switch (config.method) {
    case "full-capital":
      return ctx.proposedShares;

    case "fixed-fractional":
      return fixedFractionalSize({
        accountSize: ctx.equity,
        entryPrice: ctx.entryPrice,
        fractionPercent: config.fractionPercent,
        roundShares: false,
      }).shares;

    case "risk-based": {
      if (stopDistance === null || stopDistance <= 0 || stopDistance >= ctx.entryPrice) {
        // No usable stop configured — risk per trade is unbounded, so fall
        // back to a full-capital entry (same fallback as the streaming
        // position manager).
        return ctx.proposedShares;
      }
      const stopLossPrice =
        ctx.direction === "short" ? ctx.entryPrice + stopDistance : ctx.entryPrice - stopDistance;
      return riskBasedSize({
        accountSize: ctx.equity,
        entryPrice: ctx.entryPrice,
        riskPercent: config.riskPercent,
        stopLossPrice,
        direction: ctx.direction,
        roundShares: false,
        // The engine clamps the result to buying power (cash, or leveraged
        // when margin is configured); the helper's default 100%-of-equity
        // cap would silently disable leverage for tight stops.
        maxPositionPercent: Number.POSITIVE_INFINITY,
      }).shares;
    }

    case "atr-based": {
      // ATR not warmed up yet — skip the entry (streaming parity)
      if (ctx.atr === null || ctx.atr <= 0) return 0;
      return atrBasedSize({
        accountSize: ctx.equity,
        entryPrice: ctx.entryPrice,
        riskPercent: config.riskPercent,
        atrValue: ctx.atr,
        atrMultiplier: config.atrMultiplier ?? 2,
        direction: ctx.direction,
        roundShares: false,
        // See risk-based above: buying-power clamping is owned by the engine
        maxPositionPercent: Number.POSITIVE_INFINITY,
      }).shares;
    }

    case "kelly":
      // kellySize returns 0 shares when the Kelly fraction is <= 0 (no edge)
      return kellySize({
        accountSize: ctx.equity,
        entryPrice: ctx.entryPrice,
        winRate: config.winRate,
        winLossRatio: config.winLossRatio,
        kellyFraction: config.kellyFraction,
        maxKellyPercent: config.maxKellyPercent,
        roundShares: false,
      }).shares;

    case "custom": {
      const shares = config.calculate(ctx);
      return Number.isFinite(shares) && shares > 0 ? shares : 0;
    }
  }
}
