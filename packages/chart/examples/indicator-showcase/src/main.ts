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
let currentCandles: NormalizedCandle[] = dailyCandles;
let conn: IndicatorConnection;
let pluginsPanel: PluginsPanelHandle;
let signalsPanel: SignalsPanelHandle;

function mount(timeframe: Timeframe): void {
  currentTimeframe = timeframe;
  currentCandles = timeframe === "daily" ? dailyCandles : intradayCandles;

  chart.setCandles(currentCandles);
  conn = connectIndicators(chart, { presets: indicatorPresets, candles: currentCandles });

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
  pluginsPanel = createPluginsPanel(scrollSlot, currentCandles, chart);
  signalsPanel = createSignalsPanel(scrollSlot, currentCandles, chart);
  chart.fitContent();
}

function unmount(): void {
  signalsPanel?.destroy();
  pluginsPanel?.destroy();
  conn?.disconnect();
}

/** Resolve special-case params for specific indicators */
function resolveParams(id: string, params: Record<string, unknown>): Record<string, unknown> {
  if (id === "anchoredVwap" && currentCandles.length > 100) {
    return { ...params, anchorTime: currentCandles[100].time };
  }
  return params;
}

mount("daily");

// ============================================
// Toolbar Controls
// ============================================

// Timeframe toggle
const timeframeBtn = document.getElementById("btn-timeframe") as HTMLElement;
timeframeBtn.addEventListener("click", () => {
  const next: Timeframe = currentTimeframe === "daily" ? "intraday" : "daily";
  unmount();
  mount(next);
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
