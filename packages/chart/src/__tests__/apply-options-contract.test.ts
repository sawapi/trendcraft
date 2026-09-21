// @vitest-environment happy-dom
/**
 * applyOptions contract.
 *
 * `applyOptions` promises that every provided field is either applied at
 * runtime or produces a "cannot be changed at runtime" warning. This file
 * pins the two halves of that promise:
 *
 * - interaction options that used to be captured once at construction
 *   (`hotkeys`, `interaction.wheelInertia`, `crosshair.lockOnLongPress`,
 *   `scrollSensitivity`) now reach the live handlers;
 * - the creation-only fields warn only when the provided value differs from
 *   the one in effect, so replaying an unchanged options object is silent;
 * - every `ChartOptions` key is classified (the table below is total by
 *   type) and, for an "applied" key, applying it must change the chart's
 *   internal state, so a new option cannot fall into a silent third bucket.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeScale } from "../core/scale";
import type { CandleData, ChartInstance, ChartOptions } from "../core/types";
import { Viewport } from "../core/viewport";
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

/** Explicit size: happy-dom has no layout, so the chart must not depend on clientWidth. */
const SIZE = { width: 800, height: 400 } as const;

function makeCandles(count: number): CandleData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1_700_000_000_000 + i * 60_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 1000,
  }));
}

function canvasOf(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector("canvas") as HTMLCanvasElement;
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400, x: 0, y: 0 }) as DOMRect;
  return canvas;
}

function keydown(el: HTMLElement, key: string, code: string, init: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}

function touchStart(el: HTMLElement, x: number, y: number) {
  const touch = { clientX: x, clientY: y, identifier: 0, target: el } as unknown as Touch;
  el.dispatchEvent(
    new TouchEvent("touchstart", { touches: [touch], bubbles: true, cancelable: true }),
  );
}

function wheel(el: HTMLElement, init: WheelEventInit) {
  el.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init }));
}

function collectWarnings(chart: ChartInstance): string[] {
  const messages: string[] = [];
  chart.on("error", (e) => messages.push((e as { message: string }).message));
  return messages;
}

let chart: ChartInstance | null = null;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  document.body.innerHTML = "";
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  chart?.destroy();
  chart = null;
  warnSpy.mockRestore();
  vi.useRealTimers();
});

describe("applyOptions — interaction options reach the live handlers", () => {
  it("hotkeys: false stops hotkeys and built-in keys; a new map rebinds them", () => {
    const container = makeContainer();
    chart = createChart(container, SIZE);
    chart.setCandles(makeCandles(300));
    const canvas = canvasOf(container);
    const setDrawingTool = vi.spyOn(chart, "setDrawingTool");

    // stimulus: the default map binds Alt+T to the trendline tool
    keydown(canvas, "t", "KeyT", { altKey: true });
    expect(setDrawingTool).toHaveBeenLastCalledWith("trendline");
    expect(keydown(canvas, "Escape", "Escape").defaultPrevented).toBe(true);

    chart.applyOptions({ hotkeys: false });
    setDrawingTool.mockClear();
    keydown(canvas, "t", "KeyT", { altKey: true });
    expect(setDrawingTool).not.toHaveBeenCalled();
    expect(keydown(canvas, "Escape", "Escape").defaultPrevented).toBe(false);

    chart.applyOptions({ hotkeys: { "Alt+KeyT": "hline" } });
    keydown(canvas, "t", "KeyT", { altKey: true });
    expect(setDrawingTool).toHaveBeenLastCalledWith("hline");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("crosshair.lockOnLongPress toggles the long-press crosshair lock", () => {
    vi.useFakeTimers();
    const container = makeContainer();
    chart = createChart(container, SIZE);
    chart.setCandles(makeCandles(300));
    const canvas = canvasOf(container);
    const moves: Array<unknown> = [];
    chart.on("crosshairMove", (d) => moves.push(d));

    // crosshairMove is de-duplicated on an unchanged index, so each hold
    // lands on a different bar (different x) to be observable on its own.
    // stimulus: a 600 ms hold locks the crosshair by default
    touchStart(canvas, 400, 200);
    vi.advanceTimersByTime(600);
    expect(moves.length).toBe(1);

    chart.applyOptions({ crosshair: { lockOnLongPress: false } });
    touchStart(canvas, 300, 200);
    vi.advanceTimersByTime(600);
    expect(moves.length).toBe(1);

    chart.applyOptions({ crosshair: { lockOnLongPress: true } });
    touchStart(canvas, 200, 200);
    vi.advanceTimersByTime(600);
    expect(moves.length).toBe(2);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("interaction.wheelInertia gates the inertia tail of the next wheel gesture", () => {
    vi.useFakeTimers();
    // Inertia arms itself with requestAnimationFrame synchronously inside the
    // wheel handler; count the frames requested during each dispatch. The
    // chart's own render loop only re-requests when a frame runs, and no
    // frame runs here (the callbacks are never invoked).
    const g = globalThis as unknown as {
      requestAnimationFrame: (cb: FrameRequestCallback) => number;
      cancelAnimationFrame: (id: number) => void;
    };
    const originalRaf = g.requestAnimationFrame;
    const originalCaf = g.cancelAnimationFrame;
    let rafCalls = 0;
    g.requestAnimationFrame = () => ++rafCalls;
    g.cancelAnimationFrame = () => {};
    try {
      const container = makeContainer();
      chart = createChart(container, { ...SIZE, interaction: { wheelInertia: false } });
      chart.setCandles(makeCandles(300));
      const canvas = canvasOf(container);
      const framesRequestedBy = (fire: () => void) => {
        const before = rafCalls;
        fire();
        return rafCalls - before;
      };
      const zoom = () => wheel(canvas, { deltaY: 120, clientX: 400, clientY: 200 });

      // stimulus check: the wheel event zooms (so inertia would arm if enabled)
      const before = chart.getVisibleRange();
      expect(framesRequestedBy(zoom)).toBe(0);
      expect(chart.getVisibleRange()).not.toEqual(before);
      vi.advanceTimersByTime(300); // let the wheel session settle

      chart.applyOptions({ interaction: { wheelInertia: true } });
      expect(framesRequestedBy(zoom)).toBeGreaterThan(0);
      vi.advanceTimersByTime(300);
      keydown(canvas, "Escape", "Escape"); // stops both inertia loops

      chart.applyOptions({ interaction: { wheelInertia: false } });
      expect(framesRequestedBy(zoom)).toBe(0);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      g.requestAnimationFrame = originalRaf;
      g.cancelAnimationFrame = originalCaf;
    }
  });

  it("scrollSensitivity scales the next wheel zoom and no longer warns", () => {
    vi.useFakeTimers();
    const container = makeContainer();
    chart = createChart(container, { ...SIZE, interaction: { wheelInertia: false } });
    chart.setCandles(makeCandles(300));
    const canvas = canvasOf(container);
    const warnings = collectWarnings(chart);

    const span = () => {
      const r = chart?.getVisibleRange();
      return r ? r.endIndex - r.startIndex : Number.NaN;
    };
    const s0 = span();
    wheel(canvas, { deltaY: 100, clientX: 400, clientY: 200 });
    const slow = s0 - span();
    vi.advanceTimersByTime(300);

    chart.applyOptions({ scrollSensitivity: 1 });
    expect(warnings).toEqual([]);
    const s1 = span();
    wheel(canvas, { deltaY: 100, clientX: 400, clientY: 200 });
    const fast = s1 - span();

    // stimulus: both events zoomed; the second by a larger step
    expect(slow).not.toBe(0);
    expect(fast).not.toBe(0);
    expect(Math.abs(fast)).toBeGreaterThan(Math.abs(slow));
  });
});

describe("applyOptions — creation-only fields warn only when the value differs", () => {
  const formatInfoOverlay = () => "x";
  const locale = {
    volume: "Vol",
    months: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"],
  };

  it("replaying the creation values is silent", () => {
    chart = createChart(makeContainer(), { pixelRatio: 2, locale, formatInfoOverlay });
    const warnings = collectWarnings(chart);
    chart.applyOptions({
      pixelRatio: 2,
      locale: { ...locale, months: [...locale.months] },
      formatInfoOverlay,
    });
    chart.applyOptions({ locale: { volume: "Vol" } }); // a subset equal to what is in effect
    expect(warnings).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("a different value warns, naming only the fields that changed", () => {
    chart = createChart(makeContainer(), { pixelRatio: 2, locale, formatInfoOverlay });
    const warnings = collectWarnings(chart);
    chart.applyOptions({ pixelRatio: 3, locale, formatInfoOverlay });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("[pixelRatio]");

    chart.applyOptions({ locale: { volume: "Volume" } });
    expect(warnings).toHaveLength(2);
    expect(warnings[1]).toContain("[locale]");

    chart.applyOptions({ formatInfoOverlay: () => "y" });
    expect(warnings).toHaveLength(3);
    expect(warnings[2]).toContain("[formatInfoOverlay]");
  });

  it("pinning pixelRatio on a chart that follows devicePixelRatio is a change", () => {
    chart = createChart(makeContainer());
    const warnings = collectWarnings(chart);
    chart.applyOptions({ pixelRatio: window.devicePixelRatio });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("[pixelRatio]");
  });
});

/**
 * Structural snapshot of the chart instance's own fields (depth-limited, DOM
 * nodes and cycles skipped, functions by identity). An "applied" option must
 * move something in here; a key that applyOptions never reads leaves it equal.
 */
function snapshot(chart: unknown): string {
  const fnIds = new Map<unknown, number>();
  const seen = new WeakSet<object>();
  const walk = (v: unknown, depth: number): unknown => {
    if (typeof v === "function") {
      if (!fnIds.has(v)) fnIds.set(v, fnIds.size);
      return `fn#${fnIds.get(v)}`;
    }
    if (v === null || typeof v !== "object") return typeof v === "number" ? String(v) : v;
    if (typeof Node !== "undefined" && v instanceof Node) return "<node>";
    if (seen.has(v) || depth > 3) return "<ref>";
    seen.add(v);
    if (Array.isArray(v)) return v.slice(0, 50).map((x) => walk(x, depth + 1));
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) {
      if (k === "_needsRender" || k === "_rafId") continue;
      out[k] = walk((v as Record<string, unknown>)[k], depth + 1);
    }
    return out;
  };
  return JSON.stringify(walk(chart, 0));
}

describe("applyOptions — every ChartOptions key is applied or warned", () => {
  type Expectation = { value: unknown; outcome: "applied" | "warned" };
  // Total by type: adding a key to ChartOptions without classifying it here fails typecheck.
  const table: Record<keyof ChartOptions, Expectation> = {
    width: { value: 640, outcome: "applied" },
    height: { value: 320, outcome: "applied" },
    theme: { value: "light", outcome: "applied" },
    pixelRatio: { value: 3, outcome: "warned" },
    priceAxisWidth: { value: 70, outcome: "applied" },
    timeAxisHeight: { value: 30, outcome: "applied" },
    fontFamily: { value: "serif", outcome: "applied" },
    fontSize: { value: 13, outcome: "applied" },
    priceFormatter: { value: (p: number) => String(p), outcome: "applied" },
    timeFormatter: { value: (t: number) => String(t), outcome: "applied" },
    watermark: { value: "WM", outcome: "applied" },
    legend: { value: false, outcome: "applied" },
    volume: { value: false, outcome: "applied" },
    showSeriesBadges: { value: true, outcome: "applied" },
    seriesBadgeMode: { value: "visible", outcome: "applied" },
    scrollSensitivity: { value: 0.7, outcome: "applied" },
    chartType: { value: "line", outcome: "applied" },
    formatInfoOverlay: { value: () => "z", outcome: "warned" },
    animationDuration: { value: 0, outcome: "applied" },
    locale: { value: { volume: "Volumen" }, outcome: "warned" },
    maxCandles: { value: 50, outcome: "applied" },
    crosshair: { value: { mode: "magnet", lockOnLongPress: false }, outcome: "applied" },
    hotkeys: { value: false, outcome: "applied" },
    interaction: { value: { wheelInertia: false }, outcome: "applied" },
    timeScale: { value: { rightOffset: 2 }, outcome: "applied" },
  };

  for (const [key, { value, outcome }] of Object.entries(table)) {
    it(`${key} → ${outcome}`, () => {
      chart = createChart(makeContainer(), SIZE);
      chart.setCandles(makeCandles(50));
      const warnings = collectWarnings(chart);
      const before = snapshot(chart);
      chart.applyOptions({ [key]: value } as Partial<ChartOptions>);
      if (outcome === "warned") {
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain(`[${key}]`);
      } else {
        expect(warnings).toEqual([]);
        // the option reached some state — not merely "no warning"
        expect(snapshot(chart)).not.toBe(before);
      }
    });
  }
});

describe("applyOptions — untyped and non-finite values", () => {
  it("null for an interaction field leaves it alone instead of throwing or flipping it", () => {
    const container = makeContainer();
    chart = createChart(container, SIZE);
    chart.setCandles(makeCandles(50));
    const canvas = canvasOf(container);
    const setDrawingTool = vi.spyOn(chart, "setDrawingTool");
    chart.applyOptions({
      hotkeys: null,
      interaction: { wheelInertia: null },
      crosshair: { lockOnLongPress: null },
      locale: null,
    } as unknown as Partial<ChartOptions>);
    keydown(canvas, "t", "KeyT", { altKey: true }); // still the default map
    expect(setDrawingTool).toHaveBeenLastCalledWith("trendline");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("a non-finite scrollSensitivity warns and keeps the current sensitivity", () => {
    vi.useFakeTimers();
    const container = makeContainer();
    chart = createChart(container, { ...SIZE, interaction: { wheelInertia: false } });
    chart.setCandles(makeCandles(300));
    const canvas = canvasOf(container);
    const warnings = collectWarnings(chart);
    const span = () => {
      const r = chart?.getVisibleRange();
      return r ? r.endIndex - r.startIndex : Number.NaN;
    };
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      chart.applyOptions({ scrollSensitivity: bad });
      const s0 = span();
      wheel(canvas, { deltaY: 100, clientX: 400, clientY: 200 });
      expect(Number.isFinite(span())).toBe(true);
      expect(span()).not.toBe(s0); // zoom still works with the previous sensitivity
      vi.advanceTimersByTime(300);
    }
    expect(warnings).toHaveLength(3);
    expect(warnings.every((w) => w.includes("scrollSensitivity"))).toBe(true);
  });
});

describe("headless Viewport interaction settings", () => {
  type Settings = {
    sens: number;
    longPressEnabled: boolean;
    wheelInertiaEnabled: boolean;
    hotkeyDisabled: boolean;
  };
  const settingsOf = (vp: Viewport) => (vp as unknown as { _settings: Settings })._settings;
  const attach = (vp: Viewport, sens?: number, opts?: Parameters<Viewport["attach"]>[7]) => {
    const el = document.createElement("div");
    return vp.attach(
      el,
      new TimeScale(),
      () => [],
      () => null,
      undefined,
      undefined,
      sens,
      opts,
    );
  };

  it("attach() starts from the defaults each time; the arguments override them", () => {
    const vp = new Viewport();
    let detach = attach(vp, 1.5, { hotkeys: false, wheelInertia: false, lockOnLongPress: false });
    expect(settingsOf(vp)).toMatchObject({
      sens: 1.5,
      hotkeyDisabled: true,
      wheelInertiaEnabled: false,
      longPressEnabled: false,
    });
    detach();
    detach = attach(vp);
    expect(settingsOf(vp)).toMatchObject({
      sens: 0.3,
      hotkeyDisabled: false,
      wheelInertiaEnabled: true,
      longPressEnabled: true,
    });
    detach();
  });

  it("setInteractionOptions() after attach changes the shared settings; non-finite sensitivity is ignored", () => {
    const vp = new Viewport();
    const detach = attach(vp);
    vp.setInteractionOptions({ scrollSensitivity: 0.01, hotkeys: false });
    expect(settingsOf(vp)).toMatchObject({ sens: 0.1, hotkeyDisabled: true });
    vp.setInteractionOptions({ scrollSensitivity: Number.NaN });
    expect(settingsOf(vp).sens).toBe(0.1);
    detach();
  });
});
