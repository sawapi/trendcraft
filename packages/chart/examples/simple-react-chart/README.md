# simple-react-chart

React demo for `@trendcraft/chart/react`.

## Setup

```bash
cd packages/chart/examples/simple-react-chart
pnpm install --ignore-workspace
pnpm dev
```

`pnpm dev` works on its own: Vite serves `trendcraft` and `@trendcraft/chart` straight from their sources. `pnpm build` also typechecks those sources, which needs the workspace's type packages, so install the workspace once first (`pnpm install --frozen-lockfile` at the repo root).

## Features

The header has two tabs, one per API:

- **Component** — `<TrendChart>` with declarative props (`src/App.tsx`)
- **Hook** — `useTrendChart` with imperative effects (`src/HookDemo.tsx`): click the chart to place a horizontal line and watch the `drawingComplete` event

The Component tab shows:

- SMA, BB, RSI, MACD toggles via React state
- A golden-cross / dead-cross backtest passed as a prop; turning it off sets the prop back to `undefined`, which clears the markers and the equity pane
- Custom renderers and primitives passed through the wrapper's `plugins` prop:
  - **S/R Zones** — a primitive (`definePrimitive`) that shades support/resistance bands behind the candles
  - **Trail Stop** — a custom series renderer (`defineSeriesRenderer`) that draws an ATR trailing stop as a stepped line on the price pane; the indicator entry selects it with `config: { type: "trailingStop", pane: "main" }`
- **Vol Overlay** — an indicator entry with its own `config` (`pane: "main"`, `scaleId: "left"`, `maxHeightRatio`) that draws volume along the bottom of the price pane instead of in its own pane
- Dark/Light theme switch (the initial theme follows `prefers-color-scheme`), applied to both tabs through the `theme` prop

## When to pick each API

- **`<TrendChart>` component** — drop-in chart, all features as props. Simpler for static dashboards.
- **`useTrendChart` hook** — returns `{ containerRef, chart }`. `chart` is reactive state (null → instance), so it composes cleanly with `useEffect` for drawing tools, live feeds, and custom plugins.

```tsx
import { registerDrawingTools } from '@trendcraft/chart/features';
import { useTrendChart } from '@trendcraft/chart/react';

const { containerRef, chart } = useTrendChart({ candles, features: [registerDrawingTools] });

useEffect(() => {
  if (!chart) return;
  chart.setDrawingTool('hline');
  const off = (d) => console.log('drawing:', d);
  chart.on('drawingComplete', off);
  return () => chart.off('drawingComplete', off);
}, [chart]);

return <div ref={containerRef} style={{ width: '100%', height: 400 }} />;
```

## Requirements

- React 18+
