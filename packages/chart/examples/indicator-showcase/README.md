# indicator-showcase

Catalog demo for `@trendcraft/chart`. Every preset registered with
`registerTrendCraftPresets` (96+ entries) is exposed via a categorized sidebar
with parameter controls, live mode, signal panel, and plugin panel.

## Setup

```bash
cd packages/chart/examples/indicator-showcase
pnpm install --ignore-workspace
pnpm dev
```

## What you can do

- **Browse all presets** — sidebar is auto-generated from `indicatorPresets`
  metadata, grouped by category (moving-average, momentum, volatility, …).
- **Tweak parameters** — each entry exposes `paramSchema` controls.
- **Daily / Intraday toggle** — the bundled daily sample data, or a synthetic
  1-minute dataset (see `src/data-intraday.ts`) so intraday-only plugins like
  Session Zones or ICT Kill Zones can be demo'd.
- **Static / Live Simulate toggle** — replays the dataset bar-by-bar through
  `connectIndicators({ live })`, exercising the same code path that production
  live feeds use.
- **Signals panel** — overlay detected signals (crosses, divergences, …).
- **Plugins panel** — toggle Regime Heatmap, SMC Layer, Wyckoff Phase, etc.
- **Last-value badges** — `Badges` and `Mode` toolbar buttons exercise
  `showSeriesBadges` / `seriesBadgeMode` (absolute vs visible).
- **Theme + PNG export** — light/dark and `chart.exportPng()`.

## When to read this code

- Looking for a worked example of `connectIndicators` (bulk preset hookup) — see
  `src/main.ts`.
- Looking for a live-replay pattern — see `src/live-simulator.ts` +
  `src/live-panel.ts`.
- Looking for plugin wiring (`createRegimeHeatmap`, `createSmcLayer`, etc.) —
  see `src/plugins-panel.ts`.

For a smaller "one indicator at a time" demo, see [`../simple-chart`](../simple-chart).
