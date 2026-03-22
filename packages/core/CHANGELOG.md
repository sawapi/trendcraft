# Changelog

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
