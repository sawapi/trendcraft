import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEarningsGuard } from "../earnings-guard.js";

describe("createEarningsGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set "now" to 2026-03-14 12:00 UTC
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for unknown symbol", () => {
    const guard = createEarningsGuard({ bufferDays: 2 });
    expect(guard.hasUpcomingEarnings("UNKNOWN")).toBe(false);
  });

  it("detects earnings within buffer days ahead", () => {
    const guard = createEarningsGuard({ bufferDays: 2 });
    guard.addEarnings([{ symbol: "AAPL", date: "2026-03-16" }]);
    // 2 days ahead, within buffer
    expect(guard.hasUpcomingEarnings("AAPL")).toBe(true);
  });

  it("detects earnings within bufferDaysAfter", () => {
    const guard = createEarningsGuard({ bufferDays: 2, bufferDaysAfter: 1 });
    guard.addEarnings([{ symbol: "AAPL", date: "2026-03-14" }]);
    // Same day = within after-buffer
    expect(guard.hasUpcomingEarnings("AAPL")).toBe(true);
  });

  it("does not detect earnings outside buffer window", () => {
    const guard = createEarningsGuard({ bufferDays: 2 });
    guard.addEarnings([{ symbol: "AAPL", date: "2026-03-20" }]);
    // 6 days ahead, outside 2-day buffer
    expect(guard.hasUpcomingEarnings("AAPL")).toBe(false);
  });

  it("skips invalid dates", () => {
    const guard = createEarningsGuard({ bufferDays: 2 });
    guard.addEarnings([{ symbol: "AAPL", date: "not-a-date" }]);
    expect(guard.hasUpcomingEarnings("AAPL")).toBe(false);
  });

  it("respects custom bufferDays", () => {
    const guard = createEarningsGuard({ bufferDays: 5 });
    guard.addEarnings([{ symbol: "AAPL", date: "2026-03-19" }]);
    // 5 days ahead, within custom 5-day buffer
    expect(guard.hasUpcomingEarnings("AAPL")).toBe(true);
  });

  it("getNextEarnings returns next date", () => {
    const guard = createEarningsGuard();
    guard.addEarnings([
      { symbol: "AAPL", date: "2026-03-20" },
      { symbol: "AAPL", date: "2026-06-15" },
    ]);
    expect(guard.getNextEarnings("AAPL")).toBe("2026-03-20");
  });

  it("getNextEarnings returns null for unknown symbol", () => {
    const guard = createEarningsGuard();
    expect(guard.getNextEarnings("UNKNOWN")).toBeNull();
  });
});
