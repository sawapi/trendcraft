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
  ExitReason,
  FillMode,
  FundamentalMetrics,
  MtfContext,
  NormalizedCandle,
  SlTpMode,
  TimeframeShorthand,
  Trade,
} from "../types";
import { createFundamentalsMap } from "../core/fundamentals";
import { type IndicatorCache, createCachedIndicators } from "../core/indicator-cache";
import { evaluateCondition } from "./conditions";
import type { ExtendedCondition } from "./conditions";
import {
  MS_PER_DAY,
  applySlippage,
  calculateStats,
  calculateTradeClose,
  checkProfitTrigger,
  checkStopTrigger,
  emptyResult,
} from "./engine-utils";
import type { Position } from "./engine-utils";

/**
 * Extended backtest options with MTF, ATR risk, and fundamentals support
 */
export type MtfBacktestOptions = BacktestOptions & {
  /** Timeframes to include for MTF conditions */
  mtfTimeframes?: TimeframeShorthand[];
  /** ATR-based risk management options */
  atrRisk?: AtrRiskOptions;
  /** Fundamental metrics (PER/PBR) for condition evaluation */
  fundamentals?: FundamentalMetrics[];
};

/**
 * Run backtest on historical candle data
 * @param candles - Normalized candle data
 * @param entryCondition - Entry condition
 * @param exitCondition - Exit condition
 * @param options - Backtest options
 * @param cache - Optional IndicatorCache for sharing indicator computations across backtests
 */
export function runBacktest(
  candles: NormalizedCandle[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: BacktestOptions | MtfBacktestOptions,
  cache?: IndicatorCache,
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
    breakevenStop,
    scaleOut,
    timeExit,
    taxRate = 0,
    fillMode = "next-bar-open" as FillMode,
    slTpMode = "close-only" as SlTpMode,
  } = options;

  // Extract MTF timeframes, ATR risk options, and fundamentals if provided
  const mtfTimeframes = (options as MtfBacktestOptions).mtfTimeframes;
  const atrRisk = (options as MtfBacktestOptions).atrRisk;
  const fundamentals = (options as MtfBacktestOptions).fundamentals;

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
  const indicators: Record<string, unknown> = createCachedIndicators(candles, cache);

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

  // Build fundamentals map for fast lookup if provided
  const fundamentalsMap = fundamentals ? createFundamentalsMap(fundamentals) : null;

  let position: Position | null = null;

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
    exitReason: ExitReason;
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

    // Inject fundamental metrics into indicators for condition evaluation
    if (fundamentalsMap) {
      const fund = fundamentalsMap.get(candle.time);
      indicators.per = fund?.per ?? null;
      indicators.pbr = fund?.pbr ?? null;
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
        breakevenActivated: false,
        scaleOutLevelsTaken: scaleOut ? scaleOut.levels.map(() => false) : [],
        entryAtr: pendingEntry.entryAtr,
        maxProfitPercent: 0,
        maxLossPercent: 0,
      };

      // Capital is now invested in position
      currentCapital = 0;
      pendingEntry = null;
    }

    // === Handle pending exit (next-bar-open mode) ===
    if (pendingExit !== null && position !== null) {
      const result = calculateTradeClose({
        position,
        exitTime: candle.time,
        exitPrice: candle.open,
        exitReason: pendingExit.exitReason,
        sharesToClose: position.shares,
        commission,
        commissionRate,
        taxRate,
        slippage,
      });

      trades.push(result.trade);
      currentCapital += result.netProceeds;
      returns.push(result.returnPercent / 100);

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
            breakevenActivated: false,
            scaleOutLevelsTaken: scaleOut ? scaleOut.levels.map(() => false) : [],
            entryAtr,
            maxProfitPercent: 0,
            maxLossPercent: 0,
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

      // Track MFE/MAE (Maximum Favorable/Adverse Excursion)
      // Use high for potential max profit, low for potential max loss
      const highReturn = ((candle.high - position.entryPrice) / position.entryPrice) * 100;
      const lowReturn = ((candle.low - position.entryPrice) / position.entryPrice) * 100;

      // MFE: maximum unrealized profit (highest high return)
      if (highReturn > position.maxProfitPercent) {
        position.maxProfitPercent = highReturn;
      }

      // MAE: maximum unrealized loss (lowest low return, stored as positive)
      if (lowReturn < 0 && Math.abs(lowReturn) > position.maxLossPercent) {
        position.maxLossPercent = Math.abs(lowReturn);
      }

      let shouldExit = false;
      let exitPrice = candle.close;
      let exitReason: ExitReason = "signal"; // Default, will be overwritten

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
        const triggered = checkStopTrigger(candle, stopLossPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "stopLoss";
        }
      }

      // ATR-based stop loss
      if (!shouldExit && currentAtr !== null && atrRisk?.atrStopMultiplier !== undefined) {
        const atrStopPrice = position.entryPrice - currentAtr * atrRisk.atrStopMultiplier;
        const triggered = checkStopTrigger(candle, atrStopPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "stopLoss";
        }
      }

      // === Take Profit Check ===
      if (!shouldExit && takeProfit !== undefined) {
        const takeProfitPrice = position.entryPrice * (1 + takeProfit / 100);
        const triggered = checkProfitTrigger(candle, takeProfitPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "takeProfit";
        }
      }

      // ATR-based take profit
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTakeProfitMultiplier !== undefined) {
        const atrTpPrice = position.entryPrice + currentAtr * atrRisk.atrTakeProfitMultiplier;
        const triggered = checkProfitTrigger(candle, atrTpPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "takeProfit";
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
          const partialExitPrice = slTpMode === "intraday" ? partialThresholdPrice : candle.close;
          const sharesToSell = position.shares * (partialTakeProfit.sellPercent / 100);

          const result = calculateTradeClose({
            position,
            exitTime: candle.time,
            exitPrice: partialExitPrice,
            exitReason: "partialTakeProfit",
            sharesToClose: sharesToSell,
            isPartial: true,
            exitPercent: partialTakeProfit.sellPercent,
            commission,
            commissionRate,
            taxRate,
            slippage,
          });

          trades.push(result.trade);
          currentCapital += result.netProceeds;
          returns.push(result.returnPercent / 100);

          // Track drawdown
          if (currentCapital > peakCapital) {
            peakCapital = currentCapital;
          }
          const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }

          // Update position (keep remaining shares)
          position.shares -= sharesToSell;
          position.partialTaken = true;
        }
      }

      // Scale-out check (sell portions at multiple profit levels)
      if (!shouldExit && scaleOut && position.shares > 0) {
        for (let levelIndex = 0; levelIndex < scaleOut.levels.length; levelIndex++) {
          if (position.scaleOutLevelsTaken[levelIndex]) continue;

          const level = scaleOut.levels[levelIndex];
          const scaleOutThresholdPrice = position.entryPrice * (1 + level.threshold / 100);
          const scaleOutTrigger =
            slTpMode === "intraday"
              ? candle.high >= scaleOutThresholdPrice
              : candle.close >= scaleOutThresholdPrice;

          if (scaleOutTrigger) {
            const scaleOutExitPrice =
              slTpMode === "intraday" ? scaleOutThresholdPrice : candle.close;
            const sharesToSell = position.shares * (level.sellPercent / 100);
            const sharesRemaining = position.shares - sharesToSell;

            const result = calculateTradeClose({
              position,
              exitTime: candle.time,
              exitPrice: scaleOutExitPrice,
              exitReason: "scaleOut",
              sharesToClose: sharesToSell,
              isPartial: sharesRemaining > 0,
              exitPercent: level.sellPercent,
              commission,
              commissionRate,
              taxRate,
              slippage,
            });

            trades.push(result.trade);
            currentCapital += result.netProceeds;
            returns.push(result.returnPercent / 100);

            // Track drawdown
            if (currentCapital > peakCapital) {
              peakCapital = currentCapital;
            }
            const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }

            position.shares = sharesRemaining;
            position.scaleOutLevelsTaken[levelIndex] = true;

            if (sharesRemaining <= 0) {
              position = null;
              break;
            }
          }
        }
      }

      // Skip remaining checks if position was closed by scale-out
      if (position === null) {
        continue;
      }

      // Breakeven stop check (move stop to entry price after profit threshold)
      if (!shouldExit && breakevenStop) {
        const breakevenThresholdPrice = position.entryPrice * (1 + breakevenStop.threshold / 100);
        const buffer = breakevenStop.buffer ?? 0;
        const breakevenStopPrice = position.entryPrice * (1 + buffer / 100);

        // Activate breakeven if threshold is reached
        if (!position.breakevenActivated) {
          const triggered = checkProfitTrigger(candle, breakevenThresholdPrice, slTpMode);
          if (triggered) {
            position.breakevenActivated = true;
          }
        }

        // Check breakeven stop if activated
        if (position.breakevenActivated) {
          const triggered = checkStopTrigger(candle, breakevenStopPrice, slTpMode);
          if (triggered) {
            shouldExit = true;
            exitPrice = triggered.price;
            exitReason = "breakeven";
          }
        }
      }

      // Trailing stop check (fixed percentage)
      if (!shouldExit && trailingStop !== undefined) {
        const trailingStopPrice = position.peakPrice * (1 - trailingStop / 100);
        const triggered = checkStopTrigger(candle, trailingStopPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "trailing";
        }
      }

      // ATR-based trailing stop (via atrRisk option)
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTrailingMultiplier !== undefined) {
        const atrTrailPrice = position.peakPrice - currentAtr * atrRisk.atrTrailingMultiplier;
        const triggered = checkStopTrigger(candle, atrTrailPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "trailing";
        }
      }

      // Simple ATR trailing stop (via atrTrailingStop option)
      if (!shouldExit && atrTrailingStop && atrSeries) {
        const atrValue = atrSeries[i]?.value;
        if (atrValue !== null && atrValue !== undefined) {
          const atrTrailPrice = position.peakPrice - atrValue * atrTrailingStop.multiplier;
          const triggered = checkStopTrigger(candle, atrTrailPrice, slTpMode);
          if (triggered) {
            shouldExit = true;
            exitPrice = triggered.price;
            exitReason = "trailing";
          }
        }
      }

      // Time-based exit (exit after maxHoldDays)
      if (!shouldExit && timeExit) {
        const holdingDays = Math.floor((candle.time - position.entryTime) / MS_PER_DAY);

        if (holdingDays >= timeExit.maxHoldDays) {
          // Check if we should only exit when position is flat
          if (timeExit.onlyIfFlat) {
            const currentReturn =
              ((candle.close - position.entryPrice) / position.entryPrice) * 100;
            const threshold = timeExit.onlyIfFlat.threshold;

            // Only exit if return is within +/-threshold%
            if (Math.abs(currentReturn) <= threshold) {
              shouldExit = true;
              exitPrice = candle.close;
              exitReason = "timeExit";
            }
          } else {
            // No flat condition, just exit after time
            shouldExit = true;
            exitPrice = candle.close;
            exitReason = "timeExit";
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
        exitReason = "signal";
      }

      // Handle exit based on fillMode
      if (shouldExit) {
        if (fillMode === "same-bar-close") {
          const result = calculateTradeClose({
            position,
            exitTime: candle.time,
            exitPrice,
            exitReason,
            sharesToClose: position.shares,
            commission,
            commissionRate,
            taxRate,
            slippage,
          });

          trades.push(result.trade);
          currentCapital += result.netProceeds;
          returns.push(result.returnPercent / 100);

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
            isSignalBased: exitReason === "signal",
            exitReason,
          };
        }
      }
    }
  }

  // Close any open position at the end
  if (position !== null) {
    const lastCandle = candles[candles.length - 1];

    const result = calculateTradeClose({
      position,
      exitTime: lastCandle.time,
      exitPrice: lastCandle.close,
      exitReason: "endOfData",
      sharesToClose: position.shares,
      commission,
      commissionRate,
      taxRate,
      slippage: 0, // No slippage for end-of-data close
    });

    trades.push(result.trade);
    currentCapital += result.netProceeds;
    returns.push(result.returnPercent / 100);
  }

  return calculateStats(trades, returns, capital, currentCapital, maxDrawdown, settings);
}
