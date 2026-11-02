# sparkline-showcase

Catalog demo for the `@trendcraft/chart/sparkline` subpath — small inline
canvases (32 px tall, about 100–170 px wide here) for ticker tables and dashboards.

## Setup

```bash
cd packages/chart/examples/sparkline-showcase
pnpm install --ignore-workspace
pnpm dev
```

## What you can do

- **Modes**: `line + fill` and `candle`.
- **Color presets**: `auto`, `period` (single color), `baseline` (split at a
  reference value), `fixed`.
- **Count**: 50 / 200 / 500 sparklines on one page — exercises the rendering
  budget on dense dashboards.
- **Session controls**:
  - `Full` — data fills the width.
  - `Mid-session` / `Late-session` — uses `totalSlots` to reserve space for
    bars that have not arrived yet (right side stays blank).
  - `JPX session w/ lunch break` — time-based `session` definition with a
    `breaks` window; the lunch gap renders as a visible break.
- **Group hover** — `createSparklineGroup({ hover: true })` attaches one
  listener to the container and shares one tooltip across the group; it shows
  the value under the cursor for the sparkline you are hovering only.
- **Responsive list** — rows flow into as many columns as fit the window, and
  the sparkline column stretches with it; at phone width it is one column.
- **Theme** — the Light / Dark button switches the page and the sparklines
  (their `colors` follow the page's colour tokens). The initial theme follows
  the OS setting.
- **Regenerate** — reseeds the synthetic price series.

## When to read this code

- Looking for `createSparklineGroup` usage and per-row `SparklineOptions` — see
  `src/main.ts`.
- Looking for the smallest possible sparkline call site — see the README of
  the main [`@trendcraft/chart`](../../README.md#subpath-entry-points) package.

## Bundle reference

Sparkline is its own subpath; see the `size-limit` field in
`packages/chart/package.json` for the current brotli budget. Importing from `@trendcraft/chart/sparkline` does not
pull in the main chart code.
