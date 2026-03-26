<script setup lang="ts">
import { ref, computed } from "vue";
import { TrendChart } from "@trendcraft/chart/vue";
import { sma, rsi, bollingerBands, macd, runBacktest, goldenCrossCondition, rsiBelow, normalizeCandles } from "trendcraft";
import sampleData from "../../simple-chart/data.json";

const candles = sampleData;
const showSma = ref(true);
const showBb = ref(false);
const showRsi = ref(false);
const showMacd = ref(false);
const showBacktest = ref(false);
const theme = ref<"dark" | "light">("dark");

const indicators = computed(() => {
  const list: unknown[][] = [];
  if (showSma.value) list.push(sma(candles, { period: 20 }));
  if (showBb.value) list.push(bollingerBands(candles));
  if (showRsi.value) list.push(rsi(candles));
  if (showMacd.value) list.push(macd(candles));
  return list;
});

const backtestResult = computed(() => {
  if (!showBacktest.value) return undefined;
  const normalized = normalizeCandles(candles);
  return runBacktest(normalized, goldenCrossCondition(), rsiBelow(70), { capital: 100000 });
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
      <button @click="toggleTheme">{{ theme === 'dark' ? 'Light' : 'Dark' }}</button>
    </div>
  </header>
  <div style="flex:1;min-height:0">
    <TrendChart
      :candles="candles"
      :indicators="indicators"
      :backtest="backtestResult"
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
