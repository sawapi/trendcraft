# Changelog

## [Unreleased]

### Fixed — sessions restart on the next day in regular-hours-only data

`detectSessions`, `sessionStats` and `sessionBreakout` decided that one
occurrence of a session had ended by watching bars fall outside its window.
That never happens in a series that contains only in-session bars — the shape
most vendors return for regular trading hours — so every day ran together as a
single unbroken session:

- `detectSessions` kept counting `barIndex` upward across days (0..11 over two
  six-bar days instead of 0..5 twice) and held `sessionOpen`, `sessionHigh` and
  `sessionLow` at the first day's values for the whole series.
- `sessionStats` merged every day into one occurrence, so `avgRange` reported
  the spread of the entire series rather than a typical session, and
  `avgVolume` summed all the bars in it.
- `sessionBreakout` never completed a session, so no range was ever published
  and `rangeHigh`/`rangeLow` stayed `null` for every bar — the indicator
  produced nothing at all.

A new occurrence is now recognised when the local calendar day the session
opened on changes, which needs no out-of-session bar to be present. Bars before
the open of a window that crosses midnight are attributed back to the previous
day, so `22:00`-`06:00` reads as one continuous session rather than being split
at `00:00`. Keying off the day rather than the clock also keeps a session whole
across a DST fall-back, where the local clock rewinds an hour and repeats it —
a New York overnight session running through 2024-11-03 is one session, not
two.

Sessions are unchanged for data that does contain out-of-session bars.

### Breaking — partial exit percentages outside `(0, 100]` are rejected

`sellPercent` is a fraction of the shares currently held, but nothing checked
it. `scaleOut.levels[].sellPercent: 150` sold half again as many shares as the
position owned and credited the account for all of them: 100,000 of capital
finished a five-bar run at 164,973, out of thin air. Zero and `NaN` were
accepted just as quietly.

`partialTakeProfit.sellPercent` and every `scaleOut.levels[].sellPercent` are
now validated at the entry points — `runBacktest`, `runBacktestScaled` and
`createPositionTracker` — and values at or below zero, above 100, or `NaN`
throw with the offending option named. `100` remains valid everywhere and means
"close what is left", as the `scaleOut` documentation already showed.

### Fixed — a 100% partial take profit closes the position instead of emptying it

`partialTakeProfit.sellPercent: 100` sold every share, then left the position
open with none in it. The next exit — or the end of the data — "closed" that
empty position a second time, charging another exit commission and appending a
trade with no shares and no return, which then contaminated the aggregate
metrics.

All three engines that implement partial exits were affected: `runBacktest`,
the multi-tranche path of `runBacktestScaled`, and the streaming
`createPositionTracker`. Each now closes the position when the sale empties it,
and reports the trade as a full exit rather than a partial one — matching what
`scaleOut` already did in the same situation.

`runBacktestScaled` additionally releases the capital reserved for tranches
that will now never be entered. A run with 100,000 of capital, two equal
tranches and a 100% partial take profit finished at 104,969 with 50,000 of the
reserve still stranded; it now finishes at 104,979 with the reserve returned.

### Breaking — `UpdatePriceResult.position` is typed `ManagedPosition | null`

`updatePrice()` has always returned `null` for `position` on the bar that
closes a position, and when no position was open — the field was simply typed
as though it could not. The cast that hid this is gone, so callers reading
`result.position` now have to handle `null`, which is what the value has been
all along.

This was not only cosmetic: on a bar where a 100% partial take profit closed
the position, `updatePrice()` returned `{}` — a spread of the nulled position —
and the declared type meant nothing flagged it. Reading `result.position.shares`
gave `undefined` rather than failing.

### Breaking — `runBacktestScaled` rejects the options its multi-tranche engine does not implement

With two or more tranches, `runBacktestScaled` runs a second engine that never
grew the feature set of `runBacktest`. It accepted the full `BacktestOptions`
surface anyway and quietly ignored most of it, so a backtest could be
configured one way and executed another — `direction: "short"` in particular
behaved exactly like a long position and reported the inverse P&L as though it
were real.

Fourteen options are now rejected with an error naming them, instead of being
ignored, when `scaledEntry.tranches >= 2`:

`direction`, `atrTrailingStop`, `breakevenStop`, `scaleOut`, `timeExit`,
`slippageModel`, `orderType`, `orderTTL`, `timeInForce`, `volumeConstraint`,
`margin`, `sizing`, `fundamentals`, `validateData`

The last two are the quietest of the set: `fundamentals` left PER/PBR
conditions unable to fire, and `validateData: true` reported nothing because no
validation ran.

Runs with a single tranche are unaffected — they delegate to `runBacktest`,
which implements everything — so `ScaledBacktestOptions` still accepts these
keys. Whether an option is honored depends on `scaledEntry.tranches`, a value
rather than a type, so the check is a runtime one.

If you were passing one of these with two or more tranches, the result you were
reading did not reflect it. Call `runBacktest` directly, or use `tranches: 1`.

Support for short positions in the multi-tranche path is tracked separately;
implementing it removes `direction` from the rejected list.

### Fixed — `runBacktestScaled` sizes every tranche from the capital the trade cycle actually has

In the multi-tranche path, the first tranche was sized from the capital
available when the position opened, but every additional tranche was sized
from the backtest's *initial* capital. The two agree only for the first trade
cycle; after any closed trade the tranche weights no longer sum to the capital
committed to the new cycle.

After a profitable cycle the position was under-invested and the shortfall sat
in reserve doing nothing; after a losing cycle the later tranches spent more
than had been reserved for them, driving the reserve negative and inflating
the position. Either way P&L was computed from the wrong exposure. With
100,000 of capital, two equal tranches, a first cycle bought at 100 and sold
at 110, and a second cycle bought at 110 and sold back at 100, the run should
end exactly where it started at 100,000; it reported 100,454.55, having
invested 55,000 and 50,000 into a cycle that had 110,000 to deploy.

Each position now records the capital it committed when it opened, and every
tranche of that position is weighted against it. The final tranche takes
whatever is still reserved, so rounding in the weights (1/3 + 1/3 + 1/3 falls
a hair short of 1 in binary floating point) can no longer strand a sliver of
capital outside the market.

Multi-tranche results change for any backtest that closes more than one trade.

## [0.5.0] - 2026-07-26

### Read this first — your numbers will change

This release is mostly correctness work, so the same code over the same data
will report different figures than 0.4.0 did. That is the fix, not a
regression. The changes you are most likely to notice:

| What | Was | Now |
| --- | --- | --- |
| `sharpeRatio` / `sortinoRatio` | Annualized as if one trade were one day, so the value grew with holding period — the same equity path packaged as 21-day trades scored over four times higher | Annualized from the equity curve at the frequency its bars actually occurred |
| Backtest entries and fills | Pattern and limit/stop entries could use prices from bars the strategy could not have seen | Fills use only price action the position already owned |
| Cornish-Fisher VaR | Skew term carried the wrong sign, so fat left tails *lowered* reported risk | Risk rises with negative skew, as it should |
| `"mar"` optimization metric | Average monthly return over max drawdown — about a twelfth of the ratio the name denotes | Annualized return over max drawdown |
| Bollinger Bands, correlation, regression slopes | Lost all precision once prices were large relative to their spread (yen, won, rupiah levels); bands could collapse to zero width | Computed in two passes, accurate at any price level |
| Candles stamped in epoch **seconds** | Silently treated as milliseconds, so every day bucket advanced once every 2.7 years: session VWAP never reset, `detectSessions` found nothing | Converted as documented |
| Portfolio `sharpeRatio` / `equityCurve` / `maxDrawdown` | Built from realized trade P&L only, blind to price moves inside open positions, and ending at the last trade | Per-bar mark-to-market across the whole window |

Snapshots of the incremental `standardDeviation`, `bollingerBands`,
`linearRegression`, `historicalVolatility`, `emv` and `garmanKlass` taken with
0.4.0 are rejected and must be re-warmed.

Required-field additions to `PatternSignal` and `DivergenceSignal`, and the
removal of `setBenchmark` and of option keys that were never read, are the
source-level breaks — each is described in its own section below.

### Breaking — snapshot sentinels survive persistence (`emv`, `garmanKlass` schema v2)

Both indicators mark "this bar produced no usable value" inside their window
buffer, and both used `NaN` as that marker. The state contract promises
JSON-serializable snapshots, but `JSON.stringify` writes `NaN` as `null`: a
snapshot that was persisted and read back had ordinary null slots where the
resume path was looking for NaN, so the marker was gone. The resumed indicator
then reported a number on bars where an uninterrupted run reported nothing —
no error, no gap, just a confident wrong value. Ease-of-movement, whose
`isWarmedUp` also consults the marker, additionally declared itself warmed up
while an unusable bar was still inside its window. It triggered on any
snapshot taken within `period` bars of a zero-range or zero-volume bar
(ease-of-movement) or a non-positive price (Garman-Klass).

Both now hold `null` in the buffer, which survives the round trip unchanged.
Their schema versions bump to 2, so earlier snapshots are rejected with the
usual "re-warm required" error.

### Breaking — second-stamped candles are converted again; multi-week resampling and long weekend gaps fixed

`normalizeTime` documents a numeric time below 1e10 as Unix **seconds**, but
every indicator gates conversion behind `isNormalized(candles) ? candles :
normalizeCandles(candles)`, and `isNormalized` accepted any number. So
second-stamped candles — the shape most exchange REST APIs return — were
declared already normalized and never converted. Nothing errored; instead
every `Math.floor(time / 86_400_000)` day bucket advanced once every 2.7
years, so session VWAP and TWAP never reset, opening ranges and market
profiles covered the whole history, `detectSessions` found no sessions at all,
and resampling produced meaningless buckets. `isNormalized` is now
magnitude-aware, matching the range `normalizeTime` leaves untouched.

Callers passing epoch-second candles will see different (correct) output from
every time-bucketed indicator. Callers already passing milliseconds are
unaffected. Note that a numeric time below 1e10 is now treated as seconds
everywhere, so toy timestamps like `time: 1` are scaled by 1000 rather than
taken literally.

`resample` ignored `value` for the `'week'` unit, so `{ value: 2, unit:
'week' }` silently returned ordinary weekly candles. Multi-week periods now
bucket against a fixed Monday reference the way multi-day and multi-month
periods already bucketed against theirs.

`detectGaps` classified any Friday-to-Monday hole as a weekend regardless of
length, so a seventeen-day — or three-month — hole passed validation in
silence whenever its endpoints happened to fall that way. A weekend gap now
has to be short enough to be one.

### Breaking — three financial formulas corrected: Cornish-Fisher VaR, deflated Sharpe, MAR

**Cornish-Fisher VaR pointed risk the wrong way.** The expansion was evaluated
at the positive quantile and the result negated. The kurtosis and squared-skew
terms are odd in z and survive that, but the skew term `(z²−1)·S/6` is even,
so it kept its sign: for the usual negatively skewed returns the fat-tail
correction *reduced* VaR below the plain parametric figure instead of raising
it, by `(z²−1)|S|σ/3` — 1.87 percentage points at 99% confidence on a skew of
−1.25. The hybrid CVaR inherited the wrong cutoff, and `rollingVaR` inherited
both. The expansion is now evaluated at the left-tail quantile.

**Deflated Sharpe silently stopped deflating.** `perReturnSharpe` returns
±Infinity for a zero-variance trial by design, and a grid trial with a single
trade always has zero variance. One such trial made the variance across trials
`NaN`, which `expectedMaxSharpe` read as "no selection took place" and answered
with the benchmark — so the deflated Sharpe collapsed to a plain probabilistic
Sharpe against zero and reported a credible edge exactly when it was meant to
be warning about overfitting (0.994 against a correctly deflated 0.444 in the
documented example). The three kinds of trial value are now told apart: `±Infinity` is
excluded from the spread but still counts towards `trials`, since the search
for it did happen; a `NaN` trial is broken input and propagates; and fewer
than two finite trials among two or more searches leaves the spread
unestimable, which is reported as `NaN` rather than as an absence of
selection. `expectedMaxSharpe` propagates `NaN` rather than swallowing it.

**MAR was a twelfth of the ratio its name denotes.** `calculateMAR` divided
the arithmetic average *monthly* return by max drawdown; the canonical MAR is
annualized return over max drawdown. Anything screening on the `"mar"`
optimization metric — grid-search ranking, constraints, walk-forward
aggregation — was comparing against industry thresholds an order of magnitude
away. It is not a monotone rescaling either, so rankings could differ: over
two years, 300% return against a 50% drawdown beat 200% against 36% on the
monthly form (0.250 vs 0.231) and loses on the annualized one (2.00 vs 2.03).
Note that this makes `"mar"` and `"calmar"` coincide for full-history results,
which is what the two ratios are when computed over the same window.

### Breaking — Sharpe and Sortino are annualized from the equity curve, not from per-trade returns

Five places annualized a series holding one return per **trade** by
`sqrt(252)` — the factor for one return per *day*. The reported ratio
therefore grew with how long positions were held: the same equity path
packaged as 21-day trades scored `sqrt(21)` (over four times) higher than the
same path marked daily, and it did not move at all when the same trades were
spread over ten years instead of one. Any comparison between strategies of
different trade frequency was being made on numbers that were not comparable,
and `BacktestResult.sharpeRatio` was documented as "annualized" throughout.

Sharpe and Sortino now come from the equity curve's bar-to-bar returns,
annualized by the frequency those bars actually occurred at, which is the
canonical definition and is independent of trade packaging. Where no equity
curve exists — a result rebuilt from trades alone, or live metrics from a
trade log — the trade returns are annualized by the observed trade frequency
instead, an approximation of the same quantity rather than a different metric.

`PortfolioBacktestResult.equityCurve` changed with it. It used to step only
when a trade closed, which made it a realized-P&L curve rather than the
mark-to-market one its documentation described: every price move made while a
position was open was invisible, so a strategy that bought early and sold at
the end produced a single step no matter how violent the ride, and two paths
with the same final P&L were indistinguishable. It also ran only as far as the
last trade exit, so a portfolio that traded for a month and then sat flat for
eleven was annualized as a one-month run. The curve is now the per-bar
mark-to-market equity of each symbol merged on timestamp, covering the whole
window. Portfolio max drawdown is computed from that curve and therefore now
includes drawdowns suffered inside an open position.

Affected: `runBacktest`, `runBacktestScaled`, `batchBacktest`,
`portfolioBacktest`, `calculateRuntimeMetrics` and
`applyEquityCurveFilter`. Reported Sharpe/Sortino values change — typically
downward for anything holding positions longer than a bar. Portfolio Sharpe
changes the most: it pooled per-trade returns across symbols, measuring
cross-sectional trade dispersion rather than portfolio risk, even though a
mark-to-market portfolio equity curve was already being built alongside it.

`calculateRuntimeMetrics`'s `annualizationFactor` / `calendar` options are now
the fallback for when the trades do not span a usable stretch of time, rather
than the assumed period length.

`sortinoFromReturns` is exported alongside the existing `sharpeFromReturns` so
the pair can be computed with matching conventions.

### Breaking — variance and correlation are computed in two passes; four incremental snapshots bump their schema version

Fifteen modules derived a variance, correlation or regression slope from the
one-pass shortcuts `Σx²/n − mean²` and `n·Σxy − Σx·Σy`. Both subtract two
nearly equal large numbers whenever values are large relative to their spread,
and lose every significant digit of the result. Prices quoted in yen, won or
rupiah — and raw share volumes — sit in exactly that range, so the failures
were reachable with ordinary data, and they were not gradual:

- `bollingerBands` collapsed to zero-width bands at price ~1e8 (a false
  squeeze signal, with `percentB` pinned to its 0.5 fallback), and the error
  grew with the length of the stream because the sliding sum-of-squares was
  never recomputed. Bands no longer satisfied the documented
  `middle ± stdDev · standardDeviation()` relation.
- `olsRegression` returned a hedge ratio of −0.7 where the true slope was 0.5,
  with `rSquared` of −4.76 — a pairs trade would have hedged in the wrong
  direction while still reporting the pair as cointegrated.
- `pearsonCorrelation` returned 0 for perfectly anti-correlated series at
  large offsets, and −1.0000000000095 at ordinary price levels, outside its
  documented range.
- The incremental `standardDeviation`, `bollingerBands`, `linearRegression`
  and `historicalVolatility` disagreed with their batch counterparts (up to
  732% for standard deviation at 1e8; `rSquared` forced to 0 on 204 of 287
  bars), breaking the batch/incremental parity contract. Worse, the drifted
  running totals were serialized into snapshots, so the error survived
  save/restore.
- `volumeAnomaly` (batch and incremental) missed genuine outliers at large
  volumes: a true 3.73-sigma spike scored 0.0008.
- `linearRegression` (batch and incremental) reported a slope of 0.482 for a
  series rising by exactly 0.5 per bar at price ~1e15.

All of them now compute the mean first and accumulate squared deviations
about it. Bollinger bands are now bit-identical
to `middle ± stdDev · standardDeviation()` at every price level tested
(1e2, 1e7, 1e9).

Breaking: the incremental `standardDeviation`, `bollingerBands`,
`linearRegression` and `historicalVolatility` no longer keep running sums in
their state — the retained buffer is the only state a window needs, which is
what makes a resumed stream drift-free. Their schema versions are bumped to 2,
so snapshots taken with an earlier version are rejected with the usual
"re-warm required" error and must be re-warmed. Statistics values change
(they were wrong before) — mostly below float noise at ordinary price levels.
### Breaking — `DivergenceSignal` gains a confirmation bar; trade-signal converters emit at causal timestamps

`detectDivergence` (and `rsiDivergence` / `obvDivergence` / `macdDivergence` /
`cvdDivergence`) anchors each signal at its second pivot. A pivot is only
identifiable `swingLookback` bars after it occurs, so `time` and `secondIdx`
point at a bar that was not knowable when it printed — and it is by
construction a local price extreme. `fromDivergenceSignal` re-stamped that
time onto an actionable BUY/SELL `TradeSignal`, and the documented usage
passed `candles[s.secondIdx].close` as the entry price, so consumers were
entering at the swing extreme five bars before the divergence could be seen.

`DivergenceSignal` now carries `confirmedAt` (and `confirmedIdx`): the first
bar at which the divergence is knowable, being the later of the price and
indicator pivots plus `swingLookback`. Verified against a truncated re-run —
each signal is detectable from the prefix ending at `confirmedAt` and not one
bar earlier. `time`/`secondIdx` remain as pivot annotation (chart markers
still want the pivot), and both new fields are required, so any code
constructing a `DivergenceSignal` must supply them. A divergence whose
confirmation bar falls outside the candle array is withheld rather than
reported at the last bar — only reachable through `detectDivergence` when the
price/indicator series passed are longer than `candles`.

`fromDivergenceSignal` now stamps `time` and `id` from `confirmedAt`, keeping
the pivot time in `metadata.pivotTime`. `fromPatternSignal` had the same
problem and now stamps at the pattern's actionable bar (`confirmTime` when
confirmed, otherwise `detectableTime`), keeping the pivot in
`metadata.patternTime`. Emitted timestamps and ids therefore change for both
converters; the streaming divergence detector was already causal, so batch
and streaming now agree.

### Fixed — `runBacktestScaled` (tranches ≥ 2) now honors `fillMode` and `slTpMode`

The multi-tranche path of `runBacktestScaled` accepted `fillMode`/`slTpMode`
and recorded them in `result.settings`, but never used them:

- Entries (first and additional tranches) always filled at the signal bar's
  own close — a same-bar fill even under the default `next-bar-open`, giving
  the backtest the signal bar's close before it could have acted on it.
- Stop loss, take profit, partial take profit, and trailing stops always
  triggered on intrabar wicks and exited at the trigger price, ignoring the
  default `close-only` mode. A bar that dipped through the stop but closed
  above it stopped the position out anyway.
- The single-tranche fallback honored both modes, so semantics silently
  flipped when `tranches` went from 1 to 2, and `result.settings` misreported
  what actually ran.

The multi-tranche path now mirrors the single-entry engine: `next-bar-open`
queues entries/exits and fills them at the next bar's open, `same-bar-close`
fills at the signal bar's close; SL/TP/partial/trailing route through the
same trigger helpers as `runBacktest`, honoring `slTpMode`. With identical
options and only one tranche filling, `runBacktestScaled` now produces
trade-for-trade identical results to `runBacktest`. Scaled trades also carry
`exitReason` now (previously undefined).

Additionally, tranche additions no longer look ahead: the bar that triggers
an additional tranche evaluates its exit checks against the pre-tranche
average entry price (a `same-bar-close` tranche fill only exists from the
close, a `next-bar-open` fill from the next bar's open), so price action
from before the fill can no longer trigger take-profits computed off the
updated average. Exit checks also run before tranche additions, so a bar
that exits does not add a tranche at the same close.

A partial take profit followed by a later tranche addition also computed the
average entry price wrong: the sold shares were left inside the per-tranche
records at full weight, so the recomputed average over-weighted the old cost
basis (e.g. buy 500 @100, sell 250, add ~511 @97.9 → average reported as
~98.94 instead of the correct ~98.59), skewing subsequent SL/TP levels and
the final P&L. Tranche shares are now scaled down by the sold fraction, so
later additions average against the remaining position only.

Multi-tranche backtest results will change (honestly): entries shift to the
next bar's open under the default mode, and wick-based stop-outs disappear
under the default `close-only` mode; previous results carried same-bar
look-ahead.

### Breaking — `PatternSignal` gains causal timestamps; pattern backtest conditions no longer enter at the pivot bar

Chart-pattern detectors anchor `PatternSignal.time` at the pattern's final
structural pivot (e.g. a double bottom's second trough), but that pivot is
only identifiable `swingLookback` bars later, and breakout confirmation can
come weeks after that. The pattern backtest conditions (`patternDetected`,
`patternConfirmed`, `patternWithinBars`, `patternConfidenceAbove`,
`anyBullishPattern`, `anyBearishPattern`, and friends) matched entries
against `time`, so a backtest bought the exact double-bottom low with
knowledge of a breakout that had not happened yet — a measured ~10% per-trade
look-ahead edge on synthetic data.

- `PatternSignal` now carries `detectableTime` (required — the bar where the
  formation becomes knowable in real time: final pivot + `swingLookback`
  bars) and `confirmTime` (optional — where the breakout confirmation
  becomes knowable: the later of the breakout bar and `detectableTime`; only
  set when `confirmed` is true). All detectors (double top/bottom, head &
  shoulders, cup & handle, triangle, wedge, channel, flag/pennant, harmonics)
  populate them. Code constructing `PatternSignal` values by hand must now
  provide `detectableTime`.
- Pattern backtest conditions match against these causal timestamps instead
  of `time`: `patternDetected` fires when the formation is knowable,
  `patternConfirmed` when the breakout is knowable, and
  `patternConfidenceAbove` gates a confirmed pattern's confidence (which
  folds in breakout-bar information) on the confirmation bar.
  `patternWithinBars` looks back over actionable bars.

Backtests entering on pattern conditions will show later (honest) entries
and typically lower returns; previous results carried systematic look-ahead
bias. `PatternSignal.time` itself is unchanged, so chart rendering and
pattern-marker placement are unaffected.

### Fixed — mid-bar fills no longer monetize pre-fill price action

When a pending limit/stop order filled mid-bar, the new position's
peak/trough were seeded from the fill bar's full high/low, and same-bar
stop/take-profit/trailing checks ran against the whole bar — including price
action from before the order filled. A limit buy at 90 on a bar that spiked
to 110 first could exit the same bar via "trailing" at 104.5 (a price the
position never owned) and report an MFE of 22% instead of the real 5.6%.
Now:

- Peak/trough seed from the fill price.
- On the fill bar, position management only uses post-fill knowledge (the
  fill price and the close): profit-side triggers cap at
  `max(fillPrice, close)`, stop-side at `min(fillPrice, close)`, and the
  close is folded into peak/trough history only after the fill bar's checks
  (the known path is fill → close, so the close is not a peak the entry
  price then appears to dip below).
- From the next bar on, management is unchanged. Next-bar-open entries are
  unaffected (an open fill owns the whole bar). Exit-signal conditions still
  evaluate against the real candle — market data is not altered, only the
  position's price knowledge.

Backtests entering via limit/stop orders on wide bars will report different
(correct) same-bar exits and lower, honest MFE values.

### Fixed — limit/stop order fills no longer use future or pre-trigger prices

- **Function-based order prices now resolve against the signal candle.**
  `LimitPriceFunc`/`StopPriceFunc` are documented as deriving a level from the
  entry-signal bar (e.g. `stopAboveHigh()` = break of the signal bar's high),
  but the engine re-resolved them against every later fill-check bar. The
  level drifted bar by bar and self-referenced the bar being tested —
  `stopAboveHigh(0)` degenerated to `high >= high` and filled unconditionally,
  even in a falling market; `limitBelowClose(1)` filled in rallies that never
  touched the intended level. Prices are now frozen once at order creation
  (new `freezeOrderPrices` helper, exported for direct `tryFillOrder` users).
  All 10 price presets were affected; fixed numeric prices were always
  correct.
- **stopLimit orders no longer fill at the pre-trigger open on the bar that
  activates them.** The order goes live intra-bar at the stop trigger, so on
  the trigger bar it now fills at `max(stopPrice, open)` (long; mirrored for
  short) when within the limit, or at the limit when the bar also trades
  through it. Previously it fell straight into the resting-limit formula and
  filled at the bar's open — a price from before the order existed. Fills on
  later bars (already-activated orders) are unchanged.

Backtests using function-based prices or same-bar stopLimit activations will
report different (correct) entries; results previously carried a look-ahead
advantage.

### Fixed — per-run state no longer leaks through a shared `IndicatorCache`

- `perfectOrderPullbackEntry` / `perfectOrderPullbackSellEntry` kept a mutable
  breakdown-tracking state object on the indicators proxy under a shareable
  key, so a later `runBacktest` on the same candles + shared cache (exactly
  what grid search and walk-forward do) inherited the previous run's end
  state — producing phantom trades that a fresh-cache run does not have. The
  state now lives under a run-local key that never enters the shared cache,
  and the key includes the full option set (previously two conditions
  differing in `maType`/`collapseEps`/etc. shared one state object within a
  run).
- The engine-injected fundamentals scalars (`per`/`pbr` from the
  `fundamentals` option) leaked the same way: a later run **without**
  fundamentals on a shared cache read the previous run's last values on every
  bar, making `perBelow`/`pbrAbove`-style conditions fire when they should
  see no data. They are now run-local, like the relative-strength benchmark.
- If you write a custom condition that keeps per-run mutable state on the
  indicators object, prefix its key with `__runLocal_`: such keys are never
  read from or written to a shared `IndicatorCache`, so the state cannot
  survive into another run.

### Fixed — condition caches no longer collide across parameter values

Several backtest condition caches omitted parameters from their cache keys, so
two conditions differing only in that parameter shared one cached series —
whichever evaluated first silently poisoned the other, both within a run
(`and()`/`or()` combos) and across runs sharing an `IndicatorCache` (grid
search sweeps over the omitted parameter returned identical results for every
value). Fixed keys:

- `bollingerBreakout` / Bollinger conditions — key now includes `stdDev`
- `regimeIs` / `regimeNot` / `volatilityAbove`-family — the module-level cache
  now differentiates the full `VolatilityRegimeOptions` (previously the first
  options seen were pinned for the candles array, even across separate
  `runBacktest` calls)
- `atrPercentAbove` / `atrPercentBelow` — the module-level cache now
  differentiates `atrPeriod`
- `perfectOrderBullishConfirmed` and every other `perfectOrderEnhanced`-backed
  condition (12 sites) — keys now include `collapseEps`
- `volumeExtreme` — key now includes `threshold`
- `candleFormerBullish` / `candleFormerBearish` — the predictions cache now
  keys on the model weights identity, so mixing two trained models in one
  backtest (or reusing a cache across runs with different models) no longer
  serves the first model's predictions to the second

Sweeps over `stdDev`, `atrPeriod`, `collapseEps`, volume thresholds, or regime
options now produce genuinely distinct results per value; previously-poisoned
runs may report different (correct) numbers.

### Added — 22 scoring exports that were unreachable are now on the main entry

- The scoring module's signal-evaluator factories and pre-built signal
  definitions were not reachable from the package entry point, and there is no
  `trendcraft/scoring` subpath, so they were impossible to import even though
  the documentation referenced them. Now available from `trendcraft`:
  - Evaluator factories: `createStochOversoldEvaluator`,
    `createStochOverboughtEvaluator`, `createStochBullishCrossEvaluator`,
    `createRsiNeutralEvaluator`, `createGoldenCrossEvaluator`,
    `createDeathCrossEvaluator`, `createPerfectOrderBearishEvaluator`,
    `createPriceAboveEmaEvaluator`, `createPriceBelowEmaEvaluator`,
    `createCmfPositiveEvaluator`, `createCmfNegativeEvaluator`,
    `createBullishVolumeTrendEvaluator`, `createBearishVolumeTrendEvaluator`,
    `createHighVolumeUpCandleEvaluator`
  - Pre-built signals: `stochOversold`, `stochOverbought`,
    `goldenCross50200`, `priceAboveEma20`, `pullbackEntry20`, `cmfPositive`,
    `bullishVolumeTrend`, `highVolumeUpCandle`

### Fixed — `highestLowest` now honors the `source` option

- `highestLowest(candles, { period, source })` previously ignored `source` and
  always computed the highest from candle highs and the lowest from candle
  lows. Passing `source: "close"` now computes both extremes from that field,
  e.g. close-based ranges for breakout logic. Omitting `source` keeps the
  previous high/low behavior. The option also widened from
  `"high" | "low" | "close"` to the full `PriceSource` union (adding `open`,
  `hl2`, `hlc3`, `ohlc4`, `volume`), matching other source-accepting
  indicators.

### Changed — robustness parameter sensitivity uses random perturbation samples

- `calculateRobustnessScore` now honors `RobustnessOptions.perturbationSamples`
  (default: 10), which was previously declared and documented but never read.
  The Parameter Sensitivity dimension draws that many random parameter sets
  within the perturbation neighborhood (seeded via `options.seed`) and
  backtests each, instead of grid-searching the narrowed ranges with the
  original step sizes. Sensitivity scores may differ from previous releases;
  the sample count is now independent of the ranges' steps, which removes the
  degenerate "Insufficient parameter combinations" case that occurred when the
  narrowed ranges contained fewer than 3 grid points.

### Breaking — removed option keys that were never read

- **`ScreeningOptions.concurrency`** — `runScreening` is fully synchronous;
  the documented "max concurrent file processing" never existed.
- **`CandleFormerTrainOptions.temperature`** — softmax temperature is an
  inference-time parameter; setting it at training time never had any effect.
  Use `CandleFormerOptions.temperature` (the `candleFormer` indicator option),
  which is wired.
- **`ParseFundamentalsOptions.encoding`** — `parseFundamentals` takes an
  already-decoded string, so the option could never influence decoding. Decode
  the CSV content before calling.

  None of these keys ever changed behavior, so removing them cannot change
  results — but code that sets them will now fail to type-check; delete the
  key at the call site.

### Fixed — documentation: streaming imports and a stale helper reference

- The API docs imported streaming exports from a `trendcraft/streaming` subpath
  that was never published — those imports failed to resolve. Streaming exports
  are reached through the `streaming` namespace of the main entry; the docs now
  use `import { streaming } from "trendcraft"` accordingly.
- Removed a leftover `setBenchmark(...)` reference from the docs (the helper was
  removed; use the `benchmark` backtest option).

### Added — `benchmark` backtest option for Relative Strength

- **`runBacktest` now accepts a `benchmark` option** carrying the benchmark
  candles (e.g. S&P 500, Nikkei 225). This is the supported, ergonomic way to
  supply the reference series that Relative Strength conditions (`rsAbove`,
  `rsRising`, `rsRatingAbove`, `outperformanceAbove`, …) compare against:

  ```ts
  runBacktest(candles, rsAbove(1.0), rsBelow(0.9), {
    capital: 1_000_000,
    benchmark: sp500Candles,
  });
  ```

  Previously there was no working public path — the documented `setup:` callback
  was never a real option and never took effect. The benchmark is a per-run
  input (not a candle-derived value), so pass it on every run that uses RS
  conditions; the derived RS series is still cached and reused across runs that
  share an `IndicatorCache`, the same candles, and the same benchmark.
- The option flows through every backtest entry point: `runBacktestScaled`
  (including the multi-tranche path, which previously had no way to receive a
  benchmark), `batchBacktest`, and `portfolioBacktest` (one benchmark shared by
  all symbols).

### Fixed — benchmark/shared-cache correctness for Relative Strength

- The benchmark is now treated as a run-local input and is never stored in a
  shared `IndicatorCache`. Reusing one cache across runs with the same candles no
  longer lets a benchmark supplied on an earlier run leak into a later run that
  omits it (which previously made RS conditions trade when they should evaluate
  `false`, leaving results order-dependent).
- The cached RS series key now includes the benchmark identity, so reusing one
  cache across runs that share the same candles but use **different** benchmarks
  no longer returns RS data computed against the previous benchmark. Runs that
  share a benchmark still hit the cache as before.

### Breaking — removed `setBenchmark` helper

- **`setBenchmark(indicators, benchmark)` has been removed.** It only mutated an
  indicators object and never reached a backtest run on its own (the documented
  `setup:` callback it was paired with does not exist). Use the new `benchmark`
  backtest option instead. `BENCHMARK_CACHE_KEY` remains exported as the
  indicators-object slot for advanced callers that evaluate RS conditions
  directly against a hand-built indicators object.

### Added — MTF conditions in screening

- **`screenStock` / `screenStockSafe` / `screenStockSeries` accept an
  `mtfTimeframes` option** (and `runScreening` via `ScreeningOptions`), so
  multi-timeframe conditions (`weeklyRsiAbove`, `mtfPriceAboveSma`, `mtfUptrend`,
  …) can now be used in a screen. Without it, MTF conditions cannot evaluate and
  resolve to `false` (with a warning), as before.
- Screening builds the MTF context exactly like the backtest engine — same
  resampling and same closed-bar alignment — so a screen and a backtest see
  identical higher-timeframe data. New `ScreenStockOptions` /
  `ScreenStockSeriesOptions` types are exported.
- The MTF context now registers each timeframe under all of its interchangeable
  spellings, so a condition built with an alias (e.g. `weeklyRsiAbove`, which
  looks up `"weekly"`) resolves against a context requested with the canonical
  form (`mtfTimeframes: ["1w"]`) and vice versa, instead of silently evaluating
  `false`. This applies everywhere the shared MTF setup is used (backtest engine,
  scaled-entry, screening).

### Fixed — MTF look-ahead bias (behavior change)

- **Multi-timeframe conditions no longer see the forming higher-timeframe
  candle.** The base→higher-timeframe index map pointed each base bar at the
  higher-timeframe candle *containing* it, but a resampled candle carries the
  whole period's OHLC (built from bars still in the future relative to a base bar
  mid-period), so e.g. on Monday a `weekly` condition could already read that
  week's Friday close. The map now points at the last **closed** higher-timeframe
  candle (`-1` until one has closed), matching the established convention that a
  higher-timeframe bar becomes visible only after it closes.
- This is a correctness fix that **changes existing MTF backtest results**: MTF
  conditions (`weeklyRsiAbove`, `mtfPriceAboveSma`, `mtfUptrend`, …) now evaluate
  against the prior completed higher-timeframe bar and return `false` early in
  the series until the first higher-timeframe bar has closed. `getMtfCandle` /
  `getCurrentMtfIndicatorValue` return `null` during that initial window.
- Streaming MTF (`createStreamingMtf`) was already correct — it only feeds closed
  candles to indicators and builds the in-progress bar incrementally from bars
  already seen — and is unchanged.

### Added — time-series screening

- **`screenStockSeries(ticker, candles, criteria)`** — screens a stock across
  every bar of its history, returning the entry/exit signal as of each bar,
  rather than only the latest bar like `screenStock`. Useful for finding *when* a
  stock first matched a screen, backtesting a screen, or screening as of a past
  date (`result.points[i]`). Returns `{ ticker, points }` with one
  `ScreeningSeriesPoint` (`index`, `time`, `close`, `entrySignal`, `exitSignal`)
  per candle.
- It evaluates each bar with the same per-bar condition evaluator the backtest
  engine uses, so its latest-bar result matches `screenStock` and its per-bar
  results match what a backtest sees. Indicators are computed once over the full
  series; as with backtesting, that is point-in-time correct for causal
  indicators but can look ahead near the right edge for non-causal ones
  (forward-displaced Ichimoku spans, swing points that need future bars).

### Added — warmup detection helpers

- **`firstValidIndex(series)` / `warmupBars(series)` / `trimWarmup(series)`** —
  series utilities that report (or strip) an indicator's warmup region by reading
  the actual output: the index of the first valid value, the count of leading
  warmup placeholders, and the series with that region removed. The TrendCraft
  analogue of TA-Lib's `*_Lookback()`, but derived from the output rather than a
  hand-maintained per-indicator formula, so it stays correct for option-dependent
  warmups (e.g. `sma({ period })`) without drifting from the implementations.
- For scalar `number | null` series (moving averages, RSI, ATR, …) a warmup bar
  is simply `null`/non-finite, which is the default. Object-valued outputs have
  no reliable generic warmup rule — a null field can mean "warming up" (Bollinger
  Bands) or a normal state (`swingPoints` between swings), and some use non-null
  sentinels while warming up — so the typed overloads **require an explicit
  validity predicate** for non-scalar series (e.g.
  `firstValidIndex(macd(c), (v) => v.macd !== null)`), making the per-indicator
  semantics the caller's choice instead of an unsafe guess.

### Added — S/R zone clustering multi-restart

- **`srZones()` / `srZonesSeries()` accept a `restarts` option** (default `1`):
  K-means is only locally optimal, so the clustering can settle in a worse
  arrangement depending on its initialization. With `restarts > 1` the algorithm
  runs that many initializations and keeps the lowest-inertia (within-cluster sum
  of squares) result. Restart 0 always uses the existing deterministic
  k-means++ seeding, so `restarts: 1` reproduces previous results exactly and any
  higher value can only match or improve on them — never degrade.
- Extra restarts use randomized D²-weighted k-means++ seeding driven by a seeded
  PRNG, controlled by the new `seed` option (default `42`); results stay fully
  deterministic for a given seed.

### Added — hidden (continuation) divergence

- **`detectDivergence()` now detects hidden divergence** in addition to regular
  divergence, selected via the new `DivergenceOptions.kinds` option. Hidden
  divergence is a continuation signal: hidden bullish is a price higher low
  against an indicator lower low; hidden bearish is a price lower high against an
  indicator higher high (the mirror of the regular/reversal forms).
- Every `DivergenceSignal` now carries a `kind: "regular" | "hidden"` field
  alongside its directional `type`. `kinds` defaults to `["regular"]`, so
  existing callers keep getting reversal signals only; pass
  `["regular", "hidden"]` (or `["hidden"]`) to opt into continuation signals.
  The `obvDivergence` / `rsiDivergence` / `macdDivergence` / `cvdDivergence`
  wrappers forward the option unchanged.
- New `DivergenceClass` type export.

### Added — event study: `eventStudy()`

- **`eventStudy(candles, events, options?)`** — measures whether a pattern
  detector's firings carry predictive power, via the conditional-vs-
  unconditional forward-return comparison of Lo, Mamaysky & Wang (2000) within
  the abnormal-return / AAR framework of MacKinlay (1997) and Brown & Warner
  (1985). `events` is a list of event bar timestamps (epoch ms, matching
  `candle.time`) or a `Series<boolean>` whose `true` entries mark events, so the
  output of any detector maps in with a `.filter(...).map(p => p.time)`.
- Per horizon it reports `n`, mean / median / abnormal-mean (AAR) forward
  return, sample std, a cross-sectional t-test, a deterministic **pseudo-event
  bootstrap** p-value (the non-parametric workhorse), a hit rate with a binomial
  test, and distribution shape (skewness, excess kurtosis, percentiles).
  Bootstrap p-values are Benjamini-Hochberg adjusted across the horizons.
- Default baseline is **mean-adjusted** (subtract the unconditional mean forward
  return); `"raw"` tests against zero. The bootstrap is seeded (default 42) so
  results are reproducible. `minSeparation` thins overlapping events and
  `overlappingEvents` flags the non-independence they cause.
- New shared statistics primitives on `core/statistics`: `normalCdf`,
  `skewness`, `kurtosis`.

### Added — first-class equity curve on `BacktestResult`

- **`BacktestResult.equityCurve`** — `runBacktest` now emits the mark-to-market
  account equity at each candle's close, aligned index-for-index with the
  candles (`equityCurve[0]` is the starting capital, `equityCurve.length ===
  candles.length`). Equity is `cash + position claim − loan`, signed by
  direction, matching the engine's own margin-equity accounting. This is a
  faithful curve: it tracks an open position's unrealized P&L and realizes each
  partial exit / scale-out leg correctly.

### Fixed

- **Daily-returns-based metrics are now faithful for shorts and partial
  exits.** The returns underlying `report()`, `backtestByRegime()` and the
  optimization metrics were reconstructed from trade records, which (a) marked
  open positions long-only — so a profitable short showed interim losses — and
  (b) treated the first partial exit as closing the whole position, dropping the
  P&L of every later scale-out leg. These metrics now derive from the engine's
  `equityCurve` when present, which handles direction, partials and margin
  correctly. The from-trades reconstruction remains as a fallback for hand-built
  results and was itself corrected to respect trade direction.

### Added — regime-conditioned attribution: `backtestByRegime()`

- **`backtestByRegime(result, { candles, regimes, ... })`** — attributes a
  backtest's performance to the market regime active on each bar. Returns a
  per-regime performance table (bars, share of period, total/annualised
  return, annualised volatility, Sharpe, regime-local max drawdown, win rate,
  and an entry-attributed trade count) plus the empirical regime transition
  matrix. `regimes` is a per-bar label series aligned to `candles` — the
  output of `hmmRegimes(candles)` satisfies it directly, but any per-bar
  `{ regime, label }` source works.
- Attribution is **bar/return-level** (each daily return is assigned to the
  regime of the bar it is realised on, the convention shared across the quant
  ecosystem), so a position held across a regime change has its P&L split
  across regimes. The per-regime `tradeCount` is a separate trade-level view,
  counted by the regime at trade entry.
- The transition matrix is **row-stochastic** (`matrix[from][to]`, each row
  summing to 1, the diagonal being regime persistence) and is returned with a
  parallel `counts` matrix so small-sample cells are visible.
- Documented caveats: regime labels from a full-sequence (smoothed/Viterbi)
  fit embed look-ahead bias, making the table descriptive rather than
  tradeable; and per-regime ratios from few `bars` are unreliable.

### Added — tearsheet metrics and `report()`

- **Return-distribution metrics** operating on a periodic-returns array
  (fractions): `omegaRatio`, `tailRatio`, `gainToPainRatio`,
  `commonSenseRatio`, `cpcIndex`, plus the building blocks
  `profitFactorFromReturns`, `winRateFromReturns`, `payoffRatioFromReturns`
  and the `percentileLinear` helper. Definitions follow the established quant
  convention: undefined ratios (zero/empty denominator) return `NaN`, except
  the returns-based profit factor, which returns `Infinity` when there are
  gains but no losses (and so can propagate into `commonSenseRatio`).
  Percentiles use linear interpolation and rolling deviations use the sample
  estimator (ddof = 1).
- **Rolling metrics**: `rollingSharpe` and `rollingVolatility` over a trailing
  window (default 126 periods), returning arrays aligned index-for-index with
  the input (leading `window - 1` entries are `NaN`). Sharpe is annualised by
  `sqrt(periodsPerYear)`; volatility always is. `sharpeFromReturns` exposes the
  scalar annualised Sharpe kernel they (and the per-regime attribution) share.
- **`captureRatios(returns, benchmark, periodsPerYear?)`** — up/down capture
  versus a benchmark, dividing the strategy's geometric annualised return by
  the benchmark's over the periods where the benchmark is strictly up or down.
- **`report(result, { candles, ... })`** — a single aggregated tearsheet
  object combining the engine's headline statistics (return, CAGR, Sharpe,
  Sortino, Calmar, max drawdown, profit factor, win rate) with the
  distribution metrics, Ulcer Index / Ulcer Performance Index, optional
  capture ratios, the drawdown summary, and the daily equity, underwater and
  rolling series. The distribution and rolling figures are computed from the
  daily equity returns reconstructed from `candles`.

### Added — overfitting defense: PBO (CSCV), purged walk-forward, MinTRL

- **`pbo(returnsMatrix, { blocks, metric })`** — Probability of Backtest
  Overfitting via Combinatorially Symmetric Cross-Validation (Bailey,
  Borwein, López de Prado & Zhu). Takes a T×N matrix of per-period returns
  (N parameter combinations over T periods), evaluates all C(S, S/2)
  in-sample/out-of-sample block splits, and reports how often the IS-best
  configuration ranks below the OOS median (λ < 0, the canonical CSCV
  criterion; ties take the average rank so an exactly-median winner is
  neutral, not overfit). PBO ≥ 0.5 means parameter selection is no better
  than chance out of sample. `pboSafe` variant included. Building the matrix is the caller's
  responsibility for now (a grid-search adapter is planned); the default
  ranking metric is the newly exported `perReturnSharpe`.
- **`purgeBars` option on `walkForwardAnalysis` / `anchoredWalkForwardAnalysis`**
  — excludes the last N bars between each training window and its test
  window, so indicator lookbacks and multi-bar exit labels cannot leak
  in-sample information across the boundary. Size it to the longest
  indicator period or holding horizon the strategy uses. Default 0
  (legacy adjacent windows). An embargo after the test window is a
  combinatorial-split concept and intentionally not part of causal
  walk-forward.
- **`minTrackRecordLength(sharpe, benchmark?, confidence?, skew?, kurt?)`**
  — the exact inverse of `probabilisticSharpe`: the shortest number of
  return observations before the observed Sharpe is statistically
  distinguishable from the benchmark at the given confidence. Returns
  `Infinity` when there is no edge to establish.

### Fixed — leveraged backtests now repay the margin loan on position close

`runBacktest` with a `margin` config credited the full exit proceeds —
including the loan-funded notional — back to capital without ever deducting
the borrowed principal, overstating final capital by roughly the borrowed
amount (e.g. 1M capital at 2x leverage on a +20% trade reported 2.4M instead
of 1.4M). The borrowed principal is now repaid proportionally as the position
unwinds (full exits, partial take profits, scale-outs, margin-call
liquidations, and end-of-data closes), and margin interest is settled against
the outstanding loan before repayment.

Margin-call detection was also broken: the equity check passed the entry
notional instead of remaining cash into the margin-ratio computation, so the
ratio could effectively never fall below maintenance. The check now uses
cash + position claim − loan, and is direction-aware
(`updateMarginState` gained optional `direction` / `entryValue` params): a
short's equity rises as the price falls — proceeds plus unrealized P&L —
so profitable shorts are no longer at risk of being liquidated while losing
shorts breach maintenance correctly, and `marginCallAction: "liquidate"`
actually triggers.

`marginCallAction: "reduceToMaintenance"` is now implemented (it was
accepted by the config type but did nothing): on a maintenance breach the
engine sells just enough of the position — a fair-value partial close with
`exitReason: "marginCall"` — to restore the margin ratio to the maintenance
level, repaying the loan proportionally; if equity is exhausted it falls
back to full liquidation.

Margin interest is now charged per repaid tranche: partial take profits and
scale-outs settle interest on the repaid portion for exactly the days it
was outstanding, instead of the final close charging only the residual
loan. Settled interest also no longer inflates `accumulatedInterest` (which
the equity check subtracts as *unpaid* interest — recording paid charges
there double-counted them against equity). Leveraged results (final
capital, drawdowns, Sharpe) will be lower — and correct — after these
fixes; unlevered backtests are unaffected. The `repayLoan` helper is
exported alongside the other margin utilities.

### Added — position sizing wired into the backtest engine (`sizing` option)

`runBacktest` now accepts a `sizing` option (`BacktestSizingConfig`) that
sizes every entry instead of always deploying full capital:

```ts
runBacktest(candles, entry, exit, {
  capital: 1_000_000,
  stopLoss: 5,
  sizing: { method: "risk-based", riskPercent: 1 },
});
```

Methods — mirroring the streaming `PositionSizingConfig` so a strategy sizes
identically in backtest and live contexts:

- `full-capital` (default, the previous behavior)
- `fixed-fractional` — a fixed percentage of current equity per entry
- `risk-based` — risk `riskPercent` of equity against the configured stop
  (`stopLoss` percent, or `atrRisk.atrStopMultiplier`); falls back to
  full-capital when no stop is configured
- `atr-based` — risk against an ATR-implied stop distance
  (`atrValue × atrMultiplier`); entries are skipped during ATR warmup
- `kelly` — Kelly criterion from user-supplied `winRate` / `winLossRatio`
  (half-Kelly by default, capped at 25%); entries are skipped when there is
  no positive edge
- `custom` — per-entry callback receiving a `BacktestSizingContext` (current
  equity, entry price, proposed full-capital shares, ATR, closed trades so
  far); return the desired share count, or 0 to skip

All sized methods compute their risk on current (compounding) cash equity
and are clamped to available buying power — so with `margin` configured,
`risk-based` / `atr-based` entries can deploy leveraged notional up to the
buying-power cap. Shares stay fractional, and sizing composes with
`volumeConstraint` (the tighter limit wins). The full sizing config is
recorded in `result.settings.sizing` for reproducibility (the `custom`
variant as `{ method: "custom" }` only).

Strategy JSON gains an optional `backtest.sizing` field (the JSON-safe
subset, `BacktestSizingConfigJSON` — every method except `custom`), loaded by
`loadStrategy`. `portfolioBacktest` picks sizing up through
`tradeOptions.sizing`; its never-wired `positionSizing` field is now marked
deprecated in favor of that path.

## [0.4.0] - 2026-06-09

### Breaking — `dmiBullish` / `dmiBearish` ADX param renamed `minAdx` → `threshold`

The backtest `dmiBullish(threshold, period)` / `dmiBearish(threshold, period)`
conditions renamed their first parameter from `minAdx` to `threshold` and
raised its default from `20` to `25` (Wilder's strong-trend level). This aligns
them with the streaming registry, the shared `adxStrong` condition, and the
direct factory signatures — the ADX threshold now has one name and one default
everywhere. A persisted StrategyJSON leaf `{ "name": "dmiBullish", "params": {
"minAdx": 30 } }` must be updated to `{ "params": { "threshold": 30 } }`; an
unrecognized `minAdx` is otherwise ignored and the new default (25) applies.

### Fixed — backtest ↔ streaming registry parity for shared condition params

Conditions registered under the same name in both registries had drifted on
portability-relevant param schema, so a portable StrategyJSON behaved
differently per registry. Reconciled: `cmfAbove` / `cmfBelow` `threshold`
default (now `0`, the CMF zero-line, on both), `priceDroppedAtr` `multiplier`
default (now `2.0` on both), `atrPercentAbove` `threshold` default (now the
shared `DEFAULT_ATR_THRESHOLD` constant on both), `atrPercentBelow` `threshold`
(backtest now defaults it to `1.0` instead of requiring it), and
`bollingerBreakout` / `bollingerTouch` `band` (streaming now defaults to
`"lower"` instead of requiring it). A new parity test fails CI on any future
shared-param drift between the two registries.

The condition factories behind these entries were aligned with the reconciled
defaults so a directly-constructed condition and a registry-hydrated one behave
identically when a param is omitted: the streaming `cmfAbove` / `cmfBelow`
(`0`), `priceDroppedAtr` (`2.0`), `atrPercentAbove` (`DEFAULT_ATR_THRESHOLD`),
`rsiBelow` (`30`) / `rsiAbove` (`70`) factories now carry those defaults; the
backtest `atrPercentBelow` factory defaults `threshold` to `1.0` instead of
requiring it; and the streaming and backtest `bollingerBreakout` /
`bollingerTouch` factories default `band` to `"lower"` instead of requiring it.

### Fixed — volume-constrained partial fills no longer erase un-deployed capital

`runBacktest` with a `volumeConstraint` (and the default `partialFill: true`)
zeroed `currentCapital` on entry regardless of how many shares actually filled.
For a partial fill the cost basis is only the deployed notional, so the
un-deployed cash was erased from equity and never credited back on exit — on a
flat market a constrained backtest reported a ~99.9% phantom loss. Only the
filled notional + commission is now deducted; full (unconstrained) fills are
unchanged.

### Fixed — walk-forward analysis aggregates the `mar` metric

`calculateAggregateMetrics` omitted `"mar"` from its metric list, so
`walkForwardAnalysis(..., { metric: "mar" })` left the aggregate `mar`
undefined, collapsing `stabilityRatio` to 0 and forcing the pessimistic
recommendation regardless of true out-of-sample performance.

### Fixed — live `PositionTracker` equity/drawdown for short positions

`updateUnrealized` used a long-only equity formula, so an open short's equity
(and therefore `peakEquity` / `maxDrawdownPercent`) moved the wrong way with
price — a winning short looked like a losing one mid-trade, firing phantom-loss
drawdown stops. Equity is now direction-agnostic (`cash + entryPrice·shares +
unrealizedPnl`).

### Fixed — NaN / divide-by-zero guards in relative-strength, Pareto, and stress-test

`rankByRS` returned `NaN` percentile for a single-symbol input; `benchmarkRS`
returned `NaN` `rsRating` for a degenerate `rankingLookback`; `paretoOptimization`
let NaN objective metrics (calmar / mar / recoveryFactor on zero-drawdown data)
pollute the front; and `stressTest`'s CVaR dropped the VaR observation from its
tail (off-by-one). All four are now guarded.

### Fixed — sloped Head & Shoulders neckline breakout + RSI registry default drift

`findNecklineBreakIndex` projected a sloped neckline from the wrong anchor, so
the breakout threshold was mis-placed (false confirmations on down-sloping
necklines, suppressed breaks on up-sloping ones); flat necklines were
unaffected. Separately, the streaming registry marked `rsiBelow` / `rsiAbove`
`threshold` as required while the backtest registry defaulted it, so a portable
StrategyJSON omitting `threshold` validated differently per registry — the
streaming entries now share the same default.

### Added — `extractTradeReturns` re-exported from the package root

`extractTradeReturns` is now exported from `trendcraft` (it was only on the
`optimization` barrel), so the documented `deflatedSharpeFromReturns` example —
`extractTradeReturns(result)` — no longer throws at runtime.

### Added — incremental price / SMC factories

Five batch indicators gained streaming counterparts, exposed on the
`incremental` barrel: `createAutoTrendLine`, `createChannelLine`,
`createFibonacciExtension`, `createFibonacciRetracement` (price), and
`createLiquiditySweep` (SMC). Each maintains running state across `next()`
calls instead of recomputing over the full candle history.

### Added — `getIndicatorPreset(kind)` + `alwaysTrue` / `alwaysFalse` conditions

`getIndicatorPreset(kind)` resolves a manifest kind (long name or short
key) to its `IndicatorPreset`, returning `undefined` when the kind has no
preset. The `alwaysTrue` / `alwaysFalse` backtest conditions provide
constant-truth leaves for composing or disabling strategy branches.

### Added — Schaff Trend Cycle `factor` option; T3 `vFactor` exposed in presets

`schaffTrendCycle` gains a `factor` option (default `0.5`, validated to
`(0, 1]`) controlling the smoothing of both stochastic passes. Separately,
T3's existing `vFactor` volume-factor option is now surfaced in the
streaming presets — `livePresets.t3` and `indicatorPresets.t3.paramSchema`
expose `vFactor` (default `0.7`) so hosts can drive it from the UI, and the
snapshot name now incorporates it (`t3_<period>_<vFactor>`).

### Added — optimizer cross-parameter constraints (`validateParams` + `paramFilter`)

The grid-search engine can now reject structurally-invalid parameter
combinations *before* backtesting them, the exhaustive-grid analogue of
vectorbt's parameter mask. `GridSearchOptions` and `WalkForwardOptions`
gain a `paramFilter?: (params) => boolean`; combinations it rejects never
run, never enter `results`, and don't count toward `validCombinations`
(distinct from metric `constraints`, which filter *after* backtesting on
realized metrics).

Condition registry entries gain an optional
`validateParams?: (params) => boolean` for cross-field invariants no
per-field range can express — `goldenCross` / `deadCross` /
`validatedGoldenCross` / `validatedDeadCross` now declare
`shortPeriod < longPeriod`. `gridSearchFromJSON` and
`walkForwardAnalysisFromJSON` automatically build a `paramFilter` from the
strategy's leaves and their registered `validateParams` (AND-composed with
any caller-supplied `paramFilter`), so an inverted-cross combo can neither
appear in grid results nor be chosen as a walk-forward window's best
parameters. Walk-forward's no-valid-combination fallback honors the same
filter rather than defaulting to raw range minima.

### Added — `walkForwardAnalysisFromJSON` (JSON-first rolling walk-forward)

Sibling of `gridSearchFromJSON` for rolling walk-forward analysis. Drives
`walkForwardAnalysis` directly from a `StrategyJSON` plus path-addressed
`PathParameterRange[]`, so callers no longer have to hand-write a
`StrategyFactory` to walk-forward a JSON strategy. Per-period `bestParams`
keys are paths (e.g. `"entry.0.shortPeriod"`), matching
`gridSearchFromJSON`, so a window's optimized params plug straight back
into `applyParamOverrides`. `walkForwardAnalysisFromJSONSafe` returns a
`Result` (range-path errors → `INVALID_PARAMETER`, oversized grid →
`TOO_MANY_COMBINATIONS`, too-short slice → `INSUFFICIENT_DATA`).

Covers rolling walk-forward only; anchored walk-forward runs a
condition-combination search rather than a parameter sweep and does not
share this shape.

Internally, the shared JSON→factory translation (path validation, factory
construction, range conversion, error classification) is now factored into
`optimization/strategy-json-factory.ts`, which both `gridSearchFromJSON`
and `walkForwardAnalysisFromJSON` delegate to, so the two entry points
cannot drift on validation rules.

### Changed — Monte Carlo: bootstrap resampling by default + downside-risk summary (replaces p-value)

`runMonteCarloSimulation` gains a `method?: "shuffle" | "bootstrap"`
option and now defaults to **`"bootstrap"`** (was an unconditional
order shuffle). Bootstrap draws N trades with replacement, so total
return, Sharpe, and profit factor vary across simulations — the basis
for outcome-uncertainty and probability-of-loss estimates. The previous
behaviour is still available as `method: "shuffle"` for sequence-risk
analysis, where only the path-dependent max drawdown varies.

This matches the resampling distinction drawn by mainstream backtest MC
tooling, where bootstrap (with replacement) is the default for "how
reliable is this edge?" and order shuffling is the narrower
sequence-risk test.

The result's significance fields are replaced by a **downside-risk
summary measured directly on the resampled outcomes**. The previous
`pValue` / `assessment.isSignificant` shape forced a binary
significance verdict (a permutation-test concept) onto a resampling
distribution and compared mismatched Sharpe formulas. In its place
`MonteCarloResult.downside` reports `probProfit`, `probLoss`,
`riskOfRuin` (the fraction of simulations whose path-dependent max
drawdown reaches a configurable `ruinThreshold`, default 50%), and the
`ruinThreshold` used. `runMonteCarloSimulation` accepts a matching
`ruinThreshold?: number` option. `assessment` keeps a method-aware,
human-readable `reason` and the `confidenceLevel` but no longer carries
`isSignificant`. `summarizeMonteCarloResult` returns `{ probProfit,
probLoss, riskOfRuin, expectedSharpe, sharpe95CI, originalSharpe }`.
These distribution-based figures are what mainstream backtest Monte
Carlo tooling reports (StrategyQuant, AmiBroker, BuildAlpha).
`originalResult` is unchanged (still the backtest's reported metrics).

### Added — Robustness helpers: walk-forward efficiency, stitched OOS equity, Deflated Sharpe

- **`wfeRatio(result)`** — Pardo's Walk-Forward Efficiency: the average
  per-period ratio of annualized out-of-sample to annualized in-sample
  return. Both windows are annualized over their calendar span before
  the ratio, periods with non-positive in-sample return are skipped, and
  the result is `NaN` when none qualify. Uncapped, so a strategy that
  beats its optimization out-of-sample scores above 1.0. Pardo treats
  ≥ 0.5 as the threshold for a robust (rather than curve-fit) strategy.
- **`stitchOosEquity(result, initialCapital?)`** — stitches every
  walk-forward period's out-of-sample trades into one continuous equity
  curve, one point per trade (plus a leading anchor). A finer-grained
  companion to the period-granularity `getOutOfSampleEquityCurve`.
- **`deflatedSharpe(params)`** / **`deflatedSharpeFromReturns(returns,
  trialSharpes)`** — Deflated Sharpe Ratio (Bailey & López de Prado
  2014): the probability the true Sharpe is positive after correcting
  for selection bias across `N` trials, non-normality (skew / kurtosis),
  and sample length. Building blocks `probabilisticSharpe(...)` (PSR) and
  `expectedMaxSharpe(trials, variance)` (the SR0 selection benchmark) are
  exported too. All Sharpe inputs are per-return (non-annualized).

### Added — `listTunables(strategy)` for numeric parameter introspection

Walks a `StrategyJSON`'s entry / exit conditions and emits one `Tunable`
per numeric registry-declared parameter. Mirrors the strategy-parameter
introspection surface exposed by other TA frameworks (TA-Lib's
`TA_GetOptInputParameterInfo`, backtrader's `self.params`, freqtrade's
`IntParameter` / `DecimalParameter`, Pine Script's `input.int` /
`input.float`).

Each `Tunable.key` follows the canonical `<bucket>.<leafIndex>.<paramName>`
path syntax so the result feeds `gridSearchFromJSON` without
translation. The full registry `ParamDef` is attached as `schema` so
callers can read `min` / `max` / `default` / `integer` / `precision` /
`suggestedMin` / `suggestedMax` directly. There is **no** heuristic on
top — integer / continuous typing is read from the explicit
`schema.integer` annotation, in line with the industry pattern of
making this typing explicit at the schema level (TA-Lib enum,
freqtrade class hierarchy, Pine Script function pair).

Conditions whose registry entry is missing or whose params are all
non-numeric are silently skipped, so a strategy with `alwaysTrue` /
`alwaysFalse` returns `[]`. Defaults to `backtestRegistry`.

Also adds `ParamDef.tunable?: boolean` so registry entries can opt out
of enumeration when they declare `type: "number"` for compactness but
the runtime value is non-scalar — applied internally to the Perfect
Order `periods` param (consumed as `number[]`).

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
- **Event log** (BOS, FVG, Liquidity Sweep, Pivot Points, Swing
  Points, …) — append-only: a params change keeps the recorded
  events and continues appending.

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

### Breaking — Roofing Filter / FRAMA align with canonical Ehlers formulas

`roofingFilter` / `createRoofingFilter` and `frama` / `createFrama` now
match John Ehlers' published reference formulas; both previously used
variants that diverged from spec.

- **Roofing Filter** (Cybernetic Analysis ch. 13 / Predictive Indicators):
  the high-pass coefficients switched from a Butterworth-shape form to the
  canonical critically-damped form (`alpha1 = (cos θ + sin θ − 1) / cos θ`
  with `θ = √2·π / highPassPeriod`). The `highPassPeriod` minimum was also
  raised from `1` to `2` — the canonical recurrence is stable for period ≥ 2
  but diverges at period 1 (Nyquist-degenerate). Output difference is small
  at default parameters (<1% at period 48).
- **FRAMA** (Ehlers 2005): the fractal-dimension range calculation now uses
  each candle's `high` / `low` (`Highest(High, N/2) − Lowest(Low, N/2)`)
  instead of the smoothing source price. The `source` option still drives
  the recursive smoothing step; only the period-range slope inputs change.
  Incremental FRAMA state now stores separate `highBuffer` / `lowBuffer`
  instead of a single source-price `buffer`.

**Breaking** for callers depending on the prior numeric output (values
change for every parameter combination) and for `highPassPeriod: 1`
(now rejected). Because FRAMA is a recursive smoother, `createFrama(opts,
{ fromState })` refuses to resume with a different `period` / `source`, and
pre-canonical (close-only `buffer`) snapshots are rejected rather than
silently migrated — re-warm from candle history instead.

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
