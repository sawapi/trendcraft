# Indicator State Contract (target: trendcraft 0.4.0)

> **Status**: Phase 0 design document. The contract is being introduced
> in the `epic/state-contract` branch and will land in trendcraft
> 0.4.0 as a breaking change. 1.0 is still ahead; the 0.x line
> continues to allow breaking changes per the project's release
> practice.

## 1. Motivation

Every incremental indicator in the library exposes the same shape:

```ts
const ind = createXxx(options, { fromState?, warmUp? });
ind.next(candle);       // → { time, value }
ind.peek(candle);       // → preview without mutating state
ind.getState();         // → snapshot for persistence / resume
```

The library has shipped ~90 such indicators. Through Phase 2 (canonical
alignment) it became clear that the `getState` / `fromState`
*contract* — what guarantees the API offers about resume — is not
defined library-wide. Each indicator has reinvented its own version
of the answer, sometimes inconsistently:

1. **Snapshot has no version field.** Adding/removing a state field
   silently breaks restore from older snapshots; there is no clean way
   to detect or migrate.
2. **Reconfig-on-resume policy varies per indicator.** ALMA carries
   forward; FRAMA refuses; others have latent `RangeError`s when
   period changes but `fromState` capacity does not.
3. **Recursive smoothers (EMA, FRAMA, KAMA, …) have mathematically
   undefined reconfig semantics.** No clean answer to "what does it
   mean to change `period` mid-stream"; the library has not picked
   one.
4. **Snapshot mix-ups are silent.** Passing a `SuperSmootherState`
   to `createAlma` does not error structurally — TypeScript happens
   to allow it because of overlapping field names (`count: number`),
   and the indicator silently produces garbage.
5. **Edge cases are not pinned by tests.** `peek` vs `next` gate
   inconsistency, `count` vs `buffer.length` warm-up gating,
   period-grown buffer iteration overrun — each was discovered as
   a separate Codex finding during Phase 2.

This document specifies the State Contract that fixes all five at
once.

## 2. Design overview

### 2.1 Wire format — two layers

Every snapshot is wrapped:

```ts
type SnapshotMeta = {
  version: number;        // per-indicator; bump on any schema change
  indicator: string;      // "alma" | "frama" | … — runtime sanity check
  params: Record<string, unknown>;  // params at snapshot time
};

type IndicatorSnapshot<S> = {
  meta: SnapshotMeta;
  state: S;               // indicator-specific state shape
};
```

`getState()` returns `IndicatorSnapshot<S>`, not bare `S`. `fromState`
receives `IndicatorSnapshot<S>`. This is a **breaking change** for
0.3.x callers; the bare-state shape is not accepted.

### 2.2 Per-indicator versioning

Each indicator owns its `meta.version`. Bumping `frama` does not
invalidate `sma` snapshots. Initial value is `1` for every indicator
when the contract is introduced.

### 2.3 Five resume categories

| Category | State shape | Reconfig on resume | Examples |
|---|---|---|---|
| **A. Windowed** | Raw price/data buffer of N samples | ✓ Carry-forward (period change), refuse source change | SMA, WMA, ALMA, Highest/Lowest, Donchian, Returns |
| **B. Recursive** | Single recursive accumulator (`prevValue`) | ✗ Always refuse | EMA, McGinley, ZLEMA, Wilder smoothers (RSI internal, ATR internal) |
| **C. Mixed** | Windowed buffer + recursive value | ✗ Always refuse (recursive part is poisoned by past params) | FRAMA, KAMA, Super Smoother |
| **D. Cascaded** | Multiple recursive stages | ✗ Always refuse (every stage's recursion encodes past params) | MACD, DEMA, TEMA, TRIX, Roofing Filter, STC, Klinger, HMA |
| **E. Event log** | Append-only event list | ✓ Append-only (params change does not invalidate past events) | BOS, FVG, Liquidity Sweep, Pivot Points, Order Block, Swing Points |

**Important note on ALMA vs FRAMA**: ALMA's formula is
`sum(weights[i] * buffer[i])` — its state is just the raw price
buffer, no recursion. ALMA is **Category A**. FRAMA combines a raw
price buffer (for fractal-dim calc) with a recursive `prevFrama` value
— FRAMA is **Category C**. This distinction is why ALMA can support
period change on resume (carry forward what fits) while FRAMA cannot.

### 2.4 Per-category resume rules

**Category A — Windowed**:
- Same `period` and `source` → restore buffer verbatim
- Different `period` → carry forward latest `min(snapshot.length, new period)` samples; gate `next()` / `peek()` / `isWarmedUp` on `buffer.length >= period` until refilled
- Different `source` → throw (different source = different input series, buffer is wrong-source data)

**Category B / C / D — Recursive / Mixed / Cascaded**:
- Same params → restore state verbatim
- Different params (any) → throw with `"<indicator>: incompatible snapshot, re-warm required"`

**Category E — Event log**:
- Restore event list verbatim
- Params change → continue appending; past events keep their original-param interpretation (they are timestamped facts, not derived state)

### 2.5 API surface — `createXxx(options, { fromState })` retained

The existing API is preserved; only the semantics inside `fromState`
handling are tightened. The reasoning: introducing `resumeXxx` as a
second entry point would double the API surface (~90 indicators × 2
methods) without a clear ergonomic win.

Concretely, the constructor logic becomes:

```ts
const fs = warmUpOptions?.fromState ?? null;
const { params, state, reconfigured } = resolveResume({
  indicator: "alma",
  version: 1,
  category: "windowed",
  options,
  fromState: fs,
  defaults: { period: 9, offset: 0.85, sigma: 6, source: "close" },
});
```

`resolveResume`:
1. Validates `fs.meta.indicator === "alma"` → throw if mismatched
2. Validates `fs.meta.version === 1` → throw if mismatched
3. Compares `options` against `fs.meta.params` and `defaults`
4. For Windowed: returns `reconfigured: true` if period changed (caller rebuilds buffer at new capacity, carrying forward)
5. For Recursive/Mixed/Cascaded: throws on any param mismatch
6. For EventLog: always accepts (params change is harmless for the log)

Each indicator's constructor sees a clean `{ params, state, reconfigured }` and decides whether to rebuild internal structures (e.g., resize buffer for period change) or use `state` verbatim.

### 2.6 Migration policy

For 0.4.0:

- **Pre-0.4.0 snapshots are not resumable.** They have no `meta`
  field; `fromState` detects this (`!fs.meta` or `!fs.meta.indicator`)
  and throws with a clear re-warm message.
- **No automatic migration registry.** Per-version migrations may be
  added in later majors (1.x+) if format changes accumulate. For
  0.4.0, the policy is `throw + re-warm from candle history`.

This matches what Phase 2 already did for FRAMA, Connors RSI, and
others: legacy snapshots throw, callers re-warm. The contract just
makes the throw uniform and the error message generic.

### 2.7 Contract test DSL

To catch the per-indicator edge cases that Phase 2 surfaced as
individual Codex findings, every indicator registers in a shared
contract test:

```ts
describeContract({
  name: "alma",
  create: createAlma,
  category: "windowed",
  version: 1,
  defaultParams: { period: 9, source: "close" },
  reconfigParams: [{ period: 5 }, { period: 14 }],
  sourceVariants: ["close", "high", "hl2"],
  candleStream: synthCandles(200),
});
```

Generates these invariants automatically:

1. **Round-trip identity** — `getState → fromState → next` produces
   identical series.
2. **Indicator name guard** — passing a foreign indicator's snapshot
   throws.
3. **Version mismatch** — old `meta.version` throws.
4. **Reconfig — Windowed**: new period produces output equivalent
   (after warmup) to a fresh `createXxx(newOptions)` over the same
   history.
5. **Reconfig refuse — Recursive/Mixed/Cascaded**: any param change
   throws.
6. **`peek` consistency** — `peek(c).value === next(c).value` and
   `getState()` snapshot unchanged after `peek`.
7. **Warmup gate consistency** — `next()` / `peek()` / `isWarmedUp`
   transition at the same bar.

Adding a new indicator to the library requires registering it in
`describeContract`. This is the central place that prevents the
"each indicator's edge cases were found by Codex one by one" pattern.

## 3. Categorization process

Phase 2 (migration) classifies each of the ~90 indicators into A-E by
inspecting:

- Does the state include a recursive accumulator (`prev*` field)?
  → at least Recursive/Mixed/Cascaded.
- Does the state include a raw-data buffer that does not depend on
  past parameters? → Windowed component.
- Is the indicator a pipeline of multiple recursive stages? →
  Cascaded.
- Does the state accumulate timestamped events that remain valid
  regardless of params? → Event log.

The contract tests pin the answer: if a category is wrong, the
reconfig invariant fails (e.g., Recursive misclassified as Windowed
will fail the reconfig refuse test).

### 3.1 Tricky cases (resolved during Phase 2)

- **ALMA**: Windowed (no recursion despite "moving average" name; the
  formula is a weighted average of raw prices in the window).
- **HMA**: Cascaded (cascade of three WMAs; the outer WMA's buffer
  carries intermediate values that depend on `period`).
- **KAMA**: Mixed (raw price buffer for efficiency ratio + recursive
  `prevKama` for smoothing).
- **Parabolic SAR**: Recursive-like (carries `prevSar`, `ep`, `af`,
  `isUp` — a small state machine). Refuse reconfig.
- **Heikin-Ashi**: Recursive (`prevHaOpen`, `prevHaClose`). Refuse
  reconfig.

### 3.2 Open classification (to resolve in Phase 2)

These need a closer look during migration:

- **Linear regression**: state includes running sums; could be either
  Windowed (sums computed from raw window) or Mixed depending on
  implementation. Likely Windowed.
- **Regime detection (volatility)**: uses windowed variance, no
  recursion. Likely Windowed.
- **Anchored VWAP**: cumulative from anchor; resetting anchor is the
  "reconfig" — special. Possibly Recursive or its own category.
- **CVD (Cumulative Volume Delta)**: pure cumulative; reconfig means
  changing anchor. Possibly Recursive.
- **Ichimoku**: multiple windowed components + future displacement
  buffer. Likely a Windowed-cascade. Refuse reconfig matches the
  Phase 2 fix.

## 4. Errors and messages

All resume errors use the same shape for grep-ability and user
support:

```
<IndicatorName>: incompatible snapshot, re-warm required
```

Optionally with a clarifying suffix:

```
ALMA: incompatible snapshot, re-warm required (period mismatch: snapshot=9 requested=14)
```

`resolveResume` constructs the message; per-indicator code does not
need to format it.

## 5. Migration guide (0.3.x → 0.4.0)

For library consumers:

### 5.1 `getState` / `fromState` callers

If you persist indicator state across process restarts:

```ts
// 0.3.x:
const state: AlmaState = indicator.getState();
await db.save("alma", state);
// ... later
const restored: AlmaState = await db.load("alma");
const ind = createAlma({}, { fromState: restored });
```

```ts
// 0.4.0:
const snapshot: IndicatorSnapshot<AlmaState> = indicator.getState();
await db.save("alma", snapshot);
// ... later
const restored: IndicatorSnapshot<AlmaState> = await db.load("alma");
const ind = createAlma({}, { fromState: restored });
```

**Pre-0.4.0 snapshots cannot be resumed.** Either re-warm from
candle history, or accept that any first-time-after-upgrade run will
need to skip the persisted snapshot. The thrown error message
explicitly instructs re-warm.

### 5.2 `createXxx(options, { fromState })` with reconfigured options

If you previously passed a `fromState` *and* different options:

```ts
// 0.3.x: silent — might have produced wrong output
createFrama({ period: 14 }, { fromState: stateWith9 });
```

```ts
// 0.4.0: throws for Recursive/Mixed/Cascaded
createFrama({ period: 14 }, { fromState: stateWith9 });
// → Error: FRAMA: incompatible snapshot, re-warm required
```

For Category A (Windowed), period change is supported via carry-forward; source change still throws.

## 6. Roadmap

Five phases, ~4-5 weeks total. Each phase lands as a PR into
`epic/state-contract`. Final merge to `main` is a single epic merge
commit at 0.4.0 release time.

| Phase | Output | Duration |
|---|---|---|
| **0. Decision doc** | This document + memory note + epic branch | 1 day |
| **1. Foundation** | `state-contract.ts` (types + `resolveResume`), `describeContract` DSL skeleton, no indicator changes yet | 3-4 days |
| **2. Indicator migration** | Wave 1: Category A (~20). Wave 2: B (~6). Wave 3: C/D (~25). Wave 4: E (~10). Wave 5: remaining (~30) | 2 weeks |
| **3. Contract test rollout** | All indicators registered, latent edge cases surfaced + fixed in individual PRs | 1 week |
| **4. Documentation** | `STATE_AND_RESUME.md` consumer guide, migration guide, JSDoc `@stateCategory` tags | 2-3 days |
| **5. 0.4.0 release prep** | CHANGELOG BREAKING entry, perf check (meta wrapper overhead < 5%), final audit | 2 days |

## 7. Out of scope (deferred to later minors)

- **Migration registry** (auto-migrate v1 → v2 per indicator). Add
  when format changes accumulate.
- **Streaming snapshot format** (incremental snapshot deltas).
- **Cross-indicator snapshot composition** (e.g., snapshot a whole
  strategy with all its indicators in one blob).
- **Schema introspection for tooling** (UI that knows what params
  each indicator's snapshot has).

## 8. Decisions made (Phase 0 sign-off)

The following were agreed before Phase 0 finalization:

1. ✓ Five resume categories (A-E) cover all current indicators.
2. ✓ Per-indicator versioning (not library-wide).
3. ✓ No migration registry in 0.4.0 (throw + re-warm).
4. ✓ Retain `createXxx(options, { fromState })` API surface; tighten
   semantics via `resolveResume`.
5. ✓ Source change always refuses reconfig (even for Windowed).
6. ✓ `fromState` type breaking change to `IndicatorSnapshot<S>` is
   accepted (0.x breaking-change allowance).
