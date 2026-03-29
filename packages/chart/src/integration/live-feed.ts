/**
 * Live Feed Integration
 *
 * Connects a LiveCandle-compatible data source to a chart instance,
 * automatically updating candle data and indicator series.
 *
 * Supports two modes:
 * - **Zero-config**: `conn.addIndicator("rsi")` — uses preset registry
 * - **Full config**: `conn.addIndicator("id", { snapshotPath, series })` — manual
 *
 * @example
 * ```ts
 * import { createChart, connectLiveFeed } from '@trendcraft/chart';
 * import { createLiveCandle, incremental } from 'trendcraft';
 *
 * import { livePresets } from 'trendcraft';
 *
 * const conn = connectLiveFeed(chart, live, {
 *   presets: livePresets,
 *   history: candles,
 * });
 *
 * conn.addIndicator("rsi");               // zero config
 * conn.addIndicator("sma", { period: 50 }); // custom params
 * conn.removeIndicator("rsi");
 * conn.disconnect();
 * ```
 */

import type {
  CandleData,
  ChartInstance,
  DataPoint,
  SeriesConfig,
  SeriesHandle,
} from "../core/types";
import { INDICATOR_PRESETS } from "./indicator-presets";
// ============================================
// Preset Types (duck-typed, matches LivePreset from core)
// ============================================

/** Indicator metadata (duck-typed, matches SeriesMeta from core) */
type PresetMeta = {
  overlay: boolean;
  label: string;
  yRange?: [number, number];
  referenceLines?: number[];
};

/** A live indicator preset (duck-typed, matches LivePreset from core) */
export type LivePresetEntry = {
  meta: PresetMeta;
  defaultParams: Record<string, unknown>;
  snapshotName: string | ((params: Record<string, unknown>) => string);
  createFactory: (params: Record<string, unknown>) => (fromState?: unknown) => {
    next(candle: SourceCandle): { value: unknown };
    peek(candle: SourceCandle): { value: unknown };
    getState(): unknown;
    readonly count: number;
    readonly isWarmedUp: boolean;
  };
};

/** User-facing shorthand for addIndicator("rsi", options?) */
export type AddIndicatorShorthand = {
  series?: SeriesConfig;
  [key: string]: unknown;
};

// ============================================
// Duck-typed Source Interface
// ============================================

/** OHLCV candle shape (duck-typed, matches NormalizedCandle from core) */
type SourceCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Duck-typed interface for a LiveCandle-compatible data source.
 * Does not import from @trendcraft/core — any object matching this shape works.
 */
export type LiveFeedSource = {
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
  /** Optional: register an indicator on the source (used by zero-config mode) */
  addIndicator?(
    name: string,
    factory: (fromState?: unknown) => {
      next(candle: SourceCandle): { value: unknown };
      peek(candle: SourceCandle): { value: unknown };
      getState(): unknown;
      readonly count: number;
      readonly isWarmedUp: boolean;
    },
    state?: unknown,
  ): void;
  /** Optional: remove an indicator from the source */
  removeIndicator?(name: string): void;
};

// ============================================
// Configuration Types
// ============================================

/**
 * Configuration for mapping a value to a chart series.
 * Use `snapshotPath` for indicator values or `candleField` for raw OHLCV fields.
 */
export type LiveFeedIndicatorConfig = {
  /** Dot-path into snapshot (e.g., "rsi14", "bb.upper", "bb") */
  snapshotPath?: string;
  /** Extract a field directly from the candle (e.g., "volume", "close") */
  candleField?: "open" | "high" | "low" | "close" | "volume";
  /** Chart series visual config (color, pane, label, etc.) */
  series?: SeriesConfig;
  /** Pre-computed historical data points for back-fill */
  historyData?: DataPoint[];
};

/**
 * Options for connectLiveFeed
 */
export type ConnectLiveFeedOptions = {
  /** Indicator mappings: key is a user-chosen id, value configures extraction and display */
  indicators?: Record<string, LiveFeedIndicatorConfig>;
  /** Initialize chart with source.completedCandles on connect (default: true) */
  initHistory?: boolean;
  /** Live indicator presets for zero-config addIndicator (e.g., livePresets from trendcraft) */
  presets?: Record<string, LivePresetEntry>;
  /** Historical candles for back-fill computation (used by zero-config addIndicator) */
  history?: readonly SourceCandle[];
};

/**
 * Handle for managing a live feed connection
 */
export type LiveFeedConnection = {
  /**
   * Add an indicator.
   * - Zero-config: `addIndicator("rsi")` or `addIndicator("rsi", { period: 7 })`
   * - Full config: `addIndicator("id", { snapshotPath: "rsi14", series: {...} })`
   */
  addIndicator(id: string, config?: LiveFeedIndicatorConfig | AddIndicatorShorthand): void;
  /** Remove an indicator series from the chart */
  removeIndicator(id: string): void;
  /** Disconnect: unsubscribe all events and remove all indicator handles */
  disconnect(): void;
  /** Whether the connection is still active */
  readonly connected: boolean;
};

// ============================================
// Helpers
// ============================================

/**
 * Resolve a snapshot value by path.
 *
 * - Simple key (`"rsi14"`) → returns the value as-is (number, object, or null)
 * - Dot-path (`"bb.upper"`) → drills into object and returns the nested scalar
 *
 * Compound objects (e.g., `{ upper, middle, lower }`) are returned whole
 * so the chart's introspector can auto-detect band/channel types.
 */
function resolveValue(snapshot: Record<string, unknown>, path: string): unknown {
  const dot = path.indexOf(".");
  if (dot === -1) {
    const v = snapshot[path];
    return v ?? null;
  }
  // Dot-path: extract nested scalar
  const key = path.slice(0, dot);
  const field = path.slice(dot + 1);
  const obj = snapshot[key];
  if (obj == null || typeof obj !== "object") return null;
  const v = (obj as Record<string, unknown>)[field];
  return typeof v === "number" ? v : null;
}

/** Check if a config object is a LiveFeedIndicatorConfig (has snapshotPath or candleField) */
function isExplicitConfig(
  config: LiveFeedIndicatorConfig | AddIndicatorShorthand | undefined,
): config is LiveFeedIndicatorConfig {
  if (!config) return false;
  return "snapshotPath" in config || "candleField" in config || "historyData" in config;
}

/** Compute back-fill data by running a factory over candle history */
function computeBackfill(
  createFactory: LivePresetEntry["createFactory"],
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
function resolveSnapshotName(preset: LivePresetEntry, params: Record<string, unknown>): string {
  return typeof preset.snapshotName === "function"
    ? preset.snapshotName(params)
    : preset.snapshotName;
}

/** Build series config from preset meta + user overrides */
function buildSeriesConfig(
  meta: PresetMeta,
  snapshotName: string,
  params: Record<string, unknown>,
  overrides?: SeriesConfig,
  presetId?: string,
): SeriesConfig {
  // Resolve channelColors: user overrides > INDICATOR_PRESETS > undefined
  const chartPreset = presetId ? INDICATOR_PRESETS.get(presetId) : undefined;
  return {
    pane: overrides?.pane ?? (meta.overlay ? "main" : snapshotName),
    color: overrides?.color ?? chartPreset?.color,
    lineWidth: overrides?.lineWidth ?? chartPreset?.lineWidth,
    label: overrides?.label ?? `${meta.label}(${params.period ?? ""})`.replace(/\(\)$/, ""),
    yRange: overrides?.yRange ?? meta.yRange,
    referenceLines: overrides?.referenceLines ?? meta.referenceLines,
    type: overrides?.type,
    scaleId: overrides?.scaleId,
    maxHeightRatio: overrides?.maxHeightRatio,
    channelColors: overrides?.channelColors ?? chartPreset?.channelColors,
  };
}

// ============================================
// Main Function
// ============================================

/**
 * Connect a LiveCandle-compatible data source to a chart instance.
 *
 * Subscribes to the source's events and automatically updates
 * candle data and indicator series on the chart.
 *
 * @param chart - A ChartInstance (from createChart)
 * @param source - A LiveCandle-compatible object (duck-typed)
 * @param options - Indicator mappings, factories, and initialization options
 * @returns A LiveFeedConnection for managing the connection lifecycle
 *
 * @example
 * ```ts
 * // Zero-config mode
 * const conn = connectLiveFeed(chart, live, {
 *   factories: { rsi: (p) => (s) => createRsi(p, restoreState(s)) },
 *   history: candles,
 * });
 * conn.addIndicator("rsi");
 *
 * // Full config mode (no factories needed)
 * const conn2 = connectLiveFeed(chart, live);
 * conn2.addIndicator("myRsi", { snapshotPath: "rsi14", series: { pane: "rsi" } });
 * ```
 */
export function connectLiveFeed(
  chart: ChartInstance,
  source: LiveFeedSource,
  options?: ConnectLiveFeedOptions,
): LiveFeedConnection {
  let _connected = true;
  const presets = options?.presets ?? {};
  const historyCandles = options?.history ?? [];
  const activeIndicators = new Map<
    string,
    { handle: SeriesHandle; config: LiveFeedIndicatorConfig; presetSnapshotName?: string }
  >();

  function assertConnected(): void {
    if (!_connected) {
      throw new Error("LiveFeedConnection is disconnected");
    }
  }

  function resolveEntry(
    config: LiveFeedIndicatorConfig,
    snapshot: Record<string, unknown>,
    candle: SourceCandle,
  ): unknown {
    if (config.candleField) {
      return candle[config.candleField];
    }
    return config.snapshotPath ? resolveValue(snapshot, config.snapshotPath) : null;
  }

  function mountIndicator(
    id: string,
    config: LiveFeedIndicatorConfig,
    presetSnapshotName?: string,
  ): void {
    const handle = chart.addIndicator(config.historyData ?? [], config.series);
    activeIndicators.set(id, { handle, config, presetSnapshotName });

    // If source already has a forming candle, push initial value
    if (source.candle) {
      const value = resolveEntry(config, source.snapshot, source.candle);
      handle.update({ time: source.candle.time, value });
    }
  }

  function updateIndicators(snapshot: Record<string, unknown>, candle: SourceCandle): void {
    for (const [, entry] of activeIndicators) {
      const value = resolveEntry(entry.config, snapshot, candle);
      entry.handle.update({ time: candle.time, value });
    }
  }

  /** Zero-config: resolve preset, register on source, compute back-fill, mount */
  function addPresetIndicator(id: string, overrides?: AddIndicatorShorthand): void {
    const preset = presets[id];
    if (!preset) {
      throw new Error(
        `Unknown indicator preset: "${id}". Pass it via connectLiveFeed({ presets: livePresets })`,
      );
    }

    // Merge params
    const { series: seriesOverrides, ...paramOverrides } = overrides ?? {};
    const params = { ...preset.defaultParams, ...paramOverrides };
    const snapshotName = resolveSnapshotName(preset, params);

    // Build factory and register on source
    const factory = preset.createFactory(params);
    if (source.addIndicator) {
      source.addIndicator(snapshotName, factory);
    }

    // Compute back-fill
    const allCandles = [...historyCandles, ...source.completedCandles];
    const historyData =
      allCandles.length > 0 ? computeBackfill(preset.createFactory, params, allCandles) : [];

    // Build series config (pass preset id for INDICATOR_PRESETS lookup)
    const series = buildSeriesConfig(preset.meta, snapshotName, params, seriesOverrides, id);

    const config: LiveFeedIndicatorConfig = {
      snapshotPath: snapshotName,
      series,
      historyData: historyData as DataPoint[],
    };

    mountIndicator(id, config, snapshotName);
  }

  // --- Step 1: Initialize chart with history ---

  if (options?.initHistory !== false) {
    chart.setCandles(source.completedCandles as CandleData[]);
    if (source.candle) {
      chart.updateCandle(source.candle as CandleData);
    }
  }

  // --- Step 2: Mount initial indicators ---

  if (options?.indicators) {
    for (const [id, config] of Object.entries(options.indicators)) {
      mountIndicator(id, config);
    }
  }

  // --- Step 3: Subscribe to events ---

  const unsubComplete = source.on("candleComplete", ({ candle, snapshot }) => {
    updateIndicators(snapshot, candle);
  });

  const unsubTick = source.on("tick", ({ candle, snapshot }) => {
    chart.updateCandle(candle as CandleData);
    updateIndicators(snapshot, candle);
  });

  // --- Step 4: Build connection handle ---

  return {
    addIndicator(id: string, config?: LiveFeedIndicatorConfig | AddIndicatorShorthand): void {
      assertConnected();
      if (activeIndicators.has(id)) {
        throw new Error(`Indicator "${id}" already exists`);
      }

      if (isExplicitConfig(config)) {
        // Full config mode (backward compatible)
        mountIndicator(id, config);
      } else {
        // Zero-config / shorthand mode
        addPresetIndicator(id, config as AddIndicatorShorthand | undefined);
      }
    },

    removeIndicator(id: string): void {
      assertConnected();
      const entry = activeIndicators.get(id);
      if (!entry) return;
      entry.handle.remove();
      // Also remove from source if it was a preset indicator
      if (entry.presetSnapshotName && source.removeIndicator) {
        source.removeIndicator(entry.presetSnapshotName);
      }
      activeIndicators.delete(id);
    },

    disconnect(): void {
      if (!_connected) return;
      unsubComplete();
      unsubTick();
      for (const [, entry] of activeIndicators) {
        entry.handle.remove();
        if (entry.presetSnapshotName && source.removeIndicator) {
          source.removeIndicator(entry.presetSnapshotName);
        }
      }
      activeIndicators.clear();
      _connected = false;
    },

    get connected(): boolean {
      return _connected;
    },
  };
}
