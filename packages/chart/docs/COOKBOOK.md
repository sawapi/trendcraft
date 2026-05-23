# @trendcraft/chart Cookbook

Practical recipes for common charting tasks. Each recipe is self-contained and copy-paste ready. For the conceptual model see [GUIDE.md](./GUIDE.md); for the full reference see [API.md](./API.md); for live data see [LIVE.md](./LIVE.md); for custom rendering see [PLUGINS.md](./PLUGINS.md).

---

## Recipe 1: Minimal candlestick chart

**Goal:** A chart with one indicator, no framework wrapper.

```typescript
import { createChart } from "@trendcraft/chart";
import { sma } from "trendcraft";

const container = document.getElementById("chart") as HTMLElement;
const chart = createChart(container, { theme: "dark" });

chart.setCandles(candles);
chart.addIndicator(sma(candles, { period: 20 }));
```

`sma()` returns a `Series<number>` carrying `__meta` describing pane, color, and label. The chart auto-detects all three. No `addIndicator` config needed.

---

## Recipe 2: A handful of indicators with one call

**Goal:** Hook up many indicators at once via the bundled presets.

```typescript
import { connectIndicators, createChart } from "@trendcraft/chart";
import { registerTrendCraftPresets } from "@trendcraft/chart/presets";

const chart = createChart(container);
registerTrendCraftPresets(chart);

const conn = connectIndicators(chart, { candles });
conn.add("sma", { period: 20 });
conn.add("bollingerBands");
conn.add("rsi");
conn.add("macd");
```

`connectIndicators` is a single API that handles both static (you pass `candles`) and live (you pass `live`) modes. See Recipe 8 for live.

---

## Recipe 3: Custom pane for a sub-indicator

**Goal:** Force an indicator into its own sub-pane, skipping auto-detection.

```typescript
chart.addIndicator(rsi(candles, { period: 14 }), {
  pane: "new",
  yRange: [0, 100],
  referenceLines: [30, 70],
  color: "#f59e0b",
});
```

`pane: "new"` creates a fresh sub-pane. `pane: "main"` forces the main pane. Omit it to let `__meta` decide.

---

## Recipe 4: Theming

**Goal:** Switch between dark and light, or supply a fully custom palette.

```typescript
import { DARK_THEME, LIGHT_THEME } from "@trendcraft/chart";

chart.setTheme("dark");
chart.setTheme("light");

// Custom palette
chart.setTheme({
  ...DARK_THEME,
  background: "#0b1020",
  upColor: "#00c2a8",
  downColor: "#ff5c8a",
});
```

For a one-shot custom theme at construction, pass it as `createChart(el, { theme: { ... } })`.

---

## Recipe 5: Drawing tools — programmatic and interactive

**Goal:** Pre-place drawings, or let the user draw the next one with the keyboard.

```typescript
chart.addDrawing({
  id: "support-1",
  type: "hline",
  price: 142.5,
  color: "#22c55e",
});

// Enter interactive mode — next click drops a trend line
chart.setDrawingTool("trendline");
```

Default hotkeys: `Alt+H` (h-line), `Alt+T` (trendline), `Alt+F` (fib retracement), `Esc` (cancel). Override or disable via `ChartOptions.hotkeys`.

---

## Recipe 6: Auto-fib from swing points

**Goal:** Drop a Fibonacci retracement between the last two swing points without computing anchors yourself.

```typescript
import { addAutoFibRetracement } from "@trendcraft/chart";
import { swingPoints } from "trendcraft";

const swings = swingPoints(candles, { leftBars: 5, rightBars: 5 });
addAutoFibRetracement(chart, swings, { lookback: 1 });
```

Companions: `addAutoFibExtension`, `addAutoTrendLine`, `addAutoChannelLine`.

---

## Recipe 7: Visualizing a backtest

**Goal:** Drop a `trendcraft` backtest result onto the chart in one call.

```typescript
import { runBacktest, goldenCrossCondition, deadCrossCondition } from "trendcraft";

const result = runBacktest(
  candles,
  goldenCrossCondition(5, 25),
  deadCrossCondition(5, 25),
  { capital: 1_000_000, stopLoss: 5, takeProfit: 15 },
);

chart.addBacktest(result);
```

`addBacktest` adds entry/exit markers, an equity curve sub-pane, and a summary bar. For just markers, use `addTrades(result.trades)`.

---

## Recipe 8: Live data via WebSocket

**Goal:** Stream trades into a chart with live indicators.

```typescript
import { connectIndicators, createChart } from "@trendcraft/chart";
import { createLiveCandle, indicatorPresets } from "trendcraft";

const chart = createChart(container);
chart.setCandles(history);

const live = createLiveCandle({
  intervalMs: 60_000,
  history,
  maxHistory: 2000,
});

const conn = connectIndicators(chart, {
  presets: indicatorPresets,
  candles: history,
  live,
});
conn.add("rsi");
conn.add("bollingerBands");

ws.on("trade", (t) => {
  live.addTick({ time: t.ts, price: t.px, volume: t.size });
});

// On unmount
function cleanup() {
  conn.disconnect();
  chart.destroy();
  ws.close();
}
```

See [LIVE.md](./LIVE.md) for backfill, reconnect, and pre-formed candle inputs.

---

## Recipe 9: React

**Goal:** A reactive chart in React 19+.

```tsx
import { TrendChart } from "@trendcraft/chart/react";
import { sma, rsi } from "trendcraft";

export function ChartView({ candles }: { candles: Candle[] }) {
  const indicators = [
    sma(candles, { period: 20 }),
    sma(candles, { period: 50 }),
    rsi(candles, { period: 14 }),
  ];
  return (
    <TrendChart
      candles={candles}
      indicators={indicators}
      theme="dark"
      style={{ height: 480 }}
    />
  );
}
```

Need imperative access? Use `useTrendChart()` and read `chartRef.current` once mounted.

---

## Recipe 10: Vue

**Goal:** Same as Recipe 9, in Vue 3.3+.

```vue
<script setup lang="ts">
import { TrendChart } from "@trendcraft/chart/vue";
import { sma, rsi } from "trendcraft";
import { computed } from "vue";

const props = defineProps<{ candles: Candle[] }>();

const indicators = computed(() => [
  sma(props.candles, { period: 20 }),
  rsi(props.candles, { period: 14 }),
]);
</script>

<template>
  <TrendChart :candles="candles" :indicators="indicators" theme="dark" />
</template>
```

---

## Recipe 11: Sparkline grid

**Goal:** Render hundreds of mini-charts in a watchlist.

```typescript
import { createSparklineGroup } from "@trendcraft/chart/sparkline";

const group = createSparklineGroup({ container: root, hover: true });

for (const ticker of tickers) {
  const canvas = document.createElement("canvas");
  canvas.style.width = "120px";
  canvas.style.height = "32px";
  rowEl.appendChild(canvas);

  group.add(canvas, {
    type: "line",
    data: ticker.candles,
    color: { trend: "auto" },
    fill: true,
    baseline: "auto",
  });
}
```

The sparkline subpath has its own bundle budget (see `packages/chart/.size-limit.json`) and does not pull in the main chart code.

---

## Recipe 12: Crosshair snap and current-price badges

**Goal:** Snap the crosshair to OHLC and show last-value badges next to the price axis.

```typescript
const chart = createChart(container, {
  crosshair: { mode: "magnetOHLC", snapThreshold: 12 },
  showSeriesBadges: true,
  seriesBadgeMode: "absolute", // or "visible" for the latest in-range value
});
```

Switch modes at runtime via `chart.applyOptions({ crosshair: { mode: "magnet" } })`.

---

## Recipe 13: Custom primitive plugin

**Goal:** Draw something the built-in series types do not cover (here: a horizontal-zone overlay).

```typescript
import { definePrimitive } from "@trendcraft/chart";

const zonePlugin = definePrimitive({
  name: "supportZone",
  initialState: { lo: 0, hi: 0 },
  draw(ctx, state, helpers) {
    const y1 = helpers.priceToY(state.lo);
    const y2 = helpers.priceToY(state.hi);
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    ctx.fillRect(0, Math.min(y1, y2), helpers.width, Math.abs(y2 - y1));
  },
});

chart.registerPrimitive(zonePlugin);
chart.setPrimitiveState("supportZone", { lo: 140, hi: 145 });
```

For series-type plugins (e.g. footprint candles), use `defineSeriesRenderer`. See [PLUGINS.md](./PLUGINS.md).

---

## Recipe 14: Swapping the candle dataset (symbol / timeframe change)

**Goal:** Replace the chart's candles with an unrelated dataset (a different symbol, a new timeframe, a freshly uploaded file) without leaving primitive overlays anchored to the old (time, price) coordinates.

Chart primitives — anything registered via `registerPrimitive` or the built-in `connectPricePatterns` / `connectVolumeProfile` / `connectSrConfluence` / etc. — capture their coordinates at build time and **do not** auto-invalidate when `setCandles` runs. This is intentional and matches TradingView Lightweight Charts and Highcharts behavior, where annotations stay attached and re-project from `(time, price)` each frame. The downside is that primitives built from the previous data can render at coordinates that happen to overlap the new view, silently misleading the reader.

The cleanup pattern:

```typescript
function loadDataset(next: CandleData[]) {
  // Drop overlays anchored to the old candles. Renderers, series, and
  // drawings are independent — they update on their own.
  chart.removeAllPrimitives();
  chart.setCandles(next);

  // Re-register any primitives that should follow the new data,
  // recomputed from the fresh candles.
  if (showPatterns) {
    connectPricePatterns(chart, [
      ...doubleBottom(next),
      ...doubleTop(next),
      ...inverseHeadAndShoulders(next),
      ...headAndShoulders(next),
    ]);
  }
}
```

When *not* to call `removeAllPrimitives`:

- `updateCandle(latest)` / streaming bar appends — the time axis only grows; existing primitives still anchor to valid coordinates.
- User drawing tools anchored to specific dates the user picked — those are owned by the chart's drawing layer (`addDrawing` / `removeDrawing`), not primitives.

For React / Vue wrappers, calling `chart.removeAllPrimitives()` before the effect that calls `setCandles` (or making it part of the same `useEffect` deps trigger) is the equivalent host-side pattern.

---

## Recipe 15: PNG export

**Goal:** Save the current chart as a PNG.

```typescript
const blob = await chart.toImage("image/png");
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "chart.png";
a.click();
URL.revokeObjectURL(url);
```

`toImage(type?, quality?, timeoutMs?)` waits for the next render to settle before snapshotting.

---

## Recipe 16: Headless usage (SSR / tests)

**Goal:** Compute layout, scales, or LTTB-decimated series on the server.

```typescript
import { DataLayer, TimeScale, PriceScale, lttb } from "@trendcraft/chart/headless";

const data = new DataLayer();
data.setCandles(candles);

const time = new TimeScale();
time.setRange(candles[0].time, candles[candles.length - 1].time);

const price = new PriceScale();
price.setRangeFromCandles(candles);

// Decimate a long series for a 480-pixel-wide thumbnail
const decimated = lttb(series, 480);
```

`@trendcraft/chart/headless` has zero DOM dependencies and is safe to import on the server.

---

## See also

- [GUIDE.md](./GUIDE.md) — the mental model
- [API.md](./API.md) — every exported symbol
- [LIVE.md](./LIVE.md) — streaming / reconnect / backfill
- [PLUGINS.md](./PLUGINS.md) — custom renderers and primitives
