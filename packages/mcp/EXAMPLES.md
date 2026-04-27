# @trendcraft/mcp — Recipes

Concrete patterns for using the eight tools together. Examples assume an MCP client (Claude Desktop, Claude Code, Cursor, ...) with `trendcraft` configured per the [README](./README.md). Candles are illustrative — supply real OHLCV from your data source.

## Conventions

OHLCV candles look like this throughout:

```jsonc
[
  { "time": 1700000000000, "open": 100.0, "high": 101.5, "low": 99.5, "close": 100.8, "volume": 1_200_000 },
  // ...
]
```

`time` is a unix epoch in milliseconds. `volume` is optional but required for volume-based indicators (`obv`, `mfi`, `cvd`, `volume*` signals, ...).

---

## 1. Discover what fits the situation

If you don't know which indicator to reach for, start from the regime instead of the catalogue.

```ts
suggest_indicators_for_regime({ regime: "ranging" })
// → manifests for indicators tagged for ranging markets
//   (Bollinger Bands, Stochastics, RSI, Choppiness Index, ...)
```

Then drill into one to see how to use it:

```ts
get_indicator_manifest({ kind: "bollingerBands" })
// → { kind, displayName, whenToUse[], signals[], pitfalls[],
//     synergy[], paramHints, marketRegime[], timeframe[] }
```

Use `format_manifest_markdown` to embed the manifest into a downstream agent prompt as a single Markdown blob.

---

## 2. Compute one indicator on a window of candles

The default `lastN: 200` keeps the response inside MCP token budgets. Pass `lastN: 0` to get the full series, or a small number when you only need the most recent reading.

```ts
calc_indicator({
  kind: "rsi",
  candles,                      // 60+ daily bars recommended for RSI(14)
  params: { period: 14 },
  lastN: 5
})
```

Output:

```jsonc
{
  "kind": "rsi",
  "totalLength": 80,
  "count": 5,
  "truncated": true,
  "series": [
    { "time": 1768000000000, "value": 52.3 },
    { "time": 1768086400000, "value": 49.1 },
    { "time": 1768172800000, "value": 45.4 },
    { "time": 1768259200000, "value": 39.7 },
    { "time": 1768345600000, "value": 38.5 }
  ]
}
```

`paramHints` from `get_indicator_manifest` tells you what each option does — but most indicators have a sensible default once you pass *any* params object. Always pass a `params: {}` (even empty) unless you've checked that the indicator doesn't require options.

---

## 3. Check whether a screening signal fired recently

This is the core multi-symbol screening pattern. For each symbol's candles, ask one question:

```ts
detect_signal({
  kind: "goldenCross",
  candles,
  params: { short: 5, long: 25 },
  lastN: 10        // only look at the most recent 10 bars
})
```

Read just `firedAt`:

```jsonc
{
  "kind": "goldenCross",
  "shape": "series",
  "totalLength": 80,
  "count": 10,
  "truncated": true,
  "output": [/* the underlying Series<boolean> for the 10-bar window */],
  "firedAt": []    // ← non-empty = signal fired in window
}
```

For multi-symbol screening:

> *"For each symbol in [A, B, C, D], call `detect_signal({ kind: 'goldenCross', candles: <symbol-candles>, lastN: 10 })` and return the symbols where `firedAt.length > 0`."*

The agent only needs to inspect `firedAt.length` — the full `output` array can be ignored, which is the screening efficiency win.

---

## 4. Discover what signals exist before composing a screen

`detect_signal` accepts ~12 kinds with very different param shapes. Before constructing a screen, enumerate them:

```ts
list_signals({})
// → [
//     { kind: "bollingerSqueeze",   shape: "events", oneLiner: "...", paramsHint: "..." },
//     { kind: "candlestickPatterns",shape: "series", oneLiner: "...", paramsHint: "..." },
//     { kind: "goldenCross",        shape: "series", oneLiner: "...", paramsHint: "..." },
//     { kind: "perfectOrder",       shape: "series", oneLiner: "...", paramsHint: "..." },
//     // ...
//   ]

list_signals({ shape: "events" })
// Narrow to the sparse-array signals: divergences, squeeze, volume*, ...
```

`paramsHint` is a one-line string showing the option signature with defaults — enough to construct a `detect_signal` call without a manifest round-trip.

---

## 5. Working with `series`-shape vs `events`-shape signals

The two shapes carry different output structure.

### `series` shape — one entry per bar

`goldenCross`, `deadCross`, `perfectOrder`, `candlestickPatterns`. The `output` array is parallel to the input candles (same length, same `time` values).

```jsonc
// goldenCross output element
{ "time": 1768259200000, "value": false }

// perfectOrder output element
{ "time": 1768259200000, "value": { "type": "bullish", "formed": false, /* ... */ } }

// candlestickPatterns output element
{ "time": 1768259200000, "value": {
  "patterns": [{ "name": "hammer", "direction": "bullish", "confidence": 70, "candleCount": 1 }],
  "hasBullish": true,
  "hasBearish": false
}}
```

`firedAt` for `series` shape contains the `time` of every bar where the signal "fired" — `value === true` for booleans, `value.formed === true` for `perfectOrder`, `value.patterns.length > 0` for `candlestickPatterns`.

### `events` shape — sparse list of triggers

`bollingerSqueeze`, `rsiDivergence`, `macdDivergence`, `obvDivergence`, `volumeBreakout`, `volumeAccumulation`, `volumeMaCross`, `volumeAboveAverage`. The `output` array contains only the bars where the signal fired, each with a kind-specific payload.

```jsonc
// bollingerSqueeze output element
{ "time": 1768259200000, "bandwidth": 0.034, "percentile": 3.2, /* ... */ }

// rsiDivergence output element
{ "time": 1768259200000, "type": "bullish", "rsiValue": 32.1,
  "priceLow": 245.5, "rsiLow": 32.1, /* ... */ }
```

`firedAt` for `events` shape is just the `time` of every event — equivalent to `output.map(e => e.time)`.

---

## 6. Combining indicators — synergy patterns

The manifest's `synergy` field hints at common pairings. The MCP doesn't compute combined judgements for you; the agent composes them.

Pattern: use ADX to gate trend-following vs mean-reversion strategies.

```ts
// Step 1 — read trend strength
calc_indicator({ kind: "dmi", candles, params: { period: 14 }, lastN: 1 })
// → series[-1].value = { plusDi, minusDi, adx }
//   ADX < 20 → choppy / ranging
//   ADX 20-25 → developing trend
//   ADX > 25 → strong trend

// Step 2 — pick the next probe based on regime
// If ADX > 25, follow the trend with a Supertrend / DMI alignment check.
// If ADX < 20, fall back to range-aware Bollinger / Stochastics signals.
```

Pattern: confirm a cross with volume.

```ts
// Did goldenCross fire recently?
detect_signal({ kind: "goldenCross", candles, lastN: 10 })

// Was the volume profile rising on / before the same bars?
detect_signal({ kind: "volumeAccumulation", candles, lastN: 10 })

// Cross-reference firedAt timestamps. A cross + accumulation overlap is
// a stronger setup than a cross alone (per the manifest's pitfalls — many
// crosses fail without volume confirmation).
```

---

## 6.5. Multi-indicator screen with `load_candles` (v0.2.0+)

When you fan out 5+ tools against the same candles, sending the bars inline on every call dominates token cost. `load_candles` caches the array in the session and returns an opaque `handle`; subsequent calls reference it via `candlesRef`.

```ts
// 1. Cache once.
const { handle } = load_candles({ candles, symbol: "BTC" })
// → { handle: "cdl_1_a8f2c1", count: 124, span: { from: ..., to: ... } }

// 2. Fan out — bars are transmitted exactly once total.
calc_indicator  ({ kind: "rsi",          candlesRef: handle, params: { period: 14 } })
calc_indicator  ({ kind: "atr",          candlesRef: handle, params: { period: 14 } })
calc_indicator  ({ kind: "macd",         candlesRef: handle, params: { fast: 12, slow: 26, signal: 9 } })
detect_signal   ({ kind: "goldenCross",  candlesRef: handle, params: { short: 5, long: 25 } })
detect_signal   ({ kind: "bollingerSqueeze", candlesRef: handle })
```

**Lifetime & limits.** Handles live for the duration of the stdio MCP process only — they are not persisted across restarts and not shared across sessions. Capacity is 50 handles per process; the oldest is silently evicted. If a `candlesRef` is stale you'll see `INVALID_HANDLE`; just call `load_candles` again — reload is cheap.

### Compact tuple form

When you'd rather inline the candles but want a smaller payload, use `candlesArray` (~40% smaller than the canonical object form because field names are not repeated per row):

```ts
calc_indicator({
  kind: "rsi",
  candlesArray: [
    [1714000000000, 100,   101, 99,  100.5, 1200],
    [1714003600000, 100.5, 102, 100, 101.5, 1300],
    // [time, open, high, low, close, volume?]
  ],
  params: { period: 14 },
})
```

`candlesArray` works on `load_candles`, `calc_indicator`, and `detect_signal`. You can also feed it into `load_candles` to obtain a handle without paying the object-form overhead first.

---

## 7. Token budgets

`detect_signal` and `calc_indicator` both default to `lastN: 200`. Tune by use case:

| Use case | `lastN` | Reason |
|---|---|---|
| Latest reading only | 1 | Most compact (single point + `firedAt`) |
| "Did it fire in the last week (daily)" | 5–10 | Enough window for `firedAt` semantics |
| Plotting / detailed inspection | 0 | Full series; can be 100s–1000s of entries |
| Default | 200 | Balanced for daily / hourly bars |

For multi-symbol screening (10s–100s of symbols), keep `lastN` small — even a 200-entry series × 50 symbols × 5 signals = 50,000+ JSON entries returned to the agent context. With `lastN: 5` and `firedAt`-only inspection, the same screen costs ~2 KB.

---

## 8. Error recovery

Every tool returns canonical `<CODE>: <message>` strings on failure. Common recovery patterns:

| Error | Action |
|---|---|
| `INVALID_INPUT: candles must contain at least 1 entry` | Verify the data source returned candles. |
| `INVALID_PARAMETER: indicator "sma" requires a params object — paramHints: ...` | Always pass `params: { period: ... }`. The error message inlines the manifest's `paramHints` in v0.2.0+; older clients can still call `get_indicator_manifest` for the same content. |
| `INVALID_HANDLE: candlesRef "cdl_..." is not in the session cache` | The handle was evicted (capacity 50, LRU) or the process restarted. Call `load_candles` again — it's cheap. |
| `INSUFFICIENT_DATA` | Increase the candles window — typical minimum is 2× the indicator's longest lookback. |
| `UNSUPPORTED_KIND` (calc) | The kind is documented but no calc wrapper yet. Use `list_indicators({ calcSupported: true })` to enumerate the calc-ready set. |
| `UNSUPPORTED_SIGNAL` (detect_signal) | Call `list_signals({})` to see registered kinds — the set is smaller than `calc_indicator`'s. |
| `UNKNOWN_KIND` (manifest) | The kind doesn't exist at all. Call `list_indicators({})` to find the closest match. |

---

## 9. Pairing with a data MCP

`@trendcraft/mcp` carries no data connector by design. A real workflow chains a data MCP into trendcraft via the agent:

> *"Use `<your-data-mcp>` to fetch the last 120 daily candles for AAPL, then call `calc_indicator({ kind: 'rsi', candles: <those candles>, params: { period: 14 }, lastN: 5 })`."*

Any MCP that returns JSON candles in the `{ time, open, high, low, close, volume? }` shape pairs cleanly. If the upstream uses a different field naming (e.g. `t/o/h/l/c/v`), the agent can transform inline before the trendcraft call.
