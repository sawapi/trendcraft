/**
 * Indicator Showcase — Main Entry
 *
 * Demonstrates every preset available in `indicatorPresets` (104 as of 2026-06-08)
 * with a categorized sidebar UI, search, parameter controls, and active indicator
 * bar. The sidebar is auto-generated from indicatorPresets metadata, so the count
 * stays accurate as the preset registry grows.
 *
 * A Daily / 1H timeframe toggle swaps between the bundled daily sample data and
 * a synthetic intraday dataset (see `data-intraday.ts`) so intraday-only plugins
 * such as Session Zones can be demo'd meaningfully.
 */

import { connectIndicators, createChart, type IndicatorConnection } from "@trendcraft/chart";
import { registerDrawingTools } from "@trendcraft/chart/features";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import type { NormalizedCandle } from "trendcraft";
import { indicatorPresets } from "trendcraft";
import dailySampleData from "../../simple-chart/data.json";
import { generateIntradayCandles } from "./data-intraday";
import { createLivePanel, type LivePanelHandle, type Mode } from "./live-panel";
import { createLiveSimulator, type SimulatorHandle } from "./live-simulator";
import { createPluginsPanel, type PluginsPanelHandle } from "./plugins-panel";
import type { SidebarEntry } from "./sidebar";
import { createSidebar } from "./sidebar";
import { createSignalsPanel, type RsiPaneProvider, type SignalsPanelHandle } from "./signals-panel";

type Timeframe = "daily" | "intraday";

const dailyCandles = dailySampleData as NormalizedCandle[];
const intradayCandles = generateIntradayCandles();

// ============================================
// Build sidebar catalog from indicatorPresets
// ============================================

const catalog: SidebarEntry[] = [];
for (const [id, preset] of Object.entries(indicatorPresets)) {
  if (!preset.category) continue;
  catalog.push({
    id,
    shortName: preset.meta.label,
    name: preset.name ?? preset.meta.label,
    description: preset.description ?? "",
    category: preset.category,
    overlay: preset.meta.overlay,
    params: preset.paramSchema ?? [],
  });
}

// ============================================
// Chart
// ============================================

const chartEl = document.getElementById("chart") as HTMLElement;
const sidebarEl = document.getElementById("sidebar") as HTMLElement;
// index.html sets data-theme from prefers-color-scheme before first paint.
const initialTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
const chart = createChart(chartEl, { theme: initialTheme });
registerTrendCraftPresets(chart);
// The Plugins panel's fib / trend / channel toggles add drawings
registerDrawingTools(chart);

// ============================================
// Timeframe-scoped state (re-created on switch)
// ============================================

let currentTimeframe: Timeframe = "daily";
let currentMode: Mode = "static";
let currentCandles: NormalizedCandle[] = dailyCandles;
let conn: IndicatorConnection;
let pluginsPanel: PluginsPanelHandle;
let signalsPanel: SignalsPanelHandle;
let livePanel: LivePanelHandle | null = null;
let simulator: SimulatorHandle | null = null;

/** What the user has turned on — carried across mode / timeframe switches. */
type Selection = {
  indicators: {
    presetId: string;
    snapshotName: string;
    params: Record<string, unknown>;
    color: string | undefined;
  }[];
  plugins: string[];
  signals: string[];
};

const EMPTY_SELECTION: Selection = { indicators: [], plugins: [], signals: [] };

function captureSelection(): Selection {
  return {
    indicators: (conn?.list() ?? []).map((h) => ({
      presetId: h.presetId,
      snapshotName: h.snapshotName,
      params: { ...h.params },
      color: h.color,
    })),
    plugins: pluginsPanel?.getActiveIds() ?? [],
    signals: signalsPanel?.getActiveIds() ?? [],
  };
}

// ============================================
// Sidebar (built once; its selection state outlives every mount)
// ============================================

const sidebarAPI = createSidebar(sidebarEl, catalog, {
  onToggle(id, active, params) {
    // A manual change to RSI hands it back to the user (see rsiPane below).
    if (id === "rsi") rsiAddedBySignal = false;
    if (!active) {
      conn.remove(id);
      return true;
    }
    // Force the primary's snapshotName = presetId so editing params
    // later removes just this instance (not every SMA, etc.).
    return tryAdd(id, { ...resolveParams(id, params), snapshotName: id });
  },
  onParamChange(id, params) {
    if (id === "rsi") rsiAddedBySignal = false;
    // Preserve the current color across the remove+add round-trip so
    // editing a period in the active-bar pill doesn't re-roll the palette
    // and hand the same instance a different color mid-session.
    return replaceIndicator(id, id, params);
  },
  onAddExtra({ presetId, snapshotName, params }) {
    return tryAdd(presetId, { ...resolveParams(presetId, params), snapshotName });
  },
  onRemoveExtra(snapshotName) {
    conn.remove(snapshotName);
  },
  onChangeExtraParams({ presetId, snapshotName, params }) {
    return replaceIndicator(presetId, snapshotName, params);
  },
});

/** Add an indicator instance; false (with a console warning) if it throws. */
function tryAdd(presetId: string, overrides: Record<string, unknown>): boolean {
  try {
    conn.add(presetId, overrides);
    return true;
  } catch (err) {
    conn.remove(overrides.snapshotName as string);
    console.warn(`${presetId}: these params could not be applied`, err);
    return false;
  }
}

/**
 * Swap an indicator instance for one with new params, keeping its colour.
 * If the new params make the indicator throw, the previous instance is put
 * back and this returns false, so the sidebar can restore its own state.
 */
function replaceIndicator(
  presetId: string,
  snapshotName: string,
  params: Record<string, unknown>,
): boolean {
  const old = conn.get(snapshotName);
  const oldColor = old?.color;
  const oldParams = old ? { ...old.params } : undefined;
  const build = (p: Record<string, unknown>) => {
    const overrides: Record<string, unknown> = { ...resolveParams(presetId, p), snapshotName };
    if (oldColor) overrides.series = { color: oldColor };
    return overrides;
  };
  conn.remove(snapshotName);
  if (tryAdd(presetId, build(params))) return true;
  if (oldParams) tryAdd(presetId, build(oldParams));
  return false;
}

// ============================================
// RSI pane for the RSI Divergence signal
// ============================================
//
// Turning RSI Divergence on adds the primary RSI (default RSI(14)) through the
// sidebar when no RSI is mounted, so the mirrored RSI-pane connectors are
// visible. Turning the signal off removes that RSI again only if the signal
// added it and the user has not touched it since; an RSI the user added (or
// edited) stays.

let rsiAddedBySignal = false;

const rsiPane: RsiPaneProvider = {
  acquire() {
    // A sub-pane's id is its indicator's snapshotName.
    const existing = conn.get("rsi") ?? conn.listByPreset("rsi")[0];
    if (existing) return existing.snapshotName;
    sidebarAPI.setPrimaryActive("rsi", true);
    rsiAddedBySignal = true;
    return "rsi";
  },
  release() {
    if (!rsiAddedBySignal) return;
    sidebarAPI.setPrimaryActive("rsi", false);
    rsiAddedBySignal = false;
  },
};

// ============================================
// Mount / unmount
// ============================================

function mount(timeframe: Timeframe, mode: Mode, selection: Selection = EMPTY_SELECTION): void {
  currentTimeframe = timeframe;
  currentMode = mode;
  currentCandles = timeframe === "daily" ? dailyCandles : intradayCandles;

  if (mode === "live") {
    simulator = createLiveSimulator({ candles: currentCandles });
    chart.setCandles(simulator.seedCandles as NormalizedCandle[]);
    conn = connectIndicators(chart, {
      presets: indicatorPresets,
      candles: simulator.seedCandles,
      live: simulator.live,
    });
  } else {
    simulator = null;
    chart.setCandles(currentCandles);
    conn = connectIndicators(chart, { presets: indicatorPresets, candles: currentCandles });
  }

  // Re-add the previous selection on the new connection, keeping each
  // instance's snapshotName (= its sidebar identity) and color.
  // resolveParams re-derives candle-dependent params (anchoredVwap's anchor).
  for (const ind of selection.indicators) {
    const overrides: Record<string, unknown> = {
      ...resolveParams(ind.presetId, ind.params),
      snapshotName: ind.snapshotName,
    };
    if (ind.color) overrides.series = { color: ind.color };
    conn.add(ind.presetId, overrides);
  }

  const scrollSlot = sidebarAPI.getScrollSlot();
  // Live panel goes ABOVE the indicator list and other panels.
  livePanel = createLivePanel(scrollSlot, {
    onModeChange(next) {
      if (next === currentMode) return;
      remount(currentTimeframe, next);
    },
    onReset() {
      // Rebuild the entire live pipeline. simulator.reset() alone would strand
      // the chart at its streamed state and leave conn/livePrimsConn subscribed
      // to the disposed LiveCandle.
      remount(currentTimeframe, "live");
    },
  });
  livePanel.setMode(currentMode);
  // createLivePanel appended its root after the indicator list; move it to
  // the top of the scroll viewport, above the list and the panels below.
  if (scrollSlot.firstChild && scrollSlot.firstChild !== scrollSlot.lastChild) {
    scrollSlot.prepend(scrollSlot.lastChild as Node);
  }
  // Plugins and signals capture the candles they are built from, so they are
  // rebuilt here against the new dataset rather than carried over.
  pluginsPanel = createPluginsPanel(scrollSlot, currentCandles, chart, {
    live: simulator?.live,
    initialActive: selection.plugins,
  });
  signalsPanel = createSignalsPanel(scrollSlot, currentCandles, chart, {
    initialActive: selection.signals,
    rsiPane,
  });
  if (mode === "live" && simulator) {
    livePanel.bindSimulator(simulator);
  }
  chart.fitContent();
}

function unmount(): void {
  signalsPanel?.destroy();
  pluginsPanel?.destroy();
  livePanel?.destroy();
  livePanel = null;
  conn?.disconnect();
  simulator?.dispose();
  simulator = null;
}

/** Rebuild the pipeline for a new timeframe / mode, keeping the selection. */
function remount(timeframe: Timeframe, mode: Mode): void {
  const selection = captureSelection();
  unmount();
  mount(timeframe, mode, selection);
}

/** Resolve special-case params for specific indicators */
function resolveParams(id: string, params: Record<string, unknown>): Record<string, unknown> {
  if (id === "anchoredVwap" && currentCandles.length > 100) {
    return { ...params, anchorTime: currentCandles[100].time };
  }
  return params;
}

mount("daily", "static");

// ============================================
// Toolbar Controls
// ============================================

// Timeframe toggle
const timeframeBtn = document.getElementById("btn-timeframe") as HTMLElement;
timeframeBtn.addEventListener("click", () => {
  const next: Timeframe = currentTimeframe === "daily" ? "intraday" : "daily";
  remount(next, currentMode);
  timeframeBtn.textContent = `Timeframe: ${next === "daily" ? "Daily" : "1H"}`;
});

// Toolbar toggles are labelled "Name: current state".

// Theme toggle
const themeBtn = document.getElementById("btn-theme") as HTMLElement;
let isDark = initialTheme === "dark";
themeBtn.textContent = `Theme: ${isDark ? "Dark" : "Light"}`;
themeBtn.addEventListener("click", () => {
  isDark = !isDark;
  const theme = isDark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  chart.setTheme(theme);
  themeBtn.textContent = `Theme: ${isDark ? "Dark" : "Light"}`;
});

// Chart type cycle
const chartTypes = ["candlestick", "line", "mountain", "ohlc"] as const;
let chartTypeIdx = 0;
const typeBtn = document.getElementById("btn-type") as HTMLElement;
typeBtn.addEventListener("click", () => {
  chartTypeIdx = (chartTypeIdx + 1) % chartTypes.length;
  const t = chartTypes[chartTypeIdx];
  chart.setChartType(t);
  const label =
    t === "candlestick" ? "Candle" : t === "ohlc" ? "OHLC" : t.charAt(0).toUpperCase() + t.slice(1);
  typeBtn.textContent = `Chart: ${label}`;
});

// Fit button
const fitBtn = document.getElementById("btn-fit") as HTMLElement;
fitBtn.addEventListener("click", () => {
  chart.fitContent();
});

// Last-value badges toggle
const badgesBtn = document.getElementById("btn-badges") as HTMLElement;
let badgesOn = false;
badgesBtn.addEventListener("click", () => {
  badgesOn = !badgesOn;
  chart.applyOptions({ showSeriesBadges: badgesOn });
  badgesBtn.textContent = `Badges: ${badgesOn ? "on" : "off"}`;
});

// Badge mode toggle: absolute (live / latest) ⇄ visible (right-edge of viewport)
const badgeModeBtn = document.getElementById("btn-badge-mode") as HTMLElement;
let badgeMode: "absolute" | "visible" = "absolute";
badgeModeBtn.addEventListener("click", () => {
  badgeMode = badgeMode === "absolute" ? "visible" : "absolute";
  chart.applyOptions({ seriesBadgeMode: badgeMode });
  badgeModeBtn.textContent = `Mode: ${badgeMode}`;
});

// Export PNG button — demonstrates toImage() with pane titles composited
const exportBtn = document.getElementById("btn-export") as HTMLElement;
exportBtn.addEventListener("click", async () => {
  try {
    const blob = await chart.toImage("image/png");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed:", err);
    alert(`Export failed: ${(err as Error).message}`);
  }
});

// ============================================
// Responsive sidebar toggle
// ============================================

// The narrow-screen drawer opens below the toolbar, whose height changes as
// its buttons wrap; keep --toolbar-h in sync for the #sidebar `top` offset.
const toolbarEl = document.querySelector(".toolbar") as HTMLElement;
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--toolbar-h", `${toolbarEl.offsetHeight}px`);
}).observe(toolbarEl);

const menuBtn = document.getElementById("btn-menu") as HTMLElement;
menuBtn.addEventListener("click", () => {
  sidebarEl.classList.toggle("open");
});

// Close sidebar when clicking chart on mobile
chartEl.addEventListener("click", () => {
  if (window.innerWidth < 768) {
    sidebarEl.classList.remove("open");
  }
});

// ============================================
// Test hooks (window.__showcase) — for AI-agent / e2e access
// ============================================
//
// Exposes the chart, the live IndicatorConnection, and a few helpers so an
// external driver (agent-browser, Playwright, etc.) can add/remove indicators
// without depending on the sidebar DOM. `conn` is a getter because the
// connection is rebuilt on every mode/timeframe switch.

declare global {
  interface Window {
    __showcase?: {
      chart: typeof chart;
      readonly conn: IndicatorConnection | null;
      add(id: string, params?: Record<string, unknown>): void;
      remove(id: string): void;
      list(): string[];
    };
  }
}

window.__showcase = {
  chart,
  get conn() {
    return conn;
  },
  add(id, params = {}) {
    if (!conn) throw new Error("connection not ready");
    // Mirror the sidebar's "primary instance" behavior: snapshotName is
    // pinned to the preset id, so calling add() while one is already
    // active replaces it (same as toggling params from the sidebar UI).
    // Without this, connectIndicators rejects the duplicate snapshotName.
    conn.remove(id);
    conn.add(id, { ...resolveParams(id, params), snapshotName: id });
  },
  remove(id) {
    conn?.remove(id);
  },
  list() {
    return conn ? conn.list().map((c) => c.snapshotName) : [];
  },
};
