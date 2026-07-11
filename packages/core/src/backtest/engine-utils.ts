/**
 * Backtest Engine Utilities
 * Helper functions and types for the backtest engine
 */

import type {
  BacktestResult,
  BacktestSettings,
  DrawdownPeriod,
  ExitReason,
  NormalizedCandle,
  PositionDirection,
  SlTpMode,
  Trade,
  VolumeConstraint,
} from "../types";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Position state for tracking open trades
 */
export type Position = {
  entryTime: number;
  entryPrice: number;
  peakPrice: number;
  /** Trough price since entry (for short trailing stop) */
  troughPrice: number;
  /** Position direction (default: "long") */
  direction: PositionDirection;
  shares: number;
  originalShares: number;
  partialTaken: boolean;
  breakevenActivated: boolean;
  scaleOutLevelsTaken: boolean[];
  entryAtr: number | null;
  maxProfitPercent: number;
  maxLossPercent: number;
};

/**
 * Trade close context for calculating returns
 */
export type TradeCloseContext = {
  position: Position;
  exitTime: number;
  exitPrice: number;
  exitReason: ExitReason;
  sharesToClose: number;
  /** Set for partial/scale-out exits: true if partial, false if final scale-out */
  isPartial?: boolean;
  exitPercent?: number;
  commission: number;
  commissionRate: number;
  taxRate: number;
  slippage: number;
};

/**
 * Result of closing a trade
 */
export type TradeCloseResult = {
  trade: Trade;
  netProceeds: number;
  returnPercent: number;
};

/**
 * Calculate trade result when closing a position (full or partial)
 */
export function calculateTradeClose(ctx: TradeCloseContext): TradeCloseResult {
  const direction = ctx.position.direction ?? "long";
  const exitSide = direction === "long" ? "sell" : "buy";
  const exitPriceWithSlippage = applySlippage(ctx.exitPrice, ctx.slippage, exitSide);
  const priceDiff =
    direction === "long"
      ? exitPriceWithSlippage - ctx.position.entryPrice
      : ctx.position.entryPrice - exitPriceWithSlippage;
  const grossReturn = priceDiff * ctx.sharesToClose;
  const exitValue = exitPriceWithSlippage * ctx.sharesToClose;
  const exitCommission = ctx.commission + exitValue * (ctx.commissionRate / 100);

  let tax = 0;
  if (grossReturn > 0 && ctx.taxRate > 0) {
    tax = grossReturn * (ctx.taxRate / 100);
  }

  const netReturn = grossReturn - exitCommission - tax;
  const returnPercent = (netReturn / (ctx.position.entryPrice * ctx.sharesToClose)) * 100;
  const holdingDays = Math.round((ctx.exitTime - ctx.position.entryTime) / MS_PER_DAY);
  const mfeUtilization = calculateMfeUtilization(returnPercent, ctx.position.maxProfitPercent);

  const trade: Trade = {
    entryTime: ctx.position.entryTime,
    entryPrice: ctx.position.entryPrice,
    exitTime: ctx.exitTime,
    exitPrice: exitPriceWithSlippage,
    return: netReturn,
    returnPercent,
    holdingDays,
    direction: direction === "short" ? "short" : undefined,
    exitReason: ctx.exitReason,
    mfe: Math.round(ctx.position.maxProfitPercent * 100) / 100,
    mae: Math.round(ctx.position.maxLossPercent * 100) / 100,
    mfeUtilization: mfeUtilization !== null ? Math.round(mfeUtilization * 100) / 100 : undefined,
  };

  if (ctx.isPartial !== undefined) {
    trade.isPartial = ctx.isPartial;
    if (ctx.exitPercent !== undefined) {
      trade.exitPercent = ctx.exitPercent;
    }
  }

  // For long: net proceeds = sell value - costs
  // For short: net proceeds = entry value + profit - costs
  //   = entryPrice*shares + (entryPrice - exitPrice)*shares - costs
  //   = 2*entryPrice*shares - exitValue - costs
  const entryValue = ctx.position.entryPrice * ctx.sharesToClose;
  const netProceeds =
    direction === "short"
      ? entryValue + grossReturn - exitCommission - tax
      : exitValue - exitCommission - tax;

  return {
    trade,
    netProceeds,
    returnPercent,
  };
}

/**
 * Apply slippage to price
 */
export function applySlippage(price: number, slippage: number, direction: "buy" | "sell"): number {
  const slippageMultiplier = slippage / 100;
  return direction === "buy" ? price * (1 + slippageMultiplier) : price * (1 - slippageMultiplier);
}

/**
 * Check if stop loss is triggered (price dropped to stop level)
 * Returns the exit price if triggered, null otherwise
 */
export function checkStopTrigger(
  candle: NormalizedCandle,
  stopPrice: number,
  slTpMode: SlTpMode,
): { price: number } | null {
  if (slTpMode === "intraday") {
    if (candle.low <= stopPrice) {
      return { price: stopPrice };
    }
  } else {
    if (candle.close <= stopPrice) {
      return { price: candle.close };
    }
  }
  return null;
}

/**
 * Check if take profit is triggered (price rose to target level)
 * Returns the exit price if triggered, null otherwise
 */
export function checkProfitTrigger(
  candle: NormalizedCandle,
  targetPrice: number,
  slTpMode: SlTpMode,
): { price: number } | null {
  if (slTpMode === "intraday") {
    if (candle.high >= targetPrice) {
      return { price: targetPrice };
    }
  } else {
    if (candle.close >= targetPrice) {
      return { price: candle.close };
    }
  }
  return null;
}

/**
 * Clamp a fill bar to the position's post-fill price knowledge.
 *
 * When an order fills mid-bar, the bar's full high/low include price action
 * from BEFORE the fill — a path the position never owned. The only knowable
 * post-fill prices are the fill itself and the close, so same-bar position
 * management (stop/TP/trailing checks, peak/trough, MFE/MAE) must run
 * against this clamped view. The open is set to the fill price so the
 * synthetic bar stays self-consistent (open within [low, high]).
 *
 * From the next bar on, the whole bar is post-fill and no clamp applies.
 */
export function clampCandleToPostFill(
  fillPrice: number,
  candle: NormalizedCandle,
): NormalizedCandle {
  return {
    ...candle,
    open: fillPrice,
    high: Math.max(fillPrice, candle.close),
    low: Math.min(fillPrice, candle.close),
  };
}

/**
 * Check stop loss trigger with direction awareness
 * For long: price drops to stop level (same as checkStopTrigger)
 * For short: price rises to stop level
 */
export function checkStopTriggerDirectional(
  candle: NormalizedCandle,
  stopPrice: number,
  slTpMode: SlTpMode,
  direction: PositionDirection,
): { price: number } | null {
  if (direction === "short") {
    // Short stop loss: triggered when price rises above stop
    return checkProfitTrigger(candle, stopPrice, slTpMode);
  }
  return checkStopTrigger(candle, stopPrice, slTpMode);
}

/**
 * Check take profit trigger with direction awareness
 * For long: price rises to target (same as checkProfitTrigger)
 * For short: price drops to target
 */
export function checkProfitTriggerDirectional(
  candle: NormalizedCandle,
  targetPrice: number,
  slTpMode: SlTpMode,
  direction: PositionDirection,
): { price: number } | null {
  if (direction === "short") {
    // Short take profit: triggered when price drops below target
    return checkStopTrigger(candle, targetPrice, slTpMode);
  }
  return checkProfitTrigger(candle, targetPrice, slTpMode);
}

/**
 * Calculate MFE utilization
 * Returns how much of the maximum favorable excursion was captured
 * Returns null if MFE is 0 or negative (no unrealized profit during trade)
 */
export function calculateMfeUtilization(returnPercent: number, mfe: number): number | null {
  if (mfe <= 0) return null;
  // If return is positive, utilization = return / mfe
  // If return is negative, utilization = 0 (captured none of the potential profit)
  if (returnPercent <= 0) return 0;
  return Math.min(100, (returnPercent / mfe) * 100);
}

/**
 * Span info used for time-based metrics (CAGR, exposure). Engines that
 * have access to the candle array pass `firstTime` / `lastTime` directly
 * to avoid the inaccuracy of inferring the backtest window from trade
 * timestamps (which would exclude pre-first-trade warmup time).
 */
export type BacktestSpanInfo = {
  firstTime: number;
  lastTime: number;
};

/**
 * The nine "extended" backtest metrics added in this release. Extracted
 * as a helper so every `BacktestResult` construction site (the main
 * engine, scaled-entry engine, equity-curve rebuildResult) can call a
 * single implementation instead of duplicating the math.
 */
export type ExtendedBacktestMetrics = {
  sortinoRatio: number;
  calmarRatio: number;
  cagrPercent: number;
  expectancyPercent: number;
  exposurePercent: number;
  avgWinPercent: number;
  avgLossPercent: number;
  largestWinPercent: number;
  largestLossPercent: number;
};

/** Zero-filled `ExtendedBacktestMetrics`. Used by empty-result paths. */
export const ZERO_EXTENDED_METRICS: ExtendedBacktestMetrics = {
  sortinoRatio: 0,
  calmarRatio: 0,
  cagrPercent: 0,
  expectancyPercent: 0,
  exposurePercent: 0,
  avgWinPercent: 0,
  avgLossPercent: 0,
  largestWinPercent: 0,
  largestLossPercent: 0,
};

/**
 * Compute total market-exposure time from trades, **merging overlapping
 * `(entryTime, exitTime)` intervals** so the same wall-clock minute is
 * counted at most once. Scale-out / partial-exit strategies emit several
 * `Trade` records that share an entry time and have increasing exits;
 * a naive `sum(holdingDays)` would multiply the actual exposure by the
 * number of tranches. The merged-interval form returns the union of
 * trade windows, which is what "time in market" actually means.
 */
function computeMergedExposureDays(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const intervals = trades
    .map((t) => ({ start: t.entryTime, end: t.exitTime }))
    .sort((a, b) => a.start - b.start);
  let totalMs = 0;
  let curStart = intervals[0].start;
  let curEnd = intervals[0].end;
  for (let i = 1; i < intervals.length; i++) {
    const iv = intervals[i];
    if (iv.start > curEnd) {
      totalMs += curEnd - curStart;
      curStart = iv.start;
      curEnd = iv.end;
    } else if (iv.end > curEnd) {
      curEnd = iv.end;
    }
  }
  totalMs += curEnd - curStart;
  return totalMs / MS_PER_DAY;
}

/**
 * Compute the nine extended backtest metrics from raw trade / return /
 * capital inputs. Pure function; no side effects. Callers spread the
 * result into the final `BacktestResult` they construct.
 *
 * `span` (the candle window) is optional. CAGR and exposure are
 * meaningful only when the host knows the backtest window: when `span`
 * is omitted, both are reported as `0`.
 */
export function computeExtendedMetrics(
  trades: Trade[],
  returns: number[],
  initialCapital: number,
  finalCapital: number,
  maxDrawdown: number,
  span?: BacktestSpanInfo,
): ExtendedBacktestMetrics {
  if (trades.length === 0 || returns.length === 0) {
    return { ...ZERO_EXTENDED_METRICS };
  }

  // Sortino: like Sharpe but only penalizes downside deviation.
  // Target return = 0; downside-only squared deviation over min(0, r).
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const downsideSqSum = returns.reduce((s, r) => s + (r < 0 ? r * r : 0), 0);
  const downsideStd = Math.sqrt(downsideSqSum / returns.length);
  const sortinoRatio = downsideStd > 0 ? (avgReturn / downsideStd) * Math.sqrt(252) : 0;

  // Per-trade % aggregates. avgLoss / largestLoss are reported as
  // positive numbers so they read naturally side-by-side with wins.
  const winningTrades = trades.filter((t) => t.return > 0);
  const losingTrades = trades.filter((t) => t.return <= 0);
  const avgWinPercent =
    winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + t.returnPercent, 0) / winningTrades.length
      : 0;
  const avgLossPercent =
    losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((s, t) => s + t.returnPercent, 0) / losingTrades.length)
      : 0;
  const largestWinPercent =
    winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.returnPercent)) : 0;
  const largestLossPercent =
    losingTrades.length > 0 ? Math.abs(Math.min(...losingTrades.map((t) => t.returnPercent))) : 0;

  // Expectancy: arithmetic mean of returnPercent. Equivalent to
  // (winRate × avgWin) − (lossRate × avgLoss) but cleaner to compute.
  const expectancyPercent = trades.reduce((s, t) => s + t.returnPercent, 0) / trades.length;

  // Time-based metrics. Only meaningful with a known candle span.
  let cagrPercent = 0;
  let exposurePercent = 0;
  if (span && span.lastTime > span.firstTime) {
    const spanDays = (span.lastTime - span.firstTime) / MS_PER_DAY;
    if (spanDays > 0) {
      const exposureDays = computeMergedExposureDays(trades);
      exposurePercent = Math.min(100, (exposureDays / spanDays) * 100);
      const years = spanDays / 365.25;
      if (years > 0 && finalCapital > 0 && initialCapital > 0) {
        cagrPercent = ((finalCapital / initialCapital) ** (1 / years) - 1) * 100;
      }
    }
  }

  // Calmar: CAGR / maxDrawdown. Industry "return per unit of pain".
  const calmarRatio = maxDrawdown > 0 ? cagrPercent / maxDrawdown : 0;

  return {
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    cagrPercent: Math.round(cagrPercent * 100) / 100,
    expectancyPercent: Math.round(expectancyPercent * 100) / 100,
    exposurePercent: Math.round(exposurePercent * 100) / 100,
    avgWinPercent: Math.round(avgWinPercent * 100) / 100,
    avgLossPercent: Math.round(avgLossPercent * 100) / 100,
    largestWinPercent: Math.round(largestWinPercent * 100) / 100,
    largestLossPercent: Math.round(largestLossPercent * 100) / 100,
  };
}

/**
 * Calculate backtest statistics
 */
export function calculateStats(
  trades: Trade[],
  returns: number[],
  initialCapital: number,
  finalCapital: number,
  maxDrawdown: number,
  settings: BacktestSettings,
  drawdownPeriods: DrawdownPeriod[] = [],
  span?: BacktestSpanInfo,
): BacktestResult {
  if (trades.length === 0) {
    return emptyResult(initialCapital, settings, span);
  }

  const totalReturn = finalCapital - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

  const winningTrades = trades.filter((t) => t.return > 0);
  const losingTrades = trades.filter((t) => t.return <= 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  const totalProfit = winningTrades.reduce((sum, t) => sum + t.return, 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.return, 0));
  // Cap profit factor at 999.99 to avoid Infinity (causes JSON serialization issues)
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999.99 : 0;

  const avgHoldingDays = trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length;

  // Calculate Sharpe Ratio (annualized, assuming 252 trading days)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length,
  );
  // Annualize using sqrt(252) - standard annualization factor for daily returns
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  const extended = computeExtendedMetrics(
    trades,
    returns,
    initialCapital,
    finalCapital,
    maxDrawdown,
    span,
  );

  return {
    initialCapital,
    finalCapital: Math.round(finalCapital * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
    tradeCount: trades.length,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    ...extended,
    firstBarTime: span?.firstTime ?? 0,
    lastBarTime: span?.lastTime ?? 0,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
    trades,
    settings,
    drawdownPeriods,
  };
}

/**
 * Apply volume constraint to limit position size based on bar volume.
 * Returns adjusted shares (may be less than requested, or 0 if partialFill is false).
 *
 * @param requestedShares - Number of shares the strategy wants to buy
 * @param price - Entry price per share
 * @param candle - Current candle (for volume data)
 * @param constraint - Volume constraint configuration
 * @returns Adjusted number of shares
 *
 * @example
 * ```ts
 * const shares = applyVolumeConstraint(1000, 50, candle, { maxVolumePercent: 10 });
 * // If candle.volume * 10% * price < 1000 * 50, shares will be reduced
 * ```
 */
export function applyVolumeConstraint(
  requestedShares: number,
  price: number,
  candle: NormalizedCandle,
  constraint: VolumeConstraint,
): number {
  if (!candle.volume || candle.volume <= 0 || price <= 0) {
    return constraint.partialFill !== false ? requestedShares : 0;
  }

  const maxShares = candle.volume * (constraint.maxVolumePercent / 100);
  if (requestedShares <= maxShares) {
    return requestedShares;
  }

  // Constrained
  if (constraint.partialFill === false) {
    return 0; // Cancel order
  }
  return maxShares;
}

/**
 * Return empty result for edge cases
 */
export function emptyResult(
  capital: number,
  settings: BacktestSettings,
  span?: BacktestSpanInfo,
): BacktestResult {
  return {
    initialCapital: capital,
    finalCapital: capital,
    totalReturn: 0,
    totalReturnPercent: 0,
    tradeCount: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    ...ZERO_EXTENDED_METRICS,
    firstBarTime: span?.firstTime ?? 0,
    lastBarTime: span?.lastTime ?? 0,
    profitFactor: 0,
    avgHoldingDays: 0,
    trades: [],
    settings,
    drawdownPeriods: [],
  };
}
