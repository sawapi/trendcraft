# Migrating trendcraft 0.3.x → 0.4.0

The 0.4.0 release lands the **Indicator State Contract**. This is the
only breaking change that affects incremental-indicator persistence.
This page is the 5-minute upgrade guide: what broke and how to update
your code.

## What broke

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

## What is *not* affected

- **Strategy JSON** (`serializeStrategy` / `parseStrategy`) describes
  indicator *configurations*, not runtime state — unchanged.
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
