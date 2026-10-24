import { describe, expect, it } from "vitest";
import { depthPercent, maxDrawdownPercent } from "../drawdown-tracker";

describe("depthPercent", () => {
  it("measures the decline as a percentage of the peak", () => {
    expect(depthPercent(200, 150)).toBe(25);
    expect(depthPercent(100, 100)).toBe(0);
  });

  it("goes past 100 when equity falls below zero", () => {
    expect(depthPercent(100, -50)).toBe(150);
  });

  it("reports 0 for a non-positive peak instead of a sign-flipped or infinite figure", () => {
    expect(depthPercent(0, -10)).toBe(0);
    expect(depthPercent(-20, -40)).toBe(0);
  });
});

describe("maxDrawdownPercent", () => {
  it("returns the deepest decline from the running peak", () => {
    expect(maxDrawdownPercent([100, 120, 90, 130, 117])).toBe(25);
  });

  it("is 0 for an empty, flat or rising curve", () => {
    expect(maxDrawdownPercent([])).toBe(0);
    expect(maxDrawdownPercent([100, 100])).toBe(0);
    expect(maxDrawdownPercent([100, 110, 120])).toBe(0);
  });

  it("measures from startPeak when the curve does not begin with it", () => {
    expect(maxDrawdownPercent([80, 90], 100)).toBe(20);
  });

  it("stays finite on a curve that never has a positive peak", () => {
    // Hand-written loops divided by the peak here: -Infinity, NaN or a
    // negative "drawdown" for a falling account.
    expect(maxDrawdownPercent([0, -10, -30])).toBe(0);
    expect(maxDrawdownPercent([-10, -5, -30])).toBe(0);
  });
});
