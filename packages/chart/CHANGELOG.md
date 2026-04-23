# Changelog

All notable changes to `@trendcraft/chart` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<!-- draft: polish before release -->
<!-- - session gap rendering (ChartOptions.timeScale.sessionGaps, TimeScale.setGapsBefore) -->
<!-- - autoFormatTime shows date anchor after large time jumps within the same local day -->

### Added — UX pass

- **Crosshair snap modes** via `ChartOptions.crosshair`:
  - `"normal"` (default) — current behavior, time-index snap only
  - `"magnet"` — y snaps to the active bar's close
  - `"magnetOHLC"` — y snaps to the nearest of O/H/L/C within `snapThreshold` pixels
- **Readable crosshair labels** — price/time label text color is now chosen via WCAG relative luminance of the crosshair background, so custom themes remain legible without manual tuning. New helper `pickReadableTextColor` exposed internally.
- **Wheel/trackpad pan inertia** — flick gestures decelerate via the shared inertia loop instead of stopping dead on the last event. Opt out with `interaction: { wheelInertia: false }`. Note: on macOS the trackpad has its own OS-level momentum scroll that keeps sending wheel events for a few hundred ms after the user lifts their fingers — those are indistinguishable from user input and are always processed; this option only governs the synthetic tail we add once OS momentum is done.
- **Escape cancels** every transient interaction (drag, both inertia loops, long-press crosshair lock, and any in-progress drawing tool) in one press.
- **Keyboard shortcuts** on focused canvases: `Alt+H` hline, `Alt+V` vline, `Alt+T` trendline, `Alt+F` fib retracement, `Alt+C` channel, `Ctrl+Alt+H` hide/show every series, `Escape` cancel. Customize or disable via `ChartOptions.hotkeys`. Matching uses `KeyboardEvent.code` so Option+letter combos on macOS resolve correctly despite the altered character output. Passing `hotkeys: false` now disables every keyboard interaction — including the pre-existing viewport nav keys (arrows / `+` / `-` / `Home` / `End` / `F`) — so a single flag hands all keyboard handling back to the host.
- **`chart.setCrosshair(time)`** — programmatic crosshair control for external consumers that want to drive the crosshair without a DOM pointer event.
- **`visibleRangeChange` event** is now actually emitted (was declared but unused). Fires when the visible range changes.

### Changed

- Bundle size budget for the main entry raised from 31 kB → 32 kB (brotli). The raise reflects the intentional UX additions above and is expected to hold through the 0.2.x line — future feature work either lives on a sub-path or compensates with equivalent reductions elsewhere.

### Internal

- Seed infrastructure for multi-chart synchronization (`ViewportState.crosshairFractional` / `crosshairTime`, fractional time emission on `visibleRangeChange`, programmatic `setCrosshair(time)`). Not exported from any public entry point yet — cross-timeframe viewport sync proved trickier than the surface API suggests, so it's held back until the UX is tuned.

## [0.1.0] - 2026-04-20

Initial public release.

### Added

- Canvas-based financial charting library with zero runtime dependencies.
- Main entry (`@trendcraft/chart`): `createChart`, `connectIndicators` (unified static + live wiring).
- Headless entry (`@trendcraft/chart/headless`): `DataLayer`, `TimeScale`, `PriceScale`, `introspect`, `lttb`.
- React wrapper (`@trendcraft/chart/react`): `TrendChart` component and `useTrendChart` hook.
- Vue wrapper (`@trendcraft/chart/vue`): `TrendChart` component and `useTrendChart` composable.
- Preset indicators entry (`@trendcraft/chart/presets`).
- 13 series types: candlestick, line, area, histogram, band, cloud, marker, heatmap, arrow, signal, zone, labels, shapes.
- Plugin system: `defineSeriesRenderer`, `definePrimitive`.
- Auto-detection of TrendCraft `Series<T>` indicators via `introspect` (reads `__meta` set by core's `tagSeries`).
- Drawing auto-injection helpers: `addAutoFibRetracement`, `addAutoFibExtension`, `addAutoTrendLine`, `addAutoChannelLine`. Consume pre-computed swing anchors and emit the chart's built-in drawing types — no primitive plugin required. Keeps the chart package runtime-free of `trendcraft`.
- `createAndrewsPitchfork` / `connectAndrewsPitchfork` — primitive plugin that renders the three parallel pitchfork lines from three swing anchors (P0 + P1 + P2). Extends forward indefinitely across the visible range.
- `connectSmcLayer` now accepts an optional `choch` source alongside `bos`. Both use the same per-bar shape but render with separate labels ("BOS" vs "CHoCH"), so you can feed `breakOfStructure()` and `changeOfCharacter()` simultaneously to distinguish structural breaks from trend-reversing ones.
- `createVolumeProfile` / `connectVolumeProfile` — primitive plugin that renders a horizontal volume-by-price histogram along the right edge of the chart, with separate fills for the Value Area and a dashed POC line spanning the pane. Configurable strip width (fractional or pixel), highlight toggle, and color overrides.
- `createSqueezeDots` / `connectSqueezeDots` — primitive plugin that renders TTM-style squeeze dots along the bottom of the price pane: red dot per active-squeeze bar, green dot at each release. Consumes `bollingerSqueeze()` output (or any compatible `{ time }`-keyed signal list).
- SSR safety: headless exports work without a DOM; DOM exports throw a clear error in non-browser environments.
- ARIA accessibility support via `ChartAria`.
- Bundle size limits enforced via `size-limit` (brotli): main ≤ 31 kB, headless ≤ 11 kB, React ≤ 27 kB, Vue ≤ 27 kB.

### Changed

- `buildSeriesConfig` now uses `meta.label` as-is instead of wrapping it with `(params.period)`. Core v0.2.0 emits parameterized labels (`"SMA(20)"` etc.) directly, so the extra wrap would have produced `"SMA(20)(20)"`.
- Drop fixed `color` preset for the moving-average family (SMA / EMA / WMA / VWMA / KAMA / HMA / T3 / McGinley / DEMA / TEMA / ZLEMA / ALMA / FRAMA) in `registerTrendCraftPresets`. Multi-instance MA setups (e.g. 5/20/60 ribbon) now pick up distinct auto-cycled colors from the chart palette. Callers that want a specific color for one instance can still pass `color` via `SeriesConfig`.

### Peer dependencies

- `trendcraft` (optional, `>=0.2.0`) — enables auto-detection of indicator series and powers `connectIndicators` via `livePresets` / `indicatorPresets` / `createLiveCandle`.
- `react` (optional, `>=19.0.0`) — required only when using the React wrapper.
- `vue` (optional, `>=3.3.0`) — required only when using the Vue wrapper.

[0.1.0]: https://github.com/sawapi/trendcraft/releases/tag/chart-v0.1.0
