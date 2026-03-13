# CLAUDE.md

TrendCraft - Technical analysis library for TypeScript

## Project Overview

A library for analyzing financial data (stocks, crypto, etc.).
Provides technical indicators, signal detection, backtesting, and optimization.

## Directory Structure

```
src/
├── core/           # Data normalization, MTF context
├── indicators/     # Technical indicators (68+)
│   ├── moving-average/  # SMA, EMA, WMA, VWMA, KAMA, T3, HMA, McGinley Dynamic, EMA Ribbon
│   ├── momentum/        # RSI, MACD, Stochastics, DMI/ADX, CCI, ROC, Connors RSI, IMI, ADXR
│   ├── trend/           # Ichimoku, Supertrend, Parabolic SAR
│   ├── volatility/      # Bollinger Bands, ATR, Keltner, Donchian, Choppiness Index
│   ├── volume/          # OBV, MFI, VWAP (Bands), CMF, Volume Profile, Anchored VWAP, Elder Force Index, EMV, Klinger, TWAP, Weis Wave, Market Profile
│   ├── price/           # Swing Points, Pivot, FVG, BOS, CHoCH, ORB, Gap Analysis
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

## General Rules

- Always use English for all code comments, labels, UI text, README files, and documentation unless explicitly told otherwise
- Before making any code changes, confirm understanding of the user's intent. Do not modify code to 'fix' something unless explicitly asked. When the user asks a question about current state, answer the question first — do not preemptively change code

## Code Quality

- If a single file exceeds 500 lines, suggest splitting it into focused modules before adding more code
- All indicators return `Series<T>` type (`{ time: number, value: T }[]`)
- Uses Wilder's smoothing method (RSI, ATR, etc.)
- Functions should have JSDoc comments with @example

## Testing & Validation

- Always run `pnpm build` (or the equivalent type-check command) after making changes to verify the build passes before reporting completion
- For chart-viewer changes: `cd examples/chart-viewer && npx tsc --noEmit`

## Chart-Viewer Development

- After implementing new indicators or features that have UI settings, always check and update the Indicator Settings UI groups/panels (`IndicatorSettingsDialog.tsx`) to include the new entries. Never assume the UI will auto-discover new indicators
- When implementing chart/ECharts features, be careful with layout calculations: always account for labelHeight, title heights, margins, and dataZoom positioning. Test visual elements don't overlap. Overlay indicators go on the main chart (not as subcharts) unless explicitly specified otherwise

## Git Workflow

- When generating commit messages, wait for the user to confirm intent before proceeding. For large changesets, proactively suggest splitting into logical commits with file groupings

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
- `alpaca-demo/` - Multi-agent paper trading system (Alpaca API)

## Alpaca Demo

- Type check: `cd examples/alpaca-demo && npx tsc --noEmit`
- **pnpm 7+ does NOT need `--` to pass arguments to scripts.** Use `pnpm run dev <command> [options]` directly, not `pnpm run dev -- <command>`. The `--` gets forwarded literally and breaks commander's subcommand parsing.
