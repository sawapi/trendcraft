# docs-screenshots

Scene code for the PNGs in [`packages/chart/docs/assets/`](../../docs/assets/). This example is committed so screenshots stay reproducible, but the underlying market data (`data/*.json`) is not — it's fetched locally from Alpaca before each capture run.

Unlike the other examples (`simple-chart`, `simple-react-chart`, `simple-vue-chart`, `indicator-showcase`) this one isn't aimed at teaching users the library. It's optimised for **producing good marketing / docs images** at known viewport sizes with known indicator stacks.

## Prerequisites

- `agent-browser` CLI on PATH (`npm i -g agent-browser && agent-browser install`).
- Alpaca market-data API credentials (a free paper account is enough), either as `ALPACA_API_KEY` / `ALPACA_API_SECRET` in the environment or in `.env` here (copy `.env.example`; `.env` is gitignored).

## First-time setup

```bash
cd packages/chart/examples/docs-screenshots
pnpm install --ignore-workspace

# Pull NVDA 1Day from 2022-01-01 to today into data/nvda-1day.json.
# Override via args: pnpm fetch-data <SYMBOL> <TIMEFRAME> <START> <END>
pnpm fetch-data
```

The fetcher pulls split-adjusted IEX bars and rejects out-of-order or duplicate bars and inconsistent OHLCV before writing. Writes to `data/<symbol>-<timeframe>.json`; ignored by git.

## Browse the scenes

```bash
pnpm dev
# → http://localhost:5175/?scene=hero
```

Scenes: `hero`, `hero-candle`, `auto-detection`, `chart-types`, `plugin-regime`, `backtest`. Opening `/` (no query) lists all of them.

`pnpm dev` and `pnpm capture` need only the setup above: Vite serves the chart and core straight from their sources. `pnpm build` typechecks against the packages' built type declarations (their `dist`), so it needs `pnpm install --frozen-lockfile && pnpm build` at the repo root first.

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
| `hero` | README top, clean candlestick beauty shot (~170-bar window) | Bollinger Bands + SMA 50 |
| `hero-candle` | GUIDE, candlestick variant | SMA 5 / 20 / 60 + RSI + MACD |
| `auto-detection` | show five distinct shape types | SMA + Bollinger + RSI + Stochastics + MACD |
| `chart-types` | 2×2 of candle / line / mountain / ohlc | — |
| `plugin-regime` | plugin showcase | HMM regime heatmap on SMA 20 |
| `backtest` | backtest visualization | goldenCross 20/50 |

Adding a scene: drop `src/scenes/<id>.ts` exporting `run(stage, candles)`, register it in `SCENES` in both `src/main.ts` and `capture.sh`, and update this table.

## Reproducibility notes

- 2560×1440 viewport, dark theme, `"Helvetica Neue", Arial, sans-serif` across all scenes.
- `animationDuration: 0` on every chart so frames are deterministic.
- If output drifts over time, check (in order): data file changed, indicator implementation changed, `agent-browser` Chromium updated.
