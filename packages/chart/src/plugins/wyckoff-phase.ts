/**
 * Wyckoff Phase Plugin — Visualizes Wyckoff method analysis using the
 * conventions that `Wyckoff` traders expect:
 *
 *  1. A colored **range box** over each accumulation / distribution trading
 *     range (green for accumulation, red for distribution)
 *  2. **Event labels** (PS, SC, AR, ST, Spring, SOS, LPS / PSY, BC, UT,
 *     UTAD, SOW, LPSY) anchored at the bar where each event was detected
 *  3. An optional **corner badge** showing the current phase + confidence
 *  4. An optional **bottom timeline bar** for at-a-glance scanning of long
 *     histories (phase color per bar)
 *  5. Optional **VSA event markers** (small dots above the timeline bar)
 *     when VSA data is supplied
 *
 * @example
 * ```typescript
 * import { createChart, connectWyckoffPhase } from '@trendcraft/chart';
 * import { wyckoffPhases, vsa } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const handle = connectWyckoffPhase(chart, {
 *   phases: wyckoffPhases(candles),
 *   candles,           // optional, improves event-label placement
 *   vsa: vsa(candles), // optional, enables VSA dots
 * });
 * ```
 */

import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance, DataPoint } from "../core/types";

// ---- Types (duck-typed) ----

type WyckoffEventName =
  | "PS"
  | "SC"
  | "AR"
  | "ST"
  | "spring"
  | "test"
  | "SOS"
  | "LPS"
  | "BU"
  | "PSY"
  | "BC"
  | "SOW"
  | "LPSY"
  | "UT"
  | "UTAD";

type WyckoffDataPoint = DataPoint<{
  phase: string;
  confidence?: number;
  event?: WyckoffEventName | string | null;
  rangeHigh?: number | null;
  rangeLow?: number | null;
  subPhase?: string | null;
}>;

type VsaDataPoint = DataPoint<{
  barType: string;
  isEffortDivergence?: boolean;
}>;

type CandleLike = { time: number; high: number; low: number };

type WyckoffPhaseOptions = {
  /** Draw the colored range box over accumulation / distribution ranges. Default true. */
  showRangeBox?: boolean;
  /** Draw PS/SC/AR/... text labels at the bar where each event fired. Default true. */
  showEventLabels?: boolean;
  /** Show a corner badge with the current phase. Default true. */
  showPhaseBadge?: boolean;
  /** Show the thin timeline bar at the pane bottom. Default true (useful for scanning). */
  showTimelineBar?: boolean;
};

type WyckoffPhaseState = {
  phases: readonly WyckoffDataPoint[];
  vsa: readonly VsaDataPoint[];
  candles: readonly CandleLike[];
  options: Required<WyckoffPhaseOptions>;
};

// ---- Colors ----

const PHASE_COLORS: Record<string, string> = {
  accumulation: "38,166,154",
  markup: "33,150,243",
  distribution: "239,83,80",
  markdown: "255,152,0",
  unknown: "120,123,134",
};

const PHASE_LABELS: Record<string, string> = {
  accumulation: "Accumulation",
  markup: "Markup",
  distribution: "Distribution",
  markdown: "Markdown",
  unknown: "Unknown",
};

const VSA_MARKER_COLORS: Record<string, string> = {
  spring: "38,166,154",
  test: "38,166,154",
  upthrust: "239,83,80",
  climacticAction: "255,152,0",
  stoppingVolume: "33,150,243",
  absorption: "156,39,176",
  noSupply: "76,175,80",
  noDemand: "244,67,54",
};

/** Event label placement: whether the text goes above the high or below the low of its bar. */
const EVENT_PLACEMENT: Record<string, "above" | "below"> = {
  // Accumulation
  PS: "below",
  SC: "below",
  AR: "above",
  ST: "below",
  spring: "below",
  test: "below",
  SOS: "above",
  LPS: "below",
  BU: "above",
  // Distribution
  PSY: "above",
  BC: "above",
  SOW: "below",
  LPSY: "above",
  UT: "above",
  UTAD: "above",
};

const DEFAULT_OPTIONS: Required<WyckoffPhaseOptions> = {
  showRangeBox: true,
  showEventLabels: true,
  showPhaseBadge: true,
  showTimelineBar: true,
};

const PHASE_BAR_HEIGHT = 6;

// ---- Span aggregation ----

type PhaseSpan = {
  phase: string;
  startIndex: number;
  endIndex: number;
  rangeHigh: number;
  rangeLow: number;
};

/** Collapse consecutive bars sharing the same phase + range into single spans. */
function collectPhaseSpans(phases: readonly WyckoffDataPoint[]): PhaseSpan[] {
  const spans: PhaseSpan[] = [];
  let current: PhaseSpan | null = null;

  for (let i = 0; i < phases.length; i++) {
    const v = phases[i]?.value;
    if (!v) continue;
    const { phase, rangeHigh, rangeLow } = v;

    const valid =
      (phase === "accumulation" || phase === "distribution") &&
      rangeHigh != null &&
      rangeLow != null &&
      rangeHigh > rangeLow;

    if (!valid) {
      if (current) {
        spans.push(current);
        current = null;
      }
      continue;
    }

    // At this point `rangeHigh` and `rangeLow` are guaranteed non-null by the
    // `valid` guard above.
    const high = rangeHigh as number;
    const low = rangeLow as number;

    if (!current || current.phase !== phase) {
      if (current) spans.push(current);
      current = { phase, startIndex: i, endIndex: i, rangeHigh: high, rangeLow: low };
    } else {
      current.endIndex = i;
      // Track the widest range observed across the span.
      current.rangeHigh = Math.max(current.rangeHigh, high);
      current.rangeLow = Math.min(current.rangeLow, low);
    }
  }
  if (current) spans.push(current);
  return spans;
}

// ---- Render ----

function renderWyckoffPhase(
  { ctx, pane, timeScale, priceScale }: PrimitiveRenderContext,
  state: WyckoffPhaseState,
): void {
  const { phases, vsa, candles, options } = state;
  if (phases.length === 0) return;

  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const barWidth = Math.max(1, timeScale.barSpacing);
  const last = phases[phases.length - 1]?.value;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();

  // ----- 1. Range boxes -----
  if (options.showRangeBox) {
    const spans = collectPhaseSpans(phases);
    for (const span of spans) {
      if (span.endIndex < start || span.startIndex >= end) continue;
      const rgb = PHASE_COLORS[span.phase] ?? PHASE_COLORS.unknown;
      const x1 = timeScale.indexToX(span.startIndex);
      const x2 = timeScale.indexToX(span.endIndex);
      const y1 = priceScale.priceToY(span.rangeHigh);
      const y2 = priceScale.priceToY(span.rangeLow);
      const w = x2 - x1;
      const h = y2 - y1;
      if (w <= 0 || h <= 0) continue;

      ctx.fillStyle = `rgba(${rgb},0.08)`;
      ctx.fillRect(x1, y1, w, h);

      ctx.strokeStyle = `rgba(${rgb},0.55)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1, y1, w, h);
      ctx.setLineDash([]);
    }
  }

  // ----- 2. Event labels -----
  if (options.showEventLabels) {
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    for (let i = start; i < end && i < phases.length; i++) {
      const point = phases[i];
      const event = point?.value?.event;
      if (!event) continue;

      const placement = EVENT_PLACEMENT[event] ?? "above";
      const x = timeScale.indexToX(i);

      // Prefer candle high/low for precise placement; fall back to the
      // phase's range boundaries when candles weren't provided.
      const candle = candles[i];
      const rangeHigh = point.value?.rangeHigh ?? null;
      const rangeLow = point.value?.rangeLow ?? null;
      const anchorPrice =
        placement === "above"
          ? (candle?.high ?? rangeHigh ?? rangeLow)
          : (candle?.low ?? rangeLow ?? rangeHigh);
      if (anchorPrice == null) continue;

      const anchorY = priceScale.priceToY(anchorPrice);
      const y = placement === "above" ? anchorY - 4 : anchorY + 12;

      const phaseKey =
        point.value?.phase && PHASE_COLORS[point.value.phase] ? point.value.phase : "unknown";
      const rgb = PHASE_COLORS[phaseKey];

      // Small dot at the anchor price
      ctx.fillStyle = `rgba(${rgb},0.9)`;
      ctx.beginPath();
      ctx.arc(x, anchorY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Text label
      ctx.fillStyle = `rgba(${rgb},0.95)`;
      ctx.textBaseline = placement === "above" ? "bottom" : "top";
      ctx.fillText(event, x, y);
    }
  }

  // ----- 3. Bottom timeline bar -----
  if (options.showTimelineBar) {
    const barY = pane.y + pane.height - PHASE_BAR_HEIGHT;
    for (let i = start; i < end && i < phases.length; i++) {
      const point = phases[i];
      if (!point?.value) continue;
      const { phase, confidence } = point.value;
      const rgb = PHASE_COLORS[phase] ?? PHASE_COLORS.unknown;
      const alpha = 0.4 + ((confidence ?? 50) / 100) * 0.5;
      const x = timeScale.indexToX(i);
      ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
      ctx.fillRect(x - barWidth / 2, barY, barWidth, PHASE_BAR_HEIGHT);
    }

    // VSA event dots just above the timeline bar
    if (vsa.length > 0) {
      const markerY = barY - 4;
      for (let i = start; i < end && i < vsa.length; i++) {
        const point = vsa[i];
        if (!point?.value) continue;
        const { barType } = point.value;
        if (barType === "normal") continue;
        const rgb = VSA_MARKER_COLORS[barType];
        if (!rgb) continue;
        const x = timeScale.indexToX(i);
        ctx.fillStyle = `rgba(${rgb},0.8)`;
        ctx.beginPath();
        ctx.arc(x, markerY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ----- 4. Corner badge (top-left) -----
  if (options.showPhaseBadge && last) {
    const label = PHASE_LABELS[last.phase] ?? last.phase;
    const conf = last.confidence ?? 0;
    const subPhase = last.subPhase ? ` · ${last.subPhase}` : "";
    const text = `Wyckoff: ${label} (${conf.toFixed(0)})${subPhase}`;
    const rgb = PHASE_COLORS[last.phase] ?? PHASE_COLORS.unknown;

    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const textWidth = ctx.measureText(text).width;
    const padX = 8;
    const padY = 4;
    const boxW = textWidth + padX * 2;
    const boxH = 18;
    const boxX = pane.x + 8;
    const boxY = pane.y + 8;

    ctx.fillStyle = "rgba(22,26,37,0.85)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = `rgba(${rgb},0.7)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = `rgba(${rgb},0.95)`;
    ctx.fillText(text, boxX + padX, boxY + padY);
  }

  ctx.restore();
}

// ---- Factory ----

function resolveOptions(options: WyckoffPhaseOptions = {}): Required<WyckoffPhaseOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

export function createWyckoffPhase(
  phases: readonly WyckoffDataPoint[],
  vsa: readonly VsaDataPoint[] = [],
  candles: readonly CandleLike[] = [],
  options: WyckoffPhaseOptions = {},
): PrimitivePlugin<WyckoffPhaseState> {
  return definePrimitive<WyckoffPhaseState>({
    name: "wyckoffPhase",
    pane: "main",
    zOrder: "above",
    defaultState: { phases, vsa, candles, options: resolveOptions(options) },
    render: renderWyckoffPhase,
  });
}

// ---- Convenience connector ----

type WyckoffPhaseHandle = {
  update(sources: {
    phases: readonly WyckoffDataPoint[];
    vsa?: readonly VsaDataPoint[];
    candles?: readonly CandleLike[];
    options?: WyckoffPhaseOptions;
  }): void;
  remove(): void;
};

export function connectWyckoffPhase(
  chart: ChartInstance,
  sources: {
    phases: readonly WyckoffDataPoint[];
    vsa?: readonly VsaDataPoint[];
    candles?: readonly CandleLike[];
    options?: WyckoffPhaseOptions;
  },
): WyckoffPhaseHandle {
  chart.registerPrimitive(
    createWyckoffPhase(sources.phases, sources.vsa ?? [], sources.candles ?? [], sources.options),
  );

  return {
    update(newSources) {
      chart.registerPrimitive(
        createWyckoffPhase(
          newSources.phases,
          newSources.vsa ?? [],
          newSources.candles ?? [],
          newSources.options,
        ),
      );
    },
    remove() {
      chart.removePrimitive("wyckoffPhase");
    },
  };
}
