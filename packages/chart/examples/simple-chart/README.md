# simple-chart

Vanilla TypeScript demo for `@trendcraft/chart`.

## Setup

```bash
cd packages/chart/examples/simple-chart
pnpm install --ignore-workspace
pnpm dev
```

`pnpm dev` works on its own: Vite serves `trendcraft` and `@trendcraft/chart` straight from their sources. `pnpm build` also typechecks those sources, which needs the workspace's type packages, so install the workspace once first (`pnpm install --frozen-lockfile` at the repo root).

## What it shows

The smallest useful chart, in one file (`src/main.ts`, under 100 lines):

- `createChart` and `setCandles` with the bundled daily sample data
- trendcraft indicators added with `chart.addIndicator` and taken off with the handle's `remove()`. SMA 50 and Bollinger Bands land on the price pane, while RSI 14 and MACD get panes of their own. The SMA shows the optional style argument (`{ color }`).
- A backtest that buys when SMA 5 crosses above SMA 25 and sells when it crosses back below (a golden / dead cross), drawn with `addBacktest` (trade markers, an equity pane and a summary line) and cleared with `removeBacktest`
- A dark / light theme switch that starts from the OS setting

## Where next

- [`../indicator-showcase`](../indicator-showcase): every indicator preset, the plugins and a live bar-by-bar mode
- [`../simple-react-chart`](../simple-react-chart) and [`../simple-vue-chart`](../simple-vue-chart): the same kind of chart through the React and Vue wrappers
