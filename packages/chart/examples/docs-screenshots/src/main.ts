/**
 * Screenshot playground scene dispatcher.
 * URL: ?scene=<id> — see scenes/ for available ids.
 * Sets window.__chartReady = true when the chart is fully painted.
 */

import type { CandleData } from "@trendcraft/chart";
import data from "../data/nvda-1day.json";

import { run as runAutoDetection } from "./scenes/auto-detection";
import { run as runBacktest } from "./scenes/backtest";
import { run as runChartTypes } from "./scenes/chart-types";
import { run as runHero } from "./scenes/hero";
import { run as runHeroCandle } from "./scenes/hero-candle";
import { run as runPluginRegime } from "./scenes/plugin-regime";

const candles = data as CandleData[];

type Scene = {
  id: string;
  label: string;
  run: (stage: HTMLElement, candles: CandleData[]) => Promise<void> | void;
};

const SCENES: Scene[] = [
  { id: "hero", label: "Hero mountain (SMA 5/20/60 + RSI + MACD)", run: runHero },
  { id: "hero-candle", label: "Hero candlestick variant", run: runHeroCandle },
  { id: "auto-detection", label: "Auto-detection (5 shapes)", run: runAutoDetection },
  { id: "chart-types", label: "Chart types (candle/line/mountain/ohlc)", run: runChartTypes },
  { id: "plugin-regime", label: "Plugin showcase: regime heatmap", run: runPluginRegime },
  { id: "backtest", label: "Backtest visualization", run: runBacktest },
];

const stage = document.getElementById("stage");
if (!stage) throw new Error("#stage not found");

const params = new URLSearchParams(location.search);
const requested = params.get("scene") ?? "hero";
const scene = SCENES.find((s) => s.id === requested);

if (!scene) {
  stage.innerHTML = `
    <div style="padding:24px;font-family:inherit">
      <h1 style="font-size:16px;margin-bottom:12px">Unknown scene: <code>${requested}</code></h1>
      <p style="font-size:13px;color:#999;margin-bottom:12px">Available scenes:</p>
      <ul style="font-size:13px;line-height:1.8;list-style:none">
        ${SCENES.map(
          (s) => `<li><a style="color:#4fc3f7" href="?scene=${s.id}">${s.id}</a> — ${s.label}</li>`,
        ).join("")}
      </ul>
    </div>
  `;
} else {
  Promise.resolve(scene.run(stage, candles))
    .then(() => {
      // Give one animation frame for the initial render to settle,
      // then signal readiness for the screenshot capture script.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          (window as unknown as { __chartReady: boolean }).__chartReady = true;
        });
      });
    })
    .catch((err) => {
      stage.innerHTML = `
        <pre style="color:#ef5350;padding:24px;white-space:pre-wrap">
Scene "${scene.id}" failed:
${err?.stack ?? err}
</pre>`;
    });
}
