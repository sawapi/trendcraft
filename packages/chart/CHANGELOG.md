# Changelog

All notable changes to `@trendcraft/chart` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<!-- draft -->
<!-- - session gap rendering (ChartOptions.timeScale.sessionGaps, TimeScale.setGapsBefore) -->
<!-- - autoFormatTime shows date anchor after large time jumps within the same local day -->

### Not in this release

- Intraday session gap rendering (weekend/overnight visual gaps for minute data) — tracked for v0.3.
- C1 coverage 90% target — viewport / canvas-chart / drawing-tool DOM integration tests have low ROI; addressed incrementally.
- Plugin live-mode integration — the six differentiation plugins remain static-only until incrementalization lands.

## [0.2.0] - 2026-04-26

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

### Added — last-value badges

- **`ChartOptions.showSeriesBadges`** — opt-in. When enabled, every labeled series gets a colored pill on the right price axis showing its latest value, mirroring the existing candle current-price badge. Multi-channel series (Bollinger Bands / MACD / etc.) get one pill per decomposed channel, each in its own `channelColors[channel]`. The volume pane also gets a pill colored by the last bar direction. Tick labels that would collide with a pill are suppressed; pills stacked on the same axis are shifted upward to clear each other and skipped if a shift would push them off the pane. Default: `false`.
- **`ChartOptions.seriesBadgeMode`** — `"absolute"` (default) shows the data array's latest non-null value (live / streaming "current" value). `"visible"` shows the latest non-null value within the current visible range — useful when scrolling back through history.
- **`PriceAxisOptions.excludeYRanges`** (headless) — a list replaces the singular `excludeY` / `excludeHalfHeight` fields so multiple foreground labels can be avoided by the tick placer. The old single-range fields remain supported for back-compat.

### Fixed

- **Decimation alignment** — at low zoom (`barSpacing < 1 px`, e.g. Fit-content on a large dataset) candles and number-series indicators used three different decimation paths that disagreed on x-coordinates, so overlays (SMA / RSI / EMA / …) drifted left of the bars they were supposed to annotate. All three paths now share the original `timeScale` coordinate space via bucket-origin indices carried through the render pipeline.
- **Right price-axis label overlap** — with many stacked panes the right-side tick labels crowded together and the current-price badge could overlap neighboring ticks. The axis now picks a tick density from pane height, suppresses labels within a half-label of pane edges, and skips ticks that would collide with the current-price badge Y on the main pane.
- **Info + legend overlap** — when many indicators were active the top-left OHLC/indicator readout grew past the top-right legend button row. The legend is now placed on its own second row, and the info strip gets a max-width + ellipsis safety net.
- **Indicator color cycling on re-add** — removing and re-adding an indicator (for example when a showcase / alpaca-demo panel applies a parameter change) would assign the next palette slot instead of the one just vacated, so colors appeared to "change on events". Auto-assigned colors now prefer the first palette entry not currently in use.
- **Scrollbar thumb jumps to cursor on grab** — pressing anywhere on the thumb recentered the visible range on the pointer; now press-on-thumb records the grab offset so the thumb stays pinned where grabbed, while press-on-track still page-jumps.

### Breaking

- `decimateCandles(candles, start, end, maxBars)` now returns `{ candles, originalIndices: Int32Array }` instead of `CandleData[]`. Exposed via `@trendcraft/chart/headless`.
- `lttb(data, targetCount)` now returns `{ points, originalIndices: Int32Array }` instead of `DataPoint[]`, and accepts an optional 3rd `indexOffset` argument to shift `originalIndices` into the caller's coordinate space. Exposed via `@trendcraft/chart/headless`.

### Changed

- Bundle size budgets raised (brotli) to absorb the UX pass and last-value badges. The new limits are expected to hold through the 0.2.x line; future feature work either lives on a sub-path or compensates with equivalent reductions elsewhere.

  | Entry | 0.1.0 limit | 0.2.0 limit |
  | --- | --- | --- |
  | Main (`@trendcraft/chart`) | 31 kB | **36 kB** |
  | Headless (`@trendcraft/chart/headless`) | 11 kB | 11 kB |
  | React (`@trendcraft/chart/react`) | 27 kB | **30 kB** |
  | Vue (`@trendcraft/chart/vue`) | 27 kB | **30 kB** |

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

[0.2.0]: https://github.com/sawapi/trendcraft/releases/tag/chart-v0.2.0
[0.1.0]: https://github.com/sawapi/trendcraft/releases/tag/chart-v0.1.0
