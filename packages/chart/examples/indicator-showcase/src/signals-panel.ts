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
import { connectSqueezeDots, definePrimitive } from "@trendcraft/chart";
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
  connect: (candles: NormalizedCandle[]) => PluginHandle | null;
};

export type SignalsPanelHandle = {
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

/**
 * Pill-shaped label with a small triangular tail pointing back toward (anchorX, anchorY).
 * The pill itself is offset; the tail visually connects label → anchor.
 */
function drawAnchoredLabel(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  text: string,
  bg: string,
  placement: "above" | "below",
): void {
  ctx.font = "11px system-ui, sans-serif";
  const padX = 6;
  const padY = 3;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 18;
  const gap = 12;
  const labelY = placement === "above" ? anchorY - gap - h : anchorY + gap;
  const labelX = anchorX - w / 2;
  const r = 3;

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
      for (const sig of state.signals) {
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
          );
        }
      }
      ctx.restore();
    },
  });
}

/**
 * Connect RSI divergence visualization. Always draws on the price pane (the
 * label-bearing primitive). Additionally, if the user has enabled the default
 * RSI(14) indicator, draws a mirrored connector on the RSI sub-pane — this is
 * the TradingView-standard "both panes" rendering.
 */
function connectRsiDivergence(candles: NormalizedCandle[]): PluginHandle | null {
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

  // Pane id for the default RSI(14) preset matches its snapshotName "rsi14"
  // (see `helpers.ts:97` + `live-presets.ts` snapshotName fn). If no RSI is
  // mounted the registered primitive is harmless — the chart simply has no
  // such pane to render into.
  const rsiPlugin = makeDivergencePrimitive(
    signals,
    "rsi14",
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
// The "山" idiom: connect each pattern's keyPoints with a continuous zigzag
// line, draw the neckline as a dashed reference, shade the pattern body, and
// label the salient anchors (e.g. "Bottom 1" / "Bottom 2" / "Target").

type PatternRender = {
  signal: PatternSignal;
  bullish: boolean;
};

const ANCHOR_LABEL_MAP: Record<string, string> = {
  "First Trough": "Bottom 1",
  "Second Trough": "Bottom 2",
  "First Peak": "Top 1",
  "Second Peak": "Top 2",
  "Left Shoulder": "L. Shoulder",
  Head: "Head",
  "Right Shoulder": "R. Shoulder",
};

function makePricePatternsPlugin(candles: NormalizedCandle[]) {
  const all: PatternSignal[] = [
    ...doubleBottom(candles),
    ...doubleTop(candles),
    ...inverseHeadAndShoulders(candles),
    ...headAndShoulders(candles),
  ];
  if (all.length === 0) return null;

  // Dedup overlapping detections by keeping the highest-confidence pattern in
  // each [startTime, endTime] envelope. Filter low-confidence noise and cap
  // the total so dense regions don't pile up overlays.
  const MIN_CONFIDENCE = 60;
  const MAX_PATTERNS = 8;
  const sorted = all
    .filter((s) => s.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence);
  const accepted: PatternSignal[] = [];
  for (const sig of sorted) {
    if (accepted.length >= MAX_PATTERNS) break;
    const overlaps = accepted.some(
      (acc) =>
        sig.pattern.startTime <= acc.pattern.endTime &&
        sig.pattern.endTime >= acc.pattern.startTime,
    );
    if (!overlaps) accepted.push(sig);
  }
  if (accepted.length === 0) return null;
  const renders: PatternRender[] = accepted.map((signal) => ({
    signal,
    bullish: signal.type === "double_bottom" || signal.type === "inverse_head_shoulders",
  }));

  return definePrimitive<{ renders: PatternRender[] }>({
    name: "showcase-price-patterns",
    pane: "main",
    zOrder: "above",
    defaultState: { renders },
    render({ ctx, pane, timeScale, priceScale }, state) {
      ctx.save();
      clipToPane(ctx, pane);
      const start = timeScale.startIndex;
      const end = timeScale.endIndex;

      for (const { signal, bullish } of state.renders) {
        const kps = signal.pattern.keyPoints;
        if (kps.length === 0) continue;
        if (kps[kps.length - 1].index < start || kps[0].index >= end) continue;

        const color = bullish ? BULL : BEAR;
        const rgb = bullish ? BULL_RGB : BEAR_RGB;

        // Filter keyPoints that are actual price extremes (skip neckline
        // intersection points which sit on the neckline, not on the swing).
        const extremes = kps.filter(
          (k) => k.label !== "Neckline Start" && k.label !== "Neckline End",
        );

        // Body shading (light fill under the zigzag, between min and max y)
        const xs = extremes.map((k) => timeScale.indexToX(k.index));
        const ys = extremes.map((k) => priceScale.priceToY(k.price));
        const necklineY = signal.pattern.neckline
          ? priceScale.priceToY(signal.pattern.neckline.currentPrice)
          : null;

        if (necklineY !== null && xs.length >= 2) {
          ctx.fillStyle = `rgba(${rgb},0.08)`;
          ctx.beginPath();
          ctx.moveTo(xs[0], necklineY);
          for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
          ctx.lineTo(xs[xs.length - 1], necklineY);
          ctx.closePath();
          ctx.fill();
        }

        // Zigzag connector through the price extremes
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < xs.length; i++) {
          if (i === 0) ctx.moveTo(xs[i], ys[i]);
          else ctx.lineTo(xs[i], ys[i]);
        }
        ctx.stroke();

        // Neckline (dashed, horizontal-ish)
        if (signal.pattern.neckline && xs.length >= 2) {
          const nl = signal.pattern.neckline;
          const x1 = xs[0];
          const x2 = xs[xs.length - 1];
          // Approximate slope using start/end of neckline if available
          const yNeckLeft = priceScale.priceToY(nl.startPrice);
          const yNeckRight = priceScale.priceToY(nl.endPrice);
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = `rgba(${rgb},0.85)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, yNeckLeft);
          ctx.lineTo(x2, yNeckRight);
          ctx.stroke();
          ctx.restore();
        }

        // Anchor labels at each notable extreme. Resolve horizontal collisions
        // by stacking labels vertically when their x-positions are too close.
        const labels: { x: number; y: number; text: string }[] = [];
        for (const k of extremes) {
          const mapped = ANCHOR_LABEL_MAP[k.label];
          if (!mapped) continue;
          labels.push({
            x: timeScale.indexToX(k.index),
            y: priceScale.priceToY(k.price),
            text: mapped,
          });
        }
        const placement = bullish ? "below" : "above";
        const stackDir = bullish ? 1 : -1;
        const STACK_GAP = 22;
        const MIN_X_SEP = 60;
        for (let i = 0; i < labels.length; i++) {
          let stackLevel = 0;
          for (let j = 0; j < i; j++) {
            if (Math.abs(labels[i].x - labels[j].x) < MIN_X_SEP) stackLevel++;
          }
          drawAnchoredLabel(
            ctx,
            labels[i].x,
            labels[i].y + stackLevel * STACK_GAP * stackDir,
            labels[i].text,
            `rgba(${rgb},0.92)`,
            placement,
          );
        }

        // Measured-move target — dashed projector + Target pill
        if (signal.pattern.target != null && xs.length >= 1) {
          const lastX = xs[xs.length - 1];
          const targetY = priceScale.priceToY(signal.pattern.target);
          const lastY = ys[ys.length - 1];
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = `rgba(${rgb},0.9)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(lastX, targetY);
          ctx.stroke();
          ctx.restore();
          drawAnchoredLabel(
            ctx,
            lastX,
            targetY,
            "Target",
            `rgba(${rgb},0.92)`,
            bullish ? "above" : "below",
          );
        }
      }
      ctx.restore();
    },
  });
}

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
    description: "Mirrored dashed connectors on price pane + RSI(14) sub-pane (enable RSI to see)",
    connect: (candles) => connectRsiDivergence(candles),
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
      const plugin = makePricePatternsPlugin(candles);
      if (!plugin) return null;
      chartRef.registerPrimitive(plugin);
      return { remove: () => chartRef.removePrimitive(plugin.name) };
    },
  },
];

let chartRef: ChartInstance = null as unknown as ChartInstance;

export function createSignalsPanel(
  container: HTMLElement,
  candles: NormalizedCandle[],
  chart: ChartInstance,
): SignalsPanelHandle {
  chartRef = chart;
  const active = new Map<string, PluginHandle>();
  const panelRoot = document.createElement("div");
  panelRoot.dataset.role = "signals-panel";
  container.appendChild(panelRoot);

  const header = document.createElement("div");
  header.style.cssText =
    "padding:10px 12px;background:#181c27;border-top:1px solid #2a2e39;border-bottom:1px solid #1e222d;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;";
  header.textContent = "\u25BC Signals";
  panelRoot.appendChild(header);

  for (const spec of SPECS) {
    const row = document.createElement("div");
    row.style.cssText =
      "padding:8px 12px 8px 24px;cursor:pointer;border-bottom:1px solid #1e222d;display:flex;align-items:flex-start;gap:10px;user-select:none;";

    const checkbox = document.createElement("div");
    checkbox.style.cssText =
      "width:14px;height:14px;border:1px solid #4a4e59;border-radius:3px;margin-top:2px;flex-shrink:0;";

    const text = document.createElement("div");
    text.style.cssText = "flex:1;min-width:0;";
    const title = document.createElement("div");
    title.textContent = spec.label;
    title.style.cssText = "font-weight:500;";
    const desc = document.createElement("div");
    desc.textContent = spec.description;
    desc.style.cssText = "font-size:11px;color:#787b86;margin-top:2px;";
    text.appendChild(title);
    text.appendChild(desc);

    row.appendChild(checkbox);
    row.appendChild(text);
    panelRoot.appendChild(row);

    const applyActive = (isActive: boolean) => {
      if (isActive) {
        checkbox.style.background = "#2196F3";
        checkbox.style.borderColor = "#2196F3";
        row.style.background = "#1e2530";
      } else {
        checkbox.style.background = "transparent";
        checkbox.style.borderColor = "#4a4e59";
        row.style.background = "transparent";
      }
    };

    const flashEmpty = () => {
      const original = desc.textContent;
      const originalColor = desc.style.color;
      desc.textContent = "No events detected on the current dataset";
      desc.style.color = "#ef5350";
      setTimeout(() => {
        desc.textContent = original;
        desc.style.color = originalColor;
      }, 1800);
    };

    row.addEventListener("click", () => {
      const existing = active.get(spec.id);
      if (existing) {
        existing.remove();
        active.delete(spec.id);
        applyActive(false);
      } else {
        const handle = spec.connect(candles);
        if (!handle) {
          console.warn(`Signal ${spec.id} produced no events for the current dataset`);
          flashEmpty();
          return;
        }
        active.set(spec.id, handle);
        applyActive(true);
      }
    });
  }

  return {
    destroy() {
      for (const h of active.values()) h.remove();
      active.clear();
      panelRoot.remove();
    },
  };
}
