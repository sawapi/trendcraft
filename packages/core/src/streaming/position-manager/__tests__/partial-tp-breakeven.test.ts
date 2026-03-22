import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { createPositionTracker } from "../position-tracker";

function makeCandle(overrides: Partial<NormalizedCandle> & { close: number }): NormalizedCandle {
  const c = overrides.close;
  return {
    time: overrides.time ?? 1000,
    open: overrides.open ?? c,
    high: overrides.high ?? c,
    low: overrides.low ?? c,
    close: c,
    volume: overrides.volume ?? 100,
  };
}

describe("Partial Take Profit", () => {
  it("should execute partial close when threshold is reached (long)", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
    });
    tracker.openPosition(100, 100, 1000);

    // Price rises to +5% → threshold at 105
    const result = tracker.updatePrice(makeCandle({ close: 106, high: 106, low: 100, time: 2000 }));

    expect(result.partialFills).toHaveLength(1);
    expect(result.partialFills[0].fill.reason).toBe("partial-take-profit");
    expect(result.partialFills[0].fill.shares).toBe(50); // 50% of 100
    expect(result.partialFills[0].trade.isPartial).toBe(true);
    expect(result.partialFills[0].trade.exitReason).toBe("partialTakeProfit");

    // Position still open with reduced shares
    const pos = tracker.getPosition()!;
    expect(pos.shares).toBe(50);
    expect(pos.partialTaken).toBe(true);
    expect(result.triggered).toBeNull();
  });

  it("should not fire partial TP a second time", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
    });
    tracker.openPosition(100, 100, 1000);

    // First trigger
    tracker.updatePrice(makeCandle({ close: 106, high: 106, low: 100, time: 2000 }));

    // Second candle still above threshold → should not trigger again
    const result = tracker.updatePrice(makeCandle({ close: 108, high: 108, low: 104, time: 3000 }));
    expect(result.partialFills).toHaveLength(0);

    // Still 50 shares
    expect(tracker.getPosition()!.shares).toBe(50);
  });

  it("should allow full TP after partial TP", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      takeProfit: 10,
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
    });
    tracker.openPosition(100, 100, 1000);

    // Partial TP at +5%
    const partial = tracker.updatePrice(
      makeCandle({ close: 106, high: 106, low: 100, time: 2000 }),
    );
    expect(partial.partialFills).toHaveLength(1);
    expect(tracker.getPosition()!.shares).toBe(50);

    // Full TP at +10% (110)
    const full = tracker.updatePrice(makeCandle({ close: 112, high: 112, low: 108, time: 3000 }));
    expect(full.triggered).not.toBeNull();
    expect(full.triggered!.reason).toBe("take-profit");
    expect(tracker.getPosition()).toBeNull();

    // Should have 2 trades: partial + full
    const trades = tracker.getTrades();
    expect(trades).toHaveLength(2);
    expect(trades[0].exitReason).toBe("partialTakeProfit");
    expect(trades[1].exitReason).toBe("takeProfit");
  });

  it("should allow SL after partial TP", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      stopLoss: 3,
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
    });
    tracker.openPosition(100, 100, 1000);

    // Partial TP at +5%
    tracker.updatePrice(makeCandle({ close: 106, high: 106, low: 100, time: 2000 }));
    expect(tracker.getPosition()!.shares).toBe(50);

    // SL at 97 (100 * 0.97)
    const slResult = tracker.updatePrice(makeCandle({ close: 96, high: 100, low: 96, time: 3000 }));
    expect(slResult.triggered).not.toBeNull();
    expect(slResult.triggered!.reason).toBe("stop-loss");
    expect(tracker.getPosition()).toBeNull();

    const trades = tracker.getTrades();
    expect(trades).toHaveLength(2);
    expect(trades[0].exitReason).toBe("partialTakeProfit");
    expect(trades[1].exitReason).toBe("stopLoss");
  });

  it("should execute partial close correctly for short positions", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      direction: "short",
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
    });
    tracker.openPosition(100, 100, 1000);

    // Short: profit when price drops → threshold at 95
    const result = tracker.updatePrice(makeCandle({ close: 94, high: 100, low: 94, time: 2000 }));

    expect(result.partialFills).toHaveLength(1);
    expect(result.partialFills[0].fill.reason).toBe("partial-take-profit");
    expect(result.partialFills[0].fill.side).toBe("buy"); // short cover
    expect(tracker.getPosition()!.shares).toBe(50);
    expect(tracker.getPosition()!.partialTaken).toBe(true);
  });
});

describe("Breakeven Stop", () => {
  it("should activate and trigger breakeven stop (long)", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      breakevenStop: { threshold: 5 },
    });
    tracker.openPosition(100, 100, 1000);

    // Price rises to +5% → activates breakeven (low stays above entry)
    const r1 = tracker.updatePrice(makeCandle({ close: 106, high: 106, low: 101, time: 2000 }));
    expect(r1.triggered).toBeNull();
    expect(tracker.getPosition()!.breakevenActivated).toBe(true);

    // Price drops back to entry → breakeven triggered
    const r2 = tracker.updatePrice(makeCandle({ close: 99, high: 103, low: 99, time: 3000 }));
    expect(r2.triggered).not.toBeNull();
    expect(r2.triggered!.reason).toBe("breakeven");
    expect(tracker.getPosition()).toBeNull();

    const trades = tracker.getTrades();
    expect(trades).toHaveLength(1);
    expect(trades[0].exitReason).toBe("breakeven");
    // Exit price should be at entry (100) since buffer is 0
    expect(trades[0].exitPrice).toBe(100);
  });

  it("should use buffer for breakeven stop price", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      breakevenStop: { threshold: 5, buffer: 1 },
    });
    tracker.openPosition(100, 100, 1000);

    // Activate at +5%
    tracker.updatePrice(makeCandle({ close: 106, high: 106, low: 104, time: 2000 }));
    expect(tracker.getPosition()!.breakevenActivated).toBe(true);

    // BE stop at 101 (entry + 1% buffer), low hits 100.5 → triggered
    const r2 = tracker.updatePrice(makeCandle({ close: 100, high: 103, low: 100, time: 3000 }));
    expect(r2.triggered).not.toBeNull();
    expect(r2.triggered!.reason).toBe("breakeven");

    const trades = tracker.getTrades();
    // Exit at 101 (breakeven stop price with buffer)
    expect(trades[0].exitPrice).toBe(101);
  });

  it("should trigger regular SL if breakeven not activated", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      stopLoss: 3,
      breakevenStop: { threshold: 5 },
    });
    tracker.openPosition(100, 100, 1000);

    // Price never reaches +5% → breakeven not activated
    // SL at 97
    const result = tracker.updatePrice(makeCandle({ close: 96, high: 100, low: 96, time: 2000 }));
    expect(result.triggered).not.toBeNull();
    expect(result.triggered!.reason).toBe("stop-loss");
    expect(tracker.getPosition()).toBeNull();
  });

  it("should work correctly for short positions", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      direction: "short",
      breakevenStop: { threshold: 5 },
    });
    tracker.openPosition(100, 100, 1000);

    // Short: profit when price drops → threshold at 95 (high stays below entry)
    tracker.updatePrice(makeCandle({ close: 94, high: 99, low: 94, time: 2000 }));
    expect(tracker.getPosition()!.breakevenActivated).toBe(true);

    // Price rises back to entry → breakeven triggered (short: high >= breakeven price)
    const r2 = tracker.updatePrice(makeCandle({ close: 101, high: 101, low: 98, time: 3000 }));
    expect(r2.triggered).not.toBeNull();
    expect(r2.triggered!.reason).toBe("breakeven");

    const trades = tracker.getTrades();
    expect(trades[0].exitReason).toBe("breakeven");
    // Short breakeven stop price = entry * (1 - 0/100) = 100
    expect(trades[0].exitPrice).toBe(100);
  });
});

describe("Partial TP + Breakeven Interaction", () => {
  it("should handle partial TP then breakeven activation and stop", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
      breakevenStop: { threshold: 5 },
    });
    tracker.openPosition(100, 100, 1000);

    // +5% → partial TP + breakeven activation (low stays above entry)
    const r1 = tracker.updatePrice(makeCandle({ close: 106, high: 106, low: 101, time: 2000 }));
    expect(r1.partialFills).toHaveLength(1);
    expect(r1.triggered).toBeNull();
    expect(tracker.getPosition()!.partialTaken).toBe(true);
    expect(tracker.getPosition()!.breakevenActivated).toBe(true);
    expect(tracker.getPosition()!.shares).toBe(50);

    // Price drops to entry → breakeven stop
    const r2 = tracker.updatePrice(makeCandle({ close: 99, high: 103, low: 99, time: 3000 }));
    expect(r2.triggered).not.toBeNull();
    expect(r2.triggered!.reason).toBe("breakeven");
    expect(tracker.getPosition()).toBeNull();

    const trades = tracker.getTrades();
    expect(trades).toHaveLength(2);
    expect(trades[0].exitReason).toBe("partialTakeProfit");
    expect(trades[1].exitReason).toBe("breakeven");
  });

  it("should handle partial TP + full close on same candle", () => {
    const tracker = createPositionTracker({
      capital: 100_000,
      takeProfit: 5,
      partialTakeProfit: { threshold: 3, sellPercent: 50 },
    });
    tracker.openPosition(100, 100, 1000);

    // Candle where high hits both partial TP (103) and full TP (105)
    // SL/TP check happens first (at 105), so full TP fires before partial
    const result = tracker.updatePrice(makeCandle({ close: 106, high: 106, low: 100, time: 2000 }));

    // Full TP fires first (checked before partial), position closed
    expect(result.triggered).not.toBeNull();
    expect(result.triggered!.reason).toBe("take-profit");
    expect(tracker.getPosition()).toBeNull();
  });
});

describe("State Persistence with Partial/Breakeven", () => {
  it("should preserve partialTaken and breakevenActivated across serialize/restore", () => {
    const tracker1 = createPositionTracker({
      capital: 100_000,
      partialTakeProfit: { threshold: 5, sellPercent: 50 },
      breakevenStop: { threshold: 5 },
    });
    tracker1.openPosition(100, 100, 1000);

    // Activate both (low stays above entry to avoid breakeven triggering)
    tracker1.updatePrice(makeCandle({ close: 106, high: 106, low: 101, time: 2000 }));

    const state = tracker1.getState();
    const serialized = JSON.parse(JSON.stringify(state));

    const tracker2 = createPositionTracker(
      {
        capital: 100_000,
        partialTakeProfit: { threshold: 5, sellPercent: 50 },
        breakevenStop: { threshold: 5 },
      },
      serialized,
    );

    const pos = tracker2.getPosition()!;
    expect(pos.partialTaken).toBe(true);
    expect(pos.breakevenActivated).toBe(true);
    expect(pos.shares).toBe(50);

    // Breakeven stop should still work after restore
    const result = tracker2.updatePrice(makeCandle({ close: 99, high: 103, low: 99, time: 3000 }));
    expect(result.triggered).not.toBeNull();
    expect(result.triggered!.reason).toBe("breakeven");
  });
});
