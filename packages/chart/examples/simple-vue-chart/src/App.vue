<script setup lang="ts">
import { definePrimitive, defineSeriesRenderer } from "@trendcraft/chart";
import { registerBacktest } from "@trendcraft/chart/features";
// biome-ignore lint/correctness/noUnusedImports: used as <TrendChart> in the .vue template — Biome can't see template usage.
import { TrendChart } from "@trendcraft/chart/vue";
import {
  bollingerBands,
  deadCrossCondition,
  goldenCrossCondition,
  macd,
  normalizeCandles,
  rsi,
  runBacktest,
  sma,
} from "trendcraft";
import { computed, ref } from "vue";
import sampleData from "../../simple-chart/data.json";
// biome-ignore lint/correctness/noUnusedImports: used as <HookDemo> in the .vue template — Biome can't see template usage.
import HookDemo from "./HookDemo.vue";

const candles = sampleData;
const showSma = ref(true);
const showBb = ref(false);
const showRsi = ref(false);
const showMacd = ref(false);
const showBacktest = ref(false);
const showSrZones = ref(false);
const showTrail = ref(false);
const showVolOverlay = ref(false);
// index.html sets the initial theme from prefers-color-scheme before first paint.
const theme = ref<"dark" | "light">(
  document.documentElement.dataset.theme === "light" ? "light" : "dark",
);
// biome-ignore lint/correctness/noUnusedVariables: bound to template via `view === ...` — Biome can't see the .vue template usage.
const view = ref<"component" | "hook">("component");

// --- Plugin: S/R Zone Primitive ---
// Support and resistance bands around the high and low of the last 60 bars
function srZones(): { price: number; height: number; color: string }[] {
  const recent = sampleData.slice(-60);
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  for (const c of recent) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  const h = (high - low) * 0.1;
  return [
    { price: high, height: h, color: "rgba(239,83,80,0.2)" },
    { price: low, height: h, color: "rgba(38,166,154,0.2)" },
  ];
}

const srZonePrimitive = definePrimitive({
  name: "srZones",
  pane: "main",
  zOrder: "below",
  // The sample data never changes, so the zones are worked out once here
  defaultState: { zones: srZones() },
  render: ({ draw }, state) => {
    for (const zone of state.zones) {
      draw.rect(
        draw.startIndex,
        zone.price + zone.height / 2,
        draw.endIndex - draw.startIndex,
        zone.price - zone.height / 2,
        { color: zone.color },
      );
    }
  },
});

// --- Plugin: Trailing Stop Renderer ---
const trailRenderer = defineSeriesRenderer({
  type: "trailingStop",
  render: ({ draw, series }) => {
    draw.scope((ctx) => {
      ctx.strokeStyle = series.config.color ?? "#FF9800";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      let moved = false;
      for (let i = draw.startIndex; i < draw.endIndex && i < series.data.length; i++) {
        const val = series.data[i]?.value as number | null;
        if (val === null || val === undefined) continue;
        if (!moved) {
          ctx.moveTo(draw.x(i), draw.y(val));
          moved = true;
        } else {
          const prev = (series.data[i - 1]?.value as number) ?? val;
          ctx.lineTo(draw.x(i), draw.y(prev));
          ctx.lineTo(draw.x(i), draw.y(val));
        }
      }
      ctx.stroke();
    });
  },
  priceRange: (series, start, end) => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = start; i <= end && i < series.data.length; i++) {
      const v = series.data[i]?.value as number | null;
      if (v != null) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return [min, max];
  },
  formatValue: (series, index) => {
    const v = series.data[index]?.value as number | null;
    return v != null ? `Trail: ${v.toFixed(2)}` : null;
  },
});

function computeTrailingStop() {
  const period = 20;
  const atrPeriod = 14;
  return candles.map((c, i) => {
    if (i < Math.max(period, atrPeriod)) return { time: c.time, value: null };
    let hh = Number.NEGATIVE_INFINITY;
    for (let j = i - period + 1; j <= i; j++) if (candles[j].high > hh) hh = candles[j].high;
    let atrSum = 0;
    for (let j = i - atrPeriod + 1; j <= i; j++) {
      atrSum += Math.max(
        candles[j].high - candles[j].low,
        Math.abs(candles[j].high - candles[j - 1].close),
        Math.abs(candles[j].low - candles[j - 1].close),
      );
    }
    return { time: c.time, value: hh - 2 * (atrSum / atrPeriod) };
  });
}

// biome-ignore lint/correctness/noUnusedVariables: bound to template via `:indicators` — Biome can't see the .vue template usage.
const indicators = computed(() => {
  const list: (
    | { time: number; value: unknown }[]
    | {
        data: { time: number; value: unknown }[];
        config: import("@trendcraft/chart").SeriesConfig;
      }
  )[] = [];
  if (showSma.value) {
    // A colour that stands apart from the Bollinger Bands' blue
    list.push({ data: sma(candles, { period: 50 }), config: { color: "#ab47bc" } });
  }
  if (showBb.value) list.push(bollingerBands(candles));
  if (showRsi.value) list.push(rsi(candles));
  if (showMacd.value) list.push(macd(candles));
  if (showTrail.value) {
    // `type: "trailingStop"` routes the series to the custom renderer passed via `plugins`.
    list.push({
      data: computeTrailingStop(),
      config: { type: "trailingStop", pane: "main", color: "#FF9800", label: "Trail Stop" },
    });
  }
  if (showVolOverlay.value) {
    list.push({
      data: candles.map((c: { time: number; volume: number }) => ({
        time: c.time,
        value: c.volume,
      })),
      config: {
        pane: "main",
        scaleId: "left",
        type: "histogram",
        maxHeightRatio: 0.2,
        // No `color`: bars follow each candle's direction in the theme's
        // volume colours, and the legend swatch takes the up colour
        label: "Volume",
      },
    });
  }
  return list;
});

// biome-ignore lint/correctness/noUnusedVariables: bound to template via `:backtest` — Biome can't see the .vue template usage.
const backtestResult = computed(() => {
  if (!showBacktest.value) return undefined;
  const normalized = normalizeCandles(candles);
  // Buy when SMA 5 crosses above SMA 25, sell when it crosses back below
  return runBacktest(normalized, goldenCrossCondition(5, 25), deadCrossCondition(5, 25), {
    capital: 100000,
  });
});

// biome-ignore lint/correctness/noUnusedVariables: bound to template via `:plugins` — Biome can't see the .vue template usage.
const plugins = computed(() =>
  showSrZones.value
    ? { renderers: [trailRenderer], primitives: [srZonePrimitive] }
    : { renderers: [trailRenderer] },
);

// biome-ignore lint/correctness/noUnusedVariables: bound to template via `@click="toggleTheme"` — Biome can't see the .vue template usage.
function toggleTheme() {
  const next = theme.value === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  theme.value = next;
}

// biome-ignore lint/correctness/noUnusedVariables: bound to template via `:features` — Biome can't see the .vue template usage.
const features = [registerBacktest];
</script>

<template>
  <header>
    <h1>Vue Demo</h1>
    <span class="badge">Vue</span>
    <div class="tabs">
      <button type="button" :class="{ active: view === 'component' }" @click="view = 'component'">Component</button>
      <button type="button" :class="{ active: view === 'hook' }" @click="view = 'hook'">Hook</button>
    </div>
    <div class="controls">
      <template v-if="view === 'component'">
        <button type="button" :class="{ active: showSma }" @click="showSma = !showSma">SMA 50</button>
        <button type="button" :class="{ active: showBb }" @click="showBb = !showBb">BB</button>
        <button type="button" :class="{ active: showRsi }" @click="showRsi = !showRsi">RSI</button>
        <button type="button" :class="{ active: showMacd }" @click="showMacd = !showMacd">MACD</button>
        <button type="button" :class="{ active: showBacktest }" @click="showBacktest = !showBacktest">Backtest: SMA 5/25 cross</button>
        <button type="button" :class="{ active: showSrZones }" @click="showSrZones = !showSrZones">S/R Zones</button>
        <button type="button" :class="{ active: showTrail }" @click="showTrail = !showTrail">Trail Stop</button>
        <button type="button" :class="{ active: showVolOverlay }" @click="showVolOverlay = !showVolOverlay">Vol Overlay</button>
      </template>
      <button type="button" @click="toggleTheme">Theme: {{ theme === 'dark' ? 'Dark' : 'Light' }}</button>
    </div>
  </header>
  <div class="chart-area">
    <TrendChart
      v-if="view === 'component'"
      :candles="candles"
      :indicators="indicators"
      :backtest="backtestResult"
      :features="features"
      :plugins="plugins"
      :theme="theme"
      :options="{ watermark: 'VUE', volume: !showVolOverlay }"
    />
    <HookDemo v-else :theme="theme" />
  </div>
</template>
