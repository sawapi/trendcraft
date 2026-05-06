# Strategy Studio

A 1-screen React example that aims to be the **flagship integration demo** of TrendCraft — the place where you can touch every layer (indicator, chart, signal, backtest, risk, meta-strategy, portfolio, MCP) without setting up your own project.

The studio runs **fully offline with no LLM key**. It uses `detectMarketRegime` and `suggestForRegime` from `trendcraft/manifest` rule-based, so anyone can launch it and see a regime-aware setup immediately.

## Why a third example?

| Example | Role |
|---|---|
| `simple-chart`, `simple-react-chart`, `simple-vue-chart` | Minimal "hello world" for each binding |
| `indicator-showcase` | All 96+ presets in a catalog (per-preset minimal demo) |
| `sparkline-showcase` | Sparkline subpath demo |
| `echarts-viewer` (formerly `chart-viewer`) | **Proof that the `trendcraft` core works with any chart library** (here: ECharts). Comprehensive analysis app, but ECharts-based |
| **Strategy Studio** (this) | **Flagship `@trendcraft/chart` dogfooding + cross-feature integration**. The place to verify TrendCraft as a fullstack toolkit |

`echarts-viewer` and `indicator-showcase` are intentionally preserved — they cover different value propositions and overlap in functionality is by design.

## Roadmap (PR-by-PR)

| PR | Scope | Status |
|---|---|---|
| PR2 | scaffold + 3-pane layout + regime banner + manifest preset selector | done |
| PR3 | StrategyBuilder (entry/exit dropdowns) + backtest + trade overlay + JSON I/O | done |
| PR4 | ParamEditor — paramSchema-driven slider/input UI for the 96 presets | done |
| PR5 | Replay mode — click-to-anchor, play/pause/step/speed, snapshot backtest | done |
| PR6 | SignalsPanel — cross/divergence/pattern signal detection + markers | done |
| PR7 | PluginsPanel — SMC / Pitchfork / Volume Profile / Wyckoff plugin toggles | done |
| PR8 | RiskPanel — position sizing (Risk-%/ATR/Kelly) + VaR/CVaR | done |
| PR9 | MetaStrategyPanel — equity curve filter + strategy rotation | done |
| PR10 | PortfolioPanel — `batchBacktest` + 3 synthetic symbols + sparkline rows | done |
| PR11 | ScoringPanel — composite scoring (6 presets, sparkline + breakdown) | done |
| PR12 | OptimizationPanel — grid search (push-to-run, auto-derived ranges, top-10 table) | **this PR** |
| PR13 | StrategyDnaPanel — genome viz + sensitivity heatmap + robustness | |
| PR14 | chart: live recompute for batch-only presets in Replay (carved out from PR5) | |
| PR15 | chart: shared signal-pattern primitive (zigzag + neckline + target, extracted from indicator-showcase; carved out from PR6) | |
| Phase 2 | Ask AI panel via `@trendcraft/mcp` tools (LLM tool-use) | future |

When the full set lands, Studio will be a true superset of `echarts-viewer`'s analysis surface, all rendered through `@trendcraft/chart`.

## Architecture notes

- **`registerTrendCraftPresets(chart)` is required**, not optional. Calling `connectIndicators` with `indicatorPresets` without it leaves TrendCraft-specific shapes (`adaptiveRsi`, `connorsRsi`, `klinger`, `vsa`) silently rendering as generic "Indicator"/"Series". See `src/App.tsx` and `packages/chart/docs/COOKBOOK.md` Recipe 1.
- **Phase 2 seam**: all domain calls go through `lib/studio-api.ts`'s `StudioAPI` interface. PR2 ships `localStudioAPI` (calls trendcraft directly). A future `mcpStudioAPI` will let LLM tool-use drive the same surface unchanged.
- **kind ↔ preset key alias**: `trendcraft/manifest` uses long names (`bollingerBands`); `indicatorPresets` uses short keys (`bb`). 13 mappings in `KIND_TO_PRESET_KEY`. Manifest entries with no preset (`hmmRegimes`, `liquiditySweep`) render as disabled.

## How to run

```bash
cd packages/chart/examples/strategy-studio
pnpm install --ignore-workspace
pnpm dev
```

Visit the URL Vite prints (typically <http://localhost:5173>).

## Real data (Alpaca, optional)

By default Studio runs on synthetic sample data. If you have an Alpaca account, you can switch to real OHLCV with timeframe selection (1m / 5m / 15m / 1H / 1D).

1. Copy `.env.example` to `.env`
2. Fill in your `ALPACA_API_KEY` and `ALPACA_API_SECRET` (paper account is enough — get them at <https://app.alpaca.markets/signup>)
3. Restart `pnpm dev`

A `Source · Symbol · TF` toolbar appears in the header. The Symbol field autocompletes against Alpaca's full US-equity asset list — search by ticker (`SPY`) or company name (`Apple`). Without the keys, the toolbar stays hidden and Studio behaves exactly as before.

**Security**: keys live only in the dev server process. The vite proxy attaches them as request headers; client bundles never see the credentials.

**Notes**:

- Free-tier `feed=iex`. Intraday volume coverage is lower than SIP but bar shapes are accurate.
- Adjustment is `split` to align with TradingView's default chart behaviour.
- Lookback per timeframe is sized so all timeframes return ~2,000–2,500 bars (enough warmup for SMA(200) / Ichimoku).
- Per-symbol/timeframe results are cached in memory for the session; use `Reload` to bust the cache.

## Current PR2 capabilities

- **Regime detection**: live `detectMarketRegime` on the loaded candles → 4-bucket classification (`trending` / `ranging` / `volatile` / `low-volatility`)
- **Regime-aware preset suggestions**: `suggestForRegime(regime)` populates the top of the left panel
- **Full manifest browser**: all 95 manifest entries by category, with `whenToUse` / `pitfalls` / regime tags on hover
- **Click-to-toggle**: clicking a preset adds/removes it from the chart with proper labels and colors via `connectIndicators` + `registerTrendCraftPresets`
