# simple-vue-chart

Vue 3 demo for `@trendcraft/chart/vue`.

## Setup

```bash
cd packages/chart/examples/simple-vue-chart
pnpm install --ignore-workspace
pnpm dev
```

`pnpm dev` works on its own: Vite serves `trendcraft` and `@trendcraft/chart` straight from their sources. `pnpm build` also typechecks those sources, which needs the workspace's type packages, so install the workspace once first (`pnpm install --frozen-lockfile` at the repo root).

## Features

The header has two tabs, one per API:

- **Component** — `<TrendChart>` with reactive props (`src/App.vue`)
- **Hook** — `useTrendChart` composable with imperative effects (`src/HookDemo.vue`): click the chart to place a horizontal line and watch the `drawingComplete` event

The Component tab shows:

- SMA, BB, RSI, MACD toggles via Vue refs
- A golden-cross / dead-cross backtest as a computed prop; turning it off sets the prop back to `undefined`, which clears the markers and the equity pane
- Custom renderers and primitives passed through the wrapper's `plugins` prop:
  - **S/R Zones** — a primitive (`definePrimitive`) that shades support/resistance bands behind the candles
  - **Trail Stop** — a custom series renderer (`defineSeriesRenderer`) that draws an ATR trailing stop as a stepped line on the price pane; the indicator entry selects it with `config: { type: "trailingStop", pane: "main" }`
- **Vol Overlay** — an indicator entry with its own `config` (`pane: "main"`, `scaleId: "left"`, `maxHeightRatio`) that draws volume along the bottom of the price pane instead of in its own pane
- Dark/Light theme switch (the initial theme follows `prefers-color-scheme`), applied to both tabs through the `theme` prop

## When to pick each API

- **`<TrendChart>` component** — drop-in chart, all features as props.
- **`useTrendChart` composable** — returns `{ containerRef, chart }`. `chart` is a `ShallowRef<ChartInstance | null>`, so it composes cleanly with `watch` / `watchEffect` for drawing tools, live feeds, and custom plugins.

```vue
<script setup lang="ts">
import { watchEffect } from 'vue';
import { registerDrawingTools } from '@trendcraft/chart/features';
import { useTrendChart } from '@trendcraft/chart/vue';

const { containerRef, chart } = useTrendChart({ candles, features: [registerDrawingTools] });

watchEffect((onCleanup) => {
  if (!chart.value) return;
  chart.value.setDrawingTool('hline');
  const off = (d) => console.log('drawing:', d);
  chart.value.on('drawingComplete', off);
  onCleanup(() => chart.value?.off('drawingComplete', off));
});
</script>

<template>
  <div ref="containerRef" style="width: 100%; height: 400px" />
</template>
```

> **NOTE:** `chart` is a `shallowRef` — do not wrap it in `ref()`. Vue's deep-reactivity proxy corrupts the chart's internal state.

## Requirements

- Vue 3.3+
