/**
 * Window API for programmatic chart-viewer control.
 *
 * Exposed as `window.__chart` so that LLM agents (via agent-browser eval)
 * or DevTools users can drive the chart without fragile DOM manipulation.
 */

import type { RefObject } from "react";
import { useChartStore } from "../store/chartStore";
import { parseCSV } from "../utils/fileParser";
import { INDICATOR_PARAM_CONFIGS } from "../types/indicators";
import type { NumericParamConfig } from "../types/indicators";
import { OVERLAY_GROUPS, SUBCHART_GROUPS, SIGNAL_OPTIONS } from "../components/settings/settingsData";
import type { MainChartHandle } from "../components/MainChart";
import type {
  DisplayStartYears,
  IndicatorParams,
  OverlayType,
  SignalType,
  SubChartType,
  Timeframe,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _chartRef: RefObject<MainChartHandle | null> | null = null;

/**
 * Register the MainChart ref so the API can access the ECharts instance.
 * Called once from App.tsx after mount.
 */
export function registerChartRef(ref: RefObject<MainChartHandle | null>): void {
  _chartRef = ref;
}

function store() {
  return useChartStore.getState();
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ChartApi {
  // Data loading
  loadCSV(csvContent: string, fileName?: string): string;
  loadCandles(candles: import("trendcraft").NormalizedCandle[], fileName?: string): string;

  // Overlay control
  enableOverlays(overlays: OverlayType | OverlayType[]): string;
  disableOverlays(overlays: OverlayType | OverlayType[]): string;
  setOverlays(overlays: OverlayType[]): string;

  // Indicator (subchart) control
  enableIndicators(indicators: SubChartType | SubChartType[]): string;
  disableIndicators(indicators: SubChartType | SubChartType[]): string;
  setIndicators(indicators: SubChartType[]): string;

  // Signal control
  enableSignals(signals: SignalType | SignalType[]): string;
  disableSignals(signals: SignalType | SignalType[]): string;
  setSignals(signals: SignalType[]): string;

  // Parameters
  setParams(params: Partial<IndicatorParams>): string;
  resetParams(): string;

  // Timeframe & zoom
  setTimeframe(tf: Timeframe): string;
  setZoom(start: number, end: number): string;
  setDisplayYears(years: 5 | 10 | 20 | null): string;

  // State inspection
  status(): Record<string, unknown>;
  readings(): Record<string, number | number[] | null> | string;
  timeSeries(count?: number): Record<string, unknown>[] | string;
  listOverlays(): { group: string; keys: string[] }[];
  listIndicators(): { group: string; keys: string[] }[];
  listSignals(): { key: string; label: string; description: string }[];
  listParams(): Record<string, { key: string; label: string; type?: string; min?: number; max?: number; step?: number }[]>;

  // Presets
  savePreset(name: string): string;
  loadPreset(name: string): string;
  listPresets(): string[];
  deletePreset(name: string): string;

  // Signal & Fundamental summaries
  signalSummary(): Record<string, unknown> | string;
  fundamentalSummary(): Record<string, unknown> | string;

  // Snapshot
  snapshot(): string;

  // Reset
  reset(): string;
  clear(): string;

  // Help
  help(): string;
}

export function createChartApi(): ChartApi {
  return {
    // -----------------------------------------------------------------------
    // Data loading
    // -----------------------------------------------------------------------

    loadCSV(csvContent: string, fileName = "api-load.csv") {
      const { candles, fundamentals } = parseCSV(csvContent);
      if (candles.length === 0) return "Error: no valid candles parsed from CSV";
      store().loadCandles(candles, fundamentals, fileName);
      return `Loaded ${candles.length} candles from "${fileName}"`;
    },

    loadCandles(candles, fileName = "api-load") {
      if (!candles || candles.length === 0) return "Error: empty candle array";
      store().loadCandles(candles, null, fileName);
      return `Loaded ${candles.length} candles from "${fileName}"`;
    },

    // -----------------------------------------------------------------------
    // Overlay control
    // -----------------------------------------------------------------------

    enableOverlays(overlays) {
      const add = toArray(overlays);
      const current = store().enabledOverlays;
      store().setEnabledOverlays(unique([...current, ...add]) as OverlayType[]);
      return `Overlays: [${store().enabledOverlays.join(", ")}]`;
    },

    disableOverlays(overlays) {
      const remove = new Set(toArray(overlays));
      const current = store().enabledOverlays;
      store().setEnabledOverlays(current.filter((o) => !remove.has(o)));
      return `Overlays: [${store().enabledOverlays.join(", ")}]`;
    },

    setOverlays(overlays) {
      store().setEnabledOverlays(overlays);
      return `Overlays: [${overlays.join(", ")}]`;
    },

    // -----------------------------------------------------------------------
    // Indicator (subchart) control
    // -----------------------------------------------------------------------

    enableIndicators(indicators) {
      const add = toArray(indicators);
      const current = store().enabledIndicators;
      store().setEnabledIndicators(unique([...current, ...add]) as SubChartType[]);
      return `Indicators: [${store().enabledIndicators.join(", ")}]`;
    },

    disableIndicators(indicators) {
      const remove = new Set(toArray(indicators));
      const current = store().enabledIndicators;
      store().setEnabledIndicators(current.filter((i) => !remove.has(i)));
      return `Indicators: [${store().enabledIndicators.join(", ")}]`;
    },

    setIndicators(indicators) {
      store().setEnabledIndicators(indicators);
      return `Indicators: [${indicators.join(", ")}]`;
    },

    // -----------------------------------------------------------------------
    // Signal control
    // -----------------------------------------------------------------------

    enableSignals(signals) {
      const add = toArray(signals);
      const current = store().enabledSignals;
      store().setEnabledSignals(unique([...current, ...add]) as SignalType[]);
      return `Signals: [${store().enabledSignals.join(", ")}]`;
    },

    disableSignals(signals) {
      const remove = new Set(toArray(signals));
      const current = store().enabledSignals;
      store().setEnabledSignals(current.filter((s) => !remove.has(s)));
      return `Signals: [${store().enabledSignals.join(", ")}]`;
    },

    setSignals(signals) {
      store().setEnabledSignals(signals);
      return `Signals: [${signals.join(", ")}]`;
    },

    // -----------------------------------------------------------------------
    // Parameters
    // -----------------------------------------------------------------------

    setParams(params) {
      store().setIndicatorParams(params);
      return `Params updated: ${Object.keys(params).join(", ")}`;
    },

    resetParams() {
      store().resetIndicatorParams();
      return "Params reset to defaults";
    },

    // -----------------------------------------------------------------------
    // Timeframe & zoom
    // -----------------------------------------------------------------------

    setTimeframe(tf) {
      store().setTimeframe(tf);
      return `Timeframe: ${tf}`;
    },

    setZoom(start, end) {
      if (start < 0 || end > 100 || start >= end) {
        return `Error: invalid range (0 <= start < end <= 100)`;
      }
      store().setZoomRange({ start, end });
      return `Zoom: ${start}% - ${end}%`;
    },

    setDisplayYears(years) {
      const valid: DisplayStartYears[] = [5, 10, 20, null];
      if (!valid.includes(years)) return `Error: years must be 5, 10, 20, or null`;
      store().setDisplayStartYears(years);
      return `Display years: ${years ?? "all"}`;
    },

    // -----------------------------------------------------------------------
    // State inspection
    // -----------------------------------------------------------------------

    status() {
      const s = store();
      const candles = s.currentCandles;
      const dateRange =
        candles.length > 0
          ? { start: formatDate(candles[0].time), end: formatDate(candles[candles.length - 1].time) }
          : null;

      return {
        loaded: s.rawCandles.length > 0,
        fileName: s.fileName,
        candleCount: candles.length,
        rawCandleCount: s.rawCandles.length,
        dateRange,
        timeframe: s.timeframe,
        displayYears: s.displayStartYears,
        overlays: s.enabledOverlays,
        indicators: s.enabledIndicators,
        signals: s.enabledSignals,
        zoom: s.zoomRange,
        params: s.indicatorParams,
      };
    },

    readings() {
      const handle = _chartRef?.current;
      if (!handle) return "Error: chart not available";
      return handle.getReadings();
    },

    timeSeries(count = 20) {
      const handle = _chartRef?.current;
      if (!handle) return "Error: chart not available";
      return handle.getTimeSeries(count);
    },

    listOverlays() {
      return OVERLAY_GROUPS.map((g) => ({
        group: g.group,
        keys: g.options.map((o) => o.key),
      }));
    },

    listIndicators() {
      return SUBCHART_GROUPS.map((g) => ({
        group: g.group,
        keys: g.options.map((o) => o.key),
      }));
    },

    listSignals() {
      return SIGNAL_OPTIONS.map((o) => ({
        key: o.key,
        label: o.label,
        description: o.description,
      }));
    },

    listParams() {
      const result: Record<string, { key: string; label: string; type?: string; min?: number; max?: number; step?: number }[]> = {};
      for (const [indicator, configs] of Object.entries(INDICATOR_PARAM_CONFIGS)) {
        result[indicator] = configs.map((c) => {
          if ("type" in c && c.type === "boolean") {
            return { key: c.key, label: c.label, type: "boolean" };
          }
          const nc = c as NumericParamConfig;
          return { key: nc.key, label: nc.label, min: nc.min, max: nc.max, step: nc.step };
        });
      }
      return result;
    },

    // -----------------------------------------------------------------------
    // Presets
    // -----------------------------------------------------------------------

    savePreset(name) {
      store().savePreset(name);
      return `Preset "${name}" saved`;
    },

    loadPreset(name) {
      const presets = store().presets;
      if (!presets.find((p) => p.name === name)) return `Error: preset "${name}" not found`;
      store().loadPreset(name);
      return `Preset "${name}" loaded`;
    },

    listPresets() {
      return store().presets.map((p) => p.name);
    },

    deletePreset(name) {
      store().deletePreset(name);
      return `Preset "${name}" deleted`;
    },

    // -----------------------------------------------------------------------
    // Signal & Fundamental summaries
    // -----------------------------------------------------------------------

    signalSummary() {
      const handle = _chartRef?.current;
      if (!handle) return "Error: chart not available";
      return (handle.getSignalSummary() as unknown as Record<string, unknown>) ?? "Error: no signal data";
    },

    fundamentalSummary() {
      const handle = _chartRef?.current;
      if (!handle) return "Error: chart not available";
      return (handle.getFundamentalSummary() as unknown as Record<string, unknown>) ?? "No fundamental data available";
    },

    // -----------------------------------------------------------------------
    // Snapshot
    // -----------------------------------------------------------------------

    snapshot() {
      const handle = _chartRef?.current;
      if (!handle) return "Error: chart not available";
      const dataURL = handle.getBase64PNG();
      if (!dataURL) return "Error: failed to render chart";
      return dataURL;
    },

    // -----------------------------------------------------------------------
    // Reset
    // -----------------------------------------------------------------------

    reset() {
      store().reset();
      return "Full reset complete (data + indicators cleared)";
    },

    clear() {
      store().setEnabledOverlays([]);
      store().setEnabledIndicators([]);
      store().setEnabledSignals([]);
      store().resetIndicatorParams();
      return "Indicators cleared (data preserved)";
    },

    // -----------------------------------------------------------------------
    // Help
    // -----------------------------------------------------------------------

    help() {
      return `
__chart API - Chart Viewer programmatic control
================================================

DATA LOADING:
  __chart.loadCSV(csvContent, fileName?)      Load CSV string
  __chart.loadCandles(candles, fileName?)      Load NormalizedCandle[]

OVERLAYS (main chart):
  __chart.enableOverlays("bb")                Enable one or more overlays
  __chart.enableOverlays(["bb", "sma25"])
  __chart.disableOverlays("bb")               Disable overlays
  __chart.setOverlays(["bb", "ichimoku"])      Replace all overlays

INDICATORS (subcharts):
  __chart.enableIndicators("rsi")             Enable subcharts
  __chart.enableIndicators(["rsi", "macd"])
  __chart.disableIndicators("rsi")            Disable subcharts
  __chart.setIndicators(["rsi", "macd"])       Replace all subcharts

SIGNALS:
  __chart.enableSignals("cross")              Enable signals
  __chart.disableSignals("cross")             Disable signals
  __chart.setSignals(["cross", "divergence"])  Replace all signals

PARAMETERS:
  __chart.setParams({ rsiPeriod: 21 })        Update params
  __chart.resetParams()                        Reset to defaults

TIMEFRAME & ZOOM:
  __chart.setTimeframe("daily"|"weekly"|"monthly")
  __chart.setZoom(start, end)                 0-100 range
  __chart.setDisplayYears(5|10|20|null)

STATUS:
  __chart.status()                            Current state object
  __chart.readings()                          Latest indicator values from chart
  __chart.timeSeries(n?)                      Last n rows of indicator data (default 20)
  __chart.signalSummary()                     Cross/divergence/squeeze signal data
  __chart.fundamentalSummary()                PER/PBR/ROE with percentiles
  __chart.listOverlays()                      Available overlays
  __chart.listIndicators()                    Available subcharts
  __chart.listSignals()                       Available signals
  __chart.listParams()                        Param configs with min/max

PRESETS:
  __chart.savePreset("name")                  Save current setup
  __chart.loadPreset("name")                  Load a preset
  __chart.listPresets()                       List preset names
  __chart.deletePreset("name")               Delete a preset

SNAPSHOT:
  __chart.snapshot()                          Base64 PNG data URL of current chart

RESET:
  __chart.reset()                             Full reset (data + indicators)
  __chart.clear()                             Clear indicators only

STORE ACCESS:
  __chartStore.getState()                     Raw Zustand state
  __chartStore.setState({...})                Direct state mutation
`.trim();
    },
  };
}
