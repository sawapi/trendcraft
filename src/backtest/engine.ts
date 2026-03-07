/**
 * Backtest Engine
 * Simulates trading strategy on historical data
 * Supports both long and short positions
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
  PositionDirection,
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
  checkProfitTriggerDirectional,
  checkStopTriggerDirectional,
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
    direction: dir = "long" as PositionDirection,
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

  const isShort = dir === "short";
  const entrySide = isShort ? "sell" : "buy";

  // Extract MTF timeframes, ATR risk options, and fundamentals if provided
  const mtfTimeframes = (options as MtfBacktestOptions).mtfTimeframes;
  const atrRisk = (options as MtfBacktestOptions).atrRisk;
  const fundamentals = (options as MtfBacktestOptions).fundamentals;

  // Build settings for reproducibility
  const settings: BacktestSettings = {
    fillMode,
    slTpMode,
    direction: isShort ? "short" : undefined,
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
    exitPrice: number;
    isSignalBased: boolean;
    exitReason: ExitReason;
  } | null = null;

  let currentCapital = capital;
  let peakCapital = capital;
  let maxDrawdown = 0;
  const returns: number[] = [];

  /**
   * Create a position from entry parameters
   */
  function createPosition(
    entryTime: number,
    entryPrice: number,
    shares: number,
    entryAtr: number | null,
    initialHigh: number,
    initialLow: number,
  ): Position {
    return {
      entryTime,
      entryPrice,
      peakPrice: initialHigh,
      troughPrice: initialLow,
      direction: dir,
      shares,
      originalShares: shares,
      partialTaken: false,
      breakevenActivated: false,
      scaleOutLevelsTaken: scaleOut ? scaleOut.levels.map(() => false) : [],
      entryAtr,
      maxProfitPercent: 0,
      maxLossPercent: 0,
    };
  }

  /**
   * Calculate SL price based on direction
   * Long: entry * (1 - sl%), Short: entry * (1 + sl%)
   */
  function calcStopLossPrice(entryPrice: number, slPercent: number): number {
    return isShort
      ? entryPrice * (1 + slPercent / 100)
      : entryPrice * (1 - slPercent / 100);
  }

  /**
   * Calculate TP price based on direction
   * Long: entry * (1 + tp%), Short: entry * (1 - tp%)
   */
  function calcTakeProfitPrice(entryPrice: number, tpPercent: number): number {
    return isShort
      ? entryPrice * (1 - tpPercent / 100)
      : entryPrice * (1 + tpPercent / 100);
  }

  /**
   * Calculate ATR stop loss price based on direction
   */
  function calcAtrStopPrice(entryPrice: number, atrVal: number, multiplier: number): number {
    return isShort
      ? entryPrice + atrVal * multiplier
      : entryPrice - atrVal * multiplier;
  }

  /**
   * Calculate ATR take profit price based on direction
   */
  function calcAtrTpPrice(entryPrice: number, atrVal: number, multiplier: number): number {
    return isShort
      ? entryPrice - atrVal * multiplier
      : entryPrice + atrVal * multiplier;
  }

  /**
   * Calculate trailing stop price based on direction
   * Long: peakPrice * (1 - trail%), Short: troughPrice * (1 + trail%)
   */
  function calcTrailingStopPrice(pos: Position, trailPercent: number): number {
    return isShort
      ? pos.troughPrice * (1 + trailPercent / 100)
      : pos.peakPrice * (1 - trailPercent / 100);
  }

  /**
   * Calculate ATR trailing price based on direction
   */
  function calcAtrTrailPrice(pos: Position, atrVal: number, multiplier: number): number {
    return isShort
      ? pos.troughPrice + atrVal * multiplier
      : pos.peakPrice - atrVal * multiplier;
  }

  /**
   * Update MFE/MAE for direction
   */
  function updateMfeMae(pos: Position, candle: NormalizedCandle): void {
    if (isShort) {
      // Short: profit when price drops, loss when price rises
      const profitPercent = ((pos.entryPrice - candle.low) / pos.entryPrice) * 100;
      const lossPercent = ((candle.high - pos.entryPrice) / pos.entryPrice) * 100;
      if (profitPercent > pos.maxProfitPercent) pos.maxProfitPercent = profitPercent;
      if (lossPercent > 0 && lossPercent > pos.maxLossPercent) pos.maxLossPercent = lossPercent;
    } else {
      // Long: profit when price rises, loss when price drops
      const highReturn = ((candle.high - pos.entryPrice) / pos.entryPrice) * 100;
      const lowReturn = ((candle.low - pos.entryPrice) / pos.entryPrice) * 100;
      if (highReturn > pos.maxProfitPercent) pos.maxProfitPercent = highReturn;
      if (lowReturn < 0 && Math.abs(lowReturn) > pos.maxLossPercent) {
        pos.maxLossPercent = Math.abs(lowReturn);
      }
    }
  }

  /**
   * Calculate current return percent for time exit flat check
   */
  function currentReturnPercent(pos: Position, price: number): number {
    return isShort
      ? ((pos.entryPrice - price) / pos.entryPrice) * 100
      : ((price - pos.entryPrice) / pos.entryPrice) * 100;
  }

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
      const entryPrice = applySlippage(candle.open, slippage, entrySide);

      // Calculate commission (fixed + rate-based)
      const tradeValue = currentCapital;
      const entryCommission = commission + tradeValue * (commissionRate / 100);

      // Calculate shares after commission
      const shares = (currentCapital - entryCommission) / entryPrice;

      position = createPosition(
        candle.time, entryPrice, shares, pendingEntry.entryAtr,
        candle.high, candle.low,
      );

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
          const entryPrice = applySlippage(candle.close, slippage, entrySide);

          // Calculate commission (fixed + rate-based)
          const tradeValue = currentCapital;
          const entryCommission = commission + tradeValue * (commissionRate / 100);

          // Calculate shares after commission
          const shares = (currentCapital - entryCommission) / entryPrice;

          position = createPosition(
            candle.time, entryPrice, shares, entryAtr,
            entryPrice, entryPrice,
          );

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

      // Update peak/trough prices
      if (candle.high > position.peakPrice) {
        position.peakPrice = candle.high;
      }
      if (candle.low < position.troughPrice) {
        position.troughPrice = candle.low;
      }

      // Track MFE/MAE
      updateMfeMae(position, candle);

      let shouldExit = false;
      let exitPrice = candle.close;
      let exitReason: ExitReason = "signal";

      // Get current ATR value for ATR-based risk management
      let currentAtr: number | null = null;
      if (atrRisk && atrSeries) {
        if (atrRisk.useEntryAtr && position.entryAtr !== null) {
          currentAtr = position.entryAtr;
        } else {
          currentAtr = atrSeries[i].value;
        }
      }

      // === Stop Loss Check ===
      if (stopLoss !== undefined) {
        const stopLossPrice = calcStopLossPrice(position.entryPrice, stopLoss);
        const triggered = checkStopTriggerDirectional(candle, stopLossPrice, slTpMode, dir);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "stopLoss";
        }
      }

      // ATR-based stop loss
      if (!shouldExit && currentAtr !== null && atrRisk?.atrStopMultiplier !== undefined) {
        const atrStopPrice = calcAtrStopPrice(position.entryPrice, currentAtr, atrRisk.atrStopMultiplier);
        const triggered = checkStopTriggerDirectional(candle, atrStopPrice, slTpMode, dir);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "stopLoss";
        }
      }

      // === Take Profit Check ===
      if (!shouldExit && takeProfit !== undefined) {
        const takeProfitPrice = calcTakeProfitPrice(position.entryPrice, takeProfit);
        const triggered = checkProfitTriggerDirectional(candle, takeProfitPrice, slTpMode, dir);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "takeProfit";
        }
      }

      // ATR-based take profit
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTakeProfitMultiplier !== undefined) {
        const atrTpPrice = calcAtrTpPrice(position.entryPrice, currentAtr, atrRisk.atrTakeProfitMultiplier);
        const triggered = checkProfitTriggerDirectional(candle, atrTpPrice, slTpMode, dir);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "takeProfit";
        }
      }

      // Partial take profit check
      if (!shouldExit && partialTakeProfit && !position.partialTaken) {
        const partialThresholdPrice = calcTakeProfitPrice(position.entryPrice, partialTakeProfit.threshold);
        const partialTrigger = checkProfitTriggerDirectional(candle, partialThresholdPrice, slTpMode, dir);
        if (partialTrigger) {
          const partialExitPrice = partialTrigger.price;
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

      // Scale-out check
      if (!shouldExit && scaleOut && position.shares > 0) {
        for (let levelIndex = 0; levelIndex < scaleOut.levels.length; levelIndex++) {
          if (position.scaleOutLevelsTaken[levelIndex]) continue;

          const level = scaleOut.levels[levelIndex];
          const scaleOutThresholdPrice = calcTakeProfitPrice(position.entryPrice, level.threshold);
          const scaleOutTrigger = checkProfitTriggerDirectional(candle, scaleOutThresholdPrice, slTpMode, dir);

          if (scaleOutTrigger) {
            const scaleOutExitPrice = scaleOutTrigger.price;
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

      // Breakeven stop check
      if (!shouldExit && breakevenStop) {
        const breakevenThresholdPrice = calcTakeProfitPrice(position.entryPrice, breakevenStop.threshold);
        const buffer = breakevenStop.buffer ?? 0;
        const breakevenStopPrice = isShort
          ? position.entryPrice * (1 - buffer / 100)
          : position.entryPrice * (1 + buffer / 100);

        // Activate breakeven if threshold is reached
        if (!position.breakevenActivated) {
          const triggered = checkProfitTriggerDirectional(candle, breakevenThresholdPrice, slTpMode, dir);
          if (triggered) {
            position.breakevenActivated = true;
          }
        }

        // Check breakeven stop if activated
        if (position.breakevenActivated) {
          const triggered = checkStopTriggerDirectional(candle, breakevenStopPrice, slTpMode, dir);
          if (triggered) {
            shouldExit = true;
            exitPrice = triggered.price;
            exitReason = "breakeven";
          }
        }
      }

      // Trailing stop check (fixed percentage)
      if (!shouldExit && trailingStop !== undefined) {
        const trailingStopPrice = calcTrailingStopPrice(position, trailingStop);
        const triggered = checkStopTriggerDirectional(candle, trailingStopPrice, slTpMode, dir);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "trailing";
        }
      }

      // ATR-based trailing stop (via atrRisk option)
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTrailingMultiplier !== undefined) {
        const atrTrailPrice = calcAtrTrailPrice(position, currentAtr, atrRisk.atrTrailingMultiplier);
        const triggered = checkStopTriggerDirectional(candle, atrTrailPrice, slTpMode, dir);
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
          const atrTrailPrice = calcAtrTrailPrice(position, atrValue, atrTrailingStop.multiplier);
          const triggered = checkStopTriggerDirectional(candle, atrTrailPrice, slTpMode, dir);
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
          if (timeExit.onlyIfFlat) {
            const cr = currentReturnPercent(position, candle.close);
            const threshold = timeExit.onlyIfFlat.threshold;
            if (Math.abs(cr) <= threshold) {
              shouldExit = true;
              exitPrice = candle.close;
              exitReason = "timeExit";
            }
          } else {
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
