# docs-screenshots

Scene code for the PNGs in [`packages/chart/docs/assets/`](../../docs/assets/). This example is committed so screenshots stay reproducible, but the underlying market data (`data/*.json`) is not — it's fetched locally from Alpaca before each capture run.

Unlike the other examples (`simple-chart`, `simple-react-chart`, `simple-vue-chart`, `indicator-showcase`) this one isn't aimed at teaching users the library. It's optimised for **producing good marketing / docs images** at known viewport sizes with known indicator stacks.

## Prerequisites

- `agent-browser` CLI on PATH (`npm i -g agent-browser && agent-browser install`).
- Alpaca API credentials in `packages/core/examples/alpaca-demo/.env` (this script reuses them to avoid stashing another copy).

## First-time setup

```bash
cd packages/chart/examples/docs-screenshots
pnpm install --ignore-workspace

# Pull NVDA 1Day from 2022-01-01 to today into data/nvda-1day.json.
# Override via args: npx tsx fetch-data.ts <SYMBOL> <TIMEFRAME> <START> <END>
npx tsx fetch-data.ts
```

The fetcher delegates to `alpaca-demo`'s `fetchHistoricalBars` so the data is validated (gaps / duplicates / OHLC sanity) before write. Writes to `data/<symbol>-<timeframe>.json`; ignored by git.

## Browse the scenes

```bash
pnpm dev
# → http://localhost:5175/?scene=hero
```

Scenes: `hero`, `hero-candle`, `auto-detection`, `chart-types`, `plugin-regime`, `backtest`. Opening `/` (no query) lists all of them.

## Capture PNGs

```bash
pnpm capture             # all scenes → ../../docs/assets/<scene>.png
pnpm capture hero        # one scene
pnpm capture hero auto-detection   # subset
```

Runs the Vite dev server on port 5175 in the background, then drives `agent-browser` through each scene at 2560×1440 viewport. Each scene sets `window.__chartReady = true` when it finishes painting; the capture script waits on that flag before screenshotting.

## Scenes

| id | purpose | indicators |
|---|---|---|
| `hero` | README top, mountain base | SMA 5 / 20 / 60 + RSI + MACD |
| `hero-candle` | GUIDE, candlestick variant | same |
| `auto-detection` | show five distinct shape types | SMA + Bollinger + RSI + Stochastics + MACD |
| `chart-types` | 2×2 of candle / line / mountain / ohlc | — |
| `plugin-regime` | plugin showcase | HMM regime heatmap on SMA 20 |
| `backtest` | backtest visualization | goldenCross 20/50 |

Adding a scene: drop `src/scenes/<id>.ts` exporting `run(stage, candles)`, register it in `SCENES` in both `src/main.ts` and `capture.sh`, and update this table.

## Reproducibility notes

- 2560×1440 viewport, dark theme, `"Helvetica Neue", Arial, sans-serif` across all scenes.
- `animationDuration: 0` on every chart so frames are deterministic.
- If output drifts over time, check (in order): data file changed, indicator implementation changed, `agent-browser` Chromium updated.
