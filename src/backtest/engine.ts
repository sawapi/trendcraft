/**
 * Backtest Engine
 * Simulates trading strategy on historical data
 */

import { buildMtfIndexMap, createMtfContext, updateMtfIndices } from "../core/mtf-context";
import { atr } from "../indicators/volatility/atr";
import type {
  AtrRiskOptions,
  BacktestOptions,
  BacktestResult,
  BacktestSettings,
  Condition,
  FillMode,
  MtfContext,
  NormalizedCandle,
  SlTpMode,
  TimeframeShorthand,
  Trade,
} from "../types";
import { evaluateCondition } from "./conditions";
import type { ExtendedCondition } from "./conditions";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Extended backtest options with MTF and ATR risk support
 */
export type MtfBacktestOptions = BacktestOptions & {
  /** Timeframes to include for MTF conditions */
  mtfTimeframes?: TimeframeShorthand[];
  /** ATR-based risk management options */
  atrRisk?: AtrRiskOptions;
};

/**
 * Run backtest on historical candle data
 */
export function runBacktest(
  candles: NormalizedCandle[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: BacktestOptions | MtfBacktestOptions,
): BacktestResult {
  const {
    capital,
    commission = 0,
    commissionRate = 0,
    slippage = 0,
    stopLoss,
    takeProfit,
    trailingStop,
    atrTrailingStop,
    partialTakeProfit,
    taxRate = 0,
    fillMode = "next-bar-open" as FillMode,
    slTpMode = "close-only" as SlTpMode,
  } = options;

  // Extract MTF timeframes and ATR risk options if provided
  const mtfTimeframes = (options as MtfBacktestOptions).mtfTimeframes;
  const atrRisk = (options as MtfBacktestOptions).atrRisk;

  // Build settings for reproducibility
  const settings: BacktestSettings = {
    fillMode,
    slTpMode,
    stopLoss,
    takeProfit,
    trailingStop,
    slippage,
    commission,
    commissionRate,
  };

  if (candles.length < 2) {
    return emptyResult(capital, settings);
  }

  const trades: Trade[] = [];
  const indicators: Record<string, unknown> = {};

  // Setup MTF context if timeframes are specified
  let mtfContext: MtfContext | undefined;
  let mtfIndexMap: Map<TimeframeShorthand, number[]> | undefined;

  if (mtfTimeframes && mtfTimeframes.length > 0) {
    mtfContext = createMtfContext(candles, mtfTimeframes);
    mtfIndexMap = buildMtfIndexMap(candles, mtfContext);
  }

  // Pre-calculate ATR if ATR risk management or ATR trailing stop is enabled
  let atrSeries: { time: number; value: number | null }[] | null = null;
  if (atrRisk) {
    const atrPeriod = atrRisk.atrPeriod ?? 14;
    atrSeries = atr(candles, { period: atrPeriod });
  } else if (atrTrailingStop) {
    const atrPeriod = atrTrailingStop.period ?? 14;
    atrSeries = atr(candles, { period: atrPeriod });
  }

  let position: {
    entryTime: number;
    entryPrice: number;
    peakPrice: number;
    shares: number;
    originalShares: number;
    partialTaken: boolean;
    entryAtr: number | null; // ATR at entry time (for useEntryAtr mode)
  } | null = null;

  // Pending entry for next-bar-open mode
  let pendingEntry: {
    signalTime: number;
    signalIndex: number;
    entryAtr: number | null;
  } | null = null;

  // Pending exit for next-bar-open mode
  let pendingExit: {
    signalTime: number;
    exitPrice: number; // Target price (for SL/TP) or 0 for signal-based exit
    isSignalBased: boolean;
  } | null = null;

  let currentCapital = capital;
  let peakCapital = capital;
  let maxDrawdown = 0;
  const returns: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];

    // Update MTF indices for this candle
    if (mtfContext && mtfIndexMap) {
      updateMtfIndices(mtfContext, mtfIndexMap, i, candle.time);
    }

    // === Handle pending entry (next-bar-open mode) ===
    if (pendingEntry !== null && position === null) {
      const entryPrice = applySlippage(candle.open, slippage, "buy");

      // Calculate commission (fixed + rate-based)
      const tradeValue = currentCapital;
      const entryCommission = commission + tradeValue * (commissionRate / 100);

      // Calculate shares after commission
      const shares = (currentCapital - entryCommission) / entryPrice;

      position = {
        entryTime: candle.time,
        entryPrice,
        peakPrice: candle.high, // Use current bar's high as initial peak
        shares,
        originalShares: shares,
        partialTaken: false,
        entryAtr: pendingEntry.entryAtr,
      };

      // Capital is now invested in position
      currentCapital = 0;
      pendingEntry = null;
    }

    // === Handle pending exit (next-bar-open mode) ===
    if (pendingExit !== null && position !== null) {
      // Execute exit at this bar's open
      const exitPrice = applySlippage(candle.open, slippage, "sell");

      // Calculate gross return
      const grossReturn = (exitPrice - position.entryPrice) * position.shares;

      // Calculate exit commission
      const exitValue = exitPrice * position.shares;
      const exitCommission = commission + exitValue * (commissionRate / 100);

      // Apply tax on profits only
      let tax = 0;
      if (grossReturn > 0 && taxRate > 0) {
        tax = grossReturn * (taxRate / 100);
      }

      // Net return after commission and tax
      const netReturn = grossReturn - exitCommission - tax;
      const returnPercent = (netReturn / (position.entryPrice * position.shares)) * 100;
      const holdingDays = Math.round((candle.time - position.entryTime) / MS_PER_DAY);

      trades.push({
        entryTime: position.entryTime,
        entryPrice: position.entryPrice,
        exitTime: candle.time,
        exitPrice,
        return: netReturn,
        returnPercent,
        holdingDays,
      });

      // Update capital
      currentCapital += exitValue - exitCommission - tax;
      returns.push(returnPercent / 100);

      // Track drawdown
      if (currentCapital > peakCapital) {
        peakCapital = currentCapital;
      }
      const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      position = null;
      pendingExit = null;
    }

    // === Check for new entry ===
    if (position === null && pendingEntry === null) {
      // Check entry condition
      if (
        evaluateCondition(
          entryCondition as ExtendedCondition,
          indicators,
          candle,
          i,
          candles,
          mtfContext,
        )
      ) {
        // Store entry ATR for useEntryAtr mode
        const entryAtr = atrSeries ? atrSeries[i].value : null;

        if (fillMode === "same-bar-close") {
          // Legacy mode: enter at this bar's close
          const entryPrice = applySlippage(candle.close, slippage, "buy");

          // Calculate commission (fixed + rate-based)
          const tradeValue = currentCapital;
          const entryCommission = commission + tradeValue * (commissionRate / 100);

          // Calculate shares after commission
          const shares = (currentCapital - entryCommission) / entryPrice;

          position = {
            entryTime: candle.time,
            entryPrice,
            peakPrice: entryPrice,
            shares,
            originalShares: shares,
            partialTaken: false,
            entryAtr,
          };

          // Capital is now invested in position
          currentCapital = 0;
        } else {
          // next-bar-open mode: queue entry for next bar
          pendingEntry = {
            signalTime: candle.time,
            signalIndex: i,
            entryAtr,
          };
        }
      }
    } else if (position !== null && pendingExit === null) {
      // === Position management ===

      // Update peak price for trailing stop
      if (candle.high > position.peakPrice) {
        position.peakPrice = candle.high;
      }

      let shouldExit = false;
      let exitPrice = candle.close;

      // Get current ATR value for ATR-based risk management
      let currentAtr: number | null = null;
      if (atrRisk && atrSeries) {
        if (atrRisk.useEntryAtr && position.entryAtr !== null) {
          // Use ATR from entry time (fixed stop distance)
          currentAtr = position.entryAtr;
        } else {
          // Use current ATR (dynamic stop distance)
          currentAtr = atrSeries[i].value;
        }
      }

      // === Stop Loss Check ===
      if (stopLoss !== undefined) {
        const stopLossPrice = position.entryPrice * (1 - stopLoss / 100);
        if (slTpMode === "intraday") {
          // Legacy: check against low (has look-ahead bias)
          if (candle.low <= stopLossPrice) {
            shouldExit = true;
            exitPrice = stopLossPrice;
          }
        } else {
          // close-only: check against close (no look-ahead bias)
          if (candle.close <= stopLossPrice) {
            shouldExit = true;
            exitPrice = candle.close;
          }
        }
      }

      // ATR-based stop loss
      if (!shouldExit && currentAtr !== null && atrRisk?.atrStopMultiplier !== undefined) {
        const atrStopDistance = currentAtr * atrRisk.atrStopMultiplier;
        const atrStopPrice = position.entryPrice - atrStopDistance;
        if (slTpMode === "intraday") {
          if (candle.low <= atrStopPrice) {
            shouldExit = true;
            exitPrice = atrStopPrice;
          }
        } else {
          if (candle.close <= atrStopPrice) {
            shouldExit = true;
            exitPrice = candle.close;
          }
        }
      }

      // === Take Profit Check ===
      if (!shouldExit && takeProfit !== undefined) {
        const takeProfitPrice = position.entryPrice * (1 + takeProfit / 100);
        if (slTpMode === "intraday") {
          // Legacy: check against high (has look-ahead bias)
          if (candle.high >= takeProfitPrice) {
            shouldExit = true;
            exitPrice = takeProfitPrice;
          }
        } else {
          // close-only: check against close (no look-ahead bias)
          if (candle.close >= takeProfitPrice) {
            shouldExit = true;
            exitPrice = candle.close;
          }
        }
      }

      // ATR-based take profit
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTakeProfitMultiplier !== undefined) {
        const atrTpDistance = currentAtr * atrRisk.atrTakeProfitMultiplier;
        const atrTpPrice = position.entryPrice + atrTpDistance;
        if (slTpMode === "intraday") {
          if (candle.high >= atrTpPrice) {
            shouldExit = true;
            exitPrice = atrTpPrice;
          }
        } else {
          if (candle.close >= atrTpPrice) {
            shouldExit = true;
            exitPrice = candle.close;
          }
        }
      }

      // Partial take profit check (sell portion of position at threshold)
      if (!shouldExit && partialTakeProfit && !position.partialTaken) {
        const partialThresholdPrice = position.entryPrice * (1 + partialTakeProfit.threshold / 100);
        const partialTrigger =
          slTpMode === "intraday"
            ? candle.high >= partialThresholdPrice
            : candle.close >= partialThresholdPrice;
        if (partialTrigger) {
          // Execute partial exit
          const partialExitPrice =
            slTpMode === "intraday"
              ? applySlippage(partialThresholdPrice, slippage, "sell")
              : applySlippage(candle.close, slippage, "sell");
          const sharesToSell = position.shares * (partialTakeProfit.sellPercent / 100);
          const sharesRemaining = position.shares - sharesToSell;

          // Calculate partial exit return
          const grossReturn = (partialExitPrice - position.entryPrice) * sharesToSell;
          const exitValue = partialExitPrice * sharesToSell;
          const exitCommission = commission + exitValue * (commissionRate / 100);

          let tax = 0;
          if (grossReturn > 0 && taxRate > 0) {
            tax = grossReturn * (taxRate / 100);
          }

          const netReturn = grossReturn - exitCommission - tax;
          const returnPercent = (netReturn / (position.entryPrice * sharesToSell)) * 100;
          const holdingDays = Math.round((candle.time - position.entryTime) / MS_PER_DAY);

          trades.push({
            entryTime: position.entryTime,
            entryPrice: position.entryPrice,
            exitTime: candle.time,
            exitPrice: partialExitPrice,
            return: netReturn,
            returnPercent,
            holdingDays,
            isPartial: true,
            exitPercent: partialTakeProfit.sellPercent,
          });

          // Update capital and position
          currentCapital += exitValue - exitCommission - tax;
          returns.push(returnPercent / 100);

          // Track drawdown
          if (currentCapital > peakCapital) {
            peakCapital = currentCapital;
          }
          const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }

          // Update position (keep remaining shares)
          position.shares = sharesRemaining;
          position.partialTaken = true;
        }
      }

      // Trailing stop check (fixed percentage)
      if (!shouldExit && trailingStop !== undefined) {
        const trailingStopPrice = position.peakPrice * (1 - trailingStop / 100);
        if (slTpMode === "intraday") {
          if (candle.low <= trailingStopPrice) {
            shouldExit = true;
            exitPrice = trailingStopPrice;
          }
        } else {
          if (candle.close <= trailingStopPrice) {
            shouldExit = true;
            exitPrice = candle.close;
          }
        }
      }

      // ATR-based trailing stop (via atrRisk option)
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTrailingMultiplier !== undefined) {
        const atrTrailDistance = currentAtr * atrRisk.atrTrailingMultiplier;
        const atrTrailPrice = position.peakPrice - atrTrailDistance;
        if (slTpMode === "intraday") {
          if (candle.low <= atrTrailPrice) {
            shouldExit = true;
            exitPrice = atrTrailPrice;
          }
        } else {
          if (candle.close <= atrTrailPrice) {
            shouldExit = true;
            exitPrice = candle.close;
          }
        }
      }

      // Simple ATR trailing stop (via atrTrailingStop option)
      if (!shouldExit && atrTrailingStop && atrSeries) {
        const atrValue = atrSeries[i]?.value;
        if (atrValue !== null && atrValue !== undefined) {
          const atrTrailDistance = atrValue * atrTrailingStop.multiplier;
          const atrTrailPrice = position.peakPrice - atrTrailDistance;
          if (slTpMode === "intraday") {
            if (candle.low <= atrTrailPrice) {
              shouldExit = true;
              exitPrice = atrTrailPrice;
            }
          } else {
            if (candle.close <= atrTrailPrice) {
              shouldExit = true;
              exitPrice = candle.close;
            }
          }
        }
      }

      // Signal-based exit condition
      if (
        !shouldExit &&
        evaluateCondition(
          exitCondition as ExtendedCondition,
          indicators,
          candle,
          i,
          candles,
          mtfContext,
        )
      ) {
        shouldExit = true;
        exitPrice = candle.close;
      }

      // Handle exit based on fillMode
      if (shouldExit) {
        if (fillMode === "same-bar-close") {
          // Legacy mode: exit immediately at this bar
          exitPrice = applySlippage(exitPrice, slippage, "sell");

          // Calculate gross return
          const grossReturn = (exitPrice - position.entryPrice) * position.shares;

          // Calculate exit commission
          const exitValue = exitPrice * position.shares;
          const exitCommission = commission + exitValue * (commissionRate / 100);

          // Apply tax on profits only
          let tax = 0;
          if (grossReturn > 0 && taxRate > 0) {
            tax = grossReturn * (taxRate / 100);
          }

          // Net return after commission and tax
          const netReturn = grossReturn - exitCommission - tax;
          const returnPercent = (netReturn / (position.entryPrice * position.shares)) * 100;
          const holdingDays = Math.round((candle.time - position.entryTime) / MS_PER_DAY);

          trades.push({
            entryTime: position.entryTime,
            entryPrice: position.entryPrice,
            exitTime: candle.time,
            exitPrice,
            return: netReturn,
            returnPercent,
            holdingDays,
          });

          // Update capital (add to existing capital from partial takes)
          currentCapital += exitValue - exitCommission - tax;
          returns.push(returnPercent / 100);

          // Track drawdown
          if (currentCapital > peakCapital) {
            peakCapital = currentCapital;
          }
          const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }

          position = null;
        } else {
          // next-bar-open mode: queue exit for next bar
          pendingExit = {
            signalTime: candle.time,
            exitPrice,
            isSignalBased: true,
          };
        }
      }
    }
  }

  // Close any open position at the end
  if (position !== null) {
    const lastCandle = candles[candles.length - 1];
    const exitPrice = lastCandle.close;

    // Calculate gross return
    const grossReturn = (exitPrice - position.entryPrice) * position.shares;

    // Calculate exit commission
    const exitValue = exitPrice * position.shares;
    const exitCommission = commission + exitValue * (commissionRate / 100);

    // Apply tax on profits only
    let tax = 0;
    if (grossReturn > 0 && taxRate > 0) {
      tax = grossReturn * (taxRate / 100);
    }

    // Net return
    const netReturn = grossReturn - exitCommission - tax;
    const returnPercent = (netReturn / (position.entryPrice * position.shares)) * 100;
    const holdingDays = Math.round((lastCandle.time - position.entryTime) / MS_PER_DAY);

    trades.push({
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      exitTime: lastCandle.time,
      exitPrice,
      return: netReturn,
      returnPercent,
      holdingDays,
    });

    // Add to existing capital from partial takes
    currentCapital += exitValue - exitCommission - tax;
    returns.push(returnPercent / 100);
  }

  return calculateStats(trades, returns, capital, currentCapital, maxDrawdown, settings);
}

/**
 * Apply slippage to price
 */
function applySlippage(price: number, slippage: number, direction: "buy" | "sell"): number {
  const slippageMultiplier = slippage / 100;
  if (direction === "buy") {
    return price * (1 + slippageMultiplier);
  } else {
    return price * (1 - slippageMultiplier);
  }
}

/**
 * Calculate backtest statistics
 */
function calculateStats(
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
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length,
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
function emptyResult(capital: number, settings: BacktestSettings): BacktestResult {
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
