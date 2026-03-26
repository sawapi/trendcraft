# @trendcraft/chart

Finance-specialized charting library with native [TrendCraft](https://github.com/sawapi/trendcraft) integration. Pass indicator data, get a chart — no manual series decomposition needed.

## Install

```bash
npm install @trendcraft/chart trendcraft
```

## Quick Start

```typescript
import { createChart } from '@trendcraft/chart';
import { sma, rsi, bollingerBands, ichimoku, macd } from 'trendcraft';

const chart = createChart(document.getElementById('chart'), { theme: 'dark' });
chart.setCandles(candles);

// Indicators auto-detect pane placement, colors, and rendering style
chart.addIndicator(sma(candles, { period: 20 }));     // overlay on price chart
chart.addIndicator(bollingerBands(candles));            // bands with fill
chart.addIndicator(ichimoku(candles));                  // cloud with 5 lines
chart.addIndicator(rsi(candles));                       // subchart, 0-100, ref lines 30/70
chart.addIndicator(macd(candles));                      // subchart, histogram + 2 lines
```

No `pane`, `color`, `yRange`, or `label` config needed — the library reads `__meta` from TrendCraft's 130+ indicators.

### Without TrendCraft

Works with any `{ time, value }[]` data:

```typescript
const myData = prices.map(p => ({ time: p.timestamp, value: p.close }));
chart.addIndicator(myData, { pane: 'main', color: '#FF9800', label: 'My Line' });
```

## React

```tsx
import { TrendChart } from '@trendcraft/chart/react';
import { sma, rsi } from 'trendcraft';

<TrendChart
  candles={candles}
  indicators={[sma(candles, { period: 20 }), rsi(candles)]}
  backtest={backtestResult}
  theme="dark"
  onCrosshairMove={(data) => console.log(data)}
/>
```

All chart features are available as props: `indicators`, `signals`, `trades`, `drawings`, `timeframes`, `backtest`, `patterns`, `scores`. Access the underlying `ChartInstance` via ref.

## Vue

```vue
<script setup>
import { TrendChart } from '@trendcraft/chart/vue';
import { sma, rsi } from 'trendcraft';
</script>

<template>
  <TrendChart
    :candles="candles"
    :indicators="[sma(candles, { period: 20 }), rsi(candles)]"
    :backtest="backtestResult"
    theme="dark"
    @crosshairMove="onCrosshairMove"
  />
</template>
```

Same full prop set as React. Reactive updates via Vue's `watch`.

## API Reference

### `createChart(container, options?)`

Creates a chart instance attached to a DOM element.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `theme` | `'dark' \| 'light' \| ThemeColors` | `'dark'` | Color theme |
| `width` | `number` | container width | Chart width (px) |
| `height` | `number` | `400` | Chart height (px) |
| `fontSize` | `number` | `11` | Font size (px) |
| `priceAxisWidth` | `number` | `60` | Right axis width (px) |
| `timeAxisHeight` | `number` | `24` | Bottom axis height (px) |
| `priceFormatter` | `(price: number) => string` | auto-precision | Custom price format |
| `timeFormatter` | `(time: number) => string` | smart date/time | Custom time format |
| `watermark` | `string` | — | Background watermark text |
| `legend` | `boolean` | `true` | Show series legend |

### ChartInstance Methods

#### Data

| Method | Description |
|---|---|
| `setCandles(candles)` | Set OHLCV candle data |
| `updateCandle(candle)` | Update last candle or append new one |

#### Indicators

| Method | Description |
|---|---|
| `addIndicator(series, config?)` | Add indicator with auto-detection. Returns `SeriesHandle` |
| `getAllSeries()` | Get info for all series (id, pane, type, label, visible) |

#### Signals & Trades

| Method | Description |
|---|---|
| `addSignals(signals)` | Add buy/sell signal markers |
| `addTrades(trades)` | Add trade entry/exit markers with holding period shading |

#### Drawings

| Method | Description |
|---|---|
| `addDrawing(drawing)` | Add a drawing (hline, trendline, fibRetracement) |
| `removeDrawing(id)` | Remove a drawing by id |
| `getDrawings()` | Get all drawings |
| `setDrawingTool(tool)` | Set active drawing tool mode (`null` to disable) |

#### Multi-Timeframe

| Method | Description |
|---|---|
| `addTimeframe(overlay)` | Add higher timeframe candles as semi-transparent overlay |
| `removeTimeframe(id)` | Remove a timeframe overlay |

#### Backtest & Analysis (TrendCraft Integration)

| Method | Description |
|---|---|
| `addBacktest(result)` | Visualize `BacktestResult` — trade markers, equity curve, summary |
| `addPatterns(patterns)` | Draw `PatternSignal[]` — outlines, necklines, targets |
| `addScores(scores)` | Per-bar score heatmap (0=red, 50=yellow, 100=green) |

#### Viewport

| Method | Description |
|---|---|
| `setVisibleRange(start, end)` | Set visible time range |
| `fitContent()` | Fit all candles in view |
| `getVisibleRange()` | Get current visible range (start/end time and index) |
| `setLayout(config)` | Configure multi-pane layout with flex proportions |

#### Events

| Method | Description |
|---|---|
| `on(event, handler)` | Subscribe to chart events |
| `off(event, handler)` | Unsubscribe from chart events |

#### Theme & Export

| Method | Description |
|---|---|
| `setTheme(theme)` | Change color theme |
| `toImage(type?, quality?)` | Export chart as image `Blob` |
| `resize(width, height)` | Resize chart |
| `destroy()` | Clean up all resources |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| ← → | Pan left/right (Shift: 10 bars) |
| + / - | Zoom in/out |
| Home / End | Jump to start/end |
| F | Fit all content |

## Series Auto-Detection

The library inspects the first value in a `Series<T>` to determine rendering:

| Value Shape | Rendering | Example |
|---|---|---|
| `number` | Line | SMA, RSI, ATR |
| `{ upper, middle, lower }` | Band with fill | Bollinger Bands, Keltner |
| `{ tenkan, kijun, senkouA, senkouB }` | Ichimoku cloud | Ichimoku |
| `{ macd, signal, histogram }` | Multi-line + histogram | MACD |
| `{ k, d }` | Oscillator lines | Stochastics |
| `{ adx, plusDi, minusDi }` | Multi-line | DMI |
| `{ sar }` | Dot markers | Parabolic SAR |

TrendCraft indicators carry `__meta` with `overlay`, `label`, `yRange`, and `referenceLines` for zero-config pane placement. Custom rules can be added via `SeriesRegistry.addRule()`.

## Drawings

```typescript
chart.addDrawing({ id: 'h1', type: 'hline', price: 150, color: '#FF9800' });

chart.addDrawing({
  id: 'tl1', type: 'trendline',
  startTime: t1, startPrice: 140,
  endTime: t2, endPrice: 160,
});

chart.addDrawing({
  id: 'fib1', type: 'fibRetracement',
  startTime: t1, startPrice: 130,
  endTime: t2, endPrice: 170,
});

chart.removeDrawing('h1');
```

## Backtest Visualization

```typescript
import { runBacktest, goldenCrossCondition, rsiBelow } from 'trendcraft';

const result = runBacktest(candles, goldenCrossCondition(), rsiBelow(70), { capital: 100000 });
chart.addBacktest(result);
// → Trade markers colored by exit reason
// → Equity curve subchart with drawdown shading
// → Summary bar (Return, Win%, Sharpe, MaxDD, PF, Trades)
```

## Pattern Visualization

```typescript
import { doubleTop, headAndShoulders } from 'trendcraft';

chart.addPatterns([...doubleTop(candles), ...headAndShoulders(candles)]);
// → Pattern outlines connecting key points
// → Neckline, target price, pattern name + confidence
```

## Score Heatmap

```typescript
import { rsi } from 'trendcraft';

chart.addScores(rsi(candles));
// → Each candle's background colored by score (red → yellow → green)
```

## Events

```typescript
chart.on('crosshairMove', (data) => {
  // { time, index, ohlcv: { open, high, low, close, volume }, paneId }
});

chart.on('seriesAdded', (data) => { /* { id, label } */ });
chart.on('seriesRemoved', (data) => { /* { id } */ });
chart.on('visibleRangeChange', (data) => { /* { startTime, endTime } */ });
```

## Headless API

For server-side processing, custom renderers, or testing:

```typescript
import {
  DataLayer, TimeScale, PriceScale, LayoutEngine,
  introspect, autoFormatPrice, lttb,
} from '@trendcraft/chart/headless';

const model = new DataLayer();
model.setCandles(candles);

const result = introspect(myIndicatorData);
// { seriesType: 'band', pane: 'main', rule, preset, yRange, referenceLines }
```

## Troubleshooting

**Chart is blank** — Ensure container has a non-zero height. Set `height` in options or use CSS `height: 100%`.

**Indicator on wrong pane** — Without TrendCraft, number series default to subchart. Use `{ pane: 'main' }` for overlays.

**Performance with large datasets** — The library auto-decimates via LTTB at high zoom levels. 10K+ candles should maintain 60fps.

**Pane won't disappear after removing indicator** — Panes auto-remove when their last series is removed. If using `addTrades`/`addBacktest`, the equity pane persists.

## License

MIT
