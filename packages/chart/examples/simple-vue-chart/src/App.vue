<script setup lang="ts">
import { ref, computed } from "vue";
import { TrendChart } from "@trendcraft/chart/vue";
import { defineSeriesRenderer, definePrimitive } from "@trendcraft/chart";
import { sma, rsi, bollingerBands, macd, runBacktest, goldenCrossCondition, rsiBelow, normalizeCandles } from "trendcraft";
import sampleData from "../../simple-chart/data.json";

const candles = sampleData;
const showSma = ref(true);
const showBb = ref(false);
const showRsi = ref(false);
const showMacd = ref(false);
const showBacktest = ref(false);
const showSrZones = ref(false);
const showTrail = ref(false);
const theme = ref<"dark" | "light">("dark");

// --- Plugin: S/R Zone Primitive ---
const srZonePrimitive = definePrimitive({
  name: "srZones",
  pane: "main",
  zOrder: "below",
  defaultState: { zones: [] as { price: number; height: number; color: string }[] },
  render: ({ draw }, state) => {
    for (const zone of state.zones) {
      draw.rect(
        draw.startIndex, zone.price + zone.height / 2,
        draw.endIndex - draw.startIndex, zone.price - zone.height / 2,
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
        if (!moved) { ctx.moveTo(draw.x(i), draw.y(val)); moved = true; }
        else {
          const prev = (series.data[i - 1]?.value as number) ?? val;
          ctx.lineTo(draw.x(i), draw.y(prev));
          ctx.lineTo(draw.x(i), draw.y(val));
        }
      }
      ctx.stroke();
    });
  },
  priceRange: (series, start, end) => {
    let min = Infinity, max = -Infinity;
    for (let i = start; i <= end && i < series.data.length; i++) {
      const v = series.data[i]?.value as number | null;
      if (v != null) { if (v < min) min = v; if (v > max) max = v; }
    }
    return [min, max];
  },
  formatValue: (series, index) => {
    const v = series.data[index]?.value as number | null;
    return v != null ? `Trail: ${v.toFixed(2)}` : null;
  },
});

function computeTrailingStop() {
  const period = 20, atrPeriod = 14;
  return candles.map((c, i) => {
    if (i < Math.max(period, atrPeriod)) return { time: c.time, value: null };
    let hh = -Infinity;
    for (let j = i - period + 1; j <= i; j++) if (candles[j].high > hh) hh = candles[j].high;
    let atrSum = 0;
    for (let j = i - atrPeriod + 1; j <= i; j++) {
      atrSum += Math.max(candles[j].high - candles[j].low, Math.abs(candles[j].high - candles[j - 1].close), Math.abs(candles[j].low - candles[j - 1].close));
    }
    return { time: c.time, value: hh - 2 * (atrSum / atrPeriod) };
  });
}

const indicators = computed(() => {
  const list: unknown[][] = [];
  if (showSma.value) list.push(sma(candles, { period: 20 }));
  if (showBb.value) list.push(bollingerBands(candles));
  if (showRsi.value) list.push(rsi(candles));
  if (showMacd.value) list.push(macd(candles));
  if (showTrail.value) list.push(computeTrailingStop());
  return list;
});

const backtestResult = computed(() => {
  if (!showBacktest.value) return undefined;
  const normalized = normalizeCandles(candles);
  return runBacktest(normalized, goldenCrossCondition(), rsiBelow(70), { capital: 100000 });
});

const plugins = computed(() => {
  if (!showSrZones.value) return { renderers: [trailRenderer] };
  const recent = candles.slice(-60);
  let high = -Infinity, low = Infinity;
  for (const c of recent) { if (c.high > high) high = c.high; if (c.low < low) low = c.low; }
  const h = (high - low) * 0.02;
  srZonePrimitive.defaultState = {
    zones: [
      { price: high, height: h, color: "rgba(239,83,80,0.15)" },
      { price: low, height: h, color: "rgba(38,166,154,0.15)" },
    ],
  };
  return { renderers: [trailRenderer], primitives: [srZonePrimitive] };
});

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}
</script>

<template>
  <header style="padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#131722;border-bottom:1px solid #2a2e39">
    <h1 style="font-size:14px;font-weight:600">Vue Demo</h1>
    <span style="font-size:10px;background:#42b883;color:#fff;padding:2px 6px;border-radius:3px">Vue</span>
    <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap">
      <button :class="{ active: showSma }" @click="showSma = !showSma">SMA 20</button>
      <button :class="{ active: showBb }" @click="showBb = !showBb">BB</button>
      <button :class="{ active: showRsi }" @click="showRsi = !showRsi">RSI</button>
      <button :class="{ active: showMacd }" @click="showMacd = !showMacd">MACD</button>
      <button :class="{ active: showBacktest }" @click="showBacktest = !showBacktest">Backtest</button>
      <button :class="{ active: showSrZones }" @click="showSrZones = !showSrZones">S/R Zones</button>
      <button :class="{ active: showTrail }" @click="showTrail = !showTrail">Trail Stop</button>
      <button @click="toggleTheme">{{ theme === 'dark' ? 'Light' : 'Dark' }}</button>
    </div>
  </header>
  <div style="flex:1;min-height:0">
    <TrendChart
      :candles="candles"
      :indicators="indicators"
      :backtest="backtestResult"
      :plugins="plugins"
      :theme="theme"
      :options="{ watermark: 'VUE' }"
    />
  </div>
</template>

<style>
button {
  padding: 4px 8px;
  font-size: 11px;
  background: #1e222d;
  color: #d1d4dc;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  cursor: pointer;
}
button:hover { background: #2a2e39; }
button.active { background: #2196F3; color: #fff; border-color: #2196F3; }
</style>
