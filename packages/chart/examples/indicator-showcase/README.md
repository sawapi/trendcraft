# indicator-showcase

Catalog demo for `@trendcraft/chart`. Every preset in `indicatorPresets` from
`trendcraft` (104+ entries) is exposed via a categorized sidebar with parameter
controls, live mode, signal panel, and plugin panel; `registerTrendCraftPresets`
wires up their TrendCraft-specific rendering.

## Setup

```bash
cd packages/chart/examples/indicator-showcase
pnpm install --ignore-workspace
pnpm dev
```

`pnpm dev` works on its own: Vite serves `trendcraft` and `@trendcraft/chart` straight from their sources. `pnpm build` also typechecks those sources, which needs the workspace's type packages, so install the workspace once first (`pnpm install --frozen-lockfile` at the repo root).

## What you can do

- **Browse all presets** — sidebar is auto-generated from `indicatorPresets`
  metadata, grouped by category (moving-average, momentum, volatility, …).
- **Tweak parameters** — each entry exposes `paramSchema` controls.
- **Timeframe toggle (Daily / 1H)** — the bundled daily sample data, or a synthetic
  1-hour dataset (14 days × 24 bars, see `src/data-intraday.ts`) so the
  intraday-only Session Zones plugin (ICT kill-zone backgrounds) can be demo'd.
- **Static / Live toggle** — replays the dataset bar-by-bar through
  `connectIndicators({ live })`, exercising the same code path that production
  live feeds use. Switching mode or timeframe keeps the selected indicators
  (with their params), plugins and signals; plugins and signals are rebuilt
  against the new candles.
- **Signals panel** — overlay detected signals (crosses, divergences, …).
  RSI Divergence adds RSI(14) when no RSI is on, so its RSI-pane connectors
  show; turning the signal off removes that RSI again unless you changed it.
- **Plugins panel** — toggle Regime Heatmap, SMC Layer, Wyckoff Phase, etc.
- **Toolbar** — each toggle shows `Name: current state` (`Timeframe`, `Chart`,
  `Badges`, `Mode`, `Theme`); `Fit` and `Export PNG` are plain actions.
- **Last-value badges** — `Badges` and `Mode` toolbar buttons exercise
  `showSeriesBadges` / `seriesBadgeMode` (absolute vs visible).
- **Theme + PNG export** — light/dark (starts from the OS colour scheme; the
  whole UI follows the CSS tokens in `index.html`) and
  `chart.toImage("image/png")`.

## When to read this code

- Looking for a worked example of `connectIndicators` (bulk preset hookup) — see
  `src/main.ts`.
- Looking for a live-replay pattern — see `src/live-simulator.ts` +
  `src/live-panel.ts`.
- Looking for plugin wiring (`createRegimeHeatmap`, `createSmcLayer`, etc.) —
  see `src/plugins-panel.ts`.

For the smallest starting point, a few indicators in under 100 lines, see [`../simple-chart`](../simple-chart).
