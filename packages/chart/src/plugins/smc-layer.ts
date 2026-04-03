/**
 * SMC (Smart Money Concepts) Visual Layer Plugin.
 *
 * Renders Order Blocks, Fair Value Gaps, Liquidity Sweeps, and
 * Break of Structure as a single composite PrimitivePlugin.
 *
 * @example
 * ```typescript
 * import { createChart, connectSmcLayer } from '@trendcraft/chart';
 * import { orderBlock, fairValueGap, liquiditySweep, breakOfStructure } from 'trendcraft';
 *
 * const chart = createChart(el);
 * chart.setCandles(candles);
 * const handle = connectSmcLayer(chart, {
 *   orderBlocks: orderBlock(candles),
 *   fvgs: fairValueGap(candles),
 *   sweeps: liquiditySweep(candles),
 *   bos: breakOfStructure(candles),
 * });
 * // Later: handle.remove();
 * ```
 */

import { definePrimitive } from "../core/plugin-types";
import type { PrimitivePlugin, PrimitiveRenderContext } from "../core/plugin-types";
import type { ChartInstance, DataPoint } from "../core/types";
import { buildSmcState } from "./smc-adapter";

// ---- Public types ----

export type SmcZone = {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  startIndex: number;
  /** null = extends to current visible end */
  endIndex: number | null;
  /** 0-100, affects alpha intensity */
  strength: number;
  mitigated: boolean;
};

export type SmcMarker = {
  type: "bullish" | "bearish";
  index: number;
  price: number;
  label: string;
};

export type SmcLevel = {
  type: "bullish" | "bearish";
  price: number;
  startIndex: number;
  /** null = extends to current visible end */
  endIndex: number | null;
  label: string;
};

export type SmcState = {
  orderBlocks: SmcZone[];
  fvgZones: SmcZone[];
  sweepMarkers: SmcMarker[];
  bosLevels: SmcLevel[];
};

// ---- Colors ----

const BULLISH_RGB = "38,166,154";
const BEARISH_RGB = "239,83,80";
const BOS_BULLISH_RGB = "38,166,154";
const BOS_BEARISH_RGB = "239,83,80";
const FVG_BULLISH_RGB = "33,150,243";
const FVG_BEARISH_RGB = "255,152,0";
const SWEEP_BULLISH_RGB = "38,166,154";
const SWEEP_BEARISH_RGB = "239,83,80";

// ---- Render helpers ----

function renderOrderBlocks(
  ctx: CanvasRenderingContext2D,
  zones: readonly SmcZone[],
  timeScale: PrimitiveRenderContext["timeScale"],
  priceScale: PrimitiveRenderContext["priceScale"],
): void {
  for (const zone of zones) {
    const startX = timeScale.indexToX(zone.startIndex);
    const endX =
      zone.endIndex !== null
        ? timeScale.indexToX(zone.endIndex)
        : timeScale.indexToX(timeScale.endIndex);
    const topY = priceScale.priceToY(zone.high);
    const bottomY = priceScale.priceToY(zone.low);
    const w = endX - startX;
    const h = bottomY - topY;

    if (w <= 0 || h <= 0) continue;

    const rgb = zone.type === "bullish" ? BULLISH_RGB : BEARISH_RGB;
    const alpha = zone.mitigated ? 0.05 : 0.08 + (zone.strength / 100) * 0.1;

    // Fill
    ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.fillRect(startX, topY, w, h);

    // Border
    ctx.strokeStyle = `rgba(${rgb},${zone.mitigated ? 0.15 : 0.4})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, topY, w, h);
  }
}

function renderFvgZones(
  ctx: CanvasRenderingContext2D,
  zones: readonly SmcZone[],
  timeScale: PrimitiveRenderContext["timeScale"],
  priceScale: PrimitiveRenderContext["priceScale"],
): void {
  for (const zone of zones) {
    const startX = timeScale.indexToX(zone.startIndex);
    const endX =
      zone.endIndex !== null
        ? timeScale.indexToX(zone.endIndex)
        : timeScale.indexToX(timeScale.endIndex);
    const topY = priceScale.priceToY(zone.high);
    const bottomY = priceScale.priceToY(zone.low);
    const w = endX - startX;
    const h = bottomY - topY;

    if (w <= 0 || h <= 0) continue;

    const rgb = zone.type === "bullish" ? FVG_BULLISH_RGB : FVG_BEARISH_RGB;
    const alpha = zone.mitigated ? 0.04 : 0.1;

    // Fill
    ctx.fillStyle = `rgba(${rgb},${alpha})`;
    ctx.fillRect(startX, topY, w, h);

    // Dashed border
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = `rgba(${rgb},${zone.mitigated ? 0.15 : 0.35})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, topY, w, h);
    ctx.restore();
  }
}

function renderSweepMarkers(
  ctx: CanvasRenderingContext2D,
  markers: readonly SmcMarker[],
  timeScale: PrimitiveRenderContext["timeScale"],
  priceScale: PrimitiveRenderContext["priceScale"],
): void {
  const size = 5;

  for (const marker of markers) {
    const x = timeScale.indexToX(marker.index);
    const y = priceScale.priceToY(marker.price);
    const rgb = marker.type === "bullish" ? SWEEP_BULLISH_RGB : SWEEP_BEARISH_RGB;

    // Triangle marker
    ctx.fillStyle = `rgba(${rgb},0.8)`;
    ctx.beginPath();
    if (marker.type === "bullish") {
      // Up triangle (swept low → bullish signal)
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
    } else {
      // Down triangle (swept high → bearish signal)
      ctx.moveTo(x, y + size);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x + size, y - size);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function renderBosLevels(
  ctx: CanvasRenderingContext2D,
  levels: readonly SmcLevel[],
  timeScale: PrimitiveRenderContext["timeScale"],
  priceScale: PrimitiveRenderContext["priceScale"],
  theme: PrimitiveRenderContext["theme"],
): void {
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;

  for (const level of levels) {
    const startX = timeScale.indexToX(level.startIndex);
    const endX =
      level.endIndex !== null
        ? timeScale.indexToX(level.endIndex)
        : timeScale.indexToX(Math.min(level.startIndex + 50, timeScale.endIndex));
    const y = priceScale.priceToY(level.price);
    const rgb = level.type === "bullish" ? BOS_BULLISH_RGB : BOS_BEARISH_RGB;

    // Dashed line
    ctx.strokeStyle = `rgba(${rgb},0.6)`;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    // Label
    ctx.fillStyle = `rgba(${rgb},0.8)`;
    ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(level.label, startX + 3, y - 2);
  }

  ctx.restore();
}

// ---- Main render ----

function renderSmcLayer(context: PrimitiveRenderContext, state: SmcState): void {
  const { ctx, pane, timeScale, priceScale, theme } = context;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.width, pane.height);
  ctx.clip();

  // Order blocks (lowest visual priority)
  if (state.orderBlocks.length > 0) {
    renderOrderBlocks(ctx, state.orderBlocks, timeScale, priceScale);
  }

  // FVG zones
  if (state.fvgZones.length > 0) {
    renderFvgZones(ctx, state.fvgZones, timeScale, priceScale);
  }

  // BOS levels
  if (state.bosLevels.length > 0) {
    renderBosLevels(ctx, state.bosLevels, timeScale, priceScale, theme);
  }

  // Sweep markers (highest visual priority)
  if (state.sweepMarkers.length > 0) {
    renderSweepMarkers(ctx, state.sweepMarkers, timeScale, priceScale);
  }

  ctx.restore();
}

// ---- Factory ----

/**
 * Create a PrimitivePlugin that renders SMC visual layer.
 *
 * @param state - Pre-built SmcState (use buildSmcState from smc-adapter)
 * @returns PrimitivePlugin to register via chart.registerPrimitive()
 */
export function createSmcLayer(state: SmcState): PrimitivePlugin<SmcState> {
  return definePrimitive<SmcState>({
    name: "smcLayer",
    pane: "main",
    zOrder: "below",
    defaultState: state,
    render: renderSmcLayer,
  });
}

// ---- Convenience connector ----

type SmcLayerSources = {
  orderBlocks?: readonly DataPoint<unknown>[];
  fvgs?: readonly DataPoint<unknown>[];
  sweeps?: readonly DataPoint<unknown>[];
  bos?: readonly DataPoint<unknown>[];
};

type SmcLayerHandle = {
  /** Update with new indicator data */
  update(sources: SmcLayerSources): void;
  /** Remove the SMC layer from the chart */
  remove(): void;
};

/**
 * Connect SMC visual layer to a chart instance.
 * Accepts raw indicator outputs and handles conversion internally.
 *
 * @param chart - ChartInstance to attach to
 * @param sources - Raw indicator Series data
 * @returns Handle for updating or removing the layer
 */
export function connectSmcLayer(chart: ChartInstance, sources: SmcLayerSources): SmcLayerHandle {
  const state = buildSmcState(sources);
  chart.registerPrimitive(createSmcLayer(state));

  return {
    update(newSources: SmcLayerSources) {
      const newState = buildSmcState(newSources);
      chart.registerPrimitive(createSmcLayer(newState));
    },
    remove() {
      chart.removePrimitive("smcLayer");
    },
  };
}
