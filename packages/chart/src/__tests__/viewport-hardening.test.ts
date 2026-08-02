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

// ---- Clamp envelope: granted logical-range positions vs interaction ----
// The envelope is [min(0, granted), max(normalMax, granted)] where
// `granted` is the resting position ratified by setVisibleLogicalRange /
// gesture settles. Margins are consumable by interaction, re-creatable
// only via the API (one-way ratchet); fitContent / scrollToEnd /
// setVisibleRange release the grant; the live-edge follow re-bases it.

describe("clamp envelope for granted viewports", () => {
  it("rubber-band dampens only movement beyond the granted position (M1)", () => {
    // 500 bars, spacing 8: normalMax = 500 + 20 - 100 = 420. The granted
    // margin position 450 sits 30 bars past it — pre-envelope, the first
    // 1-bar wheel pan snapped to 420 + 31*0.4 = 432.4 (an 18-bar jump).
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);
    ts.setVisibleLogicalRange(450, 550);
    expect(ts.overscroll).toBe(0); // granted position is not "overscroll"

    ts.scrollByUnclamped(1); // one wheel notch further right
    expect(ts.rawStartIndex).toBeCloseTo(450.4, 6); // gentle, from 450
    // Bounce returns to the granted position, not the ordinary boundary
    expect(ts.clampedStartIndex).toBeCloseTo(450, 6);
  });

  it("a beyond-left viewport survives a data append (M3)", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);
    ts.setVisibleLogicalRange(-50, 50);
    ts.setTotalCount(501); // streaming append clamps — must not yank to 0
    expect(ts.rawStartIndex).toBe(-50);
  });

  it("an all-fits margin viewport moves bar-by-bar, never snapping to 0 (M4)", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(100);
    ts.setVisibleLogicalRange(-20, 120); // both-sides margin, all fits
    ts.scrollBy(1);
    expect(ts.rawStartIndex).toBe(-19); // one bar, not a 20-bar snap
    for (let i = 0; i < 30; i++) ts.scrollBy(1);
    expect(ts.rawStartIndex).toBe(0); // converges to the ordinary bound
    ts.ratifySettledPosition();
    expect(ts.hasViewportGrant).toBe(false); // grant dissolved inside bounds
  });

  it("margins are consumable by gestures but not re-expandable (ratchet)", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);
    ts.setVisibleLogicalRange(450, 550);

    ts.scrollTo(430); // user pans partway back toward the data
    ts.ratifySettledPosition(); // gesture settles
    expect(ts.rawStartIndex).toBe(430);

    ts.scrollTo(460); // trying to re-enter the consumed margin
    expect(ts.rawStartIndex).toBe(430); // clamped at the ratified position
  });

  it("explicit navigation releases the grant", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);

    ts.setVisibleLogicalRange(450, 550);
    expect(ts.hasViewportGrant).toBe(true);
    ts.scrollToEnd();
    expect(ts.hasViewportGrant).toBe(false);

    ts.setVisibleLogicalRange(-50, 50);
    ts.fitContent();
    expect(ts.hasViewportGrant).toBe(false);

    ts.setVisibleLogicalRange(450, 550);
    ts.setVisibleRange(100, 200);
    expect(ts.hasViewportGrant).toBe(false);
  });

  it("the live-edge follow re-bases the grant with the margin intact", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(500);
    ts.setVisibleLogicalRange(450, 550);

    const dist = ts.endDistanceVirtual;
    ts.setTotalCount(501);
    ts.followLiveEdge(dist);
    expect(ts.rawStartIndex).toBeCloseTo(451, 6);
    expect(ts.hasViewportGrant).toBe(true);
    ts.setTotalCount(502); // next tick's clamp must respect the re-based grant
    expect(ts.rawStartIndex).toBeCloseTo(451, 6);
  });
});

describe("grant = explicit logical viewport, not merely beyond-bounds", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("a wide range starting at 0 still blocks the resize auto-refit", () => {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
    });
    chart.setCandles(makeCandles(300));
    chart.setVisibleLogicalRange(0, 1000); // start inside ordinary bounds
    chart.resize(900, 400);
    const r = chart.getVisibleLogicalRange();
    // fitContent would collapse the span to ~300 slots; the explicit range
    // keeps its spacing, so the span stays in the requested order.
    expect((r?.to ?? 0) - (r?.from ?? 0)).toBeGreaterThan(900);
    expect(r?.from).toBeCloseTo(0, 6);
  });

  it("an in-bounds range including the live edge is not repositioned by rightOffset", () => {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
      timeScale: { rightOffset: 5 },
    });
    chart.setCandles(makeCandles(300));
    // Start inside the ordinary overscroll pad; margin only on the right.
    chart.setVisibleLogicalRange(215, 310);
    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(215, 6);

    chart.applyOptions({ timeScale: { rightOffset: 8 } });
    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(215, 6); // untouched
  });

  it("the first in-bounds gesture settle dissolves the grant", () => {
    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(300);
    ts.setVisibleLogicalRange(50, 150); // fully ordinary position
    expect(ts.hasViewportGrant).toBe(true); // active until a settle
    ts.ratifySettledPosition(); // first gesture settles in-bounds
    expect(ts.hasViewportGrant).toBe(false);
  });
});

describe("non-mutating gestures never dissolve a grant", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function chartWith(range: [number, number], rightOffset?: number) {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
      ...(rightOffset !== undefined ? { timeScale: { rightOffset } } : {}),
    });
    chart.setCandles(makeCandles(300));
    chart.setVisibleLogicalRange(range[0], range[1]);
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    return { chart, scale, canvas };
  }

  it("a plain click keeps an in-bounds live-edge grant (rightOffset stays put)", () => {
    const { chart, canvas } = chartWith([215, 310], 5);
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 400, clientY: 150 }));

    chart.applyOptions({ timeScale: { rightOffset: 8 } });
    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(215, 6);
  });

  it("a tap-only interaction keeps a wide grant across resize (no auto-fit)", () => {
    const { chart, canvas } = chartWith([0, 1000]);
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 400, clientY: 150 }));

    chart.resize(900, 400);
    const r = chart.getVisibleLogicalRange();
    expect((r?.to ?? 0) - (r?.from ?? 0)).toBeGreaterThan(900); // not fit to ~300
  });

  it("a long-press crosshair keeps the grant", async () => {
    const { scale, canvas } = chartWith([215, 310]);
    // touchstart is required for the long-press timer; happy-dom lacks a
    // Touch constructor, so drive the timer path via a synthesized event.
    const finger = { clientX: 400, clientY: 150 };
    const touchStart = new Event("touchstart", { cancelable: true }) as TouchEvent;
    Object.defineProperty(touchStart, "touches", { value: [finger] });
    Object.defineProperty(touchStart, "changedTouches", { value: [finger] });
    canvas.dispatchEvent(touchStart);
    await sleep(600); // long-press fires at 500ms
    const touchEnd = new Event("touchend") as TouchEvent;
    Object.defineProperty(touchEnd, "touches", { value: [] });
    Object.defineProperty(touchEnd, "changedTouches", { value: [finger] });
    canvas.dispatchEvent(touchEnd);

    expect(scale.hasViewportGrant).toBe(true);
  });

  it("a real drag settle shrinks or dissolves the grant", () => {
    const { scale, canvas } = chartWith([215, 310]);
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 460, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 460, clientY: 150 }));
    // In-bounds resting position after a genuine move: grant dissolves.
    expect(scale.hasViewportGrant).toBe(false);
  });

  it("grabbing and releasing the scrollbar thumb keeps position and grant", () => {
    const { chart, scale, canvas } = chartWith([215, 310]);
    // Compute the thumb's actual location from the same math the renderer
    // and hit-test use: startFrac = startIndex/total over the scrollbar
    // strip at layout.scrollbarY — pressing INSIDE the thumb is a grab
    // (offset captured, nothing moves); only a track press would jump.
    const layout = (chart as unknown as { _layout: { scrollbarY: number; dataAreaWidth: number } })
      ._layout;
    const total = scale.totalCount;
    const thumbStartX = (Math.max(0, scale.startIndex / total) * layout.dataAreaWidth) | 0;
    const thumbEndX = (Math.min(1, scale.endIndex / total) * layout.dataAreaWidth) | 0;
    const insideThumbX = (thumbStartX + thumbEndX) / 2;
    const scrollbarMidY = layout.scrollbarY + 2;

    const beforeStart = scale.rawStartIndex;
    canvas.dispatchEvent(
      new MouseEvent("mousedown", { clientX: insideThumbX, clientY: scrollbarMidY }),
    );
    // Sanity: a grab must not have moved the viewport (else the press
    // missed the thumb and the test setup is wrong — fail loudly).
    expect(scale.rawStartIndex).toBe(beforeStart);
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { clientX: insideThumbX, clientY: scrollbarMidY }),
    );

    expect(scale.rawStartIndex).toBe(beforeStart); // startIndex unchanged
    expect(scale.hasViewportGrant).toBe(true); // grant intact
  });

  it("a thumb grab during an animation lets it complete with one emit", async () => {
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 300,
    });
    chart.setCandles(makeCandles(500));
    chart.setVisibleLogicalRange(100, 200);
    await sleep(500); // settle the initial move
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const layout = (chart as unknown as { _layout: { scrollbarY: number; dataAreaWidth: number } })
      ._layout;
    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;

    const events: unknown[] = [];
    chart.on("visibleRangeChange", (d) => events.push(d));
    chart.setVisibleLogicalRange(150, 250); // pure pan (same span → same spacing)
    await sleep(100); // mid-animation
    const thumbX =
      ((Math.max(0, scale.startIndex / scale.totalCount) +
        Math.min(1, scale.endIndex / scale.totalCount)) /
        2) *
      layout.dataAreaWidth;
    const y = layout.scrollbarY + 2;
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: thumbX, clientY: y }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: thumbX, clientY: y }));
    await sleep(500);

    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(150, 4); // completed
    expect(events.length).toBe(1); // exactly the completion emit
  });

  it("an absorbed zoom key during a pure-pan animation does not cancel it", async () => {
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 300,
    });
    chart.setCandles(makeCandles(500));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    // Pin bar spacing at the interactive max (50px): span = dataWidth / 50.
    const span = scale.width / 50;
    chart.setVisibleLogicalRange(100, 100 + span);
    await sleep(500);
    expect(scale.barSpacing).toBeCloseTo(50, 6);

    const events: unknown[] = [];
    chart.on("visibleRangeChange", (d) => events.push(d));
    chart.setVisibleLogicalRange(150, 150 + span); // pure pan at max spacing
    await sleep(100); // mid-animation
    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "+" })); // absorbed at 50px
    await sleep(500);

    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(150, 4); // completed
    expect(events.length).toBe(1);
  });

  it("an absorbed wheel zoom during a pure-pan animation does not cancel it", async () => {
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 300,
    });
    chart.setCandles(makeCandles(500));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const span = scale.width / 50;
    chart.setVisibleLogicalRange(100, 100 + span);
    await sleep(500);

    const events: unknown[] = [];
    chart.on("visibleRangeChange", (d) => events.push(d));
    chart.setVisibleLogicalRange(150, 150 + span);
    await sleep(100);
    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    // Zoom-in at the 50px cap: fully absorbed.
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -120, clientX: 400, clientY: 150, cancelable: true }),
    );
    await sleep(500);

    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(150, 4);
    expect(events.length).toBe(1);
  });

  it("an absorbed wheel leaves no idling inertia to ambush the next animation", async () => {
    // NOTE: happy-dom's rAF cadence does not reproduce the original ambush
    // (found by real-browser verification: an absorbed wheel armed a
    // silently idling zoom-inertia loop whose stale velocity cancelled the
    // next programmatic animation once it moved the spacing off the cap).
    // This test pins the end-to-end property — animation lands exactly
    // despite a preceding absorbed wheel — as a guard; the authoritative
    // regression check for the timing-dependent path is the real-browser
    // scenario suite used at verification time.
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 300,
    });
    chart.setCandles(makeCandles(500));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const span = scale.width / 50;
    chart.setVisibleLogicalRange(100, 100 + span); // pin spacing at the 50px cap
    await sleep(500);

    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    // Absorbed at the cap — but it used to ARM zoom inertia with residual
    // velocity that idled silently (~650ms of no-op frames)...
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -120, clientX: 400, clientY: 150, cancelable: true }),
    );
    await sleep(50);
    // ...until this animation moved the spacing off the cap, at which point
    // the stale velocity sprang back to life and cancelled it mid-flight.
    chart.setVisibleLogicalRange(300, 400);
    await sleep(600);
    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(300, 3);
    expect(
      (chart.getVisibleLogicalRange()?.to ?? 0) - (chart.getVisibleLogicalRange()?.from ?? 0),
    ).toBeCloseTo(100, 3);
  });

  it("a wheel-session timer does not corrupt a concurrent drag's settle", async () => {
    const { scale, canvas } = chartWith([215, 310]);
    // Wheel pan mutates and arms the 150ms session timer...
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 40, deltaY: 0, clientX: 400, clientY: 150 }),
    );
    // ...then a mouse drag starts and moves before the timer fires.
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 460, clientY: 150 }));
    await sleep(250); // wheel timer fires mid-drag
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 460, clientY: 150 }));

    // The drag's settle must still run: with a shared flag the wheel timer
    // reset it and the in-bounds grant survived incorrectly.
    expect(scale.hasViewportGrant).toBe(false);
  });

  it("a mid-session direction flip keeps the pre-flip pan's ratification", async () => {
    // A pan → zoom flip inside the 150ms window is the SAME compound
    // gesture. Treating the flip as a new session reset viewportMutated,
    // so a flip into a fully-absorbed zoom ended the session without
    // ratifying the pan — leaving a stale grant whose consumed margin
    // could be re-entered without resistance.
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
    });
    chart.setCandles(makeCandles(300));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const span = scale.width / 50; // pin spacing at the 50px interactive cap
    chart.setVisibleLogicalRange(-50, -50 + span); // beyond-left grant
    expect(scale.hasViewportGrant).toBe(true);

    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    // Two horizontal pan notches consume left margin; the ~10ms gap makes
    // the second sample land in the velocity window, building a real
    // panVelocity for the stale-flick half of the regression.
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 100, deltaY: 0, clientX: 400, clientY: 150 }),
    );
    await sleep(10);
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 100, deltaY: 0, clientX: 400, clientY: 150 }),
    );
    const panned = scale.rawStartIndex;
    expect(panned).toBeGreaterThan(-50);

    // Flip to a zoom-in within the window — fully absorbed at the cap.
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -120, clientX: 400, clientY: 150, cancelable: true }),
    );
    await sleep(400); // session timer fires; any inertia would settle here

    // The flipped axis must not inherit the pan's velocity: without the
    // flip-time reset the timer hands it to pan inertia as a "flick".
    expect(scale.rawStartIndex).toBeCloseTo(panned, 6);
    // The pan that preceded the flip WAS ratified: the consumed margin is
    // gone, so scrolling hard left stops at the panned position, not -50.
    expect(scale.hasViewportGrant).toBe(true);
    scale.scrollTo(-1e9);
    expect(scale.rawStartIndex).toBeCloseTo(panned, 6);
  });

  it("a real zoom followed by an absorbed-pan flip still ratifies the zoom's position", async () => {
    // Symmetric to the pan→absorbed-zoom case: absorbed PAN events must not
    // build panVelocity. Before the fix the timer's flick check ran
    // unconditionally, so a phantom flick started pan inertia whose
    // absorbed no-op run terminated without ratifying — losing the
    // ratification the real zoom movement was owed and leaving the stale
    // pre-zoom grant re-enterable.
    //
    // Absorbed pans are synthesized via float resolution: at a granted
    // position of 1e16 the ulp is 2, so a sub-1-bar delta rounds away to
    // nothing while its deltaX still feeds the velocity sampler.
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
    });
    chart.setCandles(makeCandles(300));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const start = 1e16;
    chart.setVisibleLogicalRange(start, start + scale.width / 40); // spacing 40
    expect(scale.hasViewportGrant).toBe(true);

    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    // Ten real zoom-outs (synchronous — no inertia frame runs in between):
    // spacing 40 → ~13.9, and the center anchor walks startIndex measurably
    // below the granted 1e16.
    for (let i = 0; i < 10; i++) {
      canvas.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 120, clientX: 400, clientY: 150, cancelable: true }),
      );
    }
    const zoomed = scale.rawStartIndex;
    expect(zoomed).toBeLessThanOrEqual(start - 2); // the zoom really moved

    // Flip to pan within the session; deltaX 12 < spacing (~13.9) is under
    // the 2-ulp resolution at ~1e16 — fully absorbed, but it used to sample
    // panVelocity from deltaX anyway.
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 12, deltaY: 0, clientX: 400, clientY: 150 }),
    );
    await sleep(10);
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 12, deltaY: 0, clientX: 400, clientY: 150 }),
    );
    expect(scale.rawStartIndex).toBe(zoomed); // premise: pans were absorbed

    await sleep(400); // session timer + (formerly) the phantom inertia run

    // The zoomed position was ratified: the envelope's right edge is now
    // the zoomed resting position, not the stale pre-zoom grant at 1e16.
    scale.scrollTo(1e18);
    expect(scale.rawStartIndex).toBe(zoomed);
  });

  it("an animation after absorbed pans completes (no phantom pan flick)", async () => {
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 300,
    });
    chart.setCandles(makeCandles(500));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const start = 1e16;
    chart.setVisibleLogicalRange(start, start + scale.width / 50); // spacing 50
    await sleep(500); // let the initial range animation settle
    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;

    // Three absorbed pans (deltaX 48 < 50 px = 0.96 bars, under the 2-ulp
    // resolution at 1e16). They move nothing, but before the fix they blended
    // a large panVelocity, and the timer (whose settle side effects were not
    // yet gated on viewportMutated) handed it to pan inertia as a flick —
    // cancelling the animation below the moment the inertia frame landed on
    // movable coordinates.
    for (let i = 0; i < 3; i++) {
      canvas.dispatchEvent(
        new WheelEvent("wheel", { deltaX: 48, deltaY: 0, clientX: 400, clientY: 150 }),
      );
      await sleep(10);
    }
    expect(scale.rawStartIndex).toBe(start); // premise: all absorbed

    chart.setVisibleLogicalRange(300, 400);
    await sleep(600);
    const r = chart.getVisibleLogicalRange();
    expect(r?.from).toBeCloseTo(300, 3);
    expect((r?.to ?? 0) - (r?.from ?? 0)).toBeCloseTo(100, 3);
  });

  it("an animation after a pan→absorbed-zoom flip completes (no stale-velocity cancel)", async () => {
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 300,
    });
    chart.setCandles(makeCandles(500));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const span = scale.width / 50;
    chart.setVisibleLogicalRange(100, 100 + span); // pin spacing at the cap
    await sleep(500);

    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 100, deltaY: 0, clientX: 400, clientY: 150 }),
    );
    await sleep(10);
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 100, deltaY: 0, clientX: 400, clientY: 150 }),
    );
    // Flip to an absorbed zoom-in. The flip must drop the pan velocity, or
    // the session timer (firing ~100ms into the animation below) hands the
    // stale horizontal velocity to pan inertia as a flick that mutates the
    // viewport and cancels the animation mid-flight.
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -120, clientX: 400, clientY: 150, cancelable: true }),
    );
    await sleep(50);
    chart.setVisibleLogicalRange(300, 400);
    await sleep(600);
    const r = chart.getVisibleLogicalRange();
    expect(r?.from).toBeCloseTo(300, 3);
    expect((r?.to ?? 0) - (r?.from ?? 0)).toBeCloseTo(100, 3);
  });

  it("an absorbed arrow at the boundary keeps an in-bounds grant", () => {
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
    });
    chart.setCandles(makeCandles(300));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    // Find the ordinary boundary, then grant exactly there with the same
    // spacing (same span → normalMaxStart unchanged).
    scale.scrollTo(1e9);
    const edge = scale.rawStartIndex;
    const span = scale.width / scale.barSpacing;
    chart.setVisibleLogicalRange(edge, edge + span);
    expect(scale.hasViewportGrant).toBe(true);

    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })); // absorbed
    expect(scale.rawStartIndex).toBeCloseTo(edge, 9);
    expect(scale.hasViewportGrant).toBe(true); // not dissolved by a no-op key
  });

  it("End releases a grant even when the position is already pinned", () => {
    document.body.innerHTML = "";
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
    });
    chart.setCandles(makeCandles(300));
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const pinned = scale.rawStartIndex; // setCandles lands at scrollToEnd
    const span = scale.width / scale.barSpacing;
    chart.setVisibleLogicalRange(pinned, pinned + span); // grant at the pinned spot
    expect(scale.hasViewportGrant).toBe(true);

    const canvas = document.body.querySelector("canvas") as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));
    expect(scale.rawStartIndex).toBeCloseTo(pinned, 9); // position identical
    expect(scale.hasViewportGrant).toBe(false); // grant release counted as the change
  });
});

describe("gesture-end coverage: mouseleave and touchcancel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function grantChart() {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
    });
    chart.setCandles(makeCandles(500));
    chart.setVisibleLogicalRange(450, 550); // granted margin past the pad
    const scale = (chart as unknown as { _timeScale: TimeScale })._timeScale;
    const canvas = document.body.querySelector("canvas");
    if (!canvas) throw new Error("no canvas");
    return { chart, scale, canvas };
  }

  it("releasing a drag outside the canvas (mouseleave) still settles the gesture", () => {
    const { scale, canvas } = grantChart();
    // Drag left, consuming part of the margin, then leave the canvas with
    // the button down — mouseup never arrives.
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 480, clientY: 150 }));
    const midDrag = scale.rawStartIndex;
    expect(midDrag).toBeLessThan(450); // moved toward the data
    canvas.dispatchEvent(new MouseEvent("mouseleave", { clientX: 900, clientY: 150 }));

    // The gesture settled: the envelope shrank to the resting position, so
    // the consumed margin is not re-enterable without a new API grant.
    scale.scrollTo(450);
    expect(scale.rawStartIndex).toBeCloseTo(midDrag, 6);
  });

  it("touchcancel runs the same settle path as touchend", () => {
    const { scale, canvas } = grantChart();
    // Enter a drag state (viewState is shared across handlers), then have
    // the browser cancel the gesture instead of ending it.
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 480, clientY: 150 }));
    const midDrag = scale.rawStartIndex;
    canvas.dispatchEvent(new Event("touchcancel"));

    scale.scrollTo(450);
    expect(scale.rawStartIndex).toBeCloseTo(midDrag, 6);
  });
});

describe("chart-level envelope integration (D2/D3)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("D2: a container resize does not auto-refit away a wide logical range", () => {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
    });
    chart.setCandles(makeCandles(300));
    chart.setVisibleLogicalRange(-20, 380); // wide: visibleCount >= total
    chart.resize(900, 400);
    expect(chart.getVisibleLogicalRange()?.from).toBeCloseTo(-20, 6);
  });

  it("D3: a rightOffset update leaves an active logical-range viewport alone", () => {
    const chart = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
      timeScale: { rightOffset: 5 },
    });
    chart.setCandles(makeCandles(300));
    chart.setVisibleLogicalRange(250, 330);

    chart.applyOptions({ timeScale: { rightOffset: 8 } });
    expect(chart.getVisibleLogicalRange()?.from).toBe(250); // not repositioned

    // The stored option DID update: after an explicit navigation releases
    // the grant, streaming at the live edge maintains the NEW margin.
    const candles = makeCandles(300);
    chart.setVisibleRange(candles[200].time, candles[299].time); // releases grant
    const flush = createChart(makeContainer(), {
      width: 800,
      height: 400,
      animationDuration: 0,
      timeScale: { rightOffset: 8 },
    });
    flush.setCandles(candles);
    const before = chart.getVisibleLogicalRange();
    const beforeFlush = flush.getVisibleLogicalRange();
    const next = { ...candles[299], time: candles[299].time + 60_000 };
    chart.updateCandle(next);
    flush.updateCandle(next);
    // Both advance by exactly one bar — the updated offset is in effect
    // (a follow with the old offset would differ from the reference chart).
    expect((chart.getVisibleLogicalRange()?.from ?? 0) - (before?.from ?? 0)).toBeCloseTo(1, 6);
    expect((flush.getVisibleLogicalRange()?.from ?? 0) - (beforeFlush?.from ?? 0)).toBeCloseTo(
      1,
      6,
    );
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
