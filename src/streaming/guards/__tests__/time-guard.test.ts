import { describe, it, expect } from "vitest";
import { createTimeGuard } from "../time-guard";

const HOUR = 3600_000;
const MINUTE = 60_000;

// JST timezone offset
const JST_OFFSET = 9 * HOUR;

/**
 * Helper: create a UTC timestamp for a specific JST time on 2024-01-15
 * e.g., jstTime(9, 30) → 2024-01-15 09:30 JST = 2024-01-15 00:30 UTC
 */
function jstTime(hours: number, minutes = 0): number {
  return Date.UTC(2024, 0, 15, hours - 9, minutes, 0);
}

describe("createTimeGuard", () => {
  // Tokyo Stock Exchange hours: 9:00-11:30, 12:30-15:00 JST
  const TSE_WINDOWS = [
    { startMs: 9 * HOUR, endMs: 11.5 * HOUR },
    { startMs: 12.5 * HOUR, endMs: 15 * HOUR },
  ];

  describe("trading windows", () => {
    it("should allow trading within a window", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
      });

      // 10:00 JST — within morning session
      const result = guard.check(jstTime(10, 0));
      expect(result.allowed).toBe(true);
      expect(result.shouldForceClose).toBe(false);
    });

    it("should allow trading at window start", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
      });

      // 9:00 JST — exactly at window start
      expect(guard.check(jstTime(9, 0)).allowed).toBe(true);
    });

    it("should block trading outside all windows", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
      });

      // 8:00 JST — before morning session
      const result = guard.check(jstTime(8, 0));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Outside trading window");
    });

    it("should block during lunch break", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
      });

      // 12:00 JST — lunch break
      expect(guard.check(jstTime(12, 0)).allowed).toBe(false);
    });

    it("should block at window end (exclusive)", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
      });

      // 11:30 JST — exactly at morning session end (exclusive)
      expect(guard.check(jstTime(11, 30)).allowed).toBe(false);
    });

    it("should allow in afternoon session", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
      });

      // 14:00 JST — afternoon session
      expect(guard.check(jstTime(14, 0)).allowed).toBe(true);
    });

    it("should block after market close", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
      });

      // 15:30 JST — after close
      expect(guard.check(jstTime(15, 30)).allowed).toBe(false);
    });
  });

  describe("overnight windows", () => {
    it("should handle overnight window (startMs > endMs)", () => {
      const guard = createTimeGuard({
        tradingWindows: [
          { startMs: 22 * HOUR, endMs: 6 * HOUR }, // 22:00 - 06:00
        ],
        timezoneOffsetMs: 0,
      });

      // 23:00 UTC — in window (evening part)
      expect(guard.check(Date.UTC(2024, 0, 15, 23, 0, 0)).allowed).toBe(true);

      // 03:00 UTC — in window (morning part)
      expect(guard.check(Date.UTC(2024, 0, 16, 3, 0, 0)).allowed).toBe(true);

      // 12:00 UTC — outside window
      expect(guard.check(Date.UTC(2024, 0, 15, 12, 0, 0)).allowed).toBe(false);
    });
  });

  describe("forceCloseBeforeEndMs", () => {
    it("should signal force-close near window end", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
        forceCloseBeforeEndMs: 5 * MINUTE,
      });

      // 11:26 JST — 4 minutes before morning session end → force-close zone
      const result = guard.check(jstTime(11, 26));
      expect(result.allowed).toBe(false);
      expect(result.shouldForceClose).toBe(true);
      expect(result.reason).toContain("Force-close");
    });

    it("should not signal force-close when far from window end", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
        forceCloseBeforeEndMs: 5 * MINUTE,
      });

      // 10:00 JST — well within window
      const result = guard.check(jstTime(10, 0));
      expect(result.allowed).toBe(true);
      expect(result.shouldForceClose).toBe(false);
    });

    it("should signal force-close at exact boundary", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
        forceCloseBeforeEndMs: 5 * MINUTE,
      });

      // 11:25 JST — exactly 5 minutes before end
      const result = guard.check(jstTime(11, 25));
      expect(result.allowed).toBe(false);
      expect(result.shouldForceClose).toBe(true);
    });

    it("should signal force-close for afternoon session", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
        forceCloseBeforeEndMs: 10 * MINUTE,
      });

      // 14:52 JST — 8 minutes before 15:00 end
      const result = guard.check(jstTime(14, 52));
      expect(result.allowed).toBe(false);
      expect(result.shouldForceClose).toBe(true);
    });
  });

  describe("blackout periods", () => {
    it("should block during blackout period", () => {
      const blackoutStart = Date.UTC(2024, 0, 15, 10, 0, 0); // 19:00 JST
      const blackoutEnd = Date.UTC(2024, 0, 15, 10, 30, 0); // 19:30 JST

      const guard = createTimeGuard({
        tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }], // 24h window
        timezoneOffsetMs: 0,
        blackoutPeriods: [
          {
            startTime: blackoutStart,
            endTime: blackoutEnd,
            reason: "FOMC announcement",
          },
        ],
      });

      // During blackout
      const result = guard.check(blackoutStart + 5 * MINUTE);
      expect(result.allowed).toBe(false);
      expect(result.shouldForceClose).toBe(true);
      expect(result.reason).toContain("FOMC announcement");
    });

    it("should allow after blackout ends", () => {
      const blackoutEnd = Date.UTC(2024, 0, 15, 10, 30, 0);

      const guard = createTimeGuard({
        tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }],
        timezoneOffsetMs: 0,
        blackoutPeriods: [
          {
            startTime: Date.UTC(2024, 0, 15, 10, 0, 0),
            endTime: blackoutEnd,
          },
        ],
      });

      // After blackout
      expect(guard.check(blackoutEnd).allowed).toBe(true);
    });

    it("should take priority over trading windows", () => {
      const guard = createTimeGuard({
        tradingWindows: TSE_WINDOWS,
        timezoneOffsetMs: JST_OFFSET,
        blackoutPeriods: [
          {
            startTime: jstTime(10, 0),
            endTime: jstTime(10, 30),
            reason: "BOJ announcement",
          },
        ],
      });

      // 10:15 JST — within morning session but blackout active
      const result = guard.check(jstTime(10, 15));
      expect(result.allowed).toBe(false);
      expect(result.shouldForceClose).toBe(true);
      expect(result.reason).toContain("BOJ announcement");
    });

    it("should default reason when none provided", () => {
      const guard = createTimeGuard({
        tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }],
        timezoneOffsetMs: 0,
        blackoutPeriods: [
          {
            startTime: Date.UTC(2024, 0, 15, 10, 0, 0),
            endTime: Date.UTC(2024, 0, 15, 10, 30, 0),
          },
        ],
      });

      const result = guard.check(Date.UTC(2024, 0, 15, 10, 15, 0));
      expect(result.reason).toBe("Blackout period active");
    });
  });

  describe("addBlackout", () => {
    it("should dynamically add blackout periods", () => {
      const guard = createTimeGuard({
        tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }],
        timezoneOffsetMs: 0,
      });

      const t = Date.UTC(2024, 0, 15, 14, 0, 0);
      expect(guard.check(t).allowed).toBe(true);

      guard.addBlackout({
        startTime: t - 5 * MINUTE,
        endTime: t + 30 * MINUTE,
        reason: "CPI release",
      });

      const result = guard.check(t);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("CPI release");
    });
  });

  describe("timezone handling", () => {
    it("should default to UTC when no timezone offset", () => {
      const guard = createTimeGuard({
        tradingWindows: [{ startMs: 9 * HOUR, endMs: 15 * HOUR }],
      });

      // 10:00 UTC
      expect(guard.check(Date.UTC(2024, 0, 15, 10, 0, 0)).allowed).toBe(true);
      // 08:00 UTC
      expect(guard.check(Date.UTC(2024, 0, 15, 8, 0, 0)).allowed).toBe(false);
    });

    it("should correctly apply timezone offset", () => {
      // US Eastern = UTC-5 → offset = -5 * HOUR
      const guard = createTimeGuard({
        tradingWindows: [
          { startMs: 9.5 * HOUR, endMs: 16 * HOUR }, // NYSE 9:30-16:00 ET
        ],
        timezoneOffsetMs: -5 * HOUR,
      });

      // 14:30 UTC = 09:30 ET → allowed
      expect(guard.check(Date.UTC(2024, 0, 15, 14, 30, 0)).allowed).toBe(true);
      // 14:00 UTC = 09:00 ET → not yet
      expect(guard.check(Date.UTC(2024, 0, 15, 14, 0, 0)).allowed).toBe(false);
      // 21:00 UTC = 16:00 ET → closed
      expect(guard.check(Date.UTC(2024, 0, 15, 21, 0, 0)).allowed).toBe(false);
    });
  });

  describe("state persistence", () => {
    it("should persist blackout periods", () => {
      const guard1 = createTimeGuard({
        tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }],
        timezoneOffsetMs: 0,
      });

      guard1.addBlackout({
        startTime: 1000,
        endTime: 2000,
        reason: "test",
      });

      const state = JSON.parse(JSON.stringify(guard1.getState()));
      const guard2 = createTimeGuard(
        {
          tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }],
          timezoneOffsetMs: 0,
        },
        state,
      );

      expect(guard2.getState().blackoutPeriods).toHaveLength(1);
      expect(guard2.getState().blackoutPeriods[0].reason).toBe("test");
    });

    it("should use fromState blackouts over options blackouts", () => {
      const guard = createTimeGuard(
        {
          tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }],
          blackoutPeriods: [
            { startTime: 100, endTime: 200, reason: "from options" },
          ],
        },
        {
          blackoutPeriods: [
            { startTime: 300, endTime: 400, reason: "from state" },
          ],
        },
      );

      const periods = guard.getState().blackoutPeriods;
      expect(periods).toHaveLength(1);
      expect(periods[0].reason).toBe("from state");
    });

    it("should not mutate state when addBlackout is called", () => {
      const guard = createTimeGuard({
        tradingWindows: [{ startMs: 0, endMs: 24 * HOUR }],
      });

      const state1 = guard.getState();
      guard.addBlackout({ startTime: 1000, endTime: 2000 });
      const state2 = guard.getState();

      expect(state1.blackoutPeriods).toHaveLength(0);
      expect(state2.blackoutPeriods).toHaveLength(1);
    });
  });
});
