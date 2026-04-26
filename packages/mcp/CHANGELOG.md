# Changelog

## Unreleased

### Added
- Initial release — `@trendcraft/mcp` v0.1.0.
- 4 manifest tools backed by `trendcraft/manifest`:
  - `list_indicators` (filter by category / regime / timeframe)
  - `get_indicator_manifest`
  - `suggest_indicators_for_regime`
  - `format_manifest_markdown`
- `calc_indicator` dispatcher tool — single entry point that maps `kind` → `trendcraft/safe` Result-typed wrappers (~60 indicators), with `lastN` slicing (default 200) to stay within MCP token budgets.
- stdio transport bin: `trendcraft-mcp` (registered as the package's `bin`).
