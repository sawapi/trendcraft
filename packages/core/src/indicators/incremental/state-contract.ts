/**
 * Indicator State Contract — wire format, categories, and the
 * `resolveResume` helper that centralizes resume policy.
 *
 * See `packages/core/docs/STATE_CONTRACT.md` for the design rationale.
 *
 * Introduced in trendcraft 0.4.0 as a breaking change. Pre-0.4.0
 * snapshots (bare state, no `meta` field) are not resumable.
 */

/**
 * Metadata attached to every snapshot. Lets us version per-indicator,
 * detect snapshot mix-ups, and compare params on resume.
 */
export type SnapshotMeta = {
  /** Per-indicator schema version. Bumped on any breaking state change. */
  version: number;
  /** Indicator name (e.g., "alma", "frama"). Runtime sanity check. */
  indicator: string;
  /** Params at the time `getState()` was called. */
  params: Record<string, unknown>;
};

/**
 * Two-layer snapshot: indicator-specific state wrapped with metadata.
 *
 * `getState()` returns this. `fromState` accepts this. The bare-state
 * shape from 0.3.x is no longer accepted at the API boundary.
 */
export type IndicatorSnapshot<TState> = {
  meta: SnapshotMeta;
  state: TState;
};

/**
 * Resume category — determines how `resolveResume` reacts to param
 * mismatches between `options` and the snapshot's recorded params.
 *
 * See STATE_CONTRACT.md §2.3 for the full taxonomy.
 */
export type StateCategory = "windowed" | "recursive" | "mixed" | "cascaded" | "event";

/**
 * Result returned by `resolveResume`.
 *
 * - `params`: effective params after merging defaults / snapshot /
 *   explicit options. The caller uses this for the rest of construction.
 * - `state`: restored state, or `null` for a fresh start.
 * - `reconfigured`: only meaningful when `state !== null`. `true`
 *   signals to the caller that the snapshot is being resumed with
 *   different (non-source) params and the caller must rebuild
 *   shape-dependent structures (e.g., resize a buffer) while carrying
 *   the raw data forward. Always `false` for recursive / mixed /
 *   cascaded — those throw on mismatch instead.
 */
export type ResolveResumeResult<TParams, TState> = {
  params: TParams;
  state: TState | null;
  reconfigured: boolean;
};

/**
 * Deep-partial: every level of a nested params object is optional.
 * Arrays / Date / RegExp are treated as atomic (no element-wise
 * partial), matching the deep-merge semantics in `mergeParams`.
 */
export type DeepPartial<T> = T extends Array<infer _U> | Date | RegExp
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * Input to `resolveResume`.
 */
export type ResolveResumeOptions<TParams extends Record<string, unknown>, TState> = {
  /** Indicator name (must match `fromState.meta.indicator` on resume). */
  indicator: string;
  /** Current schema version (must match `fromState.meta.version` on resume). */
  version: number;
  /** Resume category determining the reconfig policy. */
  category: StateCategory;
  /**
   * Caller's explicit options (sparse — missing keys fall back to
   * snapshot or defaults; nested object keys are deep-merged so
   * `{ config: { a: 99 } }` keeps `config.b` from the snapshot).
   */
  options: DeepPartial<TParams>;
  /** Optional saved snapshot. `null` / `undefined` → fresh start. */
  fromState: IndicatorSnapshot<TState> | null | undefined;
  /**
   * Canonical defaults. Partial — keys can be omitted for params
   * with no meaningful canonical default (e.g., SMA's `period`: every
   * mainstream library makes the caller specify it). The merged
   * `params` returned by `resolveResume` is still typed as `TParams`
   * (the caller's declared intent); the constructor is expected to
   * validate that any required-but-defaultless key was supplied via
   * `options` or `fromState`, and throw otherwise.
   */
  defaults: Partial<TParams>;
  /**
   * Params that only affect the state→output projection, never the
   * state itself — e.g., a band-width `multiplier` in
   * `EMA ± multiplier × ATR`. Changing one of these on resume is
   * mathematically safe: the saved recursive / windowed state is
   * reused verbatim and the new value takes effect immediately.
   *
   * This is the **param-role axis**, orthogonal to `category` (the
   * state-structure axis): a `mixed` indicator can still have
   * resume-invariant params. See STATE_CONTRACT.md §2.4.
   *
   * `source` is never eligible — it changes the input series, so the
   * saved state corresponds to different data — and is refused even
   * if mistakenly listed here.
   */
  resumeInvariantParams?: (keyof TParams & string)[];
};

/**
 * Centralize the resume contract for incremental indicators.
 *
 * Validates the snapshot's indicator name and version, merges the
 * effective params, and applies the category-specific reconfig
 * policy. Throws with a uniform "<indicator>: incompatible snapshot,
 * re-warm required" message on any incompatibility.
 *
 * @example
 * ```ts
 * const { params, state, reconfigured } = resolveResume({
 *   indicator: "alma",
 *   version: 1,
 *   category: "windowed",
 *   options,
 *   fromState: warmUpOptions?.fromState ?? null,
 *   defaults: { period: 9, offset: 0.85, sigma: 6, source: "close" },
 * });
 *
 * // For Windowed: `reconfigured` tells you to resize the buffer at
 * // the new period while carrying forward the latest samples.
 * if (reconfigured) {
 *   // ... rebuild buffer at new params.period, copy in old samples ...
 * }
 * ```
 */
export function resolveResume<TParams extends Record<string, unknown>, TState>(
  opts: ResolveResumeOptions<TParams, TState>,
): ResolveResumeResult<TParams, TState> {
  const { indicator, version, category, options, fromState, defaults, resumeInvariantParams } =
    opts;

  // Fresh start: just merge defaults + options. No snapshot to consult.
  if (!fromState) {
    return {
      params: mergeParams(defaults, undefined, options),
      state: null,
      reconfigured: false,
    };
  }

  // Defensive — JSON-parsed snapshots may have missing `meta`.
  if (!fromState.meta || typeof fromState.meta !== "object") {
    throw new Error(
      `${indicator}: incompatible snapshot, re-warm required (missing meta — pre-0.4.0 snapshots are not resumable)`,
    );
  }
  // Defensive — even with `meta` present, `meta.params` might be
  // missing, non-object, or an array (corrupted JSON, partial schema
  // migration, etc.). Without a usable params object we cannot tell
  // whether the snapshot's recursive state is safe to resume; the
  // only safe answer is to refuse and force a re-warm.
  if (
    !fromState.meta.params ||
    typeof fromState.meta.params !== "object" ||
    Array.isArray(fromState.meta.params)
  ) {
    throw new Error(
      `${indicator}: incompatible snapshot, re-warm required (missing or malformed meta.params — cannot verify resume compatibility)`,
    );
  }

  // Indicator name guard. Catches "passed the wrong indicator's snapshot".
  if (fromState.meta.indicator !== indicator) {
    throw new Error(
      `${indicator}: incompatible snapshot, re-warm required (indicator mismatch: snapshot was created for "${fromState.meta.indicator}")`,
    );
  }

  // Version guard. Bumping `version` invalidates older snapshots.
  if (fromState.meta.version !== version) {
    throw new Error(
      `${indicator}: incompatible snapshot, re-warm required (version mismatch: snapshot=v${fromState.meta.version} current=v${version})`,
    );
  }

  // Merge: defaults < snapshot.params < explicit options.
  const params = mergeParams(defaults, fromState.meta.params, options);

  // Compute which params changed relative to the snapshot.
  const snapshotParams = mergeParams(defaults, fromState.meta.params, {});
  const changedKeys = diffParams(snapshotParams, params);

  if (changedKeys.length === 0) {
    return { params, state: fromState.state, reconfigured: false };
  }

  // Source change is always a refuse — the input series differs, so
  // the snapshot's accumulated data (whether buffer or recursive
  // value) corresponds to a different input than the new run will see.
  // Checked before the resume-invariant filter so `source` can never
  // be waved through even if mistakenly listed there.
  if (changedKeys.includes("source")) {
    throw new Error(
      `${indicator}: incompatible snapshot, re-warm required (source mismatch — different source means different input series)`,
    );
  }

  // Resume-invariant params (the param-role axis) only scale the
  // state→output projection — changing them never invalidates the
  // saved state. Drop them from the change set; the merged `params`
  // already carries their new values.
  const invariantSet = new Set<string>(resumeInvariantParams ?? []);
  const stateShapingChanges = changedKeys.filter((k) => !invariantSet.has(k));

  if (stateShapingChanges.length === 0) {
    // Only resume-invariant params changed — resume the saved state
    // verbatim, no buffer rebuild needed.
    return { params, state: fromState.state, reconfigured: false };
  }

  if (category === "windowed" || category === "event") {
    return { params, state: fromState.state, reconfigured: true };
  }

  // recursive / mixed / cascaded: any state-shaping param change
  // permanently poisons the recursive accumulator(s).
  throw new Error(
    `${indicator}: incompatible snapshot, re-warm required (${category} indicators cannot be reconfigured on resume; changed: ${stateShapingChanges.join(", ")})`,
  );
}

/**
 * Build a fresh `SnapshotMeta` for an indicator that's been newly
 * created (no resume) or that has changed params since the last
 * snapshot. The indicator's `getState()` calls this when constructing
 * the wire payload.
 *
 * The `params` object is deep-cloned so that subsequent mutations of
 * the caller's options (or shared array/object values like Fibonacci
 * `levels: number[]`) cannot retroactively change the snapshot — which
 * would otherwise make persisted snapshots non-deterministic and break
 * later `resolveResume` comparisons.
 */
export function buildMeta(
  indicator: string,
  version: number,
  params: Record<string, unknown>,
): SnapshotMeta {
  return { version, indicator, params: deepClone(params) };
}

/**
 * Wrap an indicator's bare state in the standard envelope.
 */
export function makeSnapshot<TState>(
  indicator: string,
  version: number,
  params: Record<string, unknown>,
  state: TState,
): IndicatorSnapshot<TState> {
  return { meta: buildMeta(indicator, version, params), state };
}

/**
 * Standard runtime validation for a required indicator option.
 *
 * `resolveResume` types its returned `params` as the full `TParams`,
 * but with `Partial<TParams>` defaults a key may still be `undefined`
 * at runtime when the caller omits it AND no snapshot supplies it.
 * Indicators like SMA / EMA / WMA whose `period` has no canonical
 * default must call this immediately after `resolveResume` to fail
 * early with a uniform error message.
 *
 * @example
 * ```ts
 * const { params } = resolveResume<SmaParams, SmaState>({
 *   indicator: "sma",
 *   defaults: { source: "close" }, // no `period` default
 *   ...
 * });
 * const period = requireParam(
 *   "sma",
 *   params,
 *   "period",
 *   (v): v is number => Number.isInteger(v) && v >= 1,
 *   "must be a positive integer",
 * );
 * ```
 *
 * @returns the validated value, narrowed to `NonNullable<TParams[K]>`.
 */
export function requireParam<TParams, K extends keyof TParams>(
  indicator: string,
  params: TParams,
  key: K,
  validate?: (value: NonNullable<TParams[K]>) => boolean,
  expectation?: string,
): NonNullable<TParams[K]> {
  const value = params[key];
  if (value === undefined || value === null) {
    throw new Error(
      `${indicator}: required option "${String(key)}" was not provided (no default and no snapshot value)`,
    );
  }
  const narrowed = value as NonNullable<TParams[K]>;
  if (validate && !validate(narrowed)) {
    throw new Error(
      `${indicator}: option "${String(key)}" failed validation${
        expectation ? ` (${expectation})` : ""
      }`,
    );
  }
  return narrowed;
}

// ---- Internal helpers ----

function mergeParams<TParams extends Record<string, unknown>>(
  defaults: Partial<TParams>,
  snapshotParams: Record<string, unknown> | undefined,
  options: Record<string, unknown>,
): TParams {
  // Stage 1: seed from `defaults` (now partial; some keys may be
  //          absent — those start as `undefined` and stay so unless
  //          snapshot or options supply them).
  // Stage 2: snapshot deep-merges over defaults for any key it has.
  // Stage 3: explicit options deep-merge over that.
  //
  // After all three stages, a key may legitimately remain `undefined`
  // when (a) it's not in defaults, (b) there's no snapshot, and
  // (c) the caller omitted it. The constructor is responsible for
  // validating any such required-but-defaultless key via
  // `requireParam` and failing fast.
  //
  // Deep merge recurses into plain objects so sparse overrides work
  // for indicators with nested-object params:
  //
  //     defaults  = { config: { a: 1, b: 2 } }
  //     options   = { config: { a: 5 } }
  //     result    = { config: { a: 5, b: 2 } }
  //
  // Arrays are *not* deep-merged — they're treated as atomic values
  // and replaced wholesale. This matches the intuition for params
  // like Fibonacci `levels: number[]`: passing a new array means "use
  // exactly these levels", not "merge into the existing ones".
  //
  // `undefined` values at any nesting level are skipped during the
  // merge so callers can pass `{ period: undefined }` (or
  // `{ config: { a: undefined } }`) without accidentally blanking
  // values from the snapshot or defaults.
  let merged: Record<string, unknown> = { ...defaults };
  if (snapshotParams) {
    merged = deepMergeInto(merged, snapshotParams);
  }
  merged = deepMergeInto(merged, options);
  return merged as TParams;
}

function deepMergeInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const src = source[key];
    // Skip explicit `undefined` at every nesting level (top-level
    // and nested). Otherwise an override like
    // `{ config: { a: undefined } }` would blank out `config.a`
    // from the snapshot instead of falling back to it.
    if (src === undefined) continue;
    const dst = result[key];
    if (isPlainObject(src) && isPlainObject(dst)) {
      result[key] = deepMergeInto(dst, src);
    } else {
      // Primitives, null, arrays → replace.
      result[key] = src;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  // Date / RegExp are typeof "object" but are atomic values for our
  // purposes — they match `DeepPartial<T>`'s atomic-leaf treatment.
  // Deep-merging into them would collapse them to `{}`.
  if (value instanceof Date) return false;
  if (value instanceof RegExp) return false;
  return true;
}

function diffParams(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (!deepEqual(a[key], b[key])) {
      changed.push(key);
    }
  }
  return changed;
}

/**
 * Structural equality for JSON-serializable values.
 *
 * Indicator params are JSON-serializable by contract (they get
 * persisted via `getState()` snapshots), so this covers everything
 * we expect: primitives, arrays, plain objects, and `null`. Bare
 * `Object.is` would treat two distinct arrays with the same contents
 * as different, leading to spurious reconfig-rejected resumes for
 * indicators with composite params like Fibonacci `levels: number[]`.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  // Date / RegExp: compare by value, not by enumerable keys. Without
  // these branches the generic "compare own keys" path below would
  // treat two different Dates (or two different RegExps) as equal
  // because they expose no enumerable own keys.
  if (a instanceof Date || b instanceof Date) {
    if (!(a instanceof Date && b instanceof Date)) return false;
    return a.getTime() === b.getTime();
  }
  if (a instanceof RegExp || b instanceof RegExp) {
    if (!(a instanceof RegExp && b instanceof RegExp)) return false;
    return a.source === b.source && a.flags === b.flags;
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!deepEqual(aRec[key], bRec[key])) return false;
  }
  return true;
}

/**
 * Deep clone for JSON-serializable values.
 *
 * Used by `buildMeta` to isolate the snapshot's `params` from any
 * later mutation of the caller's options object — see the rationale
 * on `buildMeta`. Uses `structuredClone` when available (Node 17+,
 * modern browsers) and falls back to JSON round-trip otherwise.
 */
function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
