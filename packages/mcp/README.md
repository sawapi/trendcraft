# @trendcraft/mcp

Model Context Protocol server for [TrendCraft](https://github.com/sawapi/trendcraft) — exposes the indicator **manifest** (96+ entries with `whenToUse` / `pitfalls` / `synergy` / `marketRegime` / `timeframe` / `paramHints`) plus calc and signal dispatchers to LLM clients like Claude Desktop and Cursor.

> Positioning: this is an **indicator knowledge server**, not a backtest wrapper. The differentiator is the structured per-indicator metadata that lets an LLM decide *which* tool to use, paired with a token-aware calc/signal API designed for agentic workflows.

## Install

```bash
npm install -g @trendcraft/mcp
# or run on demand
npx @trendcraft/mcp
```

## Configuring an MCP client

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop.

### Claude Code

```bash
claude mcp add trendcraft -- npx -y @trendcraft/mcp
```

Or edit `~/.claude.json` directly under the `mcpServers` key with the same config as Claude Desktop.

### Cursor

`Cursor Settings → MCP → Add new MCP Server`:

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

### Verify

After connecting, the seven tools below should appear in the client's tool picker. To smoke-test the binary directly without an MCP client:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | npx -y @trendcraft/mcp
```

## Tools

| Tool | Purpose |
|---|---|
| `list_indicators` | Discover indicator kinds. Returns `kind`, `displayName`, `oneLiner`, `category`, and `calcSupported` per entry. Optional filters: `category`, `regime`, `timeframe`, `calcSupported`. |
| `get_indicator_manifest` | Full `IndicatorManifest` for one kind — `whenToUse`, `pitfalls`, `synergy`, `paramHints`, etc. Throws `UNKNOWN_KIND` if the manifest entry is missing. |
| `suggest_indicators_for_regime` | Indicators well-suited to `trending` / `ranging` / `volatile` / `low-volatility`. |
| `format_manifest_markdown` | Render one indicator's manifest as Markdown — useful for agent prompt embedding. |
| `calc_indicator` | Compute one indicator on caller-supplied OHLCV candles. ~60 kinds have safe-calc wrappers. `lastN` (default 200) trims response size. |
| `list_signals` | Discover signal kinds supported by `detect_signal`. Returns `kind`, `shape` (`series` or `events`), `oneLiner`, and `paramsHint`. Optional `shape` filter. |
| `detect_signal` | Detect a trading signal — crossovers, MA alignment, candlestick patterns, divergences, squeeze, and volume signals. Returns `{ output, firedAt, ... }` where `firedAt` is a sparse list of trigger times — designed for cheap screening (*"did the signal fire in the last N bars?"*). |

## Designed for screening

The output shape is tuned for two LLM-driven workflows: **single-symbol analysis** (call a few indicators + signals on one symbol's candles) and **multi-symbol screening** (loop over many symbols, ask one yes/no per signal). For screening, `detect_signal` returns a `firedAt: number[]` summary so the caller doesn't have to scan the full series — typically 100x cheaper on tokens than reading the boolean output array.

```jsonc
// detect_signal output for a screening question
{
  "kind": "goldenCross",
  "shape": "series",
  "totalLength": 80,
  "count": 80,
  "truncated": false,
  "output": [/* full Series<boolean> here */],
  "firedAt": []   // ← scan this. empty = no fire in window.
}
```

## Recipes

See [EXAMPLES.md](./EXAMPLES.md) for end-to-end patterns: regime-driven discovery, multi-symbol screening, working with `series`-vs-`events` signals, indicator synergy, token-budget tuning, and error recovery.

## Example workflow

A typical agent flow against a single symbol's daily candles:

```ts
// 1. Discover what to use for the regime you suspect.
suggest_indicators_for_regime({ regime: "trending" })

// 2. Look up paramHints / pitfalls before computing.
get_indicator_manifest({ kind: "rsi" })

// 3. Compute on the symbol's candles. lastN keeps the response compact.
calc_indicator({
  kind: "rsi",
  candles: /* { time, open, high, low, close, volume? }[] */,
  params: { period: 14 },
  lastN: 5
})

// 4. Discover signal kinds and their parameter shape.
list_signals({ shape: "series" })

// 5. Check whether a screening signal fired recently.
detect_signal({
  kind: "goldenCross",
  candles,
  params: { short: 5, long: 25 },
  lastN: 10
})
// → { firedAt: [...timestamps], output: [...] }
```

## Errors

All tool errors return `isError: true` with the message body in the form `<CODE>: <message>`. Codes:

| Code | Meaning | Surface |
|---|---|---|
| `INVALID_INPUT` | Empty / malformed candles array | calc, detect_signal |
| `INVALID_PARAMETER` | Missing or invalid params (negative period, missing required `params` object, etc.) | calc, detect_signal |
| `INSUFFICIENT_DATA` | Candles count below the indicator/signal's minimum required window | calc, detect_signal |
| `INDICATOR_ERROR` | Underlying indicator raised an unclassified runtime error | calc |
| `SIGNAL_ERROR` | Underlying signal raised an unclassified runtime error | detect_signal |
| `UNSUPPORTED_KIND` | Manifest entry exists but no calc wrapper is available | calc |
| `UNSUPPORTED_SIGNAL` | Kind is not registered with `detect_signal` | detect_signal |
| `UNKNOWN_KIND` | No manifest entry exists for the given kind | manifest tools |
| `INTERNAL_ERROR` | Wrapper returned an unexpected envelope (should not occur) | calc, detect_signal |

`UNSUPPORTED_KIND` (calc) and `UNKNOWN_KIND` (manifest) are intentionally distinct: the former means the kind is documented in the manifest but the safe-calc wrapper hasn't been written yet; the latter means the kind doesn't exist at all. Use `list_indicators({ calcSupported: true })` to enumerate the calc-ready set.

## Data sourcing

`calc_indicator` and `detect_signal` both expect candles supplied by the caller. The server has **no built-in data connector** — pair it with another MCP server (Yahoo / Alpaca / your broker) or have the agent paste candles from a local file. This is a deliberate scope decision: data fetching, auth, and rate-limiting belong in dedicated tools.

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
