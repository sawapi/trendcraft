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

## Demos

Each demo is a standalone Vite app — `cd` into it, `pnpm install --ignore-workspace`, `pnpm dev`.

**Charting (`@trendcraft/chart`)**
- [`packages/chart/examples/simple-chart`](./packages/chart/examples/simple-chart) — start here. Vanilla TS, one chart, a handful of indicators.
- [`packages/chart/examples/simple-react-chart`](./packages/chart/examples/simple-react-chart) / [`simple-vue-chart`](./packages/chart/examples/simple-vue-chart) — framework binding minimal demos.
- [`packages/chart/examples/indicator-showcase`](./packages/chart/examples/indicator-showcase) — every preset (96+) with live-replay, signal panel, plugin panel.
- [`packages/chart/examples/sparkline-showcase`](./packages/chart/examples/sparkline-showcase) — the `@trendcraft/chart/sparkline` subpath on a 200-row ticker dashboard.

**Core (`trendcraft`)**
- [`packages/core/examples/quick-start`](./packages/core/examples/quick-start) — the smallest "import and call an indicator" example.
- [`packages/core/examples/echarts-viewer`](./packages/core/examples/echarts-viewer) — comprehensive React + ECharts viewer (indicators, signals, backtest, optimization, pattern replay). Demonstrates that the `trendcraft` core works with any chart library, not only `@trendcraft/chart`.
- [`packages/core/examples/trading-simulator`](./packages/core/examples/trading-simulator) — bar-replay practice tool with order management and end-of-session review.
- [`packages/core/examples/sp500-showcase`](./packages/core/examples/sp500-showcase) — screening across S&P 500 symbols.

## Disclaimer

TrendCraft is a technical analysis toolkit for informational and educational purposes only. Outputs — including indicator values, signals, backtest results, and chart visualizations — are not investment advice and do not constitute a recommendation to buy, sell, or hold any financial instrument. You are solely responsible for any trading decisions made using this software.
