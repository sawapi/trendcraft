# @trendcraft/chart — Plugin Guide

The chart exposes two plugin surfaces:

| Type | What it is | When to reach for it |
|---|---|---|
| **Series renderer** | A new series type with its own rendering logic | "I need to draw Renko / Point&Figure / a custom candle style" |
| **Pane primitive** | A free-form overlay on a pane (not tied to a data series) | "I want to draw support zones / session backgrounds / a watermark per pane" |

Both plugins are plain objects you register on the chart instance. No build step, no magic discovery — the chart just calls your `render` function every frame.

## Table of Contents

- [Quick comparison](#quick-comparison)
- [Series renderer plugin](#series-renderer-plugin)
- [Pane primitive plugin](#pane-primitive-plugin)
- [`DrawHelper` API](#drawhelper-api)
- [Render context reference](#render-context-reference)
- [Lifecycle](#lifecycle)
- [Patterns and idioms](#patterns-and-idioms)
- [Packaging a plugin](#packaging-a-plugin)

---

## Quick comparison

```
Data flow                                   Ownership
────────────────────────────────────────    ─────────────────────────────
SeriesRendererPlugin:                       Plugin owns: render, price range,
  user passes data via addIndicator →       tooltip format
  chart decomposes → plugin renders         Chart owns: the data, layout,
                                            auto-scaling, tooltip orchestration

PrimitivePlugin:                            Plugin owns: state, render
  plugin defines defaultState → chart       Chart owns: pane layout, z-order,
  calls render(state) every frame           canvas lifecycle
```

- Pick a **series renderer** when you want per-bar data flowing through the standard `addIndicator` API and the chart to auto-scale around it.
- Pick a **primitive** when you have a logically flat overlay (zones, bands, markers) that doesn't map cleanly onto a series.

Many of TrendCraft's built-in visualizations (`addBacktest`, `addPatterns`, `addScores`, the regime heatmap, the SMC layer) are primitives.

## Series renderer plugin

Minimal example — a Renko-style block renderer:

```typescript
import { defineSeriesRenderer } from '@trendcraft/chart';

type RenkoBar = { time: number; value: { open: number; close: number } };

const renkoRenderer = defineSeriesRenderer<{ color?: string }>({
  type: 'renko',
  render: ({ draw, series, theme }, config) => {
    const data = series.data as RenkoBar[];
    const color = config.color ?? theme.upColor;

    for (let i = draw.startIndex; i <= draw.endIndex; i++) {
      const bar = data[i];
      if (!bar) continue;
      const up = bar.value.close >= bar.value.open;
      draw.rect(
        i - 0.4,
        up ? bar.value.close : bar.value.open,
        0.8,
        up ? bar.value.open : bar.value.close,
        { color: up ? theme.upColor : theme.downColor },
      );
    }
  },
  priceRange: (series, start, end) => {
    let min = Infinity, max = -Infinity;
    const data = series.data as RenkoBar[];
    for (let i = start; i <= end; i++) {
      const bar = data[i];
      if (!bar) continue;
      min = Math.min(min, bar.value.open, bar.value.close);
      max = Math.max(max, bar.value.open, bar.value.close);
    }
    return [min, max];
  },
  formatValue: (series, index) => {
    const bar = (series.data as RenkoBar[])[index];
    return bar ? `Renko ${bar.value.close.toFixed(2)}` : null;
  },
});

chart.registerRenderer(renkoRenderer);
chart.addIndicator(renkoData, { type: 'renko', pane: 'main' });
```

### Fields

| Field | Type | Required | Purpose |
|---|---|---|---|
| `type` | `string` | Yes | Unique type name. Must not collide with built-ins (`line`, `area`, `histogram`, `band`, `cloud`, `marker`, `box`, `heatmap`). |
| `render` | `(ctx, config) => void` | Yes | Draw the series. Called once per frame for the visible range. |
| `priceRange` | `(series, start, end) => [min, max]` | No | Auto-scale hint. If omitted, the chart falls back to reading `value` as a scalar or numeric channels. |
| `formatValue` | `(series, index) => string \| null` | No | Tooltip formatter. If omitted, the chart uses the default compound formatter. |
| `init` | `() => void` | No | Called once when `registerRenderer` is invoked. Rarely needed. |
| `destroy` | `() => void` | No | Called on `chart.destroy()`. Release any external resources here. |

### Implementation tips

- **Use `DrawHelper` methods.** `draw.rect`, `draw.line`, `draw.circle`, `draw.text` handle coordinate conversion and look good across zoom levels. Drop to raw `ctx` only when you need effects the helper doesn't expose.
- **Loop from `draw.startIndex` to `draw.endIndex`.** These are the visible bar indices. Rendering outside this range is wasted work.
- **Don't mutate `series.data`.** It's shared with the chart's internal cache.
- **Don't call `ctx.save()` without `ctx.restore()`.** Prefer `draw.scope(fn)` to avoid leaks.

## Pane primitive plugin

Minimal example — support/resistance zones overlaid on the main pane:

```typescript
import { definePrimitive } from '@trendcraft/chart';

type SrState = { zones: { price: number; strength: number; kind: 'support' | 'resistance' }[] };

const srZones = definePrimitive<SrState>({
  name: 'srZones',
  pane: 'main',
  zOrder: 'below',  // render before series — zones look like a background
  defaultState: { zones: [] },
  render: ({ draw, theme, pane }, state) => {
    for (const zone of state.zones) {
      const color = zone.kind === 'support' ? theme.upColor : theme.downColor;
      const alpha = 0.1 + zone.strength * 0.3;

      draw.scope((ctx) => {
        ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        const y = draw.y(zone.price);
        ctx.fillRect(0, y - 4, pane.width, 8);
      });

      draw.hline(zone.price, { color, lineWidth: 1, dash: [4, 2] });
    }
  },
});

chart.registerPrimitive(srZones);
```

To update the primitive's state after registration, call `registerPrimitive` again with the same `name` — the chart replaces the state. Or use the update function:

```typescript
const myPrim = definePrimitive<MyState>({
  name: 'myPrim',
  pane: 'main',
  zOrder: 'above',
  defaultState: initialState,
  update: (state) => ({ ...state, tick: state.tick + 1 }),  // called before every frame
  render: (ctx, state) => { /* ... */ },
});
```

### Fields

| Field | Type | Required | Purpose |
|---|---|---|---|
| `name` | `string` | Yes | Unique identifier. Used by `chart.removePrimitive(name)`. |
| `pane` | `string` | Yes | Target pane: `'main'`, a specific pane id, or `'all'` to render on every pane. |
| `zOrder` | `'below' \| 'above'` | Yes | Render order relative to series. `'below'` = backgrounds, `'above'` = annotations. |
| `defaultState` | `TState` | Yes | Initial state object. The chart holds a mutable reference. |
| `render` | `(ctx, state) => void` | Yes | Draw the primitive. Called once per frame per matched pane. |
| `update` | `(state) => state` | No | Optional state transform called before each render. Return a new state to replace the current one. |
| `destroy` | `() => void` | No | Called on `chart.destroy()`. |

### Pane matching

- `pane: 'main'` — renders only on the price pane.
- `pane: 'volume'` — renders only on the volume pane.
- `pane: '<custom-id>'` — renders on the pane with that exact id.
- `pane: 'all'` — renders on every pane, with a fresh `PrimitiveRenderContext` per pane (so `ctx.priceScale`, `ctx.pane` reflect the current pane).

## `DrawHelper` API

`draw` is available on both `SeriesRenderContext` and `PrimitiveRenderContext`. It wraps coordinate math and common canvas patterns.

### Coordinate conversion

```typescript
draw.x(index: number): number     // bar index → x pixel
draw.y(price: number): number     // price → y pixel
draw.startIndex                   // visible range start (readonly)
draw.endIndex                     // visible range end (readonly)
draw.barSpacing                   // pixels per bar (readonly)
```

### Primitive shapes

```typescript
draw.line(values, { color, lineWidth?, dash? })
// Draw a polyline over an array indexed by bar. Null entries break the line.

draw.hline(price, { color, lineWidth?, dash? })
// Full-pane-width horizontal line at `price`.

draw.rect(index, priceTop, widthBars, priceBottom, { color }, stroke?)
// Filled (optionally stroked) rectangle in index/price space.

draw.fillBetween(upper, lower, { color })
// Fill area between two value arrays. Handles null gaps.

draw.circle(index, price, radius, { color })
// Filled circle at the given bar/price.

draw.text(label, index, price, { color?, font?, align?, baseline? })
// Text at the given bar/price.
```

### Scoped state

```typescript
draw.scope((ctx) => {
  ctx.globalAlpha = 0.5;
  ctx.filter = 'blur(2px)';
  ctx.fillRect(x, y, w, h);
});
// ctx state (alpha, filter, transform, etc.) is restored on exit.
```

Prefer `draw.scope` over manual `ctx.save() / ctx.restore()` — a bug where you forget `restore()` will corrupt every subsequent paint.

### Raw canvas

`ctx` is always available on the context if you need methods `DrawHelper` doesn't cover:

```typescript
render: ({ ctx, draw, theme }) => {
  // DrawHelper for the common case
  draw.line(values, { color: theme.text });

  // Raw canvas for the unusual one
  ctx.createRadialGradient(/* ... */);
}
```

## Render context reference

### `SeriesRenderContext`

```typescript
type SeriesRenderContext = {
  ctx: CanvasRenderingContext2D;
  series: InternalSeries;       // id, data, config, channels
  timeScale: TimeScale;         // low-level scale (draw.x wraps this)
  priceScale: PriceScale;       // low-level scale (draw.y wraps this)
  dataLayer: DataLayer;         // global data model (rarely needed in plugins)
  paneWidth: number;
  theme: ThemeColors;
  draw: DrawHelper;
};
```

### `PrimitiveRenderContext`

```typescript
type PrimitiveRenderContext = {
  ctx: CanvasRenderingContext2D;
  pane: PaneRect;               // { id, x, y, width, height, config }
  timeScale: TimeScale;
  priceScale: PriceScale;
  dataLayer: DataLayer;
  theme: ThemeColors;
  draw: DrawHelper;
};
```

Access `pane.width` / `pane.height` in primitives when you want pane-relative layout (e.g., positioning a watermark or a legend).

## Lifecycle

```
registerRenderer(plugin)
  → plugin.init?.()                    [once]
  → (each frame that pane is painted)
    → plugin.render(context, config)
  → chart.destroy()
    → plugin.destroy?.()               [once]
```

```
registerPrimitive(plugin)
  → (each frame)
    → state = plugin.update?.(state) ?? state
    → plugin.render(context, state)
  → removePrimitive(name) or chart.destroy()
    → plugin.destroy?.()               [once]
```

`init` and `destroy` are for external resources (event listeners on `window`, audio workers, etc.). Plain object state lives in the closure or `defaultState` — you don't need `init` for that.

## Patterns and idioms

### Primitive with external state

If your primitive's state comes from outside the chart (e.g., a reactive store), keep a reference in the closure and read from it in `render`. The chart calls `render` every frame, so changes show up on the next tick.

```typescript
let currentZones: Zone[] = [];

const srZones = definePrimitive({
  name: 'srZones',
  pane: 'main',
  zOrder: 'below',
  defaultState: {},
  render: ({ draw }) => {
    for (const zone of currentZones) draw.hline(zone.price, { color: '#FF9800' });
  },
});

// Update externally
export function setZones(zones: Zone[]) { currentZones = zones; }
```

The built-in `connectRegimeHeatmap`, `connectSmcLayer`, etc. use this pattern — they return a handle that lets you push new state without re-registering.

### Connect-style helpers

Wrap your primitive or renderer in a `connect*` function that both registers it and returns an update-only API:

```typescript
export function connectMyPrim(chart: ChartInstance, initial: MyState) {
  let state = initial;
  const plugin = definePrimitive({
    name: 'myPrim',
    pane: 'main',
    zOrder: 'below',
    defaultState: initial,
    render: (ctx) => { render(ctx, state); },
  });
  chart.registerPrimitive(plugin);
  return {
    update(next: MyState) { state = next; },
    disconnect() { chart.removePrimitive('myPrim'); },
  };
}
```

This keeps call sites clean and hides registration details.

### Avoiding per-frame allocation

`render` runs up to 60 times per second. Allocations in the hot path create GC pressure and cause frame drops on mid-range hardware.

```typescript
// ✗ bad — allocates a new array every frame
render: ({ draw, series }) => {
  const values = series.data.map(d => d.value);  // allocation
  draw.line(values, { color: '#fff' });
}

// ✓ good — precompute or cache
const valuesCache = new WeakMap<InternalSeries, number[]>();
render: ({ draw, series }) => {
  let values = valuesCache.get(series);
  if (!values || values.length !== series.data.length) {
    values = series.data.map(d => d.value);
    valuesCache.set(series, values);
  }
  draw.line(values, { color: '#fff' });
}
```

For series renderers, the chart internally caches decomposed channels — use `series.channels.get(name)` instead of mapping `series.data` yourself.

### Defensive rendering

Early-out when there's nothing to draw:

```typescript
render: ({ draw }, state) => {
  if (state.zones.length === 0) return;
  // ...
}
```

The chart doesn't skip `render` for empty state — that's your responsibility.

## Packaging a plugin

If you're building a reusable plugin package:

1. Export both the plugin factory and a `connect*` helper.
2. Keep `@trendcraft/chart` as a peer dependency, not a runtime one.
3. Only use exports from the main entry (`@trendcraft/chart`) or `@trendcraft/chart/headless` — don't reach into `src/` paths.
4. Ship types. Plugin consumers rely on `SeriesRendererPlugin<TConfig>` and `PrimitivePlugin<TState>` generics for safety.

Example package structure:

```
my-plugin/
├── package.json         # peer: @trendcraft/chart, no runtime deps
├── src/
│   ├── index.ts         # export createMyPlugin, connectMyPlugin
│   ├── state.ts         # state type + update logic
│   └── render.ts        # render function
└── tsconfig.json
```

```typescript
// src/index.ts
import { definePrimitive, type PrimitivePlugin } from '@trendcraft/chart';
export { connectMyPlugin } from './connect';
export type { MyState } from './state';

export function createMyPlugin(): PrimitivePlugin<MyState> {
  return definePrimitive({ /* ... */ });
}
```

For reference, TrendCraft's own shipped plugins (`regime-heatmap`, `smc-layer`, `wyckoff-phase`, `sr-confluence`, `trade-analysis`, `session-zones`) follow this pattern. They live in `packages/chart/src/plugins/` and export both the factory and connect helper from the main entry.
