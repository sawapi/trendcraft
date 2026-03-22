# Chart-Viewer Visual Verification Checklist

Visual verification of all indicators in chart-viewer.
Calculation values are validated via TA-Lib cross-validation; this checklist focuses on **rendering correctness**.

Legend: ✅ OK | ⚠️ Minor issue (noted) | ❌ Bug found (linked) | ⬜ Not yet checked

---

## Phase 1: SMC & Complex Overlays

| # | Indicator | Type | Status | Notes |
|---|-----------|------|--------|-------|
| 1 | Order Block | overlay/rect | ✅ | |
| 2 | Fair Value Gap | overlay/rect | ⬜ | |
| 3 | Break of Structure | overlay/line | ⬜ | |
| 4 | Change of Character | overlay/line | ⬜ | |
| 5 | Liquidity Sweep | overlay/marker | ⬜ | |
| 6 | Ichimoku | overlay/cloud | ⬜ | |
| 7 | Heikin-Ashi | overlay/candle | ⬜ | |

## Phase 2: Bands, Channels & Trend Overlays

| # | Indicator | Type | Status | Notes |
|---|-----------|------|--------|-------|
| 8 | Bollinger Bands | overlay/band | ⬜ | |
| 9 | Donchian Channel | overlay/band | ⬜ | |
| 10 | Keltner Channel | overlay/band | ⬜ | |
| 11 | Supertrend | overlay/line | ⬜ | |
| 12 | Parabolic SAR | overlay/dots | ⬜ | |
| 13 | Chandelier Exit | overlay/line | ⬜ | |
| 14 | ATR Stops | overlay/levels | ⬜ | |

## Phase 3: Price & Technical Analysis Overlays

| # | Indicator | Type | Status | Notes |
|---|-----------|------|--------|-------|
| 15 | Fibonacci Retracement | overlay/hlines | ⬜ | |
| 16 | Fibonacci Extension | overlay/hlines | ⬜ | |
| 17 | Pivot Points | overlay/hlines | ⬜ | |
| 18 | Swing Points | overlay/markers | ⬜ | |
| 19 | Highest/Lowest | overlay/line | ⬜ | |
| 20 | Auto Trend Line | overlay/line | ⬜ | |
| 21 | Channel Line | overlay/line | ⬜ | |
| 22 | Andrew's Pitchfork | overlay/line | ⬜ | |
| 23 | Candlestick Patterns | overlay/markers | ⬜ | |
| 24 | VWAP | overlay/line | ⬜ | |

## Phase 4A: Subcharts — Momentum & Trend

| # | Indicator | Type | Status | Notes |
|---|-----------|------|--------|-------|
| 25 | RSI | subchart/line+zone | ⬜ | |
| 26 | MACD | subchart/bar+2lines | ⬜ | |
| 27 | Stochastics | subchart/2lines+zone | ⬜ | |
| 28 | Stochastic RSI | subchart/2lines+zone | ⬜ | |
| 29 | CCI | subchart/line | ⬜ | |
| 30 | Williams %R | subchart/line+zone | ⬜ | |
| 31 | ROC | subchart/line | ⬜ | |
| 32 | DMI/ADX | subchart/3lines | ⬜ | |
| 33 | Range-Bound | subchart/special | ⬜ | |
| 34 | Roofing Filter | subchart/line | ⬜ | |

## Phase 4B: Subcharts — Volume & Other

| # | Indicator | Type | Status | Notes |
|---|-----------|------|--------|-------|
| 35 | ATR | subchart/line | ⬜ | |
| 36 | MFI | subchart/line+zone | ⬜ | |
| 37 | OBV | subchart/line | ⬜ | |
| 38 | CMF | subchart/line | ⬜ | |
| 39 | Volume Anomaly | subchart/special | ⬜ | |
| 40 | Volume Profile | subchart/hbars | ⬜ | |
| 41 | Volume Trend | subchart/special | ⬜ | |
| 42 | Volatility Regime | subchart/special | ⬜ | |
| 43 | Scoring | subchart/composite | ⬜ | |

## Phase 6: Signal Markers & Moving Averages

| # | Indicator | Type | Status | Notes |
|---|-----------|------|--------|-------|
| 44 | SMA 5 | overlay/line | ⬜ | |
| 45 | SMA 25 | overlay/line | ⬜ | |
| 46 | SMA 75 | overlay/line | ⬜ | |
| 47 | EMA 12 | overlay/line | ⬜ | |
| 48 | EMA 26 | overlay/line | ⬜ | |
| 49 | WMA 20 | overlay/line | ⬜ | |
| 50 | VWMA 20 | overlay/line | ⬜ | |
| 51 | Super Smoother | overlay/line | ⬜ | |
| 52 | Perfect Order | signal/marker | ⬜ | |
| 53 | Range-Bound (signal) | signal/marker | ⬜ | |
| 54 | GC/DC | signal/marker | ⬜ | |
| 55 | Divergence | signal/marker | ⬜ | |
| 56 | BB Squeeze | signal/marker | ⬜ | |
| 57 | Volume Breakout | signal/marker | ⬜ | |
| 58 | Volume MA Cross | signal/marker | ⬜ | |

---

## Issues Found

| # | Indicator | Issue | Severity | Fix |
|---|-----------|-------|----------|-----|
| | | | | |
