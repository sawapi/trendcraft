/**
 * Indicator Showcase — Main Entry
 *
 * Demonstrates every preset available in `indicatorPresets` (96 as of 2026-04-18)
 * with a categorized sidebar UI, search, parameter controls, and active indicator
 * bar. The sidebar is auto-generated from indicatorPresets metadata, so the count
 * stays accurate as the preset registry grows.
 *
 * A Daily / 1H timeframe toggle swaps between the bundled daily sample data and
 * a synthetic intraday dataset (see `data-intraday.ts`) so intraday-only plugins
 * such as Session Zones can be demo'd meaningfully.
 */

import { type IndicatorConnection, connectIndicators, createChart } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { indicatorPresets } from "trendcraft";
import type { NormalizedCandle } from "trendcraft";
import dailySampleData from "../../simple-chart/data.json";
import { generateIntradayCandles } from "./data-intraday";
import { type LivePanelHandle, type Mode, createLivePanel } from "./live-panel";
import { type SimulatorHandle, createLiveSimulator } from "./live-simulator";
import { type PluginsPanelHandle, createPluginsPanel } from "./plugins-panel";
import type { SidebarEntry } from "./sidebar";
import { createSidebar } from "./sidebar";
import { type SignalsPanelHandle, createSignalsPanel } from "./signals-panel";

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
const chart = createChart(chartEl, { theme: "dark" });
registerTrendCraftPresets(chart);

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

function mount(timeframe: Timeframe, mode: Mode): void {
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

  // Sidebar is rebuilt from scratch — its DOM/state are reset by createSidebar.
  // We still need to wipe the container because the plugins panel is a sibling
  // appended below it.
  sidebarEl.innerHTML = "";

  const sidebarAPI = createSidebar(sidebarEl, catalog, {
    onToggle(id, active, params) {
      if (active) {
        const finalParams = resolveParams(id, params);
        // Force the primary's snapshotName = presetId so editing params
        // later removes just this instance (not every SMA, etc.).
        conn.add(id, { ...finalParams, snapshotName: id });
      } else {
        conn.remove(id);
      }
    },
    onParamChange(id, params) {
      // Preserve the current color across the remove+add round-trip so
      // editing a period in the active-bar pill doesn't re-roll the palette
      // and hand the same instance a different color mid-session.
      const oldColor = conn.get(id)?.color;
      conn.remove(id);
      const finalParams = resolveParams(id, params);
      const overrides: Record<string, unknown> = { ...finalParams, snapshotName: id };
      if (oldColor) overrides.series = { color: oldColor };
      conn.add(id, overrides);
    },
    onAddExtra({ presetId, snapshotName, params }) {
      const finalParams = resolveParams(presetId, params);
      conn.add(presetId, { ...finalParams, snapshotName });
    },
    onRemoveExtra(snapshotName) {
      conn.remove(snapshotName);
    },
    onChangeExtraParams({ presetId, snapshotName, params }) {
      const oldColor = conn.get(snapshotName)?.color;
      conn.remove(snapshotName);
      const finalParams = resolveParams(presetId, params);
      const overrides: Record<string, unknown> = { ...finalParams, snapshotName };
      if (oldColor) overrides.series = { color: oldColor };
      conn.add(presetId, overrides);
    },
  });

  const scrollSlot = sidebarAPI.getScrollSlot();
  // Live panel goes ABOVE the indicator list and other panels (mounted before
  // the scroll slot's existing children so it's always visible at the top).
  livePanel = createLivePanel(scrollSlot, {
    onModeChange(next) {
      if (next === currentMode) return;
      const tf = currentTimeframe;
      unmount();
      mount(tf, next);
    },
    onReset() {
      // Rebuild the entire live pipeline. simulator.reset() alone would strand
      // the chart at its streamed state and leave conn/livePrimsConn subscribed
      // to the disposed LiveCandle.
      const tf = currentTimeframe;
      unmount();
      mount(tf, "live");
    },
  });
  livePanel.setMode(currentMode);
  // Re-attach the live panel root as the first child of scrollSlot so it sits
  // above the (later-appended) plugins / signals panels and the indicator list.
  // (The list itself was inserted before the panel was created, so prepending
  // here puts the live panel at the top of the scroll viewport.)
  if (scrollSlot.firstChild && scrollSlot.firstChild !== scrollSlot.lastChild) {
    scrollSlot.prepend(scrollSlot.lastChild as Node);
  }
  pluginsPanel = createPluginsPanel(scrollSlot, currentCandles, chart, {
    live: simulator?.live,
  });
  signalsPanel = createSignalsPanel(scrollSlot, currentCandles, chart);
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
  const mode = currentMode;
  unmount();
  mount(next, mode);
  timeframeBtn.textContent = next === "daily" ? "Daily" : "1H";
});

// Theme toggle
const themeBtn = document.getElementById("btn-theme") as HTMLElement;
let isDark = true;
themeBtn.addEventListener("click", () => {
  isDark = !isDark;
  chart.setTheme(isDark ? "dark" : "light");
  themeBtn.textContent = isDark ? "Light" : "Dark";
  document.body.style.background = isDark ? "#131722" : "#ffffff";
});

// Chart type cycle
const chartTypes = ["candlestick", "line", "mountain", "ohlc"] as const;
let chartTypeIdx = 0;
const typeBtn = document.getElementById("btn-type") as HTMLElement;
typeBtn.addEventListener("click", () => {
  chartTypeIdx = (chartTypeIdx + 1) % chartTypes.length;
  const t = chartTypes[chartTypeIdx];
  chart.setChartType(t);
  typeBtn.textContent =
    t === "candlestick" ? "Candle" : t === "ohlc" ? "OHLC" : t.charAt(0).toUpperCase() + t.slice(1);
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
