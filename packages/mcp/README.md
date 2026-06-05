# @trendcraft/mcp

A Model Context Protocol server exposing [TrendCraft](https://github.com/sawapi/trendcraft)'s technical-analysis indicators and signals to MCP clients like Claude Desktop and Cursor over stdio.

The server's differentiator is its structured per-indicator **manifest** — 96+ entries with `whenToUse`, `pitfalls`, `synergy`, `marketRegime`, `timeframe`, and `paramHints` — that lets an LLM decide *which* indicator to use, paired with token-aware calc and signal dispatchers built for agentic single-symbol analysis and multi-symbol screening. It ships no data connector: candles are supplied by the caller (paste from a file, or pair with a data-source MCP server).

## Install

```bash
npm install -g @trendcraft/mcp
# or run on demand
npx @trendcraft/mcp
```

The package ships a stdio binary, `trendcraft-mcp`.

## Run

Add the server to your MCP client config. For Claude Desktop, edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trendcraft": {
      "command": "npx",
      "args": ["-y", "@trendcraft/mcp"]
    }
  }
}
```

The same `mcpServers` entry works for Cursor and `~/.claude.json`. For Claude Code:

```bash
claude mcp add trendcraft -- npx -y @trendcraft/mcp
```

Smoke-test the binary without a client:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y @trendcraft/mcp
```

## Tools

| Tool | Purpose |
|---|---|
| `list_indicators` | Discover indicator kinds, with optional `category` / `regime` / `timeframe` / `calcSupported` filters. |
| `get_indicator_manifest` | Full manifest for one kind — `whenToUse`, `pitfalls`, `synergy`, `paramHints`, etc. |
| `suggest_indicators_for_regime` | Indicators suited to `trending` / `ranging` / `volatile` / `low-volatility`. |
| `format_manifest_markdown` | Render one indicator's manifest as Markdown for prompt embedding. |
| `calc_indicator` | Compute one indicator on caller-supplied candles. `lastN` trims response size. |
| `detect_signal` | Detect a signal (crossovers, MA alignment, patterns, divergences, squeeze, volume). Returns a sparse `firedAt` list for cheap screening. |
| `list_signals` | Discover signal kinds supported by `detect_signal`, with optional `shape` filter. |
| `load_candles` | Cache candles in the session and return a reusable handle (see below). |

## Candle input

`calc_indicator` and `detect_signal` accept exactly one candle source: `candles` (an array of `{time, open, high, low, close, volume?}` objects — the canonical form), `candlesArray` (the same rows as `[time, open, high, low, close, volume?]` tuples, ~40% smaller payload), or `candlesRef` (an opaque handle returned by `load_candles`). Use `candlesRef` when fanning out several tools over the same series so the bars are transmitted only once; a stale or evicted handle returns `INVALID_HANDLE`, so just call `load_candles` again.

## Documentation

- [EXAMPLES.md](./EXAMPLES.md) — end-to-end recipes: regime-driven discovery, multi-symbol screening, `series`-vs-`events` signals, synergy, token-budget tuning, error recovery.
- [CHANGELOG.md](./CHANGELOG.md) — release history.

## Disclaimer

`@trendcraft/mcp` and the underlying `trendcraft` library provide technical-analysis primitives for informational and educational purposes only. Outputs — indicator values, signal triggers, and manifest notes — are not investment advice and are not a recommendation to buy, sell, or hold any instrument. You are solely responsible for any trading decisions made using this software.

## License

MIT
