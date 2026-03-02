import { describe, it, expect } from "vitest";
import { createManagedSession } from "../managed-session";
import type { ManagedEvent, PositionManagerOptions } from "../types";
import type { SessionOptions } from "../../types";
import type { GuardedSessionOptions } from "../../guards/types";
import type { NormalizedCandle } from "../../../types";

/**
 * Minimal incremental indicator that tracks close price
 */
function createDummyIndicator(name: string, initialValue = 50) {
  let value = initialValue;
  return {
    name,
    create: () => ({
      next(candle: NormalizedCandle) {
        value = candle.close;
        return { value };
      },
      peek(candle: NormalizedCandle) {
        return { value: candle.close };
      },
      getState() {
        return { value };
      },
    }),
  };
}

/**
 * Feed trades into session and collect all events
 */
function feedTrades(
  session: ReturnType<typeof createManagedSession>,
  trades: Array<{ time: number; price: number; volume: number }>,
): ManagedEvent[] {
  const allEvents: ManagedEvent[] = [];
  for (const t of trades) {
    allEvents.push(...session.onTrade(t));
  }
  return allEvents;
}

/**
 * Collect events of a specific type
 */
function eventsOfType<T extends ManagedEvent["type"]>(
  events: ManagedEvent[],
  type: T,
): Extract<ManagedEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<
    ManagedEvent,
    { type: T }
  >[];
}

const alwaysEnter = {
  type: "preset" as const,
  name: "always-enter",
  evaluate: () => true,
};

const neverExit = {
  type: "preset" as const,
  name: "never-exit",
  evaluate: () => false,
};

const defaultSessionOptions: SessionOptions = {
  intervalMs: 1000,
  pipeline: {
    indicators: [createDummyIndicator("price")],
    entry: alwaysEnter,
    exit: neverExit,
  },
};

const noGuards: GuardedSessionOptions = {};

const defaultPositionOptions: PositionManagerOptions = {
  capital: 100_000,
};

describe("createManagedSession", () => {
  describe("basic flow", () => {
    it("should open a position on entry signal", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        defaultPositionOptions,
      );

      // Feed trades that complete candles
      // t=0: starts candle [0, 1000)
      // t=500: same candle
      // t=1000: completes candle [0, 1000), pipeline evaluates → entry
      // t=1500: same candle [1000, 2000)
      // t=2000: completes candle [1000, 2000)
      const events = feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 500, price: 101, volume: 10 },
        { time: 1000, price: 102, volume: 10 },
        { time: 1500, price: 103, volume: 10 },
        { time: 2000, price: 104, volume: 10 },
      ]);

      const opened = eventsOfType(events, "position-opened");
      expect(opened).toHaveLength(1);
      expect(opened[0].position.shares).toBeGreaterThan(0);
      expect(opened[0].fill.side).toBe("buy");
      expect(opened[0].fill.reason).toBe("entry");
    });

    it("should not open a second position while one is open", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        defaultPositionOptions,
      );

      const events: ManagedEvent[] = [];
      for (let i = 0; i < 10; i++) {
        events.push(
          ...session.onTrade({
            time: i * 1000,
            price: 100,
            volume: 10,
          }),
        );
      }

      const opened = eventsOfType(events, "position-opened");
      expect(opened).toHaveLength(1);
    });

    it("should close position on exit signal", () => {
      let shouldExit = false;
      const session = createManagedSession(
        {
          intervalMs: 1000,
          pipeline: {
            indicators: [createDummyIndicator("price")],
            entry: alwaysEnter,
            exit: {
              type: "preset",
              name: "conditional-exit",
              evaluate: () => shouldExit,
            },
          },
        },
        noGuards,
        defaultPositionOptions,
      );

      // Open position: candle [0,1000) completes at t=1000 → entry at close=100
      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);
      expect(session.getPosition()).not.toBeNull();

      // Trigger exit: candle [1000,2000) with price 110
      shouldExit = true;
      const events = feedTrades(session, [
        { time: 1500, price: 110, volume: 10 },
        { time: 2000, price: 110, volume: 10 }, // completes candle [1000,2000) close=110
      ]);

      const closed = eventsOfType(events, "position-closed");
      expect(closed).toHaveLength(1);
      expect(closed[0].trade.exitReason).toBe("signal");
      expect(closed[0].fill.reason).toBe("exit-signal");
      expect(session.getPosition()).toBeNull();
    });

    it("should emit position-update on candle events while holding", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        defaultPositionOptions,
      );

      // Open position
      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);
      expect(session.getPosition()).not.toBeNull();

      // Next candle completes at t=2000
      const events = feedTrades(session, [
        { time: 1500, price: 105, volume: 10 },
        { time: 2000, price: 105, volume: 10 },
      ]);

      const updates = eventsOfType(events, "position-update");
      expect(updates).toHaveLength(1);
      expect(updates[0].equity).toBeGreaterThan(0);
    });
  });

  describe("stop loss / take profit", () => {
    it("should trigger stop loss via updatePrice", () => {
      let enterOnce = true;
      const session = createManagedSession(
        {
          intervalMs: 1000,
          pipeline: {
            indicators: [createDummyIndicator("price")],
            entry: {
              type: "preset",
              name: "enter-once",
              evaluate: () => {
                if (enterOnce) {
                  enterOnce = false;
                  return true;
                }
                return false;
              },
            },
          },
        },
        noGuards,
        {
          capital: 100_000,
          stopLoss: 5, // SL at entry * 0.95
        },
      );

      // Open position at close=100
      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);
      expect(session.getPosition()).not.toBeNull();
      expect(session.getPosition()!.stopLossPrice).toBe(95);

      // Next candle [1000,2000) drops to 90 (below SL of 95)
      const events = feedTrades(session, [
        { time: 1500, price: 90, volume: 10 },
        { time: 2000, price: 90, volume: 10 }, // completes candle with low=90
      ]);

      const closed = eventsOfType(events, "position-closed");
      expect(closed).toHaveLength(1);
      expect(closed[0].fill.reason).toBe("stop-loss");
      expect(session.getPosition()).toBeNull();
    });

    it("should trigger take profit via updatePrice", () => {
      let enterOnce = true;
      const session = createManagedSession(
        {
          intervalMs: 1000,
          pipeline: {
            indicators: [createDummyIndicator("price")],
            entry: {
              type: "preset",
              name: "enter-once",
              evaluate: () => {
                if (enterOnce) {
                  enterOnce = false;
                  return true;
                }
                return false;
              },
            },
          },
        },
        noGuards,
        {
          capital: 100_000,
          takeProfit: 10, // TP at entry * 1.10
        },
      );

      // Open position at close=100
      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);
      expect(session.getPosition()).not.toBeNull();

      // Next candle [1000,2000) rises to 115 (above TP ~= 110)
      const events = feedTrades(session, [
        { time: 1500, price: 115, volume: 10 },
        { time: 2000, price: 115, volume: 10 },
      ]);

      const closed = eventsOfType(events, "position-closed");
      expect(closed).toHaveLength(1);
      expect(closed[0].fill.reason).toBe("take-profit");
      expect(session.getPosition()).toBeNull();
    });
  });

  describe("position sizing", () => {
    it("should use full-capital sizing by default", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        { capital: 100_000 },
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);

      const pos = session.getPosition();
      expect(pos).not.toBeNull();
      // Full capital: 100,000 / 100 = 1000 shares
      expect(pos!.shares).toBe(1000);
    });

    it("should use fixed-fractional sizing", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        {
          capital: 100_000,
          sizing: { method: "fixed-fractional", fractionPercent: 10 },
        },
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);

      const pos = session.getPosition();
      expect(pos).not.toBeNull();
      // 10% of 100,000 = 10,000 / 100 = 100 shares
      expect(pos!.shares).toBe(100);
    });

    it("should use risk-based sizing with stop loss", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        {
          capital: 100_000,
          sizing: { method: "risk-based", riskPercent: 1 },
          stopLoss: 2,
        },
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);

      const pos = session.getPosition();
      expect(pos).not.toBeNull();
      // Risk = 100,000 * 0.01 = 1,000
      // Stop distance = 100 * 0.02 = 2
      // Shares = 1,000 / 2 = 500
      expect(pos!.shares).toBe(500);
    });

    it("should fall back to full-capital when risk-based but no stop loss", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        {
          capital: 100_000,
          sizing: { method: "risk-based", riskPercent: 1 },
        },
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);

      const pos = session.getPosition();
      expect(pos).not.toBeNull();
      expect(pos!.shares).toBe(1000);
    });
  });

  describe("force-close", () => {
    it("should close position on force-close event from time guard", () => {
      const session = createManagedSession(
        {
          intervalMs: 1000,
          pipeline: {
            indicators: [createDummyIndicator("price")],
            entry: alwaysEnter,
          },
        },
        {
          timeGuard: {
            tradingWindows: [{ startMs: 0, endMs: 5000 }],
            forceCloseBeforeEndMs: 2000,
          },
        },
        defaultPositionOptions,
      );

      // Time 0-1000: open position (within window)
      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);
      expect(session.getPosition()).not.toBeNull();

      // Time 3000+: in force-close zone (5000 - 2000 = 3000)
      const events = feedTrades(session, [
        { time: 3500, price: 105, volume: 10 },
        { time: 4000, price: 105, volume: 10 },
      ]);

      const closed = eventsOfType(events, "position-closed");
      expect(closed).toHaveLength(1);
      expect(closed[0].fill.reason).toBe("force-close");
      expect(session.getPosition()).toBeNull();
    });
  });

  describe("risk guard integration", () => {
    it("should report trades to risk guard automatically", () => {
      let shouldExit = false;
      const session = createManagedSession(
        {
          intervalMs: 1000,
          pipeline: {
            indicators: [createDummyIndicator("price")],
            entry: alwaysEnter,
            exit: {
              type: "preset",
              name: "conditional-exit",
              evaluate: () => shouldExit,
            },
          },
        },
        {
          riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 2 },
        },
        defaultPositionOptions,
      );

      // Open and close trade 1
      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 }, // opens position
      ]);
      shouldExit = true;
      feedTrades(session, [
        { time: 1500, price: 105, volume: 10 },
        { time: 2000, price: 105, volume: 10 }, // closes position
      ]);
      shouldExit = false;

      const rg = session.riskGuard!;
      expect(rg.getState().dailyTradeCount).toBe(1);

      // Open and close trade 2
      feedTrades(session, [
        { time: 2500, price: 100, volume: 10 },
        { time: 3000, price: 100, volume: 10 }, // opens position
      ]);
      shouldExit = true;
      feedTrades(session, [
        { time: 3500, price: 100, volume: 10 },
        { time: 4000, price: 100, volume: 10 }, // closes position
      ]);
      shouldExit = false;

      expect(rg.getState().dailyTradeCount).toBe(2);

      // Third entry should be blocked by maxDailyTrades
      const events3 = feedTrades(session, [
        { time: 4500, price: 100, volume: 10 },
        { time: 5000, price: 100, volume: 10 },
      ]);

      const blocked = eventsOfType(events3, "blocked");
      expect(blocked.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("manual operations", () => {
    it("should manually close position", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        defaultPositionOptions,
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);
      expect(session.getPosition()).not.toBeNull();

      const events = session.closePosition(2000, 110);
      const closed = eventsOfType(events, "position-closed");
      expect(closed).toHaveLength(1);
      expect(closed[0].fill.reason).toBe("manual");
      expect(session.getPosition()).toBeNull();
    });

    it("should update stop loss", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        { capital: 100_000, stopLoss: 5 },
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);

      // SL at 100 * 0.95 = 95
      expect(session.getPosition()!.stopLossPrice).toBe(95);

      session.updateStopLoss(97);
      expect(session.getPosition()!.stopLossPrice).toBe(97);
    });

    it("should update take profit", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        { capital: 100_000, takeProfit: 10 },
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);

      // TP at 100 * 1.10 ≈ 110
      expect(session.getPosition()!.takeProfitPrice).toBeCloseTo(110, 5);

      session.updateTakeProfit(115);
      expect(session.getPosition()!.takeProfitPrice).toBe(115);
    });

    it("should return empty array when manually closing with no position", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        defaultPositionOptions,
      );

      const events = session.closePosition(1000, 100);
      expect(events).toHaveLength(0);
    });
  });

  describe("close session", () => {
    it("should force-close open position on session close", () => {
      const session = createManagedSession(
        defaultSessionOptions,
        noGuards,
        defaultPositionOptions,
      );

      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 105, volume: 10 },
      ]);
      expect(session.getPosition()).not.toBeNull();

      const events = session.close();
      const closed = eventsOfType(events, "position-closed");
      expect(closed).toHaveLength(1);
      expect(closed[0].fill.reason).toBe("force-close");
      expect(session.getPosition()).toBeNull();
    });
  });

  describe("account state", () => {
    it("should track account state across trades", () => {
      let shouldExit = false;
      const session = createManagedSession(
        {
          intervalMs: 1000,
          pipeline: {
            indicators: [createDummyIndicator("price")],
            entry: alwaysEnter,
            exit: {
              type: "preset",
              name: "conditional-exit",
              evaluate: () => shouldExit,
            },
          },
        },
        noGuards,
        { capital: 100_000 },
      );

      // Open at close=100
      feedTrades(session, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);

      // Exit at close=110
      shouldExit = true;
      feedTrades(session, [
        { time: 1500, price: 110, volume: 10 },
        { time: 2000, price: 110, volume: 10 },
      ]);

      const account = session.getAccount();
      // Sold at 110, bought at 100: profit = 10 * 1000 shares = 10,000
      expect(account.totalRealizedPnl).toBeGreaterThan(0);
      expect(account.currentCapital).toBeGreaterThan(100_000);

      const trades = session.getTrades();
      expect(trades).toHaveLength(1);
    });
  });

  describe("state persistence", () => {
    it("should save and restore session state", () => {
      const session1 = createManagedSession(
        defaultSessionOptions,
        noGuards,
        { capital: 100_000, stopLoss: 2 },
      );

      feedTrades(session1, [
        { time: 0, price: 100, volume: 10 },
        { time: 1000, price: 100, volume: 10 },
      ]);
      expect(session1.getPosition()).not.toBeNull();

      const state = session1.getState();
      const serialized = JSON.parse(JSON.stringify(state));

      const session2 = createManagedSession(
        defaultSessionOptions,
        noGuards,
        { capital: 100_000, stopLoss: 2 },
        serialized,
      );

      // Position should be restored
      expect(session2.getPosition()).not.toBeNull();
      expect(session2.getPosition()!.entryPrice).toBe(
        session1.getPosition()!.entryPrice,
      );
      expect(session2.getAccount().currentCapital).toBe(
        session1.getAccount().currentCapital,
      );
    });
  });
});
