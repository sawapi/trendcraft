import { describe, expect, it } from "vitest";
import { createPortfolioGuard } from "../portfolio-guard";

describe("createPortfolioGuard", () => {
  it("should allow position when no limits set", () => {
    const guard = createPortfolioGuard({});
    guard.updateEquity(100_000);
    const result = guard.canOpenPosition("AAPL", 20_000);
    expect(result.allowed).toBe(true);
  });

  it("should block when max open positions reached", () => {
    const guard = createPortfolioGuard({ maxOpenPositions: 2 });
    guard.updateEquity(100_000);
    guard.reportPositionOpen("AAPL", 20_000);
    guard.reportPositionOpen("MSFT", 20_000);
    const result = guard.canOpenPosition("GOOGL", 20_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Max open positions");
  });

  it("should allow after position close frees a slot", () => {
    const guard = createPortfolioGuard({ maxOpenPositions: 2 });
    guard.updateEquity(100_000);
    guard.reportPositionOpen("AAPL", 20_000);
    guard.reportPositionOpen("MSFT", 20_000);
    guard.reportPositionClose("AAPL", 20_000, 500);
    const result = guard.canOpenPosition("GOOGL", 20_000);
    expect(result.allowed).toBe(true);
  });

  it("should block when total exposure exceeds limit", () => {
    const guard = createPortfolioGuard({ maxTotalExposure: 100 });
    guard.updateEquity(100_000);
    guard.reportPositionOpen("AAPL", 60_000);
    const result = guard.canOpenPosition("MSFT", 50_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Total exposure");
  });

  it("should block when symbol exposure exceeds limit", () => {
    const guard = createPortfolioGuard({ maxSymbolExposure: 25 });
    guard.updateEquity(100_000);
    const result = guard.canOpenPosition("AAPL", 30_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Symbol AAPL exposure");
  });

  it("should block when portfolio drawdown exceeds limit", () => {
    const guard = createPortfolioGuard({ maxPortfolioDrawdown: 10 });
    guard.updateEquity(100_000); // peak = 100k
    guard.reportPositionClose("AAPL", 20_000, -15_000);
    // equity now 85k, drawdown = 15%
    const result = guard.canOpenPosition("MSFT", 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Portfolio drawdown");
  });

  it("should block when correlated group exposure exceeds limit", () => {
    const guard = createPortfolioGuard({
      maxCorrelatedExposure: 40,
      correlationGroups: [["AAPL", "MSFT", "GOOGL"]],
    });
    guard.updateEquity(100_000);
    guard.reportPositionOpen("AAPL", 25_000);
    guard.reportPositionOpen("MSFT", 10_000);
    const result = guard.canOpenPosition("GOOGL", 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Correlated group exposure");
  });

  it("should return exposure summary", () => {
    const guard = createPortfolioGuard({});
    guard.updateEquity(100_000);
    guard.reportPositionOpen("AAPL", 30_000);
    guard.reportPositionOpen("MSFT", 20_000);
    const exposure = guard.getExposure();
    expect(exposure.totalPercent).toBe(50);
    expect(exposure.bySymbol.AAPL).toBe(30);
    expect(exposure.bySymbol.MSFT).toBe(20);
    expect(exposure.openPositions).toBe(2);
  });

  it("should serialize and restore state", () => {
    const guard = createPortfolioGuard({ maxOpenPositions: 5 });
    guard.updateEquity(100_000);
    guard.reportPositionOpen("AAPL", 30_000);
    const state = guard.getState();

    const restored = createPortfolioGuard({ maxOpenPositions: 5 }, state);
    const exposure = restored.getExposure();
    expect(exposure.openPositions).toBe(1);
    expect(exposure.bySymbol.AAPL).toBe(30);
  });

  it("should reset all state", () => {
    const guard = createPortfolioGuard({});
    guard.updateEquity(100_000);
    guard.reportPositionOpen("AAPL", 30_000);
    guard.reset();
    const exposure = guard.getExposure();
    expect(exposure.totalPercent).toBe(0);
    expect(exposure.openPositions).toBe(0);
  });
});
