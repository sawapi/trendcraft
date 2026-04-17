/**
 * Shared helpers for indicator integration (connect-indicators).
 */

import type { DataPoint, SeriesConfig } from "../core/types";
import { INDICATOR_PRESETS } from "./indicator-presets";

// ============================================
// Duck-typed interfaces (no core imports)
// ============================================

/** OHLCV candle shape (duck-typed) */
export type SourceCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Indicator metadata (duck-typed, matches SeriesMeta from core) */
export type PresetMeta = {
  overlay: boolean;
  label: string;
  yRange?: [number, number];
  referenceLines?: number[];
};

/** Factory function type (duck-typed, matches LiveIndicatorFactory from core) */
export type LiveIndicatorFactoryFn = (fromState?: unknown) => {
  next(candle: SourceCandle): { value: unknown };
  peek(candle: SourceCandle): { value: unknown };
  getState(): unknown;
  readonly count: number;
  readonly isWarmedUp: boolean;
};

// ============================================
// Helpers
// ============================================

/**
 * Resolve a snapshot value by path.
 *
 * - Simple key (`"rsi14"`) → returns the value as-is (number, object, or null)
 * - Dot-path (`"bb.upper"`) → drills into object and returns the nested scalar
 */
export function resolveValue(snapshot: Record<string, unknown>, path: string): unknown {
  const dot = path.indexOf(".");
  if (dot === -1) {
    const v = snapshot[path];
    return v ?? null;
  }
  const key = path.slice(0, dot);
  const field = path.slice(dot + 1);
  const obj = snapshot[key];
  if (obj == null || typeof obj !== "object") return null;
  const v = (obj as Record<string, unknown>)[field];
  return typeof v === "number" ? v : null;
}

/** Compute back-fill data by running a factory over candle history */
export function computeBackfill(
  createFactory: (params: Record<string, unknown>) => LiveIndicatorFactoryFn,
  params: Record<string, unknown>,
  candles: readonly SourceCandle[],
): DataPoint<unknown>[] {
  const instance = createFactory(params)();
  const points: DataPoint<unknown>[] = [];
  for (const candle of candles) {
    points.push({ time: candle.time, value: instance.next(candle).value });
  }
  return points;
}

/** Resolve the snapshot name from a preset */
export function resolveSnapshotName(
  preset: { snapshotName: string | ((params: Record<string, unknown>) => string) },
  params: Record<string, unknown>,
): string {
  return typeof preset.snapshotName === "function"
    ? preset.snapshotName(params)
    : preset.snapshotName;
}

/** Build series config from preset meta + user overrides */
export function buildSeriesConfig(
  meta: PresetMeta,
  snapshotName: string,
  params: Record<string, unknown>,
  overrides?: SeriesConfig,
  presetId?: string,
): SeriesConfig {
  const chartPreset = presetId ? INDICATOR_PRESETS.get(presetId) : undefined;
  return {
    pane: overrides?.pane ?? (meta.overlay ? "main" : snapshotName),
    color: overrides?.color ?? chartPreset?.color,
    lineWidth: overrides?.lineWidth ?? chartPreset?.lineWidth,
    // meta.label already carries any parameter suffix (e.g. "SMA(20)") because
    // trendcraft's indicators emit a fully-formed label via withLabelParams.
    // Use it directly; fall back to the legacy (period)-wrap only when meta
    // was produced by older callers that didn't include the period.
    label: overrides?.label ?? meta.label,
    yRange: overrides?.yRange ?? meta.yRange,
    referenceLines: overrides?.referenceLines ?? meta.referenceLines,
    type: overrides?.type,
    scaleId: overrides?.scaleId,
    maxHeightRatio: overrides?.maxHeightRatio,
    channelColors: overrides?.channelColors ?? chartPreset?.channelColors,
  };
}
