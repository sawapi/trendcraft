<!--
  Minimal example of `useTrendChart` — the composable-based entry point.

  Demonstrates the imperative pattern: take the live ChartInstance from
  `chart.value` in a watchEffect and drive it from your own code. Same
  chart, different entry point than the <TrendChart> component in App.vue.

  Shown by the "Hook" tab in the demo header (see App.vue).
-->

<script setup lang="ts">
import { registerDrawingTools } from "@trendcraft/chart/features";
import { useTrendChart } from "@trendcraft/chart/vue";
import { sma } from "trendcraft";
import { ref, watchEffect } from "vue";
import sampleData from "../../simple-chart/data.json";

const props = defineProps<{ theme: "dark" | "light" }>();

const candles = sampleData.slice(0, 200);
const indicators = [sma(candles, { period: 20 })];

// biome-ignore lint/correctness/noUnusedVariables: bound to template via `ref="containerRef"` — Biome can't see the .vue template usage.
const { containerRef, chart } = useTrendChart({
  candles,
  indicators,
  theme: () => props.theme,
  options: { watermark: "HOOK" },
  features: [registerDrawingTools],
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
  <div class="hook-demo">
    <div class="hook-demo-info">
      useTrendChart demo — click the chart to place a horizontal line ·
      <span class="muted">last:</span> {{ lastEvent }}
    </div>
    <div ref="containerRef" style="flex: 1; min-height: 0" />
  </div>
</template>
