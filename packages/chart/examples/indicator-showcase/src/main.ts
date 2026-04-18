/**
 * Indicator Showcase — Main Entry
 *
 * Demonstrates every preset available in `indicatorPresets` (96 as of 2026-04-18)
 * with a categorized sidebar UI, search, parameter controls, and active indicator
 * bar. The sidebar is auto-generated from indicatorPresets metadata, so the count
 * stays accurate as the preset registry grows.
 */

import { connectIndicators, createChart } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { indicatorPresets } from "trendcraft";
import type { NormalizedCandle } from "trendcraft";
import sampleData from "../../simple-chart/data.json";
import { createPluginsPanel } from "./plugins-panel";
import type { SidebarEntry } from "./sidebar";
import { createSidebar } from "./sidebar";

// ============================================
// Data
// ============================================

const candles = sampleData as NormalizedCandle[];

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
const chart = createChart(chartEl, { theme: "dark" });
registerTrendCraftPresets(chart);
chart.setCandles(candles);

// ============================================
// Indicator Connection
// ============================================

const conn = connectIndicators(chart, { presets: indicatorPresets, candles });

// ============================================
// Sidebar
// ============================================

const sidebarEl = document.getElementById("sidebar") as HTMLElement;

const sidebar = createSidebar(sidebarEl, catalog, {
  onToggle(id, active, params) {
    if (active) {
      const finalParams = resolveParams(id, params);
      conn.add(id, finalParams);
    } else {
      conn.remove(id);
    }
  },
  onParamChange(id, params) {
    conn.remove(id);
    const finalParams = resolveParams(id, params);
    conn.add(id, finalParams);
  },
});

/** Resolve special-case params for specific indicators */
function resolveParams(id: string, params: Record<string, unknown>): Record<string, unknown> {
  if (id === "anchoredVwap" && candles.length > 100) {
    return { ...params, anchorTime: candles[100].time };
  }
  return params;
}

// ============================================
// Toolbar Controls
// ============================================

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

// Plugins panel (appended below the indicator list)
createPluginsPanel(sidebarEl, candles, chart);

// Suppress unused variable warning
void sidebar;
