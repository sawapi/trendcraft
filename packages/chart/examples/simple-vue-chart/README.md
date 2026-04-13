# simple-vue-chart

Vue 3 demo for `@trendcraft/chart/vue`.

## Setup

```bash
cd packages/chart/examples/simple-vue-chart
pnpm install --ignore-workspace
pnpm dev
```

## Features

- `<TrendChart>` component with reactive props (`App.vue`)
- `useTrendChart` composable with imperative effects (`src/HookDemo.vue`)
- SMA, BB, RSI, MACD toggles via Vue refs
- Backtest result as computed prop
- Dark/Light theme switch

## When to pick each API

- **`<TrendChart>` component** — drop-in chart, all features as props.
- **`useTrendChart` composable** — returns `{ containerRef, chart }`. `chart` is a `ShallowRef<ChartInstance | null>`, so it composes cleanly with `watch` / `watchEffect` for drawing tools, live feeds, and custom plugins.

```vue
<script setup lang="ts">
import { watchEffect } from 'vue';
import { useTrendChart } from '@trendcraft/chart/vue';

const { containerRef, chart } = useTrendChart({ candles });

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
