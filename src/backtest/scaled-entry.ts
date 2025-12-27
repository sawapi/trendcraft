/**
 * Scaled Entry Backtest Engine
 *
 * Extends the basic backtest engine to support split/scaled entry strategies.
 * Instead of entering a full position at once, the capital is divided into
 * multiple tranches that are entered based on the configured strategy.
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
  ScaledEntryConfig,
  SlTpMode,
  TimeframeShorthand,
  Trade,
} from "../types";
import { evaluateCondition } from "./conditions";
import type { ExtendedCondition } from "./conditions";
import { runBacktest } from "./engine";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Extended backtest options with scaled entry support
 */
export type ScaledBacktestOptions = BacktestOptions & {
  /** Timeframes to include for MTF conditions */
  mtfTimeframes?: TimeframeShorthand[];
  /** ATR-based risk management options */
  atrRisk?: AtrRiskOptions;
  /** Scaled entry configuration */
  scaledEntry?: ScaledEntryConfig;
};

/**
 * Single entry tranche record
 */
type EntryTranche = {
  time: number;
  price: number;
  shares: number;
  capitalUsed: number;
};

/**
 * Scaled position tracking
 */
type ScaledPosition = {
  /** All entry tranches */
  tranches: EntryTranche[];
  /** Target number of tranches */
  targetTranches: number;
  /** First entry price (for price-based interval) */
  firstEntryPrice: number;
  /** Weighted average entry price */
  avgEntryPrice: number;
  /** Total shares held */
  totalShares: number;
  /** Peak price (for trailing stop) */
  peakPrice: number;
  /** Whether partial take profit has been taken */
  partialTaken: boolean;
  /** Entry ATR for fixed stop calculation */
  entryAtr: number | null;
  /** Capital reserved for remaining tranches */
  reservedCapital: number;
};

/**
 * Calculate tranche weights based on strategy
 */
function calculateTrancheWeights(
  tranches: number,
  strategy: ScaledEntryConfig["strategy"],
): number[] {
  const weights: number[] = [];

  switch (strategy) {
    case "equal":
      // Equal weight for each tranche
      for (let i = 0; i < tranches; i++) {
        weights.push(1 / tranches);
      }
      break;

    case "pyramid":
      // Larger weight for earlier tranches (decreasing)
      // e.g., 3 tranches: 50%, 33%, 17%
      {
        const total = (tranches * (tranches + 1)) / 2;
        for (let i = 0; i < tranches; i++) {
          weights.push((tranches - i) / total);
        }
      }
      break;

    case "reverse-pyramid":
      // Larger weight for later tranches (increasing)
      // e.g., 3 tranches: 17%, 33%, 50%
      {
        const total = (tranches * (tranches + 1)) / 2;
        for (let i = 0; i < tranches; i++) {
          weights.push((i + 1) / total);
        }
      }
      break;
  }

  return weights;
}

/**
 * Calculate weighted average entry price
 */
function calculateAvgEntryPrice(tranches: EntryTranche[]): number {
  if (tranches.length === 0) return 0;

  const totalValue = tranches.reduce((sum, t) => sum + t.price * t.shares, 0);
  const totalShares = tranches.reduce((sum, t) => sum + t.shares, 0);

  return totalShares > 0 ? totalValue / totalShares : 0;
}

/**
 * Run backtest with scaled entry support
 */
export function runBacktestScaled(
  candles: NormalizedCandle[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: ScaledBacktestOptions,
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
    scaledEntry,
    fillMode = "next-bar-open" as FillMode,
    slTpMode = "close-only" as SlTpMode,
  } = options;

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

  // If no scaled entry config, fall back to single entry behavior
  if (!scaledEntry || scaledEntry.tranches <= 1) {
    // Use standard backtest logic
    return runStandardBacktest(candles, entryCondition, exitCondition, options);
  }

  const { tranches, strategy, intervalType, priceInterval = -2 } = scaledEntry;

  // Extract MTF timeframes and ATR risk options if provided
  const mtfTimeframes = options.mtfTimeframes;
  const atrRisk = options.atrRisk;

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

  // Pre-calculate ATR if ATR risk management is enabled
  let atrSeries: { time: number; value: number | null }[] | null = null;
  if (atrRisk) {
    const atrPeriod = atrRisk.atrPeriod ?? 14;
    atrSeries = atr(candles, { period: atrPeriod });
  }

  // Calculate tranche weights
  const trancheWeights = calculateTrancheWeights(tranches, strategy);

  let position: ScaledPosition | null = null;
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

    if (position === null) {
      // Check entry condition for first tranche
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
        const entryPrice = applySlippage(candle.close, slippage, "buy");

        // Calculate capital allocation for first tranche
        const trancheCapital = currentCapital * trancheWeights[0];
        const entryCommission = commission + trancheCapital * (commissionRate / 100);
        const shares = (trancheCapital - entryCommission) / entryPrice;

        const entryAtr = atrSeries ? atrSeries[i].value : null;

        position = {
          tranches: [
            {
              time: candle.time,
              price: entryPrice,
              shares,
              capitalUsed: trancheCapital,
            },
          ],
          targetTranches: tranches,
          firstEntryPrice: entryPrice,
          avgEntryPrice: entryPrice,
          totalShares: shares,
          peakPrice: entryPrice,
          partialTaken: false,
          entryAtr,
          reservedCapital: currentCapital - trancheCapital,
        };

        currentCapital = 0; // All capital (including reserved) is committed
      }
    } else {
      // Position exists - check for additional entries or exit

      // Update peak price for trailing stop
      if (candle.high > position.peakPrice) {
        position.peakPrice = candle.high;
      }

      let shouldExit = false;
      let exitPrice = candle.close;

      // Check for additional entry tranches
      if (position.tranches.length < position.targetTranches && position.reservedCapital > 0) {
        let shouldAddTranche = false;

        if (intervalType === "signal") {
          // Add on each signal
          shouldAddTranche = evaluateCondition(
            entryCondition as ExtendedCondition,
            indicators,
            candle,
            i,
            candles,
            mtfContext,
          );
        } else {
          // Price-based: add when price drops by priceInterval %
          const currentTrancheIndex = position.tranches.length;
          const targetPrice =
            position.firstEntryPrice * (1 + (priceInterval / 100) * currentTrancheIndex);
          shouldAddTranche = candle.close <= targetPrice;
        }

        if (shouldAddTranche) {
          const trancheIndex = position.tranches.length;
          const trancheWeight = trancheWeights[trancheIndex];
          const trancheCapital = capital * trancheWeight;
          const entryPrice = applySlippage(candle.close, slippage, "buy");
          const entryCommission = commission + trancheCapital * (commissionRate / 100);
          const shares = (trancheCapital - entryCommission) / entryPrice;

          position.tranches.push({
            time: candle.time,
            price: entryPrice,
            shares,
            capitalUsed: trancheCapital,
          });

          position.totalShares += shares;
          position.avgEntryPrice = calculateAvgEntryPrice(position.tranches);
          position.reservedCapital -= trancheCapital;
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

      // Stop loss check (using average entry price)
      if (stopLoss !== undefined) {
        const stopLossPrice = position.avgEntryPrice * (1 - stopLoss / 100);
        if (candle.low <= stopLossPrice) {
          shouldExit = true;
          exitPrice = stopLossPrice;
        }
      }

      // ATR-based stop loss
      if (!shouldExit && currentAtr !== null && atrRisk?.atrStopMultiplier !== undefined) {
        const atrStopDistance = currentAtr * atrRisk.atrStopMultiplier;
        const atrStopPrice = position.avgEntryPrice - atrStopDistance;
        if (candle.low <= atrStopPrice) {
          shouldExit = true;
          exitPrice = atrStopPrice;
        }
      }

      // Take profit check
      if (!shouldExit && takeProfit !== undefined) {
        const takeProfitPrice = position.avgEntryPrice * (1 + takeProfit / 100);
        if (candle.high >= takeProfitPrice) {
          shouldExit = true;
          exitPrice = takeProfitPrice;
        }
      }

      // ATR-based take profit
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTakeProfitMultiplier !== undefined) {
        const atrTpDistance = currentAtr * atrRisk.atrTakeProfitMultiplier;
        const atrTpPrice = position.avgEntryPrice + atrTpDistance;
        if (candle.high >= atrTpPrice) {
          shouldExit = true;
          exitPrice = atrTpPrice;
        }
      }

      // Partial take profit (on entire scaled position)
      if (!shouldExit && partialTakeProfit && !position.partialTaken) {
        const partialThresholdPrice =
          position.avgEntryPrice * (1 + partialTakeProfit.threshold / 100);
        if (candle.high >= partialThresholdPrice) {
          const partialExitPrice = applySlippage(partialThresholdPrice, slippage, "sell");
          const sharesToSell = position.totalShares * (partialTakeProfit.sellPercent / 100);
          const sharesRemaining = position.totalShares - sharesToSell;

          const grossReturn = (partialExitPrice - position.avgEntryPrice) * sharesToSell;
          const exitValue = partialExitPrice * sharesToSell;
          const exitCommission = commission + exitValue * (commissionRate / 100);

          let tax = 0;
          if (grossReturn > 0 && taxRate > 0) {
            tax = grossReturn * (taxRate / 100);
          }

          const netReturn = grossReturn - exitCommission - tax;
          const returnPercent = (netReturn / (position.avgEntryPrice * sharesToSell)) * 100;
          const holdingDays = Math.round((candle.time - position.tranches[0].time) / MS_PER_DAY);

          trades.push({
            entryTime: position.tranches[0].time,
            entryPrice: position.avgEntryPrice,
            exitTime: candle.time,
            exitPrice: partialExitPrice,
            return: netReturn,
            returnPercent,
            holdingDays,
            isPartial: true,
            exitPercent: partialTakeProfit.sellPercent,
          });

          currentCapital += exitValue - exitCommission - tax;
          returns.push(returnPercent / 100);

          if (currentCapital > peakCapital) {
            peakCapital = currentCapital;
          }
          const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }

          position.totalShares = sharesRemaining;
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

      // ATR-based trailing stop
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTrailingMultiplier !== undefined) {
        const atrTrailDistance = currentAtr * atrRisk.atrTrailingMultiplier;
        const atrTrailPrice = position.peakPrice - atrTrailDistance;
        if (candle.low <= atrTrailPrice) {
          shouldExit = true;
          exitPrice = atrTrailPrice;
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

      if (shouldExit) {
        exitPrice = applySlippage(exitPrice, slippage, "sell");

        const grossReturn = (exitPrice - position.avgEntryPrice) * position.totalShares;
        const exitValue = exitPrice * position.totalShares;
        const exitCommission = commission + exitValue * (commissionRate / 100);

        let tax = 0;
        if (grossReturn > 0 && taxRate > 0) {
          tax = grossReturn * (taxRate / 100);
        }

        const netReturn = grossReturn - exitCommission - tax;
        const returnPercent = (netReturn / (position.avgEntryPrice * position.totalShares)) * 100;
        const holdingDays = Math.round((candle.time - position.tranches[0].time) / MS_PER_DAY);

        trades.push({
          entryTime: position.tranches[0].time,
          entryPrice: position.avgEntryPrice,
          exitTime: candle.time,
          exitPrice,
          return: netReturn,
          returnPercent,
          holdingDays,
        });

        // Add back any reserved capital that wasn't used
        currentCapital += exitValue - exitCommission - tax + position.reservedCapital;
        returns.push(returnPercent / 100);

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

    const grossReturn = (exitPrice - position.avgEntryPrice) * position.totalShares;
    const exitValue = exitPrice * position.totalShares;
    const exitCommission = commission + exitValue * (commissionRate / 100);

    let tax = 0;
    if (grossReturn > 0 && taxRate > 0) {
      tax = grossReturn * (taxRate / 100);
    }

    const netReturn = grossReturn - exitCommission - tax;
    const returnPercent = (netReturn / (position.avgEntryPrice * position.totalShares)) * 100;
    const holdingDays = Math.round((lastCandle.time - position.tranches[0].time) / MS_PER_DAY);

    trades.push({
      entryTime: position.tranches[0].time,
      entryPrice: position.avgEntryPrice,
      exitTime: lastCandle.time,
      exitPrice,
      return: netReturn,
      returnPercent,
      holdingDays,
    });

    currentCapital += exitValue - exitCommission - tax + position.reservedCapital;
    returns.push(returnPercent / 100);
  }

  return calculateStats(trades, returns, capital, currentCapital, maxDrawdown, settings);
}

/**
 * Standard (non-scaled) backtest - delegates to main engine
 */
function runStandardBacktest(
  candles: NormalizedCandle[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: ScaledBacktestOptions,
): BacktestResult {
  return runBacktest(candles, entryCondition, exitCondition, options);
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
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999.99 : 0;

  const avgHoldingDays = trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length;

  // Calculate Sharpe Ratio
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length,
  );
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
