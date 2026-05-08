/**
 * Price Patterns Plugin — Visualizes chart-pattern signals (Double Top /
 * Bottom, Head and Shoulders + inverse, etc.) using the standard zigzag +
 * neckline + measured-move idiom: a zigzag line through the swing extremes,
 * a dashed neckline, light body shading, anchored labels at each extreme,
 * and a dashed projector to the measured-move target.
 *
 * Hosts compute pattern signals via `trendcraft`'s detectors (`doubleTop`,
 * `doubleBottom`, `headAndShoulders`, `inverseHeadAndShoulders`, etc.) and
 * pass them to this plugin verbatim.
 *
 * @example
 * ```typescript
 * import { createChart, connectPricePatterns } from '@trendcraft/chart';
 * import { doubleBottom, doubleTop } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const signals = [...doubleBottom(candles), ...doubleTop(candles)];
 * const handle = connectPricePatterns(chart, signals);
 * // Later: handle.remove();
 * ```
 */

import { withPaneClip } from "../core/draw-helper";
import { definePrimitive } from "../core/plugin-types";
import type { ChartInstance } from "../core/types";

// ---- Types (duck-typed; no core dependency) ----

type PatternKeyPoint = {
  index: number;
  price: number;
  label: string;
};

type PatternNeckline = {
  startPrice: number;
  endPrice: number;
  currentPrice: number;
};

/**
 * The subset of `trendcraft`'s `PatternSignal` this plugin needs. Compatible
 * with the full `PatternSignal` shape so callers can pass detector results
 * verbatim.
 */
export type PricePatternSignal = {
  /** Detector key — `"double_top"`, `"double_bottom"`,
   *  `"head_shoulders"`, `"inverse_head_shoulders"`, etc. The plugin only
   *  uses this to decide bull vs bear coloring. */
  type: string;
  pattern: {
    startTime: number;
    endTime: number;
    keyPoints: PatternKeyPoint[];
    neckline?: PatternNeckline;
    target?: number;
  };
  /** 0–100 confidence. Used for filtering and dedup ordering. */
  confidence: number;
};

export type PricePatternsOptions = {
  /** Hex color for bullish patterns (default: `"#26a69a"`) */
  bullColor?: string;
  /** Hex color for bearish patterns (default: `"#ef5350"`) */
  bearColor?: string;
  /**
   * Comma-separated `r,g,b` triplet for bullish fills/translucent strokes.
   * Defaults to the rgb decomposition of `bullColor` when only the hex
   * form is supplied for the standard teal `#26a69a`.
   */
  bullColorRgb?: string;
  bearColorRgb?: string;
  /** Body fill alpha for the area between the zigzag and the neckline. */
  bodyAlpha?: number;
  /** Dash pattern for the neckline. Default `[5, 4]`. */
  necklineDash?: [number, number];
  /** Dash pattern for the measured-move projector. Default `[3, 3]`. */
  targetDash?: [number, number];
  /** Minimum confidence (0–100) for a pattern to be drawn. Default `60`. */
  minConfidence?: number;
  /** Cap on simultaneously visible patterns after dedup. Default `8`. */
  maxPatterns?: number;
  /**
   * Override the displayed text for an extreme by its `keyPoint.label`.
   * Defaults map common detector labels to compact UI strings
   * (e.g. `"First Trough"` → `"Bottom 1"`). Pass `null` for a label to
   * suppress its anchor pill entirely.
   */
  anchorLabels?: Record<string, string | null>;
  /** Pattern types treated as bullish for coloring. Default: `["double_bottom",
   *  "inverse_head_shoulders"]`. */
  bullishTypes?: string[];
};

// ---- Defaults ----

const DEFAULT_BULL = "#26a69a";
const DEFAULT_BEAR = "#ef5350";
const DEFAULT_BULL_RGB = "38,166,154";
const DEFAULT_BEAR_RGB = "239,83,80";
const DEFAULT_BULLISH_TYPES = ["double_bottom", "inverse_head_shoulders"];

const DEFAULT_ANCHOR_LABELS: Record<string, string | null> = {
  "First Trough": "Bottom 1",
  "Second Trough": "Bottom 2",
  "First Peak": "Top 1",
  "Second Peak": "Top 2",
  "Left Shoulder": "L. Shoulder",
  Head: "Head",
  "Right Shoulder": "R. Shoulder",
};

const NECKLINE_KEYPOINTS = new Set(["Neckline Start", "Neckline End"]);

// ---- Helpers ----

/**
 * Dedup overlapping detections by keeping the highest-confidence pattern in
 * each `[startTime, endTime]` envelope, then cap the survivor count.
 */
function dedupPatterns(
  signals: PricePatternSignal[],
  minConfidence: number,
  maxPatterns: number,
): PricePatternSignal[] {
  const sorted = signals
    .filter((s) => s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
  const accepted: PricePatternSignal[] = [];
  for (const sig of sorted) {
    if (accepted.length >= maxPatterns) break;
    const overlaps = accepted.some(
      (acc) =>
        sig.pattern.startTime <= acc.pattern.endTime &&
        sig.pattern.endTime >= acc.pattern.startTime,
    );
    if (!overlaps) accepted.push(sig);
  }
  return accepted;
}

/**
 * Pill-shaped label with a small triangular tail pointing back toward
 * `(anchorX, anchorY)`. The pill is offset on the opposite side of the
 * indicated `placement`; the tail visually connects label → anchor.
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

  // Tail
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

/**
 * Build the price-pattern primitive without registering it. Most hosts want
 * `connectPricePatterns` instead — `createPricePatterns` is exposed for
 * tests and advanced setups that prefer to call `chart.registerPrimitive`
 * themselves.
 */
export function createPricePatterns(
  signals: PricePatternSignal[],
  options: PricePatternsOptions = {},
) {
  const bull = options.bullColor ?? DEFAULT_BULL;
  const bear = options.bearColor ?? DEFAULT_BEAR;
  const bullRgb =
    options.bullColorRgb ?? (bull === DEFAULT_BULL ? DEFAULT_BULL_RGB : hexToRgb(bull));
  const bearRgb =
    options.bearColorRgb ?? (bear === DEFAULT_BEAR ? DEFAULT_BEAR_RGB : hexToRgb(bear));
  const bodyAlpha = options.bodyAlpha ?? 0.08;
  const necklineDash = options.necklineDash ?? [5, 4];
  const targetDash = options.targetDash ?? [3, 3];
  const minConfidence = options.minConfidence ?? 60;
  const maxPatterns = options.maxPatterns ?? 8;
  const anchorLabels = { ...DEFAULT_ANCHOR_LABELS, ...(options.anchorLabels ?? {}) };
  const bullishTypes = new Set(options.bullishTypes ?? DEFAULT_BULLISH_TYPES);

  const accepted = dedupPatterns(signals, minConfidence, maxPatterns);
  const renders = accepted.map((signal) => ({
    signal,
    bullish: bullishTypes.has(signal.type),
  }));

  return definePrimitive<{ renders: typeof renders }>({
    name: "trendcraft-price-patterns",
    pane: "main",
    zOrder: "above",
    defaultState: { renders },
    render({ ctx, pane, timeScale, priceScale }, state) {
      withPaneClip(ctx, pane, () => {
        const start = timeScale.startIndex;
        const end = timeScale.endIndex;

        for (const { signal, bullish } of state.renders) {
          const kps = signal.pattern.keyPoints;
          if (kps.length === 0) continue;
          if (kps[kps.length - 1].index < start || kps[0].index >= end) continue;

          const color = bullish ? bull : bear;
          const rgb = bullish ? bullRgb : bearRgb;

          // Filter keyPoints that are actual price extremes (skip neckline
          // intersection points which sit on the neckline, not on the swing).
          const extremes = kps.filter((k) => !NECKLINE_KEYPOINTS.has(k.label));
          if (extremes.length === 0) continue;

          const xs = extremes.map((k) => timeScale.indexToX(k.index));
          const ys = extremes.map((k) => priceScale.priceToY(k.price));
          const necklineY = signal.pattern.neckline
            ? priceScale.priceToY(signal.pattern.neckline.currentPrice)
            : null;

          // Body shading between the zigzag and the neckline reference.
          if (necklineY !== null && xs.length >= 2) {
            ctx.fillStyle = `rgba(${rgb},${bodyAlpha})`;
            ctx.beginPath();
            ctx.moveTo(xs[0], necklineY);
            for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
            ctx.lineTo(xs[xs.length - 1], necklineY);
            ctx.closePath();
            ctx.fill();
          }

          // Zigzag connector through the price extremes.
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let i = 0; i < xs.length; i++) {
            if (i === 0) ctx.moveTo(xs[i], ys[i]);
            else ctx.lineTo(xs[i], ys[i]);
          }
          ctx.stroke();

          // Neckline (dashed).
          if (signal.pattern.neckline && xs.length >= 2) {
            const nl = signal.pattern.neckline;
            ctx.save();
            ctx.setLineDash(necklineDash);
            ctx.strokeStyle = `rgba(${rgb},0.85)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(xs[0], priceScale.priceToY(nl.startPrice));
            ctx.lineTo(xs[xs.length - 1], priceScale.priceToY(nl.endPrice));
            ctx.stroke();
            ctx.restore();
          }

          // Anchor labels — stack vertically when x-positions collide.
          const labels: { x: number; y: number; text: string }[] = [];
          for (const k of extremes) {
            const mapped = anchorLabels[k.label];
            if (mapped == null) continue;
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

          // Measured-move target — dashed projector + Target pill.
          if (signal.pattern.target != null && xs.length >= 1) {
            const lastX = xs[xs.length - 1];
            const targetY = priceScale.priceToY(signal.pattern.target);
            const lastY = ys[ys.length - 1];
            ctx.save();
            ctx.setLineDash(targetDash);
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
      });
    },
  });
}

/**
 * Wire a price-pattern overlay primitive onto an existing chart instance.
 *
 * Returns a handle whose `remove()` detaches the primitive. Calling
 * `connectPricePatterns` again (with a new signal set) is the supported way
 * to update the visualization — remove the previous handle first.
 */
export function connectPricePatterns(
  chart: ChartInstance,
  signals: PricePatternSignal[],
  options: PricePatternsOptions = {},
): { remove: () => void } {
  const plugin = createPricePatterns(signals, options);
  chart.registerPrimitive(plugin);
  return {
    remove: () => chart.removePrimitive(plugin.name),
  };
}

/**
 * Naive `#rrggbb` → `r,g,b` for the rgba() string helper. Falls back to a
 * neutral grey if the input is malformed; never throws so an unrelated
 * feature can't break chart rendering.
 */
function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "128,128,128";
  const v = Number.parseInt(m[1], 16);
  return `${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff}`;
}
