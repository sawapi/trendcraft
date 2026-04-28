/**
 * Live Simulator — drives a `createLiveCandle` instance from a static candle
 * array on a timer, splitting each pending candle into N intra-candle ticks
 * before the final candleComplete.
 *
 * Used by the showcase Live Mode to demonstrate `connectIndicators({ live })`
 * (series indicators) and `connectLivePrimitives` (primitive plugins) against
 * a deterministic, replayable stream.
 */

import { type NormalizedCandle, createLiveCandle } from "trendcraft";

type LiveCandle = ReturnType<typeof createLiveCandle>;

/** Duck-typed LiveSource — same shape `connectIndicators` and `connectLivePrimitives` expect. */
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
  /** Inter-frame interval in ms. Default 250 (= 1x). */
  setIntervalMs(ms: number): void;
  /** Rewind to seed-only. Cancels playback. Note: replaces the LiveCandle
   * instance — callers that captured `live` directly should re-read it. */
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

  function step(): void {
    if (state !== "playing") return;
    if (nextIdx >= queue.length) {
      state = "complete";
      stopTimer();
      notify();
      return;
    }
    const target = queue[nextIdx];

    if (tickIdx < ticksPerCandle - 1) {
      live.addCandle(buildPartial(target, tickIdx + 1, ticksPerCandle), { partial: true });
      tickIdx++;
    } else {
      live.addCandle(target);
      nextIdx++;
      tickIdx = 0;
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
