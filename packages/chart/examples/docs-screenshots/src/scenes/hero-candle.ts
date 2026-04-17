/**
 * Candlestick-based hero variant, for docs pages that want the trader
 * signal rather than the cleaner mountain base.
 * Same indicator stack as hero.ts.
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
    chartType: "candlestick",
  });
  registerTrendCraftPresets(chart);
  chart.setCandles(candles);

  const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
  conn.add("sma", { period: 5, series: { color: "#EF5350" } });
  conn.add("sma", { period: 20, series: { color: "#FFC107" } });
  conn.add("sma", { period: 60, series: { color: "#9C27B0" } });
  conn.add("rsi", { period: 14 });
  conn.add("macd");

  chart.fitContent();
}
