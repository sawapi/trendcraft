# Migrating trendcraft 0.5.x → 0.6.0

0.6.0 has 43 breaking changes. Most of them make invalid input throw
where it used to return wrong numbers quietly, so code that passes valid
input is not affected by them. This page covers the ones most likely to
reach working code:

- [Code you must change](#code-you-must-change): calls that now throw or no
  longer compile.
- [Saved data to regenerate](#saved-data-to-regenerate): snapshots and
  strategy JSON written by 0.5.
- [Same code, different numbers](#same-code-different-numbers): results
  that change without any change to your code.
- [Requirements](#requirements) and [Deprecated](#deprecated).
- [Everything else](#everything-else): a one-line index of the remaining
  breaking changes, each linked to its [CHANGELOG](../CHANGELOG.md) entry.

If you use `@trendcraft/chart`, read its
[migration guide](../../chart/docs/migration-0.5-to-0.6.md) too.

## Code you must change

### 1. Candles without volume: pass `volume: 0`

**Most likely to affect you.** Every candle must now have a finite `time`,
`open`, `high`, `low`, `close` and `volume`. OHLC-only data (common for forex
and indices) used to work without a volume; it now throws:

```text
candle 0 has a non-finite volume (undefined)
```

Steps:

1. Find where you build candles from a feed or a file.
2. Set `volume` to `0` when the source has none. Fractional volume is fine.

```ts
import { type Candle, sma } from "trendcraft";

// An OHLC-only feed with no volume column
type Row = { t: number; o: number; h: number; l: number; c: number; v?: number };
declare const rows: Row[];

const ohlc: Candle[] = rows.map((r) => ({
  time: r.t,
  open: r.o,
  high: r.h,
  low: r.l,
  close: r.c,
  volume: typeof r.v === "number" && Number.isFinite(r.v) ? r.v : 0,
}));

const ma = sma(ohlc, { period: 20 });
```

[CHANGELOG entry](../CHANGELOG.md#breaking--a-candle-with-a-non-finite-time-price-or-volume-throws)

### 2. `NaN` and `Infinity` in candles throw

The same check rejects `NaN` and `±Infinity` in any of the six fields. In
0.5 they passed through: SMA, EMA, ATR and other running-sum or recursive
indicators turned `NaN` from that bar on, and RSI kept printing plausible
values. Input padded with `NaN` throws too. For an array the error names the
bar and the field, for example `candle 12 has a non-finite close (NaN)`; the
streaming inputs, which take one candle or trade at a time, name the field
only (`candle has a non-finite close (NaN)`).

It is checked by every public function that takes candles (indicators,
signals, backtests, scoring, screening, `resample`, `normalizeCandles`) and
by the streaming inputs: pipeline and MTF `next()` / `peek()`, every
incremental indicator, `createCandleResampler().addCandle()`,
`createLiveCandle().addCandle()`, and the trades given to
`createCandleAggregator().addTrade()` and `createLiveCandle().addTick()`.

Steps:

1. If your data can contain bad rows, find them with `validateCandles`. It
   does not throw: it reports a non-finite `time`, price or volume, and a time
   it cannot parse, as an `"ohlc"` error with the bar's `index`.
2. Drop those rows, or repair them, before passing the candles on.

`index` is the row's position in your array when its times are already epoch
milliseconds. If they are seconds or date strings, the validator sorts the
rows by time first and `index` refers to that order; convert the times to
epoch milliseconds before validating, so the filter below can use it.

```ts
import { sma, validateCandles } from "trendcraft";

// rawCandles: times in epoch milliseconds
const report = validateCandles(rawCandles);
const badRows = new Set(
  report.errors.filter((f) => f.category === "ohlc").map((f) => f.index),
);
const cleanCandles = rawCandles.filter((_, i) => !badRows.has(i));

const ma = sma(cleanCandles, { period: 20 });
```

The `"ohlc"` category also holds bars whose prices are inconsistent (for
example `high < low`); the filter above drops those as well.

`runScreening` still skips a symbol whose data has such a row. `screenStock`
throws.

[CHANGELOG entry](../CHANGELOG.md#breaking--a-candle-with-a-non-finite-time-price-or-volume-throws)

### 3. `createHighestLowest` needs a `period`

`createHighestLowest` used to default `period` to 20. It now requires it, as
the batch `highestLowest` always has. Without it, it throws
`highestLowest: required option "period" was not provided (no default and no
snapshot value)`.

```ts
import { createHighestLowest } from "trendcraft/incremental";

// 0.5: createHighestLowest() used a 20-bar window
const hl = createHighestLowest({ period: 20 });
```

The type says so too: `createHighestLowest()` no longer compiles. Resuming
with `fromState` may still leave `period` out, since the snapshot carries it.

Five other incremental indicators gained the default their batch function
already had, so code that passes `period` is unaffected: `createDonchianChannel`
(20), `createCci` (20), `createRoc` (12), `createStandardDeviation` (20) and
`createWilliamsR` (14). The batch `superSmoother` now defaults `period` to 10.

[CHANGELOG entry](../CHANGELOG.md#breaking--batch-and-incremental-indicators-agree-on-whether-period-has-a-default)

### 4. `fromPatternSignal` can return `null`

`fromPatternSignal` now returns `TradeSignal | null`. It returns `null` for a
directionless shape (a symmetrical triangle or a channel) that has not broken
out yet. Filter the result:

```ts
import { detectChannel, fromPatternSignal, type TradeSignal } from "trendcraft";

// 0.5: const signals: TradeSignal[] = patterns.map((p) => fromPatternSignal(p));
const signals = detectChannel(candles)
  .map((p) => fromPatternSignal(p))
  .filter((s): s is TradeSignal => s !== null);
```

The direction of the signals also changes; see
[Pattern direction](#pattern-direction-from-one-table) below.

[CHANGELOG entry](../CHANGELOG.md#breaking--pattern-direction-now-comes-from-one-table-frompatternsignal-can-return-null)

### 5. `UpdatePriceResult.position` is `ManagedPosition | null`

`updatePrice()` always returned `position: null` on the bar that closed the
position, and when none was open. The type now says so, so reading a field
of `result.position` without a check no longer compiles:

```ts
import { streaming } from "trendcraft";

declare const tracker: streaming.PositionTracker;

const { position } = tracker.updatePrice(bar);
if (position !== null) {
  console.log(position.shares);
}
```

[CHANGELOG entry](../CHANGELOG.md#breaking--updatepriceresultposition-is-typed-managedposition--null)

### 6. Streaming `and` / `or` evaluate every child

`streaming.and`, `streaming.or`, `unifiedAnd` and `unifiedOr` used to stop at
the first decisive child. They now evaluate every child on every bar, so
that stateful children (crosses, rising checks) never skip bars. A child
that relied on an earlier sibling as a guard now runs even when that sibling
is false. Make such a child check for itself:

```ts
import { streaming } from "trendcraft";

// 0.5: and(macdReady, macdPositive) never ran macdPositive while MACD was warming up
const macdPositive: streaming.StreamingConditionFn = (snapshot) => {
  const macd = snapshot.macd as { histogram: number | null } | null | undefined;
  return macd?.histogram != null && macd.histogram > 0;
};

const entry = streaming.and(streaming.rsiBelow(30), macdPositive);
```

A custom condition that keeps state between bars should also update it only
when its third argument's `mode` is not `"peek"`: `pipeline.peek()` now
passes `{ mode: "peek" }`
([CHANGELOG](../CHANGELOG.md#fixed--pipelinepeek-moved-stateful-streaming-conditions-to-the-forming-bar)).

[CHANGELOG entry](../CHANGELOG.md#breaking--streaming-and--or--not-and-the-unified-combinators-evaluate-every-child)

### 7. `portfolioBacktest`: remove `rebalance`, `maxPositions` and `maxPortfolioDrawdown`

These options were accepted and ignored. `maxPositions` and
`maxPortfolioDrawdown` now throw; `rebalance`, the `RebalanceConfig` type and
`PortfolioBacktestResult.rebalanceCount` are removed. Remove them from the
call:

- instead of `maxPositions`, read `peakConcurrentPositions`;
- instead of `maxPortfolioDrawdown`, read `portfolio.maxDrawdown`, or use
  `streaming.createPortfolioGuard` for a live halt;
- instead of `rebalance`, run a new backtest per period with the weights you
  want.

[CHANGELOG entry](../CHANGELOG.md#breaking--portfoliobacktest-rejects-the-options-it-does-not-support-and-drops-rebalance)

## Saved data to regenerate

### Incremental `vwap` and `twap` snapshots

Every `createVwap` and `createTwap` snapshot written by 0.5 is refused with a
`re-warm required` error, whether or not it used the new `session` option.
Both schemas moved to version 2. Re-warm from candle history instead:

```ts
import type { NormalizedCandle } from "trendcraft";
import {
  createVwap,
  type IndicatorSnapshot,
  type VwapOptions,
  type VwapState,
} from "trendcraft/incremental";

declare const saved: IndicatorSnapshot<VwapState>;
declare const recentCandles: NormalizedCandle[]; // the bars of the current session

function restoreVwap(options: VwapOptions) {
  try {
    return createVwap(options, { fromState: saved });
  } catch {
    // A 0.5 snapshot: rebuild the running totals from history.
    return createVwap(options, { warmUp: recentCandles });
  }
}
```

VWAP and TWAP reset each session, so the warm-up needs the bars since the
current session started.

[CHANGELOG entry](../CHANGELOG.md#breaking--incremental-vwap-and-twap-snapshots-need-a-re-warm)

### Incremental VSA snapshots

`createVsa`'s 'test' rule now scans the full 10-bar window, which needs one
more bar of state. Its schema moved to version 2, and 0.5 snapshots are
refused with a `re-warm required` error. Re-warm it the same way, with
enough bars to warm its ATR and volume average (`atrPeriod`,
`volumeMaPeriod`).

[CHANGELOG entry](../CHANGELOG.md#breaking--incremental-vsa-scans-the-full-10-bar-window-for-test-schema-v2)

`createPipeline` passes each saved indicator state to the `create` function
of your indicator config, so a 0.5 pipeline snapshot that holds a VWAP, TWAP
or VSA state throws there. Re-warm that indicator in its `create`. The
snapshots of every other incremental indicator resume as before.

### Strategy JSON validated against a registry

`parseStrategy` with a registry, and `hydrateCondition`, are stricter:

- The pattern subtypes of `triangleDetected`, `wedgeDetected`,
  `channelDetected`, `flagDetected` and `harmonicPatternDetected` are full
  pattern identifiers. A short label such as `"symmetrical"` never fired in
  0.5 and is now invalid; write `"triangle_symmetrical"`.
- `periods` on the Perfect Order conditions is an array.
- `hydrateCondition` throws on a parameter the entry does not declare. 0.5 dropped it
  silently.

The nine renamed streaming condition names still load; see
[Deprecated](#deprecated).

[CHANGELOG entry](../CHANGELOG.md#breaking--the-strategy-registry-no-longer-advertises-values-its-factories-cannot-use)

### Stored backtest results

A profit factor with no losing trade is now `Infinity`, which
`JSON.stringify` writes as `null`. Read `null` back as "no losing trade":

```ts
const stored: { profitFactor: number | null } = JSON.parse(JSON.stringify(result));
const profitFactor = stored.profitFactor ?? Number.POSITIVE_INFINITY;
```

A `ManagedPosition` saved by 0.5 carries no entry commission, and is treated
as having paid none when it closes.

## Same code, different numbers

None of these throw. Re-run any backtest, screen or optimization whose
results you compare against figures from 0.5.

### Supertrend has no direction until price breaks a band

After the ATR warm-up, `supertrend()` and `createSupertrend()` used to seed a
downtrend unless the close was already above the upper band.
`direction` now stays `0` (with `supertrend: null`; the bands are reported)
until the close first breaks the upper band (`1`) or the lower band (`-1`).
From that break on, the values are unchanged. With the defaults (10, 3) on
70 symbols' daily bars this stretch lasted a median 12 bars, 25 at the 90th
percentile and up to 57. During it, `supertrendBullish` and
`supertrendBearish` are both false.

**Action:** code that treats every `direction !== 1` as bearish must handle
`0`.

```ts
import { supertrend } from "trendcraft";

for (const { value } of supertrend(candles)) {
  if (value.direction === 0) continue; // no band broken yet
  const trendUp = value.direction === 1;
}
```

[CHANGELOG entry](../CHANGELOG.md#breaking--supertrend-has-no-direction-until-price-first-breaks-a-band)

### `Trade.return` includes the entry commission and margin interest

Each trade's `return` and `returnPercent` now deduct its share of the
commission paid to open the position and the margin interest settled when it
closed. The trades of a run now sum to `finalCapital − initialCapital`.
`winRate`, `profitFactor`, average win and loss, and expectancy change for
any run with a commission or margin interest. `finalCapital`, the equity
curve and drawdown do not, unless a `sizing: { method: "custom" }` callback
reads `closedTrades`. The streaming position tracker's `totalRealizedPnl`
changes the same way. **No action.**

[CHANGELOG entry](../CHANGELOG.md#breaking--tradereturn-carries-the-entry-commission-and-margin-interest)

### Drawdown is measured on equity

`runBacktest` and `runBacktestScaled` measured `maxDrawdown` and
`drawdownPeriods` on the cash balance. They now measure them on
`equityCurve`. Runs with `partialTakeProfit`, `scaleOut`, margin
`reduceToMaintenance`, or a position still open at the end report a
different `maxDrawdown`: usually much smaller for partial exits, larger for
buy-and-hold-style runs. `calmarRatio`, `scoreBacktestResult`, and the
`"maxDrawdown"`, `"calmar"` and `"mar"` objectives and constraints move with
it. **No action**, but re-check drawdown constraints you tuned on 0.5.

[CHANGELOG entry](../CHANGELOG.md#breaking--drawdown-is-measured-on-account-equity-not-on-the-cash-balance)

### Profit factor with no losing trade is `Infinity`

`runBacktest`, `calculateTradeStats`, `report` and the Monte Carlo
`originalResult` used to give 999.99; `portfolioBacktest` capped every ratio
at 999.99. All now give `Infinity` when there is profit and no losing trade,
and 0 when there is neither. `gridSearch` and `combinationSearch` rank
`Infinity` first, and a single infinite value makes a mean `Infinity`.

**Action:** when you optimize on `profitFactor`, add a trade-count
constraint so that one or two lucky trades do not win:

```ts
import { constraint, gridSearch } from "trendcraft";

const search = gridSearch(candles, strategyFactory, paramRanges, {
  metric: "profitFactor",
  constraints: [constraint("tradeCount", ">=", 30)],
});
```

For stored results, see [Stored backtest results](#stored-backtest-results).

[CHANGELOG entry](../CHANGELOG.md#breaking--a-profit-factor-with-no-losing-trade-is-infinity-everywhere)

### `dpo()` is causal by default

`dpo()` used to return `Price[i] − SMA[i + shift]` at bar `i`, which reads
`shift = floor(period / 2) + 1` future bars. It now returns
`Price[i − shift] − SMA[i]`: the same numbers, each stamped `shift` bars
later, at the bar where it is first known. `createDpo()` returns the current
bar's time, matching the batch default. The `dpo` indicator preset follows
the default.

**Action:** only for charting the classic centered line. Never use it in a
backtest or screen:

```ts
import { dpo } from "trendcraft";

const forChart = dpo(candles, { centered: true });
```

[CHANGELOG entry](../CHANGELOG.md#breaking--dpo-no-longer-reads-future-bars-by-default)

### Cross signals separate the cross from its outcome

`validateCrossSignals()` graded each cross by the `holdingDays` bars after
it, but stamped the grade at the cross bar. `CrossSignalQuality` now has:

- `realtimeScore` (15–70): known at the cross bar. `validatedGoldenCross` /
  `validatedDeadCross` gate on it.
- `confirmedAt` / `confirmedIdx`: the bar from which `isFake` and `score` are
  final, `null` until then. `score` is `realtimeScore` plus 30 when the cross
  held.

A cross that reversed before the series ends is now settled as fake even
with fewer than `holdingDays` bars after it. `fromCrossSignal()` sets
`confidence` to `realtimeScore` and no longer puts `isFake` or
`holdingConfirmed` in `metadata`.

**Action:** gate entries on `realtimeScore`, not `score` or `isFake`. Code
that builds a `CrossSignalQuality` object must add the three new fields.

```ts
import { validateCrossSignals } from "trendcraft";

for (const q of validateCrossSignals(candles)) {
  const tradable = q.realtimeScore >= 50; // known at the cross bar
  const outcome = q.confirmedAt === null ? "pending" : q.isFake ? "fake" : "held";
}
```

[CHANGELOG entry](../CHANGELOG.md#breaking--cross-signals-separate-what-is-known-at-the-cross-from-the-outcome)

### Walk-forward windows open with warm indicators

`walkForwardAnalysis` and `anchoredWalkForwardAnalysis` now compute each
window's indicators over the candles before it, without trading there.
Out-of-sample and in-sample figures change for any strategy whose indicators
have a lookback, and so do `stabilityRatio`, the recommendation and the
walk-forward part of `calculateRobustnessScore`.

**Action:** none, unless you need the 0.5 figures. `warmupBars: 0` restores
the cold start; a cap at the strategy's longest lookback is faster than the
default (`Infinity`). A `warmupBars` in a strategy factory's backtest options
(rolling) or in `combinationOptions.backtestOptions` (anchored) now throws.

```ts
import { walkForwardAnalysis } from "trendcraft";

const coldStart = walkForwardAnalysis(candles, strategyFactory, paramRanges, {
  warmupBars: 0,
});
```

[CHANGELOG entry](../CHANGELOG.md#breaking--walk-forward-windows-open-with-warm-indicators)

### Combination search and anchored walk-forward start with 100,000

Called without `backtestOptions`, `combinationSearch` and
`anchoredWalkForwardAnalysis` backtested with 1,000,000 of capital, and
`getAWFEquityCurve` started its curve at 1,000,000. They now use
`DEFAULT_BACKTEST_CAPITAL` (100,000), like `gridSearch`,
`walkForwardAnalysis` and `paretoOptimization`. Percentage results such as
returns do not change. Results in currency scale with the capital:
`recoveryFactor` (and so a search ranked by `metric: "recoveryFactor"`) and
the `getAWFEquityCurve` curve. Code that passes its own `backtestOptions` is
unaffected.

**Action:** to keep 1,000,000, pass it:

```ts
import { combinationSearch } from "trendcraft";

const search = combinationSearch(candles, entryConditions, exitConditions, {
  backtestOptions: { capital: 1_000_000 },
});
```

For `getAWFEquityCurve`, pass `1_000_000` as its second argument.

[CHANGELOG entry](../CHANGELOG.md#breaking--combination-search-and-anchored-walk-forward-default-to-100000-capital)

### Pattern direction from one table

`fromPatternSignal` read 9 of the 12 bullish pattern types (bull flag,
ascending triangle, the bullish harmonics, …) as `SELL`, and
`projectFromPatterns` projected 9 of the 11 bearish types upward. Both now
read `PATTERN_BIAS` and a recorded breakout direction through
`resolvePatternDirection`. Signal directions and projected returns change.
See [step 4](#4-frompatternsignal-can-return-null) for the `null` return.

[CHANGELOG entry](../CHANGELOG.md#breaking--pattern-direction-now-comes-from-one-table-frompatternsignal-can-return-null)

### Multi-series functions join on dates

`analyzePair` and `analyzeCorrelation` now join their series on `time` and use
only timestamps present in both; they used to pair bar 0 with bar 0. Hedge
ratios and correlations change for series that start on different dates.
`pearsonCorrelation`, `spearmanRankCorrelation`, `olsRegression`,
`spearmanCorrelation`, `rollingCorrelation`, `calculateSpread`,
`detectIntermarketDivergence` and `conditionalDrawdown` now throw on arrays
of different lengths. `analyzeLeadLag` compares the common trailing window.

[CHANGELOG entry](../CHANGELOG.md#breaking--multi-series-functions-no-longer-pair-different-dates)

### `portfolioBacktest` keeps the capital `maxSymbolExposure` withholds

Capital that `maxSymbolExposure` keeps out of the market is now held as
portfolio cash in `equityCurve` and `portfolio.finalCapital`. In 0.5 it was
lost, so a portfolio that placed no trades could report a loss (−25% in the
CHANGELOG's example). Only runs where the cap binds change.

[CHANGELOG entry](../CHANGELOG.md#breaking--portfoliobacktest-no-longer-loses-the-capital-maxsymbolexposure-withholds)

### Fixes that also move numbers

These are bug fixes, but results change:

- Margin interest is charged for the time held, not a whole day per trade,
  and counts against equity while the position is open
  ([time held](../CHANGELOG.md#fixed--margin-interest-is-charged-for-the-time-held-not-per-trade),
  [equity](../CHANGELOG.md#fixed--margin-interest-counts-against-equity-while-the-position-is-open)).
- Monte Carlo resamples returns on account equity, and annualises its Sharpe
  by the observed trade frequency
  ([equity](../CHANGELOG.md#fixed--monte-carlo-levered-every-position-up-to-100-of-equity),
  [Sharpe](../CHANGELOG.md#fixed--monte-carlo-sharpe-shrank-as-the-trade-count-grew)).
- `report()` and `backtestByRegime()` annualise by the candles' span instead
  of a fixed 252
  ([CHANGELOG](../CHANGELOG.md#fixed--report-and-backtestbyregime-annualised-every-bar-size-as-daily)).
- `swingPoints`' trailing swing levels, and `liquiditySweep`, adopt a pivot
  when it is confirmed
  ([CHANGELOG](../CHANGELOG.md#fixed--swing-levels-are-adopted-when-the-pivot-is-confirmed-not-when-it-prints)).
- `runBacktestScaled` sizes every tranche from the capital of its trade cycle,
  and reports an equity curve, so its Sharpe and Sortino come from that curve
  ([sizing](../CHANGELOG.md#fixed--runbacktestscaled-sizes-every-tranche-from-the-capital-the-trade-cycle-actually-has),
  [equity curve](../CHANGELOG.md#added--runbacktestscaled-reports-an-equity-curve)).
- `applyEquityCurveFilter`'s `improvement` compares like with like
  ([CHANGELOG](../CHANGELOG.md#changed--applyequitycurvefilter-compares-the-filtered-run-with-the-original-measured-alike)).

## Requirements

`engines.node` is now `>=22.0.0` (was `>=18.0.0`). Node.js 18 and 20 have
reached end of life. On Node.js 20 or older most package managers warn when
installing, and some refuse (yarn 1, or npm and pnpm with `engine-strict`).
Nothing in the package itself changed.

[CHANGELOG entry](../CHANGELOG.md#breaking--requires-nodejs-22-or-later)

## Deprecated

Nine streaming conditions shared a name with a backtest condition that tests
something else. The streaming side takes new names; the shared names keep
their backtest meaning:

| Old streaming name | New name |
|---|---|
| `perfectOrderBullish` / `perfectOrderBearish` | `emaRibbonBullish` / `emaRibbonBearish` |
| `perfectOrderCollapsed` | `emaRibbonContracting` |
| `obvCrossUp` / `obvCrossDown` | `obvSignalCrossUp` / `obvSignalCrossDown` |
| `obvRising` / `obvFalling` | `obvUpTick` / `obvDownTick` |
| `volatilityExpanding` / `volatilityContracting` | `atrRising` / `atrFalling` |

- The old factory exports remain as `@deprecated` aliases of the same
  functions; switch to the new names.
- `streamingRegistry` still loads the old names in strategy JSON, with a
  one-time deprecation warning. `names()` and `list()` show only the new
  names.
- Each condition's `name` string changes, also through an alias:
  `obvRising().name` is now `"obvUpTick(obv)"`. Code that matches on
  condition names, in logs or in explain and trace output, must use the new
  ones.

```ts
import { streaming } from "trendcraft";

const entry = streaming.and(streaming.emaRibbonBullish(), streaming.obvUpTick());
```

The old names will be removed in a later release.
[CHANGELOG entry](../CHANGELOG.md#deprecated--nine-streaming-conditions-renamed-to-say-what-they-test)

## Everything else

The remaining breaking changes. Most of them reject invalid input that used
to produce wrong numbers silently; valid calls behave as before.

**Indicator options**

- [18 batch indicators reject fractional and non-finite periods](../CHANGELOG.md#breaking--18-batch-indicators-now-reject-fractional-and-non-finite-periods)
- [The remaining batch indicators reject fractional and non-finite periods](../CHANGELOG.md#breaking--the-remaining-batch-indicators-reject-fractional-and-non-finite-periods-too)
- [Bar-count options that had no validation reject invalid values](../CHANGELOG.md#breaking--bar-count-options-that-had-no-validation-at-all-now-reject-invalid-values)
- [Real-valued options reject non-finite and out-of-range values](../CHANGELOG.md#breaking--real-valued-options-reject-non-finite-and-out-of-range-values)
- [Session reset options reject an unknown keyword](../CHANGELOG.md#breaking--session-reset-options-reject-an-unknown-keyword)
- [Options that take a fixed set of keywords reject an unknown value](../CHANGELOG.md#breaking--options-that-take-a-fixed-set-of-keywords-reject-an-unknown-value)
- [Invalid session definitions and regime thresholds throw](../CHANGELOG.md#breaking--invalid-session-definitions-and-regime-thresholds-throw)
- [Volume Profile rejects a `period` that is not a positive integer](../CHANGELOG.md#breaking--volume-profile-rejects-a-period-that-is-not-a-positive-integer)

**Backtest**

- [`runBacktest` rejects an invalid margin configuration](../CHANGELOG.md#breaking--runbacktest-rejects-an-invalid-margin-configuration)
- [`runBacktest` rejects an invalid `volumeConstraint`](../CHANGELOG.md#breaking--runbacktest-rejects-an-invalid-volumeconstraint)
- [Partial exit percentages outside `(0, 100]` are rejected](../CHANGELOG.md#breaking--partial-exit-percentages-outside-0-100-are-rejected)
- [`runBacktestScaled` rejects the options its multi-tranche engine does not implement](../CHANGELOG.md#breaking--runbacktestscaled-rejects-the-options-its-multi-tranche-engine-does-not-implement)
- [`batchBacktest` and `portfolioBacktest` reject a repeated symbol](../CHANGELOG.md#breaking--batchbacktest-and-portfoliobacktest-reject-a-repeated-symbol)
- [`portfolioBacktest.rebalanceCount` is always 0](../CHANGELOG.md#breaking--portfoliobacktestrebalancecount-is-always-0-and-unenforced-options-say-so) (superseded: the field is removed, see [step 7](#7-portfoliobacktest-remove-rebalance-maxpositions-and-maxportfoliodrawdown))
- [`calculateDailyReturns` rejects an equity curve that does not match the candles](../CHANGELOG.md#breaking--calculatedailyreturns-rejects-an-equity-curve-that-does-not-match-the-candles)

**Optimization**

- [Anchored walk-forward no longer tests a combination it never selected](../CHANGELOG.md#breaking--anchored-walk-forward-no-longer-tests-a-combination-it-never-selected) (new `skippedPeriods`; throws when no period selects one)
- [`combinationSearch` no longer counts combinations it cannot select](../CHANGELOG.md#breaking--combinationsearch-no-longer-counts-combinations-it-cannot-select)

**Analysis, scoring and screening**

- [Return metrics reject an invalid `periodsPerYear` or rolling window](../CHANGELOG.md#breaking--return-metrics-reject-an-invalid-periodsperyear-or-rolling-window)
- [Return metrics reject an invalid rate or tail cutoff](../CHANGELOG.md#breaking--return-metrics-reject-an-invalid-rate-or-tail-cutoff)
- [`RiskParityOptions.riskFreeRate` is removed](../CHANGELOG.md#breaking--riskparityoptionsriskfreerate-is-removed) (it was never read; remove it)
- [Scoring rejects invalid weights, thresholds and condition arguments](../CHANGELOG.md#breaking--scoring-rejects-invalid-weights-thresholds-and-condition-arguments)
- [Scoring evaluator factories and `rotateStrategies` reject out-of-range numbers](../CHANGELOG.md#breaking--scoring-evaluator-factories-and-rotatestrategies-reject-out-of-range-numbers)
- [The screener no longer reports what it could not evaluate](../CHANGELOG.md#breaking--the-screener-no-longer-reports-what-it-could-not-evaluate) (new required `ScreeningResult.atrSampleCount`)
