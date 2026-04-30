# trading-simulator

Browser-based **bar-replay practice tool** built on `trendcraft`. Drop a CSV
(or pull intraday bars from Alpaca), step bars forward one at a time, and
practice entries / exits with the same indicators and incremental engine you
would use in a backtest.

This is a learning / journaling tool, not a backtest harness — for that, see
the `backtest()` API in `trendcraft` and the `echarts-viewer` example.

## Setup

```bash
cd packages/core/examples/trading-simulator
pnpm install --ignore-workspace
pnpm dev
```

## What you can do

- **Load data**: drop a CSV, paste a symbol for Alpaca pull, or use the bundled
  quick-start dataset.
- **Replay**: play / pause / step / speed control via `playbackSlice`.
- **Trade**: market / limit / stop orders, position panel, partial close,
  break-even stop.
- **Indicators**: standard set (SMA, EMA, RSI, MACD, BB, ATR, …) with the
  incremental implementations under `src/store/slices/incrementalIndicatorSlice.ts`.
- **Drawings**: trend lines, H-lines, Fibonacci on a separate drawing layer.
- **Coaching panel**: rule-based hints (volume spikes, divergences, MTF
  alignment) — see `src/store/slices/coachingSlice.ts`.
- **Trade analysis**: MFE / MAE, holding period, streaks, exit reason — see
  `src/components/TradeAnalysis.tsx`.
- **Session persistence**: open positions, drawings, settings survive reloads
  via `useSessionPersistence`.
- **Performance review**: end-of-session report covering equity curve, win
  rate, expectancy, and per-trade breakdowns.
- **Keyboard shortcuts**: see `useKeyboardShortcuts` and the in-app help panel.

## When to read this code

- For an end-to-end consumer of incremental indicators, see
  `src/store/slices/incrementalIndicatorSlice.ts`.
- For a Zustand-with-slices pattern, see `src/store/`.
- For a non-trivial `trendcraft` UI integration that isn't `@trendcraft/chart`,
  this is the largest example in the repo.

## Notes

- This example renders with **ECharts**, not `@trendcraft/chart`. It predates
  the chart package and has not been migrated yet.
- The Alpaca client expects `VITE_ALPACA_API_KEY` / `VITE_ALPACA_API_SECRET`
  in `.env.local` if you want live data; otherwise CSV / quick-start works.
