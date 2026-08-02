// @vitest-environment happy-dom
/**
 * setVisibleLogicalRange / getVisibleLogicalRange — the index-space viewport
 * API. Unlike the time-based setVisibleRange (whose time→index conversion
 * saturates at the last bar), logical ranges are fractional and may extend
 * beyond the data, so empty space past the last bar is expressible; the
 * unclamped range also rides on getVisibleRange()/visibleRangeChange.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeScale } from "../core/scale";
import type { CandleData, VisibleRangeChangeData } from "../core/types";
import { createChart } from "../index";

beforeAll(() => {
  const noop = () => {};
  const context2d = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    context2d;
});

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "800px";
  el.style.height = "400px";
  document.body.appendChild(el);
  return el;
}

function makeCandles(count: number, startTime = 1_700_000_000_000): CandleData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: startTime + i * 60_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 1000,
  }));
}

// ---- TimeScale unit behavior ----

describe("TimeScale logical range", () => {
  function makeScale(total = 300, width = 800): TimeScale {
    const ts = new TimeScale();
    ts.setWidth(width);
    ts.setTotalCount(total);
    return ts;
  }

  it("round-trips a range beyond the data without clamping", () => {
    const ts = makeScale(300);
    ts.setVisibleLogicalRange(250, 330); // 30 slots past the last bar
    const r = ts.getVisibleLogicalRange();
    expect(r.from).toBe(250);
    expect(r.to).toBeCloseTo(330, 6);
    // The window genuinely sits past the ordinary scroll boundary
    expect(ts.rawStartIndex).toBe(250);
  });

  it("preserves fractional indices", () => {
    const ts = makeScale(300);
    ts.setVisibleLogicalRange(10.5, 90.5);
    const r = ts.getVisibleLogicalRange();
    expect(r.from).toBe(10.5);
    expect(r.to).toBeCloseTo(90.5, 6);
  });

  it("measures the span in virtual units under session gaps", () => {
    const ts = makeScale(300);
    ts.setGapsBefore([{ index: 150, size: 20 }]);
    ts.setVisibleLogicalRange(100, 200); // spans the gap: 120 virtual slots
    expect(ts.barSpacing).toBeCloseTo(800 / 120, 6);
    const r = ts.getVisibleLogicalRange();
    expect(r.from).toBe(100);
    expect(r.to).toBeCloseTo(200, 6);
  });

  it("round-trips a narrow span exactly (spacing exceeds the interactive zoom cap)", () => {
    const ts = makeScale(300);
    ts.setVisibleLogicalRange(250, 251); // 1 slot in 800px → 800px/bar
    const r = ts.getVisibleLogicalRange();
    expect(r.from).toBe(250);
    expect(r.to).toBeCloseTo(251, 6);
    expect(ts.barSpacing).toBeCloseTo(800, 6);
  });

  it("round-trips a very wide span exactly (spacing below the interactive minimum)", () => {
    const ts = makeScale(300);
    ts.setVisibleLogicalRange(0, 1000); // 0.8px/bar — decimated rendering
    const r = ts.getVisibleLogicalRange();
    expect(r.from).toBe(0);
    expect(r.to).toBeCloseTo(1000, 6);
  });

  it("caps only at the render floor (0.1px/bar)", () => {
    const ts = makeScale(300);
    ts.setVisibleLogicalRange(0, 100_000); // would need 0.008px/bar
    const r = ts.getVisibleLogicalRange();
    expect(ts.barSpacing).toBeCloseTo(0.1, 6);
    expect(r.to).toBeCloseTo(800 / 0.1, 6); // documented cap: width / 0.1 slots
  });

  it("ignores an empty, inverted, or denormal-small span", () => {
    const ts = makeScale(300);
    ts.setVisibleLogicalRange(200, 280);
    const before = ts.getVisibleLogicalRange();
    ts.setVisibleLogicalRange(50, 50);
    ts.setVisibleLogicalRange(60, 40);
    // Positive but denormal-small: width / span overflows to Infinity
    ts.setVisibleLogicalRange(0, Number.MIN_VALUE);
    const after = ts.getVisibleLogicalRange();
    expect(after).toEqual(before);
    expect(Number.isFinite(ts.barSpacing)).toBe(true);
  });
});

// ---- Chart-level behavior ----

describe("chart logical range API", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function makeChart(rightOffset?: number) {
    return createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
      ...(rightOffset !== undefined ? { timeScale: { rightOffset } } : {}),
    });
  }

  it("expresses a custom margin past the last bar and follows the live edge with it", () => {
    const candles = makeCandles(300);
    const chart = makeChart();
    chart.setCandles(candles);

    chart.setVisibleLogicalRange(250, 330);
    const r1 = chart.getVisibleLogicalRange();
    expect(r1).not.toBeNull();
    expect(r1?.from).toBe(250);
    expect(r1?.to).toBeCloseTo(330, 6);

    // Last bar is visible, so streaming preserves the 30-slot margin: the
    // whole window advances by the appended bar.
    const last = candles[candles.length - 1];
    chart.updateCandle({ ...last, time: last.time + 60_000 });
    const r2 = chart.getVisibleLogicalRange();
    expect(r2?.from).toBeCloseTo(251, 6);
    expect(r2?.to).toBeCloseTo(331, 6);
  });

  it("round-trips get → set (restores the same view)", () => {
    const candles = makeCandles(300);
    const chart = makeChart(5);
    chart.setCandles(candles);
    const saved = chart.getVisibleLogicalRange();
    expect(saved).not.toBeNull();
    if (!saved) throw new Error("unreachable");

    chart.fitContent(); // move somewhere else
    chart.setVisibleLogicalRange(saved.from, saved.to);
    const restored = chart.getVisibleLogicalRange();
    expect(restored?.from).toBeCloseTo(saved.from, 6);
    expect(restored?.to).toBeCloseTo(saved.to, 6);
  });

  it("getVisibleRange().logicalRange carries the unclamped margin", () => {
    const candles = makeCandles(300);
    const chart = makeChart(5);
    chart.setCandles(candles);

    const range = chart.getVisibleRange();
    expect(range).not.toBeNull();
    // Clamped fields saturate at the last bar...
    expect(range?.endIndex).toBe(299);
    // ...while the logical range sees the margin past it. `to` is the true
    // fractional right edge: scrollToEnd positions in whole ceiled window
    // slots, so up to one fractional slot of the configured margin sits
    // off-screen — the visible margin is within (offset-1, offset].
    const margin = (range?.logicalRange?.to ?? 0) - 300;
    expect(margin).toBeGreaterThan(4);
    expect(margin).toBeLessThanOrEqual(5);
  });

  it("emits the logical range on visibleRangeChange", async () => {
    const candles = makeCandles(300);
    const chart = makeChart();
    chart.setCandles(candles);
    // Let the render loop emit (and swallow) the initial range first.
    await new Promise((r) => setTimeout(r, 60));

    const events: VisibleRangeChangeData[] = [];
    chart.on("visibleRangeChange", (d) => events.push(d as VisibleRangeChangeData));
    chart.setVisibleLogicalRange(250, 330);
    // Emission happens from the render loop (rAF-driven); flush a few frames.
    await new Promise((r) => setTimeout(r, 60));

    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.logicalRange?.from).toBe(250);
    expect(last.logicalRange?.to).toBeCloseTo(330, 6);
  });

  it("warns and ignores invalid ranges without moving the viewport", () => {
    const chart = makeChart();
    const onError = vi.fn();
    chart.on("error", onError);
    chart.setCandles(makeCandles(300));
    const before = chart.getVisibleLogicalRange();

    chart.setVisibleLogicalRange(50, 50);
    chart.setVisibleLogicalRange(Number.NaN, 100);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(chart.getVisibleLogicalRange()).toEqual(before);
  });

  it("returns null with no data", () => {
    const chart = makeChart();
    expect(chart.getVisibleLogicalRange()).toBeNull();
  });
});
