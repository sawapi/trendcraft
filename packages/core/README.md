# TrendCraft

A zero-dependency TypeScript technical-analysis library: 130+ indicators, signal detection, backtesting, optimization, and live streaming.

[日本語版 README](./README.ja.md)

TrendCraft turns raw OHLCV candles into indicators, trading signals, and backtested strategies — all in pure TypeScript with no runtime dependencies. Every indicator returns the same `Series<T>` shape (`{ time, value }[]`), so results compose cleanly and work with any chart library or data pipeline. It runs in Node and the browser.

## Install

```bash
pnpm add trendcraft
# or
npm install trendcraft
```

## Quick start

```typescript
import { sma, rsi, bollingerBands } from 'trendcraft';
import { TrendCraft, goldenCrossCondition, deadCrossCondition, and, rsiBelow } from 'trendcraft';

const candles = [
  { time: 1700000000000, open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  // ... more candles (OHLCV format)
];

// Compute indicators — each returns Series<T> = { time, value }[]
const sma20 = sma(candles, { period: 20 });
const rsi14 = rsi(candles, { period: 14 });
const bb    = bollingerBands(candles, { period: 20, stdDev: 2 });

// Backtest a strategy with the fluent API
const result = TrendCraft.from(candles)
  .strategy()
    .entry(and(goldenCrossCondition(), rsiBelow(50)))
    .exit(deadCrossCondition())
  .backtest({ capital: 1_000_000, stopLoss: 5, takeProfit: 15 });

console.log(`Return: ${result.totalReturnPercent.toFixed(2)}%  Sharpe: ${result.sharpeRatio.toFixed(3)}`);
```

Runnable scripts live in [`examples/quick-start/`](./examples/quick-start/) (indicators, backtesting, optimization, screening, streaming).

## What's inside

- **Indicators (130+)** — moving averages (SMA, EMA, KAMA, T3, HMA…), trend (Ichimoku, Supertrend, Parabolic SAR), momentum (RSI, MACD, Stochastics, DMI/ADX, Connors RSI…), volatility (Bollinger Bands, ATR, Keltner, Donchian, Choppiness), volume (OBV, MFI, VWAP, CMF, Volume Profile, CVD…), price structure (pivots, swings, FVG, BOS/CHoCH, S/R zones), plus Smart Money Concepts, Wyckoff/VSA, ICT sessions, HMM regimes, adaptive indicators, and relative strength.
- **Signal detection** — golden/dead crosses, RSI/MACD/OBV divergence, Bollinger squeeze, range-bound detection, and chart patterns (double top/bottom, head & shoulders, triangles, wedges, flags).
- **Backtesting** — preset-condition strategies with stop loss, take profit, trailing stops, commission/slippage, multi-timeframe conditions, and full performance metrics (Sharpe, max drawdown, win rate, profit factor).
- **Optimization** — grid search with constraints, walk-forward analysis for out-of-sample validation, and combination search.
- **Signal scoring** — weighted multi-signal scoring with presets and a fluent `ScoreBuilder`.
- **Position sizing & risk** — risk-based, ATR-based, Kelly, and fixed-fractional sizing; ATR stops and Chandelier Exit; VaR/CVaR, risk parity, and correlation-adjusted sizing.
- **Streaming** — `createLiveCandle()` aggregates ticks or candles and drives 90+ incremental indicator factories bar-by-bar, with state save/restore for resumable sessions.
- **Advanced analytics** — pairs trading / cointegration, cross-asset correlation, alpha-decay monitoring, strategy robustness scoring, and signal explainability.

48 indicators are cross-validated against TA-Lib — see [`cross-validation/`](./cross-validation/).

## Entry points

```typescript
// Indicators
import { sma, ema, rsi, macd, bollingerBands, atr } from 'trendcraft';

// Signal detection
import { goldenCross, deadCross, rsiDivergence, bollingerSqueeze } from 'trendcraft';

// Backtesting (fluent API + preset conditions)
import { TrendCraft, and, or, goldenCrossCondition, rsiBelow } from 'trendcraft';

// Optimization
import { gridSearch, walkForwardAnalysis } from 'trendcraft';

// Streaming
import { createLiveCandle, incremental } from 'trendcraft';

// Subpaths
import { ... } from 'trendcraft/safe';        // Result-typed indicators
import { ... } from 'trendcraft/incremental';  // Bar-by-bar factories
import { ... } from 'trendcraft/screening';    // Stock screening
import { ... } from 'trendcraft/manifest';     // Indicator metadata
```

A `Candle` accepts `time` as a Unix timestamp (seconds, milliseconds, or microseconds) or a date string; every indicator emits `Series<T> = { time: number, value: T }[]`.

Three CLI tools ship with the package: `trendcraft-screen`, `trendcraft-backtest`, and `trendcraft-analyze` (run with `npx`; pass `--list` to see available conditions for screen/backtest).

## Documentation

- [Guide](./docs/GUIDE.md) — usage walkthrough and concepts ([日本語](./docs/GUIDE.ja.md))
- [API Reference](./docs/API.md) — full API surface ([日本語](./docs/API.ja.md))
- [Cookbook](./docs/COOKBOOK.md) — practical recipes
- [Migration: 0.3 → 0.4](./docs/migration-0.3-to-0.4.md)
- [CHANGELOG](./CHANGELOG.md)
- [llms.txt](./llms.txt) / [llms-full.txt](./llms-full.txt) — LLM-friendly summaries

## Disclaimer

`trendcraft` provides technical-analysis primitives for informational and educational purposes only. Indicator values, signals, and backtest results are not investment advice and are not a recommendation to buy, sell, or hold any financial instrument. You are solely responsible for any trading decisions made using this software.

## License

MIT
