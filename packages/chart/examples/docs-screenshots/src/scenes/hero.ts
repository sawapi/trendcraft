/**
 * Hero screenshot — a clean, legible candlestick beauty shot.
 *
 * Deliberately minimal: a recent ~170-bar window so individual candles read
 * as candles (not a blur), one Bollinger Bands envelope, and a single SMA(50)
 * trend line. Volume sits in its own pane by default. The busy multi-pane
 * indicator story (RSI + MACD + ribbon) lives in the auto-detection scene —
 * the hero is the first impression, so it stays uncluttered.
 */

import type { CandleData } from "@trendcraft/chart";
import { connectIndicators, createChart } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { indicatorPresets } from "trendcraft";

export function run(stage: HTMLElement, candles: CandleData[]): void {
  // Show a recent window so candles are readable at hero width instead of
  // collapsing into a fuzzy band of 1000+ thin wicks.
  const recent = candles.slice(-170);

  const chart = createChart(stage, {
    theme: "dark",
    animationDuration: 0,
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    chartType: "candlestick",
  });
  registerTrendCraftPresets(chart);
  chart.setCandles(recent);

  const conn = connectIndicators(chart, { presets: indicatorPresets, candles: recent });
  // One cohesive overlay (band) + one trend line keeps the price pane calm.
  // Keys are the canonical `indicatorPresets` ids (`bb`, not the `bollingerBands` alias).
  conn.add("bb");
  conn.add("sma", { period: 50 });

  chart.fitContent();
}
