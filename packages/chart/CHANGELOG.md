# Changelog

All notable changes to `@trendcraft/chart` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-XX

### Added

- Canvas-based financial charting library with zero runtime dependencies.
- Main entry (`@trendcraft/chart`): `createChart`, `connectLiveFeed`, `connectIndicators`.
- Headless entry (`@trendcraft/chart/headless`): `DataLayer`, `TimeScale`, `PriceScale`, `introspect`, `lttb`.
- React wrapper (`@trendcraft/chart/react`): `TrendChart` component and `useTrendChart` hook.
- Vue wrapper (`@trendcraft/chart/vue`): `TrendChart` component and `useTrendChart` composable.
- Preset indicators entry (`@trendcraft/chart/presets`).
- 13 series types: candlestick, line, area, histogram, band, cloud, marker, heatmap, arrow, signal, zone, labels, shapes.
- Plugin system: `defineSeriesRenderer`, `definePrimitive`.
- Auto-detection of TrendCraft `Series<T>` indicators via `introspect`.
- SSR safety: headless exports work without a DOM; DOM exports throw a clear error in non-browser environments.
- ARIA accessibility support via `ChartAria`.
- Bundle size limits enforced via `size-limit` (brotli): main ≤ 31 kB, headless ≤ 11 kB, React ≤ 27 kB, Vue ≤ 27 kB.

### Peer dependencies

- `trendcraft` (optional, `>=0.1.0`) — enables auto-detection of indicator series.
- `react` (optional, `>=19.0.0`) — required only when using the React wrapper.
- `vue` (optional, `>=3.3.0`) — required only when using the Vue wrapper.

[0.1.0]: https://github.com/sawapi/trendcraft/releases/tag/chart-v0.1.0
