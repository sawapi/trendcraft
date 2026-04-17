/**
 * Plugin showcase — HMM regime heatmap as a background band.
 * Shows how plugins produce a visually distinctive layer you wouldn't
 * get from stock charting libraries.
 */

import { connectRegimeHeatmap, createChart } from "@trendcraft/chart";
import type { CandleData } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { hmmRegimes, sma } from "trendcraft";

export function run(stage: HTMLElement, candles: CandleData[]): void {
  const chart = createChart(stage, {
    theme: "dark",
    animationDuration: 0,
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
  });
  registerTrendCraftPresets(chart);

  chart.setCandles(candles);
  chart.addIndicator(sma(candles, { period: 20 }));

  // HMM regime classification — paints background by detected regime.
  const regimes = hmmRegimes(candles, { numStates: 3 });
  connectRegimeHeatmap(chart, regimes);

  chart.fitContent();
}
