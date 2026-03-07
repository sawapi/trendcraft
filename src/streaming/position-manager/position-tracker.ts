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

import type { NormalizedCandle, PositionDirection, Trade } from "../../types";
import {
  applySlippage,
  calculateTradeClose,
} from "../../backtest/engine-utils";
import type {
  ClosedTradeResult,
  FillRecord,
  ManagedPosition,
  OpenPositionOptions,
  PositionTracker,
  PositionTrackerOptions,
  PositionTrackerState,
  UpdatePriceResult,
} from "./types";

/**
 * Map fill reason to ExitReason for trade records
 */
function toExitReason(reason: FillRecord["reason"]): Trade["exitReason"] {
  switch (reason) {
    case "stop-loss":
      return "stopLoss";
    case "take-profit":
      return "takeProfit";
    case "trailing-stop":
      return "trailing";
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
  const stopLossPercent = options.stopLoss ?? 0;
  const takeProfitPercent = options.takeProfit ?? 0;
  const trailingStopPercent = options.trailingStop ?? 0;
  const commission = options.commission ?? 0;
  const commissionRate = options.commissionRate ?? 0;
  const taxRate = options.taxRate ?? 0;
  const slippage = options.slippage ?? 0;
  const maxTradeHistory = options.maxTradeHistory ?? 1000;

  // Mutable state
  let position: ManagedPosition | null = fromState?.position ?? null;
  let account = fromState?.account ?? {
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
   * Calculate SL/TP price levels from entry price and percentages
   */
  function calculateLevels(entryPrice: number): {
    stopLossPrice: number | null;
    takeProfitPrice: number | null;
  } {
    let stopLossPrice: number | null = null;
    let takeProfitPrice: number | null = null;

    if (stopLossPercent > 0) {
      stopLossPrice = isShort
        ? entryPrice * (1 + stopLossPercent / 100)
        : entryPrice * (1 - stopLossPercent / 100);
    }
    if (takeProfitPercent > 0) {
      takeProfitPrice = isShort
        ? entryPrice * (1 - takeProfitPercent / 100)
        : entryPrice * (1 + takeProfitPercent / 100);
    }

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
      const priceDiff = isShort
        ? (position.entryPrice - currentPrice) * position.shares
        : (currentPrice - position.entryPrice) * position.shares;
      account.unrealizedPnl = priceDiff;
      // Equity = cash + position market value
      account.equity =
        account.currentCapital + currentPrice * position.shares;
    }

    // Track peak equity and drawdown
    if (account.equity > account.peakEquity) {
      account.peakEquity = account.equity;
    }
    if (account.peakEquity > 0) {
      const drawdown =
        ((account.peakEquity - account.equity) / account.peakEquity) * 100;
      if (drawdown > account.maxDrawdownPercent) {
        account.maxDrawdownPercent = drawdown;
      }
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

    const exitReason = toExitReason(reason);
    const exitSide = isShort ? "buy" : "sell";
    const result = calculateTradeClose({
      position: {
        entryTime: position.entryTime,
        entryPrice: position.entryPrice,
        peakPrice: position.peakPrice,
        troughPrice: position.troughPrice,
        direction,
        shares: position.shares,
        originalShares: position.originalShares,
        partialTaken: false,
        breakevenActivated: false,
        scaleOutLevelsTaken: [],
        entryAtr: null,
        maxProfitPercent: position.maxProfitPercent,
        maxLossPercent: position.maxLossPercent,
      },
      exitTime: time,
      exitPrice: price,
      exitReason: exitReason!,
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

    // Update account
    account.currentCapital += result.netProceeds;
    account.totalRealizedPnl += result.trade.return;

    // Clear position
    position = null;
    updateUnrealized(0);

    // Store trade
    trades.push(result.trade);
    if (trades.length > maxTradeHistory) {
      trades = trades.slice(trades.length - maxTradeHistory);
    }

    return { trade: result.trade, fill };
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
      const entrySide = isShort ? "sell" : "buy";
      const entryPrice = applySlippage(price, slippage, entrySide);
      const positionValue = entryPrice * shares;

      // Deduct from available capital
      const entryCost =
        commission + positionValue * (commissionRate / 100);
      account.currentCapital -= positionValue + entryCost;

      const levels = calculateLevels(entryPrice);

      position = {
        id: `pos-${positionCounter}`,
        entryTime: time,
        entryPrice,
        shares,
        originalShares: shares,
        direction,
        stopLossPrice: opts?.stopLossPrice !== undefined
          ? opts.stopLossPrice
          : levels.stopLossPrice,
        takeProfitPrice: opts?.takeProfitPrice !== undefined
          ? opts.takeProfitPrice
          : levels.takeProfitPrice,
        peakPrice: entryPrice,
        troughPrice: entryPrice,
        maxProfitPercent: 0,
        maxLossPercent: 0,
      };

      updateUnrealized(entryPrice);

      return { ...position };
    },

    updatePrice(candle: NormalizedCandle): UpdatePriceResult {
      if (!position) {
        return { position: null as unknown as ManagedPosition, triggered: null };
      }

      // Update peak and trough prices
      if (candle.high > position.peakPrice) {
        position.peakPrice = candle.high;
      }
      if (candle.low < position.troughPrice) {
        position.troughPrice = candle.low;
      }

      // Update MFE/MAE based on direction
      if (isShort) {
        const profitPercent =
          ((position.entryPrice - candle.low) / position.entryPrice) * 100;
        const lossPercent =
          ((candle.high - position.entryPrice) / position.entryPrice) * 100;
        if (profitPercent > position.maxProfitPercent) {
          position.maxProfitPercent = profitPercent;
        }
        if (lossPercent > 0 && lossPercent > position.maxLossPercent) {
          position.maxLossPercent = lossPercent;
        }
      } else {
        const currentProfitPercent =
          ((candle.high - position.entryPrice) / position.entryPrice) * 100;
        const currentLossPercent =
          ((position.entryPrice - candle.low) / position.entryPrice) * 100;
        if (currentProfitPercent > position.maxProfitPercent) {
          position.maxProfitPercent = currentProfitPercent;
        }
        if (currentLossPercent > position.maxLossPercent) {
          position.maxLossPercent = currentLossPercent;
        }
      }

      // Check stop loss
      if (position.stopLossPrice !== null) {
        const slTriggered = isShort
          ? candle.high >= position.stopLossPrice
          : candle.low <= position.stopLossPrice;
        if (slTriggered) {
          const result = executeClose(position.stopLossPrice, candle.time, "stop-loss");
          return { position: null as unknown as ManagedPosition, triggered: result.fill };
        }
      }

      // Check take profit
      if (position.takeProfitPrice !== null) {
        const tpTriggered = isShort
          ? candle.low <= position.takeProfitPrice
          : candle.high >= position.takeProfitPrice;
        if (tpTriggered) {
          const result = executeClose(position.takeProfitPrice, candle.time, "take-profit");
          return { position: null as unknown as ManagedPosition, triggered: result.fill };
        }
      }

      // Check trailing stop
      if (trailingStopPercent > 0) {
        const trailingStopPrice = isShort
          ? position.troughPrice * (1 + trailingStopPercent / 100)
          : position.peakPrice * (1 - trailingStopPercent / 100);
        const trailTriggered = isShort
          ? candle.high >= trailingStopPrice
          : candle.low <= trailingStopPrice;
        if (trailTriggered) {
          const result = executeClose(trailingStopPrice, candle.time, "trailing-stop");
          return { position: null as unknown as ManagedPosition, triggered: result.fill };
        }
      }

      // No trigger — update unrealized
      updateUnrealized(candle.close);

      return { position: { ...position }, triggered: null };
    },

    closePosition(
      price: number,
      time: number,
      reason: FillRecord["reason"],
    ): ClosedTradeResult {
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
