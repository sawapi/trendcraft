/**
 * Live Simulator — drives a `createLiveCandle` instance from a static candle
 * array on a timer, splitting each pending candle into N intra-candle ticks
 * before the final candleComplete.
 *
 * Used by example apps (indicator-showcase Live Mode, Strategy Studio Replay)
 * to demonstrate / dogfood `connectIndicators({ live })` and
 * `connectLivePrimitives` against a deterministic, replayable stream
 * synthesized from past candles. No network feed required.
 *
 * **Runtime requirement**: this subpath imports `createLiveCandle` from
 * the `trendcraft` package, so consumers using `@trendcraft/chart/replay`
 * must install `trendcraft` alongside `@trendcraft/chart`. The chart's
 * main entry stays standalone-capable; only `replay` (and `presets`)
 * require the peer.
 *
 * @example
 * ```ts
 * import { createLiveSimulator } from "@trendcraft/chart/replay";
 *
 * const sim = createLiveSimulator({ candles, seedRatio: 0.6, ticksPerCandle: 5 });
 * connectIndicators(chart, indicators, { live: sim.live });
 * sim.play();
 * sim.onChange((state, progress) => console.log(state, progress));
 * ```
 */

import { createLiveCandle, type NormalizedCandle } from "trendcraft";

type LiveCandle = ReturnType<typeof createLiveCandle>;

/**
 * Duck-typed live source — the same shape `connectIndicators({ live })` and
 * `connectLivePrimitives` expect. A simulator's `live` property satisfies it.
 */
export type LiveSource = Pick<
  LiveCandle,
  "completedCandles" | "candle" | "snapshot" | "on" | "addIndicator" | "removeIndicator"
>;

export type SimulatorState = "idle" | "playing" | "paused" | "complete";

export type SimulatorHandle = {
  /** Pass to `connectIndicators({ live })` and `connectLivePrimitives`. */
  readonly live: LiveSource;
  /** Initial seed history loaded into the LiveCandle. */
  readonly seedCandles: readonly NormalizedCandle[];
  getState(): SimulatorState;
  /**
   * 0..1 progress across the queued (= post-seed) candles. **UI display
   * only** (progress bar fill). Do not derive an integer index from this
   * — `Math.floor(progress * queueLen)` can drift by one because of
   * IEEE-754 roundoff (e.g. `(15/22) * 22 === 14.999...`). Use
   * `getEmittedQueueCount()` or `getLastEmittedIdx()` instead.
   */
  getProgress(): number;
  /**
   * Integer count of queued candles the simulator has fully emitted
   * (i.e. fired `candleComplete` for). Sourced directly from the
   * simulator's internal counter — exact, no float arithmetic.
   */
  getEmittedQueueCount(): number;
  /**
   * Integer index, in candle space, of the *last bar the simulator has
   * emitted*. Equals `seedCandles.length + getEmittedQueueCount() - 1`
   * (when at least one bar exists). Returns `-1` when `candles` is
   * empty as a sentinel for "no bar emitted yet" — a host slicing
   * `candles.slice(0, idx + 1)` then gets the correct empty array
   * instead of a phantom `candles[0]`.
   *
   * This is the canonical "playhead" for any snapshot backtest, cursor
   * label, or indicator slice that must not leak future data. It comes
   * straight from the simulator's own state — there is no separate
   * stateless helper to re-derive it, by design: every earlier "derive
   * the same integer via independent math" path produced a drift bug
   * (float roundoff, double-clamping, empty-array mismatch). Hosts
   * that hold a `SimulatorHandle` should always read this method
   * rather than computing the index from `getProgress()` or a saved
   * cursor anchor.
   */
  getLastEmittedIdx(): number;
  play(): void;
  pause(): void;
  /**
   * Advance exactly one tick (or one full bar if `wholeBar`). Works in any
   * state and leaves the simulator paused — for "step" UI affordances.
   */
  stepOnce(opts?: { wholeBar?: boolean }): void;
  /** Inter-frame interval in ms. Default 250 (= 1x). */
  setIntervalMs(ms: number): void;
  /**
   * Rewind to seed-only. Cancels playback. Note: replaces the LiveCandle
   * instance — callers that captured `live` directly should re-read it.
   */
  reset(): void;
  /** Subscribe to state/progress changes. Returns unsubscribe. */
  onChange(cb: (state: SimulatorState, progress: number) => void): () => void;
  dispose(): void;
};

export type SimulatorOptions = {
  candles: readonly NormalizedCandle[];
  /** Fraction of `candles` to load as seed before playback starts. Default 0.6. */
  seedRatio?: number;
  /**
   * Integer count of seed bars. Overrides `seedRatio` when both are
   * passed. Preferred over `seedRatio` for any host that derives the
   * anchor from a click index — passing an integer directly avoids
   * the float roundoff `Math.floor(length * (anchor / length))` can
   * introduce (e.g. `Math.floor(22 * (15/22)) === 14`, not 15).
   *
   * Clamped through `clampedSeedEnd` to the same `SEED_RATIO_MIN/MAX`
   * bounds. A user-supplied `seedEnd: 1` on 100 candles becomes 5
   * internally; hosts that need the actual value should read
   * `sim.seedCandles.length` (or preview with `clampedSeedEnd`
   * before construction).
   */
  seedEnd?: number;
  /** Number of partial ticks emitted before each candleComplete. Default 5. */
  ticksPerCandle?: number;
  /** Initial inter-frame interval in ms. Default 250. */
  intervalMs?: number;
};

export function createLiveSimulator(opts: SimulatorOptions): SimulatorHandle {
  const candles = opts.candles;
  const ticksPerCandle = Math.max(1, opts.ticksPerCandle ?? 5);
  let intervalMs = Math.max(8, opts.intervalMs ?? 250);

  // Prefer `seedEnd` when provided — it avoids the seedRatio float-roundoff
  // that would otherwise make the simulator and host-side invariant helpers
  // disagree by one bar on ~3.7% of (length, anchor) combinations. When
  // only `seedRatio` is given, fall back to the original ratio-based path.
  //
  // Both paths funnel through `clampedSeedEnd` so `sim.seedCandles.length`
  // always matches what `clampedSeedEnd(candles, anchor)` previews. Hosts
  // that want to know the actual seed end before construction can call
  // `clampedSeedEnd` directly; either way there's only one clamp logic
  // and no double-clamping disagreement to debug.
  // Both paths funnel through `clampedSeedEnd`, which internally floors,
  // so there is exactly one place that decides the simulator's seed-end
  // integer — no second derivation path to disagree with.
  const seedEnd =
    opts.seedEnd !== undefined
      ? clampedSeedEnd(candles, opts.seedEnd)
      : clampedSeedEnd(candles, candles.length * clamp(opts.seedRatio ?? 0.6, 0.05, 0.95));
  const seedCandles = candles.slice(0, seedEnd);
  const queue = candles.slice(seedEnd);

  let live: LiveCandle = makeLive(seedCandles);
  let nextIdx = 0;
  let tickIdx = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let state: SimulatorState = queue.length === 0 ? "complete" : "idle";
  const listeners = new Set<(s: SimulatorState, p: number) => void>();

  function makeLive(seed: readonly NormalizedCandle[]): LiveCandle {
    // Note: pass an empty `history` and populate `completedCandles` via
    // addCandle() instead. That way indicators registered AFTER construction
    // (via connect-indicators' factory path) warm up exactly once from
    // _completedCandles. Passing both `history: seed` AND addCandle(seed)
    // would double-count seed bars in warmUpIndicator.
    const lc = createLiveCandle({});
    for (const c of seed) lc.addCandle(c);
    return lc;
  }

  function getProgress(): number {
    if (queue.length === 0) return 1;
    const partial = tickIdx / ticksPerCandle;
    return Math.min(1, (nextIdx + partial) / queue.length);
  }

  function notify(): void {
    const p = getProgress();
    for (const cb of listeners) cb(state, p);
  }

  function tickOnce(): boolean {
    if (nextIdx >= queue.length) return false;
    const target = queue[nextIdx];
    if (tickIdx < ticksPerCandle - 1) {
      live.addCandle(buildPartial(target, tickIdx + 1, ticksPerCandle), { partial: true });
      tickIdx++;
    } else {
      live.addCandle(target);
      nextIdx++;
      tickIdx = 0;
    }
    return true;
  }

  function step(): void {
    if (state !== "playing") return;
    if (!tickOnce()) {
      state = "complete";
      stopTimer();
    } else if (nextIdx >= queue.length) {
      // Eagerly flip to complete the moment the last bar's
      // candleComplete fires, not on the *next* timer tick. Otherwise
      // completion-driven UI (Play button → "Replay finished" overlay)
      // lags by one interval after `completedCandles` is already full.
      state = "complete";
      stopTimer();
    }
    notify();
  }

  function startTimer(): void {
    stopTimer();
    timer = setInterval(step, intervalMs);
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  const handle: SimulatorHandle = {
    get live(): LiveSource {
      return live;
    },
    seedCandles,
    getState: () => state,
    getProgress,
    getEmittedQueueCount: () => nextIdx,
    getLastEmittedIdx: () => {
      // Empty dataset: no bar has been (or can be) emitted. `-1`
      // signals "no bar yet" — hosts using this for a snapshot slice
      // get `candles.slice(0, -1 + 1) === []` which is the correct
      // empty snapshot. Returning `0` would point at a non-existent
      // index in an empty array.
      if (candles.length === 0) return -1;
      return Math.min(candles.length - 1, seedEnd + nextIdx - 1);
    },
    play(): void {
      if (state === "complete" || state === "playing") return;
      state = "playing";
      startTimer();
      notify();
    },
    pause(): void {
      if (state !== "playing") return;
      state = "paused";
      stopTimer();
      notify();
    },
    stepOnce(opts): void {
      if (state === "complete") return;
      if (state === "playing") {
        state = "paused";
        stopTimer();
      }
      const wholeBar = opts?.wholeBar ?? true;
      if (wholeBar) {
        // Exactly one new candleComplete: skip any remaining partials of the
        // current bar and emit the full close. The drain-then-tick variant
        // could leak into the next bar when called mid-partial.
        if (nextIdx >= queue.length) {
          state = "complete";
        } else {
          live.addCandle(queue[nextIdx]);
          nextIdx++;
          tickIdx = 0;
        }
      } else {
        tickOnce();
      }
      // Stepping the *last* bar must flip state to complete eagerly,
      // not on a phantom next call. Otherwise completion-driven UI
      // (e.g. "Step" button enabling "Replay finished" overlay)
      // wouldn't fire until the user steps once more.
      if (nextIdx >= queue.length) state = "complete";
      notify();
    },
    setIntervalMs(ms: number): void {
      intervalMs = Math.max(8, ms);
      if (state === "playing") startTimer();
    },
    reset(): void {
      stopTimer();
      live.dispose();
      live = makeLive(seedCandles);
      nextIdx = 0;
      tickIdx = 0;
      state = queue.length === 0 ? "complete" : "idle";
      notify();
    },
    onChange(cb): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    dispose(): void {
      stopTimer();
      live.dispose();
      listeners.clear();
    },
  };

  return handle;
}

/** Build the i-th synthetic intra-candle snapshot toward `target` (i in 1..N-1). */
function buildPartial(target: NormalizedCandle, i: number, N: number): NormalizedCandle {
  const frac = i / N;
  const close = target.open + (target.close - target.open) * frac;
  const partialHigh = Math.max(
    target.open,
    close,
    target.open + (target.high - target.open) * frac,
  );
  const partialLow = Math.min(target.open, close, target.open + (target.low - target.open) * frac);
  return {
    time: target.time,
    open: target.open,
    high: partialHigh,
    low: partialLow,
    close,
    volume: target.volume * frac,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ============================================================
// Replay UI invariants
// ============================================================
//
// Pure helpers for hosts building a "scrubbable replay" UI on top of
// `createLiveSimulator`. They keep cursor display, snapshot-backtest
// slice, and the simulator's emitted bars in lockstep — three places
// that all need to derive the same integer index from the same
// (anchor, progress) inputs. Drift between them is the no-look-ahead
// leak Replay exists to prevent.
//
// The functions take `readonly unknown[]` and only read `.length`, so
// they work for any candle-array-like input without coupling to the
// chart's `NormalizedCandle` type.

/**
 * Minimum fraction of total history loaded as seed before the
 * simulator starts replaying. Below this the chart has too little
 * warm-up data; above the matching `SEED_RATIO_MAX` there's nothing
 * left to replay. Anchor clicks are clamped through these bounds so
 * the simulator's actual seed end and the host's cursor display
 * always agree.
 */
export const SEED_RATIO_MIN = 0.05;

/** Maximum fraction of total history loaded as seed. See `SEED_RATIO_MIN`. */
export const SEED_RATIO_MAX = 0.95;

/**
 * Clamp a user-supplied anchor (cursor index) to a valid seed-end
 * range, returning the *exact* integer the simulator will use.
 *
 * Always returns an integer — `Math.floor(cursorIndex)` is applied
 * inside so a fractional input (e.g. a sub-pixel UI coordinate)
 * doesn't make this helper return a different number from what
 * `createLiveSimulator({ seedEnd })` would resolve to. The two
 * paths share this single function so they cannot drift apart.
 *
 * Non-numeric / `NaN` / `undefined` inputs fall back to the default
 * 60% mark (matching the simulator's default `seedRatio: 0.6`)
 * rather than propagating `NaN` through downstream code — UI math
 * can sometimes produce `NaN` (`0 / 0`, missing event coords) and a
 * silent simulator stall is worse than a deterministic fallback.
 *
 * Guarantees at least 1 seed bar and at least 1 queue bar (provided
 * `candles.length >= 2`) so the replay has both warm-up and content.
 */
export function clampedSeedEnd(candles: readonly unknown[], cursorIndex: number): number {
  // Empty candles: the simulator can only seed zero bars, so the
  // preview must agree. Returning the usual `Math.max(1, ...)` floor
  // would let this helper report 1 while `sim.seedCandles.length`
  // stayed 0 — the same kind of preview/library disagreement the rest
  // of this module exists to prevent.
  if (candles.length === 0) return 0;
  const min = Math.max(1, Math.floor(candles.length * SEED_RATIO_MIN));
  const max = Math.max(min, Math.floor(candles.length * SEED_RATIO_MAX));
  // `Math.floor` coerces booleans / null / numeric strings cleanly,
  // but produces `NaN` for actual NaN / undefined / non-numeric. Catch
  // that single case explicitly so the fallback is deterministic.
  const floored = Math.floor(cursorIndex);
  const safe = Number.isNaN(floored) ? Math.floor(candles.length * 0.6) : floored;
  return Math.max(min, Math.min(max, safe));
}

// Why no standalone `resolveQueueIdx(candles, cursor, count)` or
// `lastEmittedIdx(candles, cursor, count)` helpers here:
//
// Earlier drafts of this subpath exposed both. Each shipped with a
// drift bug Codex caught — float-roundoff in `seedRatio` round-trips
// (`Math.floor(22 * (15/22)) === 14`, not 15), float-roundoff in
// `progress * queueLen`, then double-clamping disagreement between
// the simulator's `seedEnd` and the helper's own `clampedSeedEnd`.
//
// All three were the same class of bug: two parties (the simulator
// and a standalone helper) re-deriving the same integer from
// independent inputs. The fix wasn't another epsilon; it was to
// remove the second derivation path entirely. The simulator owns
// `seedEnd` and `nextIdx` as integers — hosts read them via
// `seedCandles.length`, `getEmittedQueueCount()`, and
// `getLastEmittedIdx()`. There is no second source of truth.
