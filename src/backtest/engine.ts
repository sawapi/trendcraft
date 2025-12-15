/**
 * Backtest Engine
 * Simulates trading strategy on historical data
 */

import type { NormalizedCandle, Condition, BacktestOptions, BacktestResult, Trade } from "../types";
import { evaluateCondition } from "./conditions";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Run backtest on historical candle data
 */
export function runBacktest(
  candles: NormalizedCandle[],
  entryCondition: Condition,
  exitCondition: Condition,
  options: BacktestOptions
): BacktestResult {
  const {
    capital,
    commission = 0,
    commissionRate = 0,
    slippage = 0,
    stopLoss,
    takeProfit,
    trailingStop,
    partialTakeProfit,
    taxRate = 0,
  } = options;

  if (candles.length < 2) {
    return emptyResult();
  }

  const trades: Trade[] = [];
  const indicators: Record<string, unknown> = {};

  let position: {
    entryTime: number;
    entryPrice: number;
    peakPrice: number;
    shares: number;
    originalShares: number;
    partialTaken: boolean;
  } | null = null;
  let currentCapital = capital;
  let peakCapital = capital;
  let maxDrawdown = 0;
  const returns: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];

    if (position === null) {
      // Check entry condition
      if (evaluateCondition(entryCondition, indicators, candle, i, candles)) {
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
        };

        // Capital is now invested in position
        currentCapital = 0;
      }
    } else {
      // Update peak price for trailing stop
      if (candle.high > position.peakPrice) {
        position.peakPrice = candle.high;
      }

      let shouldExit = false;
      let exitPrice = candle.close;

      // Stop loss check (intraday using low price)
      if (stopLoss !== undefined) {
        const stopLossPrice = position.entryPrice * (1 - stopLoss / 100);
        if (candle.low <= stopLossPrice) {
          shouldExit = true;
          exitPrice = stopLossPrice;
        }
      }

      // Take profit check (intraday using high price)
      if (!shouldExit && takeProfit !== undefined) {
        const takeProfitPrice = position.entryPrice * (1 + takeProfit / 100);
        if (candle.high >= takeProfitPrice) {
          shouldExit = true;
          exitPrice = takeProfitPrice;
        }
      }

      // Partial take profit check (sell portion of position at threshold)
      if (!shouldExit && partialTakeProfit && !position.partialTaken) {
        const partialThresholdPrice = position.entryPrice * (1 + partialTakeProfit.threshold / 100);
        if (candle.high >= partialThresholdPrice) {
          // Execute partial exit
          const partialExitPrice = applySlippage(partialThresholdPrice, slippage, "sell");
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

      // Trailing stop check
      if (!shouldExit && trailingStop !== undefined) {
        const trailingStopPrice = position.peakPrice * (1 - trailingStop / 100);
        if (candle.low <= trailingStopPrice) {
          shouldExit = true;
          exitPrice = trailingStopPrice;
        }
      }

      // Signal-based exit condition
      if (!shouldExit && evaluateCondition(exitCondition, indicators, candle, i, candles)) {
        shouldExit = true;
        exitPrice = candle.close;
      }

      if (shouldExit) {
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

  return calculateStats(trades, returns, capital, currentCapital, maxDrawdown);
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
  maxDrawdown: number
): BacktestResult {
  if (trades.length === 0) {
    return emptyResult();
  }

  const totalReturn = finalCapital - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

  const winningTrades = trades.filter((t) => t.return > 0);
  const losingTrades = trades.filter((t) => t.return <= 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  const totalProfit = winningTrades.reduce((sum, t) => sum + t.return, 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.return, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  const avgHoldingDays = trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length;

  // Calculate Sharpe Ratio (annualized, assuming 252 trading days)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252 / avgHoldingDays) : 0;

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
    tradeCount: trades.length,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
    trades,
  };
}

/**
 * Return empty result for edge cases
 */
function emptyResult(): BacktestResult {
  return {
    totalReturn: 0,
    totalReturnPercent: 0,
    tradeCount: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    profitFactor: 0,
    avgHoldingDays: 0,
    trades: [],
  };
}
