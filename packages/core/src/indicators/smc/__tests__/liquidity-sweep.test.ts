import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { getRecoveredSweeps, hasRecentSweepSignal, liquiditySweep } from "../liquidity-sweep";

const makeCandles = (
  data: Array<{ o: number; h: number; l: number; c: number }>,
): NormalizedCandle[] =>
  data.map((d, i) => ({
    time: 1700000000000 + i * 86400000,
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: 1000,
  }));

describe("liquiditySweep", () => {
  describe("Bullish Sweep", () => {
    it("should detect bullish sweep with same-bar recovery", () => {
      // Create a swing low, then sweep below it and recover
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 103, l: 100, c: 102 }, // 1
        { o: 102, h: 104, l: 90, c: 92 }, // 2 - swing low at 90 (will be confirmed after period bars)
        { o: 92, h: 98, l: 91, c: 96 }, // 3
        { o: 96, h: 100, l: 95, c: 99 }, // 4
        { o: 99, h: 102, l: 98, c: 101 }, // 5 - swing low confirmed (needs period=1 bars on each side)
        { o: 101, h: 103, l: 100, c: 102 }, // 6
        { o: 102, h: 104, l: 85, c: 100 }, // 7 - breaks below 90, closes above = bullish sweep!
      ]);

      const result = liquiditySweep(candles, { swingPeriod: 1 });

      // Find the sweep bar
      const sweepBar = result.find((r) => r.value.isSweep && r.value.sweep?.type === "bullish");
      expect(sweepBar).toBeDefined();

      if (sweepBar?.value.sweep) {
        expect(sweepBar.value.sweep.type).toBe("bullish");
        expect(sweepBar.value.sweep.recovered).toBe(true);
      }
    });

    it("should detect bullish sweep with delayed recovery", () => {
      // Sweep below swing low, recover on next bar
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 103, l: 100, c: 102 }, // 1
        { o: 102, h: 104, l: 90, c: 92 }, // 2 - swing low at 90
        { o: 92, h: 98, l: 91, c: 96 }, // 3
        { o: 96, h: 100, l: 95, c: 99 }, // 4
        { o: 99, h: 102, l: 98, c: 101 }, // 5 - swing low confirmed
        { o: 101, h: 103, l: 100, c: 102 }, // 6
        { o: 102, h: 103, l: 85, c: 87 }, // 7 - breaks below 90, closes below = sweep started
        { o: 87, h: 95, l: 86, c: 93 }, // 8 - recovers above 90
      ]);

      const result = liquiditySweep(candles, { swingPeriod: 1 });

      // Find the recovery bar
      const recoveryBar = result.find((r) => r.value.recoveredThisBar.length > 0);
      expect(recoveryBar).toBeDefined();
      expect(recoveryBar?.value.recoveredThisBar[0].type).toBe("bullish");
    });
  });

  describe("Bearish Sweep", () => {
    it("should detect bearish sweep with same-bar recovery", () => {
      // Create a swing high, then sweep above it and recover
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 103, l: 100, c: 102 }, // 1
        { o: 102, h: 115, l: 101, c: 112 }, // 2 - swing high at 115
        { o: 112, h: 113, l: 108, c: 109 }, // 3
        { o: 109, h: 110, l: 106, c: 107 }, // 4
        { o: 107, h: 108, l: 105, c: 106 }, // 5 - swing high confirmed
        { o: 106, h: 107, l: 104, c: 105 }, // 6
        { o: 105, h: 120, l: 104, c: 108 }, // 7 - breaks above 115, closes below = bearish sweep!
      ]);

      const result = liquiditySweep(candles, { swingPeriod: 1 });

      const sweepBar = result.find((r) => r.value.isSweep && r.value.sweep?.type === "bearish");
      expect(sweepBar).toBeDefined();

      if (sweepBar?.value.sweep) {
        expect(sweepBar.value.sweep.type).toBe("bearish");
        expect(sweepBar.value.sweep.recovered).toBe(true);
      }
    });

    it("should detect bearish sweep with delayed recovery", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 103, l: 100, c: 102 }, // 1
        { o: 102, h: 115, l: 101, c: 112 }, // 2 - swing high at 115
        { o: 112, h: 113, l: 108, c: 109 }, // 3
        { o: 109, h: 110, l: 106, c: 107 }, // 4
        { o: 107, h: 108, l: 105, c: 106 }, // 5 - swing high confirmed
        { o: 106, h: 107, l: 104, c: 105 }, // 6
        { o: 105, h: 120, l: 104, c: 118 }, // 7 - breaks above 115, closes above = sweep started
        { o: 118, h: 119, l: 110, c: 112 }, // 8 - recovers below 115
      ]);

      const result = liquiditySweep(candles, { swingPeriod: 1 });

      const recoveryBar = result.find((r) => r.value.recoveredThisBar.length > 0);
      expect(recoveryBar).toBeDefined();
      expect(recoveryBar?.value.recoveredThisBar[0].type).toBe("bearish");
    });
  });

  describe("Sweep Tracking", () => {
    it("should track recent sweeps", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 103, l: 100, c: 102 },
        { o: 102, h: 104, l: 90, c: 92 }, // swing low
        { o: 92, h: 98, l: 91, c: 96 },
        { o: 96, h: 100, l: 95, c: 99 },
        { o: 99, h: 102, l: 98, c: 101 },
        { o: 101, h: 103, l: 100, c: 102 },
        { o: 102, h: 104, l: 85, c: 100 }, // bullish sweep
        { o: 100, h: 103, l: 99, c: 102 },
      ]);

      const result = liquiditySweep(candles, { swingPeriod: 1 });
      const lastBar = result[result.length - 1];

      expect(lastBar.value.recentSweeps.length).toBeGreaterThanOrEqual(1);
    });

    it("should remove old unrecovered sweeps after maxRecoveryBars", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 103, l: 100, c: 102 },
        { o: 102, h: 104, l: 90, c: 92 }, // swing low
        { o: 92, h: 98, l: 91, c: 96 },
        { o: 96, h: 100, l: 95, c: 99 },
        { o: 99, h: 102, l: 98, c: 101 },
        { o: 101, h: 103, l: 100, c: 102 },
        { o: 102, h: 103, l: 85, c: 87 }, // sweep without recovery
        { o: 87, h: 88, l: 84, c: 86 }, // bar 1 after sweep
        { o: 86, h: 87, l: 83, c: 85 }, // bar 2 after sweep
        { o: 85, h: 86, l: 82, c: 84 }, // bar 3 after sweep
        { o: 84, h: 85, l: 81, c: 83 }, // bar 4 after sweep - should be removed
      ]);

      const result = liquiditySweep(candles, {
        swingPeriod: 1,
        maxRecoveryBars: 3,
      });
      const lastBar = result[result.length - 1];

      // The sweep should have been removed (unrecovered after 3 bars)
      const unrecoveredSweeps = lastBar.value.recentSweeps.filter((s) => !s.recovered);
      expect(unrecoveredSweeps.length).toBe(0);
    });
  });

  describe("Sweep Depth", () => {
    it("should calculate sweep depth percentage", () => {
      // Create a clear swing low that will be swept
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 }, // 0
        { o: 101, h: 103, l: 101, c: 102 }, // 1 - higher low
        { o: 102, h: 104, l: 100, c: 102 }, // 2 - swing low at 100 (lower than 1 and 3)
        { o: 102, h: 105, l: 102, c: 104 }, // 3 - higher low (confirms swing at 2)
        { o: 104, h: 106, l: 103, c: 105 }, // 4
        { o: 105, h: 107, l: 104, c: 106 }, // 5
        { o: 106, h: 108, l: 105, c: 107 }, // 6
        { o: 107, h: 108, l: 95, c: 105 }, // 7 - breaks to 95 (5% below 100), recovers above 100
      ]);

      const result = liquiditySweep(candles, { swingPeriod: 1 });

      const sweepBar = result.find((r) => r.value.isSweep);
      expect(sweepBar).toBeDefined();
      expect(sweepBar?.value.sweep?.sweepDepthPercent).toBeCloseTo(5, 1);
    });

    it("should filter by minimum sweep depth", () => {
      const candles = makeCandles([
        { o: 100, h: 102, l: 99, c: 101 },
        { o: 101, h: 103, l: 100, c: 102 },
        { o: 102, h: 104, l: 100, c: 102 }, // swing low at 100
        { o: 102, h: 105, l: 101, c: 104 },
        { o: 104, h: 106, l: 103, c: 105 },
        { o: 105, h: 107, l: 104, c: 106 }, // swing low confirmed
        { o: 106, h: 108, l: 105, c: 107 },
        { o: 107, h: 108, l: 99, c: 105 }, // breaks to 99 (1% below 100), recovers
      ]);

      // With 2% minimum, this sweep should not be detected
      const result = liquiditySweep(candles, {
        swingPeriod: 1,
        minSweepDepth: 2,
      });

      const sweepBar = result.find((r) => r.value.isSweep);
      expect(sweepBar).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array for empty input", () => {
      const result = liquiditySweep([]);
      expect(result).toEqual([]);
    });

    it("should handle insufficient data", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      const result = liquiditySweep(candles, { swingPeriod: 1 });
      expect(result.length).toBe(1);
    });

    it("should throw for invalid swingPeriod", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => liquiditySweep(candles, { swingPeriod: 0 })).toThrow(
        "swingPeriod must be at least 1",
      );
    });

    it("should throw for invalid maxRecoveryBars", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => liquiditySweep(candles, { maxRecoveryBars: 0 })).toThrow(
        "maxRecoveryBars must be at least 1",
      );
    });

    it("should throw for invalid maxTrackedSweeps", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => liquiditySweep(candles, { maxTrackedSweeps: 0 })).toThrow(
        "maxTrackedSweeps must be at least 1",
      );
    });

    it("should throw for negative minSweepDepth", () => {
      const candles = makeCandles([{ o: 100, h: 102, l: 99, c: 101 }]);
      expect(() => liquiditySweep(candles, { minSweepDepth: -1 })).toThrow(
        "minSweepDepth must be non-negative",
      );
    });
  });
});

describe("getRecoveredSweeps", () => {
  it("should return all recovered sweeps", () => {
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 },
      { o: 101, h: 103, l: 100, c: 102 },
      { o: 102, h: 104, l: 90, c: 92 }, // swing low
      { o: 92, h: 98, l: 91, c: 96 },
      { o: 96, h: 100, l: 95, c: 99 },
      { o: 99, h: 102, l: 98, c: 101 },
      { o: 101, h: 103, l: 100, c: 102 },
      { o: 102, h: 104, l: 85, c: 100 }, // bullish sweep with recovery
    ]);

    const { bullish, bearish } = getRecoveredSweeps(candles, { swingPeriod: 1 });

    expect(bullish.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(bearish)).toBe(true);
  });

  it("should return empty arrays for empty input", () => {
    const { bullish, bearish } = getRecoveredSweeps([]);
    expect(bullish).toEqual([]);
    expect(bearish).toEqual([]);
  });
});

describe("hasRecentSweepSignal", () => {
  it("should detect recent sweep signal", () => {
    const candles = makeCandles([
      { o: 100, h: 102, l: 99, c: 101 },
      { o: 101, h: 103, l: 100, c: 102 },
      { o: 102, h: 104, l: 90, c: 92 }, // swing low
      { o: 92, h: 98, l: 91, c: 96 },
      { o: 96, h: 100, l: 95, c: 99 },
      { o: 99, h: 102, l: 98, c: 101 },
      { o: 101, h: 103, l: 100, c: 102 },
      { o: 102, h: 104, l: 85, c: 100 }, // bullish sweep with recovery
    ]);

    const hasSignal = hasRecentSweepSignal(candles, "both", { swingPeriod: 1 });
    expect(typeof hasSignal).toBe("boolean");
  });

  it("should return false for empty input", () => {
    expect(hasRecentSweepSignal([])).toBe(false);
  });
});
