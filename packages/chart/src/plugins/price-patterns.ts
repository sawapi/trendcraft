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

import { roundRectPath, withPaneClip } from "../core/draw-helper";
import { canvasFont } from "../core/font";
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
  /** Hex color for direction-neutral patterns (default: `"#9ca3af"`,
   *  slate grey). Used for `triangle_symmetrical`, `channel_horizontal`
   *  and any type missing from both `bullishTypes` and `bearishTypes`. */
  neutralColor?: string;
  /**
   * Comma-separated `r,g,b` triplet for bullish fills/translucent strokes.
   * Defaults to the rgb decomposition of `bullColor` when only the hex
   * form is supplied for the standard teal `#26a69a`.
   */
  bullColorRgb?: string;
  bearColorRgb?: string;
  neutralColorRgb?: string;
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
  /** Pattern types treated as bullish for coloring + label placement.
   *  Defaults cover every bullish variant in `trendcraft`'s `PatternType`
   *  union (double_bottom, inverse_head_shoulders, cup_handle, ...). */
  bullishTypes?: string[];
  /** Pattern types treated as bearish. Defaults cover every bearish
   *  variant in `trendcraft`'s `PatternType` union. Anything outside both
   *  lists is treated as neutral so detectors like `triangle_symmetrical`
   *  don't get rendered with the wrong-direction palette. */
  bearishTypes?: string[];
};

// ---- Defaults ----

const DEFAULT_BULL = "#26a69a";
const DEFAULT_BEAR = "#ef5350";
const DEFAULT_NEUTRAL = "#9ca3af";
const DEFAULT_BULL_RGB = "38,166,154";
const DEFAULT_BEAR_RGB = "239,83,80";
const DEFAULT_NEUTRAL_RGB = "156,163,175";
/**
 * Pattern `type` strings that the chart treats as bullish (teal palette,
 * labels below the swing). Includes only types whose breakout direction
 * is established by classical TA convention before the move resolves —
 * e.g. `falling_wedge` (Bulkowski: ~70% break up despite the downward
 * slope), reversal patterns at troughs, and explicitly bullish harmonics.
 * `channel_ascending` is intentionally absent: the slope describes the
 * envelope, not the resolution; without a breakout direction the
 * channel itself is direction-neutral.
 */
const DEFAULT_BULLISH_TYPES = [
  "double_bottom",
  "inverse_head_shoulders",
  "cup_handle",
  "triangle_ascending",
  "falling_wedge",
  "bull_flag",
  "bull_pennant",
  "gartley_bullish",
  "butterfly_bullish",
  "bat_bullish",
  "crab_bullish",
  "shark_bullish",
];
/** Pattern `type` strings the chart treats as bearish. Same convention as
 *  `DEFAULT_BULLISH_TYPES` — reversals, classical bias-bearing patterns
 *  (`rising_wedge` per Bulkowski breaks down ~65% of the time), and
 *  explicit bearish harmonics. Channels and direction-neutral triangles
 *  are deliberately absent so they fall through to the neutral palette
 *  instead of getting a colored bias before the breakout resolves. */
const DEFAULT_BEARISH_TYPES = [
  "double_top",
  "head_shoulders",
  "triangle_descending",
  "rising_wedge",
  "bear_flag",
  "bear_pennant",
  "gartley_bearish",
  "butterfly_bearish",
  "bat_bearish",
  "crab_bearish",
  "shark_bearish",
];

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
 * Dedup + confidence-filter raw detector output the same way
 * `connectPricePatterns` does internally. Exposed so callers can decide
 * whether the panel has anything worth showing *before* registering the
 * primitive — useful for "if no patterns, leave the toggle off" UX.
 */
export function filterPricePatterns(
  signals: PricePatternSignal[],
  options: Pick<PricePatternsOptions, "minConfidence" | "maxPatterns"> = {},
): PricePatternSignal[] {
  const minConfidence = options.minConfidence ?? 60;
  const maxPatterns = options.maxPatterns ?? 8;
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
  fontFamily: string,
): void {
  ctx.font = canvasFont(11, fontFamily);
  const padX = 6;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 18;
  const gap = 12;
  const labelY = placement === "above" ? anchorY - gap - h : anchorY + gap;
  const labelX = anchorX - w / 2;
  const r = 3;

  ctx.fillStyle = bg;
  roundRectPath(ctx, labelX, labelY, w, h, r);
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
  const neutral = options.neutralColor ?? DEFAULT_NEUTRAL;
  const bullRgb =
    options.bullColorRgb ?? (bull === DEFAULT_BULL ? DEFAULT_BULL_RGB : hexToRgb(bull));
  const bearRgb =
    options.bearColorRgb ?? (bear === DEFAULT_BEAR ? DEFAULT_BEAR_RGB : hexToRgb(bear));
  const neutralRgb =
    options.neutralColorRgb ??
    (neutral === DEFAULT_NEUTRAL ? DEFAULT_NEUTRAL_RGB : hexToRgb(neutral));
  const bodyAlpha = options.bodyAlpha ?? 0.08;
  const necklineDash = options.necklineDash ?? [5, 4];
  const targetDash = options.targetDash ?? [3, 3];
  const minConfidence = options.minConfidence ?? 60;
  const maxPatterns = options.maxPatterns ?? 8;
  const anchorLabels = { ...DEFAULT_ANCHOR_LABELS, ...(options.anchorLabels ?? {}) };
  const bullishTypes = new Set(options.bullishTypes ?? DEFAULT_BULLISH_TYPES);
  const bearishTypes = new Set(options.bearishTypes ?? DEFAULT_BEARISH_TYPES);

  const accepted = filterPricePatterns(signals, { minConfidence, maxPatterns });
  const renders = accepted.map((signal) => {
    const direction: "bull" | "bear" | "neutral" = bullishTypes.has(signal.type)
      ? "bull"
      : bearishTypes.has(signal.type)
        ? "bear"
        : "neutral";
    return { signal, direction };
  });

  return definePrimitive<{ renders: typeof renders }>({
    name: "trendcraft-price-patterns",
    pane: "main",
    zOrder: "above",
    defaultState: { renders },
    render({ ctx, pane, timeScale, priceScale, fontFamily }, state) {
      withPaneClip(ctx, pane, () => {
        const start = timeScale.startIndex;
        const end = timeScale.endIndex;

        for (const { signal, direction } of state.renders) {
          const kps = signal.pattern.keyPoints;
          if (kps.length === 0) continue;
          if (kps[kps.length - 1].index < start || kps[0].index >= end) continue;

          const color = direction === "bull" ? bull : direction === "bear" ? bear : neutral;
          const rgb = direction === "bull" ? bullRgb : direction === "bear" ? bearRgb : neutralRgb;

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
          // Anchors below the swing for bullish (looks up to the move),
          // above for bearish, above for neutral (no implied direction so
          // the conventional "label at peak" is visually neutral).
          const placement = direction === "bull" ? "below" : "above";
          const stackDir = direction === "bull" ? 1 : -1;
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
              fontFamily,
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
              direction === "bull" ? "above" : "below",
              fontFamily,
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
