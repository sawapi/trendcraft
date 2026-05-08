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
  /** 0..1 progress across the queued (= post-seed) candles. */
  getProgress(): number;
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
  /** Number of partial ticks emitted before each candleComplete. Default 5. */
  ticksPerCandle?: number;
  /** Initial inter-frame interval in ms. Default 250. */
  intervalMs?: number;
};

export function createLiveSimulator(opts: SimulatorOptions): SimulatorHandle {
  const candles = opts.candles;
  const seedRatio = clamp(opts.seedRatio ?? 0.6, 0.05, 0.95);
  const ticksPerCandle = Math.max(1, opts.ticksPerCandle ?? 5);
  let intervalMs = Math.max(8, opts.intervalMs ?? 250);

  const seedEnd = Math.max(1, Math.floor(candles.length * seedRatio));
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
