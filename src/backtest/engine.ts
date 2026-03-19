/**
 * Backtest Engine
 * Simulates trading strategy on historical data
 * Supports both long and short positions
 */

import { createFundamentalsMap } from "../core/fundamentals";
import { type IndicatorCache, createCachedIndicators } from "../core/indicator-cache";
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
import type { ValidationOptions } from "../validation/types";
import { validateCandles } from "../validation/validate";
import { evaluateCondition } from "./conditions";
import type { ExtendedCondition } from "./conditions";
import { createDrawdownTracker } from "./drawdown-tracker";
import {
  MS_PER_DAY,
  applySlippage,
  applyVolumeConstraint,
  calculateStats,
  calculateTradeClose,
  checkProfitTriggerDirectional,
  checkStopTriggerDirectional,
  emptyResult,
} from "./engine-utils";
import type { Position } from "./engine-utils";
import { calculateDynamicSlippage, resolveSlippageModel } from "./slippage-model";
import type { SlippageModel } from "./slippage-model";
import { tryFillOrder, resolveTimeInForce } from "./order-types";
import type { PendingOrder } from "./order-types";
import {
  createMarginState,
  calculateBuyingPower,
  updateMarginState,
  accrueInterest,
  checkMarginCall,
} from "./margin";
import type { MarginState } from "./margin";

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
  /** Validate input candle data before running backtest. Default: false */
  validateData?: boolean | ValidationOptions;
};

/**
 * Run backtest on historical candle data
 * @param candles - Normalized candle data
 * @param entryCondition - Entry condition
 * @param exitCondition - Exit condition
 * @param options - Backtest options
 * @param cache - Optional IndicatorCache for sharing indicator computations across backtests
 * @example
 * ```ts
 * import { runBacktest, goldenCrossCondition, deadCrossCondition, normalizeCandles } from "trendcraft";
 *
 * const candles = normalizeCandles(rawCandles);
 * const result = runBacktest(
 *   candles,
 *   goldenCrossCondition(5, 25),   // entry: golden cross
 *   deadCrossCondition(5, 25),     // exit: dead cross
 *   { capital: 1_000_000, stopLoss: 5, takeProfit: 10 },
 * );
 * console.log(result.totalReturnPercent, result.winRate, result.tradeCount);
 * ```
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
    slippageModel: slippageModelOpt,
    orderType: orderTypeOpt,
    orderTTL = Infinity,
    timeInForce: tifOpt,
    volumeConstraint,
    margin: marginConfig,
  } = options;

  const isShort = dir === "short";
  const entrySide = isShort ? "sell" : "buy";

  // Resolve slippage model (explicit model takes precedence over legacy numeric)
  const slippageModel: SlippageModel | undefined = resolveSlippageModel(slippage, slippageModelOpt);

  // Whether we use order types (non-market orders need pending order handling)
  const useOrderTypes = orderTypeOpt !== undefined && orderTypeOpt.type !== "market";

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
    taxRate,
  };

  // Validate input data if requested
  const validateDataOpt = (options as MtfBacktestOptions).validateData;
  if (validateDataOpt) {
    const valOpts = typeof validateDataOpt === "object" ? validateDataOpt : undefined;
    const valResult = validateCandles(candles, valOpts);
    if (!valResult.valid) {
      throw new Error(
        `Data validation failed: ${valResult.errors.length} error(s) found. ` +
          `First: ${valResult.errors[0]?.message ?? "unknown"}`,
      );
    }
  }

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

  // Pre-calculate ATR if ATR risk management, ATR trailing stop, or dynamic slippage is enabled
  const needsAtr = !!(
    atrRisk ||
    atrTrailingStop ||
    (slippageModel && (slippageModel.type === "volatility" || slippageModel.type === "composite"))
  );
  let atrSeries: { time: number; value: number | null }[] | null = null;
  if (atrRisk) {
    const atrPeriod = atrRisk.atrPeriod ?? 14;
    atrSeries = atr(candles, { period: atrPeriod });
  } else if (atrTrailingStop) {
    const atrPeriod = atrTrailingStop.period ?? 14;
    atrSeries = atr(candles, { period: atrPeriod });
  } else if (needsAtr) {
    atrSeries = atr(candles, { period: 14 });
  }

  // Build fundamentals map for fast lookup if provided
  const fundamentalsMap = fundamentals ? createFundamentalsMap(fundamentals) : null;

  let position: Position | null = null;

  // Pending entry for next-bar-open mode (legacy simple or order-type based)
  let pendingEntry: {
    signalTime: number;
    signalIndex: number;
    entryAtr: number | null;
  } | null = null;

  // Pending order for limit/stop order types
  let pendingOrder: PendingOrder | null = null;

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
  const ddTracker = createDrawdownTracker(capital);

  // Margin state tracking
  let marginState: MarginState | null = null;
  if (marginConfig) {
    marginState = createMarginState(capital, marginConfig.leverage);
  }

  /**
   * Resolve slippage for a given candle (dynamic or fixed)
   */
  function getSlippage(candle: NormalizedCandle, barIndex: number): number {
    if (!slippageModel) return slippage;
    const atrVal = atrSeries ? (atrSeries[barIndex]?.value ?? undefined) : undefined;
    return calculateDynamicSlippage(slippageModel, candle, atrVal);
  }

  /**
   * Get effective buying power (accounts for margin/leverage)
   */
  function getAvailableCapital(): number {
    if (marginConfig) {
      return calculateBuyingPower(currentCapital, marginConfig.leverage);
    }
    return currentCapital;
  }

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
    return isShort ? entryPrice * (1 + slPercent / 100) : entryPrice * (1 - slPercent / 100);
  }

  /**
   * Calculate TP price based on direction
   * Long: entry * (1 + tp%), Short: entry * (1 - tp%)
   */
  function calcTakeProfitPrice(entryPrice: number, tpPercent: number): number {
    return isShort ? entryPrice * (1 - tpPercent / 100) : entryPrice * (1 + tpPercent / 100);
  }

  /**
   * Calculate ATR stop loss price based on direction
   */
  function calcAtrStopPrice(entryPrice: number, atrVal: number, multiplier: number): number {
    return isShort ? entryPrice + atrVal * multiplier : entryPrice - atrVal * multiplier;
  }

  /**
   * Calculate ATR take profit price based on direction
   */
  function calcAtrTpPrice(entryPrice: number, atrVal: number, multiplier: number): number {
    return isShort ? entryPrice - atrVal * multiplier : entryPrice + atrVal * multiplier;
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
    return isShort ? pos.troughPrice + atrVal * multiplier : pos.peakPrice - atrVal * multiplier;
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

  /**
   * Track drawdown after capital changes
   */
  function trackDrawdown(time: number, barIndex: number): void {
    if (currentCapital > peakCapital) {
      peakCapital = currentCapital;
    }
    const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    ddTracker.update(currentCapital, time, barIndex);
  }

  /**
   * Deduct margin interest when closing a position
   */
  function deductMarginInterest(entryTime: number, exitTime: number): void {
    if (marginConfig && marginState && marginConfig.interestRate) {
      const holdDays = Math.max(1, Math.round((exitTime - entryTime) / MS_PER_DAY));
      const interest = accrueInterest(marginState, marginConfig.interestRate / 365, holdDays);
      currentCapital -= interest;
      marginState.accumulatedInterest += interest;
    }
  }

  /**
   * Open a position given entry price and ATR. Returns the created position or null
   * if volume constraint prevents the trade.
   */
  function openPositionFromEntry(
    entryPrice: number,
    entryTime: number,
    entryAtr: number | null,
    initialHigh: number,
    initialLow: number,
    candle: NormalizedCandle,
    allowPartialFill?: boolean,
  ): Position | null {
    const availCap = getAvailableCapital();
    const entryCommission = commission + availCap * (commissionRate / 100);
    let shares = (availCap - entryCommission) / entryPrice;

    if (volumeConstraint) {
      const originalShares = shares;
      shares = applyVolumeConstraint(shares, entryPrice, candle, volumeConstraint);

      // FOK: reject if volume-constrained (partial not allowed)
      if (allowPartialFill === false && shares < originalShares) {
        shares = 0;
      }
    }

    if (shares <= 0) return null;

    const pos = createPosition(entryTime, entryPrice, shares, entryAtr, initialHigh, initialLow);
    if (marginConfig && marginState) {
      marginState.borrowedAmount = currentCapital * (marginConfig.leverage - 1);
    }
    currentCapital = 0;
    return pos;
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

    // === Handle pending order (limit/stop order types) ===
    if (pendingOrder !== null && position === null) {
      // Decrement TTL
      pendingOrder.barsRemaining--;
      if (pendingOrder.barsRemaining < 0) {
        pendingOrder = null; // Order expired
      } else {
        const fillResult = tryFillOrder(pendingOrder, candle);
        if (fillResult) {
          const currentSlip = getSlippage(candle, i);
          const fillPrice = applySlippage(fillResult.fillPrice, currentSlip, entrySide);
          const opened = openPositionFromEntry(
            fillPrice, candle.time, pendingOrder.entryAtr,
            candle.high, candle.low, candle,
            pendingOrder.allowPartialFill,
          );
          if (opened) {
            position = opened;
          }
          pendingOrder = null;
        }
      }
    }

    // === Handle pending entry (next-bar-open mode) ===
    if (pendingEntry !== null && position === null) {
      const currentSlip = getSlippage(candle, i);
      const entryPrice = applySlippage(candle.open, currentSlip, entrySide);
      const opened = openPositionFromEntry(
        entryPrice, candle.time, pendingEntry.entryAtr,
        candle.high, candle.low, candle,
      );
      if (opened) {
        position = opened;
      }
      pendingEntry = null;
    }

    // === Handle pending exit (next-bar-open mode) ===
    if (pendingExit !== null && position !== null) {
      const currentSlip = getSlippage(candle, i);
      const result = calculateTradeClose({
        position,
        exitTime: candle.time,
        exitPrice: candle.open,
        exitReason: pendingExit.exitReason,
        sharesToClose: position.shares,
        commission,
        commissionRate,
        taxRate,
        slippage: currentSlip,
      });

      trades.push(result.trade);
      currentCapital += result.netProceeds;
      deductMarginInterest(position.entryTime, candle.time);
      returns.push(result.returnPercent / 100);
      trackDrawdown(candle.time, i);

      position = null;
      pendingExit = null;
    }

    // === Check for new entry ===
    if (position === null && pendingEntry === null && pendingOrder === null) {
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

        // If using limit/stop order types, create a pending order
        if (useOrderTypes && orderTypeOpt) {
          // Resolve TIF to effective TTL and fill behavior
          const tif = tifOpt ?? "gtc";
          const tifResolved = resolveTimeInForce(tif, orderTTL);
          pendingOrder = {
            orderType: orderTypeOpt,
            direction: dir,
            signalTime: candle.time,
            signalIndex: i,
            entryAtr,
            barsRemaining: tifResolved.ttlBars,
            allowPartialFill: tifResolved.allowPartialFill,
            fillPriceOverride: tifResolved.fillPriceOverride,
          };
        } else if (fillMode === "same-bar-close") {
          const currentSlip = getSlippage(candle, i);
          const entryPrice = applySlippage(candle.close, currentSlip, entrySide);
          const opened = openPositionFromEntry(
            entryPrice, candle.time, entryAtr,
            entryPrice, entryPrice, candle,
          );
          if (opened) {
            position = opened;
          }
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

      // === Margin call check ===
      if (marginConfig && marginState) {
        const positionValue = candle.close * position.shares;
        const entryValue = position.entryPrice * position.shares;
        marginState = updateMarginState(marginState, positionValue, entryValue);
        if (checkMarginCall(marginState, marginConfig.maintenanceMargin)) {
          marginState.isMarginCall = true;
          if (marginConfig.marginCallAction === "liquidate") {
            shouldExit = true;
            exitPrice = candle.close;
            exitReason = "marginCall";
          }
        }
      }

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
        const atrStopPrice = calcAtrStopPrice(
          position.entryPrice,
          currentAtr,
          atrRisk.atrStopMultiplier,
        );
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
        const atrTpPrice = calcAtrTpPrice(
          position.entryPrice,
          currentAtr,
          atrRisk.atrTakeProfitMultiplier,
        );
        const triggered = checkProfitTriggerDirectional(candle, atrTpPrice, slTpMode, dir);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "takeProfit";
        }
      }

      // Partial take profit check
      if (!shouldExit && partialTakeProfit && !position.partialTaken) {
        const partialThresholdPrice = calcTakeProfitPrice(
          position.entryPrice,
          partialTakeProfit.threshold,
        );
        const partialTrigger = checkProfitTriggerDirectional(
          candle,
          partialThresholdPrice,
          slTpMode,
          dir,
        );
        if (partialTrigger) {
          const partialExitPrice = partialTrigger.price;
          const sharesToSell = position.shares * (partialTakeProfit.sellPercent / 100);

          const partialSlip = getSlippage(candle, i);
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
            slippage: partialSlip,
          });

          trades.push(result.trade);
          currentCapital += result.netProceeds;
          returns.push(result.returnPercent / 100);
          trackDrawdown(candle.time, i);

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
          const scaleOutTrigger = checkProfitTriggerDirectional(
            candle,
            scaleOutThresholdPrice,
            slTpMode,
            dir,
          );

          if (scaleOutTrigger) {
            const scaleOutExitPrice = scaleOutTrigger.price;
            const sharesToSell = position.shares * (level.sellPercent / 100);
            const sharesRemaining = position.shares - sharesToSell;

            const scaleOutSlip = getSlippage(candle, i);
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
              slippage: scaleOutSlip,
            });

            trades.push(result.trade);
            currentCapital += result.netProceeds;
            returns.push(result.returnPercent / 100);
            trackDrawdown(candle.time, i);

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
        const breakevenThresholdPrice = calcTakeProfitPrice(
          position.entryPrice,
          breakevenStop.threshold,
        );
        const buffer = breakevenStop.buffer ?? 0;
        const breakevenStopPrice = isShort
          ? position.entryPrice * (1 - buffer / 100)
          : position.entryPrice * (1 + buffer / 100);

        // Activate breakeven if threshold is reached
        if (!position.breakevenActivated) {
          const triggered = checkProfitTriggerDirectional(
            candle,
            breakevenThresholdPrice,
            slTpMode,
            dir,
          );
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
        const atrTrailPrice = calcAtrTrailPrice(
          position,
          currentAtr,
          atrRisk.atrTrailingMultiplier,
        );
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
          const currentSlip = getSlippage(candle, i);
          const result = calculateTradeClose({
            position,
            exitTime: candle.time,
            exitPrice,
            exitReason,
            sharesToClose: position.shares,
            commission,
            commissionRate,
            taxRate,
            slippage: currentSlip,
          });

          trades.push(result.trade);
          currentCapital += result.netProceeds;
          deductMarginInterest(position.entryTime, candle.time);
          returns.push(result.returnPercent / 100);
          trackDrawdown(candle.time, i);

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
    deductMarginInterest(position.entryTime, lastCandle.time);
    returns.push(result.returnPercent / 100);
    ddTracker.update(currentCapital, lastCandle.time, candles.length - 1);
  }

  // Cancel any unfilled pending order at end of data
  pendingOrder = null;

  ddTracker.finalize(candles[candles.length - 1].time, candles.length - 1);

  return calculateStats(
    trades,
    returns,
    capital,
    currentCapital,
    maxDrawdown,
    settings,
    ddTracker.getPeriods(),
  );
}
