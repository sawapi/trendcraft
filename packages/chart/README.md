# @trendcraft/chart

A zero-dependency Canvas charting library for OHLC / financial data. Works standalone on plain `{ time, value }[]` data; pairs with TrendCraft to place and style indicators automatically.

[![npm version](https://img.shields.io/npm/v/@trendcraft/chart.svg)](https://www.npmjs.com/package/@trendcraft/chart)
[![npm downloads](https://img.shields.io/npm/dm/@trendcraft/chart.svg)](https://www.npmjs.com/package/@trendcraft/chart)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/@trendcraft/chart.svg)](https://bundlephobia.com/package/@trendcraft/chart)
[![TypeScript types included](https://img.shields.io/npm/types/@trendcraft/chart.svg)](https://www.npmjs.com/package/@trendcraft/chart)
[![license MIT](https://img.shields.io/npm/l/@trendcraft/chart.svg)](https://github.com/sawapi/trendcraft/blob/main/LICENSE)

A standalone Canvas charting library built for OHLC and financial data. Hand it plain candle arrays and `{ time, value }[]` series and it renders candlesticks, lines, bands, and sub-panes. It also ships React/Vue wrappers and a DOM-free headless build.

Optionally, when you pair it with [TrendCraft](https://github.com/sawapi/trendcraft), the chart reads each indicator's shape and metadata to choose pane placement, colors, value range, and render style, so most indicators need no configuration.

![NVDA daily candlesticks with Bollinger Bands (20, 2), SMA(50), and volume](https://raw.githubusercontent.com/sawapi/trendcraft/main/packages/chart/docs/assets/hero.png)

## Install

```bash
npm install @trendcraft/chart
```

That's the only required package.

```bash
# Optional, only if you need them:
npm install trendcraft   # indicator auto-detection + connectIndicators
npm install react        # for @trendcraft/chart/react   (React 18+)
npm install vue          # for @trendcraft/chart/vue      (Vue 3.3+)
```

`trendcraft`, `react`, and `vue` are all **optional** peer deps and none of them is required to draw a chart. Install only the ones you actually use.

## Quick start

### Standalone — just `@trendcraft/chart`

Feed it OHLC candles and a plain `{ time, value }[]` series. The container **must have an explicit height** (the canvas fills its parent).

```html
<div id="chart" style="height:480px"></div>
```

```typescript
import { createChart } from '@trendcraft/chart';

// Plain OHLC candles — any source (REST API, CSV, your DB).
// `time` is epoch milliseconds (Date.now() units), not seconds.
const candles = [
  { time: 1700000000000, open: 100, high: 105, low:  98, close: 104, volume: 1200 },
  { time: 1700086400000, open: 104, high: 108, low: 102, close: 103, volume: 1500 },
  { time: 1700172800000, open: 103, high: 106, low: 100, close: 101, volume:  900 },
  { time: 1700259200000, open: 101, high: 104, low:  99, close: 103, volume: 1100 },
  { time: 1700345600000, open: 103, high: 110, low: 103, close: 109, volume: 2100 },
  { time: 1700432000000, open: 109, high: 112, low: 106, close: 107, volume: 1700 },
  { time: 1700518400000, open: 107, high: 109, low: 104, close: 108, volume: 1300 },
  { time: 1700604800000, open: 108, high: 113, low: 107, close: 112, volume: 1900 },
];

const container = document.getElementById('chart');
if (!container) throw new Error('Chart container not found');

const chart = createChart(container, { theme: 'dark' });
chart.setCandles(candles);

// Any { time, value }[] series renders with a small config — here a simple
// hand-rolled moving average. No TrendCraft involved.
const ma = candles.map((c, i, a) => ({
  time: c.time,
  value: (a.slice(Math.max(0, i - 2), i + 1).reduce((s, x) => s + x.close, 0))
    / Math.min(i + 1, 3),
}));

chart.addIndicator(ma, { pane: 'main', color: '#FF9800', label: 'MA(3)' });
```

### With TrendCraft — auto-detected indicators

If you also install `trendcraft`, pass indicator output straight to `addIndicator` and the chart reads pane placement, colors, y-range, and render style from each indicator's own metadata — no manual series decomposition.

```typescript
import { createChart } from '@trendcraft/chart';
import { sma, rsi, bollingerBands, macd } from 'trendcraft'; // optional peer dep

const chart = createChart(container, { theme: 'dark' });
chart.setCandles(candles);

// Pane, colors, y-range, and render style are read from each indicator's metadata
chart.addIndicator(sma(candles, { period: 20 })); // overlay line on the price pane
chart.addIndicator(bollingerBands(candles));      // band with fill
chart.addIndicator(rsi(candles));                 // sub-pane, 0–100, 30/70 ref lines
chart.addIndicator(macd(candles));                // sub-pane, histogram + 2 lines
```

![Five indicators auto-placed from their own metadata: SMA and Bollinger Bands on the price pane; RSI, Stochastics, and MACD in sub-panes](https://raw.githubusercontent.com/sawapi/trendcraft/main/packages/chart/docs/assets/auto-detection.png)

## Highlights

- **Works standalone** — renders candlestick / OHLC and plain `{ time, value }[]` series without any other library.
- **Core series types** — candlestick, OHLC, line, mountain price rendering, plus band/fill and Ichimoku cloud overlays.
- **Responsive / auto-resize** — a built-in `ResizeObserver` keeps the chart sharp as its container resizes; no manual `resize()` wiring.
- **Touch & pinch-zoom** — pan and pinch-to-zoom on touch devices.
- **Dark / Light + custom theming** — ships dark and light themes, plus fully customizable colors, fonts, and grid styling.
- **Accessibility** — ARIA live region for screen-reader updates and full keyboard navigation of the chart.
- **Drawings & interaction** — trendlines, h-lines, fib retracement/extension, channels, and configurable crosshair magnet modes.
- **Auto-detection (with TrendCraft)** — inspects each `Series<T>` shape (number, band, cloud, MACD, stochastic, DMI, SAR…) plus TrendCraft `__meta` to place and style series without per-series options.
- **Tree-shakeable plugins** — SMC layer, Wyckoff phases, Volume Profile, Market Profile, regime heatmap, price patterns, S/R confluence, squeeze dots, session zones, Andrews pitchfork, trade analysis.
- **Indicator connection** — `connectIndicators` for handle-based add/remove/recompute with optional live streaming.
- **Backtest & analysis** — visualize `BacktestResult` trade markers + equity curve, pattern outlines, and per-bar score heatmaps.
- **React & Vue wrappers** — `<TrendChart>` components plus `useTrendChart` hook/composable for imperative access.
- **Headless API** — DOM-free data layer, scales, layout, and `introspect` for SSR, testing, and custom renderers.
- **Sparkline & replay subpaths** — compact ~4 kB sparklines and a live-feed replay simulator.
- **Bundle size checks** — every major entry point (main, headless, sparkline, replay, React/Vue wrappers) is brotli size-checked in CI.

## Framework bindings

```tsx
// React 18+
import { TrendChart, useTrendChart } from '@trendcraft/chart/react';
```

```vue
<!-- Vue (>=3.3) -->
<script setup>
import { TrendChart, useTrendChart } from '@trendcraft/chart/vue';
</script>
```

Both expose a `<TrendChart>` component (props: `candles`, `indicators`, `signals`, `trades`, `drawings`, `backtest`, `patterns`, `scores`, `theme`, …) and a `useTrendChart` hook/composable that hands you the live `ChartInstance` for drawing tools, live feeds, and plugins. See the [guide](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/GUIDE.md) and [cookbook](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/COOKBOOK.md) for full examples.

## Examples

Runnable example apps live in the repo. Each installs on its own: from the example's directory, run `pnpm install --ignore-workspace`, then `pnpm dev`. (`pnpm build` in an example also type-checks the chart and core sources, so it needs `pnpm install --frozen-lockfile` at the repo root first.)

| Example | What it shows |
|---|---|
| [simple-chart](https://github.com/sawapi/trendcraft/tree/main/packages/chart/examples/simple-chart) | Vanilla TypeScript chart with indicators, drawings, and plugins |
| [indicator-showcase](https://github.com/sawapi/trendcraft/tree/main/packages/chart/examples/indicator-showcase) | Multi-indicator catalog (canonical preset / auto-detection setup) |
| [simple-react-chart](https://github.com/sawapi/trendcraft/tree/main/packages/chart/examples/simple-react-chart) | React wrapper usage |
| [simple-vue-chart](https://github.com/sawapi/trendcraft/tree/main/packages/chart/examples/simple-vue-chart) | Vue wrapper usage |

## Subpath entry points

| Entry | Use |
|---|---|
| `@trendcraft/chart` | `createChart`, `connectIndicators`, plugins, drawing helpers |
| `@trendcraft/chart/headless` | DOM-free `DataLayer`, scales, layout, `introspect`, `lttb` |
| `@trendcraft/chart/react` | `<TrendChart>` component + `useTrendChart` hook |
| `@trendcraft/chart/vue` | `<TrendChart>` component + `useTrendChart` composable |
| `@trendcraft/chart/sparkline` | Vanilla sparkline (also `/react/sparkline`, `/vue/sparkline`) |
| `@trendcraft/chart/replay` | Live-feed replay simulator |
| `@trendcraft/chart/presets` | `registerTrendCraftPresets` for TrendCraft-specific series shapes |

## Documentation

| Doc | Use it when |
|---|---|
| [GUIDE](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/GUIDE.md) | You want the mental model — data model, coordinate system, render loop, theming, viewport, SSR, accessibility |
| [API](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/API.md) | You need the full reference — every option, method, type, and event |
| [COOKBOOK](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/COOKBOOK.md) | You want copy-paste recipes — minimal chart, theming, live data, React/Vue, sparklines, PNG export, headless |
| [PLUGINS](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/PLUGINS.md) | You're writing a custom series renderer or pane primitive |
| [LIVE](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/LIVE.md) | You're wiring a real-time feed — WebSocket → `createLiveCandle` → chart |
| [Migration: 0.5 → 0.6](https://github.com/sawapi/trendcraft/blob/main/packages/chart/docs/migration-0.5-to-0.6.md) | You're upgrading from 0.5 — feature registration, the backtest equity curve, wrapper events |

Also published: [`CHANGELOG.md`](https://github.com/sawapi/trendcraft/blob/main/packages/chart/CHANGELOG.md), and machine-readable [`llms.txt`](./llms.txt) / [`llms-full.txt`](./llms-full.txt).

## Stability

Pre-1.0 (0.x): the API may change between minor versions; see the [CHANGELOG](https://github.com/sawapi/trendcraft/blob/main/packages/chart/CHANGELOG.md). Breaking changes are listed under **Breaking** in the CHANGELOG, with migration notes.

## Disclaimer

`@trendcraft/chart` is a charting library. Its visualizations are derived from technical analysis primitives provided for informational and educational purposes only — they are not investment advice. You are solely responsible for any trading decisions made using this software.

## License

MIT
