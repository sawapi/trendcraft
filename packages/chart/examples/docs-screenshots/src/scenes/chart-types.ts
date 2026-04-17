/**
 * Chart types grid — 2x2: candlestick / line / mountain / ohlc.
 * Same NVDA dataset across all four panels so differences are visually obvious.
 */

import { createChart } from "@trendcraft/chart";
import type { CandleData, ChartType } from "@trendcraft/chart";

const TYPES: { type: ChartType; label: string }[] = [
  { type: "candlestick", label: "candlestick" },
  { type: "line", label: "line" },
  { type: "mountain", label: "mountain" },
  { type: "ohlc", label: "ohlc" },
];

export function run(stage: HTMLElement, candles: CandleData[]): void {
  stage.style.display = "grid";
  stage.style.gridTemplateColumns = "1fr 1fr";
  stage.style.gridTemplateRows = "1fr 1fr";
  stage.style.gap = "12px";
  stage.style.padding = "12px";

  for (const { type, label } of TYPES) {
    const cell = document.createElement("div");
    cell.style.position = "relative";
    cell.style.overflow = "hidden";
    cell.style.border = "1px solid #2a2e39";
    cell.style.borderRadius = "4px";

    const tag = document.createElement("div");
    tag.textContent = label;
    tag.style.cssText = `
      position: absolute;
      top: 8px; left: 12px;
      z-index: 10;
      font-size: 11px;
      color: #d1d4dc;
      background: rgba(19,23,34,0.75);
      padding: 3px 8px;
      border-radius: 3px;
      font-family: "Helvetica Neue", Arial, sans-serif;
    `;

    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";

    cell.appendChild(host);
    cell.appendChild(tag);
    stage.appendChild(cell);

    const chart = createChart(host, {
      theme: "dark",
      animationDuration: 0,
      fontFamily: '"Helvetica Neue", Arial, sans-serif',
      chartType: type,
      legend: false,
      volume: false,
    });
    chart.setCandles(candles);
    chart.fitContent();
  }
}
