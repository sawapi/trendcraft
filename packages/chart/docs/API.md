# @trendcraft/chart — API Reference

Complete API surface for `@trendcraft/chart`. This is the reference; for conceptual material see [GUIDE.md](./GUIDE.md). For live streaming patterns see [LIVE.md](./LIVE.md). For extending the chart see [PLUGINS.md](./PLUGINS.md).

## Entry Points

| Import from | Contents | Environment |
|---|---|---|
| `@trendcraft/chart` | `createChart`, `connectIndicators`, `connectLivePrimitives`, plugin helpers, plugins, all types | Browser only — throws in SSR |
| `@trendcraft/chart/headless` | `DataLayer`, `TimeScale`, `PriceScale`, `LayoutEngine`, `introspect`, `lttb`, formatters | Any (Node / SSR / tests) |
| `@trendcraft/chart/presets` | `registerTrendCraftPresets` — opt-in introspection rules + visual presets for TrendCraft-specific indicator shapes | Browser only |
| `@trendcraft/chart/sparkline` | `createSparkline`, `createSparklineGroup`, line/candle mini-chart renderers | Browser only |
| `@trendcraft/chart/replay` | `createLiveSimulator` — replay historical candles as a live feed | Any (Node / SSR / tests) |
| `@trendcraft/chart/react` | `TrendChart` component, `useTrendChart` hook | React 19+, browser only |
| `@trendcraft/chart/react/sparkline` | `Sparkline`, `SparklineList` React components | React 19+, browser only |
| `@trendcraft/chart/vue` | `TrendChart` component, `useTrendChart` composable | Vue 3.3+, browser only |
| `@trendcraft/chart/vue/sparkline` | `Sparkline`, `SparklineList` Vue components | Vue 3.3+, browser only |

## Table of Contents

- [`createChart(container, options?)`](#createchartcontainer-options)
- [`ChartOptions`](#chartoptions)
- [`ChartInstance`](#chartinstance)
  - [Data methods](#data-methods)
  - [Indicator methods](#indicator-methods)
  - [Overlay methods](#overlay-methods)
  - [Drawing methods](#drawing-methods)
  - [Viewport methods](#viewport-methods)
  - [Event methods](#event-methods)
  - [Theme and options methods](#theme-and-options-methods)
  - [Plugin methods](#plugin-methods)
  - [Export and lifecycle](#export-and-lifecycle)
- [`SeriesConfig`](#seriesconfig)
- [`SeriesHandle`](#serieshandle)
- [`Drawing` types](#drawing-types)
- [Event payloads](#event-payloads)
- [Connection APIs](#connection-apis)
  - [`connectIndicators`](#connectindicatorschart-options)
  - [`defineIndicator`](#defineindicatorpresetid-options)
  - [`connectLivePrimitives`](#connectliveprimitivessource-specs)
- [Drawing auto-injection helpers](#drawing-auto-injection-helpers)
- [Plugin helpers](#plugin-helpers)
- [Built-in plugins](#built-in-plugins)
- [Framework wrappers](#framework-wrappers)
  - [React](#react)
  - [Vue](#vue)
- [Headless API](#headless-api)
- [Introspection and presets](#introspection-and-presets)

---

## `createChart(container, options?)`

Creates a chart instance attached to a DOM element.

```typescript
function createChart(container: HTMLElement, options?: ChartOptions): ChartInstance
```

Throws in non-browser environments. For SSR setups, import from `@trendcraft/chart/headless` on the server and `@trendcraft/chart` on the client.

## `ChartOptions`

All fields optional.

| Option | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | container width | Chart width (px) |
| `height` | `number` | `400` | Chart height (px) |
| `theme` | `'dark' \| 'light' \| ThemeColors` | `'dark'` | Color theme |
| `pixelRatio` | `number` | `window.devicePixelRatio` | Canvas backing-store ratio (one-time; not runtime-mutable) |
| `priceAxisWidth` | `number` | `60` | Right axis width (px) |
| `timeAxisHeight` | `number` | `32` | Bottom axis height (px) |
| `fontFamily` | `string` | system UI stack | Font family for canvas axis/crosshair/overlay text and DOM legend/info overlays. Runtime-updatable via `applyOptions` |
| `fontSize` | `number` | `11` | Font size (px). Runtime-updatable via `applyOptions` |
| `priceFormatter` | `(price: number) => string` | auto-precision | Custom price formatter |
| `timeFormatter` | `(time: number) => string` | smart date/time | Custom time formatter |
| `watermark` | `string` | — | Background watermark text |
| `legend` | `boolean` | `true` | Show series legend |
| `volume` | `boolean` | `true` | Show volume pane |
| `scrollSensitivity` | `number` | `0.3` | Scroll/pan sensitivity multiplier (one-time; clamped to a minimum of 0.1) |
| `chartType` | `'candlestick' \| 'line' \| 'mountain' \| 'ohlc'` | `'candlestick'` | Base chart type |
| `formatInfoOverlay` | `(data: InfoOverlayData) => string \| null` | — | Custom info overlay HTML (one-time). Return `null` to use default. |
| `animationDuration` | `number` | `300` | Range transition duration (ms). `0` disables |
| `locale` | `Partial<ChartLocale>` | — | i18n string overrides (one-time) |
| `maxCandles` | `number` | — | Cap on retained candles in live mode |
| `crosshair` | `CrosshairOptions` | `{ mode: 'normal' }` | Crosshair snap behavior — see [Crosshair](#crosshair) |
| `hotkeys` | `HotkeyMap \| false` | built-in defaults | Keyboard shortcut bindings — see [Hotkeys](#hotkeys). Pass `false` to disable **all** keyboard handling (including viewport nav keys). (one-time) |
| `interaction` | `{ wheelInertia?: boolean }` | `{ wheelInertia: true }` | Trackpad/wheel inertia for pan + zoom. Disable to stop the synthetic deceleration tail (macOS OS-level momentum is independent and always processed). (one-time) |
| `showSeriesBadges` | `boolean` | `false` | Render a colored pill on the right price axis for each labeled series, mirroring the candle current-price badge. Multi-channel series get one pill per channel. |
| `seriesBadgeMode` | `'absolute' \| 'visible'` | `'absolute'` | `'absolute'` shows the latest non-null value in the data array (live "current" value). `'visible'` shows the latest non-null value within the current visible range. |
| `timeScale` | `TimeScaleOptions` | — | Time-scale behavior — see [Time scale](#time-scale). Runtime-updatable via `applyOptions` |

Options marked "one-time" cannot be changed via `applyOptions()` — a warning is emitted via the `error` event if you try, except `hotkeys` and `interaction`, which are currently ignored silently (no warning).

### Time scale

```typescript
type TimeScaleOptions = {
  sessionGaps?: boolean | SessionGapsOptions;
  rightOffset?: number;
};
```

`sessionGaps` inserts visual gaps between trading sessions (overnight breaks,
weekends) in intraday data instead of compressing non-trading hours to a
zero-width seam. `true` auto-detects gaps from the median bar interval; the
object form gives fine-grained control (`mode: 'timeGap' | 'dayBoundary' |
'off'`, `gapThresholdMs`, `intradayThresholdMs`, `sizeBars`).

`rightOffset` (default `0`) reserves that many bar-slots of empty space
between the last candle and the price axis, so the forming candle isn't drawn
flush against the right edge. Units are bar-slots (fractional allowed), so
the margin scales with zoom. The margin is maintained while following the
live edge and honored by `scrollToEnd`-style navigation (keyboard End
included), `fitContent()`, and duration presets. Values that would leave
fewer than 2 bars visible are capped; negative or non-finite values are
rejected with a warning.

### Crosshair

```typescript
type CrosshairOptions = {
  mode?: 'normal' | 'magnet' | 'magnetOHLC';
  snapThreshold?: number; // px, default 12, only used by 'magnetOHLC'
  lockOnLongPress?: boolean; // long-press crosshair lock on touch devices, default true
};
```

| Mode | Behavior |
|---|---|
| `'normal'` | Snaps to the bar time-index only; y follows the pointer. |
| `'magnet'` | y also snaps to the active bar's `close`. |
| `'magnetOHLC'` | y snaps to the nearest of `O`/`H`/`L`/`C` within `snapThreshold` pixels; otherwise y follows the pointer. |

The price/time label text color is chosen via WCAG relative luminance of the crosshair background, so custom themes remain legible.

### Hotkeys

```typescript
type HotkeyAction = DrawingType | 'cancel' | 'toggleOverlays';
// Keyed by KeyboardEvent.code combos; value = action.
type HotkeyMap = Partial<Record<string, HotkeyAction>>;
// Defaults: {
//   'Alt+KeyH': 'hline', 'Alt+KeyV': 'vline', 'Alt+KeyT': 'trendline',
//   'Alt+KeyF': 'fibRetracement', 'Alt+KeyC': 'channel',
//   'Ctrl+Alt+KeyH': 'toggleOverlays', 'Escape': 'cancel',
// }
```

Matching uses `KeyboardEvent.code`, so Option+letter on macOS resolves correctly despite the altered character output. `Alt` is treated the same as `Option`; `Ctrl` and `Cmd` are interchangeable. Pass `hotkeys: false` to disable every keyboard shortcut, including the pre-existing viewport nav keys (arrows / `+` / `-` / `Home` / `End` / `F`).

## `ChartInstance`

### Data methods

```typescript
setCandles(candles: CandleData[]): void
```
Replace all price data. Rebuilds internal caches.

```typescript
updateCandle(candle: CandleData): void
```
Append a new candle or patch the last one (matched by `time`). Use for streaming updates.

```typescript
batchUpdates(fn: () => void): void
```
Defer rendering until `fn` returns. All mutations inside are coalesced into a single frame.

### Indicator methods

```typescript
addIndicator<T>(series: DataPoint<T>[], config?: SeriesConfig): SeriesHandle
```
Add an indicator series. Auto-detects pane, type, and rendering style from `__meta` or value shape. Returns a `SeriesHandle` for later manipulation.

```typescript
getAllSeries(): SeriesInfo[]
```
Summary info for every registered series: `{ id, paneId, type, label, visible }`.

### Overlay methods

```typescript
addSignals(signals: SignalMarker[]): void
```
Draw buy/sell markers. `SignalMarker = { time, type: 'buy' | 'sell', label? }`.

```typescript
addTrades(trades: TradeMarker[]): void
```
Draw entry/exit markers with holding-period shading. `TradeMarker = { entryTime, entryPrice, exitTime, exitPrice, direction?, returnPercent?, exitReason? }`.

```typescript
addBacktest(result: BacktestResultData): void
```
Visualize a `trendcraft` `BacktestResult` — trade markers + equity curve sub-pane + summary bar.

```typescript
addPatterns(patterns: ChartPatternSignal[]): void
```
Draw pattern outlines (double top, head & shoulders, etc.) from `trendcraft`'s `PatternSignal[]`.

```typescript
addScores(scores: DataPoint<number | null>[]): void
```
Per-bar score heatmap (0 = red, 50 = yellow, 100 = green). Background-shaded onto the main pane.

### Drawing methods

```typescript
addDrawing(drawing: Drawing): void
removeDrawing(id: string): void
getDrawings(): Drawing[]
setDrawingTool(tool: DrawingType | null): void
```

`setDrawingTool(tool)` puts the chart into interactive-drawing mode — the next user click places a drawing of that type. `setDrawingTool(null)` exits.

### Viewport methods

```typescript
setVisibleRange(start: TimeValue, end: TimeValue): void
setVisibleRangeByDuration(duration: RangeDuration): void
setVisibleLogicalRange(from: number, to: number): void
getVisibleLogicalRange(): LogicalRange | null
fitContent(): void
getVisibleRange(): VisibleRangeChangeData | null
setLayout(config: LayoutConfig): void
```

`RangeDuration = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'`

`setVisibleLogicalRange(from, to)` sets the viewport in logical (bar-index)
units — `LogicalRange = { from, to }`. Values are fractional and may extend
beyond the data on either side, which is the one way to express empty space
past the last candle (times after the last bar all resolve to it, so
`setVisibleRange` cannot). While the last bar is visible, live updates
preserve the window's distance from the live edge — custom margins included.
The requested span is exact down to the render floor (0.1px per bar).

Logical indices address the *current* candle array: they are shifted by
`maxCandles` trimming and invalidated by `setCandles`. Read-modify-set
synchronously (pair with `getVisibleLogicalRange()`); never persist them.

```typescript
setCrosshair(time: number | null): void
```

Programmatic crosshair control. Pass an epoch-ms time to drive the crosshair from outside (e.g. multi-chart sync); pass `null` to clear.

### Multi-timeframe methods

```typescript
addTimeframe(overlay: TimeframeOverlay): void
removeTimeframe(id: string): void
```

Draws higher-timeframe candles as a semi-transparent overlay on the main pane.

### Event methods

```typescript
on<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void
off<E extends ChartEvent>(event: E, handler: (data: unknown) => void): void
```

See [Event payloads](#event-payloads).

### Theme and options methods

```typescript
setTheme(theme: 'dark' | 'light' | ThemeColors): void
setChartType(type: ChartType): void
setShowVolume(show: boolean): void
applyOptions(options: Partial<ChartOptions>): void
```

`applyOptions()` is the runtime equivalent of re-passing options to `createChart`. Fields that can't be changed after construction are ignored (see the option table above) and a warning fires via the `error` event.

### Plugin methods

```typescript
registerRenderer<TConfig>(plugin: SeriesRendererPlugin<TConfig>): void
registerPrimitive<TState>(plugin: PrimitivePlugin<TState>): void
removePrimitive(name: string): void
addRule(rule: IntrospectionRule): void
addPreset(name: string, preset: IndicatorPreset): void
```

See [PLUGINS.md](./PLUGINS.md) for plugin authoring details.

### Export and lifecycle

```typescript
toImage(type?: string, quality?: number, timeoutMs?: number): Promise<Blob>
resize(width: number, height: number): void
destroy(): void
```

`destroy()` is idempotent.

## `SeriesConfig`

| Field | Type | Description |
|---|---|---|
| `pane` | `'main' \| string` | Target pane id. Omit for auto-detection via `__meta`. Pass `'sub'` to auto-create a new sub-pane; any other custom string creates (or reuses) a pane with that id. |
| `scaleId` | `'left' \| 'right'` | Which scale to bind to (only relevant for dual-scale panes). Default `'right'`. |
| `type` | `SeriesType` | Override the auto-detected series type. |
| `color` | `string` | Primary color for the series. |
| `lineWidth` | `number` | Line width in pixels (default 1.5). |
| `label` | `string` | Legend label. Overrides `__meta.label`. |
| `visible` | `boolean` | Initial visibility (default `true`). |
| `maxHeightRatio` | `number` (0–1) | Cap series to this fraction of pane height. Useful for volume overlay. |
| `yRange` | `[number, number]` | Fixed Y-axis range (e.g. `[0, 100]`). Applied when a new pane is created. |
| `referenceLines` | `number[]` | Horizontal reference lines. Applied when a new pane is created. |
| `channelColors` | `Record<string, string>` | Per-channel colors for multi-channel series (`{ upper, middle, lower }`, etc.). |

## `SeriesHandle`

Returned by `addIndicator`. Keep the reference if you need to manipulate the series later.

```typescript
type SeriesHandle = {
  readonly id: string;
  readonly config: Readonly<SeriesConfig>;        // resolved config (read back auto-assigned color etc.)
  update(point: DataPoint<unknown>): void;       // streaming update — append or patch last point
  setData<T>(data: DataPoint<T>[]): void;         // replace all data
  setVisible(visible: boolean): void;
  remove(): void;                                  // idempotent
};
```

## `Drawing` types

`Drawing` is a discriminated union. Every drawing has `id`, `type`, and optional `color` / `lineWidth`.

| Type | Extra fields |
|---|---|
| `hline` | `price` |
| `trendline` | `startTime`, `startPrice`, `endTime`, `endPrice` |
| `ray` | same as trendline |
| `hray` | `time`, `price` |
| `vline` | `time` |
| `rectangle` | `startTime`, `startPrice`, `endTime`, `endPrice`, `fillColor?` |
| `channel` | `startTime`, `startPrice`, `endTime`, `endPrice`, `channelWidth`, `fillColor?` |
| `fibRetracement` | `startTime`, `startPrice`, `endTime`, `endPrice`, `levels?` |
| `fibExtension` | same as fibRetracement |
| `textLabel` | `time`, `price`, `text`, `fontSize?`, `backgroundColor?` |
| `arrow` | `startTime`, `startPrice`, `endTime`, `endPrice` |

All time values are epoch milliseconds.

## Event payloads

| Event | Payload shape |
|---|---|
| `crosshairMove` | `CrosshairMoveData = { time, index, ohlcv, paneId }` |
| `click` | `ChartClickData = { x, y, index, time, shiftKey, altKey, metaKey, ctrlKey }` |
| `visibleRangeChange` | `VisibleRangeChangeData = { startTime, endTime, startIndex, endIndex, logicalRange? }` — time/index fields are clamped to the data; `logicalRange: { from, to }` carries the unclamped fractional window edges (always populated; a right-edge margin is only visible here) |
| `resize` | `{ width: number, height: number }` |
| `paneResize` | `{ paneId: string, height: number }` |
| `seriesAdded` | `{ id: string, label: string }` |
| `seriesRemoved` | `{ id: string }` |
| `dataFiltered` | `{ total: number, valid: number, removed: number }` |
| `drawingComplete` | `Drawing` |
| `error` | `ChartErrorPayload = { message: string, code?: ChartErrorCode, detail?: unknown }` |

## Connection APIs

### `connectIndicators(chart, options)`

```typescript
function connectIndicators(
  chart: ChartInstance,
  options: ConnectIndicatorsOptions,
): IndicatorConnection
```

Unified indicator wiring for both static and live modes. See [LIVE.md](./LIVE.md#connectindicators--one-api-for-static-and-live) for the full walkthrough.

`ConnectIndicatorsOptions`:

| Option | Type | Default | Description |
|---|---|---|---|
| `presets` | `Record<string, IndicatorPresetEntry>` | `{}` | Indicator preset registry (duck-typed; compatible with `trendcraft`'s `indicatorPresets`). |
| `candles` | `readonly SourceCandle[]` | `[]` | Historical candles for backfill / static compute. |
| `live` | `LiveSource` | — | Live data source; enables streaming mode. |
| `initHistory` | `boolean` | `true` | Prime the chart with `live.completedCandles` on connect. |

`IndicatorConnection`:

| Method / Property | Description |
|---|---|
| `add(presetId, options?)` | Add by preset id. Returns `IndicatorHandle`. |
| `add(spec)` | Add using an `IndicatorSpec` from `defineIndicator()`. |
| `remove(target)` | Remove by snapshot name, preset id, or handle. |
| `list()` | All active handles. |
| `listByPreset(id)` | Handles for a given preset. |
| `get(snapshotName)` | Look up a single handle. |
| `recompute(candles)` | Re-run all indicators with new candle data. |
| `disconnect()` | Unsubscribe events and remove all indicators. Idempotent. |
| `connected` (readonly) | `true` until disconnected. |
| `mode` (readonly) | `'static'` or `'live'`. |

`IndicatorHandle`:

| Member | Description |
|---|---|
| `snapshotName` | Unique key for this instance. |
| `presetId` | Preset id used. |
| `params` | Effective parameters (defaults merged). |
| `series` | Underlying `SeriesHandle`. |
| `removed` | `true` once removed. |
| `setVisible(visible)` | Toggle visibility. |
| `remove()` | Remove this instance. Idempotent. |

### `defineIndicator(presetId, options?)`

Pre-define a reusable indicator spec:

```typescript
const sma5 = defineIndicator('sma', { period: 5 });
conn.add(sma5);
```

Useful when you want to pass indicator configurations around your app without coupling to a specific chart connection.

### `connectLivePrimitives(source, specs)`

```typescript
function connectLivePrimitives(
  source: LiveSource,
  specs: readonly LivePrimitiveSpec<any>[], // `any`, not `unknown`: per-spec T varies across the array, and `unknown` would force every handle.update to accept unknown, rejecting strongly-typed plugin handles like connectSrConfluence's
): LivePrimitivesConnection
```

Keep primitive plugins (S/R Zones, SMC, Wyckoff, Kill Zones, Regime Heatmap, etc.) in sync with a live feed. Primitives register via `chart.registerPrimitive()` rather than `addIndicator()`, so they are invisible to `connectIndicators`' live event loop. This helper recomputes each spec on `candleComplete` and pushes the result to the plugin handle's `update()` method (batch recompute — O(N) per completed candle).

```typescript
import { connectIndicators, connectLivePrimitives, connectSrConfluence } from '@trendcraft/chart';
import { srZones } from 'trendcraft';

const conn = connectIndicators(chart, { presets, candles, live: source });
// completedCandles is readonly — copy before passing to trendcraft's mutable-array APIs
const sr = connectSrConfluence(chart, srZones([...source.completedCandles]).zones);

const liveSr = connectLivePrimitives(source, [
  { recompute: (candles) => srZones([...candles]).zones, handle: sr, name: 'sr' },
]);

// later
liveSr.disconnect();
conn.disconnect();
```

`LivePrimitiveSpec`:

| Field | Type | Description |
|---|---|---|
| `recompute` | `(candles: readonly SourceCandle[]) => T` | Recompute the primitive's data from the current candle history. |
| `handle` | `LivePrimitiveHandle<T>` | Plugin handle (e.g. from `connectSrConfluence`) whose `update(data)` is called with the recomputed result. |
| `name` | `string` (optional) | Name used in error logs to identify which spec failed. |

`LivePrimitivesConnection`:

| Method | Description |
|---|---|
| `disconnect()` | Unsubscribe from `candleComplete` events. Idempotent. |
| `recomputeAll()` | Manually trigger a recompute of all specs — useful to seed handles right after construction. No-op once disconnected. |

## Drawing auto-injection helpers

Four TrendCraft indicators (`autoTrendLine`, `channelLine`, `fibonacciRetracement`, `fibonacciExtension`) produce shape data the chart already renders via its built-in drawing types. These helpers convert raw swing anchors into `Drawing` objects and attach them — no primitive plugin required.

Every helper takes pre-computed **swing anchors**, so the chart package stays runtime-free of `trendcraft`. Compose with `getAlternatingSwingPoints` (or any equivalent) on the caller side:

```typescript
import { getAlternatingSwingPoints } from 'trendcraft';
import {
  addAutoFibRetracement,
  addAutoFibExtension,
  addAutoTrendLine,
  addAutoChannelLine,
  type SwingAnchor,
} from '@trendcraft/chart';

// getAlternatingSwingPoints returns the SwingAnchor shape directly.
const anchors: SwingAnchor[] = getAlternatingSwingPoints(
  candles,
  10,  // last N alternating swings
  { leftBars: 10, rightBars: 10 },
);

addAutoFibRetracement(chart, anchors);              // picks latest high + latest low
addAutoFibExtension(chart, anchors);                // picks the last three alternating
addAutoTrendLine(chart, anchors, { line: 'resistance' });
addAutoTrendLine(chart, anchors, { line: 'support', extendToTime: nowMs });
addAutoChannelLine(chart, anchors, { extendToTime: nowMs });
```

| Helper | Drawing emitted | Anchors consumed |
|---|---|---|
| `addAutoFibRetracement` | `fibRetracement` | latest swing high + latest swing low |
| `addAutoFibExtension` | `fibExtension` | last three alternating swings (A→B projected, C ignored by chart) |
| `addAutoTrendLine` | `trendline` | last two same-type swings (highs → resistance, lows → support) |
| `addAutoChannelLine` | `channel` | last three alternating swings (two same-type as base, opposite for width) |

All helpers return the drawing id (so you can later `chart.removeDrawing(id)`), or `null` if insufficient anchors were supplied. `extendToTime` projects the line endpoint forward using the slope of the two base anchors.

Exported constants: `DEFAULT_FIB_RETRACEMENT_LEVELS`, `DEFAULT_FIB_EXTENSION_LEVELS`.

## Plugin helpers

```typescript
defineSeriesRenderer<TConfig>(plugin: SeriesRendererPlugin<TConfig>): SeriesRendererPlugin<TConfig>
definePrimitive<TState>(plugin: PrimitivePlugin<TState>): PrimitivePlugin<TState>
```

Identity functions that give you type inference. See [PLUGINS.md](./PLUGINS.md).

```typescript
declare class DrawHelper {
  x(index: number): number;
  y(price: number): number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly barSpacing: number;

  line(values: readonly (number | null)[], style: StrokeStyle): void;
  hline(price: number, style: StrokeStyle): void;
  rect(index: number, priceTop: number, widthBars: number, priceBottom: number,
       fill: FillStyle, stroke?: StrokeStyle): void;
  fillBetween(upper: readonly (number | null)[], lower: readonly (number | null)[],
              fill: FillStyle): void;
  circle(index: number, price: number, radius: number, fill: FillStyle): void;
  text(label: string, index: number, price: number,
       options?: { color?: string; font?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline }): void;
  scope(fn: (ctx: CanvasRenderingContext2D) => void): void;
}
```

## Built-in plugins

Tree-shakeable visualization primitives bundled with the library:

| Function | Description |
|---|---|
| `createRegimeHeatmap` / `connectRegimeHeatmap` | Background heatmap for market regimes (`trending`, `volatile`, etc.) |
| `createSmcLayer` / `connectSmcLayer` | Smart Money Concepts: order blocks, FVG, liquidity sweeps, BOS, CHoCH |
| `createWyckoffPhase` / `connectWyckoffPhase` | Wyckoff phase bands (accumulation, markup, etc.) |
| `createSrConfluence` / `connectSrConfluence` | Support/resistance confluence zones |
| `createTradeAnalysis` / `connectTradeAnalysis` | MFE/MAE, holding period, streak annotations for backtest results |
| `createSessionZones` / `connectSessionZones` | Session backgrounds (Asian/London/NY) |
| `createAndrewsPitchfork` / `connectAndrewsPitchfork` | Andrew's Pitchfork — median line + upper/lower handles from three swing anchors, extending forward |
| `createVolumeProfile` / `connectVolumeProfile` | Horizontal volume-by-price histogram along the right edge, with highlighted Value Area and dashed POC line |
| `createMarketProfile` / `connectMarketProfile` | TPO (Time Price Opportunity) market profile — per-price letter/block distribution with Value Area and POC |
| `createPricePatterns` / `connectPricePatterns` | Chart pattern outlines (double top/bottom, head & shoulders, triangles, etc.). `filterPricePatterns` narrows a `PricePatternSignal[]` set before connecting |
| `createSqueezeDots` / `connectSqueezeDots` | Bollinger/Keltner squeeze dots along the pane baseline |

Each `create*` returns a `PrimitivePlugin`; each `connect*` registers it and returns an update handle.

## Framework wrappers

### React

```typescript
import { TrendChart, useTrendChart } from '@trendcraft/chart/react';
```

**Component** — declarative API for typical use:

```tsx
<TrendChart
  candles={candles}
  indicators={[sma(candles, { period: 20 }), rsi(candles)]}
  backtest={backtestResult}
  theme="dark"
  onCrosshairMove={(data) => {}}
/>
```

Props mirror the `useTrendChart` options: `candles`, `indicators`, `signals`, `trades`, `drawings`, `timeframes`, `backtest`, `patterns`, `scores`, `plugins`, `chartType`, `layout`, `theme`, `fitOnLoad`, event handlers (`onCrosshairMove`, `onSeriesAdded`, `onSeriesRemoved`, `onError`), an `options` prop carrying the remaining `ChartOptions`, plus `style` / `className`. Expose the underlying `ChartInstance` via ref.

**Hook** — imperative access to `ChartInstance` for drawing tools, live feeds, custom plugins:

```tsx
function MyChart({ candles }: { candles: CandleData[] }) {
  const { containerRef, chart } = useTrendChart({ candles, theme: 'dark' });
  useEffect(() => {
    if (!chart) return;
    chart.setDrawingTool('hline');
  }, [chart]);
  return <div ref={containerRef} style={{ width: '100%', height: 400 }} />;
}
```

`chart` is `null` before mount, the live instance after — drops into `useEffect` deps cleanly.

### Vue

```typescript
import { TrendChart, useTrendChart } from '@trendcraft/chart/vue';
```

**Component** — same prop surface as React:

```vue
<TrendChart
  :candles="candles"
  :indicators="[sma(candles, { period: 20 }), rsi(candles)]"
  :backtest="backtestResult"
  theme="dark"
  @crosshairMove="onCrosshairMove"
/>
```

**Composable**:

```vue
<script setup>
const { containerRef, chart } = useTrendChart({
  candles: () => props.candles,
  theme: 'dark',
});
</script>
```

`chart` is a `ShallowRef<ChartInstance | null>`. **Do not** wrap it in `ref()` — Vue's deep reactivity proxy corrupts the chart's internal state. Option values accept plain values, refs, or getters (use a getter to make a prop reactive).

## Headless API

Available from `@trendcraft/chart/headless` — no DOM or Canvas dependency. Suitable for Node, SSR, tests, and custom renderers.

```typescript
import {
  DataLayer, TimeScale, PriceScale, LayoutEngine, Viewport,
  SeriesRegistry, RendererRegistry,
  DrawHelper,
  introspect, type IndicatorPreset, INDICATOR_PRESETS,
  lttb, decimateCandles, getDecimationTarget,
  autoFormatPrice, autoFormatTime, formatCrosshairTime, formatVolume,
  detectPrecision, fixedPriceFormatter,
  DARK_THEME, LIGHT_THEME,
  defineSeriesRenderer, definePrimitive,
} from '@trendcraft/chart/headless';
```

`connectIndicators` is **not** available in the headless entry — it orchestrates a live chart instance, which requires DOM.

### Key headless classes

| Class | Purpose |
|---|---|
| `DataLayer` | Holds candles + series. Internal mutation API. |
| `TimeScale` | Index ↔ pixel X conversion. Manages pan / zoom. |
| `PriceScale` | Price ↔ pixel Y. One per pane. |
| `LayoutEngine` | Computes pane rectangles from `LayoutConfig` + canvas size. |
| `Viewport` | Combines TimeScale / PriceScale / input handling. |
| `SeriesRegistry` | Introspection rules registry. Exported singleton `defaultRegistry`. |
| `RendererRegistry` | Custom series renderer registry (per chart instance in the DOM chart). |

### Introspection

```typescript
const result = introspect(myIndicatorData);
// {
//   seriesType: 'band',         // resolved visual type
//   rule: IntrospectionRule,    // matched rule (or null)
//   preset: IndicatorPreset,    // matched preset (or null)
//   pane: 'main' | 'sub' (or custom pane id),  // resolved pane hint
//   config: SeriesConfig,       // merged config
//   yRange?: [number, number],  // from __meta
//   referenceLines?: number[],  // from __meta
// }
```

Use `introspect()` to replicate the chart's auto-detection in custom code (e.g. building a legend UI or a server-side chart image renderer).

### Decimation

```typescript
lttb(data: readonly DataPoint<number | null>[], targetCount: number, indexOffset?: number): DecimatedPoints<number | null>
// Largest-Triangle-Three-Buckets downsampling. targetCount = target point count.

decimateCandles(candles: readonly CandleData[], startIndex: number, endIndex: number, maxBars: number): DecimatedCandles
// OHLC aggregation for candles.

getDecimationTarget(dataCount: number, pixelWidth: number, minPixelsPerPoint?: number): number
// Heuristic: one point per pixel column, with a floor.
```

### Formatters

```typescript
autoFormatPrice(price: number): string
autoFormatTime(time: number, prevTime: number | null, intervalMs?: number): string
formatCrosshairTime(time: number): string
formatVolume(vol: number): string
detectPrecision(values: number[]): number
fixedPriceFormatter(precision: number): (price: number) => string
```

## Introspection and presets

The chart uses a three-tier resolution path when deciding how to render a series:

1. **`__meta`** — if present, its `overlay`, `label`, `yRange`, `referenceLines` are authoritative.
2. **`SeriesRegistry` rules** — pattern-match the first non-null value shape to a series type (`line`, `band`, `cloud`, etc.).
3. **Indicator presets** — per-rule defaults for color, lineWidth, etc. Presets keyed by preset name.

### Adding custom rules

```typescript
chart.addRule({
  name: 'myShape',
  test: (value) => typeof value === 'object' && value !== null && 'a' in value && 'b' in value,
  seriesType: 'line',
  defaultPane: 'sub',
  decompose: (value) => ({ a: value.a, b: value.b }),
});
```

### Adding custom presets

```typescript
chart.addPreset('myShape', {
  color: '#FF9800',
  lineWidth: 2,
  pane: 'sub',
});
```

Presets override built-ins for the same name. Use this to re-skin built-in indicators without forking.

### TrendCraft preset bundle (`@trendcraft/chart/presets`)

```typescript
import { registerTrendCraftPresets } from '@trendcraft/chart/presets';

registerTrendCraftPresets(chart);
```

`registerTrendCraftPresets(chart)` is an opt-in helper that registers introspection rules **and** visual presets for TrendCraft-specific indicator output shapes — e.g. `klinger` `{ kvo, signal, histogram }`, `connorsRsi` `{ crsi, ... }`, `adaptiveRsi` `{ rsi, effectivePeriod, volatilityPercentile }`, `vsa`, `emaRibbon`, `fairValueGap` / `orderBlock` box zones, `fractals`, `heikinAshi`, and more. It also registers the custom renderers those shapes need (FVG / order-block zones, fractal markers, Heikin-Ashi overlay).

Generic shapes (band, MACD-like oscillators, plain numbers, etc.) are handled by the chart core, so this call is only needed when you feed it TrendCraft-specific indicator output. Without it those shapes fall through to generic rendering and may show no visible series. Call it once, right after `createChart`, before adding the affected indicators.
