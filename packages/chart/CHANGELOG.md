# Changelog

All notable changes to `@trendcraft/chart` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Draft for the initial public release. Date and final version are set at release time.

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

[Unreleased]: https://github.com/sawapi/trendcraft/compare/chart-v0.0.0...HEAD
