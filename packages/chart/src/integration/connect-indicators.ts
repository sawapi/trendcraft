/**
 * Unified Indicator Connection
 *
 * Connects indicators to a chart instance in both static and live modes.
 * Uses duck-typed presets (from trendcraft's `indicatorPresets`) so the
 * chart package has zero dependency on trendcraft core.
 *
 * @example
 * ```ts
 * import { createChart, connectIndicators } from "@trendcraft/chart";
 * import { indicatorPresets } from "trendcraft";
 *
 * // Static mode
 * const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
 * conn.add("rsi");
 * conn.add("sma", { period: 50 });
 *
 * // Live mode
 * const conn = connectIndicators(chart, { presets: indicatorPresets, candles, live: source });
 * conn.add("rsi");   // backfill + live streaming
 *
 * conn.remove("rsi");
 * conn.recompute(newCandles);
 * conn.disconnect();
 * ```
 */

import type { ChartInstance, DataPoint, SeriesConfig, SeriesHandle } from "../core/types";
import {
  type LiveIndicatorFactoryFn,
  type PresetMeta,
  type SourceCandle,
  buildSeriesConfig,
  computeBackfill,
  resolveSnapshotName,
  resolveValue,
} from "./helpers";

// ============================================
// Duck-typed Interfaces
// ============================================

/** Unified indicator preset (duck-typed, matches IndicatorPreset from core) */
export type IndicatorPresetEntry = {
  meta: PresetMeta;
  defaultParams: Record<string, unknown>;
  snapshotName: string | ((params: Record<string, unknown>) => string);
  /** Batch computation for static mode */
  compute?: (candles: SourceCandle[], params: Record<string, unknown>) => DataPoint<unknown>[];
  /** Incremental factory for live streaming */
  createFactory?: (params: Record<string, unknown>) => LiveIndicatorFactoryFn;
};

/** Duck-typed LiveCandle-compatible data source (same shape as LiveFeedSource) */
export type LiveSource = {
  readonly completedCandles: readonly SourceCandle[];
  readonly candle: SourceCandle | null;
  readonly snapshot: Record<string, unknown>;
  on(
    event: "tick",
    cb: (payload: {
      candle: SourceCandle;
      snapshot: Record<string, unknown>;
      isNewCandle: boolean;
    }) => void,
  ): () => void;
  on(
    event: "candleComplete",
    cb: (payload: {
      candle: SourceCandle;
      snapshot: Record<string, unknown>;
    }) => void,
  ): () => void;
  addIndicator?(name: string, factory: LiveIndicatorFactoryFn, state?: unknown): void;
  removeIndicator?(name: string): void;
};

// ============================================
// Public Types
// ============================================

/** Options for connectIndicators */
export type ConnectIndicatorsOptions = {
  /** Indicator preset registry (e.g., `indicatorPresets` from trendcraft) */
  presets?: Record<string, IndicatorPresetEntry>;
  /** Candle data for static computation and backfill */
  candles?: readonly SourceCandle[];
  /** Live data source — when provided, enables streaming mode */
  live?: LiveSource;
  /** Initialize chart with live source history on connect (default: true, only for live mode) */
  initHistory?: boolean;
};

/** Handle for managing an indicator connection */
export type IndicatorConnection = {
  /** Add an indicator by preset name, with optional parameter overrides */
  add(id: string, params?: Record<string, unknown> & { series?: SeriesConfig }): void;
  /** Remove an indicator by id */
  remove(id: string): void;
  /** Recompute all static indicators with new candle data */
  recompute(candles: readonly SourceCandle[]): void;
  /** Disconnect: remove all indicators and unsubscribe events */
  disconnect(): void;
  /** Whether the connection is still active */
  readonly connected: boolean;
  /** Connection mode: "static" or "live" */
  readonly mode: "static" | "live";
};

// ============================================
// Internal Types
// ============================================

type ActiveIndicator = {
  handle: SeriesHandle;
  presetId: string;
  params: Record<string, unknown>;
  snapshotName: string;
  /** True when preset has no createFactory (static-only even in live mode) */
  staticOnly: boolean;
};

// ============================================
// Main Function
// ============================================

/**
 * Connect indicators to a chart instance.
 *
 * Supports two modes:
 * - **Static**: Provide `candles` — indicators are batch-computed and rendered
 * - **Live**: Provide `candles` + `live` — indicators stream in real-time
 *
 * @param chart - A ChartInstance (from createChart)
 * @param options - Presets, candle data, and optional live source
 * @returns An IndicatorConnection for managing the lifecycle
 */
export function connectIndicators(
  chart: ChartInstance,
  options: ConnectIndicatorsOptions,
): IndicatorConnection {
  let _connected = true;
  const presets = options.presets ?? {};
  const initialCandles = options.candles ?? [];
  const liveSource = options.live ?? null;
  const mode = liveSource ? ("live" as const) : ("static" as const);
  const active = new Map<string, ActiveIndicator>();
  let _candles: readonly SourceCandle[] = initialCandles;

  // Unsub handles for live events
  let unsubTick: (() => void) | null = null;
  let unsubComplete: (() => void) | null = null;

  function assertConnected(): void {
    if (!_connected) {
      throw new Error("IndicatorConnection is disconnected");
    }
  }

  // ------ Compute helpers ------

  function computeData(
    preset: IndicatorPresetEntry,
    params: Record<string, unknown>,
    candles: readonly SourceCandle[],
  ): DataPoint<unknown>[] {
    if (preset.compute) {
      return preset.compute(candles as SourceCandle[], params) as DataPoint<unknown>[];
    }
    if (preset.createFactory) {
      return computeBackfill(preset.createFactory, params, candles);
    }
    return [];
  }

  // ------ Live event handlers ------

  function updateLiveIndicators(snapshot: Record<string, unknown>, candle: SourceCandle): void {
    for (const [, entry] of active) {
      if (entry.staticOnly) continue;
      const value = resolveValue(snapshot, entry.snapshotName);
      entry.handle.update({ time: candle.time, value });
    }
  }

  // Initialize live subscriptions
  if (liveSource) {
    if (options.initHistory !== false) {
      chart.setCandles(liveSource.completedCandles as import("../core/types").CandleData[]);
      if (liveSource.candle) {
        chart.updateCandle(liveSource.candle as import("../core/types").CandleData);
      }
    }

    unsubTick = liveSource.on("tick", ({ candle, snapshot }) => {
      chart.updateCandle(candle as import("../core/types").CandleData);
      updateLiveIndicators(snapshot, candle);
    });

    unsubComplete = liveSource.on("candleComplete", ({ candle, snapshot }) => {
      updateLiveIndicators(snapshot, candle);
    });
  }

  // ------ Public API ------

  function add(id: string, overrides?: Record<string, unknown> & { series?: SeriesConfig }): void {
    assertConnected();

    if (active.has(id)) {
      throw new Error(`Indicator "${id}" is already added. Remove it first.`);
    }

    const preset = presets[id];
    if (!preset) {
      throw new Error(
        `Unknown indicator preset: "${id}". Pass it via connectIndicators({ presets: indicatorPresets }).`,
      );
    }

    // Split series config from param overrides
    const { series: seriesOverrides, ...paramOverrides } = overrides ?? {};
    const params = { ...preset.defaultParams, ...paramOverrides };
    const snapshotName = resolveSnapshotName(preset, params);

    // Determine if this indicator can stream
    const canStream = mode === "live" && !!preset.createFactory;
    const staticOnly = mode === "live" && !preset.createFactory;

    // Register on live source
    if (canStream && liveSource?.addIndicator) {
      const factory = preset.createFactory?.(params);
      if (factory) liveSource.addIndicator(snapshotName, factory);
    }

    // Compute initial data (backfill)
    const allCandles = liveSource ? [..._candles, ...liveSource.completedCandles] : [..._candles];
    const historyData = allCandles.length > 0 ? computeData(preset, params, allCandles) : [];

    // Build series config
    const series = buildSeriesConfig(preset.meta, snapshotName, params, seriesOverrides, id);

    // Mount on chart
    const handle = chart.addIndicator(historyData, series);

    // Push current forming candle value in live mode
    if (canStream && liveSource?.candle) {
      const value = resolveValue(liveSource.snapshot, snapshotName);
      handle.update({ time: liveSource.candle.time, value });
    }

    active.set(id, { handle, presetId: id, params, snapshotName, staticOnly });
  }

  function remove(id: string): void {
    assertConnected();
    const entry = active.get(id);
    if (!entry) return;

    entry.handle.remove();
    if (!entry.staticOnly && liveSource?.removeIndicator) {
      liveSource.removeIndicator(entry.snapshotName);
    }
    active.delete(id);
  }

  function recompute(candles: readonly SourceCandle[]): void {
    assertConnected();
    _candles = candles;

    for (const [id, entry] of active) {
      const preset = presets[id];
      if (!preset) continue;

      const newData = computeData(preset, entry.params, candles);
      entry.handle.setData(newData);
    }
  }

  function disconnect(): void {
    if (!_connected) return;

    unsubTick?.();
    unsubComplete?.();

    for (const [, entry] of active) {
      entry.handle.remove();
      if (!entry.staticOnly && liveSource?.removeIndicator) {
        liveSource.removeIndicator(entry.snapshotName);
      }
    }
    active.clear();
    _connected = false;
  }

  return {
    add,
    remove,
    recompute,
    disconnect,
    get connected() {
      return _connected;
    },
    get mode() {
      return mode;
    },
  };
}
