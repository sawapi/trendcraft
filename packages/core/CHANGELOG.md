# Changelog

## Unreleased

Target: **v0.2.0** — additive-only minor bump introducing the APIs that back `@trendcraft/chart`'s indicator integration and live-streaming pipeline.

### Added — Live Streaming

- `createLiveCandle(options, fromState?)` — unified tick/candle aggregator with dynamically registered incremental indicators and an event bus (`tick`, `candleComplete`). Supports both tick mode (`addTick`) and candle mode (`addCandle`), with state save/restore for resumable sessions.
- `livePresets` — registry of 76 incremental indicator presets (factory + metadata + default params + snapshot-name) for zero-config registration in live mode.
- `indicatorPresets` — unified registry of 95 indicator presets with both batch `compute` and incremental `createFactory`, usable from both static and streaming chart flows.

### Added — Chart Integration Metadata

- `SeriesMeta` type and `tagSeries(series, meta)` helper — attach domain metadata (`label`, `overlay`, `yRange`, `referenceLines`, `channelColors`) to indicator output via a non-enumerable `__meta` property. Consumed by `@trendcraft/chart` for zero-config pane placement and rendering.
- `indicator-meta` constants — shared single-source-of-truth metadata used by 42+ batch indicators (SMA, EMA, RSI, MACD, BB, Ichimoku, etc.).

### Added — Incremental Indicators (+73 exports)

Incremental exports grew from 90 to 163 across:

- **Moving Averages (+5)**: `createDema`, `createTema`, `createZlema`, `createAlma`, `createFrama`
- **Momentum (+12)**: Connors RSI, IMI, Ultimate Oscillator, Awesome Oscillator, Mass Index, KST, Coppock Curve, TSI, PPO, CMO, Balance of Power, QStick
- **Volatility (+5)**: Choppiness Index, Ulcer Index, Historical Volatility, Garman-Klass, Standard Deviation
- **Volume (+7)**: Anchored VWAP, Elder Force Index, Ease of Movement, Klinger, TWAP, Weis Wave, Market Profile additions (full list in `packages/core/src/indicators/incremental/volume`)
- **Price & Wyckoff (+7)**: Fair Value Gap, Fractals, Gap Analysis, Highest/Lowest, Opening Range, Pivot Points, VSA

All new factories support `restoreState` for session resumption.

### Fixed

- `garmanKlass`: guard non-positive high/close values to avoid `NaN` propagation.
- `zlema`: validate `period` parameter (throws on <= 0).
- `portfolioBacktest`: remove dead `currentOpenPositions` variable.

### Notes

- No breaking changes for `trendcraft@0.1.0` users — all additions are net-new surface area. `SeriesMeta.pane` → `overlay` rename affects only internal code; the symbol was not exported in v0.1.0.

---

## v0.1.0 (2026-03-23)

Initial public release.

### Indicators (130+)

- **Moving Averages** (14): SMA, EMA, WMA, VWMA, KAMA, T3, HMA, McGinley Dynamic, EMA Ribbon, DEMA, TEMA, ZLEMA, FRAMA, ALMA
- **Momentum** (25): RSI, MACD, Stochastics, DMI/ADX, ADXR, StochRSI, CCI, Williams %R, ROC, TRIX, Aroon, DPO, Hurst, Connors RSI, IMI, Ultimate Oscillator, Awesome Oscillator, Mass Index, KST, Coppock Curve, TSI, PPO, CMO, Balance of Power, QStick
- **Trend** (6): Ichimoku, Supertrend, Parabolic SAR, Vortex, Schaff Trend Cycle, Linear Regression
- **Volatility** (11): Bollinger Bands, ATR, Donchian Channel, Keltner Channel, Chandelier Exit, Choppiness Index, Ulcer Index, Historical Volatility, Garman-Klass, Standard Deviation, GARCH
- **Volume** (18): OBV, MFI, VWAP (with Bands), CMF, Volume Profile, Anchored VWAP, Elder Force Index, Ease of Movement, Klinger, TWAP, Weis Wave, Market Profile, CVD, ADL, Volume Anomaly, Volume Trend, PVT, NVI
- **Price** (14): Swing Points, Pivot Points, FVG, BOS, CHoCH, ORB, Gap Analysis, S/R Zone Clustering, Fractals, Zigzag, Fibonacci, Heikin-Ashi, Median/Typical/Weighted Close
- **Smart Money Concepts**: Order Block, Liquidity Sweep
- **Session**: ICT Kill Zones, Session Analytics, Session Breakout
- **Regime**: HMM-based Regime Detection (Baum-Welch, Viterbi)
- **Wyckoff**: VSA (Volume Spread Analysis), Wyckoff Phase Detection

### Backtesting

- 155 preset conditions (entry/exit)
- Stop-loss, take-profit, trailing stop, ATR trailing stop
- Partial take-profit, break-even stop
- Commission, slippage, and tax simulation
- Short selling support
- Multi-timeframe (MTF) conditions
- Portfolio backtesting with allocation control
- Signal explainability (condition traces + narratives)

### Optimization

- Grid Search with constraint filtering
- Walk-Forward Analysis (out-of-sample validation)
- Combination Search (entry/exit pair optimization)
- Monte Carlo simulation
- Pareto Multi-Objective (NSGA-II)
- Strategy Robustness Scoring (A+ to F grade)

### Streaming

- Incremental indicators (43 factories) for bar-by-bar processing
- Streaming conditions with full combinator support (and/or/not)
- Position management with partial TP and break-even stops
- Regime-aware position sizing

### Additional Features

- Signal Scoring system with presets and fluent API
- Position Sizing (Risk-Based, ATR-Based, Kelly Criterion, Fixed Fractional)
- Risk Analytics (VaR, CVaR, Risk Parity, Correlation-Adjusted Sizing)
- Meta-Strategy (Equity Curve Trading, Strategy Rotation)
- Stock Screening with CLI
- Pairs Trading / Cointegration analysis
- Cross-Asset Correlation
- Harmonic Pattern Detection (Gartley, Butterfly, Bat, Crab, Shark)
- Chart Pattern Detection (Double Top/Bottom, H&S, Cup & Handle, Triangles, Wedges, Flags)
- 37 indicators cross-validated against TA-Lib
- Zero runtime dependencies
- ESM + CJS dual output
- Full TypeScript types
