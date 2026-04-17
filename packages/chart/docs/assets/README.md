# docs/assets

Screenshots referenced from `packages/chart/README.md` and the docs under `packages/chart/docs/`.

## Expected files

| File | Scene | Used in |
|---|---|---|
| `hero.png` | `hero` | README (top), GUIDE |
| `auto-detection.png` | `auto-detection` | README "Series Auto-Detection" section, GUIDE |
| `chart-types.png` | `chart-types` | README "Chart Types" table |
| `plugin-regime.png` | `plugin-regime` | README "Plugin System" section |
| `backtest.png` | `backtest` | README "Backtest Visualization" section |

Each image is 1600×900, dark theme, pinned font (`"Helvetica Neue", Arial, sans-serif`). Target file size < 300 KB per image. Prefer PNG for now; WebP is also fine.

## How to (re)generate

The scenes live in the gitignored playground at `packages/chart/examples/_screenshots/`. See [its README](../../examples/_screenshots/README.md) for setup. Once installed:

```bash
cd packages/chart/examples/_screenshots
pnpm capture           # writes every PNG into this directory
pnpm capture hero      # one scene
```

Requires the [`agent-browser`](https://www.npmjs.com/package/agent-browser) CLI on PATH.

## When to regenerate

- After a meaningful visual change to the chart (theme, default series styles, layout)
- After updating indicator implementations that affect reference lines / ranges
- Never for trivial refactors — keep the images stable so the docs don't churn
