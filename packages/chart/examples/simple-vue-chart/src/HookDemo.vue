<!--
  Minimal example of `useTrendChart` — the composable-based entry point.

  Demonstrates the imperative pattern: take the live ChartInstance from
  `chart.value` in a watchEffect and drive it from your own code. Same
  chart, different entry point than the <TrendChart> component in App.vue.

  Not mounted by default — import this component from main.ts to see it
  running, or copy the pattern into your own app.
-->

<script setup lang="ts">
import { useTrendChart } from "@trendcraft/chart/vue";
import { sma } from "trendcraft";
import { ref, watchEffect } from "vue";
import sampleData from "../../simple-chart/data.json";

const candles = sampleData.slice(0, 200);
const indicators = [sma(candles, { period: 20 })];

const { containerRef, chart } = useTrendChart({
  candles,
  indicators,
  theme: "dark",
  options: { watermark: "HOOK" },
});

const lastEvent = ref("—");

// Imperative hookups live here: drawing tool, live feed, custom plugins, etc.
watchEffect((onCleanup) => {
  const c = chart.value;
  if (!c) return;

  c.setDrawingTool("hline");

  const onDrawing = (d: unknown) => {
    lastEvent.value = `drawingComplete ${JSON.stringify(d).slice(0, 80)}`;
  };
  c.on("drawingComplete", onDrawing);

  onCleanup(() => {
    c.off("drawingComplete", onDrawing);
    c.setDrawingTool(null);
  });
});
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div
      style="
        padding: 8px;
        background: #1e222d;
        color: #d1d4dc;
        font-size: 12px;
        font-family: monospace;
      "
    >
      useTrendChart demo — click chart to place horizontal line · last: {{ lastEvent }}
    </div>
    <div ref="containerRef" style="flex: 1; min-height: 0" />
  </div>
</template>
