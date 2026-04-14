import { describe, expect, it } from "vitest";
import { resolveRangeDuration } from "../core/range-utils";

describe("resolveRangeDuration", () => {
  const LAST = Date.UTC(2026, 3, 14, 12, 0, 0);
  const DAY = 86_400_000;

  it("ALL → null (caller should fitContent)", () => {
    expect(resolveRangeDuration("ALL", LAST)).toBeNull();
  });

  it.each<[string, number]>([
    ["1D", 1 * DAY],
    ["1W", 7 * DAY],
    ["1M", 30 * DAY],
    ["3M", 90 * DAY],
    ["6M", 180 * DAY],
    ["1Y", 365 * DAY],
  ])("%s subtracts expected ms", (dur, delta) => {
    // @ts-expect-error — string literal match
    expect(resolveRangeDuration(dur, LAST)).toBe(LAST - delta);
  });

  it("YTD returns UTC Jan 1 of lastTime year", () => {
    const got = resolveRangeDuration("YTD", LAST);
    expect(got).toBe(Date.UTC(2026, 0, 1));
    expect(got).toBeLessThan(LAST);
  });

  it("YTD independent of sub-day components", () => {
    const a = resolveRangeDuration("YTD", Date.UTC(2027, 6, 15, 3, 14));
    const b = resolveRangeDuration("YTD", Date.UTC(2027, 11, 31, 23, 59));
    expect(a).toBe(b);
    expect(a).toBe(Date.UTC(2027, 0, 1));
  });
});
