# docs/assets

Screenshots referenced from `packages/chart/README.md` and the docs under `packages/chart/docs/`.

## Expected files

| File | Scene | Used in |
|---|---|---|
| `hero.png` | `hero` | README (top) — recent candlesticks with Bollinger Bands and SMA(50) |
| `hero-candle.png` | `hero-candle` | GUIDE — SMA 5/20/60 ribbon with RSI and MACD panes |
| `auto-detection.png` | `auto-detection` | README "With TrendCraft — auto-detected indicators" section + GUIDE "Auto-detection from `__meta`" section |

Each image is laid out at 1200×675 CSS pixels and captured at deviceScaleFactor 2 (2400×1350 PNG), so labels stay readable when GitHub scales it to its content width. Dark theme, pinned font (`"Helvetica Neue", Arial, sans-serif`). File sizes typically land in the 130–250 KB range. Prefer PNG; WebP is fine if you need smaller files for a specific image.

## How to (re)generate

The scenes live at [`packages/chart/examples/docs-screenshots/`](../../examples/docs-screenshots/). The scene code is committed; the underlying market data (`data/*.json`) is gitignored — pull it via the [`fetch-data.ts`](../../examples/docs-screenshots/fetch-data.ts) helper before capturing. See [the README there](../../examples/docs-screenshots/README.md) for full setup.

```bash
cd packages/chart/examples/docs-screenshots
pnpm install --ignore-workspace
pnpm fetch-data         # first time only — fetches NVDA bars from Alpaca
pnpm capture            # writes every PNG into this directory
pnpm capture hero       # one scene
```

Requires the [`agent-browser`](https://www.npmjs.com/package/agent-browser) CLI on PATH.

## When to regenerate

- After a meaningful visual change to the chart (theme, default series styles, layout)
- After updating indicator implementations that affect reference lines / ranges
- Never for trivial refactors — keep the images stable so the docs don't churn
