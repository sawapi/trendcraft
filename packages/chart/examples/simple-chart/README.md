# simple-chart

Vanilla TypeScript demo for `@trendcraft/chart`.

## Setup

```bash
cd packages/chart/examples/simple-chart
pnpm install --ignore-workspace
pnpm dev
```

`pnpm dev` works on its own: Vite serves `trendcraft` and `@trendcraft/chart` straight from their sources. `pnpm build` also typechecks those sources, which needs the workspace's type packages, so install the workspace once first (`pnpm install --frozen-lockfile` at the repo root).

## Features

- SMA, Bollinger Bands, Ichimoku, RSI, MACD toggles
- Drawing tools (H-Line, Fibonacci)
- Backtest visualization (Golden Cross strategy)
- Score heatmap (RSI as background color)
- Dark/Light theme switch
