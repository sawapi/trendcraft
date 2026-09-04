// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSparkline, createSparklineGroup } from "../sparkline";
import { resolveColors } from "../sparkline/color-resolve";
import { candlePitchPx } from "../sparkline/draw-candle";
import { buildSessionLayout } from "../sparkline/session";
import { DEFAULT_COLORS, type SparklineCandle } from "../sparkline/types";

type Call = { method: string; args: unknown[] };

function makeMockCtx(): {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
} {
  const calls: Call[] = [];
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => {
      if (prop === "canvas") return null;
      if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
      // Track method calls only.
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
      };
    },
    set: () => true,
  };
  const ctx = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

let lastCalls: Call[] = [];

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => {
    const m = makeMockCtx();
    lastCalls = m.calls;
    return m.ctx;
  };
  // Ensure getBoundingClientRect returns sensible values.
  Element.prototype.getBoundingClientRect = function () {
    const w = Number.parseFloat((this as HTMLElement).style.width || "80");
    const h = Number.parseFloat((this as HTMLElement).style.height || "30");
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: w,
      height: h,
      bottom: h,
      right: w,
      toJSON: () => ({}),
    } as DOMRect;
  };
});

beforeEach(() => {
  document.body.innerHTML = "";
  lastCalls = [];
});

function makeCanvas(parent?: HTMLElement): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.style.width = "80px";
  cv.style.height = "30px";
  (parent ?? document.body).appendChild(cv);
  return cv;
}

describe("resolveColors", () => {
  it("auto on line returns up color when last >= first", () => {
    const r = resolveColors({ trend: "auto" }, [10, 11, 12], "line", DEFAULT_COLORS);
    expect(r.stroke).toBe(DEFAULT_COLORS.up);
    expect(r.perCandle).toBe(false);
  });

  it("auto on line returns down color when last < first", () => {
    const r = resolveColors({ trend: "auto" }, [10, 9, 8], "line", DEFAULT_COLORS);
    expect(r.stroke).toBe(DEFAULT_COLORS.down);
  });

  it("auto on candle uses per-candle coloring", () => {
    const candles: SparklineCandle[] = [
      { time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 0 },
    ];
    const r = resolveColors({ trend: "auto" }, candles, "candle", DEFAULT_COLORS);
    expect(r.perCandle).toBe(true);
  });

  it("period on candle forces single color across all candles", () => {
    const candles: SparklineCandle[] = [
      { time: 1, open: 100, high: 101, low: 99, close: 100, volume: 0 },
      { time: 2, open: 100, high: 102, low: 99, close: 101, volume: 0 },
    ];
    const r = resolveColors({ trend: "period" }, candles, "candle", DEFAULT_COLORS);
    expect(r.perCandle).toBe(false);
    expect(r.stroke).toBe(DEFAULT_COLORS.up);
  });

  it("baseline preset compares last close to baseline", () => {
    const up = resolveColors({ baseline: 100 }, [99, 100, 101], "line", DEFAULT_COLORS);
    expect(up.stroke).toBe(DEFAULT_COLORS.up);
    const down = resolveColors({ baseline: 100 }, [101, 100, 99], "line", DEFAULT_COLORS);
    expect(down.stroke).toBe(DEFAULT_COLORS.down);
  });

  it("fixed returns the single color", () => {
    const r = resolveColors({ fixed: "#abcdef" }, [1, 2, 3], "line", DEFAULT_COLORS);
    expect(r.stroke).toBe("#abcdef");
    expect(r.fill).toBe("#abcdef");
  });

  it("explicit up/down on candle mode triggers per-candle coloring", () => {
    const candles: SparklineCandle[] = [
      { time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 0 },
    ];
    const r = resolveColors({ up: "#0f0", down: "#f00" }, candles, "candle", DEFAULT_COLORS);
    expect(r.perCandle).toBe(true);
    expect(r.up).toBe("#0f0");
    expect(r.down).toBe("#f00");
  });
});

describe("createSparkline (single)", () => {
  it("renders without throwing on closes array", () => {
    const cv = makeCanvas();
    const sl = createSparkline(cv, {
      type: "line",
      data: [10, 11, 12, 11, 13],
      color: { trend: "auto" },
    });
    // Some drawing methods should have been invoked.
    expect(lastCalls.length).toBeGreaterThan(0);
    sl.destroy();
  });

  it("renders candle mode with OHLC data", () => {
    const cv = makeCanvas();
    const candles: SparklineCandle[] = Array.from({ length: 10 }, (_, i) => ({
      time: i,
      open: 100 + i,
      high: 102 + i,
      low: 98 + i,
      close: 101 + i,
      volume: 0,
    }));
    const sl = createSparkline(cv, {
      type: "candle",
      data: candles,
      color: { trend: "auto" },
    });
    expect(lastCalls.some((c) => c.method === "fillRect")).toBe(true);
    sl.destroy();
  });

  it("update() re-renders without leaking handles", () => {
    const cv = makeCanvas();
    const sl = createSparkline(cv, { type: "line", data: [1, 2, 3] });
    const before = lastCalls.length;
    sl.update({ data: [3, 2, 1] });
    expect(lastCalls.length).toBeGreaterThanOrEqual(before);
    sl.destroy();
  });

  it("colors override is applied to fill/stroke", () => {
    const cv = makeCanvas();
    const sl = createSparkline(cv, {
      type: "line",
      data: [10, 11, 12],
      color: { trend: "auto" },
      colors: { up: "#123456", down: "#abcdef" },
    });
    // Find a fillStyle/strokeStyle assignment on the proxy. Since the proxy's
    // setters return true and don't track values directly, we instead verify
    // that the relevant draw methods ran.
    expect(lastCalls.some((c) => c.method === "stroke")).toBe(true);
    sl.destroy();
  });

  it("destroy() removes data attribute and tooltip element", () => {
    const cv = makeCanvas();
    const sl = createSparkline(cv, { type: "line", data: [1, 2, 3] });
    expect(cv.hasAttribute("data-tc-sparkline-id")).toBe(true);
    sl.destroy();
    expect(cv.hasAttribute("data-tc-sparkline-id")).toBe(false);
    expect(document.querySelectorAll("[data-tc-sparkline-tooltip]").length).toBe(0);
  });
});

describe("createSparklineGroup", () => {
  it("shares one tooltip across multiple sparklines", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const group = createSparklineGroup({ container, hover: true });

    const c1 = makeCanvas(container);
    const c2 = makeCanvas(container);
    group.add(c1, { type: "line", data: [1, 2, 3] });
    group.add(c2, { type: "line", data: [3, 2, 1] });

    expect(document.querySelectorAll("[data-tc-sparkline-tooltip]").length).toBe(1);

    group.destroy();
    expect(document.querySelectorAll("[data-tc-sparkline-tooltip]").length).toBe(0);
  });

  it("density fallback switches candle to line when slot < 2px", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const group = createSparklineGroup({ container, hover: false });
    const cv = makeCanvas(container);
    cv.style.width = "60px";
    const candles: SparklineCandle[] = Array.from({ length: 50 }, (_, i) => ({
      time: i,
      open: 100,
      high: 101,
      low: 99,
      close: 100 + (i % 3),
      volume: 0,
    }));
    group.add(cv, { type: "candle", data: candles });
    // 60px / 50 candles = 1.2px slot → falls back to line. Expect no fillRect.
    const usedFillRect = lastCalls.some((c) => c.method === "fillRect");
    expect(usedFillRect).toBe(false);
    group.destroy();
  });

  it("hover delegate sets tooltip text via mousemove", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const group = createSparklineGroup({
      container,
      hover: { format: (d) => `idx=${d.index}` },
    });
    const cv = makeCanvas(container);
    group.add(cv, { type: "line", data: [10, 20, 30, 40, 50] });

    // Dispatch mousemove on canvas.
    const ev = new MouseEvent("mousemove", {
      bubbles: true,
      clientX: 80,
      clientY: 15,
    });
    Object.defineProperty(ev, "target", { value: cv, writable: false });
    container.dispatchEvent(ev);

    const tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
    expect(tip?.textContent).toMatch(/idx=/);
    group.destroy();
  });

  it("session maps candles by time and skips break ranges", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const group = createSparklineGroup({
      container: root,
      hover: { format: (d) => `idx=${d.index}` },
    });
    const cv = makeCanvas(root);
    cv.style.width = "120px";

    // 09:00, 11:00, 13:00 candles in a 09:00-15:00 session with 11:30-12:30 break.
    // Active duration = 6h - 1h = 5h.
    // Expected fractions: 09:00→0/300=0, 11:00→120/300=0.4, 13:00→180/300=0.6.
    const sessionStart = Date.UTC(2026, 3, 28, 9);
    const sessionEnd = Date.UTC(2026, 3, 28, 15);
    const breakStart = Date.UTC(2026, 3, 28, 11, 30);
    const breakEnd = Date.UTC(2026, 3, 28, 12, 30);
    const candles: SparklineCandle[] = [
      {
        time: Date.UTC(2026, 3, 28, 9),
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 0,
      },
      {
        time: Date.UTC(2026, 3, 28, 11),
        open: 100.5,
        high: 102,
        low: 100,
        close: 101.5,
        volume: 0,
      },
      {
        time: Date.UTC(2026, 3, 28, 13),
        open: 101.5,
        high: 103,
        low: 101,
        close: 102.5,
        volume: 0,
      },
    ];
    group.add(cv, {
      type: "candle",
      data: candles,
      session: {
        start: sessionStart,
        end: sessionEnd,
        breaks: [{ start: breakStart, end: breakEnd }],
      },
    });

    // x = 0.4 * 120 = 48 → second candle (11:00, idx=1)
    const ev1 = new MouseEvent("mousemove", {
      bubbles: true,
      clientX: 48,
      clientY: 15,
    });
    Object.defineProperty(ev1, "target", { value: cv, writable: false });
    root.dispatchEvent(ev1);
    let tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
    expect(tip?.textContent).toBe("idx=1");

    // x = 0.6 * 120 = 72 → third candle (13:00, idx=2). Note: in session
    // mapping, 11:30-12:30 is collapsed, so x=0.5 maps to ~12:00 (in break,
    // gets rejected) but x=0.6 = 13:00 exactly.
    const ev2 = new MouseEvent("mousemove", {
      bubbles: true,
      clientX: 72,
      clientY: 15,
    });
    Object.defineProperty(ev2, "target", { value: cv, writable: false });
    root.dispatchEvent(ev2);
    tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
    expect(tip?.textContent).toBe("idx=2");

    group.destroy();
  });

  it("totalSlots leaves the right side blank and hover suppresses past data", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const group = createSparklineGroup({
      container: root,
      hover: { format: (d) => `idx=${d.index}` },
    });
    const cv = makeCanvas(root);
    cv.style.width = "100px";
    // 5 data points but 10 total slots → data fills left half, right half blank.
    group.add(cv, {
      type: "line",
      data: [10, 11, 12, 13, 14],
      totalSlots: 10,
    });

    // Hover at x=20 (within data, slot ≈ 2). Expect index ~2.
    const hover = (clientX: number) => {
      const ev = new MouseEvent("mousemove", {
        bubbles: true,
        clientX,
        clientY: 15,
      });
      Object.defineProperty(ev, "target", { value: cv, writable: false });
      root.dispatchEvent(ev);
    };
    hover(20);
    let tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
    expect(tip?.textContent).toMatch(/idx=2/);

    // Hover at x=80 (right blank area, slot 8 of 10) → no tooltip.
    hover(80);
    tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
    expect(tip?.style.display).toBe("none");
    group.destroy();
  });

  it("hover index uses live rect width (handles canvas added detached then attached)", () => {
    // Reproduces the showcase case: build a wrapper offscreen, add() while
    // detached, then attach to root. Hover at a known x must map to the right
    // index using the live width, not the cached 80px fallback.
    const root = document.createElement("div");
    document.body.appendChild(root);
    const group = createSparklineGroup({
      container: root,
      hover: { format: (d) => `idx=${d.index}` },
    });

    // Build canvas in detached wrap
    const wrap = document.createElement("div");
    const cv = document.createElement("canvas");
    cv.style.width = "120px";
    cv.style.height = "30px";
    wrap.appendChild(cv);
    group.add(cv, { type: "line", data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }); // 11 points

    // Now attach
    root.appendChild(wrap);

    // Hover at right edge (x=120). With live width=120 and 11 points,
    // expected index = 10 (last). With buggy cached width=80, would
    // clamp to 10 too — pick a middle x to differentiate.
    // x=60 with live width 120 → 0.5 * 10 = 5.
    // x=60 with cached width 80 → 0.75 * 10 = 7.5 → 8 (wrong).
    const ev = new MouseEvent("mousemove", {
      bubbles: true,
      clientX: 60,
      clientY: 15,
    });
    Object.defineProperty(ev, "target", { value: cv, writable: false });
    root.dispatchEvent(ev);

    const tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
    expect(tip?.textContent).toBe("idx=5");
    group.destroy();
  });
});

// ---------------------------------------------------------------------------
// Session geometry
//
// Three sibling computations used to describe the same layout differently:
// `timeToX` / `segmentIndexOf` / `isInBreakGap` disagreed about which side of a
// break `break.start` falls on, and the density fallback measured a candle with
// the slot-mode formula even in session mode, where the real pitch is the
// distance between the pixels the layout places consecutive candles at.
// `classify` and `candlePitchPx` are now the single owners.
// ---------------------------------------------------------------------------

function candleAt(time: number, i: number): SparklineCandle {
  return { time, open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: 0 };
}

function renderSpark(
  width: number,
  height: number,
  opts: Record<string, unknown>,
): { bodies: number[][]; vertices: number[] } {
  document.body.innerHTML = "";
  const root = document.createElement("div");
  document.body.appendChild(root);
  const cv = makeCanvas(root);
  cv.style.width = `${width}px`;
  cv.style.height = `${height}px`;
  const group = createSparklineGroup({ container: root });
  lastCalls = [];
  group.add(cv, opts as never);
  const bodies = lastCalls.filter((c) => c.method === "fillRect").map((c) => c.args as number[]);
  const vertices = lastCalls
    .filter((c) => c.method === "lineTo" || c.method === "moveTo")
    .map((c) => (c.args as number[])[0]);
  group.destroy();
  return { bodies, vertices };
}

describe("session layout boundary convention", () => {
  const SESSION = { start: 0, end: 100, breaks: [{ start: 40, end: 60 }] };

  it("puts break.start in the segment that ends there, in every lookup", () => {
    const layout = buildSessionLayout(SESSION, 100, 10);

    // t = 40 is the last instant before the break. It used to get a pixel from
    // timeToX (45) and -1 from segmentIndexOf, and the pixel it got was then
    // classified as inside the gap.
    expect(layout.classify(40)).toEqual({ segment: 0, x: 45 });
    expect(layout.timeToX(40)).toBe(45);
    expect(layout.segmentIndexOf(40)).toBe(0);
    expect(layout.isInBreakGap(45)).toBe(false);
    expect(layout.xToTime(45)).toBe(40);

    // t = 60 is the first instant after it, and was already consistent.
    expect(layout.classify(60)).toEqual({ segment: 1, x: 55 });
    expect(layout.isInBreakGap(55)).toBe(false);

    // The interior of the gap is still empty.
    expect(layout.isInBreakGap(50)).toBe(true);
    expect(layout.classify(50)).toEqual({ segment: -1, x: null });
  });

  it("keeps timeToX and segmentIndexOf in agreement across the whole session", () => {
    const layout = buildSessionLayout(SESSION, 100, 10);
    let positioned = 0;
    let inBreak = 0;
    let boundary = 0;

    for (let t = -5; t <= 105; t += 0.5) {
      const { segment, x } = layout.classify(t);
      // The two projections must never disagree about whether `t` has a place.
      expect(layout.timeToX(t) === null).toBe(segment < 0);
      expect(layout.segmentIndexOf(t)).toBe(segment);
      expect(x === null).toBe(segment < 0);
      if (x !== null) {
        positioned++;
        // A positioned time is never in a visual gap.
        expect(layout.isInBreakGap(x)).toBe(false);
      } else if (t >= 0 && t <= 100) {
        inBreak++;
      }
      if (t === 0 || t === 40 || t === 60 || t === 100) boundary++;
    }

    // Guard against a sweep that never reaches the interesting values.
    expect(positioned).toBeGreaterThan(0);
    expect(inBreak).toBeGreaterThan(0);
    expect(boundary).toBe(4);
  });

  it("renders the break.start candle in line mode as well as candle mode", () => {
    const times = [0, 10, 20, 30, 40, 60, 70, 80];
    const data = times.map(candleAt);
    const opts = { data, session: SESSION, breakGap: 10, maxCandles: 1000 };

    const candle = renderSpark(100, 30, { ...opts, type: "candle" });
    const line = renderSpark(100, 30, { ...opts, type: "line" });

    // t = 40 sits at x = 45. Line mode used to drop it, ending the morning
    // polyline at x = 33.75 and showing a 21.25px gap where 10px was configured.
    expect(line.vertices).toContain(45);
    expect(candle.bodies.map((b) => b[0])).toContain(42); // body centred on 45
  });

  it("resolves a hover on the break.start pixel to that candle", () => {
    document.body.innerHTML = "";
    const root = document.createElement("div");
    document.body.appendChild(root);
    const group = createSparklineGroup({
      container: root,
      hover: { format: (d) => `idx=${d.index}` },
    });
    const cv = makeCanvas(root);
    cv.style.width = "100px";
    group.add(cv, {
      type: "candle",
      data: [0, 10, 20, 30, 40, 60, 70, 80].map(candleAt),
      session: SESSION,
      breakGap: 10,
      maxCandles: 1000,
    });

    // x = 45 is where the t = 40 candle was painted; isInBreakGap used to
    // report it as inside the gap and the tooltip never appeared.
    const ev = new MouseEvent("mousemove", { bubbles: true, clientX: 45, clientY: 15 });
    Object.defineProperty(ev, "target", { value: cv, writable: false });
    root.dispatchEvent(ev);
    const tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
    expect(tip?.textContent).toBe("idx=4");

    group.destroy();
  });
});

describe("session density and candle cap", () => {
  const DAY = Date.UTC(2026, 3, 28, 0);
  const HOUR = 3_600_000;
  const JPX = {
    start: DAY,
    end: DAY + 6.5 * HOUR,
    breaks: [{ start: DAY + 2.5 * HOUR, end: DAY + 3.5 * HOUR }],
  };
  const bars = (count: number, stepMs: number) =>
    Array.from({ length: count }, (_, i) => candleAt(DAY + i * stepMs, i));

  it("does not crop the head of a session chart by default", () => {
    const data = bars(66, 5 * 60_000);

    const withSession = renderSpark(200, 40, { type: "candle", data, session: JPX });
    // 66 bars, 11 of which fall inside the lunch break. The default cap of 60
    // used to drop 6 more from the head, moving the leftmost body from -1 to 17
    // on a 200px canvas and leaving that strip blank with nothing to explain it.
    expect(withSession.bodies.length).toBe(55);
    expect(Math.min(...withSession.bodies.map((b) => b[0]))).toBe(-1);

    // An explicit cap is still honoured.
    const capped = renderSpark(200, 40, {
      type: "candle",
      data,
      session: JPX,
      maxCandles: 60,
    });
    expect(capped.bodies.length).toBe(49);
    expect(Math.min(...capped.bodies.map((b) => b[0]))).toBe(17);

    // And slot mode, which has no blank-region problem, keeps its default.
    const slotMode = renderSpark(200, 40, { type: "candle", data });
    expect(slotMode.bodies.length).toBe(60);
  });

  it("falls back to a line when the real candle pitch is under 2px", () => {
    // 30 one-minute bars in a 6.5h session: the slot-mode formula sees
    // 80 / 30 = 2.67px and kept candles, while the pitch the renderer actually
    // paints at is 60000 * (80 / 23_400_000) = 0.205px. The result was 30
    // clamped 1px bodies overlapping inside the leftmost 6 pixels.
    const partial = renderSpark(80, 30, {
      type: "candle",
      data: bars(30, 60_000),
      session: { start: DAY, end: DAY + 6.5 * HOUR },
    });
    expect(partial.bodies.length).toBe(0);
    expect(partial.vertices.length).toBeGreaterThan(0);

    // Same bar count, but spread across the whole session: pitch 2.67px, so
    // candles stay candles. The fallback has to be selective to be useful.
    const full = renderSpark(80, 30, {
      type: "candle",
      data: bars(30, 13 * 60_000),
      session: { start: DAY, end: DAY + 6.5 * HOUR },
    });
    expect(full.bodies.length).toBe(30);
  });

  it("measures the pitch across a break from where the candles land", () => {
    // A sparse series whose largest time gap spans a break. The layout removes
    // the break's duration and puts `breakGap` there instead, so the on-canvas
    // distance is nothing like `dt * pxPerMs`: on a 10px canvas with a 1px gap
    // these three candles sit 1px and 0.11px apart, while measuring from the
    // raw 20ms and 1ms deltas reported 2.25px and kept them as candles.
    const session = { start: 0, end: 100, breaks: [{ start: 40, end: 60 }] };
    const data = [40, 60, 61].map((t, i) => candleAt(t, i));
    const layout = buildSessionLayout(session, 10, 1);

    const xs = data.map((c) => layout.timeToX(c.time) as number);
    expect(xs).toEqual([4.5, 5.5, 5.6125]);
    expect(candlePitchPx({ data, width: 10, totalSlots: 0, sessionLayout: layout })).toBeCloseTo(
      1,
      10,
    );

    const rendered = renderSpark(10, 30, {
      type: "candle",
      data,
      session,
      breakGap: 1,
      maxCandles: 1000,
    });
    expect(rendered.bodies.length).toBe(0);
    expect(rendered.vertices.length).toBeGreaterThan(0);
  });

  it("still counts a break-spanning gap as spacing when the candles are wide", () => {
    // The same shape on a canvas roomy enough to draw it: the fallback must not
    // fire just because a pair straddles a break.
    const session = { start: 0, end: 100, breaks: [{ start: 40, end: 60 }] };
    const data = [0, 20, 40, 60, 80, 100].map((t, i) => candleAt(t, i));
    const rendered = renderSpark(300, 40, {
      type: "candle",
      data,
      session,
      breakGap: 10,
      maxCandles: 1000,
    });
    expect(rendered.bodies.length).toBe(6);
  });

  it("keeps a lone visible candle when most of the data is not painted", () => {
    // One candle inside the session, a hundred inside the break. Counting the
    // hundred put the pitch at 80/101 = 0.79px, the fallback chose a line, and a
    // line needs two visible points — so the canvas came out completely blank
    // (0 bodies, 0 line vertices) with one perfectly drawable candle in hand.
    const session = { start: 0, end: 100, breaks: [{ start: 20, end: 80 }] };
    const data = [
      candleAt(10, 0),
      ...Array.from({ length: 100 }, (_, i) => candleAt(21 + i * 0.5, i + 1)),
    ];
    const layout = buildSessionLayout(session, 80, 2);
    expect(data.filter((c) => layout.timeToX(c.time) !== null)).toHaveLength(1);

    expect(candlePitchPx({ data, width: 80, totalSlots: 0, sessionLayout: layout })).toBe(80);

    const rendered = renderSpark(80, 30, {
      type: "candle",
      data,
      session,
      breakGap: 2,
      maxCandles: 1000,
    });
    expect(rendered.bodies).toHaveLength(1);
  });

  it("reports no pitch when the layout paints nothing at all", () => {
    const session = { start: 0, end: 100, breaks: [{ start: 20, end: 80 }] };
    const layout = buildSessionLayout(session, 80, 2);
    // Every candle is inside the break.
    const hidden = Array.from({ length: 10 }, (_, i) => candleAt(25 + i, i));
    expect(candlePitchPx({ data: hidden, width: 80, totalSlots: 0, sessionLayout: layout })).toBe(
      0,
    );

    // Candles that share a timestamp stack on one pixel: no spacing to measure,
    // so each gets an equal share of the canvas rather than a pitch of 0.
    const stacked = [candleAt(10, 0), candleAt(10, 1), candleAt(10, 2)];
    expect(candlePitchPx({ data: stacked, width: 90, totalSlots: 0, sessionLayout: layout })).toBe(
      30,
    );
  });

  it("lets dense intraday data degrade to a line instead of a blank session", () => {
    // 330 one-minute bars. Truncating to 60 before the density check made the
    // pitch look like 3.3px, so it stayed in candle mode over a session window
    // it covered a fraction of.
    const dense = renderSpark(200, 40, {
      type: "candle",
      data: bars(330, 60_000),
      session: JPX,
    });
    expect(dense.bodies.length).toBe(0);
    expect(dense.vertices.length).toBeGreaterThan(0);
  });

  it("honours densityFallback: false", () => {
    const kept = renderSpark(80, 30, {
      type: "candle",
      data: bars(30, 60_000),
      session: { start: DAY, end: DAY + 6.5 * HOUR },
      densityFallback: false,
    });
    expect(kept.bodies.length).toBe(30);
  });
});

describe("session layout invariants", () => {
  it("keeps the forward, inverse and gap lookups in agreement everywhere", () => {
    const SHAPES: Array<[string, Parameters<typeof buildSessionLayout>[0]]> = [
      ["no breaks", { start: 0, end: 1000 }],
      ["one break", { start: 0, end: 1000, breaks: [{ start: 400, end: 600 }] }],
      [
        "two breaks",
        {
          start: 0,
          end: 1200,
          breaks: [
            { start: 300, end: 400 },
            { start: 800, end: 900 },
          ],
        },
      ],
      [
        // Unmerged, these count their overlap twice and stretch every pixel.
        "overlapping",
        {
          start: 0,
          end: 1000,
          breaks: [
            { start: 100, end: 400 },
            { start: 300, end: 500 },
          ],
        },
      ],
      [
        "touching",
        {
          start: 0,
          end: 1000,
          breaks: [
            { start: 400, end: 500 },
            { start: 500, end: 600 },
          ],
        },
      ],
      ["break at start", { start: 0, end: 1000, breaks: [{ start: 0, end: 200 }] }],
      // A trailing break leaves a zero-length final segment — the shape that
      // caught the pinned end pixel disagreeing with its own start pixel.
      ["break at end", { start: 0, end: 1000, breaks: [{ start: 800, end: 1000 }] }],
      ["full break", { start: 0, end: 1000, breaks: [{ start: 0, end: 1000 }] }],
      ["zero-length session", { start: 50, end: 50 }],
      ["negative times", { start: -1000, end: -200, breaks: [{ start: -700, end: -500 }] }],
    ];
    // Float-hostile widths, and gaps from none to wider than the canvas.
    const WIDTHS = [1, 2, 50, 80, 100, 137, 333.33, 500, 1000];
    const GAPS = [0, 1, 2, 5, 7, 10, 50, 500];

    let positioned = 0;
    let gapPixels = 0;
    // Collect rather than assert per sample: 131k samples x 5 assertions with
    // eagerly built messages is slow enough to trip the suite timeout, and a
    // list of violations reads better than the first failure anyway.
    const violations: string[] = [];
    const note = (kind: string, where: string, detail: string) => {
      if (violations.length < 10) violations.push(`${kind} ${where} ${detail}`);
    };

    for (const [label, session] of SHAPES) {
      for (const width of WIDTHS) {
        for (const gap of GAPS) {
          const layout = buildSessionLayout(session, width, gap);
          const where = `${label} w=${width} gap=${gap}`;
          const span = session.end - session.start;

          // The layout spans the canvas: the session's last instant is its
          // right edge, to the last bit.
          const end = layout.classify(session.end);
          if (end.x !== null && end.x !== width) note("EDGE", where, `x=${end.x}`);

          for (let k = 0; k <= 200; k++) {
            const t = span === 0 ? session.start : session.start + (span * k) / 200;
            const { x, segment } = layout.classify(t);
            if (x === null) {
              if (segment !== -1) note("SEGMENT", where, `t=${t} segment=${segment}`);
              continue;
            }
            positioned++;
            if (!(x >= 0 && x <= width)) note("RANGE", where, `t=${t} x=${x}`);
            // A time that has a pixel is never sitting in a visual gap.
            if (layout.isInBreakGap(x)) note("IN-GAP", where, `t=${t} x=${x}`);
            // With a real gap the mapping is injective, so it round-trips.
            // `breakGap: 0` deliberately collapses both sides of a break onto
            // the same pixel, which no inverse can undo.
            if (layout.gapPx > 0 && layout.usablePx > 0) {
              const back = layout.xToTime(x);
              if (back === null || layout.classify(back).segment !== segment) {
                note("ROUND-TRIP", where, `t=${t} x=${x} back=${back}`);
              }
            }
          }

          // Segments and gaps tile the canvas: every pixel is one or the other.
          for (let k = 0; k <= 200; k++) {
            const x = (width * k) / 200;
            const inGap = layout.isInBreakGap(x);
            if (inGap) gapPixels++;
            if ((layout.xToTime(x) === null) !== inGap) {
              note("TILING", where, `x=${x} inGap=${inGap}`);
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);

    // Guard against a matrix that never produces the interesting states.
    expect(positioned).toBeGreaterThan(100_000);
    expect(gapPixels).toBeGreaterThan(10_000);
  });

  it("merges overlapping breaks instead of counting the overlap twice", () => {
    const overlapping = buildSessionLayout(
      {
        start: 0,
        end: 100,
        breaks: [
          { start: 40, end: 70 },
          { start: 50, end: 60 },
        ],
      },
      100,
      10,
    );
    // One 40-70 break, not two, so the layout matches the equivalent session.
    expect(overlapping.breaks).toEqual([{ start: 40, end: 70 }]);
    expect(overlapping.activeMs).toBe(70);
    expect(overlapping.classify(100)).toEqual(
      buildSessionLayout(
        { start: 0, end: 100, breaks: [{ start: 40, end: 70 }] },
        100,
        10,
      ).classify(100),
    );
  });

  it("makes every painted candle reachable by hover", () => {
    const DAY = Date.UTC(2026, 3, 28, 0);
    const HOUR = 3_600_000;
    const session = {
      start: DAY,
      end: DAY + 6.5 * HOUR,
      breaks: [{ start: DAY + 2.5 * HOUR, end: DAY + 3.5 * HOUR }],
    };
    const data = Array.from({ length: 40 }, (_, i) => candleAt(DAY + i * 10 * 60_000, i));

    document.body.innerHTML = "";
    const root = document.createElement("div");
    document.body.appendChild(root);
    const group = createSparklineGroup({
      container: root,
      hover: { format: (d) => `idx=${d.index}` },
    });
    const cv = makeCanvas(root);
    cv.style.width = "300px";
    group.add(cv, { type: "candle", data, session, breakGap: 10, maxCandles: 1000 });

    const layout = buildSessionLayout(session, 300, 10);
    let hovered = 0;
    let skipped = 0;
    for (let i = 0; i < data.length; i++) {
      const x = layout.timeToX(data[i].time);
      if (x === null) {
        skipped++;
        continue;
      }
      // Hover at the exact pixel the renderer used. Rounding it up would land
      // in the break gap for the candle stamped at `break.start`, which sits on
      // the gap's first pixel — the gap is open there, one pixel wide either
      // side is not.
      const ev = new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: 15 });
      Object.defineProperty(ev, "target", { value: cv, writable: false });
      root.dispatchEvent(ev);
      const tip = document.querySelector("[data-tc-sparkline-tooltip]") as HTMLElement | null;
      // A candle the renderer painted must be a candle the hover path can find.
      expect(tip?.textContent, `candle ${i} at x=${x}`).toBe(`idx=${i}`);
      hovered++;
    }
    // Both populations must be non-empty or the loop proves nothing.
    expect(hovered).toBeGreaterThan(0);
    expect(skipped).toBeGreaterThan(0);

    group.destroy();
  });
});
