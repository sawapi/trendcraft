# CLAUDE.md

TrendCraft - Technical analysis library for TypeScript

## Project Overview

A library for analyzing financial data (stocks, crypto, etc.).
Provides technical indicators, signal detection, backtesting, and optimization.

## Directory Structure

```
src/
├── core/           # Data normalization, MTF context
├── indicators/     # Technical indicators (45+)
│   ├── moving-average/  # SMA, EMA, WMA
│   ├── momentum/        # RSI, MACD, Stochastics, DMI/ADX, CCI, ROC
│   ├── trend/           # Ichimoku, Supertrend, Parabolic SAR
│   ├── volatility/      # Bollinger Bands, ATR, Keltner, Donchian
│   ├── volume/          # OBV, MFI, VWAP, CMF, Volume Profile
│   ├── price/           # Swing Points, Pivot, FVG, BOS, CHoCH
│   ├── relative-strength/
│   └── smc/             # Order Block, Liquidity Sweep
├── signals/        # Signal detection (crosses, divergence, patterns)
├── backtest/       # Backtest engine
├── optimization/   # Grid Search, Walk-Forward, Monte Carlo
├── scoring/        # Signal scoring system
├── screening/      # Stock screening
├── position-sizing/# Position sizing (Kelly, ATR-based, etc.)
└── types/          # Type definitions
```

## Development Commands

```bash
pnpm install      # Install dependencies
pnpm test         # Run tests (vitest)
pnpm build        # Build (vite)
pnpm lint         # ESLint
pnpm format       # Prettier
```

## Code Conventions

- All indicators return `Series<T>` type (`{ time: number, value: T }[]`)
- Uses Wilder's smoothing method (RSI, ATR, etc.)
- Functions should have JSDoc comments with @example

## Main Entry Points

```typescript
// Indicators
import { sma, ema, rsi, macd, bollingerBands, atr } from "trendcraft";

// Signal detection
import { detectCrosses, detectDivergence } from "trendcraft";

// Backtesting
import { backtest, and, or, goldenCross, rsiBelow } from "trendcraft";

// Optimization
import { gridSearch, walkForwardAnalysis } from "trendcraft";
```

## examples/

- `trading-simulator/` - React-based trading simulator with backtesting
- `chart-viewer/` - Simple chart visualization tool
