# Changelog

## Unreleased

### Added — `getIndicatorPresetKey(kind)` for manifest-kind → preset-key resolution

Forward sibling of `getIndicatorPreset(kind)`: returns the preset's
short key (`"bb"`) when given either the manifest's canonical long name
(`"bollingerBands"`) or the short key itself. Returns `undefined` when
the kind has no preset (regime classifiers, smc events).

Typical use is bridging manifest output to chart-side APIs that key on
the short name, e.g. `connectIndicators({ presets }).add(key, ...)`.
Hosts that previously did their own reverse scan over `indicatorPresets`
can drop that and read directly from the canonical alias table.

Both helpers share the same `KIND_ALIASES` table internally, so they
cannot drift on which kind maps where.

### Added — Extended `BacktestResult` metrics (Sortino, Calmar, CAGR, Expectancy, Exposure, per-trade aggregates)

`BacktestResult` gains **eleven** new fields filled in by every call to
`runBacktest` / `runScaledEntryBacktest`:

- `sortinoRatio` — like Sharpe but divides by *downside* deviation
  only, so upside volatility no longer penalizes the score. `0` when
  there are no negative returns. Annualized with `sqrt(252)` to match
  Sharpe's convention.
- `calmarRatio` — `cagrPercent / maxDrawdown`. Industry-standard
  "return per unit of pain". `0` when `maxDrawdown` is zero.
- `cagrPercent` — compound annual growth rate, computed from the
  candle span (first bar time → last bar time). Replaces having to
  guess at "what's my actual annualized return" from
  `totalReturnPercent` + holding period.
- `expectancyPercent` — average of `trade.returnPercent` across all
  trades. Equivalent to `(winRate × avgWin) − (lossRate × avgLoss)`.
  Positive = strategy is profitable per trade on average; the
  canonical "is this an edge?" check.
- `exposurePercent` — total holding time divided by the candle span.
  A Sharpe of 2 at 10% exposure is materially different from a
  Sharpe of 2 at 100% exposure; this surfaces that distinction.
  **Computed via merged `(entryTime, exitTime)` intervals** so
  scale-out / partial-exit strategies (which emit several `Trade`
  records that share an entry time) report the actual time-in-market
  rather than the naive `sum(holdingDays)` that would double-count.
- `avgWinPercent` / `avgLossPercent` — average % return of winning /
  losing trades. `avgLossPercent` is reported as a positive number
  ("how much did the average loser lose").
- `largestWinPercent` / `largestLossPercent` — best / worst single-
  trade return, same positive-for-loss convention.
- `firstBarTime` / `lastBarTime` — the candle span the backtest ran
  over (epoch ms). Stored so derived analyses (equity-curve filter,
  slicing, post-hoc annualization) can recompute time-based metrics
  without re-supplying the window.

Matches TradingView Performance Summary, QuantifiedStrategies'
checklist, and Van Tharp's metrics framework — what veteran traders
expect to see in a backtest summary.

The metric math is consolidated into a single
`computeExtendedMetrics(...)` helper exported from
`backtest/engine-utils.ts`, used by every `BacktestResult`
construction site — the main `runBacktest` engine, the scaled-entry
engine, and `meta-strategy/equity-curve.ts:rebuildResult` (which
filters trades and recomputes metrics against the same candle
window).

`calculateStats` and `emptyResult` (internal) gained an optional
`span` parameter (`{ firstTime, lastTime }`). Engines that have
candle data pass it automatically so CAGR / exposure are accurate.
External consumers wrapping `calculateStats` directly get `0` for
those metrics if they don't supply `span` — back-compatible.

All new fields default to `0` in `emptyResult` and round to 2 decimal
places. No existing field semantics change. **Type-level note:**
because the new fields are required on `BacktestResult`, external
code that *constructs* this type (e.g. test fixtures, mock results)
must supply the new properties. Reading code is unaffected.

### Breaking — Indicator State Contract (`getState` / `fromState` wire format)

Every incremental indicator (`createSma`, `createEma`, `createMacd`,
… — all ~94 of them) now exchanges state through a versioned
envelope instead of a bare state object:

```ts
type IndicatorSnapshot<TState> = {
  meta: {
    version: number;                  // per-indicator schema version
    indicator: string;                // "sma" | "ema" | … runtime guard
    params: Record<string, unknown>;  // params captured at snapshot time
  };
  state: TState;                       // indicator-specific state
};
```

- `getState()` now returns `IndicatorSnapshot<TState>` (previously
  the bare `TState`).
- `createXxx(options, { fromState })` now expects an
  `IndicatorSnapshot<TState>` for `fromState` (previously the bare
  `TState`).

**Pre-0.4.0 snapshots cannot be resumed.** They have no `meta`
field; `fromState` detects this and throws
`<indicator>: incompatible snapshot, re-warm required`. The fix is
to re-warm the indicator from candle history (replay candles through
`next()`), or fall back to a fresh instance. There is no automatic
migration in 0.4.0 — `throw + re-warm` is the policy.

Resume behaviour is now defined per **state category**:

- **Windowed** (SMA, WMA, ALMA, Donchian, Highest/Lowest, …) —
  carry-forward: resuming with a different `period` reuses the
  saved buffer and re-warms only the shortfall. A `source` change
  still throws.
- **Recursive / Mixed / Cascaded** (EMA, ZLEMA, FRAMA, KAMA, MACD,
  DEMA, TEMA, HMA, …) — any state-shaping param change on resume
  throws; the recursive accumulator encodes past params and cannot
  be reconfigured mid-stream.
- **Event log** (BOS, FVG, Liquidity Sweep, Pivot Points, Order
  Block, Swing Points, …) — append-only: a params change keeps the
  recorded events and continues appending.

A new orthogonal **param-role** axis lets *resume-invariant* params
change freely on resume regardless of category. These params (e.g.
a band-width `multiplier` that only scales the state→output
projection, never the state itself) are exempt from the resume
compatibility check — the saved state is reused verbatim and the new
value takes effect immediately. `source` is never eligible.

Streaming sessions (`createLiveCandle` / `createPipeline` /
`createSession`) persist per-indicator `getState()` output, so
**0.3.x streaming session snapshots cannot be resumed in 0.4.0** —
re-warm from candle history. Strategy JSON
(`serializeStrategy` / `parseStrategy`) describes configurations,
not runtime state, and is unaffected.

See `docs/migration-0.3-to-0.4.md` for the 5-minute upgrade guide.

### Breaking — Elder's Force Index returns `{ short, long }`

`elderForceIndex` and the incremental `createElderForceIndex` now
emit Elder's canonical pair on every bar: a **2-period** EMA for
entry timing and a **13-period** EMA for trend bias. The legacy
single-period output (default `period: 13`) is gone.

Migration:

- Old: `elderForceIndex(c, { period: 13 })` → `Series<number | null>`
- New: `elderForceIndex(c)` → `Series<{ short: number | null, long: number | null }>`

Callers that only need the long line should read `.long`; callers
that previously passed a custom `period` should pass it as
`longPeriod` (and optionally a custom `shortPeriod` to match
Elder's two-screen approach).

The streaming preset wrappers (`indicatorPresets.elderForceIndex`,
`livePresets.elderForceIndex`) now expose `shortPeriod` /
`longPeriod` instead of `period`. The live snapshot key is now
`efi_${shortPeriod}_${longPeriod}` so old `efi` snapshots from
the single-period era are discarded cleanly on resume — no
mixed-period state corruption.

The chart introspection rule auto-detects the new shape and
plots the `short` (orange) and `long` (purple) lines together
in the sub-pane, so chart consumers don't need any host-side
changes when the chart picks up the new core.

### Breaking — Ease of Movement default `volumeDivisor`

`easeOfMovement` and the incremental `createEmv` now default
`volumeDivisor` to `100_000_000` (1e8), matching the StockCharts /
ChartSchool canonical scaling. The previous default was `10000`, which
produced values ~10000× *smaller* than every reference implementation
(EMV is proportional to `volumeDivisor`). The streaming preset wrappers
(`indicatorPresets.emv`, `livePresets.emv`) now also inherit the
canonical default — previously they hard-coded 10000 independently.

For trading-decision use cases the **sign** and **slope** of EMV are
what matter, and both are invariant to `volumeDivisor` — strategies
relying on EMV crossings or zero-line crosses are unaffected. Code
that compares EMV's absolute magnitude to a hard-coded threshold or
to a value pinned from the prior trendcraft default needs to either
multiply the threshold by 10000 or pass `volumeDivisor: 10000`
explicitly.

State resume preserves the captured divisor: a state captured under
the legacy 10000 divisor and resumed via `createEmv(opts, { fromState })`
continues at 10000, not the new 1e8 default. Explicit `opts.volumeDivisor`
still wins over both the snapshot and the default.

### Added — strategy JSON round-trip depth tests

`serialize / parse` is now pinned across:

- all condition shapes (preset leaf, `and`, `or`, `not`)
- 3- and 4-level nesting
- presence and absence of optional fields (`tags`, `metadata`,
  `description`, `backtest.*`, `params`)
- unicode / quotes / backslashes / newlines in `id` / `name` /
  `description`; long descriptions; 20-element tag arrays
- every entry in `backtestRegistry`: each preset's default-param
  shape round-trips through `serialize → parse → serialize` to
  byte-identical JSON

The contract enforced is `serialize(parse(serialize(s))) === serialize(s)`
plus structural equality after parse. No production behavior change;
this is regression coverage for the JSON layer that downstream
consumers (MCP, Strategy Studio, Strategy DNA) all build on.

### Fixed — incremental Volume Trend / Chandelier Exit match their batch functions

Two incremental indicators diverged from their batch counterparts
on a handful of bars; both are now corrected so the streaming and
batch APIs produce identical output.

- **Volume Trend** — when the price trend was `neutral`, the
  incremental `createVolumeTrend` discarded the `volumeTrend`
  reading and reported `volumeTrend: "neutral"`. The volume trend
  is an independent measurement and is now reported on every bar,
  matching batch `volumeTrend()`. `isConfirmed` / `hasDivergence` /
  `confidence` are still zeroed when the price trend is neutral.
- **Chandelier Exit** — the incremental `createChandelierExit`
  emitted a running partial `highestHigh` / `lowestLow` during the
  warmup period, while batch `chandelierExit()` (and the library's
  `highest()` / `lowest()`) report `null` until the lookback window
  is full. The incremental now reports `null` for these fields
  during warmup. The actual exit levels (`longExit` / `shortExit` /
  `direction`) were already correct and are unchanged.

The `consistency.test.ts` suite now also asserts the previously
unchecked `highestHigh` / `lowestLow` / `atr` fields and gains a
Volume Trend batch-parity block.

### Fixed — GARCH / EWMA volatility input and stationarity guards

- `garch(returns)` and `ewmaVolatility(returns)` now throw early when
  any input element is `NaN` / `±Infinity`. A single contaminated
  return previously poisoned the negative log-likelihood and every
  downstream parameter, returning a silently broken model with
  `converged: result.converged` from the optimiser.
- `garch` no longer reports `converged: true` when the optimiser's
  output had to be clamped (`omega <= 0`, negative `alpha` / `beta`,
  or `alpha + beta >= 1`). The returned params are not the optimiser's
  settled answer in that case, so flagging convergence is misleading.
- If the optimiser drifts to non-finite parameters, `garch` now
  falls back to the unconditional-variance degenerate result with
  `converged: false` instead of returning a `NaN` forecast.
- `forecastVar` is `Number.isFinite`-checked before `sqrt`; falls back
  to the unconditional variance on the rare case the recursive update
  drifts non-finite under finite input.

### Fixed — Ulcer Index uses the canonical Peter Martin two-stage formula

`ulcerIndex` now matches Peter Martin & Byron McCann's original
(1987) two-stage definition:

1. For each bar `j`: `rolling_max[j] = max(close[j - N + 1 .. j])`
2. For each bar `j`: `drawdown[j] = (close[j] - rolling_max[j]) / rolling_max[j] × 100`
3. `UI[i] = sqrt(mean(drawdown[i - N + 1 .. i]^2))`

Each per-bar drawdown is now measured against that bar's own rolling
peak. The previous implementation used a single peak shared across
the whole window, which the docstring already described in canonical
terms; the code is now consistent with the docstring.

**Breaking** for callers that depended on the prior numeric output:

- Total warmup is now `2 × period - 1` bars (was `period`). First
  non-null is at index `2 × period - 2` (was `period - 1`).
- Numeric values change for every period combination.

The same fix is applied to `createUlcerIndex` (incremental). The
incremental version now keeps two `period`-sized buffers — rolling
prices for stage 1 and rolling drawdowns for stage 2 — and warms up
over `2 × period - 1` bars to match the batch output.

`UlcerIndexState` schema changed accordingly: the previous single
`buffer` field is replaced with `prices` and `drawdowns` buffers.
Per-bar drawdowns aren't recoverable from the old shape, so
`fromState` now throws a clear `"legacy state snapshot detected"`
error when it sees the old format — re-warm from candles instead.

A cross-validation regression test pins the new behavior at
9-decimal precision against an independent reference fixture.

### Added — pandas-ta cross-validation for Coppock / Mass Index / TSI / Choppiness

- Four additional indicators with no TA-Lib counterpart now have
  parity tests against `pandas-ta` at 9-decimal precision:
  - `coppockCurve(close, { wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 })`
  - `massIndex(candles, { emaPeriod: 9, sumPeriod: 25 })`
  - `tsi(close, { longPeriod: 25, shortPeriod: 13, signalPeriod: 13 })` — line only
  - `choppinessIndex(candles, { period: 14 })`
- TSI signal-line warmup differs by 1 bar between pandas-ta and
  TrendCraft (EMA seeding convention), so only the line is compared.
- Cross-validation suite: 43 → 47 indicators.

Three Tier-2 candidates were probed and deferred:
- `ulcerIndex` — pandas-ta warmup is 2× TrendCraft's; needs deeper
  formula reconciliation.
- `pvt` — TrendCraft output is 100× smaller than pandas-ta on the
  same input; potential scaling bug, tracked separately.
- `nvi` — values diverge significantly (1129 vs 1013), formula
  variants need reconciliation.

### Added — pandas-ta cross-validation for HMA / VWMA / CMF / Vortex / Awesome Oscillator

- Five indicators with no TA-Lib counterpart now have parity tests
  against `pandas-ta` at 9-decimal precision:
  - `hma(close, period)` for periods 9 and 14
  - `vwma(candles, { period: 20 })`
  - `cmf(candles, { period: 20 })`
  - `vortex(candles, { period: 14 })` — both VI+ and VI- legs
  - `awesomeOscillator(candles, { fastPeriod: 5, slowPeriod: 34 })`
- Each test pairs `assertNullAlignment` (warmup parity) with
  `assertSeriesMatch` (numeric parity) to catch both shifts and drift.

### Added — TA-Lib cross-validation for TRIX and Balance of Power

- `trix(close, period)` line is now compared against `talib.TRIX` at
  6-decimal precision (period 9 and 15).
- `balanceOfPower(candles, { smoothPeriod: 1 })` is compared against
  `talib.BOP` at 8-decimal precision. The default `smoothPeriod = 14`
  remains unchanged; the test pins `smoothPeriod = 1` so it can
  match TA-Lib's raw `(close-open)/(high-low)` formula.
- Cross-validation suite: 36 → 43 indicators (38 with TA-Lib + 5 with
  pandas-ta as ground truth).

### Fixed — `+Infinity` scores leaking into grid search ranking

- `calculateCalmarRatio` / `calculateRecoveryFactor` / `calculateMAR`
  previously returned `Number.POSITIVE_INFINITY` when
  `maxDrawdown === 0` and the return was positive. Combined with
  `gridSearch`'s `if (score > bestScore)` ranking, this caused a
  flat strategy with maxDD = 0 (e.g. one tiny coincidental winning
  trade) to outrank legitimate strategies and become `bestScore =
  Infinity`. Downstream (Strategy DNA, MCP recommendations) inherited
  the bad ranking. The three functions now return `NaN` when the
  ratio is undefined, matching the empyrical / pyfolio convention
  (`np.nan` on `max_dd >= 0` or non-finite). **Breaking** for callers
  that compared the result to `Number.POSITIVE_INFINITY` — branch on
  `Number.isFinite(value)` instead.
- `gridSearch` now filters NaN / ±Infinity scores out of `bestScore`
  selection and out of the returned `results` array (default), so
  downstream consumers like `strategy-dna`'s `computeRecommendedParams`
  / `extractSensitivityData` no longer have to re-guard before sorting
  or averaging. Pass `keepAllResults: true` to surface the rejected
  combinations for inspection — they sink to the end of the sorted
  list deterministically.
- `walkforward.calculateAggregateMetrics` now averages only across
  periods where the metric was actually defined, instead of coercing
  NaN to 0. The earlier coercion silently collapsed the average to
  0 when every period had an undefined primary metric (e.g. Calmar
  on a flat strategy across all windows), which made
  `stabilityRatio` look perfect (`avgIn === avgOut === 0` → 1) and
  caused `generateRecommendation` to endorse params whose primary
  metric was never measurable. The recommendation path now treats
  "no finite samples on either side" as `stabilityRatio = 0`.
- Length=0 guards added in `walkforward.generateRecommendation` for
  `periods.length === 0` and empty `paramKeys`.
- `risk/var.ts` internal `mean` / `stdDev` / `skewness` /
  `excessKurtosis` helpers now return 0 on empty arrays; the public
  `calculateVaR` was already guarded but the helpers themselves
  could be reused (or accidentally wired) elsewhere.

### Added — `parseStrategy` opt-in registry validation + `parseStrategySafe`

- `parseStrategy(json, registry?)` gains an optional second argument.
  When a `ConditionRegistry` is passed, the parser runs
  `validateStrategyJSON` (structural shape) plus
  `validateConditionSpec` on the entry / exit trees and aggregates
  every finding into the thrown error message. Without a registry,
  behavior is unchanged (back-compat: only `$schema` and `version`
  are checked).
- New `parseStrategySafe(json, registry?)` returns
  `Result<StrategyJSON>` with one of five error codes —
  `INVALID_JSON`, `INVALID_SCHEMA`, `UNSUPPORTED_VERSION`,
  `INVALID_STRUCTURE`, `INVALID_CONDITION` — letting MCP / LLM
  consumers branch on the failure reason instead of pattern-matching
  on a thrown error message.
- Surfaces unknown conditions / out-of-range params / malformed
  `not` arity at parse time instead of deferring them to
  `loadStrategy()` or runtime; aligned with the existing
  `gridSearch` / `gridSearchFromJSON` `*Safe` pattern.

### Fixed — `detectOhlcErrors` now flags NaN / Infinity OHLCV fields

- `detectOhlcErrors(candles)` previously only checked relational
  invariants (`high < low`, etc.). Non-finite values silently slipped
  through because every `NaN < x` comparison is `false`, so a candle
  with `close: NaN` would pass validation and then propagate `NaN`
  through every rolling indicator (Bollinger Bands, RSI, ATR, …).
- Each non-finite OHLCV field is now reported as an error finding
  with the field name and value (`"close (NaN) is not a finite
  number at index 7"`). Once a candle has any non-finite field, the
  relational checks for that candle are skipped to avoid confusingly-
  passing follow-up findings.
- Audit-driven (no specific bug report). Cheap belt-and-suspenders
  guard for a class of debug black holes.

### Added — Strategy DNA primitives (`optimization/strategy-dna`)

- New `optimization/strategy-dna.ts` module exposing post-optimization
  analytics that previously lived only as user-space helpers in
  example apps:
  - `buildGenomeSegments(bestParams, paramRanges, bestScore)` — maps
    each best-param value onto a `[0, 1]` position within its declared
    search range, for "where in the space did the optimizer land"
    visualizations.
  - `extractSensitivityData(results, metric)` — aggregates per-param
    and pairwise mean-metric tables plus top-25% safe zones from a
    grid search's `results[]`.
  - `computeRecommendedParams(grid, walkForward?, sensitivity?)` —
    three-step recommendation: safe-zone median → walk-forward
    stable-period median override → sensitivity-peak penalty. Returns
    `{ params, ranges, confidence, reason, sources }` with
    `confidence: "high" | "medium" | "low"`. Handles
    `gridSearch.bestParams === null` (PR-A2 contract) by falling back
    to `results[0]?.params` so the explored grid still informs a
    recommendation.
  - `computeDnaGrade(grid?, walkForward?, monteCarlo?)` — A–F grade
    across four dimensions (WF stability 30%, MC significance 30%,
    parameter sensitivity 20%, win-rate stability 20%). Items whose
    inputs are missing are marked `available: false` and excluded
    from the renormalized weighted average — distinct from
    `robustness/calculateRobustnessScore` which runs new backtests.
- New types: `GenomeSegment`, `SensitivitySingle`, `SensitivityPair`,
  `SafeZone`, `SensitivityData`, `RecommendedParams`, `DnaGrade`,
  `DnaGradeItem`, `DnaGradeReport`. The `Dna` prefix avoids collision
  with `robustness/RobustnessGrade`.
- `core.examples.echarts-viewer` cleaned up: its
  `utils/strategyDna.ts` (574 lines) is now an ~80-line shim that
  re-exports the core APIs (with backwards-compatible aliases) plus
  the viewer-specific URL codec.

### Added — `percentile` / `median` / `quartiles` statistics utilities

- New `packages/core/src/core/statistics.ts` with three exported
  helpers: `percentile(values, p)`, `median(values)`, and
  `quartiles(values)` — all linear-interpolation, all empty-safe
  (return `0` / `[0, 0, 0]` for empty input), all non-mutating.
- Consolidates two private `getPercentile` / `percentile` copies
  inside `optimization/monte-carlo.ts` and `risk/drawdown-analysis.ts`
  into one canonical algorithm. Internal call sites that already
  share a sorted array continue to use a local sorted-input variant
  to avoid re-sorting on every percentile lookup.
- Foundation for upcoming post-optimization analytics
  (`computeParameterSensitivity`, `safeZoneFromResults`, etc.) that
  need quartile filtering across many param/score arrays.

### Added — `gridSearchFromJSON` + strategy walker primitives

- `gridSearchFromJSON(candles, strategy, ranges, registry, options?)` —
  JSON-first wrapper around `gridSearch`. Drives the engine directly
  from a `StrategyJSON` plus path-addressed `PathParameterRange[]`
  (`{ path: "entry.0.shortPeriod", min, max, step }`), so callers no
  longer need to hand-write a strategy walker / param-injector. The
  returned `bestParams` keys are paths, plug straight back into
  `applyParamOverrides`. Companion `gridSearchFromJSONSafe` returns a
  `Result<GridSearchResult>` with codes `INVALID_PARAMETER`,
  `TOO_MANY_COMBINATIONS`, or `OPTIMIZATION_FAILED`.
- `flattenStrategyLeaves(strategy)` — depth-first leaf enumeration
  across `entry` and `exit`, tagged with `bucket`, `leafIndex`, `name`,
  and `params`. Handles `and` / `or` / `not` combinators uniformly.
- `applyParamOverrides(strategy, overrides)` — pure: returns a new
  strategy with the addressed leaves' params updated. Throws on
  out-of-range leaf indices, malformed paths, or paths that omit a
  param name. Inputs are never mutated.
- `parseLeafPath(path)` — exported parser for the
  `<bucket>.<leafIndex>.<paramName>` syntax. Useful for tools that
  want to surface or validate paths without invoking the optimization
  engine (parameter editors, deep-link routes, MCP tools).
- New types: `PathParameterRange`, `LeafInfo`, `ParsedLeafPath`.

Path syntax constraint: `paramName` cannot contain `.` (consistent
with all current registry param names). Paths are case-sensitive.

### Breaking — `bestScore` / `bestParams` are now `number | null`

- `GridSearchResult.bestScore` and `CombinationSearchResult.bestScore` are
  now `number | null`. Previously they fell back to `0` when no parameter
  combination satisfied all constraints (or no combination produced
  trades), which callers mistook as "the optimum is zero" instead of
  "no valid result". Update consumers to handle `null` explicitly:

  ```ts
  // Before
  console.log(`Best Sharpe: ${result.bestScore.toFixed(3)}`);

  // After (preserve prior behavior)
  console.log(`Best Sharpe: ${(result.bestScore ?? 0).toFixed(3)}`);

  // Or branch
  if (result.bestScore !== null) {
    console.log(`Best Sharpe: ${result.bestScore.toFixed(3)}`);
  } else {
    console.log("No combination passed constraints");
  }
  ```

- `GridSearchResult.bestParams` is now `Record<string, number> | null`
  for the same reason — the legacy `{}` fallback was indistinguishable
  from the legitimate "no params to optimize" case (empty
  `parameterRanges`). `result.validCombinations > 0` and
  `result.bestParams !== null` are now equivalent guards.
- `CombinationSearchResult.bestEntry` / `bestExit` keep their `string[]`
  type (empty arrays unambiguously signal "no entry/exit conditions"),
  so this breaking change is limited to `bestScore` and `bestParams`.

### Added — `GRID_SEARCH_EPSILON_FACTOR`

- Exported constant (`1_000_000`) used by `getParameterValues` for the
  inclusive `<= max + ε` upper-bound comparison (epsilon = step / FACTOR).
  Exposed so external tools (UIs deriving the same grid points, MCP
  callers pre-validating LLM output) can reproduce the comparison
  semantics without re-deriving the constant.

### Added — ParamDef annotations (`integer`, `precision`, `suggestedMin/Max`)

- `ParamDef` gains optional `integer?: boolean` and `precision?: number`
  fields. UIs and optimization helpers that derive parameter ranges or
  step inputs from a registry entry no longer need to heuristically
  guess whether a param is integer-valued (period etc.) or what its
  decimal grid is. The two fields are mutually exclusive: when
  `integer: true`, `precision` is ignored.
- `ParamDef` also gains optional `suggestedMin?` / `suggestedMax?` UI
  hints. Unlike `min` / `max` these are **not** enforced by
  `validateConditionSpec`, so adding them to a registry entry never
  invalidates persisted strategy JSON. Use them for params where the
  indicator mathematically accepts a wider range than is practical to
  surface in a slider (e.g. periods accept any positive integer, but a
  UI usually wants 1..200).
- Representative entries in `backtestRegistry` now carry these
  annotations as a starting set: `goldenCross` / `deadCross` periods
  (`integer: true`, `suggestedMax`), `bollingerBreakout` /
  `bollingerTouch` `stdDev` (`precision: 1`, existing `min: 0.1`
  preserved as runtime contract, new `suggestedMax: 5` UI hint),
  `bollingerBreakout` / `bollingerTouch` `period`
  (`integer: true`, `suggestedMax: 200`), and `cmfAbove` / `cmfBelow`
  `threshold` (`precision: 2`, `suggestedMin: -1`, `suggestedMax: 1`).
  All bounds are UI hints, not validation limits, so adding them never
  invalidates persisted strategy JSON. Remaining entries will be
  annotated as needed.

## [0.3.0] - 2026-04-26

### Breaking — Indicator Quality Fixes

- **TRIX warmup**: nested EMA stages no longer treat `null` upstream values
  as `0`. Each EMA stage now waits for `period` consecutive non-null
  upstream samples before seeding its SMA, so the first valid TRIX
  appears at `index = 3 * (period - 1) + 1` and the early-bar values
  match StockCharts canonical TRIX. Late-bar values were already correct;
  only warmup-region values change. The same fix is applied to the
  signal line so it is no longer contaminated by zero-padded TRIX inputs.
  Affects both `trix()` (batch) and `createTrix()` (incremental).
- **`adaptiveBollinger` kurtosis input**: rolling excess kurtosis is now
  computed on log returns (`ln(p_t / p_{t-1})`), not on raw close prices.
  This matches the canonical financial definition of fat-tail risk; the
  prior behavior conflated trend (price level distribution) with tail
  risk. The `effectiveMultiplier` and `kurtosis` outputs change for
  trending series. Band shape interpretation is unchanged: high return
  kurtosis still produces wider bands.

### Added — ewmaVolatilityFromCandles

- `ewmaVolatilityFromCandles(candles, options)` — candle-shaped wrapper
  around `ewmaVolatility(returns)`. Computes log returns internally and
  realigns the output onto candle times so the result composes with
  other candle-based indicators on the same timeline. Accepts the same
  `lambda` / `calendar` / `periodsPerYear` options as `ewmaVolatility`,
  plus an optional `source` (default `"close"`). Resolves the long-
  standing API outlier where every other indicator takes
  `(candles, options)` but `ewmaVolatility` took `(returns, options)`.

### Documented — Volatility stddev conventions

- `historicalVolatility()` JSDoc now explicitly notes it uses **sample**
  stddev (`/ (N - 1)`) on log returns; `standardDeviation()` JSDoc notes
  it uses **population** stddev (`/ N`) for TA-Lib / Bollinger Band
  parity. The two conventions are intentional and not interchangeable —
  pick by use case.

### Added — More Incremental Indicators

- `createLinearRegression()` — incremental rolling least-squares linear
  regression. Maintains O(1)-updateable running sums (`sumY` / `sumY²` /
  `sumXY`) plus a `period`-sized CircularBuffer; the four-field output
  (`value`, `slope`, `intercept`, `rSquared`) matches batch
  `linearRegression()` to 6 decimal places. R² is computed via the
  Pearson form (`(n·sumXY − sumX·sumY)² / ((n·sumXX − sumX²)·(n·sumYY − sumY²))`)
  rather than iterating ssRes / ssTot. Exposed via
  `incremental.createLinearRegression`.
- `createStandardDeviation()` — incremental rolling population standard
  deviation. Maintains `sum` / `sumSq` running totals plus a `period`-sized
  CircularBuffer for O(1) per-bar updates. Matches batch `standardDeviation()`
  to 8 decimal places. Exposed via `incremental.createStandardDeviation`.
- `createSuperSmoother()` — incremental Ehlers 2-pole Super Smoother filter.
  State carries `prevPrice` and the last two outputs; first 2 bars emit
  `null` (matches the batch IIR seeding). Exposed via
  `incremental.createSuperSmoother`.
- `createRoofingFilter()` — incremental Ehlers Roofing Filter (2-pole
  high-pass cascaded into a Super Smoother). State carries the last two
  inputs, last two high-pass outputs, and last two filter outputs. Matches
  batch `roofingFilter()` to 10 decimal places. Exposed via
  `incremental.createRoofingFilter`.

Parity with the batch versions is covered by 18 new tests in
`src/indicators/incremental/__tests__/stddev-ehlers.test.ts`, including
default + custom params, multiple price sources, snapshot resume, and
`peek` non-mutation.

### Added — Trading Calendar (market-specific annualization)

- New `src/calendar/` module exposes a minimal `TradingCalendar` interface plus five presets:
  `US_EQUITY_CALENDAR` (252), `JPX_CALENDAR` (245), `HKEX_CALENDAR` (247),
  `CRYPTO_CALENDAR` (365), `FX_CALENDAR` (260). The presets carry only
  `name` + `tradingDaysPerYear`; they do **not** ship holiday tables. Users
  who need bar-level holiday gap detection can attach their own
  `isTradingDay(date)` predicate.
- `annualizationFactor({ calendar?, periodsPerYear? })` helper — single source
  of truth for annualization across risk / volatility / runtime-metrics.
- Wired into existing sites (all additive, defaults unchanged):
  - `calculateMetricsFromReturns`, `stressTest`, `runAllStressTests` now accept
    an `AnnualizationOptions` bag — Sharpe scales by `sqrt(periodsPerYear)`.
  - `ulcerPerformanceIndex` accepts `AnnualizationOptions` — the annualized
    return exponent `(1 + r) ** (N / n)` uses the configured `N`.
  - `garch` / `ewmaVolatility` option types extend `AnnualizationOptions` —
    the annualized volatility forecast uses `sqrt(N)` from the calendar.
  - `volatilityRegime` accepts `calendar` / `periodsPerYear` through
    `VolatilityRegimeOptions` — historical volatility annualization follows.
  - `calculateRuntimeMetrics` gains a `calendar` field on `RuntimeMetricsOptions`;
    it takes precedence over the legacy numeric `annualizationFactor`.
  ```typescript
  import { stressTest, PRESET_SCENARIOS, JPX_CALENDAR } from "trendcraft";
  // Sharpe on a Japanese-equity strategy uses 245 bars/year, not 252
  const result = stressTest(dailyReturns, PRESET_SCENARIOS.covidCrash2020, 100_000, {
    calendar: JPX_CALENDAR,
  });
  ```

### Documented — Price Source Helpers

- The pure helpers `getPrice(candle, source)` and `getPriceSeries(candles, source)`
  (already exported since v0.1.0) are now covered in `docs/API.md` /
  `docs/API.ja.md` under a new **Price Source Helpers** subsection. The
  streaming equivalent `incremental.getSourcePrice` is cross-referenced.
- `PriceSource` type listing in the API docs corrected to include the
  `"volume"` variant that has always been part of the implementation.
- `llms.txt` Data Utilities section enumerates `getPrice`,
  `getPriceSeries`, and `incremental.getSourcePrice`.

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

### Added — Incremental Price Indicators

- `createHeikinAshi()` — incremental Heikin-Ashi. Emits the same `{open, high, low, close, trend}` shape as `heikinAshi()` and supports `getState()` / `fromState` snapshot resumption for live sessions. Exposed via `incremental.createHeikinAshi`.
- `createReturns()` — incremental simple or log returns of close prices. `{ period?: number; type?: "simple" | "log" }`; emits `null` until `period + 1` candles have been seen. Exposed via `incremental.createReturns`.
- `createSwingPoints()` — incremental Swing Points (leftBars/rightBars window). Confirmation lags by `rightBars` bars; the emitted `time` is the swing candidate bar's original time. The set of confirmed swing-high / swing-low bar times matches batch `swingPoints()` exactly on the same input.
- `createZigzag()` — incremental Zigzag with percent-deviation or ATR-based thresholds. Pivots are emitted at the pivot bar's original time as reversals confirm; the collapsed-by-time pivot sequence matches batch `zigzag()` on the same input. Uses `createAtr` internally for ATR mode (state snapshot includes the nested ATR state).
- `createBreakOfStructure()` / `createChangeOfCharacter()` — incremental BOS and CHoCH. Each emits per-candle `BosValue` at the current candle's time and matches batch `breakOfStructure()` / `changeOfCharacter()` value-by-value, including the running `trend` and the trailing `swingHighLevel` / `swingLowLevel`.

Parity with batch is covered by `heikin-ashi-returns.test.ts`, `swing-points.test.ts`, `zigzag.test.ts`, and `break-of-structure.test.ts` under `src/indicators/incremental/__tests__/`.

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
