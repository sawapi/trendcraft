# Changelog

## Unreleased

### Added
- Initial release — `@trendcraft/mcp` v0.1.0.
- Manifest tools backed by `trendcraft/manifest`:
  - `list_indicators` (filter by category / regime / timeframe / `calcSupported`). Each summary includes a `calcSupported: boolean` flag so callers can spot the manifest-vs-calc gap without a second round-trip.
  - `get_indicator_manifest`
  - `suggest_indicators_for_regime`
  - `format_manifest_markdown`
- `calc_indicator` dispatcher tool — single entry point that maps `kind` → `trendcraft/safe` Result-typed wrappers (~60 indicators), with `lastN` slicing (default 200) to stay within MCP token budgets.
- `detect_signal` dispatcher tool — single entry point for trading-signal detection across crossovers (`goldenCross`, `deadCross`), MA alignment (`perfectOrder`), candlestick patterns (`candlestickPatterns`), divergences (`rsiDivergence`, `macdDivergence`, `obvDivergence`), volatility squeeze (`bollingerSqueeze`), and volume signals (`volumeBreakout`, `volumeAccumulation`, `volumeMaCross`, `volumeAboveAverage`). Output envelope includes a `firedAt: number[]` summary so screening callers ("did the signal trigger in the last N bars?") don't have to scan the full series.
- `list_signals` discovery tool — symmetric with `list_indicators`. Returns `kind`, `shape`, `oneLiner`, and `paramsHint` per signal so callers can construct a `detect_signal` request without an error round-trip. Optional `shape` filter narrows to `series` or `events` outputs.
- Canonical error envelope across `calc_indicator`:
  - `INVALID_INPUT` — empty / malformed candles.
  - `INVALID_PARAMETER` — bad params, including missing required `params` (destructure-on-undefined errors are reclassified into this bucket with a message that points the caller at `get_indicator_manifest` for paramHints).
  - `INSUFFICIENT_DATA`, `INDICATOR_ERROR`, `INTERNAL_ERROR` — propagated from the underlying safe wrapper.
  - `UNSUPPORTED_KIND` — manifest entry exists but no calc wrapper. Distinct from `UNKNOWN_KIND` (no manifest entry), which is surfaced by the manifest tools.
- stdio transport bin: `trendcraft-mcp` (registered as the package's `bin`).
