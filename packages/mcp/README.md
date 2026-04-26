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
| `list_indicators` | Compact summaries (kind, displayName, oneLiner, category) for discovery. Optional filters: `category`, `regime`, `timeframe`. |
| `get_indicator_manifest` | Full `IndicatorManifest` for one kind — use to decide whether it fits the user's situation. |
| `suggest_indicators_for_regime` | Indicators well-suited to a given market regime (`trending` / `ranging` / `volatile` / `low-volatility`). |
| `format_manifest_markdown` | Render one indicator's manifest as Markdown for embedding in agent prompts. |
| `calc_indicator` | Compute one indicator on caller-supplied OHLCV candles. ~60 kinds available via the safe-calc wrappers; surfaces canonical errors (`INVALID_PARAMETER`, `INSUFFICIENT_DATA`, `UNSUPPORTED_KIND`). `lastN` param (default 200) keeps responses inside MCP token budgets. |

### Data sourcing

`calc_indicator` expects candles supplied by the caller. The server has **no built-in data connector** — pair it with another MCP server (Yahoo / Alpaca / your broker) when you need live data.

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
