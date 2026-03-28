import {
  connectLiveFeed,
  createChart,
  definePrimitive,
  defineSeriesRenderer,
} from "@trendcraft/chart";
import type { LiveFeedConnection } from "@trendcraft/chart";
import {
  bollingerBands,
  goldenCrossCondition,
  ichimoku,
  incremental,
  macd,
  normalizeCandles,
  rsi,
  rsiBelow,
  runBacktest,
  sma,
  streaming,
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

// Chart type toggle
const chartTypes = ["candlestick", "line", "mountain", "ohlc"] as const;
let chartTypeIdx = 0;
document.getElementById("btn-chart-type")?.addEventListener("click", (e) => {
  chartTypeIdx = (chartTypeIdx + 1) % chartTypes.length;
  const type = chartTypes[chartTypeIdx];
  chart.setChartType(type);
  const labels: Record<string, string> = {
    candlestick: "Candle",
    line: "Line",
    mountain: "Mountain",
    ohlc: "OHLC",
  };
  (e.target as HTMLButtonElement).textContent = `Chart: ${labels[type]}`;
});

// --- Tick Simulation: LiveCandle + connectLiveFeed ---
const allIndicatorRefs: HandleRef[] = [smaRef, bbRef, ichimokuRef, rsiRef, macdRef];

let simTimer: ReturnType<typeof setInterval> | null = null;
let liveFeedConn: LiveFeedConnection | null = null;

document.getElementById("btn-simulate")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (simTimer) {
    // Stop simulation
    clearInterval(simTimer);
    simTimer = null;
    liveFeedConn?.disconnect();
    liveFeedConn = null;
    // Restore full data + re-add indicators
    chart.setCandles(candles);
    chart.fitContent();
    if (document.getElementById("btn-sma")?.classList.contains("active")) {
      smaRef.value = chart.addIndicator(sma(candles, { period: 20 }));
    }
    statusEl.textContent = `Sample Daily — ${candles.length} candles loaded`;
    btn.classList.remove("active");
    btn.textContent = "Simulate";
    return;
  }

  // Remove all indicators before switching to simulation data
  for (const ref of allIndicatorRefs) {
    if (ref.value) {
      ref.value.remove();
      ref.value = null;
    }
  }

  // Pre-generate 50 candles of 1-min history
  const startPrice = candles[candles.length - 1].close;
  const simStartTime = Date.now() - 50 * 60_000;
  const simHistory: typeof candles = [];
  let initPrice = startPrice;
  for (let i = 0; i < 50; i++) {
    const t = simStartTime + i * 60_000;
    const open = initPrice;
    initPrice += (Math.random() - 0.498) * initPrice * 0.003;
    const close = initPrice;
    const high = Math.max(open, close) + Math.random() * Math.abs(close - open) * 0.5;
    const low = Math.min(open, close) - Math.random() * Math.abs(close - open) * 0.5;
    simHistory.push({
      time: t,
      open: +open.toFixed(3),
      high: +high.toFixed(3),
      low: +low.toFixed(3),
      close: +close.toFixed(3),
      volume: Math.round(500 + Math.random() * 5000),
    });
  }

  // Create LiveCandle with history + SMA indicator
  const live = streaming.createLiveCandle({
    intervalMs: 60_000,
    history: simHistory,
    indicators: [
      {
        name: "sma20",
        create: (s) => incremental.createSma({ period: 20 }, incremental.restoreState(s)),
      },
    ],
  });

  // Pre-compute historical SMA for back-fill
  const smaHistory = sma(simHistory, { period: 20 });

  // Connect LiveCandle → chart (auto handles updateCandle + indicator series)
  liveFeedConn = connectLiveFeed(chart, live, {
    indicators: {
      sma: {
        snapshotPath: "sma20",
        series: { pane: "main", color: "#2196F3", label: "SMA 20" },
        historyData: smaHistory,
      },
    },
  });

  // Random walk state
  let price = simHistory[simHistory.length - 1].close;
  let simTime = simHistory[simHistory.length - 1].time + 60_000;
  let completedCount = 0;

  live.on("candleComplete", () => {
    completedCount++;
  });

  btn.classList.add("active");
  btn.textContent = "Stop";

  // Generate ~10 ticks per second
  simTimer = setInterval(() => {
    price += (Math.random() - 0.498) * price * 0.001;
    price = Math.max(1, price);
    simTime += 1000 + Math.random() * 2000;
    const volume = Math.round(100 + Math.random() * 900);

    live.addTick({ time: simTime, price, volume });

    statusEl.textContent = `Live Simulation — ${completedCount} candles | Price: ${price.toFixed(2)}`;
  }, 100);
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
  render: ({ draw }, state) => {
    for (const zone of state.zones) {
      // rect(index, priceTop, widthBars, priceBottom, fill)
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
  render: ({ draw, series }) => {
    // Step-style trailing stop using draw.scope() for auto save/restore
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
          ctx.lineTo(draw.x(i), draw.y(prev)); // horizontal step
          ctx.lineTo(draw.x(i), draw.y(val)); // vertical step
        }
      }
      ctx.stroke();
    }); // setLineDash auto-reset by save/restore
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

// --- Volume Overlay Demo: Yahoo Finance style volume on main pane ---

let volOverlayHandle: ReturnType<typeof chart.addIndicator> | null = null;
document.getElementById("btn-vol-overlay")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (volOverlayHandle) {
    volOverlayHandle.remove();
    volOverlayHandle = null;
    chart.setShowVolume(true); // Restore separate volume pane
    btn.classList.remove("active");
  } else {
    chart.setShowVolume(false); // Hide separate volume pane
    // Convert candle volume to series data
    const volumeSeries = candles.map((c) => ({ time: c.time, value: c.volume }));
    volOverlayHandle = chart.addIndicator(volumeSeries, {
      pane: "main",
      scaleId: "left",
      type: "histogram",
      maxHeightRatio: 0.2, // volume bars occupy at most 20% of pane height
      color: "rgba(100,181,246,0.3)",
      label: "Volume",
    });
    btn.classList.add("active");
  }
});
