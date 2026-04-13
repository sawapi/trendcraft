# simple-react-chart

React demo for `@trendcraft/chart/react`.

## Setup

```bash
cd packages/chart/examples/simple-react-chart
pnpm install --ignore-workspace
pnpm dev
```

## Features

- `<TrendChart>` component with declarative props (`App.tsx`)
- `useTrendChart` hook with imperative effects (`src/HookDemo.tsx`)
- SMA, BB, RSI, MACD toggles via React state
- Backtest result passed as prop
- Dark/Light theme switch

## When to pick each API

- **`<TrendChart>` component** — drop-in chart, all features as props. Simpler for static dashboards.
- **`useTrendChart` hook** — returns `{ containerRef, chart }`. `chart` is reactive state (null → instance), so it composes cleanly with `useEffect` for drawing tools, live feeds, and custom plugins.

```tsx
import { useTrendChart } from '@trendcraft/chart/react';

const { containerRef, chart } = useTrendChart({ candles });

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

- React 19+
