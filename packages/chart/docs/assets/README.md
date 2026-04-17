# docs/assets

Screenshots referenced from `packages/chart/README.md` and the docs under `packages/chart/docs/`.

## Expected files

| File | Scene | Used in |
|---|---|---|
| `hero.png` | `hero` | README (top) — mountain base for a clean first impression |
| `hero-candle.png` | `hero-candle` | GUIDE — candlestick variant with the same indicator stack |
| `auto-detection.png` | `auto-detection` | README "Series Auto-Detection" section |
| `chart-types.png` | `chart-types` | README "Chart Types" table |
| `plugin-regime.png` | `plugin-regime` | README "Plugin System" section |
| `backtest.png` | `backtest` | README "Backtest Visualization" section |

Each image is 2560×1440 (2x Retina-class), dark theme, pinned font (`"Helvetica Neue", Arial, sans-serif`). File sizes typically land in the 150–500 KB range. Prefer PNG; WebP is fine if you need smaller files for a specific image.

## How to (re)generate

The scenes live at [`packages/chart/examples/docs-screenshots/`](../../examples/docs-screenshots/). The scene code is committed; the underlying market data (`data/*.json`) is gitignored — pull it via the [`fetch-data.ts`](../../examples/docs-screenshots/fetch-data.ts) helper before capturing. See [the README there](../../examples/docs-screenshots/README.md) for full setup.

```bash
cd packages/chart/examples/docs-screenshots
pnpm install --ignore-workspace
npx tsx fetch-data.ts   # first time only — fetches NVDA bars from Alpaca
pnpm capture            # writes every PNG into this directory
pnpm capture hero       # one scene
```

Requires the [`agent-browser`](https://www.npmjs.com/package/agent-browser) CLI on PATH.

## When to regenerate

- After a meaningful visual change to the chart (theme, default series styles, layout)
- After updating indicator implementations that affect reference lines / ranges
- Never for trivial refactors — keep the images stable so the docs don't churn
