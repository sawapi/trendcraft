/**
 * Hero screenshot — a clean, legible candlestick beauty shot.
 *
 * Deliberately minimal: the last six months so individual candles read as
 * candles (not a blur), one Bollinger Bands envelope, and a single SMA(50)
 * trend line. Volume sits in its own pane by default. The busy multi-pane
 * indicator story (RSI + MACD + ribbon) lives in the hero-candle scene —
 * the hero is the first impression, so it stays uncluttered.
 */

import type { CandleData } from "@trendcraft/chart";
import { connectIndicators, createChart } from "@trendcraft/chart";
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
  // One cohesive overlay (band) + one trend line keeps the price pane calm.
  // Keys are the canonical `indicatorPresets` ids (`bb`, not the `bollingerBands` alias).
  conn.add("bb");
  conn.add("sma", { period: 50 });

  // Indicators run on the full history (so warm-up stays off screen); only a
  // recent window is shown so candles stay readable at README width.
  chart.setVisibleRangeByDuration("6M");
}
