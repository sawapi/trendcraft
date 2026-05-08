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
| PR12 | OptimizationPanel — grid search (push-to-run, auto-derived ranges, top-10 table) | done |
| PR13 | StrategyDnaPanel — genome viz + sensitivity heatmap + robustness | done |
| Real data | Alpaca-backed candles + symbol search + 1m/5m/15m/1H/1D timeframes (opt-in via `.env`) | done |
| Polish | Anchor-mode + Shift+click Replay anchoring, indicator search w/ inline descriptions, ChartToolbar (chart type + drawing tools), Portfolio time-window slicing, Strategy DNA labels | done |
| PR14 | chart: live recompute for batch-only presets in Replay (carved out from PR5) | open |
| PR15 | chart: shared signal-pattern primitive (zigzag + neckline + target, extracted from indicator-showcase; carved out from PR6) | open |
| Phase 2 | Ask AI panel via `@trendcraft/mcp` tools (conversational comprehension over generation — see project memory for the refined direction) | future |

The studio now spans every feature surface from the original plan; remaining roadmap items are chart-package upgrades that benefit other examples too. When PR14 + PR15 land, Studio will be a true superset of `echarts-viewer`'s analysis surface, all rendered through `@trendcraft/chart`.

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

## What's in the studio today

Left pane — discovery / setup
- **Regime detection**: live `detectMarketRegime` on the loaded candles → `trending` / `ranging` / `volatile` / `low-volatility`
- **Indicator catalog**: searchable, collapsible categories, inline `oneLiner` descriptions; suggested presets surface at the top based on the detected regime
- **Plugins panel**: SMC / Pitchfork / Volume Profile / Wyckoff phase toggles
- **Signals panel**: cross / divergence / chart-pattern detectors with chart markers

Center — chart
- **ChartToolbar**: chart-type segmented control (Candle / Line / Mountain / OHLC), drawing tools (HLine / VLine / Trend / Arrow / Rect / Channel / Fib / Fib+ / Text / Clear), Fit
- **Replay**: explicit Anchor mode + Shift+click to seed Replay; play / pause / step / 1×–Max speed; live snapshot backtest while scrubbing
- **Real data (opt-in)**: Alpaca historical bars (1m / 5m / 15m / 1H / 1D) with symbol search; falls back to bundled synthetic when no `.env`

Right pane — analytics
- **StrategyBuilder**: entry/exit condition dropdowns, paramSchema-driven sliders, JSON import/export
- **ResultsSummary**: backtest metrics + trade overlay
- **RiskPanel**: position sizing (Risk-% / ATR / Kelly) + VaR / CVaR
- **MetaStrategyPanel**: equity curve filter + strategy rotation
- **PortfolioPanel**: `batchBacktest` across SPY / AAPL / NVDA (or 3 synthetic symbols), sparkline per symbol; sliced by the chart's calendar window
- **ScoringPanel**: composite scoring (6 presets, sparkline + breakdown table)
- **OptimizationPanel**: grid search with auto-derived ranges, top-10 table, push-to-run
- **StrategyDnaPanel**: genome viz (best params on the search range) + sensitivity heatmap + robustness grade

Everything renders through `@trendcraft/chart` and computes via `trendcraft` / `trendcraft/manifest` — no external dependencies, no LLM key required.
