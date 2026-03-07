/**
 * Backtest Engine Utilities
 * Helper functions and types for the backtest engine
 */

import type {
  BacktestResult,
  BacktestSettings,
  ExitReason,
  NormalizedCandle,
  PositionDirection,
  SlTpMode,
  Trade,
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
  const priceDiff = direction === "long"
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
  const netProceeds = direction === "short"
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
 * Calculate backtest statistics
 */
export function calculateStats(
  trades: Trade[],
  returns: number[],
  initialCapital: number,
  finalCapital: number,
  maxDrawdown: number,
  settings: BacktestSettings,
): BacktestResult {
  if (trades.length === 0) {
    return emptyResult(initialCapital, settings);
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

  return {
    initialCapital,
    finalCapital: Math.round(finalCapital * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
    tradeCount: trades.length,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
    trades,
    settings,
  };
}

/**
 * Return empty result for edge cases
 */
export function emptyResult(capital: number, settings: BacktestSettings): BacktestResult {
  return {
    initialCapital: capital,
    finalCapital: capital,
    totalReturn: 0,
    totalReturnPercent: 0,
    tradeCount: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    profitFactor: 0,
    avgHoldingDays: 0,
    trades: [],
    settings,
  };
}
