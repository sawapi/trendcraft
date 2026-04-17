/**
 * Hero screenshot — NVDA daily (4y) with a 3-SMA ribbon.
 * Base: mountain — reads better than candles at 1000+ bar density and
 * gives the library a clean, modern first impression.
 *
 * Indicators are registered via connectIndicators so each SMA gets its
 * own label (SMA(5), SMA(20), SMA(60)) and an auto-cycled color.
 */

import { connectIndicators, createChart } from "@trendcraft/chart";
import type { CandleData } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { indicatorPresets } from "trendcraft";

export function run(stage: HTMLElement, candles: CandleData[]): void {
  const chart = createChart(stage, {
    theme: "dark",
    animationDuration: 0,
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    chartType: "mountain",
  });
  registerTrendCraftPresets(chart);
  chart.setCandles(candles);

  const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
  // Core v0.2.0+ emits parameterized labels and the chart auto-cycles colors
  // across multi-instance presets, so no manual overrides are needed here.
  conn.add("sma", { period: 5 });
  conn.add("sma", { period: 20 });
  conn.add("sma", { period: 60 });
  conn.add("rsi", { period: 14 });
  conn.add("macd");

  chart.fitContent();
}
