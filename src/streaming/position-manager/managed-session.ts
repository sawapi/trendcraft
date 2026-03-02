/**
 * ManagedSession — GuardedSession + PositionTracker integration
 *
 * Wraps a GuardedTradingSession with automatic position management.
 * Converts entry/exit/force-close session events into position opens/closes,
 * tracks P&L, manages account state, and auto-reports to RiskGuard.
 *
 * Layer structure:
 * ```
 * TradingSession
 *   └── GuardedSession (guards)
 *        └── ManagedSession (position tracking)  ← this module
 * ```
 *
 * @example
 * ```ts
 * const session = createManagedSession(
 *   {
 *     intervalMs: 60_000,
 *     pipeline: {
 *       indicators: [
 *         { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *       ],
 *       entry: rsiBelow(30),
 *       exit: rsiAbove(70),
 *     },
 *   },
 *   { riskGuard: { maxDailyLoss: -50000 } },
 *   { capital: 1_000_000, stopLoss: 2, takeProfit: 6 },
 * );
 *
 * const events = session.onTrade({ time: Date.now(), price: 100, volume: 10 });
 * for (const e of events) {
 *   if (e.type === 'position-opened') console.log('Opened', e.position.shares);
 *   if (e.type === 'position-closed') console.log('P&L', e.trade.return);
 * }
 * ```
 */

import type { NormalizedCandle, Trade as BacktestTrade } from "../../types";
import type { IndicatorSnapshot, SessionEvent, Trade as TickTrade } from "../types";
import type { GuardedSessionOptions, GuardedSessionState } from "../guards/types";
import type { SessionOptions } from "../types";
import { createGuardedSession } from "../guards/guarded-session";
import { riskBasedSize } from "../../position-sizing/risk-based";
import { atrBasedSize } from "../../position-sizing/atr-based";
import { fixedFractionalSize } from "../../position-sizing/fixed-fractional";
import { applySlippage } from "../../backtest/engine-utils";
import { createPositionTracker } from "./position-tracker";
import type {
  FillRecord,
  ManagedEvent,
  ManagedSession,
  ManagedSessionState,
  PositionManagerOptions,
  PositionSizingConfig,
} from "./types";

/**
 * Calculate number of shares based on sizing config
 */
function calculateShares(
  config: PositionSizingConfig,
  entryPrice: number,
  equity: number,
  stopLossPercent: number,
  slippage: number,
  snapshot: IndicatorSnapshot,
): number {
  const entryPriceWithSlippage = applySlippage(entryPrice, slippage, "buy");

  switch (config.method) {
    case "full-capital": {
      return Math.floor(equity / entryPriceWithSlippage);
    }
    case "fixed-fractional": {
      const result = fixedFractionalSize({
        accountSize: equity,
        entryPrice: entryPriceWithSlippage,
        fractionPercent: config.fractionPercent,
      });
      return result.shares;
    }
    case "risk-based": {
      if (stopLossPercent <= 0) {
        // No stop loss set; fall back to full-capital
        return Math.floor(equity / entryPriceWithSlippage);
      }
      const stopLossPrice = entryPriceWithSlippage * (1 - stopLossPercent / 100);
      const result = riskBasedSize({
        accountSize: equity,
        entryPrice: entryPriceWithSlippage,
        riskPercent: config.riskPercent,
        stopLossPrice,
      });
      return result.shares;
    }
    case "atr-based": {
      const atrValue = snapshot[config.atrKey] as number | undefined;
      if (!atrValue || atrValue <= 0) {
        // ATR not ready; skip this entry
        return 0;
      }
      const result = atrBasedSize({
        accountSize: equity,
        entryPrice: entryPriceWithSlippage,
        riskPercent: config.riskPercent,
        atrValue,
        atrMultiplier: config.atrMultiplier ?? 2,
      });
      return result.shares;
    }
    default:
      return 0;
  }
}

/**
 * Create a ManagedSession with integrated position management
 *
 * @param sessionOptions - Standard session configuration
 * @param guardOptions - Guard configuration (risk and/or time)
 * @param positionOptions - Position management configuration
 * @param fromState - Optional saved state to restore from
 * @returns A ManagedSession instance
 *
 * @example
 * ```ts
 * const session = createManagedSession(
 *   {
 *     intervalMs: 60_000,
 *     pipeline: {
 *       indicators: [
 *         { name: 'rsi', create: () => createRsi({ period: 14 }) },
 *         { name: 'atr14', create: () => createAtr({ period: 14 }) },
 *       ],
 *       entry: rsiBelow(30),
 *       exit: rsiAbove(70),
 *     },
 *   },
 *   {
 *     riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 20 },
 *     timeGuard: {
 *       tradingWindows: [{ startMs: 9 * 3600_000, endMs: 15 * 3600_000 }],
 *       timezoneOffsetMs: 9 * 3600_000,
 *       forceCloseBeforeEndMs: 5 * 60_000,
 *     },
 *   },
 *   {
 *     capital: 1_000_000,
 *     sizing: { method: 'risk-based', riskPercent: 1 },
 *     stopLoss: 2,
 *     takeProfit: 6,
 *     trailingStop: 3,
 *     commissionRate: 0.1,
 *     slippage: 0.05,
 *   },
 * );
 * ```
 */
export function createManagedSession(
  sessionOptions: SessionOptions,
  guardOptions: GuardedSessionOptions,
  positionOptions: PositionManagerOptions,
  fromState?: ManagedSessionState,
): ManagedSession {
  const guardedSession = createGuardedSession(
    sessionOptions,
    guardOptions,
    fromState?.guardedState,
  );

  const sizingConfig: PositionSizingConfig =
    positionOptions.sizing ?? { method: "full-capital" };
  const stopLossPercent = positionOptions.stopLoss ?? 0;
  const slippage = positionOptions.slippage ?? 0;

  const tracker = createPositionTracker(
    {
      capital: positionOptions.capital,
      stopLoss: positionOptions.stopLoss,
      takeProfit: positionOptions.takeProfit,
      trailingStop: positionOptions.trailingStop,
      commission: positionOptions.commission,
      commissionRate: positionOptions.commissionRate,
      taxRate: positionOptions.taxRate,
      slippage: positionOptions.slippage,
      maxTradeHistory: positionOptions.maxTradeHistory,
    },
    fromState?.trackerState,
  );

  /**
   * Report a closed trade to the risk guard
   */
  function reportToRiskGuard(trade: BacktestTrade, time: number): void {
    guardedSession.riskGuard?.reportTrade(trade.return, time);
  }

  /**
   * Handle an entry event: calculate sizing and open position
   */
  function handleEntry(
    event: Extract<SessionEvent, { type: "entry" }>,
  ): ManagedEvent[] {
    // Skip if already holding a position
    if (tracker.getPosition()) {
      return [event];
    }

    const account = tracker.getAccount();
    const shares = calculateShares(
      sizingConfig,
      event.candle.close,
      account.equity,
      stopLossPercent,
      slippage,
      event.snapshot,
    );

    if (shares <= 0) {
      return [event];
    }

    const position = tracker.openPosition(
      event.candle.close,
      shares,
      event.candle.time,
    );

    const fill: FillRecord = {
      time: event.candle.time,
      price: position.entryPrice,
      shares: position.shares,
      side: "buy",
      reason: "entry",
    };

    return [
      event,
      {
        type: "position-opened",
        position: { ...position },
        fill,
        candle: event.candle,
      },
    ];
  }

  /**
   * Handle an exit or force-close event: close position if open
   */
  function handleExit(
    event: SessionEvent,
    reason: FillRecord["reason"],
  ): ManagedEvent[] {
    if (!tracker.getPosition()) {
      return [event];
    }

    const candle = event.candle;
    const { trade, fill } = tracker.closePosition(
      candle.close,
      candle.time,
      reason,
    );
    reportToRiskGuard(trade, candle.time);

    return [
      event,
      {
        type: "position-closed",
        trade,
        fill,
        account: tracker.getAccount(),
        candle,
      },
    ];
  }

  /**
   * Handle a candle event: update position price and check SL/TP/trailing
   */
  function handleCandle(
    event: Extract<SessionEvent, { type: "candle" }>,
  ): ManagedEvent[] {
    if (!tracker.getPosition()) {
      return [event];
    }

    const { triggered } = tracker.updatePrice(event.candle);

    if (triggered) {
      // SL/TP/trailing was hit
      const trades = tracker.getTrades();
      const trade = trades[trades.length - 1];
      reportToRiskGuard(trade, event.candle.time);

      return [
        event,
        {
          type: "position-closed",
          trade,
          fill: triggered,
          account: tracker.getAccount(),
          candle: event.candle,
        },
      ];
    }

    // Position still open — emit update
    const account = tracker.getAccount();
    return [
      event,
      {
        type: "position-update",
        unrealizedPnl: account.unrealizedPnl,
        equity: account.equity,
        candle: event.candle,
      },
    ];
  }

  /**
   * Process a batch of session events through position management
   */
  function processEvents(events: SessionEvent[]): ManagedEvent[] {
    const result: ManagedEvent[] = [];

    for (const event of events) {
      switch (event.type) {
        case "candle":
          result.push(...handleCandle(event));
          break;
        case "entry":
          result.push(...handleEntry(event));
          break;
        case "exit":
          result.push(...handleExit(event, "exit-signal"));
          break;
        case "force-close":
          result.push(...handleExit(event, "force-close"));
          break;
        default:
          // signal, partial, blocked — pass through
          result.push(event);
          break;
      }
    }

    return result;
  }

  return {
    onTrade(trade: TickTrade): ManagedEvent[] {
      const events = guardedSession.onTrade(trade);
      return processEvents(events);
    },

    close(): ManagedEvent[] {
      const events = guardedSession.close();
      const result = processEvents(events);

      // If position is still open after session close, force-close it
      if (tracker.getPosition()) {
        const trades = tracker.getTrades();
        // Use the last candle from events if available
        const candleEvent = events.find(
          (e) => e.type === "candle",
        ) as Extract<SessionEvent, { type: "candle" }> | undefined;
        if (candleEvent) {
          const { trade, fill } = tracker.closePosition(
            candleEvent.candle.close,
            candleEvent.candle.time,
            "force-close",
          );
          reportToRiskGuard(trade, candleEvent.candle.time);
          result.push({
            type: "position-closed",
            trade,
            fill,
            account: tracker.getAccount(),
            candle: candleEvent.candle,
          });
        }
      }

      return result;
    },

    getPosition() {
      return tracker.getPosition();
    },

    getAccount() {
      return tracker.getAccount();
    },

    getTrades() {
      return tracker.getTrades();
    },

    closePosition(time: number, price: number): ManagedEvent[] {
      if (!tracker.getPosition()) {
        return [];
      }
      const { trade, fill } = tracker.closePosition(price, time, "manual");
      reportToRiskGuard(trade, time);

      // Synthesize a candle for the event
      const candle: NormalizedCandle = {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };

      return [
        {
          type: "position-closed",
          trade,
          fill,
          account: tracker.getAccount(),
          candle,
        },
      ];
    },

    updateStopLoss(price: number): void {
      tracker.updateStopLoss(price);
    },

    updateTakeProfit(price: number): void {
      tracker.updateTakeProfit(price);
    },

    riskGuard: guardedSession.riskGuard,
    timeGuard: guardedSession.timeGuard,

    getState(): ManagedSessionState {
      return {
        guardedState: guardedSession.getState(),
        trackerState: tracker.getState(),
      };
    },
  };
}
