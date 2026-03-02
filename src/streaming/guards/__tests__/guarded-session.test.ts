import { describe, it, expect } from "vitest";
import { createGuardedSession } from "../guarded-session";
import type { Trade, SessionEvent } from "../../types";
import type { NormalizedCandle } from "../../../types";
import { rsiBelow, rsiAbove } from "../../conditions";

const INTERVAL = 60_000; // 1 minute
const HOUR = 3600_000;
const MINUTE = 60_000;

function trade(time: number, price: number, volume = 1): Trade {
  return { time, price, volume };
}

/**
 * Create a mock indicator that returns a controllable value.
 * The value can be changed via the returned ref object.
 */
function createControllableIndicator(ref: { value: number }) {
  return {
    next(candle: NormalizedCandle) {
      return { time: candle.time, value: ref.value };
    },
    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: ref.value };
    },
    getState() {
      return { value: ref.value };
    },
  };
}

describe("createGuardedSession", () => {
  describe("basic pass-through", () => {
    it("should pass through events when no guards are configured", () => {
      const rsiRef = { value: 25 };
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        {},
      );

      session.onTrade(trade(0, 100));
      const events = session.onTrade(trade(INTERVAL, 105));
      expect(events.some((e) => e.type === "entry")).toBe(true);
      expect(session.riskGuard).toBeNull();
      expect(session.timeGuard).toBeNull();
    });

    it("should emit candle and signal events unchanged", () => {
      const rsiRef = { value: 50 };
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            signals: [{ name: "test", condition: rsiAbove(40) }],
          },
        },
        {},
      );

      session.onTrade(trade(0, 100));
      const events = session.onTrade(trade(INTERVAL, 105));
      expect(events.some((e) => e.type === "candle")).toBe(true);
      expect(events.some((e) => e.type === "signal")).toBe(true);
    });
  });

  describe("risk guard blocking", () => {
    it("should block entry when daily loss limit reached", () => {
      const rsiRef = { value: 25 };
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        { riskGuard: { maxDailyLoss: -5000 } },
      );

      // Report a big loss
      session.riskGuard!.reportTrade(-6000, 0);

      // Feed trades to generate entry signal
      session.onTrade(trade(0, 100));
      const events = session.onTrade(trade(INTERVAL, 105));

      const blocked = events.filter((e) => e.type === "blocked");
      expect(blocked).toHaveLength(1);
      expect((blocked[0] as { type: "blocked"; reason: string }).reason).toContain(
        "Daily loss limit",
      );

      // Entry should NOT be present
      expect(events.some((e) => e.type === "entry")).toBe(false);
    });

    it("should block entry when daily trade limit reached", () => {
      const rsiRef = { value: 25 };
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        { riskGuard: { maxDailyTrades: 2 } },
      );

      // Use up trade allowance
      session.riskGuard!.reportTrade(100, 0);
      session.riskGuard!.reportTrade(100, 0);

      session.onTrade(trade(0, 100));
      const events = session.onTrade(trade(INTERVAL, 105));
      expect(events.some((e) => e.type === "blocked")).toBe(true);
      expect(events.some((e) => e.type === "entry")).toBe(false);
    });

    it("should allow entry when risk guard passes", () => {
      const rsiRef = { value: 25 };
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        { riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 100 } },
      );

      session.onTrade(trade(0, 100));
      const events = session.onTrade(trade(INTERVAL, 105));
      expect(events.some((e) => e.type === "entry")).toBe(true);
      expect(events.some((e) => e.type === "blocked")).toBe(false);
    });
  });

  describe("time guard blocking", () => {
    it("should block entry outside trading window", () => {
      const rsiRef = { value: 25 };

      // Window: 09:00-15:00 UTC
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        {
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
            timezoneOffsetMs: 0,
          },
        },
      );

      // 08:00 UTC — outside window
      const t = Date.UTC(2024, 0, 15, 8, 0, 0);
      session.onTrade(trade(t, 100));
      const events = session.onTrade(trade(t + INTERVAL, 105));

      expect(events.some((e) => e.type === "blocked")).toBe(true);
      expect(events.some((e) => e.type === "entry")).toBe(false);
    });

    it("should allow entry inside trading window", () => {
      const rsiRef = { value: 25 };

      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        {
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
            timezoneOffsetMs: 0,
          },
        },
      );

      // 10:00 UTC — inside window
      const t = Date.UTC(2024, 0, 15, 10, 0, 0);
      session.onTrade(trade(t, 100));
      const events = session.onTrade(trade(t + INTERVAL, 105));
      expect(events.some((e) => e.type === "entry")).toBe(true);
    });
  });

  describe("force-close events", () => {
    it("should emit force-close near window end", () => {
      const rsiRef = { value: 50 }; // No entry signal

      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
          },
        },
        {
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
            timezoneOffsetMs: 0,
            forceCloseBeforeEndMs: 5 * MINUTE,
          },
        },
      );

      // 14:56 UTC — 4 minutes before close, in force-close zone
      const t = Date.UTC(2024, 0, 15, 14, 56, 0);
      session.onTrade(trade(t, 100));
      const events = session.onTrade(trade(t + INTERVAL, 105));

      const forceClose = events.filter((e) => e.type === "force-close");
      expect(forceClose).toHaveLength(1);
      expect(
        (forceClose[0] as { type: "force-close"; reason: string }).reason,
      ).toContain("Force-close");
    });

    it("should not emit force-close well within window", () => {
      const rsiRef = { value: 50 };

      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
          },
        },
        {
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
            timezoneOffsetMs: 0,
            forceCloseBeforeEndMs: 5 * MINUTE,
          },
        },
      );

      // 12:00 UTC — well within window
      const t = Date.UTC(2024, 0, 15, 12, 0, 0);
      session.onTrade(trade(t, 100));
      const events = session.onTrade(trade(t + INTERVAL, 105));
      expect(events.some((e) => e.type === "force-close")).toBe(false);
    });
  });

  describe("combined guards", () => {
    it("should check time guard before risk guard for entries", () => {
      const rsiRef = { value: 25 };

      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        {
          riskGuard: { maxDailyTrades: 100 },
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
            timezoneOffsetMs: 0,
          },
        },
      );

      // Outside time window — time guard should block first
      const t = Date.UTC(2024, 0, 15, 8, 0, 0);
      session.onTrade(trade(t, 100));
      const events = session.onTrade(trade(t + INTERVAL, 105));

      const blocked = events.filter((e) => e.type === "blocked");
      expect(blocked).toHaveLength(1);
      expect((blocked[0] as { type: "blocked"; reason: string }).reason).toContain(
        "Outside trading window",
      );
    });

    it("should allow when both guards pass", () => {
      const rsiRef = { value: 25 };

      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        {
          riskGuard: { maxDailyLoss: -50000, maxDailyTrades: 100 },
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
            timezoneOffsetMs: 0,
          },
        },
      );

      // Within window and no risk limits hit
      const t = Date.UTC(2024, 0, 15, 10, 0, 0);
      session.onTrade(trade(t, 100));
      const events = session.onTrade(trade(t + INTERVAL, 105));
      expect(events.some((e) => e.type === "entry")).toBe(true);
    });
  });

  describe("exit events pass through", () => {
    it("should not block exit events even when guards are triggered", () => {
      const rsiRef = { value: 75 };

      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            exit: rsiAbove(70),
          },
        },
        { riskGuard: { maxDailyTrades: 0 } }, // Immediately blocked
      );

      const t = Date.UTC(2024, 0, 15, 10, 0, 0);
      session.onTrade(trade(t, 100));
      const events = session.onTrade(trade(t + INTERVAL, 105));

      // Exit should still pass through
      expect(events.some((e) => e.type === "exit")).toBe(true);
      expect(events.some((e) => e.type === "blocked")).toBe(false);
    });
  });

  describe("close pass-through", () => {
    it("should delegate close to inner session", () => {
      const rsiRef = { value: 50 };

      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
          },
        },
        {},
      );

      session.onTrade(trade(0, 100));
      const events = session.close();
      expect(events.some((e) => e.type === "candle")).toBe(true);
    });
  });

  describe("state persistence", () => {
    it("should serialize and restore full state", () => {
      const rsiRef = { value: 25 };

      const session1 = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: {
            indicators: [
              { name: "rsi", create: () => createControllableIndicator(rsiRef) },
            ],
            entry: rsiBelow(30),
          },
        },
        {
          riskGuard: { maxDailyLoss: -50000 },
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
            timezoneOffsetMs: 0,
          },
        },
      );

      const t = Date.UTC(2024, 0, 15, 10, 0, 0);
      session1.onTrade(trade(t, 100));
      session1.riskGuard!.reportTrade(-1000, t);
      session1.timeGuard!.addBlackout({
        startTime: t + HOUR,
        endTime: t + 2 * HOUR,
        reason: "test",
      });

      const state = JSON.parse(JSON.stringify(session1.getState()));

      expect(state.sessionState).toBeDefined();
      expect(state.riskGuardState).toBeDefined();
      expect(state.timeGuardState).toBeDefined();
      expect(state.riskGuardState.dailyPnl).toBe(-1000);
      expect(state.timeGuardState.blackoutPeriods).toHaveLength(1);
    });

    it("should survive JSON round-trip and restore correctly", () => {
      const rsiRef = { value: 25 };
      const options = {
        intervalMs: INTERVAL,
        pipeline: {
          indicators: [
            { name: "rsi", create: () => createControllableIndicator(rsiRef) },
          ],
          entry: rsiBelow(30),
        },
      };
      const guardOpts = {
        riskGuard: { maxDailyLoss: -5000 as number },
        timeGuard: {
          tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
          timezoneOffsetMs: 0,
        },
      };

      const session1 = createGuardedSession(options, guardOpts);
      session1.riskGuard!.reportTrade(-3000, Date.UTC(2024, 0, 15, 10, 0, 0));

      const state = JSON.parse(JSON.stringify(session1.getState()));
      const session2 = createGuardedSession(options, guardOpts, state);

      expect(session2.riskGuard!.getState().dailyPnl).toBe(-3000);
    });
  });

  describe("guard accessors", () => {
    it("should expose riskGuard when configured", () => {
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: { indicators: [] },
        },
        { riskGuard: { maxDailyLoss: -5000 } },
      );
      expect(session.riskGuard).not.toBeNull();
      expect(session.timeGuard).toBeNull();
    });

    it("should expose timeGuard when configured", () => {
      const session = createGuardedSession(
        {
          intervalMs: INTERVAL,
          pipeline: { indicators: [] },
        },
        {
          timeGuard: {
            tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
          },
        },
      );
      expect(session.riskGuard).toBeNull();
      expect(session.timeGuard).not.toBeNull();
    });
  });
});
