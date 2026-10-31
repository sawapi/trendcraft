import { describe, expect, it } from "vitest";
import { PriceScale, TimeScale } from "../core/scale";

describe("TimeScale", () => {
  it("converts index to x and back", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);

    const x = ts.indexToX(10);
    expect(x).toBeGreaterThan(0);

    const idx = ts.xToIndex(x);
    expect(idx).toBe(10);
  });

  it("scrollToEnd positions last candles in view", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);
    ts.scrollToEnd();

    expect(ts.endIndex).toBe(500);
    expect(ts.startIndex).toBeGreaterThan(0);
  });

  it("fitContent shows all candles", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(50);
    ts.fitContent();

    expect(ts.startIndex).toBe(0);
    // Should see all candles (or close to it)
    expect(ts.endIndex).toBeGreaterThanOrEqual(50);
  });

  it("zoom changes visible count", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(200);

    const beforeCount = ts.visibleCount;
    ts.zoom(0.5); // Zoom in
    expect(ts.visibleCount).not.toBe(beforeCount);
  });

  it("scrollBy moves the visible range", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(200);

    const before = ts.startIndex;
    ts.scrollBy(10);
    expect(ts.startIndex).toBe(before + 10);
  });

  it("clamps startIndex to valid range", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);

    ts.scrollBy(-1000); // Scroll way left
    expect(ts.startIndex).toBe(0);
  });

  it("candleWidth is proportional to barSpacing", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);

    expect(ts.candleWidth).toBeGreaterThan(0);
    expect(ts.candleWidth).toBeLessThanOrEqual(ts.barSpacing);
  });
});

describe("PriceScale", () => {
  it("maps price to y pixel (higher price = lower y)", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(100, 200);

    const yHigh = ps.priceToY(200);
    const yLow = ps.priceToY(100);

    expect(yHigh).toBeLessThan(yLow);
  });

  it("round-trips price through priceToY/yToPrice", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(50, 150);

    const testPrice = 100;
    const y = ps.priceToY(testPrice);
    const recovered = ps.yToPrice(y);

    expect(recovered).toBeCloseTo(testPrice, 5);
  });

  it("respects fixed range", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setFixedRange([0, 100]);
    ps.setDataRange(20, 80); // Should be ignored

    expect(ps.min).toBe(0);
    expect(ps.max).toBe(100);
  });

  it("generates nice tick values", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(0, 100);

    const ticks = ps.getTicks();
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(8);

    // Ticks should be within range
    for (const tick of ticks) {
      expect(tick).toBeGreaterThanOrEqual(ps.min);
      expect(tick).toBeLessThanOrEqual(ps.max);
    }
  });

  it("does not produce floating-point drift on symmetric-around-zero ranges (regression: '0.00000000' label)", () => {
    // For oscillator-style indicators (QStick, CCI, etc.) the visible
    // range is symmetric around zero and `start + niceStep * n` should
    // land exactly on 0. Accumulating with `v += niceStep` in a loop
    // drifts after several iterations — the "0" tick lands at ~1e-16
    // and `autoFormatPrice` then renders it as "0.00000000".
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(-0.6, 0.6);

    const ticks = ps.getTicks();
    // The 0 tick should be exactly 0 (no drift).
    const zeroTick = ticks.find((t) => Math.abs(t) < 1e-6);
    expect(zeroTick).toBeDefined();
    expect(zeroTick).toBe(0);
  });

  it("includes the top tick when max lands on a step boundary (regression: dropped last tick)", () => {
    // `max - start` divided by `niceStep` is mathematically an integer
    // here, but FP can represent it as `n - ε`. A naive
    // `Math.floor + 1` count drops the final tick; an integer-multiple
    // approach with a small epsilon tolerance keeps it.
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(-1, -0.4);

    const ticks = ps.getTicks();
    const topTick = ticks[ticks.length - 1];
    expect(topTick).toBeCloseTo(-0.4, 9);
  });

  it("emitted ticks always lie within [min, max] (no out-of-range labels from FP drift)", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setDataRange(-0.6, 0.6);

    const ticks = ps.getTicks();
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(ps.min - 1e-12);
      expect(t).toBeLessThanOrEqual(ps.max + 1e-12);
    }
  });

  it("log mode maps correctly", () => {
    const ps = new PriceScale();
    ps.setMode("log");
    ps.setHeight(400);
    ps.setDataRange(10, 1000);

    const y10 = ps.priceToY(10);
    const y100 = ps.priceToY(100);
    const y1000 = ps.priceToY(1000);

    // In log scale, equal ratios should have more equal spacing
    expect(y10).toBeGreaterThan(y100);
    expect(y100).toBeGreaterThan(y1000);
  });
});

const logScaleTicksOf = (min: number, max: number, maxTicks: number) => {
  const ps = new PriceScale();
  ps.setMode("log");
  ps.setHeight(400);
  ps.setFixedRange([min, max]);
  ps.setDataRange(min, max);
  return ps.getTicks(maxTicks);
};

describe("PriceScale log mode", () => {
  const logScale = (min: number, max: number, fixed = false) => {
    const ps = new PriceScale();
    ps.setMode("log");
    ps.setHeight(400);
    if (fixed) ps.setFixedRange([min, max]);
    ps.setDataRange(min, max);
    return ps;
  };

  // Ticks were the linear nice steps, so a range spanning decades put every
  // label but "0" in the top sliver of the pane.
  it("ticks at powers of ten over many decades", () => {
    const ps = logScale(0.1, 1e11, true);
    const ticks = ps.getTicks(6);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.length).toBeLessThanOrEqual(6);
    for (const t of ticks) expect(Math.log10(t) % 1).toBeCloseTo(0, 9);
  });

  it("thins 1–9 multiples to 1/2/5 and then to powers of ten", () => {
    expect(logScale(1, 100, true).getTicks(6)).toEqual([1, 10, 100]);
    expect(logScale(1, 100, true).getTicks(8)).toEqual([1, 2, 5, 10, 20, 50, 100]);
    expect(logScale(0.01, 0.05, true).getTicks(6)).toEqual([0.01, 0.02, 0.03, 0.04, 0.05]);
  });

  it("spaces ticks evenly in pixels for equal ratios", () => {
    const ps = logScale(1, 1e4, true);
    const ys = ps.getTicks(6).map((t) => ps.priceToY(t));
    expect(ys).toHaveLength(5);
    for (let i = 1; i < ys.length - 1; i++)
      expect(ys[i - 1] - ys[i]).toBeCloseTo(ys[i] - ys[i + 1], 6);
  });

  it("aligns every-k powers of ten to multiples of k", () => {
    expect(logScaleTicksOf(1, 1e10, 6)).toEqual([1, 100, 1e4, 1e6, 1e8, 1e10]);
    expect(logScaleTicksOf(0.5, 2e11, 4)).toEqual([1, 1e3, 1e6, 1e9]);
  });

  // A short pane gets maxTicks 2; the first set with at most two ticks
  // could hold a single power and send a many-decade range to linear ticks.
  it("keeps two log ticks on a short pane over decades", () => {
    const ticks = logScaleTicksOf(7.94e-7, 1.26e-4, 2);
    expect(ticks).toHaveLength(2);
    for (const t of ticks) expect(Math.log10(t) % 1).toBeCloseTo(0, 9);
    expect(logScaleTicksOf(2e-5, 3e-3, 2)).toHaveLength(2);
  });

  it("recomputes ticks when the mode changes over the same range", () => {
    const ps = new PriceScale();
    ps.setHeight(400);
    ps.setFixedRange([1, 1e4]);
    ps.setDataRange(1, 1e4);
    const linear = ps.getTicks(6);
    ps.setMode("log");
    expect(ps.getTicks(6)).toEqual([1, 10, 100, 1000, 1e4]);
    ps.setMode("linear");
    expect(ps.getTicks(6)).toEqual(linear);
  });

  it("falls back to linear ticks inside one decade", () => {
    expect(logScale(120, 180, true).getTicks(6)).toEqual([120, 130, 140, 150, 160, 170, 180]);
  });

  // The 5% pad was linear, so a range spanning decades padded its bottom
  // below zero and the log floor added ten-odd empty decades under the data.
  it("pads a log range in log space", () => {
    const ps = logScale(0.28, 1.4e11);
    expect(ps.min).toBeGreaterThan(0.05);
    expect(ps.min).toBeLessThan(0.28);
    expect(ps.max).toBeGreaterThan(1.4e11);
    expect(ps.priceToY(0.28)).toBeLessThan(400);
    expect(ps.priceToY(0.28)).toBeGreaterThan(400 * 0.9);
  });

  it("pads linearly when the range is not positive", () => {
    const ps = logScale(-5, 100);
    expect(ps.min).toBeCloseTo(-10.25, 9);
  });
});

describe("TimeScale session gaps", () => {
  it("no gaps → identical behavior to plain index layout", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);
    const before = ts.indexToX(50);
    ts.setGapsBefore([]);
    expect(ts.hasGaps).toBe(false);
    expect(ts.indexToX(50)).toBe(before);
  });

  it("indexToX shifts bars after a gap to the right", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);
    ts.scrollTo(0);
    const x10Before = ts.indexToX(10);
    const x50Before = ts.indexToX(50);
    ts.setGapsBefore([{ index: 30, size: 1 }]);
    // Bars before index 30 unchanged
    expect(ts.indexToX(10)).toBe(x10Before);
    // Bar 50 moved by 1 × barSpacing to the right
    expect(ts.indexToX(50)).toBeCloseTo(x50Before + ts.barSpacing, 5);
  });

  it("xToIndex is the inverse of indexToX across gap boundaries", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(200);
    ts.setGapsBefore([
      { index: 50, size: 0.5 },
      { index: 100, size: 0.5 },
      { index: 150, size: 0.5 },
    ]);
    ts.scrollTo(0);
    for (const idx of [0, 25, 49, 50, 75, 100, 149, 150, 199]) {
      const x = ts.indexToX(idx);
      expect(ts.xToIndex(x)).toBe(idx);
    }
  });

  it("scrollToEnd keeps last real bar in view when gaps are present", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);
    ts.setGapsBefore([
      { index: 100, size: 0.5 },
      { index: 200, size: 0.5 },
      { index: 300, size: 0.5 },
      { index: 400, size: 0.5 },
    ]);
    ts.scrollToEnd();
    const lastX = ts.indexToX(499);
    // Last bar should be near the right edge, within one visibleCount of width
    expect(lastX).toBeGreaterThan(0);
    expect(lastX).toBeLessThanOrEqual(800);
  });

  it("clearGaps restores original layout", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);
    ts.scrollTo(0);
    const xBefore = ts.indexToX(80);
    ts.setGapsBefore([{ index: 30, size: 1 }]);
    expect(ts.indexToX(80)).not.toBe(xBefore);
    ts.clearGaps();
    expect(ts.hasGaps).toBe(false);
    expect(ts.indexToX(80)).toBe(xBefore);
  });
});

describe("TimeScale.setTimeProportional", () => {
  /** Build 1-min bars for `count` consecutive minutes starting at `startMs`. */
  function mkTimes(startMs: number, count: number, stepMs = 60_000): number[] {
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = startMs + i * stepMs;
    return out;
  }

  it("uniform 1-min bars behave identically to index layout", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    const times = mkTimes(0, 100);
    ts.setTotalCount(100);
    ts.scrollTo(0);
    const before = ts.indexToX(50);
    ts.setTimeProportional(times);
    // Uniform data → virt[i] = i → same x
    expect(ts.indexToX(50)).toBeCloseTo(before, 5);
    expect(ts.hasTimeData).toBe(true);
    expect(ts.hasGaps).toBe(true);
  });

  it("expands bars in proportion to their wall-clock gaps within a session", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(3);
    ts.scrollTo(0);
    // Bars at 0, 10m, 40m — second gap is 3× first gap.
    const times = [0, 10 * 60_000, 40 * 60_000];
    ts.setTimeProportional(times, { medianMs: 10 * 60_000 });
    const x0 = ts.indexToX(0);
    const x1 = ts.indexToX(1);
    const x2 = ts.indexToX(2);
    expect(x1 - x0).toBeCloseTo(ts.barSpacing, 5); // 1 bar gap
    expect(x2 - x1).toBeCloseTo(3 * ts.barSpacing, 5); // 3 bar gaps
  });

  it("compresses session breaks to sessionGapBars", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(4);
    ts.scrollTo(0);
    // 0, 1m, 1m + overnight(17h), + 1m
    const overnight = 17 * 60 * 60 * 1000;
    const times = [0, 60_000, 60_000 + overnight, 2 * 60_000 + overnight];
    ts.setTimeProportional(times, { medianMs: 60_000, sessionGapBars: 1.5 });
    const d1 = ts.indexToX(1) - ts.indexToX(0);
    const d2 = ts.indexToX(2) - ts.indexToX(1);
    const d3 = ts.indexToX(3) - ts.indexToX(2);
    expect(d1).toBeCloseTo(ts.barSpacing, 5);
    expect(d2).toBeCloseTo(1.5 * ts.barSpacing, 5); // compressed
    expect(d3).toBeCloseTo(ts.barSpacing, 5);
  });

  it("timeToX returns a pixel for a time that matches a bar", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);
    ts.scrollTo(0);
    const times = mkTimes(0, 100);
    ts.setTimeProportional(times, { medianMs: 60_000 });
    const x = ts.timeToX(times[20]);
    expect(x).not.toBeNull();
    expect(x).toBeCloseTo(ts.indexToX(20), 5);
  });

  it("timeToX returns a real position for the bar at the session-close (compressed gap left endpoint)", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(4);
    ts.scrollTo(0);
    const overnight = 17 * 60 * 60 * 1000;
    // Bar 1 is the session-close; the next segment is a compressed gap.
    const times = [0, 60_000, 60_000 + overnight, 2 * 60_000 + overnight];
    ts.setTimeProportional(times, { medianMs: 60_000 });
    const x = ts.timeToX(times[1]);
    expect(x).not.toBeNull();
    expect(x).toBeCloseTo(ts.indexToX(1), 5);
  });

  it("timeToX returns null for a time inside a compressed session gap", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(4);
    ts.scrollTo(0);
    const overnight = 17 * 60 * 60 * 1000;
    const times = [0, 60_000, 60_000 + overnight, 2 * 60_000 + overnight];
    ts.setTimeProportional(times, { medianMs: 60_000 });
    // Ask for a time inside the overnight window (1h into the gap)
    const midGap = 60_000 + 60 * 60_000;
    expect(ts.timeToX(midGap)).toBeNull();
  });

  it("getTimeTicks emits ticks only at wall-clock nice boundaries", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(120);
    const start = Date.UTC(2026, 0, 15, 0, 0, 0);
    const times = mkTimes(start, 120); // 2 hours of 1-min bars
    ts.setTimeProportional(times, { medianMs: 60_000 });
    ts.scrollTo(0);
    const ticks = ts.getTimeTicks(15 * 60_000); // 15-min step
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t.time % (15 * 60_000)).toBe(0);
    }
  });

  it("getDateTicks emits one tick per local-day boundary", () => {
    const ts = new TimeScale();
    ts.setWidth(1600);
    // 3 days of bars at 1-hour intervals, each day has 24 bars
    const times: number[] = [];
    for (let day = 0; day < 3; day++) {
      for (let h = 0; h < 24; h++) {
        times.push(Date.UTC(2026, 0, 15 + day, h, 0, 0));
      }
    }
    ts.setTotalCount(times.length);
    ts.setTimeProportional(times);
    ts.scrollTo(0);
    const ticks = ts.getDateTicks();
    // Should be <= 3 date tick (one per day boundary in view). Exact count
    // depends on local TZ interpretation of UTC dates; assert at least 1
    // and at most 4 (in case of a half-day seen at the edge).
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    expect(ticks.length).toBeLessThanOrEqual(4);
  });

  it("clearGaps resets both virt and time data", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);
    ts.setTimeProportional(mkTimes(0, 100));
    expect(ts.hasTimeData).toBe(true);
    ts.clearGaps();
    expect(ts.hasTimeData).toBe(false);
    expect(ts.hasGaps).toBe(false);
    expect(ts.getTimeTicks(60_000)).toEqual([]);
    expect(ts.getDateTicks()).toEqual([]);
  });
});

describe("TimeScale.panTo", () => {
  it("moves the window without snapping a sub-2px zoom back in", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(20_000);
    ts.fitContent();
    const spacing = ts.barSpacing;
    const visible = ts.visibleCount;
    expect(spacing).toBeLessThan(2);
    ts.panTo(5_000);
    expect(ts.barSpacing).toBe(spacing);
    expect(ts.visibleCount).toBe(visible);
    expect(ts.rawStartIndex).toBe(5_000);
  });
});
