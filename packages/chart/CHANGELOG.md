# Changelog

All notable changes to `@trendcraft/chart` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — `timeScale.rightOffset`: empty space after the last candle

```ts
createChart(el, { timeScale: { rightOffset: 5 } });
```

Reserves the given number of bar-slots (fractional allowed) between the last
candle and the price axis, so the forming candle isn't drawn flush against
the right edge. The margin is maintained while following the live edge and
honored by `scrollToEnd`-style navigation (keyboard End included),
`fitContent`, and `setVisibleRangeByDuration`. It can be changed at runtime
via `applyOptions({ timeScale: { rightOffset } })` — when the chart is at the
live edge the new margin applies immediately. Values that would leave fewer
than 2 bars visible are capped; negative or non-finite values are rejected
with a warning. Default: 0 (flush, as before).

### Changed — live-edge following shifts instead of snapping

When a new bar arrives while the last bar is visible, the chart used to
scroll back to the end position outright. It now preserves the viewer's
distance from the live edge instead. For a viewer pinned at the live edge
the result is identical, but two long-standing annoyances are gone:

- A custom viewport (a margin different from `rightOffset`, or any
  position set through the public API while the last bar is visible) is no
  longer overridden on the next update — the window drifts with the market
  instead of snapping.
- Panning a few bars into history no longer risks being yanked back to the
  live edge by the next tick; the view preserves its distance from the live
  edge.

`setCandles` still lands at the live edge, and viewers who scrolled fully
away from the last bar are still left alone, as before.

### Fixed — clamping is consistent in session-gap layouts

The scroll clamp compared the viewport size against the raw candle count,
while the scroll boundary used gap-expanded units. With session gaps enabled
and a viewport wider than the candle count but narrower than the expanded
layout, the chart forced the view to the far left even though the last bars
did not fit. Both now use the same units.

## [0.4.0] - 2026-07-26

### Fixed — `resize`, `paneResize`, and `seriesRemoved` events now fire

These three events were declared in the `ChartEvent` union and documented,
but the chart never emitted them. They now fire with the documented payloads:

- `resize` `{ width, height }` — once per actual CSS-px size change, whether
  triggered by `chart.resize()`, an `applyOptions()` size change, or the
  container's `ResizeObserver`. Same-size calls and DPR-only changes
  (e.g. dragging the window to a Retina display) stay silent, and the
  initial sizing during `createChart()` does not emit.
- `paneResize` `{ paneId, height }` — fires while the user drags a pane
  divider (per pointer-move), with the pane above the divider and its new
  height in CSS px. Drags clamped away by the minimum pane height are silent.
- `seriesRemoved` `{ id }` — fires when a series is removed via its handle
  (covers `handle.remove()` and `connectIndicators` teardown). Repeat
  `remove()` calls on the same handle are silent, and `chart.destroy()`
  emits nothing (matching `seriesAdded`, which is also silent on teardown).

### Breaking — `CrosshairMoveData` type now matches the emitted payload

The exported `CrosshairMoveData` type declared `{ time, price, x, y, paneId }`,
but the chart has always emitted `{ time, index, ohlcv, paneId }` from
`crosshairMove`. The type (and docs) now describe the real payload:

- `time: number | null` — epoch ms of the snapped candle
- `index: number | null` — candle index
- `ohlcv: { open, high, low, close, volume } | null` — the snapped candle's values
- `paneId: string | null` — pane under the pointer

All fields are `null` in the single emission fired when the crosshair leaves
the data area (the `ohlcv: null` key is now included there too). Runtime
behavior is otherwise unchanged — this is a type/docs correction. TypeScript
consumers who typed handlers against the old (never-delivered) `price`/`x`/`y`
fields will get compile errors pointing at the fields that never existed at
runtime.

### Added — unknown preset ids suggest the closest match

`connectIndicators(...).add()` used to fail an unrecognised preset id with a
bare "unknown preset" error, leaving a typo to be found by eye against a list
of over a hundred ids. It now names the closest id it knows, so
`add("bolinger")` points at `bollingerBands`.

### Fixed — two-row time axis labels no longer overflow the plot

Edge labels on the two-row time axis were positioned from their anchor without
regard to the plot bounds, so the first and last of them could hang past the
left or right edge and be clipped by the canvas. They are now clamped to stay
inside the plot area.

### Fixed — daily axis no longer shows a time on its first label

On a daily series the first label carried a time component that came from the
timezone offset of the underlying timestamp rather than from the data — a
daily chart could open with a label reading "1 Jan 09:00". Daily and coarser
timeframes now label the date alone.

### Changed — React peer dependency relaxed to `>=18`

The React wrapper declared a peer of `>=19.0.0`, which forced React 18
projects to either upgrade or install with an override even though nothing in
the wrapper needs 19. The peer is now `>=18.0.0`.

## [0.3.0] - 2026-06-09

### Breaking — `snapshotName` is now a default label, not a uniqueness key

`connectIndicators.add()` previously threw on **any** `snapshotName`
collision, forcing hosts to pass `{ snapshotName: "..." }` boilerplate
to keep multiple instances of the same preset — e.g. comparing two
SMA(20) lines in different colors, or stacking two anchored VWAPs from
different anchor times.

New behavior:

- A preset's `snapshotName(params)` is treated as a **default label
  suggestion**, not a uniqueness key.
- When the derived default collides, the library **auto-suffixes**:
  `"sma20"` → `"sma20#2"` → `"sma20#3"`, and so on. Identity is
  guaranteed by `connectIndicators`, not by the preset.
- When the caller passes an **explicit** `snapshotName` and it
  collides, the library still throws — an explicit id belongs to the
  caller and a duplicate is a caller-side bug.

**Migration**: drop the `{ snapshotName }` boilerplate you added solely
to dedupe same-preset instances; the auto-suffix now handles it. Keep
explicit `snapshotName` only where you rely on a stable, host-chosen id
(and ensure those ids are unique — duplicates still throw).

### Fixed — multiple chart instances no longer cross-contaminate decimated candles

The candle-decimation cache was a module-level singleton keyed only on
`{start, end, target, dataVersion}` — none instance-unique — so two charts on
one page, both zoomed out enough to decimate and sharing a viewport, could have
one render with the other's candles. The cache is now keyed on the source candle
array (a `WeakMap`, like the LTTB line cache), scoping it per instance.

### Fixed — a single touch tap fires the tap handler once, not twice

`onTap` listened to both `touchend` and the mouse `click` that browsers
synthesize for the same gesture, so each touch tap fired twice (and a
touch-drawn shape emitted a phantom click). The synthesized click is now
suppressed, matching the guard `onDoubleTap` already had.

### Fixed — Vue `<TrendChart>` applies runtime `options` changes

The Vue wrapper forwarded the `options` prop by value rather than as a reactive
getter, so replacing it with a new object never re-ran `applyOptions` and
runtime option changes (volume, watermark, formatters, …) were silently dropped.

### Added — Price Patterns plugin (`connectPricePatterns`)

A tree-shakeable visualization plugin for chart-pattern signals — Double
Top / Double Bottom, Head & Shoulders and its inverse, triangles,
channels, etc. Hosts compute the signals with `trendcraft`'s detectors
(`doubleTop`, `doubleBottom`, `headAndShoulders`,
`inverseHeadAndShoulders`, …) and pass them to the plugin verbatim; the
plugin renders the standard idiom — a zigzag line through the swing
extremes, a dashed neckline, light body shading, anchored labels, and a
dashed projector to the measured-move target.

New exports from the package entry:

- `connectPricePatterns(chart, signals, options?)` — attach to a chart and
  get a `{ remove() }` handle, matching the other `connect*` plugins.
- `createPricePatterns(signals, options?)` — the headless primitive
  factory, for hosts driving their own render loop.
- `filterPricePatterns(signals, options?)` — the dedup / confidence /
  cap pass used internally, exposed for hosts that want the same culling.
- `PricePatternSignal` (a structural subset of `trendcraft`'s
  `PatternSignal`, so detector output passes through directly) and
  `PricePatternsOptions`.

`PricePatternsOptions` covers bull/bear/neutral colors (hex + optional
`r,g,b` triplets for fills), body alpha, neckline / target dash patterns,
a `minConfidence` floor (default 60), and a `maxPatterns` cap (default 8).

### Added — `connectLivePrimitives` for live-mode plugin support

`connectLivePrimitives(chart, ...)` is a new public export from the
package entry, returning a `{ remove() }` handle like the other
`connect*` plugins. It lets the differentiation plugins (SMC, Wyckoff,
Regime Heatmap, S/R Confluence, Session Zones, etc.) participate in
live mode by recomputing their primitives as new bars arrive, rather
than rendering only against a static candle array. The replay subpath's
`createLiveSimulator` drives it directly (see the `@trendcraft/chart/replay`
entry below).

### Added / Changed — plugin visual enhancements

- **Volume Profile** now draws the VAH / VAL value-area boundary lines
  in addition to the POC, so the 70% value area is visible at a glance
  (#179).
- **Andrews Pitchfork** gains line labels and the 0.25 / 0.75 half-lines
  between the median and the outer tines (#180).
- **Plugin visuals aligned with industry conventions** (#181): TTM
  Squeeze markers render as circular dots on a zero-line rail (was
  rectangles, despite the "dots" name); the Regime Heatmap adds a
  top-left corner pill spelling out the active regime plus confidence
  ("trending-up · 72%") instead of relying on background tint alone.
  Pure rendering changes — the data layer is unchanged.
- **SMC Layer text annotations** label order blocks, fair-value gaps,
  and liquidity sweeps directly on the chart (#183).
- **Wyckoff** renders the sub-phase letter as a separate corner chip
  distinct from the phase label (#184).
- **Trade analysis** gains a P&L label and magnitude-aware MFE / MAE
  labels on each trade marker (#185).

### Added — `liveRecompute` option for batch-only indicator presets

`connectIndicators` presets gain a `liveRecompute?: boolean` flag
controlling how "batch-only" presets (those without a streaming factory,
e.g. HMM regimes) react to new bars:

- **`true` (default)** — the preset recomputes on every `candleComplete`,
  so a batch indicator stays in sync with live data without the host
  wiring its own recompute.
- **`false`** — the preset skips auto-recompute and holds its last value
  until the host calls `conn.recompute(...)`. Use it for presets whose
  recompute is too heavy to run per bar.

### Fixed — touch (double-tap) interaction parity

Pointer handling is unified across mouse and touch: double-tap now mirrors
double-click, the synthesized mouse event that mobile browsers fire after
a real touch double-tap is suppressed (so subscribers don't see it twice),
and a two-click drawing's second tap or a long-press no longer
double-fires as a viewport reset.

### Added — Replay playhead + seed-end integer accessors in `@trendcraft/chart/replay`

For hosts building a "scrubbable replay" UI on top of
`createLiveSimulator`, the subpath now exposes the simulator's
internal integer state directly. The cursor display, snapshot-
backtest slice, and indicator slices all need to agree on *which
bar the user has seen most recently*; reading that integer straight
off the simulator (instead of re-deriving it via independent math)
is the only design that doesn't admit a class of drift bugs at the
boundary.

Added on `SimulatorHandle`:

- `getEmittedQueueCount(): number` — exact integer count of queued
  candles the simulator has fully emitted.
- `getLastEmittedIdx(): number` — exact integer index, in candle
  space, of the last emitted bar. Equals
  `seedCandles.length + getEmittedQueueCount() - 1`. The canonical
  "playhead" for any snapshot backtest or cursor label that must
  not leak future data.

Added on `SimulatorOptions`:

- `seedEnd?: number` — integer seed-bar count, takes precedence
  over `seedRatio` when both are passed. Preferred when the host
  derives the anchor from a click index (passing `seedRatio =
  anchor / length` and letting the simulator multiply back can
  drift by one in IEEE-754, e.g. `Math.floor(22 * (15/22)) === 14`,
  not 15).

Added at module scope:

- `clampedSeedEnd(candles, cursorIndex): number` — clamps the
  anchor click to the same `[5%, 95%]` bounds the simulator uses.
  Stateless utility for previewing what the simulator will pick
  before construction.
- `SEED_RATIO_MIN` (`0.05`) / `SEED_RATIO_MAX` (`0.95`) —
  surface-able constants for hosts that display the bounds in UI.

**Why no `lastEmittedIdx(candles, cursor, count)` /
`resolveQueueIdx` standalone helpers**: an earlier draft of this
release exposed both. Review caught four drift bugs in succession
— float roundoff in the `seedRatio` round-trip; float roundoff in
`progress * queueLen`; double-clamping disagreement between the
simulator and the helper's own `clampedSeedEnd`; and a fractional-
cursor case where the helper preserved the fraction while the
simulator floored. All four were the same class: two parties (the
simulator and a stateless helper) deriving the same integer
through independent paths, which is inherently fragile. The
redesign drops the standalone helper entirely. The simulator owns
`seedEnd` and `nextIdx` as integers and exposes them via
`getEmittedQueueCount()` and `getLastEmittedIdx()` — there is no
second derivation path.

`clampedSeedEnd` survives because it serves a distinct purpose
(previewing the simulator's choice before construction), but it
is now defined so the simulator literally calls it for its own
`seedEnd` computation. The two paths share one function; they
cannot disagree by construction. The helper also floors the
cursor internally, so a fractional sub-pixel UI coordinate
produces the same integer in both places.

22 new tests in `__tests__/replay.test.ts` cover the `seedEnd`
integer path including the 22/15 float-drift case, an arbitrary
`(n, anchor)` sweep against `clampedSeedEnd`, out-of-range clamping
to `SEED_RATIO_MIN/MAX`, the fractional-cursor floor case
(`clampedSeedEnd(C, 10.9) === 10`), the `NaN`/`undefined`/non-
numeric fallback to the 60% default (silent-failure guard), the
±Infinity boundary clamps, empty-candle preview equality
(`clampedSeedEnd([], any) === 0` matching `sim.seedCandles.length`),
the `getLastEmittedIdx()` empty-array sentinel (`-1`), and a
**property test** that exhaustively asserts `clampedSeedEnd(C,
cursor) === createLiveSimulator({candles: C, seedEnd: cursor})
.seedCandles.length` for 9 candle shapes × 18 cursor values (162
combinations) — including degenerate inputs like `NaN`,
`±Infinity`, and empty `C`. If any drift remains, this property
test catches it.

Empty / degenerate inputs are explicitly handled rather than left
as undefined behavior:

- `clampedSeedEnd([], …)` returns `0` (matching the simulator's
  zero-bar seed) instead of the previous `1`.
- `sim.getLastEmittedIdx()` returns `-1` on empty candles —
  sentinel for "no bar emitted yet". A host slicing
  `candles.slice(0, idx + 1)` gets the correct empty array
  instead of pointing at a phantom `candles[0]`.

Bundle: replay subpath 935 B (limit 3 kB).

### Added — `chart.removeAllPrimitives()` helper

A new method on `ChartInstance` drops every primitive registered via
`registerPrimitive` in one call. Intended for the common host pattern
of swapping in an unrelated candle dataset (different symbol,
timeframe, file upload, etc.) — primitives capture `(time, price)`
coordinates at registration and don't auto-invalidate, so they would
otherwise keep rendering at the previous data's coordinates against
the new view.

This matches the documented host-driven primitive lifecycle (see
`connectPricePatterns` JSDoc and the new COOKBOOK recipe) and the
behavior of other charting libraries (TradingView Lightweight Charts,
Highcharts annotations, etc.); the chart still does not auto-remove
primitives in `setCandles`, but the helper gives the cleanup pattern
a named API so hosts don't have to track every handle individually.

- `setCandles` JSDoc now documents the lifecycle gotcha explicitly.
- `simple-chart` example fixed: enabling SMC / Wyckoff / Regime
  Heatmap / S/R Confluence / Session Zones on the daily view and
  then toggling Simulate (which calls `setCandles(simHistory)`) used
  to carry the daily-anchored primitives onto the 1-min simulation
  view, drawing at meaningless coordinates. The example now calls
  `removeAllPrimitives()` before each `setCandles` transition.

Renderers, series, drawings, and indicators are not affected by the
new helper.

### Added — `markers` option on scalar line series for "discrete-per-bar" affordance

`SeriesConfig.markers?: boolean | { radius?: number; color?: string }`
draws a filled circle at each bar's value point on **scalar line
series** (i.e. `Series<number>` such as SMA, EMA, RSI, CCI). This
makes it visually obvious that the underlying data is one value
per bar and the line connecting consecutive points is just linear
interpolation — particularly useful for backtest signal
interpretation, where the cross's visual x-position can land
mid-candle on slope-asymmetric crossings.

- `markers: true` → default radius 2.5 px, filled with the series color
- `markers: { radius: 4, color: "#fff" }` → custom override
- Auto-skipped when `barSpacing < 5 px` to avoid the dots smearing
  into a solid mass at high zoom-out
- No-op on multi-channel series (`band`, MACD, Stochastics, etc.)
  by design — those would clutter at high marker count and don't
  share the "where does the line really cross?" ambiguity

### Fixed — axis label "0.00000000" overflow on oscillator panes

For oscillator-style indicators (QStick, CCI, ROC, etc.) the visible
range is symmetric around zero. `PriceScale.getTicks` was generating
the tick array by accumulating `v += niceStep` in a loop, which
drifts after several iterations: what should be exactly 0 lands at
~1e-16, and `autoFormatPrice` then renders that drifted value as
"0.00000000" (8 decimals) — visibly overflowing the axis label area
and colliding with neighbouring ticks.

`PriceScale.getTicks` now computes ticks as integer multiples of
`niceStep` (`m * niceStep` for each integer `m` in the visible
range), so the 0 tick lands at exactly 0. A small upward tolerance
on the upper-bound floor handles the case where the max lands
exactly on a step boundary but the divided quotient lands at
`n - ε`. The lower bound stays strict (no downward tolerance) so
ranges whose endpoints are merely near a step boundary don't
generate ticks outside the visible range. Each computed tick is
also bounds-checked before being emitted as a final guard against
multiplicative FP drift.

### Fixed — chart now tracks `window.devicePixelRatio` across resizes

The main `createChart` instance previously cached
`window.devicePixelRatio` once at construction and never refreshed it.
When the user dragged the browser window between displays of
different DPR (e.g. an external 1× monitor ↔ a 2× Retina laptop
display) or changed OS scaling mid-session, the canvas internal
resolution stayed at the original DPR — the chart kept rendering at
1× resolution on a 2× display, producing visibly blurry output.

`_setSize` now re-reads `window.devicePixelRatio` on every resize
when no explicit `options.pixelRatio` was pinned at construction.
The pinned override path is unchanged — callers that supply
`pixelRatio` keep full control. Sparkline already re-read DPR each
frame and is unaffected.

### Fixed — sparkline hardens its device-pixel-ratio guard

The sparkline canvas setup resolved `window.devicePixelRatio` with a
truthiness check (`dpr ? dpr : 1`), which correctly falls back to `1`
for `0` / `NaN` / `undefined` but let `±Infinity` and negative values
through. Multiplying the CSS size by such a ratio yielded a non-finite
or negative canvas bitmap dimension. The main chart already clamped to
a finite positive ratio; both paths now share a single
`safeDevicePixelRatio()` helper, so the sparkline falls back to `1`
for those degenerate ratios as well. This is a defensive hardening —
real browsers report a small positive ratio.

### Fixed — non-finite value guards across render and layout paths

Canvas silently swallows draw calls with `NaN` / `±Infinity`
coordinates, which means a single contaminated value previously
produced an invisible primitive with no error. A code audit
surfaced four spots where non-finite inputs could leak through:

- `series/candlestick.ts` — candles with `NaN` / `±Infinity` in
  any of `open` / `high` / `low` / `close` are now skipped instead
  of issuing draw calls with NaN coords. Adjacent candles are
  unaffected.
- `renderer/overlay-renderer.ts` — same guard applied to the
  multi-timeframe candle overlay, plus `latestNumber` /
  `latestInArray` (used by the last-value badge labels) now treat
  `NaN` / `±Infinity` as missing. Previously these would have been
  passed to `valueFormatter`, rendering the literal string "NaN"
  inside a series badge.
- `core/layout.ts` — when every pane has `flex: 0` (or any other
  shape that sums to `0`), `recompute` now normalizes each pane's
  flex to `1` in place so the layout both renders AND stays
  interactive. The previous code produced `NaN` heights that
  propagated through every downstream pixel coordinate; an
  intermediate fix that only normalized the divisor would have
  left `resizePanes()` unable to make progress (divider drag would
  immediately revert because the underlying `flex` values were
  still `0`).
- `core/scale.ts` — `priceToY` now returns `NaN` explicitly when
  `price` is non-finite, instead of relying on the `1e-10` floor
  (which doesn't protect against `NaN` input because
  `Math.max(NaN, x) === NaN`). The behavior change is documented;
  callers that already guard the result are unaffected.

Six new unit tests cover the guard paths.

### Added — `@trendcraft/chart/replay` subpath

- New `createLiveSimulator(opts)` export at `@trendcraft/chart/replay`.
  Drives a `createLiveCandle` instance from a static candle array on a
  timer, splitting each pending candle into N intra-candle ticks
  before the final `candleComplete`. Useful for any chart host that
  wants to demo / dogfood `connectIndicators({ live })` and
  `connectLivePrimitives` without a real market feed.
- API: `play()`, `pause()`, `stepOnce({ wholeBar? })`,
  `setIntervalMs(ms)`, `reset()`, `onChange(cb)`, `dispose()`. Plus
  the `live` LiveSource that plugs straight into the connect APIs.
- Lifted from `examples/indicator-showcase` and
  `examples/strategy-studio`, where the same code was duplicated. Both
  examples now re-export from the canonical location. ~3 kB
  brotli-compressed.
- **Note**: this subpath imports `createLiveCandle` from `trendcraft`,
  so consumers using `@trendcraft/chart/replay` must install
  `trendcraft` alongside `@trendcraft/chart`. The chart's main entry
  stays standalone-capable; only `replay` (and existing `presets`)
  need the optional peer.

<!-- draft -->
<!-- - session gap rendering (ChartOptions.timeScale.sessionGaps, TimeScale.setGapsBefore) -->
<!-- - autoFormatTime shows date anchor after large time jumps within the same local day -->

### Added

- **`@trendcraft/chart/sparkline` subpath** — ultra-lightweight mini chart for watchlist-style UIs (200+ instances on a single page). Vanilla `createSparkline` / `createSparklineGroup`, plus `@trendcraft/chart/react/sparkline` and `@trendcraft/chart/vue/sparkline` thin wrappers. Supports both `line` (with optional fill) and `candle` modes, four color presets (`first-vs-last`, `open-vs-close`, `baseline`, `fixed` / per-candle `up`/`down`), and a single-listener delegated hover with a shared tooltip across all sparklines in a group. Vanilla bundle ≈ 2.5 kB brotli; React/Vue ≈ 3 kB. New example at `examples/sparkline-showcase/`.

### Changed

- Bundle size budgets raised (brotli) to absorb the new plugin
  enhancements and `connectLivePrimitives`. The headless budget is
  unchanged; per-feature subpaths (`sparkline`, `replay`) carry their
  own limits.

  | Entry | 0.2.0 limit | Unreleased limit |
  | --- | --- | --- |
  | Main (`@trendcraft/chart`) | 36 kB | **41 kB** |
  | Headless (`@trendcraft/chart/headless`) | 11 kB | 11 kB |
  | React (`@trendcraft/chart/react`) | 30 kB | **33 kB** |
  | Vue (`@trendcraft/chart/vue`) | 30 kB | **33 kB** |

### Not in this release

- Intraday session gap rendering (weekend/overnight visual gaps for minute data) — tracked for v0.3.
- C1 coverage 90% target — viewport / canvas-chart / drawing-tool DOM integration tests have low ROI; addressed incrementally.
- Plugin live-mode integration is now available via `connectLivePrimitives` (see Unreleased above); the differentiation plugins are no longer static-only.

## [0.2.0] - 2026-04-26

### Added — UX pass

- **Crosshair snap modes** via `ChartOptions.crosshair`:
  - `"normal"` (default) — current behavior, time-index snap only
  - `"magnet"` — y snaps to the active bar's close
  - `"magnetOHLC"` — y snaps to the nearest of O/H/L/C within `snapThreshold` pixels
- **Readable crosshair labels** — price/time label text color is now chosen via WCAG relative luminance of the crosshair background, so custom themes remain legible without manual tuning. New helper `pickReadableTextColor` exposed internally.
- **Wheel/trackpad pan inertia** — flick gestures decelerate via the shared inertia loop instead of stopping dead on the last event. Opt out with `interaction: { wheelInertia: false }`. Note: on macOS the trackpad has its own OS-level momentum scroll that keeps sending wheel events for a few hundred ms after the user lifts their fingers — those are indistinguishable from user input and are always processed; this option only governs the synthetic tail we add once OS momentum is done.
- **Escape cancels** every transient interaction (drag, both inertia loops, long-press crosshair lock, and any in-progress drawing tool) in one press.
- **Keyboard shortcuts** on focused canvases: `Alt+H` hline, `Alt+V` vline, `Alt+T` trendline, `Alt+F` fib retracement, `Alt+C` channel, `Ctrl+Alt+H` hide/show every series, `Escape` cancel. Customize or disable via `ChartOptions.hotkeys`. Matching uses `KeyboardEvent.code` so Option+letter combos on macOS resolve correctly despite the altered character output. Passing `hotkeys: false` now disables every keyboard interaction — including the pre-existing viewport nav keys (arrows / `+` / `-` / `Home` / `End` / `F`) — so a single flag hands all keyboard handling back to the host.
- **`chart.setCrosshair(time)`** — programmatic crosshair control for external consumers that want to drive the crosshair without a DOM pointer event.
- **`visibleRangeChange` event** is now actually emitted (was declared but unused). Fires when the visible range changes.

### Added — last-value badges

- **`ChartOptions.showSeriesBadges`** — opt-in. When enabled, every labeled series gets a colored pill on the right price axis showing its latest value, mirroring the existing candle current-price badge. Multi-channel series (Bollinger Bands / MACD / etc.) get one pill per decomposed channel, each in its own `channelColors[channel]`. The volume pane also gets a pill colored by the last bar direction. Tick labels that would collide with a pill are suppressed; pills stacked on the same axis are shifted upward to clear each other and skipped if a shift would push them off the pane. Default: `false`.
- **`ChartOptions.seriesBadgeMode`** — `"absolute"` (default) shows the data array's latest non-null value (live / streaming "current" value). `"visible"` shows the latest non-null value within the current visible range — useful when scrolling back through history.
- **`PriceAxisOptions.excludeYRanges`** (headless) — a list replaces the singular `excludeY` / `excludeHalfHeight` fields so multiple foreground labels can be avoided by the tick placer. The old single-range fields remain supported for back-compat.

### Fixed

- **Decimation alignment** — at low zoom (`barSpacing < 1 px`, e.g. Fit-content on a large dataset) candles and number-series indicators used three different decimation paths that disagreed on x-coordinates, so overlays (SMA / RSI / EMA / …) drifted left of the bars they were supposed to annotate. All three paths now share the original `timeScale` coordinate space via bucket-origin indices carried through the render pipeline.
- **Right price-axis label overlap** — with many stacked panes the right-side tick labels crowded together and the current-price badge could overlap neighboring ticks. The axis now picks a tick density from pane height, suppresses labels within a half-label of pane edges, and skips ticks that would collide with the current-price badge Y on the main pane.
- **Info + legend overlap** — when many indicators were active the top-left OHLC/indicator readout grew past the top-right legend button row. The legend is now placed on its own second row, and the info strip gets a max-width + ellipsis safety net.
- **Indicator color cycling on re-add** — removing and re-adding an indicator (for example when a showcase / alpaca-demo panel applies a parameter change) would assign the next palette slot instead of the one just vacated, so colors appeared to "change on events". Auto-assigned colors now prefer the first palette entry not currently in use.
- **Scrollbar thumb jumps to cursor on grab** — pressing anywhere on the thumb recentered the visible range on the pointer; now press-on-thumb records the grab offset so the thumb stays pinned where grabbed, while press-on-track still page-jumps.

### Breaking

- `decimateCandles(candles, start, end, maxBars)` now returns `{ candles, originalIndices: Int32Array }` instead of `CandleData[]`. Exposed via `@trendcraft/chart/headless`.
- `lttb(data, targetCount)` now returns `{ points, originalIndices: Int32Array }` instead of `DataPoint[]`, and accepts an optional 3rd `indexOffset` argument to shift `originalIndices` into the caller's coordinate space. Exposed via `@trendcraft/chart/headless`.

### Changed

- Bundle size budgets raised (brotli) to absorb the UX pass and last-value badges. The new limits are expected to hold through the 0.2.x line; future feature work either lives on a sub-path or compensates with equivalent reductions elsewhere.

  | Entry | 0.1.0 limit | 0.2.0 limit |
  | --- | --- | --- |
  | Main (`@trendcraft/chart`) | 31 kB | **36 kB** |
  | Headless (`@trendcraft/chart/headless`) | 11 kB | 11 kB |
  | React (`@trendcraft/chart/react`) | 27 kB | **30 kB** |
  | Vue (`@trendcraft/chart/vue`) | 27 kB | **30 kB** |

### Internal

- Seed infrastructure for multi-chart synchronization (`ViewportState.crosshairFractional` / `crosshairTime`, fractional time emission on `visibleRangeChange`, programmatic `setCrosshair(time)`). Not exported from any public entry point yet — cross-timeframe viewport sync proved trickier than the surface API suggests, so it's held back until the UX is tuned.

## [0.1.0] - 2026-04-20

Initial public release.

### Added

- Canvas-based financial charting library with zero runtime dependencies.
- Main entry (`@trendcraft/chart`): `createChart`, `connectIndicators` (unified static + live wiring).
- Headless entry (`@trendcraft/chart/headless`): `DataLayer`, `TimeScale`, `PriceScale`, `introspect`, `lttb`.
- React wrapper (`@trendcraft/chart/react`): `TrendChart` component and `useTrendChart` hook.
- Vue wrapper (`@trendcraft/chart/vue`): `TrendChart` component and `useTrendChart` composable.
- Preset indicators entry (`@trendcraft/chart/presets`).
- 13 series types: candlestick, line, area, histogram, band, cloud, marker, heatmap, arrow, signal, zone, labels, shapes.
- Plugin system: `defineSeriesRenderer`, `definePrimitive`.
- Auto-detection of TrendCraft `Series<T>` indicators via `introspect` (reads `__meta` set by core's `tagSeries`).
- Drawing auto-injection helpers: `addAutoFibRetracement`, `addAutoFibExtension`, `addAutoTrendLine`, `addAutoChannelLine`. Consume pre-computed swing anchors and emit the chart's built-in drawing types — no primitive plugin required. Keeps the chart package runtime-free of `trendcraft`.
- `createAndrewsPitchfork` / `connectAndrewsPitchfork` — primitive plugin that renders the three parallel pitchfork lines from three swing anchors (P0 + P1 + P2). Extends forward indefinitely across the visible range.
- `connectSmcLayer` now accepts an optional `choch` source alongside `bos`. Both use the same per-bar shape but render with separate labels ("BOS" vs "CHoCH"), so you can feed `breakOfStructure()` and `changeOfCharacter()` simultaneously to distinguish structural breaks from trend-reversing ones.
- `createVolumeProfile` / `connectVolumeProfile` — primitive plugin that renders a horizontal volume-by-price histogram along the right edge of the chart, with separate fills for the Value Area and a dashed POC line spanning the pane. Configurable strip width (fractional or pixel), highlight toggle, and color overrides.
- `createSqueezeDots` / `connectSqueezeDots` — primitive plugin that renders TTM-style squeeze dots along the bottom of the price pane: red dot per active-squeeze bar, green dot at each release. Consumes `bollingerSqueeze()` output (or any compatible `{ time }`-keyed signal list).
- SSR safety: headless exports work without a DOM; DOM exports throw a clear error in non-browser environments.
- ARIA accessibility support via `ChartAria`.
- Bundle size limits enforced via `size-limit` (brotli): main ≤ 31 kB, headless ≤ 11 kB, React ≤ 27 kB, Vue ≤ 27 kB.

### Changed

- `buildSeriesConfig` now uses `meta.label` as-is instead of wrapping it with `(params.period)`. Core v0.2.0 emits parameterized labels (`"SMA(20)"` etc.) directly, so the extra wrap would have produced `"SMA(20)(20)"`.
- Drop fixed `color` preset for the moving-average family (SMA / EMA / WMA / VWMA / KAMA / HMA / T3 / McGinley / DEMA / TEMA / ZLEMA / ALMA / FRAMA) in `registerTrendCraftPresets`. Multi-instance MA setups (e.g. 5/20/60 ribbon) now pick up distinct auto-cycled colors from the chart palette. Callers that want a specific color for one instance can still pass `color` via `SeriesConfig`.

### Peer dependencies

- `trendcraft` (optional, `>=0.2.0`) — enables auto-detection of indicator series and powers `connectIndicators` via `livePresets` / `indicatorPresets` / `createLiveCandle`.
- `react` (optional, `>=19.0.0`) — required only when using the React wrapper.
- `vue` (optional, `>=3.3.0`) — required only when using the Vue wrapper.

[0.2.0]: https://github.com/sawapi/trendcraft/releases/tag/chart-v0.2.0
[0.1.0]: https://github.com/sawapi/trendcraft/releases/tag/chart-v0.1.0
