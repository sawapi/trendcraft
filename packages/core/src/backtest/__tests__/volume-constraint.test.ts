import { describe, expect, it } from "vitest";
import type { ConditionFn, NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";

/** Flat market: price never moves, so a backtest's final capital must equal
 *  the initial capital (minus any fees) regardless of how shares were sized. */
function flatCandles(count: number, price = 100, volume = 100): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1_700_000_000_000 + i * 86_400_000,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price,
    volume,
  }));
}

const enterAt =
  (index: number): ConditionFn =>
  (_ind, _candle, i) =>
    i === index;
const never: ConditionFn = () => false;

describe("backtest volumeConstraint capital conservation", () => {
  it("a volume-constrained partial fill does not erase un-deployed capital (flat market)", () => {
    const candles = flatCandles(30);
    // maxVolumePercent 10 on volume 100 caps the order at 10 shares, far below
    // the ~10,000 shares the full capital would buy at price 100 — a partial fill.
    const result = runBacktest(candles, enterAt(2), never, {
      capital: 1_000_000,
      volumeConstraint: { maxVolumePercent: 10 },
    });
    expect(result.trades.length).toBe(1);
    // Flat market → final capital must be ~initial (no fees configured here).
    // Before the fix this returned ~1,000 (a 99.9% phantom loss).
    expect(result.finalCapital).toBeCloseTo(1_000_000, 6);
  });

  it("a non-binding volume constraint behaves identically to no constraint", () => {
    const candles = flatCandles(30);
    const base = runBacktest(candles, enterAt(2), never, { capital: 1_000_000 });
    const loose = runBacktest(candles, enterAt(2), never, {
      capital: 1_000_000,
      // Huge cap → never shrinks the order → full fill, identical to no constraint.
      volumeConstraint: { maxVolumePercent: 1_000_000 },
    });
    expect(loose.finalCapital).toBe(base.finalCapital);
    expect(loose.trades.length).toBe(base.trades.length);
  });

  it("conserves capital across a constrained round-trip (entry + exit on flat market)", () => {
    const candles = flatCandles(30);
    const result = runBacktest(candles, enterAt(2), enterAt(20), {
      capital: 1_000_000,
      volumeConstraint: { maxVolumePercent: 10 },
    });
    expect(result.trades.length).toBe(1);
    expect(result.finalCapital).toBeCloseTo(1_000_000, 6);
  });

  it("charges percentage commission only on the filled notional, not the full order", () => {
    const candles = flatCandles(30);
    // 10 shares @ 100 = 1,000 filled notional. A 1% rate is ~10 entry + ~10 exit
    // commission → final ≈ 999,980. The earlier fix erroneously charged 1% of the
    // full 1,000,000 available capital (~10,000), which would land near 990,000.
    const result = runBacktest(candles, enterAt(2), enterAt(20), {
      capital: 1_000_000,
      commissionRate: 1,
      volumeConstraint: { maxVolumePercent: 10 },
    });
    expect(result.trades.length).toBe(1);
    // Fees are on the ~1,000 filled notional, so only tens of currency units —
    // not the ~10,000 the full-capital commission would have removed.
    expect(result.finalCapital).toBeGreaterThan(999_900);
    expect(result.finalCapital).toBeLessThanOrEqual(1_000_000);
  });

  it("FOK (partialFill: false) rejects a volume-constrained entry rather than deploying capital", () => {
    const candles = flatCandles(30);
    const result = runBacktest(candles, enterAt(2), never, {
      capital: 1_000_000,
      volumeConstraint: { maxVolumePercent: 10, partialFill: false },
    });
    // Order can't fully fill within the volume cap → no trade, capital untouched.
    expect(result.trades.length).toBe(0);
    expect(result.finalCapital).toBe(1_000_000);
  });
});
