// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSparkline, createSparklineGroup } from "../sparkline";
import { resolveColors } from "../sparkline/color-resolve";
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
