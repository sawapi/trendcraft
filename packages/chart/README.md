# @trendcraft/chart

Finance-specialized charting library with native [TrendCraft](https://github.com/sawapi/trendcraft) integration.

## Features

| Feature | @trendcraft/chart | Lightweight Charts | ECharts |
|---|---|---|---|
| Series\<T\> auto-detection | **Yes** | No | No |
| 1-line indicator rendering | **Yes** | No | No |
| Bundle size (gzip) | ~9KB | ~16KB | ~100KB+ |
| Multi-pane layout | **Flex-based** | Limited | Manual pixel math |
| Signal/Trade overlay | **Zero-config** | Manual | Manual |
| Canvas rendering | Yes | Yes | Yes |
| Zero dependencies | Yes | Yes | No |

## Quick Start

```bash
npm install @trendcraft/chart trendcraft
```

```typescript
import { createChart } from '@trendcraft/chart';
import { sma, rsi, bollingerBands, ichimoku, macd } from 'trendcraft';

const chart = createChart(document.getElementById('chart'), { theme: 'dark' });
chart.setCandles(candles);

// Indicators auto-detect pane placement, colors, and rendering style
chart.addIndicator(sma(candles, { period: 20 }));     // → overlay on price chart
chart.addIndicator(bollingerBands(candles));            // → bands with fill
chart.addIndicator(ichimoku(candles));                  // → cloud with 5 lines
chart.addIndicator(rsi(candles));                       // → subchart, 0-100, ref lines 30/70
chart.addIndicator(macd(candles));                      // → subchart, histogram + 2 lines
```

No `pane`, `color`, `yRange`, or `label` config needed — the library reads `__meta` from TrendCraft's 130+ indicators.

## Without TrendCraft

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
  theme="dark"
/>
```

## API

### `createChart(container, options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `theme` | `'dark' \| 'light' \| ThemeColors` | `'dark'` | Color theme |
| `width` | `number` | container width | Chart width (px) |
| `height` | `number` | `400` | Chart height (px) |
| `fontSize` | `number` | `11` | Font size (px) |

### ChartInstance

| Method | Description |
|---|---|
| `setCandles(candles)` | Set OHLCV candle data |
| `updateCandle(candle)` | Update last candle or append new one |
| `addIndicator(series, config?)` | Add indicator with auto-detection |
| `addSignals(signals)` | Add buy/sell signal markers |
| `addTrades(trades)` | Add trade entry/exit markers |
| `setLayout(config)` | Configure multi-pane layout |
| `setVisibleRange(start, end)` | Set visible time range |
| `fitContent()` | Fit all candles in view |
| `setTheme(theme)` | Change color theme |
| `getAllSeries()` | Get all series info |
| `getVisibleRange()` | Get current visible range |
| `toImage(type?, quality?)` | Export chart as image Blob |
| `resize(width, height)` | Resize chart |
| `destroy()` | Clean up resources |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| ← → | Pan left/right (Shift: 10 bars) |
| + / - | Zoom in/out |
| Home / End | Jump to start/end |
| F | Fit all content |

### Headless API

```typescript
import { DataLayer, TimeScale, PriceScale, LayoutEngine } from '@trendcraft/chart/headless';
```

For server-side processing, custom renderers, or testing.

## Series Auto-Detection

The library inspects the first value in a Series\<T\> to determine rendering:

| Value Shape | Rendering | Example |
|---|---|---|
| `number` | Line | SMA, RSI, ATR |
| `{ upper, middle, lower }` | Band with fill | Bollinger Bands, Keltner |
| `{ tenkan, kijun, senkouA, senkouB }` | Ichimoku cloud | Ichimoku |
| `{ macd, signal, histogram }` | Multi-line + histogram | MACD |
| `{ k, d }` | Oscillator lines | Stochastics |
| `{ adx, plusDi, minusDi }` | Multi-line | DMI |
| `{ sar }` | Dot markers | Parabolic SAR |

TrendCraft indicators also carry `__meta` with `overlay`, `label`, `yRange`, and `referenceLines` for zero-config rendering.

## Drawings

```typescript
// Horizontal line
chart.addDrawing({ id: 'h1', type: 'hline', price: 150, color: '#FF9800' });

// Trend line
chart.addDrawing({
  id: 'tl1', type: 'trendline',
  startTime: t1, startPrice: 140,
  endTime: t2, endPrice: 160,
});

// Fibonacci retracement
chart.addDrawing({
  id: 'fib1', type: 'fibRetracement',
  startTime: t1, startPrice: 130,
  endTime: t2, endPrice: 170,
});

// Remove
chart.removeDrawing('h1');
```

## Events

```typescript
chart.on('crosshairMove', (data) => {
  // { time, index, ohlcv: { open, high, low, close, volume }, paneId }
});

chart.on('seriesAdded', (data) => {
  // { id, label }
});
```

## Options

```typescript
createChart(container, {
  theme: 'dark',
  watermark: 'DEMO',       // Background watermark text
  legend: true,             // Show series legend (default: true)
  priceFormatter: (p) => p.toFixed(2),  // Custom price format
  timeFormatter: (t) => new Date(t).toLocaleDateString(),
});
```

## Headless API

For server-side processing, custom renderers, or testing:

```typescript
import { DataLayer, TimeScale, PriceScale, LayoutEngine } from '@trendcraft/chart/headless';
import { introspect } from '@trendcraft/chart/headless';

const data = new DataLayer();
data.setCandles(candles);

const result = introspect(myIndicatorData);
// { seriesType: 'band', pane: 'main', ... }
```

## Troubleshooting

**Chart is blank**: Ensure container has a non-zero height. Set `height` in options or use CSS.

**Indicator on wrong pane**: Without trendcraft, number series default to subchart. Use `{ pane: 'main' }` for overlays.

**Performance with large datasets**: The library auto-decimates at high zoom levels. For 10K+ candles, this should maintain 60fps.

## License

MIT
