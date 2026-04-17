/**
 * Auto-detection showcase — every indicator resolves its own pane and shape.
 * Five `addIndicator()` calls, five distinct visual types, zero config:
 *   - SMA 20         → scalar line (overlay)
 *   - Bollinger      → band with fill (overlay)
 *   - RSI 14         → oscillator with reference lines (sub-pane)
 *   - Stochastics    → dual-line oscillator %K / %D (sub-pane)
 *   - MACD           → histogram + 2 lines (sub-pane)
 */

import { createChart } from "@trendcraft/chart";
import type { CandleData } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { bollingerBands, macd, rsi, sma, stochastics } from "trendcraft";

export function run(stage: HTMLElement, candles: CandleData[]): void {
  const chart = createChart(stage, {
    theme: "dark",
    animationDuration: 0,
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
  });
  registerTrendCraftPresets(chart);

  chart.setCandles(candles);

  chart.addIndicator(sma(candles, { period: 20 }));
  chart.addIndicator(bollingerBands(candles, { period: 20, stdDev: 2 }));
  chart.addIndicator(rsi(candles, { period: 14 }));
  chart.addIndicator(stochastics(candles));
  chart.addIndicator(macd(candles));

  chart.fitContent();
}
