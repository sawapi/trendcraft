/**
 * Backtest visualization — runs a simple strategy on NVDA and hands the
 * result to chart.addBacktest(). Trade markers + equity curve + summary
 * come out without any extra wiring.
 */

import { createChart } from "@trendcraft/chart";
import type { CandleData } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import { deadCrossCondition, goldenCrossCondition, runBacktest, sma } from "trendcraft";

export function run(stage: HTMLElement, candles: CandleData[]): void {
  const chart = createChart(stage, {
    theme: "dark",
    animationDuration: 0,
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
  });
  registerTrendCraftPresets(chart);

  chart.setCandles(candles);
  chart.addIndicator(sma(candles, { period: 20 }));
  chart.addIndicator(sma(candles, { period: 50 }));

  const result = runBacktest(candles, goldenCrossCondition(20, 50), deadCrossCondition(20, 50), {
    capital: 100_000,
    stopLoss: 5,
    takeProfit: 15,
  });

  // runBacktest returns a structurally-compatible BacktestResultData shape
  chart.addBacktest(result as unknown as Parameters<typeof chart.addBacktest>[0]);
  chart.fitContent();
}
