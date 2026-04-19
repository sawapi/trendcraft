/**
 * Unified Indicator Connection
 *
 * Connects indicators to a chart instance in both static and live modes.
 * Uses duck-typed presets (from trendcraft's `indicatorPresets`) so the
 * chart package has zero dependency on trendcraft core.
 *
 * @example
 * ```ts
 * import { createChart, connectIndicators, defineIndicator } from "@trendcraft/chart";
 * import { indicatorPresets } from "trendcraft";
 *
 * // Static mode
 * const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
 * conn.add("rsi");
 * conn.add("sma", { period: 5 });
 * conn.add("sma", { period: 20 });
 * conn.add("sma", { period: 60 });
 *
 * // Live mode
 * const conn = connectIndicators(chart, { presets: indicatorPresets, candles, live: source });
 * conn.add("rsi");  // backfill + live streaming
 *
 * // Pre-defined specs (reusable across connections)
 * const sma5 = defineIndicator("sma", { period: 5 });
 * conn.add(sma5);
 *
 * // Individual and bulk removal
 * conn.remove("sma5");  // remove just one instance (snapshotName match)
 * conn.remove("sma");   // remove all remaining sma instances (preset id fallback)
 *
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

/** Duck-typed LiveCandle-compatible data source */
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

/**
 * Options accepted by `add()`.
 *
 * - `series`: visual overrides (color, pane, lineWidth, etc.)
 * - `snapshotName`: override the computed snapshot name. Use this to mount multiple
 *   instances of a preset whose snapshotName is a static string (e.g. `"emaRibbon"`).
 * - Any other key is treated as a parameter override for the preset.
 */
export type AddIndicatorOptions = {
  series?: SeriesConfig;
  snapshotName?: string;
  [paramKey: string]: unknown;
};

/**
 * Pre-defined indicator specification. A plain object (no runtime behavior) that
 * pairs a preset id with its options, so the same config can be reused across
 * multiple `add()` calls or connections.
 */
export type IndicatorSpec = {
  readonly presetId: string;
  readonly options?: AddIndicatorOptions;
};

/** Handle returned from `add()`. Represents a single mounted indicator instance. */
export type IndicatorHandle = {
  /** The resolved snapshot name (also the key used by LiveCandle and this connection) */
  readonly snapshotName: string;
  /** The preset id this instance was created from */
  readonly presetId: string;
  /** Effective parameters (defaultParams merged with overrides) */
  readonly params: Readonly<Record<string, unknown>>;
  /**
   * The assigned line color (either explicit or palette-rotated). Useful for
   * preserving an instance's color across a remove+add params-change cycle.
   * `undefined` when the indicator uses `channelColors` (multi-channel series)
   * or when no color has been resolved yet.
   */
  readonly color: string | undefined;
  /** Underlying chart series handle. Escape hatch for advanced use cases. */
  readonly series: SeriesHandle;
  /** True once this instance has been removed */
  readonly removed: boolean;
  /** Toggle visibility */
  setVisible(visible: boolean): void;
  /** Remove this instance. Idempotent — calling a second time is a no-op. */
  remove(): void;
};

/** Handle for managing an indicator connection */
export type IndicatorConnection = {
  /** Add an indicator using a pre-defined spec */
  add(spec: IndicatorSpec): IndicatorHandle;
  /** Add an indicator by preset id, with optional parameter and series overrides */
  add(presetId: string, options?: AddIndicatorOptions): IndicatorHandle;

  /**
   * Remove indicator(s). Accepts:
   * - an `IndicatorHandle` → removes that instance
   * - a snapshot name (e.g. `"sma5"`) → removes that single instance
   * - a preset id (e.g. `"sma"`) with no matching snapshot name → removes all instances of that preset
   */
  remove(target: string | IndicatorHandle): void;

  /** All currently active indicator handles */
  list(): ReadonlyArray<IndicatorHandle>;
  /** Handles for all instances of a given preset */
  listByPreset(presetId: string): ReadonlyArray<IndicatorHandle>;
  /** Look up a single handle by snapshot name */
  get(snapshotName: string): IndicatorHandle | undefined;

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
// Helpers
// ============================================

/**
 * Build a reusable indicator spec. The returned object is just `{ presetId, options }`;
 * this helper exists for readability and type inference.
 */
export function defineIndicator(presetId: string, options?: AddIndicatorOptions): IndicatorSpec {
  return { presetId, options };
}

// ============================================
// Internal Types
// ============================================

type ActiveEntry = {
  /** Underlying chart series handle */
  series: SeriesHandle;
  presetId: string;
  params: Record<string, unknown>;
  snapshotName: string;
  /** True when preset has no createFactory (static-only even in live mode) */
  staticOnly: boolean;
  /** User-facing wrapper, lazily assigned after creation */
  handle: IndicatorHandle;
  /** Snapshot of the resolved primary color at creation time */
  color: string | undefined;
  removed: boolean;
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
  /** Keyed by snapshotName (single source of truth, matches LiveCandle's indicator map) */
  const active = new Map<string, ActiveEntry>();
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
    for (const entry of active.values()) {
      if (entry.staticOnly) continue;
      const value = resolveValue(snapshot, entry.snapshotName);
      entry.series.update({ time: candle.time, value });
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
      try {
        chart.updateCandle(candle as import("../core/types").CandleData);
        updateLiveIndicators(snapshot, candle);
      } catch (e) {
        console.error("[@trendcraft/chart] connect-indicators tick error:", e);
      }
    });

    unsubComplete = liveSource.on("candleComplete", ({ candle, snapshot }) => {
      try {
        updateLiveIndicators(snapshot, candle);
      } catch (e) {
        console.error("[@trendcraft/chart] connect-indicators candleComplete error:", e);
      }
    });
  }

  // ------ Internal mutation helpers ------

  function removeEntry(entry: ActiveEntry): void {
    if (entry.removed) return;
    entry.removed = true;
    entry.series.remove();
    if (!entry.staticOnly && liveSource?.removeIndicator) {
      liveSource.removeIndicator(entry.snapshotName);
    }
    active.delete(entry.snapshotName);
  }

  function createHandle(entry: ActiveEntry): IndicatorHandle {
    return {
      get snapshotName() {
        return entry.snapshotName;
      },
      get presetId() {
        return entry.presetId;
      },
      get params() {
        return entry.params;
      },
      get series() {
        return entry.series;
      },
      get color() {
        return entry.color;
      },
      get removed() {
        return entry.removed;
      },
      setVisible(visible: boolean) {
        if (!entry.removed) entry.series.setVisible(visible);
      },
      remove() {
        removeEntry(entry);
      },
    };
  }

  // ------ Public API ------

  function add(
    specOrId: string | IndicatorSpec,
    maybeOptions?: AddIndicatorOptions,
  ): IndicatorHandle {
    assertConnected();

    // Normalize overloaded arguments
    const presetId = typeof specOrId === "string" ? specOrId : specOrId.presetId;
    const options = typeof specOrId === "string" ? maybeOptions : specOrId.options;

    const preset = presets[presetId];
    if (!preset) {
      throw new Error(
        `Unknown indicator preset: "${presetId}". Pass it via connectIndicators({ presets: indicatorPresets }).`,
      );
    }

    // Split series / snapshotName override from param overrides
    const {
      series: seriesOverrides,
      snapshotName: userSnapshotName,
      ...paramOverrides
    } = options ?? {};
    const params = { ...preset.defaultParams, ...paramOverrides };
    const snapshotName = userSnapshotName ?? resolveSnapshotName(preset, params);

    if (active.has(snapshotName)) {
      const existing = active.get(snapshotName);
      throw new Error(
        `Indicator snapshotName "${snapshotName}" is already added (preset="${existing?.presetId}"). Either the params produce the same snapshotName as an existing one, or this preset uses a static snapshotName. Pass { snapshotName: "custom-id" } to disambiguate, or remove the existing one first.`,
      );
    }

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
    const series = buildSeriesConfig(preset.meta, snapshotName, params, seriesOverrides, presetId);

    // Mount on chart
    const seriesHandle = chart.addIndicator(historyData, series);

    // Push current forming candle value in live mode
    if (canStream && liveSource?.candle) {
      const value = resolveValue(liveSource.snapshot, snapshotName);
      seriesHandle.update({ time: liveSource.candle.time, value });
    }

    const entry: ActiveEntry = {
      series: seriesHandle,
      presetId,
      params,
      snapshotName,
      staticOnly,
      handle: null as unknown as IndicatorHandle,
      color: seriesHandle.config?.color,
      removed: false,
    };
    entry.handle = createHandle(entry);

    active.set(snapshotName, entry);
    return entry.handle;
  }

  function remove(target: string | IndicatorHandle): void {
    assertConnected();

    // Handle direct pass-through
    if (typeof target !== "string") {
      removeEntry(findEntryByHandle(target));
      return;
    }

    // 1. snapshotName match → single instance
    const bySnap = active.get(target);
    if (bySnap) {
      removeEntry(bySnap);
      return;
    }

    // 2. preset id fallback → remove ALL matching instances
    const matching: ActiveEntry[] = [];
    for (const entry of active.values()) {
      if (entry.presetId === target) matching.push(entry);
    }
    for (const entry of matching) removeEntry(entry);
    // Silent no-op if nothing matched (preserves previous behavior)
  }

  function findEntryByHandle(handle: IndicatorHandle): ActiveEntry {
    // Look up by snapshotName (O(1)) and verify handle identity
    const entry = active.get(handle.snapshotName);
    if (entry && entry.handle === handle) return entry;
    // Handle may have been removed, or belongs to a different connection.
    // Return a sentinel disposed entry so removeEntry is a no-op.
    return {
      series: handle.series,
      presetId: handle.presetId,
      params: handle.params as Record<string, unknown>,
      snapshotName: handle.snapshotName,
      staticOnly: false,
      handle,
      removed: true,
    };
  }

  function list(): ReadonlyArray<IndicatorHandle> {
    const out: IndicatorHandle[] = [];
    for (const entry of active.values()) out.push(entry.handle);
    return out;
  }

  function listByPreset(presetId: string): ReadonlyArray<IndicatorHandle> {
    const out: IndicatorHandle[] = [];
    for (const entry of active.values()) {
      if (entry.presetId === presetId) out.push(entry.handle);
    }
    return out;
  }

  function get(snapshotName: string): IndicatorHandle | undefined {
    return active.get(snapshotName)?.handle;
  }

  function recompute(candles: readonly SourceCandle[]): void {
    assertConnected();
    _candles = candles;

    for (const entry of active.values()) {
      const preset = presets[entry.presetId];
      if (!preset) continue;

      const newData = computeData(preset, entry.params, candles);
      entry.series.setData(newData);
    }
  }

  function disconnect(): void {
    if (!_connected) return;

    unsubTick?.();
    unsubComplete?.();

    for (const entry of active.values()) {
      if (entry.removed) continue;
      entry.removed = true;
      entry.series.remove();
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
    list,
    listByPreset,
    get,
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
