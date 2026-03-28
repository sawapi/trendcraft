/**
 * Live Feed Integration
 *
 * Connects a LiveCandle-compatible data source to a chart instance,
 * automatically updating candle data and indicator series.
 *
 * @example
 * ```ts
 * import { createChart, connectLiveFeed } from '@trendcraft/chart';
 * import { createLiveCandle, createSma } from 'trendcraft';
 *
 * const chart = createChart(container, { theme: 'dark' });
 * const live = createLiveCandle({
 *   intervalMs: 60_000,
 *   indicators: [
 *     { name: 'sma20', create: (s) => createSma({ period: 20 }, { fromState: s }) },
 *   ],
 * });
 *
 * const conn = connectLiveFeed(chart, live, {
 *   indicators: {
 *     sma: { snapshotPath: 'sma20', series: { color: '#2196F3', label: 'SMA 20' } },
 *   },
 * });
 *
 * ws.on('trade', (t) => live.addTick(t));
 * conn.disconnect(); // cleanup
 * ```
 */

import type {
  CandleData,
  ChartInstance,
  DataPoint,
  SeriesConfig,
  SeriesHandle,
} from "../core/types";

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
};

// ============================================
// Configuration Types
// ============================================

/**
 * Configuration for mapping a snapshot value to a chart series
 */
export type LiveFeedIndicatorConfig = {
  /** Dot-path into snapshot (e.g., "rsi14", "bb.upper") */
  snapshotPath: string;
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
};

/**
 * Handle for managing a live feed connection
 */
export type LiveFeedConnection = {
  /** Add an indicator series after initial connection */
  addIndicator(id: string, config: LiveFeedIndicatorConfig): void;
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
 * Resolve a dot-path value from a snapshot.
 * Supports one level of nesting: "bb.upper" → snapshot.bb.upper
 */
function resolveValue(snapshot: Record<string, unknown>, path: string): number | null {
  const dot = path.indexOf(".");
  if (dot === -1) {
    const v = snapshot[path];
    return typeof v === "number" ? v : null;
  }
  const key = path.slice(0, dot);
  const field = path.slice(dot + 1);
  const obj = snapshot[key];
  if (obj == null || typeof obj !== "object") return null;
  const v = (obj as Record<string, unknown>)[field];
  return typeof v === "number" ? v : null;
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
 * @param options - Indicator mappings and initialization options
 * @returns A LiveFeedConnection for managing the connection lifecycle
 *
 * @example
 * ```ts
 * const conn = connectLiveFeed(chart, liveCandle, {
 *   indicators: {
 *     sma:   { snapshotPath: "sma20",    series: { color: "#2196F3" } },
 *     rsi:   { snapshotPath: "rsi14",    series: { pane: "rsi" } },
 *     bbUp:  { snapshotPath: "bb.upper", series: { color: "#9C27B0" } },
 *     bbLow: { snapshotPath: "bb.lower", series: { color: "#9C27B0" } },
 *   },
 * });
 * ```
 */
export function connectLiveFeed(
  chart: ChartInstance,
  source: LiveFeedSource,
  options?: ConnectLiveFeedOptions,
): LiveFeedConnection {
  let _connected = true;
  const activeIndicators = new Map<
    string,
    { handle: SeriesHandle; config: LiveFeedIndicatorConfig }
  >();

  function assertConnected(): void {
    if (!_connected) {
      throw new Error("LiveFeedConnection is disconnected");
    }
  }

  function mountIndicator(id: string, config: LiveFeedIndicatorConfig): void {
    const handle = chart.addIndicator(config.historyData ?? [], config.series);
    activeIndicators.set(id, { handle, config });

    // If source already has a forming candle, push initial value
    if (source.candle) {
      const value = resolveValue(source.snapshot, config.snapshotPath);
      handle.update({ time: source.candle.time, value });
    }
  }

  function updateIndicators(snapshot: Record<string, unknown>, time: number): void {
    for (const [, entry] of activeIndicators) {
      const value = resolveValue(snapshot, entry.config.snapshotPath);
      entry.handle.update({ time, value });
    }
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
    updateIndicators(snapshot, candle.time);
  });

  const unsubTick = source.on("tick", ({ candle, snapshot }) => {
    chart.updateCandle(candle as CandleData);
    updateIndicators(snapshot, candle.time);
  });

  // --- Step 4: Build connection handle ---

  return {
    addIndicator(id: string, config: LiveFeedIndicatorConfig): void {
      assertConnected();
      if (activeIndicators.has(id)) {
        throw new Error(`Indicator "${id}" already exists`);
      }
      mountIndicator(id, config);
    },

    removeIndicator(id: string): void {
      assertConnected();
      const entry = activeIndicators.get(id);
      if (!entry) return;
      entry.handle.remove();
      activeIndicators.delete(id);
    },

    disconnect(): void {
      if (!_connected) return;
      unsubComplete();
      unsubTick();
      for (const [, entry] of activeIndicators) {
        entry.handle.remove();
      }
      activeIndicators.clear();
      _connected = false;
    },

    get connected(): boolean {
      return _connected;
    },
  };
}
