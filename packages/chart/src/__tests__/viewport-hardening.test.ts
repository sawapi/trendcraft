// @vitest-environment happy-dom
/**
 * Viewport hardening regressions — interaction / emission / consumer fixes
 * for the states made reachable by the logical-range API:
 *
 * - M2: interactive zoom moves continuously TOWARD [1, 50] from an
 *   out-of-range bar spacing instead of teleporting to the boundary
 *   (which inverted the gesture direction).
 * - M5: visibleRangeChange emission is a single owner with a ~0.25px
 *   fractional change threshold, force-emits once on animation completion,
 *   and syncCharts identifies forwarded completions by an origin/generation
 *   token instead of range values (async echo prevention, incl. time-mode
 *   MTF where the target's quantized range is unknowable to the sender).
 * - M6: a beyond-left viewport must not blank number-line series (negative
 *   Array.slice start read from the END of the data).
 * - M7: getVisibleRange()'s four legacy fields are clamped to the data
 *   (beyond-data viewports used to report epoch-0 times).
 * - M8: drag origin uses the raw fractional startIndex (the floored getter
 *   snapped the viewport on the first pixel of drag).
 * - M9: an animated range transition lands on the exact target spacing
 *   even for sub-1-bar spans (the count was floored to 1).
 */

import { beforeAll, beforeEach, describe, expect, it, type vi } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { TimeScale } from "../core/scale";
import type { CandleData, ChartInstance, VisibleRangeChangeData } from "../core/types";
import { createChart } from "../index";
import { syncCharts } from "../integration/sync";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePriceScale, mockCtx } from "./helpers/mock-ctx";

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

function makeCandles(
  count: number,
  intervalMs = 60_000,
  startTime = 1_700_000_000_000,
): CandleData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: startTime + i * intervalMs,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 1000,
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- M2: zoom continuity from out-of-range spacing ----

describe("M2 zoom continuity", () => {
  function scaleWithSpacing(spanFrom: number, spanTo: number): TimeScale {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(300);
    ts.setVisibleLogicalRange(spanFrom, spanTo);
    return ts;
  }

  it("zooming in at 800px/bar does not teleport out to 50px/bar", () => {
    const ts = scaleWithSpacing(10, 11); // spacing 800
    expect(ts.barSpacing).toBeCloseTo(800, 6);
    ts.zoom(1.1); // zoom in: away from range — must not move
    expect(ts.barSpacing).toBeCloseTo(800, 6);
    ts.zoom(0.9); // zoom out: toward range — continuous
    expect(ts.barSpacing).toBeCloseTo(720, 6);
  });

  it("zooming out at 0.32px/bar does not teleport in to 1px/bar", () => {
    const ts = scaleWithSpacing(0, 2500); // spacing 0.32
    expect(ts.barSpacing).toBeCloseTo(0.32, 6);
    ts.zoom(0.9); // zoom out: away from range — must not move
    expect(ts.barSpacing).toBeCloseTo(0.32, 6);
    ts.zoom(1.1); // zoom in: toward range — continuous
    expect(ts.barSpacing).toBeCloseTo(0.352, 6);
  });

  it("ignores non-finite factor and falls back to center for a non-finite anchor", () => {
    // Wheel/pinch anchors derive from browser event coordinates; a NaN
    // reaching _startIndex would poison the viewport permanently.
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(300);
    ts.setVisibleRange(0, 100);
    const spacing = ts.barSpacing;
    const start = ts.rawStartIndex;

    ts.zoom(Number.NaN);
    expect(ts.barSpacing).toBe(spacing);
    expect(ts.rawStartIndex).toBe(start);

    ts.zoom(1.1, Number.NaN); // anchor falls back to the viewport center
    expect(Number.isFinite(ts.rawStartIndex)).toBe(true);
    expect(ts.barSpacing).toBeCloseTo(spacing * 1.1, 6);
  });

  it("keeps the ordinary [1, 50] behavior inside the range", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(300);
    ts.setVisibleRange(0, 100); // spacing 8
    ts.zoom(1.1);
    expect(ts.barSpacing).toBeCloseTo(8.8, 6);
    ts.zoom(1000); // cap at max
    expect(ts.barSpacing).toBe(50);
    ts.zoom(0.0001); // floor at interactive min
    expect(ts.barSpacing).toBe(1);
  });
});

// ---- M6: LTTB slice with a beyond-left viewport ----

describe("M6 number-line series at beyond-left viewports", () => {
  it("renders the line instead of blanking it (negative slice start)", () => {
    const n = 5000;
    const data = Array.from({ length: n }, (_, i) => ({
      time: 1 + i,
      value: 100 + Math.sin(i / 50) * 10,
    }));
    const series: InternalSeries = {
      id: "s",
      paneId: "main",
      scaleId: "right",
      type: "line",
      config: {},
      data: data as InternalSeries["data"],
      visible: true,
    };
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(n);
    ts.setVisibleLogicalRange(-1000, 4000); // left margin + LTTB-dense span
    const ctx = mockCtx();
    dispatchSeries(ctx, series, ts, makePriceScale(400, 80, 120));
    const drawn =
      (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length +
      (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls.length;
    // Pre-fix: slice(-1000, 4000) → slice(4000, 4000) → empty → ~0 calls.
    expect(drawn).toBeGreaterThan(100);
  });
});

// ---- Chart-level fixtures ----

describe("chart-level hardening", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function makeChart(opts: { duration?: number } = {}) {
    return createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: opts.duration ?? 0,
    });
  }

  it("M7: beyond-data viewports report clamped times, never epoch 0", () => {
    const candles = makeCandles(300);
    const chart = makeChart();
    chart.setCandles(candles);

    chart.setVisibleLogicalRange(310, 340); // fully beyond right
    let range = chart.getVisibleRange();
    expect(range?.startTime).toBe(candles[299].time);
    expect(range?.endTime).toBe(candles[299].time);
    expect(range?.startIndex).toBe(299);
    expect(range?.endIndex).toBe(299);

    chart.setVisibleLogicalRange(-40, -10); // fully before left
    range = chart.getVisibleRange();
    expect(range?.startTime).toBe(candles[0].time);
    expect(range?.endTime).toBe(candles[0].time);
    expect(range?.startIndex).toBe(0);
    expect(range?.endIndex).toBe(0);
  });

  it("M9: an animated transition lands on the exact sub-1-bar span", async () => {
    const chart = makeChart({ duration: 60 });
    chart.setCandles(makeCandles(300));

    chart.setVisibleLogicalRange(10, 10.25);
    await sleep(250); // settle
    const r = chart.getVisibleLogicalRange();
    expect(r).not.toBeNull();
    // Pre-fix the count was floored to 1 → span landed at 1, not 0.25.
    expect((r?.to ?? 0) - (r?.from ?? 0)).toBeCloseTo(0.25, 6);
  });

  it("M5: sub-bar movement emits (fractional threshold, not floored indices)", () => {
    const chart = makeChart();
    chart.setCandles(makeCandles(300));
    chart.setVisibleLogicalRange(10, 11);

    const events: VisibleRangeChangeData[] = [];
    chart.on("visibleRangeChange", (d) => events.push(d as VisibleRangeChangeData));
    chart.setVisibleLogicalRange(10.3, 11.3); // floored indices unchanged
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.logicalRange?.from).toBeCloseTo(10.3, 6);
  });

  it("M5: a default-animated programmatic set emits its final state exactly once", async () => {
    const chart = makeChart({ duration: 300 });
    chart.setCandles(makeCandles(300));
    await sleep(50);

    const events: VisibleRangeChangeData[] = [];
    chart.on("visibleRangeChange", (d) => events.push(d as VisibleRangeChangeData));
    chart.setVisibleLogicalRange(100, 200);
    await sleep(600); // settle
    // Pre-fix: tween frames update the floored compare while suppressed,
    // and the final sub-bar frame changes nothing → zero events ever.
    expect(events.length).toBe(1);
    expect(events[0].logicalRange?.from).toBeCloseTo(100, 6);
    expect(events[0].logicalRange?.to).toBeCloseTo(200, 6);
  });

  it("M8: dragging from a fractional resting position does not snap to the floor", () => {
    const chart = makeChart();
    chart.setCandles(makeCandles(300));
    chart.setVisibleLogicalRange(100.6, 180.6);
    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
    if (!canvas) return;

    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 200 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 399, clientY: 200 }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 399, clientY: 200 }));

    const from = chart.getVisibleLogicalRange()?.from ?? 0;
    // A 1px drag moves ~1/spacing ≈ 0.11 bars. Pre-fix the origin was
    // floored to 100, snapping the view by the 0.6 fractional part.
    expect(Math.abs(from - 100.6)).toBeGreaterThan(0.001); // it did move
    expect(Math.abs(from - 100.6)).toBeLessThan(0.2); // ...but never snapped
  });
});

// ---- P1: only viewport gestures cancel a running range animation ----
// Hover / pane-resize / drawing previews go through the plain onUpdate
// channel (the hover test covers the whole channel); pan / wheel / pinch /
// viewport keys / inertia go through onViewportMutation.

describe("animation vs interaction channels", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function makeAnimatedChart() {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 300,
    });
    chart.setCandles(makeCandles(600));
    return chart;
  }

  function canvasOf(): HTMLCanvasElement {
    const canvas = document.body.querySelector("canvas");
    if (!canvas) throw new Error("no canvas");
    return canvas as HTMLCanvasElement;
  }

  it("hovering during an animation does not cancel it (final range + one emit)", async () => {
    const chart = makeAnimatedChart();
    await sleep(50);
    const events: VisibleRangeChangeData[] = [];
    chart.on("visibleRangeChange", (d) => events.push(d as VisibleRangeChangeData));

    chart.setVisibleLogicalRange(200, 300);
    await sleep(100); // mid-animation
    const canvas = canvasOf();
    for (let i = 0; i < 5; i++) {
      canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 300 + i * 10, clientY: 150 }));
    }
    await sleep(500); // settle

    // Pre-fix: the hover killed the animation → the view froze mid-flight,
    // no completion emit, and the abandoned range leaked as fresh input.
    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(200, 4);
    expect(chart.getVisibleLogicalRange()?.to).toBeCloseTo(300, 4);
    expect(events.length).toBe(1);
  });

  it("a wheel gesture during an animation cancels it", async () => {
    const chart = makeAnimatedChart();
    await sleep(50);
    chart.setVisibleLogicalRange(200, 300);
    await sleep(100); // mid-animation
    canvasOf().dispatchEvent(
      new WheelEvent("wheel", { deltaY: 120, clientX: 400, clientY: 150, cancelable: true }),
    );
    await sleep(500);

    // The animation never reached its target; the user gesture won.
    const afterWheel = chart.getVisibleLogicalRange()?.from ?? Number.NaN;
    expect(Number.isFinite(afterWheel)).toBe(true); // NaN would vacuously pass .not
    expect(afterWheel).not.toBeCloseTo(200, 2);
  });

  it("a viewport key during an animation cancels it; drag does too", async () => {
    const chart = makeAnimatedChart();
    await sleep(50);
    chart.setVisibleLogicalRange(200, 300);
    await sleep(100);
    canvasOf().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await sleep(500);
    const afterKey = chart.getVisibleLogicalRange()?.from ?? Number.NaN;
    expect(Number.isFinite(afterKey)).toBe(true);
    expect(afterKey).not.toBeCloseTo(200, 2);

    chart.setVisibleLogicalRange(400, 500);
    await sleep(100);
    const canvas = canvasOf();
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 350, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 350, clientY: 150 }));
    await sleep(500);
    const afterDrag = chart.getVisibleLogicalRange()?.from ?? Number.NaN;
    expect(Number.isFinite(afterDrag)).toBe(true);
    expect(afterDrag).not.toBeCloseTo(400, 2);
  });

  it("sync survives a hover on the follower and recovers after a gesture-cancel", async () => {
    const candles = makeCandles(600);
    const a = createChart(makeContainer(), { width: 800, height: 400, animationDuration: 300 });
    a.setCandles(candles);
    const b = createChart(makeContainer(), { width: 800, height: 400, animationDuration: 300 });
    b.setCandles(candles);
    await sleep(50);
    syncCharts([a, b], { viewport: "logical" });

    // Hover on B mid-follow: its animation must still complete and be
    // consumed (a stuck pending expectation would break the NEXT sync).
    a.setVisibleLogicalRange(400, 500);
    await sleep(400); // B mid-animation
    const canvases = document.body.querySelectorAll("canvas");
    canvases[1]?.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 150 }));
    await sleep(700);
    expect(b.getVisibleLogicalRange()?.from).toBeCloseTo(400, 4);

    // A user gesture cancels B's next follow mid-flight; the resulting
    // token-less movement is fresh input and must propagate to A, and the
    // group must keep functioning afterwards.
    a.setVisibleLogicalRange(100, 200);
    await sleep(400);
    canvases[1]?.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 120, clientX: 400, clientY: 150, cancelable: true }),
    );
    await sleep(900);
    const aRange = a.getVisibleLogicalRange();
    const bRange = b.getVisibleLogicalRange();
    // Converged on B's post-gesture state (not wedged, no echo storm).
    expect(aRange?.from).toBeCloseTo(bRange?.from ?? Number.NaN, 2);

    // Subsequent syncs still work.
    a.setVisibleLogicalRange(250, 350);
    await sleep(900);
    expect(b.getVisibleLogicalRange()?.from).toBeCloseTo(250, 4);
  });
});

// ---- M5 sync echo prevention (real charts, animated) ----

describe("syncCharts async echo prevention", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function makeChartWith(candles: CandleData[], duration = 300): ChartInstance {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: duration,
    });
    chart.setCandles(candles);
    return chart;
  }

  it("logical mode: one change → one follow, no echo loop, ranges converge", async () => {
    const candles = makeCandles(600);
    const a = makeChartWith(candles);
    const b = makeChartWith(candles);
    await sleep(50);
    syncCharts([a, b], { viewport: "logical" });

    const aEvents: unknown[] = [];
    const bEvents: unknown[] = [];
    a.on("visibleRangeChange", (d) => aEvents.push(d));
    b.on("visibleRangeChange", (d) => bEvents.push(d));

    a.setVisibleLogicalRange(400, 500);
    await sleep(900); // both animations settle

    const aCount = aEvents.length;
    const bCount = bEvents.length;
    await sleep(400);
    // No further events after settle — an echo loop would keep counting.
    expect(aEvents.length).toBe(aCount);
    expect(bEvents.length).toBe(bCount);
    expect(aCount).toBe(1); // A's own completion only — never re-set by B's echo
    expect(bCount).toBe(1); // B's forwarded completion only

    expect(a.getVisibleLogicalRange()?.from).toBeCloseTo(400, 4);
    expect(b.getVisibleLogicalRange()?.from).toBeCloseTo(400, 4);
    expect(b.getVisibleLogicalRange()?.to).toBeCloseTo(500, 4);
  });

  it("time mode MTF: follower quantizes, still consumed, no echo", async () => {
    // Different timeframes: 1-minute vs 5-minute over the same span.
    const oneMin = makeCandles(600, 60_000);
    const fiveMin = makeCandles(120, 300_000);
    const a = makeChartWith(oneMin);
    const b = makeChartWith(fiveMin);
    await sleep(50);
    syncCharts([a, b], { viewport: true });

    const aEvents: unknown[] = [];
    const bEvents: unknown[] = [];
    a.on("visibleRangeChange", (d) => aEvents.push(d));
    b.on("visibleRangeChange", (d) => bEvents.push(d));

    a.setVisibleRange(oneMin[300].time, oneMin[420].time);
    await sleep(900);

    const aCount = aEvents.length;
    const bCount = bEvents.length;
    await sleep(400);
    expect(aEvents.length).toBe(aCount); // no async ping-pong
    expect(bEvents.length).toBe(bCount);
    expect(aCount).toBe(1);
    expect(bCount).toBe(1);

    // B quantized the times to its own (5-min) bars: logical range differs
    // from A's, yet the completion was recognized by token, not by value.
    const bRange = b.getVisibleRange();
    expect(bRange?.startTime).toBe(fiveMin[60].time); // same wall-clock start
    expect(b.getVisibleLogicalRange()?.from).toBeCloseTo(60, 1);
  });

  it("a user action during the follower's animation is not swallowed", async () => {
    const candles = makeCandles(600);
    const a = makeChartWith(candles);
    const b = makeChartWith(candles);
    await sleep(50);
    syncCharts([a, b], { viewport: "logical" });

    a.setVisibleLogicalRange(400, 500);
    await sleep(400); // A settled + forward issued; B still animating
    // "User" acts on B mid-animation (no token → fresh input for the group).
    b.setVisibleLogicalRange(100, 200);
    await sleep(900);

    // The user action won: both charts converge on B's range, not A's.
    expect(b.getVisibleLogicalRange()?.from).toBeCloseTo(100, 4);
    expect(a.getVisibleLogicalRange()?.from).toBeCloseTo(100, 4);
  });

  it("rapid successive changes supersede cleanly (stale generation never wins)", async () => {
    const candles = makeCandles(600);
    const a = makeChartWith(candles);
    const b = makeChartWith(candles);
    await sleep(50);
    syncCharts([a, b], { viewport: "logical" });

    a.setVisibleLogicalRange(400, 500);
    await sleep(350); // first forward in flight on B
    a.setVisibleLogicalRange(200, 300); // supersedes
    await sleep(1000);

    expect(b.getVisibleLogicalRange()?.from).toBeCloseTo(200, 4);
    expect(b.getVisibleLogicalRange()?.to).toBeCloseTo(300, 4);
    expect(a.getVisibleLogicalRange()?.from).toBeCloseTo(200, 4);
  });
});
