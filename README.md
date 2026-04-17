# TrendCraft

A TypeScript library for technical analysis of financial data. Calculate indicators, detect signals, and analyze market trends.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`packages/core`](./packages/core) | [`trendcraft`](https://www.npmjs.com/package/trendcraft) | Core library — 130+ indicators, backtesting, optimization, streaming |
| [`packages/chart`](./packages/chart) | [`@trendcraft/chart`](https://www.npmjs.com/package/@trendcraft/chart) | Canvas-based charting library with native `Series<T>` auto-detection, plus React/Vue bindings and a headless API |

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

Release and versioning conventions for the monorepo are documented in [CLAUDE.md](./CLAUDE.md#release-workflow).
