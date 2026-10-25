/**
 * Degenerate price ranges in PriceScale.
 *
 * A flat range used to be widened multiplicatively, which does nothing at 0
 * (line on the bottom edge, no ticks) and inverts the axis for a negative
 * value. getTicks returned its internal cache on a hit, so a caller mutating
 * the result corrupted later frames.
 */

import { describe, expect, it } from "vitest";
import { PriceScale } from "../core/scale";

function scale(min: number, max: number): PriceScale {
  const ps = new PriceScale();
  ps.setHeight(400);
  ps.setDataRange(min, max);
  return ps;
}

describe("PriceScale.setDataRange with a flat range", () => {
  it("centres a flat range at 0 and still produces ticks", () => {
    const ps = scale(0, 0);
    expect(ps.priceToY(0)).toBeCloseTo(200, 6);
    expect(ps.getTicks().length).toBeGreaterThan(0);
  });

  it("keeps a flat negative range upright", () => {
    const ps = scale(-100, -100);
    expect(ps.priceToY(-100)).toBeCloseTo(200, 6);
    // Higher price, smaller y.
    expect(ps.priceToY(-99.5)).toBeLessThan(ps.priceToY(-100.5));
    expect(ps.yToPrice(0)).toBeGreaterThan(ps.yToPrice(400));
    expect(ps.getTicks().length).toBeGreaterThan(0);
  });

  it("still widens a flat positive range around its value", () => {
    const ps = scale(50, 50);
    expect(ps.priceToY(50)).toBeCloseTo(200, 6);
  });
});

describe("PriceScale.setDataRange with bad bounds", () => {
  it("swaps an inverted range", () => {
    const ps = scale(200, 100);
    expect(ps.priceToY(200)).toBeLessThan(ps.priceToY(100));
  });

  it("keeps the previous range when one bound is non-finite", () => {
    // Keeping only the finite bound would collapse the range to a sliver
    // around it and draw everything off-scale.
    const ps = scale(100, 200);
    const y = ps.priceToY(150);
    ps.setDataRange(99, Number.POSITIVE_INFINITY);
    expect(ps.priceToY(150)).toBe(y);
  });

  it("keeps the previous range when both bounds are non-finite", () => {
    const ps = scale(100, 200);
    const y = ps.priceToY(150);
    ps.setDataRange(Number.NEGATIVE_INFINITY, Number.NaN);
    expect(ps.priceToY(150)).toBe(y);
  });
});

describe("PriceScale.getTicks", () => {
  it("returns a fresh array on a cache hit, so mutating it cannot corrupt later frames", () => {
    const ps = scale(0, 100);
    const first = ps.getTicks(5);
    const second = ps.getTicks(5);
    second.length = 0;
    expect(ps.getTicks(5)).toEqual(first);
  });
});
