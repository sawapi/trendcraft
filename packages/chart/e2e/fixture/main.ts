/**
 * E2E fixture page.
 *
 * Mounts one chart built from the package source (not dist) with
 * deterministic candles, and exposes it on `window.__tc` so specs can drive
 * the public API and read state back. `?bars=N` sets the candle count,
 * `?volume=0` hides the volume pane, and `?sessionGaps=1` turns on the
 * time-proportional layout (which also switches intraday data to the
 * two-row time axis).
 */

import type { CandleData, ChartInstance } from "../../src/index";
import { createChart } from "../../src/index";

declare global {
  interface Window {
    __tc: {
      chart: ChartInstance;
      candles: CandleData[];
      events: Array<{ type: string; data: unknown }>;
      ready: boolean;
    };
  }
}

const DAY = 86_400_000;

/** Deterministic random walk so pixels and ranges are reproducible. */
function makeCandles(n: number): CandleData[] {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const out: CandleData[] = [];
  let close = 100;
  for (let i = 0; i < n; i++) {
    const open = close;
    close = Math.max(1, open * (1 + (rand() - 0.5) * 0.04));
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);
    out.push({
      time: Date.UTC(2024, 0, 1) + i * DAY,
      open,
      high,
      low,
      close,
      volume: Math.round(1_000_000 * (0.5 + rand())),
    });
  }
  return out;
}

const params = new URLSearchParams(location.search);
const bars = Number(params.get("bars") ?? 300);
const candles = makeCandles(bars);
const container = document.getElementById("chart") as HTMLElement;
const chart = createChart(container, {
  volume: params.get("volume") !== "0",
  timeScale: { sessionGaps: params.get("sessionGaps") === "1" },
});
chart.setCandles(candles);

const events: Array<{ type: string; data: unknown }> = [];
for (const type of ["visibleRangeChange", "crosshairMove", "click"] as const) {
  chart.on(type, (data) => events.push({ type, data }));
}

window.__tc = { chart, candles, events, ready: false };
// Two frames: the first paints, the second guarantees layout has settled.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    window.__tc.ready = true;
  }),
);
