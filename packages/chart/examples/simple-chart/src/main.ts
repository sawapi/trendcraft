import {
  connectLiveFeed,
  connectRegimeHeatmap,
  connectSessionZones,
  connectSmcLayer,
  connectSrConfluence,
  connectTradeAnalysis,
  connectWyckoffPhase,
  createChart,
  definePrimitive,
  defineSeriesRenderer,
} from "@trendcraft/chart";
import type { LiveFeedConnection } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
import {
  bollingerBands,
  breakOfStructure,
  fairValueGap,
  goldenCrossCondition,
  hmmRegimes,
  ichimoku,
  killZones,
  liquiditySweep,
  livePresets,
  macd,
  normalizeCandles,
  orderBlock,
  rsi,
  rsiBelow,
  runBacktest,
  sma,
  srZones,
  streaming,
  vsa,
  wyckoffPhases,
} from "trendcraft";
// Note: `incremental` no longer needed — livePresets bundles factories
import sampleData from "../data.json";

const candles = sampleData;
const container = document.getElementById("chart-container");
const statusEl = document.getElementById("status");
if (!container || !statusEl) throw new Error("Missing DOM elements");

// Create chart
const chart = createChart(container, { theme: "dark", watermark: "SAMPLE" });
registerTrendCraftPresets(chart);
chart.setCandles(candles);
chart.fitContent();

statusEl.textContent = `Sample Daily — ${candles.length} candles loaded`;

// Simulation state (module-scoped for toggle access)
let liveCandle: ReturnType<typeof streaming.createLiveCandle> | null = null;
let liveFeedConn: LiveFeedConnection | null = null;

// Track which live indicators are currently active
const activeLiveIndicators = new Set<string>();
// Stored simulation history for vol overlay back-fill
let simHistoryRef: typeof sampleData = [];

// Indicator state (static mode)
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
  key: string,
  ref: HandleRef,
  create: () => ReturnType<typeof chart.addIndicator>,
) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    // Live simulation mode — zero-config via preset registry
    if (liveFeedConn) {
      if (activeLiveIndicators.has(key)) {
        liveFeedConn.removeIndicator(key);
        activeLiveIndicators.delete(key);
        btn.classList.remove("active");
      } else {
        liveFeedConn.addIndicator(key);
        activeLiveIndicators.add(key);
        btn.classList.add("active");
      }
      return;
    }

    // Static mode (batch data)
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

toggle("btn-sma", "sma", smaRef, () => chart.addIndicator(sma(candles, { period: 20 })));
toggle("btn-bb", "bb", bbRef, () => chart.addIndicator(bollingerBands(candles)));
toggle("btn-ichimoku", "ichimoku", ichimokuRef, () => chart.addIndicator(ichimoku(candles)));
toggle("btn-rsi", "rsi", rsiRef, () => chart.addIndicator(rsi(candles)));
toggle("btn-macd", "macd", macdRef, () => chart.addIndicator(macd(candles)));

// Drawing tools — interactive mode via setDrawingTool()
// Click a tool button to activate, then click on chart to place
const drawingTools = [
  "btn-hline",
  "btn-vline",
  "btn-hray",
  "btn-ray",
  "btn-arrow",
  "btn-rect",
  "btn-channel",
  "btn-fib",
  "btn-fib-ext",
  "btn-text",
] as const;
const toolMap: Record<string, import("@trendcraft/chart").DrawingType> = {
  "btn-hline": "hline",
  "btn-vline": "vline",
  "btn-hray": "hray",
  "btn-ray": "ray",
  "btn-arrow": "arrow",
  "btn-rect": "rectangle",
  "btn-channel": "channel",
  "btn-fib": "fibRetracement",
  "btn-fib-ext": "fibExtension",
  "btn-text": "textLabel",
};

let activeDrawBtn: HTMLElement | null = null;

for (const btnId of drawingTools) {
  document.getElementById(btnId)?.addEventListener("click", () => {
    const btn = document.getElementById(btnId);
    const tool = toolMap[btnId];
    if (!tool || !btn) return;

    // Toggle off if same tool clicked again
    if (activeDrawBtn === btn) {
      chart.setDrawingTool(null);
      btn.classList.remove("active");
      activeDrawBtn = null;
      statusEl.textContent = "Drawing tool deactivated";
      return;
    }

    // Deactivate previous
    activeDrawBtn?.classList.remove("active");

    chart.setDrawingTool(tool);
    btn.classList.add("active");
    activeDrawBtn = btn;
    statusEl.textContent = `Drawing: ${tool} — click on chart to place`;
  });
}

// Listen for drawing completion
chart.on("drawingComplete", (data) => {
  const d = data as { id: string; type: string };
  statusEl.textContent = `Drawing placed: ${d.type} (${d.id})`;
  // Deactivate button
  activeDrawBtn?.classList.remove("active");
  activeDrawBtn = null;
});

// Backtest — 1 line visualization
// Store last backtest result for MFE/MAE overlay
let lastBacktestResult: ReturnType<typeof runBacktest> | null = null;

document.getElementById("btn-backtest")?.addEventListener("click", () => {
  const normalized = normalizeCandles(candles);
  const result = runBacktest(normalized, goldenCrossCondition(), rsiBelow(70), { capital: 100000 });
  lastBacktestResult = result;
  chart.addBacktest(result);
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = `Backtest: ${result.tradeCount} trades, ${result.winRate.toFixed(0)}% win, ${result.totalReturnPercent.toFixed(1)}% return`;
  }
});

// --- MFE/MAE Trade Analysis: visualize max favorable/adverse excursion ---
let tradeAnalysisHandle: ReturnType<typeof connectTradeAnalysis> | null = null;
document.getElementById("btn-mfe-mae")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (tradeAnalysisHandle) {
    tradeAnalysisHandle.remove();
    tradeAnalysisHandle = null;
    btn.classList.remove("active");
  } else {
    if (!lastBacktestResult) {
      // Run backtest first if not done yet
      const normalized = normalizeCandles(candles);
      lastBacktestResult = runBacktest(normalized, goldenCrossCondition(), rsiBelow(70), {
        capital: 100000,
      });
      chart.addBacktest(lastBacktestResult);
    }
    tradeAnalysisHandle = connectTradeAnalysis(chart, lastBacktestResult.trades, candles);
    btn.classList.add("active");
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
const allIndicatorBtns = ["btn-sma", "btn-bb", "btn-ichimoku", "btn-rsi", "btn-macd"];

let simTimer: ReturnType<typeof setInterval> | null = null;

document.getElementById("btn-simulate")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (simTimer) {
    // Stop simulation
    clearInterval(simTimer);
    simTimer = null;
    liveFeedConn?.disconnect();
    liveFeedConn = null;
    liveCandle?.dispose();
    liveCandle = null;
    activeLiveIndicators.clear();
    volOverlayLive = false;

    // Restore full data + re-add active indicators
    chart.setCandles(candles);
    chart.fitContent();
    for (let i = 0; i < allIndicatorBtns.length; i++) {
      const wasActive = document.getElementById(allIndicatorBtns[i])?.classList.contains("active");
      if (wasActive) {
        const creators = [
          () => chart.addIndicator(sma(candles, { period: 20 })),
          () => chart.addIndicator(bollingerBands(candles)),
          () => chart.addIndicator(ichimoku(candles)),
          () => chart.addIndicator(rsi(candles)),
          () => chart.addIndicator(macd(candles)),
        ];
        allIndicatorRefs[i].value = creators[i]();
      }
    }
    statusEl.textContent = `Sample Daily — ${candles.length} candles loaded`;
    btn.classList.remove("active");
    btn.textContent = "Simulate";
    return;
  }

  // Remove all static indicators before switching to simulation data
  for (const ref of allIndicatorRefs) {
    if (ref.value) {
      ref.value.remove();
      ref.value = null;
    }
  }

  // Pre-generate 50 candles of 1-min history (epoch-aligned times)
  const startPrice = candles[candles.length - 1].close;
  const simStartTime = Math.floor((Date.now() - 50 * 60_000) / 60_000) * 60_000;
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

  simHistoryRef = simHistory;

  // Create LiveCandle with history
  liveCandle = streaming.createLiveCandle({
    intervalMs: 60_000,
    history: simHistory,
  });

  // Initialize chart with history + connect LiveCandle
  chart.setCandles(simHistory);
  liveFeedConn = connectLiveFeed(chart, liveCandle, {
    initHistory: false,
    presets: livePresets,
    history: simHistory,
  });

  // Auto-enable SMA (was active by default)
  liveFeedConn.addIndicator("sma");
  activeLiveIndicators.add("sma");

  // Random walk state
  let price = simHistory[simHistory.length - 1].close;
  let simTime = simHistory[simHistory.length - 1].time + 60_000;
  let completedCount = 0;

  liveCandle.on("candleComplete", () => {
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

    liveCandle?.addTick({ time: simTime, price, volume });

    statusEl.textContent = `Live Simulation — ${completedCount} candles | Price: ${price.toFixed(2)}`;
  }, 100);
});

document.getElementById("btn-fit")?.addEventListener("click", () => chart.fitContent());

// Range selector
const rangeButtons = {
  "btn-range-1m": "1M" as const,
  "btn-range-3m": "3M" as const,
  "btn-range-6m": "6M" as const,
  "btn-range-ytd": "YTD" as const,
  "btn-range-1y": "1Y" as const,
  "btn-range-all": "ALL" as const,
};
function clearRangeActive() {
  for (const id of Object.keys(rangeButtons)) {
    document.getElementById(id)?.classList.remove("active");
  }
}
let rangeChangeFromButton = false;
for (const [btnId, duration] of Object.entries(rangeButtons)) {
  document.getElementById(btnId)?.addEventListener("click", () => {
    rangeChangeFromButton = true;
    chart.setVisibleRangeByDuration(duration);
    clearRangeActive();
    document.getElementById(btnId)?.classList.add("active");
    // Reset flag after event loop settles
    requestAnimationFrame(() => {
      rangeChangeFromButton = false;
    });
  });
}

// Clear range active state when user manually pans/zooms
chart.on("visibleRangeChange", () => {
  if (!rangeChangeFromButton) clearRangeActive();
});

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

const VOL_OVERLAY_CONFIG = {
  pane: "main" as const,
  scaleId: "left" as const,
  type: "histogram" as const,
  maxHeightRatio: 0.2,
  color: "rgba(100,181,246,0.3)",
  label: "Volume",
};

let volOverlayHandle: ReturnType<typeof chart.addIndicator> | null = null;
let volOverlayLive = false;
document.getElementById("btn-vol-overlay")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;

  // Remove existing
  if (volOverlayHandle || volOverlayLive) {
    if (volOverlayHandle) {
      volOverlayHandle.remove();
      volOverlayHandle = null;
    }
    if (volOverlayLive && liveFeedConn) {
      liveFeedConn.removeIndicator("vol_overlay");
      volOverlayLive = false;
    }
    chart.setShowVolume(true);
    btn.classList.remove("active");
    return;
  }

  // Add
  chart.setShowVolume(false);
  if (liveCandle && liveFeedConn) {
    // Live mode: use candleField
    const allCandles = [...simHistoryRef, ...liveCandle.completedCandles];
    const historyData = allCandles.map((c) => ({ time: c.time, value: c.volume }));
    liveFeedConn.addIndicator("vol_overlay", {
      candleField: "volume",
      series: VOL_OVERLAY_CONFIG,
      historyData,
    });
    volOverlayLive = true;
  } else {
    // Static mode
    const volumeSeries = candles.map((c) => ({ time: c.time, value: c.volume }));
    volOverlayHandle = chart.addIndicator(volumeSeries, VOL_OVERLAY_CONFIG);
  }
  btn.classList.add("active");
});

// --- Regime Heatmap: HMM regime detection as background coloring ---
let regimeHandle: ReturnType<typeof connectRegimeHeatmap> | null = null;
document.getElementById("btn-regime")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (regimeHandle) {
    regimeHandle.remove();
    regimeHandle = null;
    btn.classList.remove("active");
  } else {
    const normalized = normalizeCandles(candles);
    const regimes = hmmRegimes(normalized, { maxIterations: 30, numRestarts: 2 });
    regimeHandle = connectRegimeHeatmap(chart, regimes);
    btn.classList.add("active");
  }
});

// --- SMC Visual Layer: Order Blocks, FVG, Liquidity Sweep, BOS ---
let smcHandle: ReturnType<typeof connectSmcLayer> | null = null;
document.getElementById("btn-smc")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (smcHandle) {
    smcHandle.remove();
    smcHandle = null;
    btn.classList.remove("active");
  } else {
    const normalized = normalizeCandles(candles);
    smcHandle = connectSmcLayer(chart, {
      orderBlocks: orderBlock(normalized),
      fvgs: fairValueGap(normalized),
      sweeps: liquiditySweep(normalized),
      bos: breakOfStructure(normalized),
    });
    btn.classList.add("active");
  }
});

// --- Wyckoff Phase Timeline: phase bar + VSA markers ---
let wyckoffHandle: ReturnType<typeof connectWyckoffPhase> | null = null;
document.getElementById("btn-wyckoff")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (wyckoffHandle) {
    wyckoffHandle.remove();
    wyckoffHandle = null;
    btn.classList.remove("active");
  } else {
    const normalized = normalizeCandles(candles);
    wyckoffHandle = connectWyckoffPhase(chart, {
      phases: wyckoffPhases(normalized),
      vsa: vsa(normalized),
    });
    btn.classList.add("active");
  }
});

// --- S/R Zone Confluence: multi-source strength-colored bands ---
let srConfHandle: ReturnType<typeof connectSrConfluence> | null = null;
document.getElementById("btn-sr-confluence")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (srConfHandle) {
    srConfHandle.remove();
    srConfHandle = null;
    btn.classList.remove("active");
  } else {
    const normalized = normalizeCandles(candles);
    const result = srZones(normalized);
    srConfHandle = connectSrConfluence(chart, result.zones);
    btn.classList.add("active");
  }
});

// --- Session Kill Zones: time-based background shading ---
let sessionHandle: ReturnType<typeof connectSessionZones> | null = null;
document.getElementById("btn-sessions")?.addEventListener("click", (e) => {
  const btn = e.target as HTMLButtonElement;
  if (sessionHandle) {
    sessionHandle.remove();
    sessionHandle = null;
    btn.classList.remove("active");
  } else {
    const normalized = normalizeCandles(candles);
    sessionHandle = connectSessionZones(chart, killZones(normalized));
    btn.classList.add("active");
  }
});
