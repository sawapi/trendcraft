# TrendCraft

A TypeScript library for technical analysis of financial data. Calculate indicators, detect signals, and analyze market trends.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`packages/core`](./packages/core) | [`trendcraft`](https://www.npmjs.com/package/trendcraft) | Core library — 130+ indicators, backtesting, optimization, streaming |
| [`packages/chart`](./packages/chart) | [`@trendcraft/chart`](https://www.npmjs.com/package/@trendcraft/chart) | Canvas-based charting library with native `Series<T>` auto-detection, plus React/Vue bindings and a headless API |
| [`packages/mcp`](./packages/mcp) | [`@trendcraft/mcp`](https://www.npmjs.com/package/@trendcraft/mcp) | Model Context Protocol server — exposes 96+ indicator manifests plus calc and signal dispatchers to LLM clients (Claude Desktop, Cursor, Claude Code) |

## Development

```bash
pnpm install --frozen-lockfile   # Install dependencies (workspace)
pnpm build                        # Build all packages
pnpm test                         # Run all tests
pnpm lint                         # Lint
```

See each package's README for full documentation:

- [packages/core/README.md](./packages/core/README.md) — indicators, backtesting, streaming
- [packages/chart/README.md](./packages/chart/README.md) — charting, React/Vue, plugins
- [packages/mcp/README.md](./packages/mcp/README.md) — MCP server for LLM clients

Release and versioning conventions for the monorepo are documented in [CLAUDE.md](./CLAUDE.md#release-workflow).

## Disclaimer

TrendCraft is a technical analysis toolkit for informational and educational purposes only. Outputs — including indicator values, signals, backtest results, and chart visualizations — are not investment advice and do not constitute a recommendation to buy, sell, or hold any financial instrument. You are solely responsible for any trading decisions made using this software.
