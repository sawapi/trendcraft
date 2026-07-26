/**
 * Scaled Entry Backtest Engine
 *
 * Extends the basic backtest engine to support split/scaled entry strategies.
 * Instead of entering a full position at once, the capital is divided into
 * multiple tranches that are entered based on the configured strategy.
 */

import { buildMtfSetup, updateMtfIndices } from "../core/mtf-context";
import { atr } from "../indicators/volatility/atr";
import type {
  BacktestResult,
  BacktestSettings,
  Condition,
  ExitReason,
  FillMode,
  NormalizedCandle,
  ScaledEntryConfig,
  SlTpMode,
  Trade,
} from "../types";
import type { ExtendedCondition } from "./conditions";
import { evaluateCondition, seedBenchmark } from "./conditions";
import type { MtfBacktestOptions } from "./engine";
import { checkProfitTrigger, checkStopTrigger } from "./engine-utils";
import {
  applySlippage,
  calculateStats,
  emptyResult,
  MS_PER_DAY,
  runStandardBacktest,
} from "./scaled-entry-utils";

/**
 * Options the multi-tranche path does not implement.
 *
 * With a single tranche `runBacktestScaled` delegates to `runBacktest`, which
 * implements all of them. The multi-tranche path is a second engine that never
 * grew the same features, and accepting these options silently produced
 * plausible but wrong results: a `direction: "short"` run, for instance,
 * behaved exactly like a long one and reported the inverse P&L as if it were
 * real.
 *
 * Covers the whole option surface `runBacktest` accepts, not just
 * `BacktestOptions`: `fundamentals` and `validateData` reach the single-tranche
 * path through delegation, so leaving them out would mean a run that asked for
 * data validation and never got it.
 *
 * Deliberately enforced at runtime only. Whether an option is honored depends
 * on `scaledEntry.tranches`, which is a value, not a type — omitting these keys
 * from `ScaledBacktestOptions` would also forbid them for the single-tranche
 * calls that do support them.
 */
const UNSUPPORTED_MULTI_TRANCHE_OPTIONS = [
  "direction",
  "atrTrailingStop",
  "breakevenStop",
  "scaleOut",
  "timeExit",
  "slippageModel",
  "orderType",
  "orderTTL",
  "timeInForce",
  "volumeConstraint",
  "margin",
  "sizing",
  "fundamentals",
  "validateData",
] as const satisfies readonly (keyof MtfBacktestOptions)[];

/**
 * Extended backtest options with scaled entry support.
 *
 * Accepts everything `runBacktest` accepts, because a single-tranche run
 * delegates to it and honors all of it. With `scaledEntry.tranches >= 2` the
 * options in `UNSUPPORTED_MULTI_TRANCHE_OPTIONS` are rejected at runtime
 * instead.
 */
export type ScaledBacktestOptions = MtfBacktestOptions & {
  /** Scaled entry configuration */
  scaledEntry?: ScaledEntryConfig;
};

/**
 * Reject options the multi-tranche path would otherwise ignore.
 *
 * Only called once the run is known to take the multi-tranche path: with one
 * tranche the options are handed to `runBacktest`, which honors them.
 */
function assertMultiTrancheOptionsSupported(options: ScaledBacktestOptions): void {
  const provided = UNSUPPORTED_MULTI_TRANCHE_OPTIONS.filter(
    (key) => (options as Record<string, unknown>)[key] !== undefined,
  );

  if (provided.length > 0) {
    throw new Error(
      `runBacktestScaled does not implement ${provided.join(", ")} when scaledEntry.tranches >= 2. ` +
        "The multi-tranche engine would ignore these options and report results as if they had " +
        "been applied. Remove them, or run with a single tranche to use them via runBacktest.",
    );
  }
}

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
  /**
   * Capital available when this position opened. Every tranche of this
   * position is sized from it, so the tranche weights always sum back to the
   * capital actually committed to this trade cycle.
   */
  committedCapital: number;
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
    taxRate,
  };

  // If no scaled entry config, fall back to single entry behavior
  if (!scaledEntry || scaledEntry.tranches <= 1) {
    // Use standard backtest logic
    return runStandardBacktest(candles, entryCondition, exitCondition, options);
  }

  // Past this point the run takes the multi-tranche path, which implements
  // only part of BacktestOptions.
  assertMultiTrancheOptionsSupported(options);

  const { tranches, strategy, intervalType, priceInterval = -2 } = scaledEntry;

  // Extract MTF timeframes and ATR risk options if provided
  const mtfTimeframes = options.mtfTimeframes;
  const atrRisk = options.atrRisk;

  if (candles.length < 2) {
    return emptyResult(capital, settings);
  }

  const trades: Trade[] = [];
  const indicators: Record<string, unknown> = {};

  // Seed benchmark candles so Relative Strength conditions can read them
  seedBenchmark(indicators, options.benchmark);

  // Setup MTF context if timeframes are specified
  const mtfSetup = buildMtfSetup(candles, mtfTimeframes);
  const mtfContext = mtfSetup?.context;
  const mtfIndexMap = mtfSetup?.indexMap;

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

  // Fills queued by next-bar-open mode; they execute at the next bar's open,
  // mirroring the single-entry engine's pendingEntry/pendingExit handling.
  let pendingTranche: { entryAtr: number | null } | null = null;
  let pendingExit: { exitReason: ExitReason } | null = null;

  function openFirstTranche(
    entryPrice: number,
    time: number,
    entryAtr: number | null,
  ): ScaledPosition {
    const trancheCapital = currentCapital * trancheWeights[0];
    const entryCommission = commission + trancheCapital * (commissionRate / 100);
    const shares = (trancheCapital - entryCommission) / entryPrice;

    const opened: ScaledPosition = {
      tranches: [
        {
          time,
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
      committedCapital: currentCapital,
    };

    currentCapital = 0; // All capital (including reserved) is committed
    return opened;
  }

  function addTranche(pos: ScaledPosition, entryPrice: number, time: number): void {
    const trancheIndex = pos.tranches.length;
    const trancheWeight = trancheWeights[trancheIndex];
    // Size from the capital this position committed, not from the backtest's
    // initial capital: once a trade cycle has closed at a profit or a loss the
    // two differ, and weighting against the initial capital either strands
    // reserved capital or overdraws it.
    // The final tranche takes whatever is still reserved so that rounding in
    // the weights (1/3 + 1/3 + 1/3 < 1 in binary floating point) cannot leave
    // a sliver of capital uninvested.
    const trancheCapital =
      trancheIndex === pos.targetTranches - 1
        ? pos.reservedCapital
        : pos.committedCapital * trancheWeight;
    const entryCommission = commission + trancheCapital * (commissionRate / 100);
    const shares = (trancheCapital - entryCommission) / entryPrice;

    pos.tranches.push({
      time,
      price: entryPrice,
      shares,
      capitalUsed: trancheCapital,
    });

    pos.totalShares += shares;
    pos.avgEntryPrice = calculateAvgEntryPrice(pos.tranches);
    pos.reservedCapital -= trancheCapital;
  }

  function trackDrawdown(): void {
    if (currentCapital > peakCapital) {
      peakCapital = currentCapital;
    }
    const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  function closeShares(
    pos: ScaledPosition,
    rawExitPrice: number,
    time: number,
    exitReason: ExitReason,
    sharesToClose: number,
    opts: { withSlippage: boolean; releaseReserved: boolean; partial?: { exitPercent: number } },
  ): void {
    const exitPrice = opts.withSlippage
      ? applySlippage(rawExitPrice, slippage, "sell")
      : rawExitPrice;

    const grossReturn = (exitPrice - pos.avgEntryPrice) * sharesToClose;
    const exitValue = exitPrice * sharesToClose;
    const exitCommission = commission + exitValue * (commissionRate / 100);

    let tax = 0;
    if (grossReturn > 0 && taxRate > 0) {
      tax = grossReturn * (taxRate / 100);
    }

    const netReturn = grossReturn - exitCommission - tax;
    const returnPercent = (netReturn / (pos.avgEntryPrice * sharesToClose)) * 100;
    const holdingDays = Math.round((time - pos.tranches[0].time) / MS_PER_DAY);

    trades.push({
      entryTime: pos.tranches[0].time,
      entryPrice: pos.avgEntryPrice,
      exitTime: time,
      exitPrice,
      return: netReturn,
      returnPercent,
      holdingDays,
      ...(opts.partial ? { isPartial: true, exitPercent: opts.partial.exitPercent } : {}),
      exitReason,
    });

    // Add back any reserved capital that wasn't used (full closes only)
    currentCapital +=
      exitValue - exitCommission - tax + (opts.releaseReserved ? pos.reservedCapital : 0);
    returns.push(returnPercent / 100);
    trackDrawdown();
  }

  function closeFullPosition(
    pos: ScaledPosition,
    rawExitPrice: number,
    time: number,
    exitReason: ExitReason,
    withSlippage: boolean,
  ): void {
    closeShares(pos, rawExitPrice, time, exitReason, pos.totalShares, {
      withSlippage,
      releaseReserved: true,
    });
  }

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];

    // Update MTF indices for this candle
    if (mtfContext && mtfIndexMap) {
      updateMtfIndices(mtfContext, mtfIndexMap, i, candle.time);
    }

    // === Fill pending exit (next-bar-open mode) at this bar's open ===
    if (pendingExit !== null) {
      if (position !== null) {
        closeFullPosition(position, candle.open, candle.time, pendingExit.exitReason, true);
        position = null;
      }
      pendingExit = null;
    }

    // === Fill pending tranche (next-bar-open mode) at this bar's open ===
    // An open fill owns the whole bar, so management below runs normally.
    if (pendingTranche !== null) {
      const fillPrice = applySlippage(candle.open, slippage, "buy");
      if (position === null) {
        position = openFirstTranche(fillPrice, candle.time, pendingTranche.entryAtr);
      } else {
        addTranche(position, fillPrice, candle.time);
      }
      pendingTranche = null;
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
        const entryAtr = atrSeries ? atrSeries[i].value : null;

        if (fillMode === "same-bar-close") {
          // Close fill: position management starts on the next bar
          position = openFirstTranche(
            applySlippage(candle.close, slippage, "buy"),
            candle.time,
            entryAtr,
          );
        } else {
          // next-bar-open mode: queue the first tranche for the next bar
          pendingTranche = { entryAtr };
        }
      }
    } else {
      // === Position management ===

      // Fold this bar into the peak before trigger checks (mirrors the
      // single-entry engine's ordering)
      if (candle.high > position.peakPrice) {
        position.peakPrice = candle.high;
      }

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

      // Stop loss check (using average entry price)
      if (stopLoss !== undefined) {
        const stopLossPrice = position.avgEntryPrice * (1 - stopLoss / 100);
        const triggered = checkStopTrigger(candle, stopLossPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "stopLoss";
        }
      }

      // ATR-based stop loss
      if (!shouldExit && currentAtr !== null && atrRisk?.atrStopMultiplier !== undefined) {
        const atrStopPrice = position.avgEntryPrice - currentAtr * atrRisk.atrStopMultiplier;
        const triggered = checkStopTrigger(candle, atrStopPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "stopLoss";
        }
      }

      // Take profit check
      if (!shouldExit && takeProfit !== undefined) {
        const takeProfitPrice = position.avgEntryPrice * (1 + takeProfit / 100);
        const triggered = checkProfitTrigger(candle, takeProfitPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "takeProfit";
        }
      }

      // ATR-based take profit
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTakeProfitMultiplier !== undefined) {
        const atrTpPrice = position.avgEntryPrice + currentAtr * atrRisk.atrTakeProfitMultiplier;
        const triggered = checkProfitTrigger(candle, atrTpPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "takeProfit";
        }
      }

      // Partial take profit (on entire scaled position; executes immediately
      // at the trigger price, mirroring the single-entry engine)
      if (!shouldExit && partialTakeProfit && !position.partialTaken) {
        const partialThresholdPrice =
          position.avgEntryPrice * (1 + partialTakeProfit.threshold / 100);
        const partialTrigger = checkProfitTrigger(candle, partialThresholdPrice, slTpMode);
        if (partialTrigger) {
          const sellFraction = partialTakeProfit.sellPercent / 100;
          const sharesToSell = position.totalShares * sellFraction;
          closeShares(
            position,
            partialTrigger.price,
            candle.time,
            "partialTakeProfit",
            sharesToSell,
            {
              withSlippage: true,
              releaseReserved: false,
              partial: { exitPercent: partialTakeProfit.sellPercent },
            },
          );

          // Scale every tranche by the sold fraction so per-tranche shares
          // stay in sync with totalShares. Selling at market does not change
          // the remaining shares' average cost, and a later addTranche()
          // recomputes the average from tranches — leaving the sold shares
          // in place would weight the old cost basis as if nothing was sold.
          for (const tranche of position.tranches) {
            tranche.shares *= 1 - sellFraction;
          }
          position.totalShares -= sharesToSell;
          position.partialTaken = true;
        }
      }

      // Trailing stop check
      if (!shouldExit && trailingStop !== undefined) {
        const trailingStopPrice = position.peakPrice * (1 - trailingStop / 100);
        const triggered = checkStopTrigger(candle, trailingStopPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "trailing";
        }
      }

      // ATR-based trailing stop
      if (!shouldExit && currentAtr !== null && atrRisk?.atrTrailingMultiplier !== undefined) {
        const atrTrailPrice = position.peakPrice - currentAtr * atrRisk.atrTrailingMultiplier;
        const triggered = checkStopTrigger(candle, atrTrailPrice, slTpMode);
        if (triggered) {
          shouldExit = true;
          exitPrice = triggered.price;
          exitReason = "trailing";
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

      if (shouldExit) {
        if (fillMode === "same-bar-close") {
          closeFullPosition(position, exitPrice, candle.time, exitReason, true);
          position = null;
        } else {
          // next-bar-open mode: queue exit; it fills at the next bar's open
          pendingExit = { exitReason };
        }
      } else if (
        pendingTranche === null &&
        position.tranches.length < position.targetTranches &&
        position.reservedCapital > 0
      ) {
        // === Additional tranche check ===
        // Runs after the exit checks: this bar's SL/TP/trailing ran against
        // the pre-tranche position, so a same-bar-close tranche fill cannot
        // be exited by price action from before the fill (the new average
        // entry applies from the next bar). A bar that exits does not also
        // add a tranche.
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
          if (fillMode === "same-bar-close") {
            addTranche(position, applySlippage(candle.close, slippage, "buy"), candle.time);
          } else {
            // next-bar-open mode: queue the tranche for the next bar's open
            pendingTranche = { entryAtr: null };
          }
        }
      }
    }
  }

  // Close any open position at the end (no slippage, matching the
  // single-entry engine's end-of-data close). A queued next-bar-open exit
  // that never got its fill bar also ends here as endOfData.
  if (position !== null) {
    const lastCandle = candles[candles.length - 1];
    closeFullPosition(position, lastCandle.close, lastCandle.time, "endOfData", false);
  }

  return calculateStats(
    trades,
    returns,
    capital,
    currentCapital,
    maxDrawdown,
    settings,
    [],
    candles.length >= 2
      ? { firstTime: candles[0].time, lastTime: candles[candles.length - 1].time }
      : undefined,
  );
}
