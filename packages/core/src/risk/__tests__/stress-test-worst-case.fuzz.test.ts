import { describe, expect, it } from "vitest";
import { depthPercent } from "../../backtest/drawdown-tracker";
import { mulberry32 } from "../../core/random";
import { stressTest } from "../stress-test";

/**
 * The worst-case scan stressTest used before it read the shared drawdown
 * tracker, kept as the reference. One deliberate change: a new peak is taken
 * at `>=` rather than `>`, so on a flat stretch at the peak the drawdown
 * starts at the stretch's last bar, as the tracker and pyfolio do (see the
 * test below). The old scan started it at the first.
 */
function referenceWorstCase(equityCurve: number[]) {
  let peak = equityCurve[0];
  let peakIdx = 0;
  let worstDd = 0;
  let worstDdStart = 0;
  let worstDdEnd = 0;
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] >= peak) {
      peak = equityCurve[i];
      peakIdx = i;
    }
    const dd = depthPercent(peak, equityCurve[i]) / 100;
    if (dd > worstDd) {
      worstDd = dd;
      worstDdStart = peakIdx;
      worstDdEnd = i;
    }
  }
  const ddPeak = equityCurve[worstDdStart];
  let recoveryDays = 0;
  let recovered = worstDd === 0;
  for (let i = worstDdEnd + 1; !recovered && i < equityCurve.length; i++) {
    recoveryDays++;
    if (equityCurve[i] >= ddPeak) recovered = true;
  }
  return { drawdown: worstDd, duration: worstDdEnd - worstDdStart, recoveryDays, recovered };
}

const noShock = { name: "none", description: "", shocks: [] };

function curveOf(returns: number[]): number[] {
  const curve = [1];
  for (const r of returns) curve.push(curve[curve.length - 1] * (1 + r));
  return curve;
}

/** Return series drawn from shapes that stress the scan's edge cases. */
function randomReturns(random: () => number): number[] {
  const length = Math.floor(random() * 40);
  const shape = Math.floor(random() * 6);
  return Array.from({ length }, () => {
    const u = random();
    switch (shape) {
      case 0: // monotonic rise
        return u * 0.05;
      case 1: // only falls
        return -u * 0.2;
      case 2: // flat bars and exact round trips (equal peaks and equal depths)
        return [0, 0, 0.1, -0.1, 0.25, -0.2][Math.floor(u * 6)];
      case 3: // wipe-outs and beyond: equity at or below zero
        return u < 0.1 ? -1 - u : u - 0.5;
      default:
        return (u - 0.48) * 0.1;
    }
  });
}

describe("stressTest worstCase matches the reference scan", () => {
  it("agrees on 100,000 random curves", () => {
    const random = mulberry32(20261026);
    for (let n = 0; n < 100_000; n++) {
      const returns = randomReturns(random);
      const actual = stressTest(returns, noShock).worstCase;
      const expected = referenceWorstCase(curveOf(returns));
      if (
        actual.drawdown !== expected.drawdown ||
        actual.duration !== expected.duration ||
        actual.recoveryDays !== expected.recoveryDays ||
        actual.recovered !== expected.recovered
      ) {
        expect({ returns, actual }).toEqual({ returns, actual: expected });
      }
    }
  });

  it("agrees on the empty, one-bar and unbroken cases", () => {
    for (const returns of [[], [0.01], [-0.5], [0.01, 0.02, 0.03], [-0.1, -0.1, -0.1]]) {
      expect(stressTest(returns, noShock).worstCase, JSON.stringify(returns)).toEqual(
        referenceWorstCase(curveOf(returns)),
      );
    }
  });

  it("starts a drawdown at the last bar of a flat stretch at its peak", () => {
    // Equity 1 → 1.1 → 1.1 → 0.99: the decline starts at bar 2, one bar
    // before the trough, not at bar 1 where the old scan started it (as
    // pyfolio's get_max_drawdown_underwater takes the last bar at the peak).
    const { worstCase } = stressTest([0.1, 0, -0.1], noShock);
    expect(worstCase.duration).toBe(1);
    expect(worstCase.drawdown).toBeCloseTo(0.1, 12);
    expect(worstCase.recovered).toBe(false);
  });

  it("starts a drawdown at an exact return to the peak, not before the earlier dip", () => {
    // Equity 1 → 1.25 → 1 → 1.25 → 0.625. The first dip recovered at bar 3;
    // the worst drawdown is the second one, one bar long, not three bars
    // counted from bar 1 as the old scan reported.
    const { worstCase } = stressTest([0.25, -0.2, 0.25, -0.5], noShock);
    expect(worstCase.drawdown).toBeCloseTo(0.5, 12);
    expect(worstCase.duration).toBe(1);
    expect(worstCase.recovered).toBe(false);
  });
});
