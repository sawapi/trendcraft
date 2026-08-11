# CLAUDE.md

TrendCraft - Technical analysis library for TypeScript (pnpm workspace monorepo)

## Project Overview

A library for analyzing financial data (stocks, crypto, etc.).
Provides technical indicators, signal detection, backtesting, and optimization.
`@trendcraft/chart` provides a Canvas-based charting library with auto-detection of TrendCraft indicator series, framework bindings (React/Vue), and a headless API.
`@trendcraft/mcp` is a Model Context Protocol server exposing indicator manifests plus calc/signal dispatchers to LLM clients (Claude Desktop, Cursor).

## Directory Structure

Indicator and example lists below are non-exhaustive (categories grow over time); they name representative members, not the full set.

```
packages/
├── chart/              # npm package "@trendcraft/chart"
│   ├── src/
│   │   ├── core/           # Data layer, scales, layout, viewport, plugin types
│   │   ├── renderer/       # Canvas render pipeline, overlays, axis
│   │   ├── series/         # Series type renderers (candlestick, line, band, cloud, etc.)
│   │   ├── integration/    # Series introspection, indicator presets, live feed
│   │   ├── plugins/        # Built-in series/primitive plugins
│   │   └── sparkline/      # Sparkline subpath (@trendcraft/chart/sparkline)
│   ├── react/              # React wrapper (TrendChart) + react/sparkline
│   ├── vue/                # Vue wrapper (TrendChart) + vue/sparkline
│   └── examples/           # see "## examples/" below
├── core/               # npm package "trendcraft"
│   ├── src/
│   │   ├── core/           # Data normalization, MTF context
│   │   ├── indicators/     # Technical indicators (130+)
│   │   │   ├── moving-average/  # SMA, EMA, WMA, VWMA, KAMA, T3, HMA, ALMA, DEMA/TEMA, FRAMA, ZLEMA, McGinley Dynamic, EMA Ribbon
│   │   │   ├── momentum/        # RSI, MACD, Stochastics, DMI/ADX, CCI, ROC, Connors RSI, IMI, ADXR, TSI, TRIX, KST, PPO, Aroon, …
│   │   │   ├── trend/           # Ichimoku, Supertrend, Parabolic SAR, Vortex, Schaff Trend Cycle, Linear Regression
│   │   │   ├── volatility/      # Bollinger Bands, ATR, Keltner, Donchian, GARCH, Garman-Klass, Chandelier Exit, Choppiness Index
│   │   │   ├── volume/          # OBV, MFI, VWAP (Bands), CMF, Volume Profile, Anchored VWAP, Elder Force Index, EMV, Klinger, TWAP, Weis Wave, Market Profile, CVD
│   │   │   ├── price/           # Swing Points, Pivot, FVG, BOS, CHoCH, ORB, Gap Analysis, S/R Zone Clustering, Fibonacci, Pitchfork, Zigzag, Fractals
│   │   │   ├── session/         # ICT Kill Zones, Session Analytics, Session Breakout
│   │   │   ├── regime/          # HMM Regime Detection (Baum-Welch, Viterbi)
│   │   │   ├── wyckoff/         # VSA (Volume Spread Analysis), Wyckoff Phase Detection
│   │   │   ├── relative-strength/
│   │   │   ├── smc/             # Order Block, Liquidity Sweep
│   │   │   ├── adaptive/        # Adaptive MA/RSI/Stochastics/Bollinger
│   │   │   ├── filter/          # Super Smoother, Roofing Filter
│   │   │   └── incremental/     # Streaming/incremental indicator engine
│   │   ├── signals/        # Signal detection (crosses, divergence, patterns)
│   │   ├── backtest/       # Backtest engine
│   │   ├── optimization/   # Grid Search, Walk-Forward, Monte Carlo
│   │   ├── scoring/        # Signal scoring system
│   │   ├── screening/      # Stock screening
│   │   ├── position-sizing/# Position sizing (Kelly, ATR-based, etc.)
│   │   ├── meta-strategy/  # Equity Curve Trading, Strategy Rotation
│   │   ├── strategy/       # Strategy definition, JSON serialization, condition registry
│   │   ├── risk/           # VaR, CVaR, Risk Parity, Correlation-Adjusted Sizing
│   │   └── types/          # Type definitions
│   ├── bin/             # CLI tools
│   ├── docs/            # API docs, guide, cookbook
│   ├── cross-validation/ # TA-Lib cross-validation tests
│   └── examples/        # see "## examples/" below
└── mcp/                # npm package "@trendcraft/mcp"
    └── src/             # MCP server: tools/, dispatcher/, schemas/, validation/, bin/
```

## Development Commands

```bash
pnpm install --frozen-lockfile   # Install dependencies (workspace)
pnpm test                        # Run tests (all packages)
pnpm build                       # Build (all packages)
pnpm lint                        # Biome lint
pnpm format                      # Biome format
```

**Install note**: Prefer `pnpm install --frozen-lockfile` over a plain `pnpm install`, especially in a fresh `git worktree`. A plain install has in practice produced an incomplete dependency graph in a new worktree — vue/react types failed to resolve inside vite-plugin-dts (TS2305 errors during `pnpm build`) — even though the lockfile was reported as "up to date". `--frozen-lockfile` refuses to modify the lockfile and in that situation produced a clean, consistent install.

### Package-level commands

```bash
cd packages/core
pnpm test         # Run core tests (vitest)
pnpm build        # Build core (vite)
```

```bash
cd packages/chart
pnpm test         # Run chart tests (vitest, 19 test files)
pnpm build        # Build chart (vite)
pnpm dev          # Dev server with examples
pnpm size-check   # Check bundle size limits (esbuild, brotli-compressed)
```

## General Rules

- Always use English for all code comments, labels, UI text, README files, and documentation unless explicitly told otherwise
- Before making any code changes, confirm understanding of the user's intent. Do not modify code to 'fix' something unless explicitly asked. When the user asks a question about current state, answer the question first — do not preemptively change code

## Code Quality

- If a single file exceeds 500 lines, suggest splitting it into focused modules before adding more code
- All indicators return `Series<T>` type (`{ time: number, value: T }[]`)
- Uses Wilder's smoothing method (RSI, ATR, etc.)
- Functions should have JSDoc comments with @example
- `@trendcraft/chart`: Bundle size limits enforced via `size-limit` + `@size-limit/esbuild` (brotli-compressed). Main ≤ 42.5 kB, Headless ≤ 11.75 kB, React/Vue wrapper ≤ 34 kB, Sparkline ≤ 5 kB (vanilla) / 7 kB (React/Vue), Replay ≤ 3 kB. Limits are ratcheted alongside intentional growth — `packages/chart/package.json` `size-limit` is the source of truth. Zero runtime dependencies; `trendcraft` (`>=0.3.0`), `react` (`>=18.0.0`), `vue` (`>=3.3.0`) are optional peer deps
- `@trendcraft/chart` + `indicatorPresets` integration: when wiring a chart to `connectIndicators(chart, { presets: indicatorPresets, ... })`, **also call `registerTrendCraftPresets(chart)` from `@trendcraft/chart/presets`** before adding indicators. Without it, TrendCraft-specific shapes (adaptiveRsi `{rsi, effectivePeriod, volatilityPercentile}`, connorsRsi, klinger, vsa, etc.) fall through built-in introspection rules and silently render as generic "Indicator"/"Series" with no visible line. The chart degrades silently — there is no warning. See `packages/chart/examples/indicator-showcase/src/main.ts:57` for the canonical setup

## Testing & Validation

- Always run `pnpm build` (or the equivalent type-check command) after making changes to verify the build passes before reporting completion
- For echarts-viewer changes: `cd packages/core/examples/echarts-viewer && npx tsc --noEmit`

## echarts-viewer Development (packages/core/examples/echarts-viewer/)

> **Note:** This section refers to `packages/core/examples/echarts-viewer/` (ECharts-based demo app, formerly `chart-viewer/`), not the `@trendcraft/chart` package.

- After implementing new indicators or features that have UI settings, always check and update the Indicator Settings UI groups/panels (`IndicatorSettingsDialog.tsx`) to include the new entries. Never assume the UI will auto-discover new indicators
- When implementing chart/ECharts features, be careful with layout calculations: always account for labelHeight, title heights, margins, and dataZoom positioning. Test visual elements don't overlap. Overlay indicators go on the main chart (not as subcharts) unless explicitly specified otherwise

## Git Workflow

- When generating commit messages, wait for the user to confirm intent before proceeding. For large changesets, proactively suggest splitting into logical commits with file groupings

## Release Workflow

This is a pnpm workspace monorepo with three independently published packages: `trendcraft` (core), `@trendcraft/chart`, and `@trendcraft/mcp`. Treat their versions and releases as independent; only the repository is shared. The serial-release steps below cover the core→chart dependency chain; `@trendcraft/mcp` follows the same conventions (tag `mcp-v<x.y.z>`, finalize its own CHANGELOG, publish after core when it consumes newly-added core APIs).

### Tag naming

Use prefix-dash form so each package's tags are filterable (`git tag -l 'chart-*'`):

- `core-v<major>.<minor>.<patch>` — e.g. `core-v0.2.0`
- `chart-v<major>.<minor>.<patch>` — e.g. `chart-v0.1.0`
- `mcp-v<major>.<minor>.<patch>` — e.g. `mcp-v0.1.0`

The legacy tag `v0.1.0` (no prefix) points to the first `trendcraft` release and is kept as-is. Do not reuse the unprefixed `v*` form for new releases.

### Release order (always serial)

When a change spans both packages (chart relies on core's new API), release must be serial to avoid peer dep drift:

1. Merge all changes to `main`
2. Finalize `packages/core/CHANGELOG.md` — promote `Unreleased` to the new version with a concrete date
3. Bump `packages/core/package.json` version
4. Tag `core-v<x.y.z>` on that commit, push tag, run `pnpm publish` for core
5. Wait for `npm view trendcraft@<x.y.z> version` to resolve
6. Update `packages/chart/package.json` peer dep minimum to the just-published core version if chart uses new core APIs
7. Finalize `packages/chart/CHANGELOG.md` — fill in the date
8. Bump `packages/chart/package.json` version
9. Tag `chart-v<x.y.z>`, push tag, run `pnpm publish` for chart

Do not publish chart first when it depends on unreleased core APIs; the `workspace:*` link hides the missing peer until users actually install from npm.

### Peer dep hygiene

- `@trendcraft/chart`'s peer on `trendcraft` must be `>=<latest-core-using-APIs-we-call>`. Bump it whenever chart starts calling a newly-added core symbol.
- Keep the peer a `>=` range, not an exact pin — users should be able to pick up core patch releases freely.

### Versioning (SemVer under 0.x)

- Pre-1.0, minor bumps (`0.x.0`) are allowed to carry breaking changes; patch bumps (`0.x.y`) must be backward compatible.
- API surface changes that are purely additive still warrant a minor bump when the surface meaningfully grows (e.g. a whole new entry point, 50+ new exports).
- Rename/remove of a previously-exported symbol = minor bump (documented in CHANGELOG's "Breaking" subsection). A symbol that was never exported in a published version is not breaking.

### CHANGELOG convention

- Keep an `Unreleased` / draft section at the top while work is in flight. Promote to a versioned heading at release time with a concrete date.
- One CHANGELOG per package (`packages/core/CHANGELOG.md`, `packages/chart/CHANGELOG.md`). Do not maintain a root CHANGELOG.
- Commit messages can be terse; the CHANGELOG is the user-facing surface and should be written for consumers, not reviewers.

### Pre-release (optional)

For the first coupled release of core + chart, or any time the API contract between the two is in doubt, consider `core-v0.x.0-rc.0` / `chart-v0.x.0-rc.0` on npm's `next` dist-tag first, verify integration against the real registry, then promote to stable.

## Main Entry Points

```typescript
// Indicators
import { sma, ema, rsi, macd, bollingerBands, atr } from "trendcraft";

// Signal detection
import { detectCrosses, detectDivergence, cvdDivergence } from "trendcraft";

// Backtesting
import { backtest, and, or, goldenCross, rsiBelow } from "trendcraft";

// Optimization
import { gridSearch, walkForwardAnalysis } from "trendcraft";

// Order Flow & Volume Delta
import { cvd, cvdWithSignal } from "trendcraft";

// S/R Zone Clustering
import { srZones, srZonesSeries } from "trendcraft";

// Session / Kill Zones
import { detectSessions, killZones, sessionBreakout, sessionStats } from "trendcraft";

// HMM Regime Detection
import { hmmRegimes, fitHmm, regimeTransitionMatrix } from "trendcraft";

// Wyckoff Analysis (VSA + Phase Detection)
import { vsa, wyckoffPhases } from "trendcraft";

// Meta-Strategy (Equity Curve Trading, Strategy Rotation)
import { applyEquityCurveFilter, equityCurveHealth, rotateStrategies } from "trendcraft";

// Risk Analytics (VaR / CVaR / Risk Parity)
import { calculateVaR, rollingVaR, riskParityAllocation, correlationAdjustedSize } from "trendcraft";

// Strategy JSON Serialization (condition registry + serialize/hydrate)
import {
  backtestRegistry, streamingRegistry,
  serializeStrategy, parseStrategy,
  loadStrategy, hydrateCondition,
  validateConditionSpec, validateStrategyJSON,
} from "trendcraft";
```

## Chart Entry Points

```typescript
// Main (DOM)
import { createChart, connectLiveFeed } from "@trendcraft/chart";

// Plugin system
import { defineSeriesRenderer, definePrimitive } from "@trendcraft/chart";

// Headless (no DOM)
import { DataLayer, TimeScale, PriceScale, introspect, lttb } from "@trendcraft/chart/headless";

// React
import { TrendChart } from "@trendcraft/chart/react";

// Vue
import { TrendChart } from "@trendcraft/chart/vue";
```

## examples/

### packages/core/examples/

- `echarts-viewer/` - Comprehensive ECharts-based viewer (proves core works with any chart library)
- `trading-simulator/` - React-based trading simulator with backtesting
- `quick-start/` - Minimal getting-started example
- `sp500-showcase/` - S&P 500 dataset showcase

### packages/chart/examples/

- `simple-chart/` - Vanilla TypeScript chart with indicators, drawings, plugins
- `simple-react-chart/` - React wrapper usage
- `simple-vue-chart/` - Vue wrapper usage
- `indicator-showcase/` - Multi-indicator catalog (canonical preset/introspection setup)
- `sparkline-showcase/` - Sparkline subpath showcase
- `strategy-studio/` - Strategy backtesting/studio app
- `docs-screenshots/` - Screenshot generation for docs
- `webgl-poc/` - WebGL renderer proof-of-concept
