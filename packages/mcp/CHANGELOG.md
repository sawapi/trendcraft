# Changelog

## Unreleased

### Added

- **`load_candles` tool + `candlesRef` input** — cache OHLCV candles in the
  session and pass an opaque `handle` as `candlesRef` on subsequent
  `calc_indicator` / `detect_signal` calls. Designed for multi-tool screens:
  five parallel indicator calls against the same 124-bar series transmit the
  bars **once** instead of five times. Handles are session-ephemeral (live
  only for the stdio process), capacity 50, oldest evicted silently. Reload
  is cheap.
- **Compact tuple input via `candlesArray`** — `calc_indicator`,
  `detect_signal`, and `load_candles` now accept
  `[[time, open, high, low, close, volume?], ...]` as an alternative to the
  canonical object-per-bar form. ~40% smaller payload because field names
  are not repeated per row.
- **`paramHints` inlined in `calc_indicator` `INVALID_PARAMETER` errors** — when
  a missing-params destructure error fires, the message now embeds the
  manifest's `paramHints` directly (e.g.
  `paramHints: period: 20 for short-term, 50 for medium, 200 for primary trend`)
  instead of pointing to `get_indicator_manifest`. Matches the parity that
  `detect_signal` already had.
- **`INVALID_HANDLE` canonical error** — surfaced when a `candlesRef` is
  unknown / evicted / never loaded; the message instructs the caller to
  re-run `load_candles`.

### Changed

- `calc_indicator` and `detect_signal` candle input is now exactly-one-of
  `candles` / `candlesArray` / `candlesRef`. Existing inline `candles`
  callers are unaffected.
- Bumped the advertised server version to `0.2.0`.

## 0.1.0 (2026-04-26)

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
