# @trendcraft/mcp

Model Context Protocol server for [TrendCraft](https://github.com/sawapi/trendcraft) — exposes the indicator **manifest** (96+ entries with `whenToUse` / `pitfalls` / `synergy` / `marketRegime` / `timeframe` / `paramHints`) plus a single calc dispatcher to LLM clients like Claude Desktop and Cursor.

> Positioning: this is an **Indicator Knowledge Server**, not another VectorBT-style backtest wrapper. The differentiator is the structured per-indicator metadata that lets an LLM decide *which* tool to use — not raw compute speed.

## Install

```bash
npm install -g @trendcraft/mcp
# or run on demand
npx @trendcraft/mcp
```

## Claude Desktop config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

Restart Claude Desktop. The five tools below appear in the tool picker.

## Tools

| Tool | Purpose |
|---|---|
| `list_indicators` | Compact summaries (kind, displayName, oneLiner, category, `calcSupported`) for discovery. Optional filters: `category`, `regime`, `timeframe`, `calcSupported`. Use `{ calcSupported: true }` to restrict to computable kinds. |
| `get_indicator_manifest` | Full `IndicatorManifest` for one kind — use to decide whether it fits the user's situation, or to look up `paramHints` before calling `calc_indicator`. Throws `UNKNOWN_KIND` if the manifest entry is missing. |
| `suggest_indicators_for_regime` | Indicators well-suited to a given market regime (`trending` / `ranging` / `volatile` / `low-volatility`). |
| `format_manifest_markdown` | Render one indicator's manifest as Markdown for embedding in agent prompts. |
| `calc_indicator` | Compute one indicator on caller-supplied OHLCV candles. Currently ~60 kinds have safe-calc wrappers. Errors use canonical codes: `INVALID_INPUT` (bad candles), `INVALID_PARAMETER` (bad/missing params), `INSUFFICIENT_DATA`, `UNSUPPORTED_KIND` (no calc wrapper for this kind, distinct from `UNKNOWN_KIND`). `lastN` param (default 200) keeps responses inside MCP token budgets. |
| `list_signals` | Discover the signal kinds supported by `detect_signal`. Each entry includes `kind`, `shape` (`series` for per-bar boolean/state, `events` for sparse arrays), `oneLiner`, and `paramsHint`. Optional `shape` filter narrows to one output type. |
| `detect_signal` | Detect a trading signal from candles — crossovers (`goldenCross`/`deadCross`), MA alignment (`perfectOrder`), candlestick patterns (`candlestickPatterns`), divergences (`rsiDivergence`/`macdDivergence`/`obvDivergence`), squeeze (`bollingerSqueeze`), and volume signals (`volumeBreakout`/`volumeAccumulation`/`volumeMaCross`/`volumeAboveAverage`). Returns `{ output, firedAt, ... }` — `firedAt` is a sparse list of trigger times that makes screening (\"did the signal fire in the last N bars?\") cheap on tokens. |

### Data sourcing

`calc_indicator` and `detect_signal` both expect candles supplied by the caller. The server has **no built-in data connector** — pair it with another MCP server (Yahoo / Alpaca / your broker) when you need live data.

## Development

```bash
pnpm install --frozen-lockfile
pnpm --filter trendcraft build      # core must build first
pnpm --filter @trendcraft/mcp build
pnpm --filter @trendcraft/mcp test
```

Quick stdio smoke test:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node packages/mcp/dist/bin/trendcraft-mcp.js
```

## License

MIT
