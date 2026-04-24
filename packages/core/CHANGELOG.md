# Changelog

## Unreleased

### Added — Price Source Coverage

- `RsiOptions.source`, `MacdOptions.source`, `CciOptions.source` — `rsi()` / `macd()` / `cci()` and their incremental counterparts (`createRsi` / `createMacd` / `createCci`) now accept a `PriceSource` (`"close" | "hl2" | "hlc3" | "ohlc4" | ...`). Defaults preserve current behavior (`"close"` for RSI/MACD, `"hlc3"` for CCI), so existing call sites are unaffected.
  ```typescript
  // Use typical price (HLC3) as RSI input
  const rsiTypical = rsi(candles, { period: 14, source: "hlc3" });
  ```
- `StochRsiOptions.source`, `ConnorsRsiOptions.source` — derived RSI indicators now thread the price source through every internal component. `stochRsi()` / `createStochRsi()` pass `source` to the inner RSI. `connorsRsi()` / `createConnorsRsi()` use the same `source` for the price RSI, the streak comparison, and the 1-period ROC used by `rocPercentile`. Defaults remain `"close"`.
  ```typescript
  // Compute StochRSI / Connors RSI on the typical price
  const srsi = stochRsi(candles, { rsiPeriod: 14, stochPeriod: 14, source: "hlc3" });
  const crsi = connorsRsi(candles, { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100, source: "hlc3" });
  ```

### Added — Session: Lunch Breaks & Timezone Awareness

- `SessionDefinition.breaks?: SessionBreak[]` — sessions can now define one or more intra-session breaks (e.g. JPX/HKEX lunch). Bars inside a break report `inSession: false`, the session anchor (name, open, high, low) is preserved, and `barIndex` does not advance. `sessionStats` and `sessionBreakout` skip break bars but still treat the surrounding session as a single occurrence.
- `SessionDefinition.timezone?: string` — interpret session and break times in any IANA timezone (e.g. `"America/New_York"`, `"Asia/Tokyo"`). DST transitions are handled automatically via the runtime's built-in `Intl.DateTimeFormat` (zero new dependencies). `KillZoneDefinition` accepts the same field.
  ```typescript
  // Define NYSE in ET — DST follows automatically
  const nyse = [{ name: "NYSE", startHour: 9, startMinute: 30, endHour: 16, endMinute: 0,
                  timezone: "America/New_York" }];
  ```
- New session presets and helpers: `getJpxSessions()`, `getHkexSessions()`, `isInSessionWindow()`, `isInAnyBreak()`, `getTzHourMinute()`. New exported types: `SessionBreak`.

### Notes

- All additions are optional; omitting `source`, `breaks`, and `timezone` produces byte-identical results to v0.2.0.

## v0.2.0 (2026-04-20)

Minor bump introducing live-streaming, indicator-registry, and series-metadata APIs, plus parameterized indicator labels.

### Added — Series Metadata

- `SeriesMeta` type and `tagSeries(series, meta)` helper — attach domain metadata (`label`, `overlay`, `yRange`, `referenceLines`) to indicator output via a non-enumerable `__meta` property. Any renderer or UI can read it; indicator consumers that do not care can ignore it.
- `indicator-meta` constants — shared single-source-of-truth metadata used by 42+ batch indicators (SMA, EMA, RSI, MACD, BB, Ichimoku, etc.).
- `SeriesMeta.kind?: string` — parameter-independent identifier for the indicator that produced a series. Matches the key used in `livePresets` / `indicatorPresets` (`"sma"`, `"rsi"`, `"macd"`, `"bollingerBands"`, etc.). Use this for identity matching — `label` is for display and changes with parameters.
  ```typescript
  const series = rsi(candles, { period: 14 });
  series.__meta.kind;    // "rsi"     ← stable across periods
  series.__meta.label;   // "RSI(14)" ← changes with params
  ```
  All ~95 built-in indicators emit a `kind`. Filter by indicator type regardless of period:
  ```typescript
  const smas = allSeries.filter((s) => s.__meta?.kind === "sma");
  ```
- `withLabelParams(meta, params)` helper in `tag-series` for building parameterized labels (`"SMA(20)"`, `"MACD(12, 26, 9)"`, `"BB(20, 2)"`, etc.) when authoring custom indicators. All ~50 built-in parametric indicators — moving averages, the momentum/oscillator set (RSI, MACD, Stochastics, Aroon, CCI, Williams %R, ROC, TRIX, DPO, Hurst, Ultimate Oscillator, Awesome Oscillator, Mass Index, KST, Coppock, TSI, PPO, StochRSI, Connors RSI, CMO, Balance of Power, QStick, ADXR, DMI, IMI), volatility (BB, ATR, Donchian, Keltner, Chandelier Exit, Choppiness, Ulcer, HV, Garman-Klass), trend (Supertrend, Parabolic SAR, Vortex, STC, Linear Regression), and parametric volume (MFI, CMF, Klinger, Elder Force Index, EMV, Volume Anomaly) — emit labels in this form, so three SMAs on one chart render as `"SMA(5)"` / `"SMA(20)"` / `"SMA(60)"` rather than collapsing to identical legend entries.

### Added — Live Streaming

- `createLiveCandle(options, fromState?)` — unified tick/candle aggregator with dynamically registered incremental indicators and an event bus (`tick`, `candleComplete`). Supports both tick mode (`addTick`) and candle mode (`addCandle`), with state save/restore for resumable sessions.
- `livePresets` — registry of 76 incremental indicator presets (factory + metadata + default params + snapshot-name) for zero-config registration in live mode.
- `indicatorPresets` — unified registry of 95 indicator presets with both batch `compute` and incremental `createFactory`, usable from both static and streaming flows.

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
