# Migrating trendcraft 0.3.x → 0.4.0

The 0.4.0 release lands the **Indicator State Contract** — the largest
breaking change, affecting incremental-indicator persistence. It is
*not* the only breaking change: a second round of work reconciled the
backtest and streaming condition registries, which renamed a condition
param and changed several condition defaults (see
[Condition registry: renamed param + changed defaults](#condition-registry-renamed-param--changed-defaults)).
This page is the 5-minute upgrade guide: what broke and how to update
your code.

## What broke: incremental state snapshots

Every incremental indicator's `getState()` / `fromState` now uses a
versioned envelope instead of a bare state object:

```ts
type IndicatorSnapshot<TState> = {
  meta: { version: number; indicator: string; params: Record<string, unknown> };
  state: TState;
};
```

- `getState()` returns `IndicatorSnapshot<TState>` (was bare `TState`).
- `createXxx(options, { fromState })` expects an
  `IndicatorSnapshot<TState>` (was bare `TState`).

**Pre-0.4.0 snapshots cannot be resumed.** They have no `meta` field,
so `fromState` throws `<indicator>: incompatible snapshot, re-warm
required`. This applies equally to streaming session snapshots
(`createLiveCandle` / `createPipeline` / `createSession`).

## How to fix: re-warm

The fix is always the same — re-warm the indicator from candle
history instead of restoring the old snapshot:

```ts
let ind: ReturnType<typeof createSma>;
try {
  ind = createSma({ period: 20 }, { fromState: savedSnapshot });
} catch {
  // Pre-0.4.0 snapshot (or incompatible reconfig): re-warm.
  ind = createSma({ period: 20 });
  for (const candle of warmUpCandles) ind.next(candle);
}
```

For long-running streaming processes, replay recent candle history
through the rebuilt indicators on the first run after upgrading.
Session-level state (aggregator state, completed candles) is
unaffected — only the per-indicator snapshots inside a session blob
are incompatible.

## What is *not* affected by the State Contract

- **Strategy JSON** (`serializeStrategy` / `parseStrategy`) describes
  indicator *configurations*, not runtime state — the snapshot envelope
  does not touch it. (It *is* affected by the separate condition
  registry change below — see the next section.)
- **Non-incremental (batch) indicator functions** — `sma(candles)`,
  `ema(candles)`, etc. take candle arrays and have no state to
  persist — unchanged.

## After upgrading: reconfig on resume

Once you are on 0.4.0 envelopes, resume with *changed params* follows
the state category:

- **Windowed** (SMA, WMA, ALMA, Donchian, Pivot Points, …) — `period`
  change is supported via carry-forward; `source` change throws.
- **Recursive / Mixed / Cascaded** (EMA, ZLEMA, FRAMA, KAMA, MACD,
  DEMA, TEMA, HMA, and the structure trackers BOS, CHoCH, FVG,
  Liquidity Sweep, Swing Points, …) — any state-shaping param change
  throws.

The contract also defines an append-only **Event log** category, but
no 0.4.0 indicator is classified into it — the structure trackers that
look event-like keep a parameter-sized detection window, so they are
Mixed.

*Resume-invariant* params (those that only scale the state→output
projection, e.g. a band-width multiplier) may change on resume in any
category — the saved state is reused verbatim and the new value takes
effect immediately. `source` is never resume-invariant.

## Condition registry: renamed param + changed defaults

Separately from the State Contract, 0.4.0 reconciled the backtest and
streaming condition registries so that a portable `StrategyJSON`
behaves identically on both sides. This changed one **condition param
name** and several **condition defaults**. Unlike the State Contract,
this touches persisted `StrategyJSON` (which stores condition params),
not runtime snapshots.

### Breaking: `dmiBullish` / `dmiBearish` — `minAdx` renamed to `threshold`, default `20` → `25`

The backtest `dmiBullish` / `dmiBearish` conditions renamed their first
parameter from `minAdx` to `threshold` and raised its default from `20`
to `25` (Wilder's strong-trend level), aligning them with the streaming
registry, the shared `adxStrong` condition, and the direct factory
signatures (`dmiBullish(threshold = 25, period = 14)`).

A persisted `StrategyJSON` leaf using the old `minAdx` key is **not**
remapped — the unrecognized `minAdx` is silently ignored and the new
default (`25`) applies, so a strategy that relied on `minAdx: 20`
silently re-defaults to a stricter `25`. Migrate the JSON param:

```jsonc
// Before (0.3.x)
{ "name": "dmiBullish", "params": { "minAdx": 30 } }

// After (0.4.0) — rename the key, keep the value
{ "name": "dmiBullish", "params": { "threshold": 30 } }
```

If you relied on the old default behavior (`minAdx` omitted ⇒ `20`),
make it explicit on upgrade: `{ "params": { "threshold": 20 } }`.

### Behavior change: reconciled condition defaults

These shared conditions had drifted between the two registries and were
reconciled. Each value below is the new default that applies when the
param is **omitted** from a `StrategyJSON` leaf (the registry, the
streaming registry, and the direct factory now agree):

| Condition | Param | Old behavior | New default (0.4.0) |
| --- | --- | --- | --- |
| `cmfAbove` / `cmfBelow` | `threshold` | drifted | `0` (the CMF zero-line) |
| `priceDroppedAtr` | `multiplier` | drifted | `2.0` |
| `atrPercentAbove` | `threshold` | backtest registry `3.0` | `DEFAULT_ATR_THRESHOLD` (`2.3`) |
| `atrPercentBelow` | `threshold` | backtest registry: **required** | `1.0` |
| `bollingerBreakout` / `bollingerTouch` | `band` | streaming registry: **required** | `"lower"` |
| `rsiBelow` | `threshold` | streaming factory: required | `30` |
| `rsiAbove` | `threshold` | streaming factory: required | `70` |

Notes:

- `atrPercentBelow` and `bollingerBreakout` / `bollingerTouch` previously
  **required** the listed param on one registry; a portable JSON that
  omitted it would fail validation there. They now default instead, so
  the same JSON validates on both registries — but a strategy that
  relied on the param being required will no longer error on omission.
- If you depend on a specific value (rather than the new default), set
  it explicitly in your `StrategyJSON` after upgrading.
- A parity test now fails CI on any future shared-param drift between
  the two registries.
