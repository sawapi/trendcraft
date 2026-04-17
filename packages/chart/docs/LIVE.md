# @trendcraft/chart — Live Data Guide

Wiring the chart to a real-time data source. Covers the full pipeline from a WebSocket trade stream through `createLiveCandle`, `connectIndicators`, and the chart's streaming APIs.

## Table of Contents

- [The pipeline at a glance](#the-pipeline-at-a-glance)
- [The pieces](#the-pieces)
- [Tick mode: trades in, candles and indicators out](#tick-mode-trades-in-candles-and-indicators-out)
- [Candle mode: pre-formed bars from a vendor](#candle-mode-pre-formed-bars-from-a-vendor)
- [`connectIndicators` — one API for static and live](#connectindicators--one-api-for-static-and-live)
- [`connectLiveFeed` — lower-level alternative](#connectlivefeed--lower-level-alternative)
- [Backfill and history](#backfill-and-history)
- [Dynamic indicator add / remove](#dynamic-indicator-add--remove)
- [Reconnect, pause, resume](#reconnect-pause-resume)
- [Common pitfalls](#common-pitfalls)

---

## The pipeline at a glance

```
  WebSocket (trades / candles)
            │
            ▼
  ┌─────────────────────────┐
  │  createLiveCandle       │  ← trendcraft (aggregation + incremental indicators)
  │   • addTick / addCandle │
  │   • incremental.*       │
  │   • events: tick,       │
  │     candleComplete      │
  └────────────┬────────────┘
               │
               ▼
  ┌─────────────────────────┐
  │  connectIndicators      │  ← @trendcraft/chart (wiring)
  │   (also handles         │
  │    static mode)         │
  └────────────┬────────────┘
               │
               ▼
          ChartInstance
```

The split is intentional: `trendcraft` owns the data math (aggregation, stateful indicators, snapshot); the chart owns rendering. The only thing that crosses the boundary is a duck-typed interface, so `createLiveCandle` is not a hard dependency.

## The pieces

| Piece | Package | Responsibility |
|---|---|---|
| `createLiveCandle` | `trendcraft` | Aggregates ticks into candles, runs incremental indicators, emits events |
| `livePresets` / `indicatorPresets` | `trendcraft` | Registries of incremental factories + metadata |
| `incremental.create*` | `trendcraft` | 160+ incremental indicator factories |
| `connectIndicators` | `@trendcraft/chart` | Wires a preset registry to a chart; handles backfill + live updates |
| `connectLiveFeed` | `@trendcraft/chart` | Lower-level: pipe raw `LiveCandle` events into chart series |
| `ChartInstance.updateCandle` | `@trendcraft/chart` | Append or patch the last candle |

You typically use `connectIndicators` and leave `connectLiveFeed` to framework authors.

## Tick mode: trades in, candles and indicators out

If your feed delivers individual trades and you want the chart to aggregate them into bars:

```typescript
import { createChart, connectIndicators } from '@trendcraft/chart';
import { createLiveCandle, indicatorPresets } from 'trendcraft';

const chart = createChart(container, { theme: 'dark' });
chart.setCandles(history);  // prime with historical bars

const live = createLiveCandle({
  intervalMs: 60_000,       // 1-minute bars
  history,                  // warm up indicators from historical data
  maxHistory: 2000,         // cap memory for long-running sessions
});

const conn = connectIndicators(chart, {
  presets: indicatorPresets,
  candles: history,
  live,
});
conn.add('rsi');
conn.add('sma', { period: 20 });
conn.add('bollingerBands');

// Wire your WebSocket
ws.on('trade', (t) => {
  live.addTick({ time: t.ts, price: t.px, volume: t.size });
});

// On shutdown
function cleanup() {
  conn.disconnect();
  chart.destroy();
  ws.close();
}
```

What happens each tick:

1. `live.addTick()` updates the current forming candle.
2. Every registered incremental indicator advances its state.
3. `live` emits a `tick` event with `{ candle, snapshot, isNewCandle }`.
4. `connectIndicators` hears the event and:
   - Calls `chart.updateCandle()` with the forming candle.
   - Patches each indicator series with the new snapshot value.
5. The chart marks itself dirty; the next animation frame repaints.

When the minute rolls over, `live` fires `candleComplete` and `connectIndicators` finalizes the last bar.

## Candle mode: pre-formed bars from a vendor

If your feed delivers already-aggregated bars (Alpaca minute bars, Polygon aggregates, etc.), skip the tick-level aggregation:

```typescript
const live = createLiveCandle({
  // No intervalMs — candle mode
  history: initialBars,
  maxHistory: 2000,
});

const conn = connectIndicators(chart, {
  presets: indicatorPresets,
  candles: initialBars,
  live,
});
conn.add('rsi');

// Closed bars
ws.on('bar', (bar) => {
  live.addCandle({
    time: bar.t,
    open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v,
  });
});

// Optional: forming bar updates (Alpaca minute-in-progress, etc.)
ws.on('bar-partial', (bar) => {
  live.addCandle({ /* ... */ }, { partial: true });
});
```

`{ partial: true }` tells `createLiveCandle` the candle is still forming — it won't be added to `completedCandles` and indicators will `peek` instead of `next`-ing their state.

## `connectIndicators` — one API for static and live

```typescript
connectIndicators(chart, options): IndicatorConnection
```

### Static mode (no `live` option)

```typescript
const conn = connectIndicators(chart, {
  presets: indicatorPresets,
  candles,  // required for static
});

conn.add('rsi');                       // uses defaultParams
conn.add('sma', { period: 20 });       // override params
conn.add('sma', { period: 50 });       // multiple instances of same preset
```

Indicators are computed once via `preset.compute()` and pushed to the chart.

### Live mode (with `live`)

```typescript
const conn = connectIndicators(chart, {
  presets: indicatorPresets,
  candles: history,  // for backfill
  live,              // enables streaming
  initHistory: true, // default — prime the chart with live.completedCandles too
});
conn.add('rsi');
```

Each `add` call:

1. Registers the incremental factory on `live`.
2. Backfills the series from `candles` (and optionally `live.completedCandles`).
3. Subscribes to `live.on('tick')` to push incremental updates to the chart.

### `IndicatorConnection` API

| Member | Description |
|---|---|
| `add(presetId, options?)` | Add an indicator. Returns `IndicatorHandle`. |
| `add(spec)` | Add using a pre-defined `IndicatorSpec` from `defineIndicator()`. |
| `remove(target)` | Remove by snapshot name, preset id (all matching), or handle. |
| `list()` | All active handles. |
| `listByPreset(id)` | Handles for a given preset id. |
| `get(snapshotName)` | Look up a single handle. |
| `recompute(candles)` | Re-run all indicators with new candle data (static mode). |
| `disconnect()` | Unsubscribe events and remove all indicators. Idempotent. |
| `connected` (readonly) | `true` until `disconnect()` is called. |
| `mode` (readonly) | `'static'` or `'live'`. |

### `IndicatorHandle` API

| Member | Description |
|---|---|
| `snapshotName` | Unique key for this instance (e.g. `'sma20'`). |
| `presetId` | The preset id used to build this instance. |
| `params` | Effective parameters (defaults merged with overrides). |
| `series` | Underlying `SeriesHandle` (escape hatch — most users ignore this). |
| `removed` | `true` once removed. |
| `setVisible(visible)` | Toggle visibility. |
| `remove()` | Remove this instance. Idempotent. |

Snapshot paths support dot notation: `'bb.upper'` resolves to `snapshot.bb.upper` inside the live event payload.

## `connectLiveFeed` — lower-level alternative

For cases where you already have your own indicator wiring and just want `LiveCandle` events to drive the chart's candles and pre-registered series:

```typescript
import { createChart, connectLiveFeed } from '@trendcraft/chart';

const chart = createChart(container);
chart.setCandles(history);
const rsi = chart.addIndicator(rsiBatch, { label: 'RSI' });

const disconnect = connectLiveFeed(chart, live, {
  presets: livePresets,
  // seriesMap: { rsi }, // optional explicit mapping
});

// Later
disconnect();
```

`connectLiveFeed` is what `connectIndicators` uses under the hood. Most apps don't need it directly.

## Backfill and history

The chart needs two pieces of history to draw correctly:

1. **Candle history** — for the main price series. Pass via `chart.setCandles(candles)`.
2. **Indicator history** — the chart doesn't recompute indicators from candles; you have to provide the backfill series.

`connectIndicators` does both automatically when you pass `candles`:

```typescript
connectIndicators(chart, {
  presets: indicatorPresets,
  candles,   // used for:
             //   1. preset.compute(candles, params) → backfill series
             //   2. chart.setCandles(candles) if initHistory and live.completedCandles is empty
  live,
});
```

For manual wiring, compute the backfill series yourself:

```typescript
chart.setCandles(candles);
const sma20Series = sma(candles, { period: 20 });  // from trendcraft
chart.addIndicator(sma20Series, { label: 'SMA 20' });

// Later, drive incremental updates from live
const sma20Incr = incremental.createSma({ period: 20 }, {
  fromState: sma(candles, { period: 20 })._state,  // if available
});
live.on('tick', ({ candle, snapshot }) => {
  // push the latest value to the chart series
});
```

The `connectIndicators` path is strongly recommended — this manual path is brittle across indicator updates.

## Dynamic indicator add / remove

Users toggling indicators at runtime is a common UI requirement. `IndicatorConnection` is built for it:

```typescript
// Check a checkbox
const handle = conn.add('macd');

// Uncheck it
handle.remove();
// or: conn.remove('macd')
// or: conn.remove(handle)

// Toggle visibility without removing
handle.setVisible(false);
handle.setVisible(true);
```

For presets where snapshot names depend on params (e.g. `sma` → `sma20`), the chart keys state by snapshot name. This means you can mount multiple instances of the same preset without collision:

```typescript
conn.add('sma', { period: 5 });   // snapshotName: 'sma5'
conn.add('sma', { period: 20 });  // snapshotName: 'sma20'
conn.add('sma', { period: 60 });  // snapshotName: 'sma60'
```

For presets with static snapshot names (e.g. `emaRibbon`), pass an explicit `snapshotName`:

```typescript
conn.add('emaRibbon', { periods: [8, 13, 21],  snapshotName: 'ribbon-short' });
conn.add('emaRibbon', { periods: [34, 55, 89], snapshotName: 'ribbon-long' });
```

## Reconnect, pause, resume

A WebSocket dies. The app needs to reconnect without losing state.

Approach A — save state on close, restore on reopen:

```typescript
let savedState = live.getState();

ws.on('close', () => { savedState = live.getState(); });
ws.on('open', () => {
  // restore
  live = createLiveCandle(options, savedState);
  conn = connectIndicators(chart, { presets: indicatorPresets, candles, live });
  for (const indicator of activeIndicators) conn.add(indicator.id, indicator.params);
});
```

This is correct but heavyweight — you rebuild the whole pipeline.

Approach B — keep `LiveCandle` alive, just reconnect the socket:

```typescript
// `live` persists across reconnects
ws = new WebSocket(url);
ws.on('trade', (t) => live.addTick(t));
```

This is usually what you want. `createLiveCandle` has no network I/O — it just accepts whatever you feed it. The chart and indicators keep running while the socket is down; they just don't get new data.

For gaps in the feed during a disconnect, request the missing history from your REST API and replay through `live.addCandle(bar)`.

## Common pitfalls

### Forgetting to call `conn.disconnect()` in cleanup

`disconnect()` unsubscribes event handlers on `live` and removes chart series. Skip it and you leak listeners + series on every route transition. The React / Vue wrappers handle this when the component unmounts — but if you wire the connection inside a `useEffect`, return a cleanup function that calls `disconnect()`.

### Expecting `live.completedCandles` to include `history`

`createLiveCandle`'s `history` option is for **warm-up context only** — it's used to advance the incremental indicators so they're not stuck in their warm-up period. It does **not** become part of `completedCandles`.

When `connectIndicators` sets up the chart, it uses `candles` for backfill **and** tries to prime the chart with `live.completedCandles` if non-empty. Be explicit about which source drives `setCandles()`.

### Re-using the same `live` across charts

One `LiveCandle` per data source; one chart per view. If you need the same data on two charts, register indicators on both via `connectIndicators` — they'll share the underlying `live` state.

### Forgetting to handle `partial: true`

If your vendor emits both partial and final bars, **only the final one** should be treated as closed. Flags on the call:

```typescript
live.addCandle(bar, { partial: true });   // forming — indicators peek
live.addCandle(bar);                       // closed — indicators advance
```

If you mix these up, you'll get indicators that "snap" when a partial is treated as closed, or that never advance when a close is treated as partial.

### Using `updateCandle` + `connectIndicators` simultaneously

`connectIndicators` calls `updateCandle` for you. If you're also calling it from your own `ws.on('trade')` handler, you'll get double-updates and drift. Pick one driver.
