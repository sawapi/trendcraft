/**
 * GUIDE hero: an SMA 5/20/60 ribbon plus RSI and MACD panes, for docs pages
 * that want the full indicator stack (hero.ts keeps the README hero to
 * Bollinger Bands + SMA 50).
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
  conn.add("sma", { period: 5 });
  conn.add("sma", { period: 20 });
  conn.add("sma", { period: 60 });
  conn.add("rsi", { period: 14 });
  conn.add("macd");

  // Indicators run on the full history (so warm-up stays off screen), but only
  // the last year is shown: four years at docs width blur into a band.
  // setVisibleRangeByDuration ends at the live edge, so the newest bar stays
  // clear of the price axis.
  chart.setVisibleRangeByDuration("1Y");
}
