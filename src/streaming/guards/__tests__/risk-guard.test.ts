import { describe, expect, it } from "vitest";
import { createRiskGuard } from "../risk-guard";

// Helper: base time = 2024-01-15 10:00:00 UTC
const BASE_TIME = Date.UTC(2024, 0, 15, 10, 0, 0);
const HOUR = 3600_000;
const MINUTE = 60_000;

describe("createRiskGuard", () => {
  describe("basic functionality", () => {
    it("should allow trading with no limits configured", () => {
      const guard = createRiskGuard({});
      expect(guard.check(BASE_TIME)).toEqual({ allowed: true });
    });

    it("should return initial state", () => {
      const guard = createRiskGuard({});
      const state = guard.getState();
      expect(state.dailyPnl).toBe(0);
      expect(state.dailyTradeCount).toBe(0);
      expect(state.consecutiveLosses).toBe(0);
      expect(state.cooldownUntil).toBe(0);
    });
  });

  describe("maxDailyLoss", () => {
    it("should block when daily loss limit is reached", () => {
      const guard = createRiskGuard({ maxDailyLoss: -5000 });

      guard.reportTrade(-3000, BASE_TIME);
      expect(guard.check(BASE_TIME)).toEqual({ allowed: true });

      guard.reportTrade(-2000, BASE_TIME);
      const result = guard.check(BASE_TIME);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily loss limit");
    });

    it("should block when daily loss exceeds limit", () => {
      const guard = createRiskGuard({ maxDailyLoss: -5000 });
      guard.reportTrade(-6000, BASE_TIME);
      expect(guard.check(BASE_TIME).allowed).toBe(false);
    });

    it("should account for winning trades in daily PnL", () => {
      const guard = createRiskGuard({ maxDailyLoss: -5000 });
      guard.reportTrade(-4000, BASE_TIME);
      guard.reportTrade(2000, BASE_TIME);
      // dailyPnl = -2000, allowed
      expect(guard.check(BASE_TIME).allowed).toBe(true);
    });
  });

  describe("maxDailyTrades", () => {
    it("should block when trade count limit is reached", () => {
      const guard = createRiskGuard({ maxDailyTrades: 3 });

      guard.reportTrade(100, BASE_TIME);
      guard.reportTrade(100, BASE_TIME);
      guard.reportTrade(100, BASE_TIME);

      const result = guard.check(BASE_TIME);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily trade limit");
    });

    it("should allow up to the limit", () => {
      const guard = createRiskGuard({ maxDailyTrades: 3 });
      guard.reportTrade(100, BASE_TIME);
      guard.reportTrade(100, BASE_TIME);
      expect(guard.check(BASE_TIME).allowed).toBe(true);
    });
  });

  describe("maxConsecutiveLosses", () => {
    it("should block after consecutive losses", () => {
      const guard = createRiskGuard({ maxConsecutiveLosses: 3 });

      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);

      const result = guard.check(BASE_TIME);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Consecutive loss limit");
    });

    it("should reset consecutive losses on winning trade", () => {
      const guard = createRiskGuard({ maxConsecutiveLosses: 3 });

      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(50, BASE_TIME); // Win resets counter
      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);

      expect(guard.check(BASE_TIME).allowed).toBe(true);
    });

    it("should reset on zero PnL trade (not a loss)", () => {
      const guard = createRiskGuard({ maxConsecutiveLosses: 3 });

      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(0, BASE_TIME); // Breakeven resets
      guard.reportTrade(-100, BASE_TIME);

      expect(guard.check(BASE_TIME).allowed).toBe(true);
    });
  });

  describe("cooldown", () => {
    it("should activate cooldown after consecutive losses", () => {
      const guard = createRiskGuard({
        maxConsecutiveLosses: 2,
        cooldownMs: 30 * MINUTE,
      });

      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);

      // Should be blocked with cooldown message
      const result = guard.check(BASE_TIME);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("consecutive losses");
      expect(result.reason).toContain("cooldown");

      // Still blocked during cooldown
      const duringCooldown = guard.check(BASE_TIME + 15 * MINUTE);
      expect(duringCooldown.allowed).toBe(false);
      expect(duringCooldown.reason).toContain("Cooldown active");

      // Allowed after cooldown expires
      const afterCooldown = guard.check(BASE_TIME + 31 * MINUTE);
      expect(afterCooldown.allowed).toBe(true);
    });

    it("should reset cooldown on winning trade", () => {
      const guard = createRiskGuard({
        maxConsecutiveLosses: 2,
        cooldownMs: 30 * MINUTE,
      });

      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);
      guard.check(BASE_TIME); // Activates cooldown

      // Report a win — resets consecutive losses and cooldown
      guard.reportTrade(200, BASE_TIME + 5 * MINUTE);
      expect(guard.check(BASE_TIME + 5 * MINUTE).allowed).toBe(true);
    });
  });

  describe("day boundary reset", () => {
    it("should reset counters on new day", () => {
      const guard = createRiskGuard({
        maxDailyLoss: -5000,
        maxDailyTrades: 5,
      });

      // Hit both limits
      guard.reportTrade(-5000, BASE_TIME);
      guard.reportTrade(0, BASE_TIME);
      guard.reportTrade(0, BASE_TIME);
      guard.reportTrade(0, BASE_TIME);
      guard.reportTrade(0, BASE_TIME);
      expect(guard.check(BASE_TIME).allowed).toBe(false);

      // Next day — should reset
      const nextDay = BASE_TIME + 24 * HOUR;
      const result = guard.check(nextDay);
      expect(result.allowed).toBe(true);

      const state = guard.getState();
      expect(state.dailyPnl).toBe(0);
      expect(state.dailyTradeCount).toBe(0);
      expect(state.consecutiveLosses).toBe(0);
    });

    it("should use resetTimeOffsetMs for day boundary", () => {
      // Reset at JST 9:00 = UTC 0:00 → offset = 0
      // But let's test with offset so day changes at UTC 9:00
      const guard = createRiskGuard({
        maxDailyTrades: 1,
        resetTimeOffsetMs: 9 * HOUR,
      });

      // UTC 10:00 → day = floor((10h - 9h) / 24h) = 0
      const t1 = Date.UTC(2024, 0, 15, 10, 0, 0);
      guard.reportTrade(100, t1);
      expect(guard.check(t1).allowed).toBe(false);

      // UTC 08:00 next calendar day → still same trading day
      // day = floor((24h + 8h - 9h) / 24h) = floor(23h / 24h) = 0
      const t2 = Date.UTC(2024, 0, 16, 8, 0, 0);
      expect(guard.check(t2).allowed).toBe(false);

      // UTC 09:00 next calendar day → new trading day
      // day = floor((24h + 9h - 9h) / 24h) = floor(24h / 24h) = 1
      const t3 = Date.UTC(2024, 0, 16, 9, 0, 0);
      expect(guard.check(t3).allowed).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset all counters", () => {
      const guard = createRiskGuard({
        maxDailyLoss: -5000,
        maxConsecutiveLosses: 2,
        cooldownMs: 30 * MINUTE,
      });

      guard.reportTrade(-3000, BASE_TIME);
      guard.reportTrade(-3000, BASE_TIME);
      guard.check(BASE_TIME); // Activate cooldown

      guard.reset();
      const state = guard.getState();
      expect(state.dailyPnl).toBe(0);
      expect(state.dailyTradeCount).toBe(0);
      expect(state.consecutiveLosses).toBe(0);
      expect(state.cooldownUntil).toBe(0);
      expect(state.lastResetDay).toBe(-1);
    });
  });

  describe("state persistence", () => {
    it("should restore from saved state", () => {
      const guard1 = createRiskGuard({ maxDailyLoss: -5000 });
      guard1.reportTrade(-3000, BASE_TIME);
      guard1.check(BASE_TIME);

      const state = guard1.getState();
      const serialized = JSON.parse(JSON.stringify(state));

      const guard2 = createRiskGuard({ maxDailyLoss: -5000 }, serialized);
      expect(guard2.getState()).toEqual(state);

      // Further loss should trigger limit
      guard2.reportTrade(-2000, BASE_TIME);
      expect(guard2.check(BASE_TIME).allowed).toBe(false);
    });

    it("should survive JSON round-trip", () => {
      const guard = createRiskGuard({
        maxConsecutiveLosses: 3,
        cooldownMs: HOUR,
      });
      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME);

      const state = JSON.parse(JSON.stringify(guard.getState()));
      const restored = createRiskGuard({ maxConsecutiveLosses: 3, cooldownMs: HOUR }, state);
      expect(restored.getState().consecutiveLosses).toBe(2);
    });
  });

  describe("check priority order", () => {
    it("should check cooldown before other limits", () => {
      const guard = createRiskGuard({
        maxDailyTrades: 3,
        maxConsecutiveLosses: 2,
        cooldownMs: HOUR,
      });

      guard.reportTrade(-100, BASE_TIME);
      guard.reportTrade(-100, BASE_TIME); // 2 consecutive losses

      // First check activates cooldown
      const result = guard.check(BASE_TIME);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("consecutive losses");

      // Cooldown should be checked first on subsequent calls
      // (even though maxDailyTrades is also breached: 2 < 3, so not breached here)
      const result2 = guard.check(BASE_TIME + MINUTE);
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain("Cooldown");
    });

    it("should check daily loss before consecutive losses", () => {
      const guard = createRiskGuard({
        maxDailyLoss: -5000,
        maxConsecutiveLosses: 3,
      });

      guard.reportTrade(-6000, BASE_TIME); // Exceeds daily loss, 1 consecutive

      const result = guard.check(BASE_TIME);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily loss limit");
    });
  });

  describe("combined limits", () => {
    it("should enforce all limits simultaneously", () => {
      const guard = createRiskGuard({
        maxDailyLoss: -10000,
        maxDailyTrades: 5,
        maxConsecutiveLosses: 3,
      });

      // 3 consecutive losses but under daily loss and trade limits
      guard.reportTrade(-1000, BASE_TIME);
      guard.reportTrade(-1000, BASE_TIME);
      guard.reportTrade(-1000, BASE_TIME);

      const result = guard.check(BASE_TIME);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Consecutive loss limit");
    });
  });

  describe("maxDrawdownPercent", () => {
    it("should block when drawdown exceeds threshold", () => {
      const guard = createRiskGuard({ maxDrawdownPercent: 10 });

      // Peak equity at 100,000
      guard.updateEquity(100_000, BASE_TIME);
      expect(guard.check(BASE_TIME).allowed).toBe(true);

      // Equity drops to 91,000 → 9% drawdown, still allowed
      guard.updateEquity(91_000, BASE_TIME + HOUR);
      expect(guard.check(BASE_TIME + HOUR).allowed).toBe(true);

      // Equity drops to 90,000 → 10% drawdown, blocked
      guard.updateEquity(90_000, BASE_TIME + 2 * HOUR);
      const result = guard.check(BASE_TIME + 2 * HOUR);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Max drawdown");
    });

    it("should track peak equity correctly through rises", () => {
      const guard = createRiskGuard({ maxDrawdownPercent: 5 });

      guard.updateEquity(100_000, BASE_TIME);
      guard.updateEquity(110_000, BASE_TIME + HOUR); // New peak
      guard.updateEquity(105_000, BASE_TIME + 2 * HOUR); // 4.5% from peak

      expect(guard.check(BASE_TIME + 2 * HOUR).allowed).toBe(true);

      // Drop to 104,500 → 5% from 110,000 peak
      guard.updateEquity(104_500, BASE_TIME + 3 * HOUR);
      expect(guard.check(BASE_TIME + 3 * HOUR).allowed).toBe(false);
    });

    it("should not block when no equity has been reported", () => {
      const guard = createRiskGuard({ maxDrawdownPercent: 5 });
      expect(guard.check(BASE_TIME).allowed).toBe(true);
    });
  });

  describe("maxPositionPercent", () => {
    it("should block position that exceeds concentration limit", () => {
      const guard = createRiskGuard({ maxPositionPercent: 25 });
      guard.updateEquity(100_000, BASE_TIME);

      const result = guard.checkPositionSize(30_000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds limit");
    });

    it("should allow position within concentration limit", () => {
      const guard = createRiskGuard({ maxPositionPercent: 25 });
      guard.updateEquity(100_000, BASE_TIME);

      expect(guard.checkPositionSize(20_000).allowed).toBe(true);
    });

    it("should allow any position when maxPositionPercent is not set", () => {
      const guard = createRiskGuard({});
      guard.updateEquity(100_000, BASE_TIME);
      expect(guard.checkPositionSize(100_000).allowed).toBe(true);
    });
  });

  describe("equity state persistence", () => {
    it("should restore peak and current equity from state", () => {
      const guard1 = createRiskGuard({ maxDrawdownPercent: 10 });
      guard1.updateEquity(100_000, BASE_TIME);
      guard1.updateEquity(95_000, BASE_TIME + HOUR);

      const state = guard1.getState();
      expect(state.peakEquity).toBe(100_000);
      expect(state.currentEquity).toBe(95_000);

      // Restore
      const guard2 = createRiskGuard({ maxDrawdownPercent: 10 }, state);
      expect(guard2.getState().peakEquity).toBe(100_000);
      expect(guard2.getState().currentEquity).toBe(95_000);

      // Further drop should trigger
      guard2.updateEquity(90_000, BASE_TIME + 2 * HOUR);
      expect(guard2.check(BASE_TIME + 2 * HOUR).allowed).toBe(false);
    });

    it("should be backward-compatible with old state (no equity fields)", () => {
      const oldState: any = {
        dailyPnl: -1000,
        dailyTradeCount: 5,
        consecutiveLosses: 1,
        lastResetDay: 0,
        cooldownUntil: 0,
      };
      const guard = createRiskGuard({ maxDrawdownPercent: 10 }, oldState);
      // Should not crash, equity defaults to 0
      expect(guard.getState().peakEquity).toBe(0);
      expect(guard.check(BASE_TIME).allowed).toBe(true);
    });
  });

  describe("reset clears equity tracking", () => {
    it("should reset peak and current equity", () => {
      const guard = createRiskGuard({ maxDrawdownPercent: 5 });
      guard.updateEquity(100_000, BASE_TIME);
      guard.updateEquity(90_000, BASE_TIME + HOUR);
      guard.reset();

      const state = guard.getState();
      expect(state.peakEquity).toBe(0);
      expect(state.currentEquity).toBe(0);
      expect(guard.check(BASE_TIME).allowed).toBe(true);
    });
  });
});
