/**
 * Indicator Showcase — Main Entry
 *
 * Demonstrates all 77 indicators available in indicatorPresets
 * with a categorized sidebar UI and parameter controls.
 */

import { connectIndicators, createChart } from "@trendcraft/chart";
import { indicatorPresets } from "trendcraft";
import type { NormalizedCandle } from "trendcraft";
import sampleData from "../../simple-chart/data.json";
import { CATALOG } from "./indicator-catalog";
import { createSidebar } from "./sidebar";

// ============================================
// Data
// ============================================

const candles = sampleData as NormalizedCandle[];

// ============================================
// Chart
// ============================================

const chartEl = document.getElementById("chart") as HTMLElement;
const chart = createChart(chartEl, { theme: "dark" });
chart.setCandles(candles);

// ============================================
// Indicator Connection
// ============================================

const conn = connectIndicators(chart, { presets: indicatorPresets, candles });

// ============================================
// Sidebar
// ============================================

const sidebarEl = document.getElementById("sidebar") as HTMLElement;

const sidebar = createSidebar(sidebarEl, CATALOG, {
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

// Suppress unused variable warning
void sidebar;

// ============================================
// Default state — start clean, user clicks to add
// ============================================
