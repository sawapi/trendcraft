import { createChart, definePrimitive, defineSeriesRenderer } from "@trendcraft/chart";
import type { SeriesRenderContext } from "@trendcraft/chart";
import {
  bollingerBands,
  goldenCrossCondition,
  ichimoku,
  macd,
  normalizeCandles,
  rsi,
  rsiBelow,
  runBacktest,
  sma,
} from "trendcraft";
import sampleData from "../data.json";

const candles = sampleData;
const container = document.getElementById("chart-container");
const statusEl = document.getElementById("status");
if (!container || !statusEl) throw new Error("Missing DOM elements");

// Create chart
const chart = createChart(container, { theme: "dark", watermark: "SAMPLE" });
chart.setCandles(candles);
chart.fitContent();

statusEl.textContent = `Sample Daily — ${candles.length} candles loaded`;

// Indicator state
type HandleRef = { value: ReturnType<typeof chart.addIndicator> | null };

const smaRef: HandleRef = {
  value: chart.addIndicator(sma(candles, { period: 20 })),
};
const bbRef: HandleRef = { value: null };
const ichimokuRef: HandleRef = { value: null };
const rsiRef: HandleRef = { value: null };
const macdRef: HandleRef = { value: null };

function toggle(
  btnId: string,
  ref: HandleRef,
  create: () => ReturnType<typeof chart.addIndicator>,
) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (ref.value) {
      ref.value.remove();
      ref.value = null;
      btn.classList.remove("active");
    } else {
      ref.value = create();
      btn.classList.add("active");
    }
  });
}

toggle("btn-sma", smaRef, () => chart.addIndicator(sma(candles, { period: 20 })));
toggle("btn-bb", bbRef, () => chart.addIndicator(bollingerBands(candles)));
toggle("btn-ichimoku", ichimokuRef, () => chart.addIndicator(ichimoku(candles)));
toggle("btn-rsi", rsiRef, () => chart.addIndicator(rsi(candles)));
toggle("btn-macd", macdRef, () => chart.addIndicator(macd(candles)));

// Drawing tools
let hlineId = 0;
document.getElementById("btn-hline")?.addEventListener("click", () => {
  // Add horizontal line at the median visible price
  const range = chart.getVisibleRange();
  if (!range) return;
  const midIdx = Math.floor((range.startIndex + range.endIndex) / 2);
  const midCandle = candles[midIdx];
  if (!midCandle) return;
  chart.addDrawing({
    id: `hline_${hlineId++}`,
    type: "hline",
    price: midCandle.close,
    color: "#FF9800",
  });
});

let currentFibId: string | null = null;
document.getElementById("btn-fib")?.addEventListener("click", () => {
  // Remove previous fib before adding new one
  if (currentFibId) chart.removeDrawing(currentFibId);

  const range = chart.getVisibleRange();
  if (!range) return;
  const start = Math.max(0, range.startIndex);
  const end = Math.min(candles.length - 1, range.endIndex);
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  let lowTime = candles[start].time;
  let highTime = candles[end].time;
  for (let i = start; i <= end; i++) {
    if (candles[i].low < low) {
      low = candles[i].low;
      lowTime = candles[i].time;
    }
    if (candles[i].high > high) {
      high = candles[i].high;
      highTime = candles[i].time;
    }
  }
  currentFibId = `fib_${Date.now()}`;
  chart.addDrawing({
    id: currentFibId,
    type: "fibRetracement",
    startTime: lowTime,
    startPrice: low,
    endTime: highTime,
    endPrice: high,
  });
});

// Backtest — 1 line visualization
document.getElementById("btn-backtest")?.addEventListener("click", () => {
  const normalized = normalizeCandles(candles);
  const result = runBacktest(normalized, goldenCrossCondition(), rsiBelow(70), { capital: 100000 });
  chart.addBacktest(result);
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = `Backtest: ${result.tradeCount} trades, ${result.winRate.toFixed(0)}% win, ${result.totalReturnPercent.toFixed(1)}% return`;
  }
});

// Score heatmap — RSI as score (0-100)
document.getElementById("btn-score")?.addEventListener("click", () => {
  const rsiData = rsi(candles);
  chart.addScores(rsiData as { time: number; value: number | null }[]);
});

document.getElementById("btn-fit")?.addEventListener("click", () => chart.fitContent());

let isDark = true;
document.getElementById("btn-theme")?.addEventListener("click", (e) => {
  isDark = !isDark;
  chart.setTheme(isDark ? "dark" : "light");
  document.body.style.background = isDark ? "#0a0e17" : "#f5f5f5";
  document.body.style.color = isDark ? "#d1d4dc" : "#131722";
  (e.target as HTMLButtonElement).textContent = isDark ? "Light Theme" : "Dark Theme";
});

// ============================================
// Plugin demos
// ============================================

// --- Primitive: Support/Resistance Zones ---
// Finds recent high/low and draws semi-transparent zones

const srZonePrimitive = definePrimitive({
  name: "srZones",
  pane: "main",
  zOrder: "below",
  defaultState: { zones: [] as { price: number; height: number; color: string }[] },
  render: ({ ctx, pane, priceScale }, state) => {
    for (const zone of state.zones) {
      const y = priceScale.priceToY(zone.price);
      const halfH = Math.abs(priceScale.priceToY(zone.price - zone.height) - y) / 2;
      ctx.fillStyle = zone.color;
      ctx.fillRect(0, y - halfH, pane.width, halfH * 2);
    }
  },
});

let srActive = false;
document.getElementById("btn-plugin-sr")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  srActive = !srActive;
  if (srActive) {
    // Find highest high and lowest low in last 60 candles
    const recent = candles.slice(-60);
    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    for (const c of recent) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    }
    const range = high - low;
    const zoneHeight = range * 0.02; // 2% of range
    srZonePrimitive.defaultState = {
      zones: [
        { price: high, height: zoneHeight, color: "rgba(239,83,80,0.15)" },
        { price: low, height: zoneHeight, color: "rgba(38,166,154,0.15)" },
      ],
    };
    chart.registerPrimitive(srZonePrimitive);
    btn.classList.add("active");
  } else {
    chart.removePrimitive("srZones");
    btn.classList.remove("active");
  }
});

// --- Custom Series Renderer: Trailing Stop Line ---
// Renders a stepped line that follows a trailing stop level

const trailRenderer = defineSeriesRenderer({
  type: "trailingStop",
  render: ({ ctx, series, timeScale, priceScale }: SeriesRenderContext) => {
    const start = timeScale.startIndex;
    const end = Math.min(timeScale.endIndex, series.data.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = series.config.color ?? "#FF9800";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);

    let moved = false;
    for (let i = start; i <= end; i++) {
      const point = series.data[i];
      if (!point || point.value === null) continue;
      const x = timeScale.indexToX(i);
      const y = priceScale.priceToY(point.value as number);
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        // Step-style: horizontal then vertical
        const prevX = timeScale.indexToX(i - 1);
        ctx.lineTo(
          x,
          priceScale.priceToY((series.data[i - 1]?.value as number) ?? (point.value as number)),
        );
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
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

chart.registerRenderer(trailRenderer);

let trailHandle: ReturnType<typeof chart.addIndicator> | null = null;
document.getElementById("btn-plugin-trail")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (trailHandle) {
    trailHandle.remove();
    trailHandle = null;
    btn.classList.remove("active");
  } else {
    // Compute a simple trailing stop: highest high over last 20 bars minus 2*ATR
    const period = 20;
    const atrPeriod = 14;
    const trailData: { time: number; value: number | null }[] = [];

    for (let i = 0; i < candles.length; i++) {
      if (i < Math.max(period, atrPeriod)) {
        trailData.push({ time: candles[i].time, value: null });
        continue;
      }
      // Highest high
      let hh = Number.NEGATIVE_INFINITY;
      for (let j = i - period + 1; j <= i; j++) {
        if (candles[j].high > hh) hh = candles[j].high;
      }
      // Simple ATR
      let atrSum = 0;
      for (let j = i - atrPeriod + 1; j <= i; j++) {
        const tr = Math.max(
          candles[j].high - candles[j].low,
          Math.abs(candles[j].high - candles[j - 1].close),
          Math.abs(candles[j].low - candles[j - 1].close),
        );
        atrSum += tr;
      }
      const atr = atrSum / atrPeriod;
      trailData.push({ time: candles[i].time, value: hh - 2 * atr });
    }

    trailHandle = chart.addIndicator(trailData, {
      type: "trailingStop",
      pane: "main",
      color: "#FF9800",
      label: "Trail Stop",
    });
    btn.classList.add("active");
  }
});
