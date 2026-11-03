/**
 * Signals Panel — Toggle buttons for derived trading signals (crossovers,
 * divergences, squeezes, price patterns) layered on top of the chart.
 *
 * Signals don't fit the `indicatorPresets` series-line model — they're sparse
 * events with their own visual idiom (markers, connecting lines, background
 * shading). Each entry computes signals from the current candles on toggle
 * and registers a primitive plugin that paints them on the main pane.
 *
 * Visual conventions follow the standard chart-pattern idiom (zigzag connectors
 * + neckline + measured-move target labels for price patterns; teal #26a69a /
 * coral #ef5350 color-pair with shape never relying on color alone).
 */

import type { ChartInstance, PrimitiveRenderContext } from "@trendcraft/chart";
import {
  connectPricePatterns,
  connectSqueezeDots,
  definePrimitive,
  filterPricePatterns,
} from "@trendcraft/chart";
import type { NormalizedCandle, PatternSignal } from "trendcraft";
import {
  bollingerSqueeze,
  deadCross,
  doubleBottom,
  doubleTop,
  goldenCross,
  headAndShoulders,
  inverseHeadAndShoulders,
  rsiDivergence,
} from "trendcraft";

type PluginHandle = { remove: () => void };

type SignalSpec = {
  id: string;
  label: string;
  description: string;
  /** Mirrors onto an RSI sub-pane, which the host's `RsiPaneProvider` keeps mounted. */
  usesRsiPane?: boolean;
  connect: (candles: NormalizedCandle[], env: SignalEnv) => PluginHandle | null;
};

/** Pane id of the RSI(14) preset under its own default snapshotName. */
const DEFAULT_RSI_PANE_ID = "rsi14";

/** Host-provided context passed to `SignalSpec.connect`. */
type SignalEnv = {
  /** Pane id of the RSI sub-pane the divergence connectors are mirrored into. */
  rsiPaneId: string;
};

/**
 * Lets the host keep an RSI sub-pane on the chart while RSI Divergence is on.
 * `acquire` makes sure an RSI indicator is mounted and returns its pane id;
 * `release` is called when the user turns the signal off (not on `destroy`,
 * so a panel rebuild does not drop the RSI the host restores).
 */
export type RsiPaneProvider = {
  acquire(): string;
  release(): void;
};

export type SignalsPanelHandle = {
  /** Ids of the signals currently shown, in activation order. */
  getActiveIds(): string[];
  destroy(): void;
};

// ---- Color tokens -----------------------------------------------------------

const BULL = "#26a69a";
const BEAR = "#ef5350";
const BULL_RGB = "38,166,154";
const BEAR_RGB = "239,83,80";

// ---- Render helpers ---------------------------------------------------------

function clipToPane(ctx: CanvasRenderingContext2D, pane: PrimitiveRenderContext["pane"]): void {
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  direction: "up" | "down",
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (direction === "up") {
    ctx.moveTo(x, y);
    ctx.lineTo(x - size, y + size * 1.4);
    ctx.lineTo(x + size, y + size * 1.4);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x - size, y - size * 1.4);
    ctx.lineTo(x + size, y - size * 1.4);
  }
  ctx.closePath();
  ctx.fill();
}

type LabelRect = { x: number; y: number; w: number; h: number };

/**
 * Pill-shaped label with a small triangular tail pointing back toward
 * (anchorX, anchorY). The pill itself is offset; the tail visually connects
 * label → anchor.
 *
 * The label is skipped when it would overlap one in `placed` (the labels
 * already drawn this frame): two signals a few bars apart would otherwise
 * stack their labels, one peeking out from behind the other. Returns whether
 * the label was drawn.
 */
function drawAnchoredLabel(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  text: string,
  bg: string,
  placement: "above" | "below",
  placed: LabelRect[],
): boolean {
  ctx.font = "11px system-ui, sans-serif";
  const padX = 6;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 18;
  const gap = 12;
  const labelY = placement === "above" ? anchorY - gap - h : anchorY + gap;
  const labelX = anchorX - w / 2;
  const r = 3;
  const overlaps = placed.some(
    (p) => labelX < p.x + p.w && p.x < labelX + w && labelY < p.y + p.h && p.y < labelY + h,
  );
  if (overlaps) return false;
  placed.push({ x: labelX, y: labelY, w, h });

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(labelX + r, labelY);
  ctx.lineTo(labelX + w - r, labelY);
  ctx.quadraticCurveTo(labelX + w, labelY, labelX + w, labelY + r);
  ctx.lineTo(labelX + w, labelY + h - r);
  ctx.quadraticCurveTo(labelX + w, labelY + h, labelX + w - r, labelY + h);
  ctx.lineTo(labelX + r, labelY + h);
  ctx.quadraticCurveTo(labelX, labelY + h, labelX, labelY + h - r);
  ctx.lineTo(labelX, labelY + r);
  ctx.quadraticCurveTo(labelX, labelY, labelX + r, labelY);
  ctx.closePath();
  ctx.fill();

  // Small tail
  ctx.beginPath();
  if (placement === "above") {
    ctx.moveTo(anchorX - 4, labelY + h);
    ctx.lineTo(anchorX + 4, labelY + h);
    ctx.lineTo(anchorX, labelY + h + 4);
  } else {
    ctx.moveTo(anchorX - 4, labelY);
    ctx.lineTo(anchorX + 4, labelY);
    ctx.lineTo(anchorX, labelY - 4);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, anchorX, labelY + h / 2);
  ctx.textAlign = "start";
  return true;
}

// ---- Signal: MA Cross (5/25) -----------------------------------------------

type CrossEvent = { index: number; price: number; type: "golden" | "dead" };

function makeMaCrossPlugin(candles: NormalizedCandle[]) {
  const gc = goldenCross(candles);
  const dc = deadCross(candles);
  const events: CrossEvent[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (gc[i]?.value) events.push({ index: i, price: candles[i].low, type: "golden" });
    if (dc[i]?.value) events.push({ index: i, price: candles[i].high, type: "dead" });
  }
  if (events.length === 0) return null;

  return definePrimitive<{ events: CrossEvent[] }>({
    name: "showcase-ma-cross",
    pane: "main",
    zOrder: "above",
    defaultState: { events },
    render({ ctx, pane, timeScale, priceScale }, state) {
      ctx.save();
      clipToPane(ctx, pane);
      const start = timeScale.startIndex;
      const end = timeScale.endIndex;
      for (const ev of state.events) {
        if (ev.index < start || ev.index >= end) continue;
        const x = timeScale.indexToX(ev.index);
        const y = priceScale.priceToY(ev.price);
        if (ev.type === "golden") {
          drawTriangle(ctx, x, y + 6, 6, "up", BULL);
        } else {
          drawTriangle(ctx, x, y - 6, 6, "down", BEAR);
        }
      }
      ctx.restore();
    },
  });
}

// ---- Signal: RSI Divergence (drawn on price pane) --------------------------

/**
 * Build a divergence-drawing primitive for either the price pane or the RSI
 * sub-pane. The price pane uses `price.first`/`price.second`; the RSI pane
 * uses `indicator.first`/`indicator.second`. Both anchor to the same swing
 * indices so the two lines are visually mirrored.
 */
function makeDivergencePrimitive(
  signals: ReturnType<typeof rsiDivergence>,
  paneId: string,
  name: string,
  pickValue: (sig: (typeof signals)[number]) => { first: number; second: number },
  withLabel: boolean,
) {
  return definePrimitive<{ signals: typeof signals }>({
    name,
    pane: paneId,
    zOrder: "above",
    defaultState: { signals },
    render({ ctx, pane, timeScale, priceScale }, state) {
      ctx.save();
      clipToPane(ctx, pane);
      const start = timeScale.startIndex;
      const end = timeScale.endIndex;
      const placed: LabelRect[] = [];
      // Newest first, so where two labels would overlap the latest one is kept
      for (const sig of [...state.signals].reverse()) {
        if (sig.secondIdx < start || sig.firstIdx >= end) continue;
        const v = pickValue(sig);
        const x1 = timeScale.indexToX(sig.firstIdx);
        const x2 = timeScale.indexToX(sig.secondIdx);
        const y1 = priceScale.priceToY(v.first);
        const y2 = priceScale.priceToY(v.second);
        const color = sig.type === "bullish" ? BULL : BEAR;
        const rgb = sig.type === "bullish" ? BULL_RGB : BEAR_RGB;

        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x1, y1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x2, y2, 3, 0, Math.PI * 2);
        ctx.fill();

        if (withLabel) {
          const label = sig.type === "bullish" ? "Bull Div" : "Bear Div";
          drawAnchoredLabel(
            ctx,
            x2,
            y2,
            label,
            `rgba(${rgb},0.9)`,
            sig.type === "bullish" ? "below" : "above",
            placed,
          );
        }
      }
      ctx.restore();
    },
  });
}

/**
 * Connect RSI divergence visualization. Draws on the price pane (the
 * label-bearing primitive) and a mirrored connector on the RSI sub-pane
 * `rsiPaneId`, so the divergence reads on both the price and the oscillator.
 */
function connectRsiDivergence(candles: NormalizedCandle[], rsiPaneId: string): PluginHandle | null {
  const signals = rsiDivergence(candles);
  if (signals.length === 0) return null;

  const pricePlugin = makeDivergencePrimitive(
    signals,
    "main",
    "showcase-rsi-divergence-price",
    (s) => s.price,
    true,
  );
  chartRef.registerPrimitive(pricePlugin);

  // An indicator's sub-pane id is its snapshotName. If that pane goes away
  // (the user removes RSI) the registered primitive is harmless — the chart
  // simply has no such pane to render into.
  const rsiPlugin = makeDivergencePrimitive(
    signals,
    rsiPaneId,
    "showcase-rsi-divergence-rsi",
    (s) => s.indicator,
    false,
  );
  chartRef.registerPrimitive(rsiPlugin);

  return {
    remove: () => {
      chartRef.removePrimitive(pricePlugin.name);
      chartRef.removePrimitive(rsiPlugin.name);
    },
  };
}

// ---- Signal: Bollinger Squeeze (TTM-style dots via chart plugin) -----------

// ---- Signal: Price Patterns (Double Top/Bottom + H&S) ----------------------
//
// Rendered through `connectPricePatterns` from `@trendcraft/chart` — the
// zigzag + neckline + measured-move idiom is now a generic chart primitive
// reusable across hosts.

// ---- Specs ------------------------------------------------------------------

const SPECS: SignalSpec[] = [
  {
    id: "maCross",
    label: "MA Cross (5/25)",
    description: "Golden / Death cross of SMA(5) and SMA(25) — triangle markers",
    connect: (candles) => {
      const plugin = makeMaCrossPlugin(candles);
      if (!plugin) return null;
      chartRef.registerPrimitive(plugin);
      return { remove: () => chartRef.removePrimitive(plugin.name) };
    },
  },
  {
    id: "rsiDivergence",
    label: "RSI Divergence",
    description:
      "Mirrored dashed connectors on price pane + RSI sub-pane (adds RSI(14) if it is not on)",
    usesRsiPane: true,
    connect: (candles, env) => connectRsiDivergence(candles, env.rsiPaneId),
  },
  {
    id: "bbSqueeze",
    label: "Bollinger Squeeze",
    description: "TTM-style dots along the pane bottom — red = active squeeze, green = release",
    connect: (candles) => {
      const sigs = bollingerSqueeze(candles, { threshold: 10 });
      if (sigs.length === 0) return null;
      return connectSqueezeDots(chartRef, sigs, candles);
    },
  },
  {
    id: "pricePatterns",
    label: "Price Patterns",
    description:
      "Double Top/Bottom + Head & Shoulders rendered as zigzag + neckline + measured-move target",
    connect: (candles) => {
      const signals: PatternSignal[] = [
        ...doubleBottom(candles),
        ...doubleTop(candles),
        ...inverseHeadAndShoulders(candles),
        ...headAndShoulders(candles),
      ];
      // `connectPricePatterns` applies the same confidence + dedup filter
      // internally; pre-filter here so we can keep the toggle off (and
      // preserve the panel's empty-state warning) when nothing survives.
      if (filterPricePatterns(signals).length === 0) return null;
      return connectPricePatterns(chartRef, signals);
    },
  },
];

let chartRef: ChartInstance = null as unknown as ChartInstance;

export function createSignalsPanel(
  container: HTMLElement,
  candles: NormalizedCandle[],
  chart: ChartInstance,
  opts: {
    /** Signals to show right away (used when the panel is rebuilt). */
    initialActive?: readonly string[];
    rsiPane?: RsiPaneProvider;
  } = {},
): SignalsPanelHandle {
  chartRef = chart;
  const active = new Map<string, PluginHandle>();
  const toggles = new Map<string, () => void>();
  const panelRoot = document.createElement("div");
  panelRoot.dataset.role = "signals-panel";
  container.appendChild(panelRoot);

  const header = document.createElement("div");
  header.style.cssText =
    "padding:10px 12px;background:var(--bg);border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;";
  header.textContent = "\u25BC Signals";
  panelRoot.appendChild(header);

  for (const spec of SPECS) {
    const row = document.createElement("div");
    row.style.cssText =
      "padding:8px 12px 8px 24px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px;user-select:none;";

    const checkbox = document.createElement("div");
    checkbox.style.cssText =
      "width:14px;height:14px;border:1px solid var(--text-muted);border-radius:3px;margin-top:2px;flex-shrink:0;";

    const text = document.createElement("div");
    text.style.cssText = "flex:1;min-width:0;";
    const title = document.createElement("div");
    title.textContent = spec.label;
    title.style.cssText = "font-weight:500;";
    const desc = document.createElement("div");
    desc.textContent = spec.description;
    desc.style.cssText = "font-size:11px;color:var(--text-muted);margin-top:2px;";
    text.appendChild(title);
    text.appendChild(desc);

    row.appendChild(checkbox);
    row.appendChild(text);
    panelRoot.appendChild(row);

    const applyActive = (isActive: boolean) => {
      if (isActive) {
        checkbox.style.background = "var(--accent)";
        checkbox.style.borderColor = "var(--accent)";
        row.style.background = "color-mix(in srgb, var(--accent) 12%, transparent)";
      } else {
        checkbox.style.background = "transparent";
        checkbox.style.borderColor = "var(--text-muted)";
        row.style.background = "transparent";
      }
    };

    const flashEmpty = () => {
      const original = desc.textContent;
      const originalColor = desc.style.color;
      desc.textContent = "No events detected on the current dataset";
      desc.style.color = "var(--down)";
      setTimeout(() => {
        desc.textContent = original;
        desc.style.color = originalColor;
      }, 1800);
    };

    const rsiPane = spec.usesRsiPane ? opts.rsiPane : undefined;
    const toggle = () => {
      const existing = active.get(spec.id);
      if (existing) {
        existing.remove();
        active.delete(spec.id);
        applyActive(false);
        rsiPane?.release();
      } else {
        const rsiPaneId = rsiPane?.acquire() ?? DEFAULT_RSI_PANE_ID;
        const handle = spec.connect(candles, { rsiPaneId });
        if (!handle) {
          rsiPane?.release();
          console.warn(`Signal ${spec.id} produced no events for the current dataset`);
          flashEmpty();
          return;
        }
        active.set(spec.id, handle);
        applyActive(true);
      }
    };
    toggles.set(spec.id, toggle);
    row.addEventListener("click", toggle);
  }

  for (const id of opts.initialActive ?? []) {
    if (!active.has(id)) toggles.get(id)?.();
  }

  return {
    getActiveIds() {
      return [...active.keys()];
    },
    destroy() {
      for (const h of active.values()) h.remove();
      active.clear();
      panelRoot.remove();
    },
  };
}
