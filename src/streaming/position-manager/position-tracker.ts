/**
 * PositionTracker — Stateful position and account management
 *
 * Tracks a single open position with SL/TP/trailing stop detection,
 * calculates P&L using backtest engine utilities, and manages account state.
 * Supports both long and short positions.
 *
 * @example
 * ```ts
 * const tracker = createPositionTracker({ capital: 1_000_000, stopLoss: 2, takeProfit: 6 });
 *
 * tracker.openPosition(100, 50, Date.now());
 * const { position, triggered } = tracker.updatePrice(candle);
 * if (triggered) {
 *   console.log(`SL/TP hit: ${triggered.reason} @ ${triggered.price}`);
 * }
 * ```
 */

import { applySlippage, calculateTradeClose } from "../../backtest/engine-utils";
import type {
  BreakevenStopConfig,
  ExitReason,
  NormalizedCandle,
  PartialTakeProfitConfig,
  PositionDirection,
  Trade,
} from "../../types";
import type {
  ClosedTradeResult,
  FillRecord,
  ManagedPosition,
  OpenPositionOptions,
  PartialFillResult,
  PositionTracker,
  PositionTrackerOptions,
  PositionTrackerState,
  UpdatePriceResult,
} from "./types";

/**
 * Map fill reason to ExitReason for trade records
 */
function toExitReason(reason: FillRecord["reason"]): ExitReason {
  switch (reason) {
    case "stop-loss":
      return "stopLoss";
    case "take-profit":
      return "takeProfit";
    case "trailing-stop":
      return "trailing";
    case "partial-take-profit":
      return "partialTakeProfit";
    case "breakeven":
      return "breakeven";
    case "exit-signal":
      return "signal";
    case "force-close":
      return "endOfData";
    case "manual":
      return "signal";
    default:
      return "signal";
  }
}

/**
 * Create a new PositionTracker instance
 *
 * @param options - Tracker configuration (capital, SL/TP, fees, direction)
 * @param fromState - Optional saved state to restore from
 * @returns A PositionTracker instance
 *
 * @example
 * ```ts
 * // Long position tracker
 * const tracker = createPositionTracker({
 *   capital: 1_000_000,
 *   stopLoss: 2,
 *   takeProfit: 6,
 *   trailingStop: 3,
 * });
 *
 * // Short position tracker
 * const shortTracker = createPositionTracker({
 *   capital: 1_000_000,
 *   direction: 'short',
 *   stopLoss: 2,
 *   takeProfit: 4,
 * });
 * ```
 */
export function createPositionTracker(
  options: PositionTrackerOptions,
  fromState?: PositionTrackerState,
): PositionTracker {
  const direction: PositionDirection = options.direction ?? "long";
  const isShort = direction === "short";
  const exitSide: "buy" | "sell" = isShort ? "buy" : "sell";
  const directionSign = isShort ? -1 : 1;
  const stopLossPercent = options.stopLoss ?? 0;
  const takeProfitPercent = options.takeProfit ?? 0;
  const trailingStopPercent = options.trailingStop ?? 0;
  const commission = options.commission ?? 0;
  const commissionRate = options.commissionRate ?? 0;
  const taxRate = options.taxRate ?? 0;
  const slippage = options.slippage ?? 0;
  const maxTradeHistory = options.maxTradeHistory ?? 1000;
  const partialTakeProfit: PartialTakeProfitConfig | undefined = options.partialTakeProfit;
  const breakevenStop: BreakevenStopConfig | undefined = options.breakevenStop;

  // Mutable state
  let position: ManagedPosition | null = fromState?.position ?? null;
  const account = fromState?.account ?? {
    initialCapital: options.capital,
    currentCapital: options.capital,
    unrealizedPnl: 0,
    equity: options.capital,
    peakEquity: options.capital,
    maxDrawdownPercent: 0,
    totalRealizedPnl: 0,
  };
  let trades: Trade[] = fromState?.trades ? [...fromState.trades] : [];
  let positionCounter = fromState?.positionCounter ?? 0;

  /**
   * Compute a price level offset from a base price by a percentage.
   * Positive sign = favorable direction (TP), negative sign = adverse direction (SL).
   *
   * Long  favorable: base * (1 + pct/100)   — price rises
   * Short favorable: base * (1 - pct/100)   — price falls
   */
  function favorablePrice(base: number, pct: number): number {
    return base * (1 + (directionSign * pct) / 100);
  }

  function adversePrice(base: number, pct: number): number {
    return base * (1 - (directionSign * pct) / 100);
  }

  /**
   * Check if price has reached a favorable target (long: price >= target, short: price <= target)
   */
  function hitFavorable(candle: NormalizedCandle, target: number): boolean {
    return isShort ? candle.low <= target : candle.high >= target;
  }

  /**
   * Check if price has reached an adverse target (long: price <= target, short: price >= target)
   */
  function hitAdverse(candle: NormalizedCandle, target: number): boolean {
    return isShort ? candle.high >= target : candle.low <= target;
  }

  /**
   * Calculate SL/TP price levels from entry price and percentages
   */
  function calculateLevels(entryPrice: number): {
    stopLossPrice: number | null;
    takeProfitPrice: number | null;
  } {
    const stopLossPrice = stopLossPercent > 0 ? adversePrice(entryPrice, stopLossPercent) : null;
    const takeProfitPrice =
      takeProfitPercent > 0 ? favorablePrice(entryPrice, takeProfitPercent) : null;
    return { stopLossPrice, takeProfitPrice };
  }

  /**
   * Update unrealized P&L and equity from current price
   */
  function updateUnrealized(currentPrice: number): void {
    if (!position) {
      account.unrealizedPnl = 0;
      account.equity = account.currentCapital;
    } else {
      account.unrealizedPnl =
        directionSign * (currentPrice - position.entryPrice) * position.shares;
      // Equity = cash + position market value
      account.equity = account.currentCapital + currentPrice * position.shares;
    }

    // Track peak equity and drawdown
    if (account.equity > account.peakEquity) {
      account.peakEquity = account.equity;
    }
    if (account.peakEquity > 0) {
      const drawdown = ((account.peakEquity - account.equity) / account.peakEquity) * 100;
      if (drawdown > account.maxDrawdownPercent) {
        account.maxDrawdownPercent = drawdown;
      }
    }
  }

  /**
   * Build the position snapshot object needed by calculateTradeClose
   */
  function positionSnapshot(pos: ManagedPosition) {
    return {
      entryTime: pos.entryTime,
      entryPrice: pos.entryPrice,
      peakPrice: pos.peakPrice,
      troughPrice: pos.troughPrice,
      direction,
      shares: pos.shares,
      originalShares: pos.originalShares,
      partialTaken: pos.partialTaken,
      breakevenActivated: pos.breakevenActivated,
      scaleOutLevelsTaken: [] as number[],
      entryAtr: null,
      maxProfitPercent: pos.maxProfitPercent,
      maxLossPercent: pos.maxLossPercent,
    };
  }

  /**
   * Record a trade result: update account and append to trade history
   */
  function recordTrade(netProceeds: number, trade: Trade): void {
    account.currentCapital += netProceeds;
    account.totalRealizedPnl += trade.return;
    trades.push(trade);
    if (trades.length > maxTradeHistory) {
      trades = trades.slice(trades.length - maxTradeHistory);
    }
  }

  /**
   * Execute a position close using engine-utils
   */
  function executeClose(
    price: number,
    time: number,
    reason: FillRecord["reason"],
  ): ClosedTradeResult {
    if (!position) {
      throw new Error("No open position to close");
    }

    const result = calculateTradeClose({
      position: positionSnapshot(position),
      exitTime: time,
      exitPrice: price,
      exitReason: toExitReason(reason),
      sharesToClose: position.shares,
      commission,
      commissionRate,
      taxRate,
      slippage,
    });

    const fill: FillRecord = {
      time,
      price: result.trade.exitPrice,
      shares: position.shares,
      side: exitSide,
      reason,
    };

    recordTrade(result.netProceeds, result.trade);
    position = null;
    updateUnrealized(0);

    return { trade: result.trade, fill };
  }

  /**
   * Execute a partial position close (for partial take profit)
   */
  function executePartialClose(
    exitPrice: number,
    time: number,
    sellPercent: number,
  ): PartialFillResult {
    if (!position) {
      throw new Error("No open position for partial close");
    }

    const sharesToSell = position.shares * (sellPercent / 100);

    const result = calculateTradeClose({
      position: positionSnapshot(position),
      exitTime: time,
      exitPrice,
      exitReason: "partialTakeProfit",
      sharesToClose: sharesToSell,
      isPartial: true,
      exitPercent: sellPercent,
      commission,
      commissionRate,
      taxRate,
      slippage,
    });

    const fill: FillRecord = {
      time,
      price: result.trade.exitPrice,
      shares: sharesToSell,
      side: exitSide,
      reason: "partial-take-profit",
    };

    position.shares -= sharesToSell;
    position.partialTaken = true;
    recordTrade(result.netProceeds, result.trade);

    return { fill, trade: result.trade };
  }

  return {
    openPosition(
      price: number,
      shares: number,
      time: number,
      opts?: OpenPositionOptions,
    ): ManagedPosition {
      if (position) {
        throw new Error("Cannot open position: already holding a position");
      }
      if (shares <= 0) {
        throw new Error("Cannot open position: shares must be positive");
      }

      positionCounter++;
      const entrySide: "buy" | "sell" = isShort ? "sell" : "buy";
      const entryPrice = applySlippage(price, slippage, entrySide);
      const positionValue = entryPrice * shares;

      // Deduct from available capital
      const entryCost = commission + positionValue * (commissionRate / 100);
      account.currentCapital -= positionValue + entryCost;

      const levels = calculateLevels(entryPrice);

      position = {
        id: `pos-${positionCounter}`,
        entryTime: time,
        entryPrice,
        shares,
        originalShares: shares,
        direction,
        stopLossPrice:
          opts?.stopLossPrice !== undefined ? opts.stopLossPrice : levels.stopLossPrice,
        takeProfitPrice:
          opts?.takeProfitPrice !== undefined ? opts.takeProfitPrice : levels.takeProfitPrice,
        peakPrice: entryPrice,
        troughPrice: entryPrice,
        maxProfitPercent: 0,
        maxLossPercent: 0,
        partialTaken: false,
        breakevenActivated: false,
      };

      updateUnrealized(entryPrice);

      return { ...position };
    },

    updatePrice(candle: NormalizedCandle): UpdatePriceResult {
      if (!position) {
        return {
          position: null as unknown as ManagedPosition,
          triggered: null,
          partialFills: [],
        };
      }

      const partialFills: PartialFillResult[] = [];

      // Update peak and trough prices
      if (candle.high > position.peakPrice) {
        position.peakPrice = candle.high;
      }
      if (candle.low < position.troughPrice) {
        position.troughPrice = candle.low;
      }

      // Update MFE/MAE: favorable = high for long, low for short
      const bestPrice = isShort ? candle.low : candle.high;
      const worstPrice = isShort ? candle.high : candle.low;
      const profitPercent =
        (directionSign * (bestPrice - position.entryPrice) * 100) / position.entryPrice;
      const lossPercent =
        (directionSign * (position.entryPrice - worstPrice) * 100) / position.entryPrice;
      if (profitPercent > position.maxProfitPercent) {
        position.maxProfitPercent = profitPercent;
      }
      if (lossPercent > 0 && lossPercent > position.maxLossPercent) {
        position.maxLossPercent = lossPercent;
      }

      /** Helper to build a closed-position result */
      function closedResult(fill: FillRecord): UpdatePriceResult {
        return {
          position: null as unknown as ManagedPosition,
          triggered: fill,
          partialFills,
        };
      }

      // Check stop loss (adverse price hit)
      if (position.stopLossPrice !== null && hitAdverse(candle, position.stopLossPrice)) {
        const result = executeClose(position.stopLossPrice, candle.time, "stop-loss");
        return closedResult(result.fill);
      }

      // Check take profit (favorable price hit)
      if (position.takeProfitPrice !== null && hitFavorable(candle, position.takeProfitPrice)) {
        const result = executeClose(position.takeProfitPrice, candle.time, "take-profit");
        return closedResult(result.fill);
      }

      // Partial take profit check
      if (partialTakeProfit && !position.partialTaken) {
        const thresholdPrice = favorablePrice(position.entryPrice, partialTakeProfit.threshold);
        if (hitFavorable(candle, thresholdPrice)) {
          partialFills.push(
            executePartialClose(thresholdPrice, candle.time, partialTakeProfit.sellPercent),
          );
        }
      }

      // Breakeven stop check
      if (breakevenStop && position) {
        const beThresholdPrice = favorablePrice(position.entryPrice, breakevenStop.threshold);
        const beStopPrice = favorablePrice(position.entryPrice, breakevenStop.buffer ?? 0);

        if (!position.breakevenActivated && hitFavorable(candle, beThresholdPrice)) {
          position.breakevenActivated = true;
        }

        if (position.breakevenActivated && hitAdverse(candle, beStopPrice)) {
          const result = executeClose(beStopPrice, candle.time, "breakeven");
          return closedResult(result.fill);
        }
      }

      // Check trailing stop
      if (trailingStopPercent > 0 && position) {
        const anchor = isShort ? position.troughPrice : position.peakPrice;
        const trailingStopPrice = adversePrice(anchor, trailingStopPercent);
        if (hitAdverse(candle, trailingStopPrice)) {
          const result = executeClose(trailingStopPrice, candle.time, "trailing-stop");
          return closedResult(result.fill);
        }
      }

      // No trigger — update unrealized
      updateUnrealized(candle.close);

      return { position: { ...position }, triggered: null, partialFills };
    },

    closePosition(price: number, time: number, reason: FillRecord["reason"]): ClosedTradeResult {
      if (!position) {
        throw new Error("No open position to close");
      }
      return executeClose(price, time, reason);
    },

    getPosition(): ManagedPosition | null {
      return position ? { ...position } : null;
    },

    getAccount() {
      return { ...account };
    },

    getTrades() {
      return [...trades];
    },

    updateStopLoss(price: number): void {
      if (position) {
        position.stopLossPrice = price;
      }
    },

    updateTakeProfit(price: number): void {
      if (position) {
        position.takeProfitPrice = price;
      }
    },

    getState(): PositionTrackerState {
      return {
        position: position ? { ...position } : null,
        account: { ...account },
        trades: [...trades],
        positionCounter,
      };
    },
  };
}
