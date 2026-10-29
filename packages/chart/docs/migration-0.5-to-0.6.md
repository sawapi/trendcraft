# Migrating @trendcraft/chart 0.5.x → 0.6.0

0.6.0 has five breaking changes. Two of them change what a chart shows
without throwing: a method whose optional feature is not registered only
warns and does nothing, and `addBacktest` draws no equity curve unless the
result carries the engine's curve. This
page covers all five:

- [Code you must change](#code-you-must-change)
- [What you will see differently](#what-you-will-see-differently)
- [Requirements](#requirements)
- [Index](#index), with a link to each [CHANGELOG](../CHANGELOG.md) entry.

`trendcraft` 0.6.0 has breaking changes of its own; see its
[migration guide](../../core/docs/migration-0.5-to-0.6.md).

## Code you must change

### 1. Register the optional features you use

**Most likely to affect you.** Drawing tools, the backtest display, markers
and scores moved out of the core bundle into `@trendcraft/chart/features`.
A chart that never uses them no longer ships their code: when the change
landed, the main bundle went from about 44.3 kB to about 41 kB (brotli).

| Register function | Enables |
|---|---|
| `registerDrawingTools(chart)` | `addDrawing`, `setDrawingTool`, the drawing hotkeys (`Alt+H` / `Alt+V` / `Alt+T` / `Alt+F` / `Alt+C` by default), and the drawing auto-injection helpers (`addAutoFibRetracement` and the rest) |
| `registerBacktest(chart)` | `addBacktest`, `addPatterns` |
| `registerMarkers(chart)` | `addSignals`, `addTrades` |
| `registerScores(chart)` | `addScores` |
| `registerAll(chart)` | all of the above |

Without its feature, a method does not throw. It warns once per feature,
emits an `error` event with the code `FEATURE_NOT_REGISTERED`, and does
nothing. The auto-injection helpers return `null`. A drawing hotkey is
ignored silently. So a missing registration shows up as a missing drawing,
marker or backtest pane, not as a crash.

Steps:

1. Find the calls in the table above, and the React/Vue props that use them:
   `signals`, `trades`, `drawings`, `backtest`, `patterns` and `scores`.
2. Register the matching features right after the chart is created, or call
   `registerAll(chart)` to keep 0.5's behaviour. `registerAll` adds about
   4.5 kB back.
3. If drawings or the drawing hotkeys stopped working, register the drawing
   feature: it is the one most often used implicitly.

**Vanilla:**

```ts
import { createChart } from "@trendcraft/chart";
import { registerBacktest, registerMarkers } from "@trendcraft/chart/features";

const chart = createChart(container);
registerBacktest(chart);
registerMarkers(chart);

// Optional: surface a feature you forgot to register
chart.on("error", (e) => {
  if (e.code === "FEATURE_NOT_REGISTERED") console.warn(e.message);
});
```

To keep everything as in 0.5:

```ts
import { createChart } from "@trendcraft/chart";
import { registerAll } from "@trendcraft/chart/features";

const chart = createChart(container);
registerAll(chart);
```

**React:** pass the register functions as the `features` prop of
`<TrendChart>`, or as the `features` option of `useTrendChart`.

```tsx
import { registerBacktest } from "@trendcraft/chart/features";
import { TrendChart } from "@trendcraft/chart/react";

export function BacktestChart() {
  return <TrendChart candles={candles} backtest={backtestResult} features={[registerBacktest]} />;
}
```

**Vue:** the same, as the `:features` prop or the `features` option of
`useTrendChart`.

```vue
<script setup lang="ts">
import { registerBacktest } from "@trendcraft/chart/features";
import { TrendChart } from "@trendcraft/chart/vue";

const features = [registerBacktest];
</script>

<template>
  <TrendChart :candles="candles" :backtest="backtestResult" :features="features" />
</template>
```

`features` is read when the chart is created; changing the array later has
no effect.

[CHANGELOG entry](../CHANGELOG.md#breaking--drawing-tools-backtest-display-markers-and-scores-are-optional-features)

### 2. `addBacktest`: pass the engine's result as it is

The equity pane used to draw a curve rebuilt from the trades, by compounding
each trade's `returnPercent` over the whole account. With partial
take-profits it overstated the result (one run ended at 162,093 against the
engine's 115,939), and with position sizing it drew the full-capital curve.
`addBacktest` now draws `result.equityCurve`, the per-candle equity
`runBacktest` computes, placed on the candles from `result.firstBarTime`.

Without a usable curve, no curve is drawn. A result with no `equityCurve` or
no `firstBarTime`, or a curve that does not line up with the loaded candles,
gets the trades and the summary only, and a one-time warning with the error
code `NO_EQUITY_CURVE`.

Steps:

1. Pass the `runBacktest` (or `runBacktestScaled`) result unchanged. It
   carries `equityCurve`, `firstBarTime` and `lastBarTime`.
2. Load the candles the backtest ran on.
3. If you build the result yourself, add `equityCurve` and `firstBarTime`.

```ts
import { createChart } from "@trendcraft/chart";
import { registerBacktest } from "@trendcraft/chart/features";
import { deadCrossCondition, goldenCrossCondition, runBacktest } from "trendcraft";

const chart = createChart(container);
registerBacktest(chart);
chart.setCandles(candles);

const result = runBacktest(candles, goldenCrossCondition(5, 25), deadCrossCondition(5, 25), {
  capital: 100_000,
});
chart.addBacktest(result);
```

A result without a per-bar curve, such as
`applyEquityCurveFilter(...).filtered`, shows no curve.

Drawdown shading now follows the drawn curve, so `drawdownPeriods` is no
longer read and is optional in `BacktestResultData`.

[CHANGELOG entry](../CHANGELOG.md#breaking--addbacktest-draws-the-engines-equity-curve-or-none)

### 3. Vue: `@click` receives `ChartClickData`

`@click` on the Vue `<TrendChart>` used to fall through to the container
`<div>` and receive a DOM `MouseEvent`. The component now emits `click`
itself, with `ChartClickData`: `{ x, y, index, time }` and the modifier keys
`shiftKey`, `altKey`, `metaKey` and `ctrlKey`. It fires only for clicks the
drawing tool does not consume.

Fields such as `e.clientX` are now `undefined`, and a handler typed
`(e: MouseEvent) => void` no longer type-checks under `vue-tsc` (TS2322). Read
`data.x` / `data.y` (relative to the chart), or listen on an element wrapping
the component for the raw DOM event. React is unaffected.

```vue
<script setup lang="ts">
import type { ChartClickData } from "@trendcraft/chart";
import { TrendChart } from "@trendcraft/chart/vue";

// 0.5: function onClick(e: MouseEvent) { console.log(e.clientX, e.clientY); }
function onClick(data: ChartClickData) {
  if (data.index !== null) console.log(data.index, data.x, data.y);
}
</script>

<template>
  <TrendChart :candles="candles" @click="onClick" />
</template>
```

[CHANGELOG entry](../CHANGELOG.md#breaking--vue-trendchart-click-receives-the-charts-click-not-a-dom-event)

### 4. React/Vue: wrapper callbacks take the chart's payloads

The wrappers declared `onError` as `(data: { source; error }) => void`, and
`onSeriesAdded` / `onSeriesRemoved` as `(data: SeriesInfo) => void`. The
chart never emitted those shapes, so those fields were always `undefined`.
The callbacks now take `ChartErrorPayload` (`{ message, code?, detail? }`),
`SeriesAddedData` (`{ id, label }`) and `SeriesRemovedData` (`{ id }`). Code
that read `e.source`, `e.error`, `s.paneId`, `s.type` or `s.visible` no
longer compiles.

```tsx
import { TrendChart } from "@trendcraft/chart/react";

declare function report(message: string, code?: string): void;

export function ReportingChart() {
  return (
    <TrendChart
      candles={candles}
      // 0.5: onError={(e) => report(e.source, e.error)}
      onError={(e) => report(e.message, e.code)}
      onSeriesAdded={(s) => console.log(s.id, s.label)}
    />
  );
}
```

An `error` event from a series renderer or primitive that throws now has a
`message`, the code `RENDER_ERROR`, and `detail: { source, error }`
([CHANGELOG](../CHANGELOG.md#fixed--error-events-from-a-renderer-that-throws-had-no-message)).

[CHANGELOG entry](../CHANGELOG.md#breaking--reactvue-wrapper-event-callbacks-are-typed-as-the-charts-own-payloads)

## What you will see differently

No code change is needed for these.

- **Fractional volume.** The info overlay shows volumes under 1,000 with 3
  significant digits ("0.3", "12.5") instead of rounding them to whole
  numbers. 999.6 reads "1.0K"
  ([CHANGELOG](../CHANGELOG.md#fixed--fractional-volume-below-1000-was-rounded-to-a-whole-number)).
- **Daily bars show a date only.** The crosshair label leaves the time off
  daily and coarser bars, as the time axis already did. The default zone is
  still the browser's, so west of UTC a daily bar stamped at 00:00 UTC is
  labelled with the previous day. For such data set `timeZone: "UTC"`; see
  [Time zones](./API.md#time-zones)
  ([CHANGELOG](../CHANGELOG.md#fixed--the-crosshair-showed-a-time-on-daily-bars),
  [`timeZone` option](../CHANGELOG.md#added--timezone-option)).
- **Supertrend gaps.** `trendcraft`'s Supertrend has no direction until price
  first breaks a band. The chart leaves those bars blank instead of drawing a
  downtrend
  ([CHANGELOG](../CHANGELOG.md#fixed--a-supertrend-with-no-direction-yet-is-not-drawn-as-a-downtrend)).
- **PF ∞.** A backtest with no losing trade shows "PF: ∞", also after a JSON
  round trip turned `Infinity` into `null`
  ([CHANGELOG](../CHANGELOG.md#fixed--a-backtest-with-no-losing-trade-shows-pf-)).
- **DPO preset.** The `dpo` preset of `trendcraft`'s `indicatorPresets` draws
  the causal line by default. Pass `centered: true` in its params for the
  classic centered line; its instance name then gains a `c` (`dpo20c`).
- **Partly loaded backtests.** Trades beyond the loaded candles are not
  drawn, and the equity curve and summary stop at the last loaded candle
  ([CHANGELOG](../CHANGELOG.md#fixed--trades-beyond-the-loaded-candles-no-longer-pile-up-at-the-right-edge)).

## Requirements

`engines.node` is now `>=22.0.0` (was `>=18.0.0`). Node.js 18 and 20 have
reached end of life. On Node.js 20 or older most package managers warn when
installing, and some refuse (yarn 1, or npm and pnpm with `engine-strict`).
Nothing in the package itself changed.

[CHANGELOG entry](../CHANGELOG.md#breaking--requires-nodejs-22-or-later)

## Index

All five breaking changes are covered above:

- [Optional features](../CHANGELOG.md#breaking--drawing-tools-backtest-display-markers-and-scores-are-optional-features): [step 1](#1-register-the-optional-features-you-use)
- [`addBacktest` draws the engine's equity curve, or none](../CHANGELOG.md#breaking--addbacktest-draws-the-engines-equity-curve-or-none): [step 2](#2-addbacktest-pass-the-engines-result-as-it-is)
- [Vue `@click` payload](../CHANGELOG.md#breaking--vue-trendchart-click-receives-the-charts-click-not-a-dom-event): [step 3](#3-vue-click-receives-chartclickdata)
- [Wrapper callback typing](../CHANGELOG.md#breaking--reactvue-wrapper-event-callbacks-are-typed-as-the-charts-own-payloads): [step 4](#4-reactvue-wrapper-callbacks-take-the-charts-payloads)
- [Node.js 22](../CHANGELOG.md#breaking--requires-nodejs-22-or-later): [Requirements](#requirements)

New in 0.6.0 and useful when upgrading:

- [The React/Vue wrappers forward every chart event](../CHANGELOG.md#added--reactvue-wrappers-forward-every-chart-event) (`onClick`, `onVisibleRangeChange`, …).
- [Event handlers receive their event's payload type](../CHANGELOG.md#added--event-handlers-receive-their-events-payload-type), so `chart.on()` handlers need no cast.
