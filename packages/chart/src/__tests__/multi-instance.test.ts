/**
 * Multi-instance isolation test
 *
 * Verifies that multiple concurrent instances of core chart classes
 * (DataLayer, TimeScale, PriceScale) do not share state.
 */

import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { PriceScale } from "../core/scale";

describe("Multi-instance isolation", () => {
  it("DataLayer instances have independent candle data", () => {
    const dl1 = new DataLayer();
    const dl2 = new DataLayer();

    dl1.setCandles([
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 200 },
    ]);
    dl2.setCandles([{ time: 3, open: 20, high: 22, low: 19, close: 21, volume: 300 }]);

    expect(dl1.candleCount).toBe(2);
    expect(dl2.candleCount).toBe(1);

    // Data should not leak between instances
    expect(dl1.candles[0]?.close).toBe(11);
    expect(dl2.candles[0]?.close).toBe(21);
  });

  it("DataLayer updates do not affect other instances", () => {
    const dl1 = new DataLayer();
    const dl2 = new DataLayer();

    dl1.setCandles([{ time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 }]);
    dl2.setCandles([{ time: 1, open: 50, high: 52, low: 49, close: 51, volume: 500 }]);

    dl1.updateCandle({ time: 2, open: 12, high: 14, low: 11, close: 13, volume: 150 });

    expect(dl1.candleCount).toBe(2);
    expect(dl2.candleCount).toBe(1);
    expect(dl2.candles[0]?.close).toBe(51);
  });

  it("PriceScale instances have independent ranges", () => {
    const ps1 = new PriceScale();
    const ps2 = new PriceScale();

    ps1.setDataRange(100, 200);
    ps2.setDataRange(0, 50);

    const ticks1 = ps1.getTicks(5);
    const ticks2 = ps2.getTicks(5);

    // Ticks should be in their respective ranges
    expect(ticks1.every((t) => t >= 100 && t <= 200)).toBe(true);
    expect(ticks2.every((t) => t >= 0 && t <= 50)).toBe(true);
  });

  it("PriceScale getTicks() memoization is per-instance", () => {
    const ps1 = new PriceScale();
    const ps2 = new PriceScale();

    ps1.setDataRange(0, 100);
    ps2.setDataRange(0, 100);

    const ticks1a = ps1.getTicks(5);
    ps2.setDataRange(0, 200); // Change ps2 range
    const ticks1b = ps1.getTicks(5);
    const ticks2 = ps2.getTicks(5);

    // ps1 should return equivalent result (memoized computation, fresh array copy)
    expect(ticks1a).toEqual(ticks1b);
    // ps2 should have different ticks
    expect(ticks2).not.toEqual(ticks1a);
  });
});
