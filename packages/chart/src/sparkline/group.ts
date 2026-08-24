import { safeDevicePixelRatio } from "../core/dpr";
import { resolveColors } from "./color-resolve";
import { drawMiniCandles } from "./draw-candle";
import { drawMiniLine } from "./draw-line";
import { buildSessionLayout, resolveBreakGapPx, type SessionLayout } from "./session";
import { createTooltip, type Tooltip } from "./tooltip";
import {
  DEFAULT_COLORS,
  type HoverPayload,
  type ResolvedColors,
  type SparklineCandle,
  type SparklineGroup,
  type SparklineGroupOptions,
  type SparklineHandle,
  type SparklineOptions,
} from "./types";

const DATA_ATTR = "data-tc-sparkline-id";

let __idCounter = 0;
const nextId = () => `sl${++__idCounter}`;

type Entry = {
  id: string;
  canvas: HTMLCanvasElement;
  opts: SparklineOptions;
  /** Effective render data (after maxCandles truncation, density fallback). */
  effectiveData: number[] | SparklineCandle[];
  /** 'line' | 'candle' after density fallback resolution. */
  effectiveType: "line" | "candle";
  /** Total horizontal slots (>= effectiveData.length). */
  effectiveSlots: number;
  /** Last-built session layout (null when not in session mode). */
  sessionLayout: SessionLayout | null;
  /** CSS-pixel size cached at last render. */
  cssWidth: number;
  cssHeight: number;
  /**
   * Size the author declared via the `width`/`height` attributes, captured
   * before the first render. Once rendered, those attributes hold the
   * DPR-scaled bitmap size instead, so the intent is only readable here.
   */
  authorWidth: number;
  authorHeight: number;
  /** Whether the last render found a real layout box to size from. */
  laidOut: boolean;
};

type GroupHoverConfig = {
  enabled: boolean;
  format: (d: HoverPayload) => string;
};

const defaultFormat = (d: HoverPayload): string => {
  if (d.candle) {
    const c = d.candle;
    return `O ${fmt(c.open)} H ${fmt(c.high)} L ${fmt(c.low)} C ${fmt(c.close)}`;
  }
  return fmt(d.value);
};

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(2);
  return v.toFixed(4);
}

/** CSS-pixel size used when nothing else can say how big the canvas is. */
const FALLBACK_CSS_WIDTH = 80;
const FALLBACK_CSS_HEIGHT = 30;

function setupCanvas(entry: Entry): {
  cssWidth: number;
  cssHeight: number;
  laidOut: boolean;
  ctx: CanvasRenderingContext2D | null;
} {
  const { canvas } = entry;
  const dpr = safeDevicePixelRatio();
  const rect = canvas.getBoundingClientRect();
  const laidOut = rect.width > 0 || canvas.clientWidth > 0;
  // Never fall back to canvas.width / canvas.height: those hold the
  // DPR-scaled bitmap this function wrote on the previous pass. Reading one
  // back as a CSS size re-multiplies it by dpr, so a canvas with no layout
  // box (display:none, a collapsed panel, not yet attached) grows its bitmap
  // by a factor of dpr on every render until the browser's dimension cap
  // invalidates it. The last CSS size we measured, and the size the author
  // declared, are both stable.
  const cssWidth =
    rect.width || canvas.clientWidth || entry.cssWidth || entry.authorWidth || FALLBACK_CSS_WIDTH;
  const cssHeight =
    rect.height ||
    canvas.clientHeight ||
    entry.cssHeight ||
    entry.authorHeight ||
    FALLBACK_CSS_HEIGHT;
  // Set bitmap size only if changed (avoid clearing).
  const targetW = Math.round(cssWidth * dpr);
  const targetH = Math.round(cssHeight * dpr);
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  // Author CSS may set this; ensure CSS size matches.
  if (!canvas.style.width) canvas.style.width = `${cssWidth}px`;
  if (!canvas.style.height) canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { cssWidth, cssHeight, laidOut, ctx };
}

/**
 * Read an author-declared `width`/`height` attribute, in CSS pixels.
 *
 * The attribute is absent on a plain `<canvas>` (whose `width` property still
 * reports the 300x150 default), so this distinguishes "the author asked for
 * this size" from "nobody has said anything yet" — but only before the first
 * render writes the bitmap size back onto the same attribute.
 */
function readAuthorSize(canvas: HTMLCanvasElement, attr: "width" | "height"): number {
  const raw = canvas.getAttribute(attr);
  if (raw === null) return 0;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function applyMaxCandles(
  data: number[] | SparklineCandle[],
  type: "line" | "candle",
  maxCandles: number,
): number[] | SparklineCandle[] {
  if (type !== "candle") return data;
  if (data.length <= maxCandles) return data;
  return (data as SparklineCandle[]).slice(data.length - maxCandles);
}

function resolveBaselineValue(
  opts: SparklineOptions,
  data: number[] | SparklineCandle[],
  type: "line" | "candle",
): number | null {
  if (opts.baseline === false) return null;
  if (typeof opts.baseline === "number") return opts.baseline;
  // 'auto' or undefined
  if (data.length === 0) return null;
  const first = data[0];
  if (typeof first === "number") return first;
  return type === "candle" ? first.open : first.close;
}

function renderEntry(entry: Entry, groupColors: ResolvedColors): void {
  const { opts } = entry;
  const setup = setupCanvas(entry);
  if (!setup.ctx) return;
  const { cssWidth, cssHeight } = setup;
  entry.cssWidth = cssWidth;
  entry.cssHeight = cssHeight;
  entry.laidOut = setup.laidOut;

  // Merge per-instance `colors` overrides on top of the group palette.
  const themeColors: ResolvedColors = opts.colors
    ? { ...groupColors, ...opts.colors }
    : groupColors;

  const maxCandles = opts.maxCandles ?? 60;
  const densityFallback = opts.densityFallback !== false;

  const data = applyMaxCandles(opts.data, opts.type, maxCandles);
  const slots = Math.max(data.length, opts.totalSlots ?? 0);
  let type: "line" | "candle" = opts.type;

  // Density fallback for candle mode — based on the slot width
  // (totalSlots stretches the spacing if set).
  if (type === "candle" && densityFallback && slots > 0) {
    const slot = cssWidth / slots;
    if (slot < 2) {
      type = "line";
    }
  }

  entry.effectiveData = data;
  entry.effectiveType = type;
  entry.effectiveSlots = slots;

  const baselineValue = resolveBaselineValue(opts, data, type);
  const colors = resolveColors(opts.color, data, type, themeColors);

  // Build session layout if `session` is set and data is candle-like.
  let layout: SessionLayout | null = null;
  if (opts.session && data.length > 0 && typeof data[0] === "object") {
    const gapPx = resolveBreakGapPx(opts.breakGap, cssWidth);
    layout = buildSessionLayout(opts.session, cssWidth, gapPx);
  }
  entry.sessionLayout = layout;

  if (type === "line") {
    drawMiniLine({
      ctx: setup.ctx,
      width: cssWidth,
      height: cssHeight,
      data,
      colors,
      themeColors,
      fill: opts.fill !== false,
      baselineValue,
      totalSlots: slots,
      sessionLayout: layout ?? undefined,
    });
  } else {
    // type === 'candle' — data must be SparklineCandle[]
    drawMiniCandles({
      ctx: setup.ctx,
      width: cssWidth,
      height: cssHeight,
      data: data as SparklineCandle[],
      colors,
      themeColors,
      baselineValue,
      totalSlots: slots,
      sessionLayout: layout ?? undefined,
    });
  }
}

function indexFromX(x: number, count: number, slots: number, width: number): number {
  if (count <= 0 || width <= 0 || slots <= 0) return -1;
  if (slots === 1) return 0;
  // Slots span [0, width]; data occupies the first `count` slots.
  // Hovering past the data range returns -1 (no tooltip).
  const i = Math.round((x / width) * (slots - 1));
  if (i < 0 || i >= count) return -1;
  return i;
}

/**
 * Find the index of the data point closest to mouse-x using the session
 * layout. Returns -1 if the cursor is in a break gap or past the last
 * data point in the session tail.
 */
function indexFromXSession(x: number, candles: SparklineCandle[], layout: SessionLayout): number {
  if (candles.length === 0) return -1;
  if (x < 0 || x > layout.width) return -1;
  if (layout.isInBreakGap(x)) return -1;
  const targetTime = layout.xToTime(x);
  if (targetTime === null) return -1;
  // Bisect candles by time
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < targetTime) lo = mid + 1;
    else hi = mid;
  }
  const cand: number[] = [];
  if (lo > 0) cand.push(lo - 1);
  cand.push(lo);
  let best = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const i of cand) {
    if (i < 0 || i >= candles.length) continue;
    const d = Math.abs(candles[i].time - targetTime);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  if (best < 0) return -1;
  // Reject "tail" hovers: if cursor is past the last candle by more than
  // half the median bar interval, hide the tooltip.
  if (candles.length >= 2) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const halfBarMs = (last.time - prev.time) / 2;
    if (targetTime > last.time + halfBarMs) return -1;
  }
  return best;
}

function indexFromXCandle(x: number, count: number, slots: number, width: number): number {
  if (count <= 0 || width <= 0 || slots <= 0) return -1;
  const slot = width / slots;
  const i = Math.floor(x / slot);
  if (i < 0 || i >= count) return -1;
  return i;
}

function buildHoverPayload(entry: Entry, index: number): HoverPayload | null {
  const data = entry.effectiveData;
  if (index < 0 || index >= data.length) return null;
  const d = data[index];
  if (typeof d === "number") {
    return { index, type: entry.effectiveType, value: d };
  }
  // OHLC payload only for candle mode. In line mode, even if the user feeds
  // candle data (e.g. to use `session`), the tooltip shows just the close.
  if (entry.effectiveType === "candle") {
    return { index, type: "candle", value: d.close, candle: d };
  }
  return { index, type: "line", value: d.close };
}

export function createSparklineGroup(groupOpts: SparklineGroupOptions): SparklineGroup {
  const { container } = groupOpts;
  const themeColors: ResolvedColors = { ...DEFAULT_COLORS };
  const entries = new Map<string, Entry>();

  const hoverConfig: GroupHoverConfig = (() => {
    const h = groupOpts.hover;
    if (h === false) return { enabled: false, format: defaultFormat };
    if (h === true || h === undefined) {
      return { enabled: true, format: defaultFormat };
    }
    return { enabled: true, format: h.format ?? defaultFormat };
  })();

  let tooltip: Tooltip | null = null;
  if (hoverConfig.enabled) tooltip = createTooltip();

  const onMove = (ev: MouseEvent) => {
    if (!tooltip) return;
    const target = ev.target as Element | null;
    const canvasEl = target && (target.closest?.(`[${DATA_ATTR}]`) as HTMLElement | null);
    if (!canvasEl) {
      tooltip.hide();
      return;
    }
    const id = canvasEl.getAttribute(DATA_ATTR);
    if (!id) return;
    const entry = entries.get(id);
    if (!entry || entry.opts.hover === false) {
      tooltip.hide();
      return;
    }
    const rect = canvasEl.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    // Use the live rect width — the canvas may have been detached when add()
    // was called (cached cssWidth would be the 80px fallback) and is now
    // displayed at its real CSS size.
    const liveWidth = rect.width || entry.cssWidth;
    const data = entry.effectiveData;
    const slots = entry.effectiveSlots || data.length;
    let idx: number;
    const layout = entry.sessionLayout;
    if (layout && data.length > 0 && typeof data[0] === "object") {
      // Rebuild if the live canvas width differs from the cached layout width
      // (e.g. after a resize) so hover stays in sync with the painted gaps.
      const useLayout =
        Math.abs(liveWidth - layout.width) < 0.5
          ? layout
          : buildSessionLayout(
              entry.opts.session as NonNullable<typeof entry.opts.session>,
              liveWidth,
              resolveBreakGapPx(entry.opts.breakGap, liveWidth),
            );
      idx = indexFromXSession(x, data as SparklineCandle[], useLayout);
    } else if (entry.effectiveType === "candle") {
      idx = indexFromXCandle(x, data.length, slots, liveWidth);
    } else {
      idx = indexFromX(x, data.length, slots, liveWidth);
    }
    const payload = buildHoverPayload(entry, idx);
    if (!payload) {
      tooltip.hide();
      return;
    }
    tooltip.show(ev.clientX, ev.clientY, hoverConfig.format(payload));
  };
  const onLeave = () => tooltip?.hide();

  if (hoverConfig.enabled) {
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
  }

  const add = (canvas: HTMLCanvasElement, opts: SparklineOptions): SparklineHandle => {
    const id = nextId();
    canvas.setAttribute(DATA_ATTR, id);
    const entry: Entry = {
      id,
      canvas,
      opts,
      effectiveData: opts.data,
      effectiveType: opts.type,
      effectiveSlots: 0,
      sessionLayout: null,
      cssWidth: 0,
      cssHeight: 0,
      // Captured here, before the first render overwrites these attributes
      // with the DPR-scaled bitmap size.
      authorWidth: readAuthorSize(canvas, "width"),
      authorHeight: readAuthorSize(canvas, "height"),
      laidOut: false,
    };
    entries.set(id, entry);
    renderEntry(entry, themeColors);
    // If the canvas had no layout box at add() time, the size above is a
    // fallback rather than a measurement. Defer a second render to next frame,
    // when the canvas is likely laid out.
    if (!entry.laidOut) {
      const raf =
        typeof requestAnimationFrame !== "undefined"
          ? requestAnimationFrame
          : (cb: () => void) => setTimeout(cb, 0);
      raf(() => {
        if (!entries.has(id)) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && Math.abs(rect.width - entry.cssWidth) > 0.5) {
          renderEntry(entry, themeColors);
        }
      });
    }

    return {
      update(partial) {
        entry.opts = { ...entry.opts, ...partial };
        renderEntry(entry, themeColors);
      },
      render() {
        renderEntry(entry, themeColors);
      },
      destroy() {
        canvas.removeAttribute(DATA_ATTR);
        entries.delete(id);
        // Clear the canvas
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    };
  };

  const destroy = () => {
    if (hoverConfig.enabled) {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
    }
    tooltip?.destroy();
    tooltip = null;
    for (const entry of entries.values()) {
      entry.canvas.removeAttribute(DATA_ATTR);
    }
    entries.clear();
  };

  return { add, destroy };
}
