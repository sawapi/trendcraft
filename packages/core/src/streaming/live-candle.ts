/**
 * LiveCandle — Lightweight live candle + indicator manager
 *
 * Unifies CandleAggregator with dynamically-registered incremental indicators
 * and a simple event system.
 *
 * Two input modes:
 * - **Tick mode**: `addTick(trade)` — aggregates raw trades into candles
 * - **Candle mode**: `addCandle(candle)` — feeds pre-formed candles directly
 *
 * @example
 * ```ts
 * // Tick mode
 * const live = createLiveCandle({
 *   intervalMs: 60_000,
 *   indicators: [
 *     { name: "sma20", create: (s) => createSma({ period: 20 }, { fromState: s }) },
 *   ],
 * });
 * live.on("candleComplete", ({ snapshot }) => console.log(snapshot.sma20));
 * live.addTick({ time: Date.now(), price: 150.25, volume: 100 });
 *
 * // Candle mode
 * const live2 = createLiveCandle({ indicators: [...] });
 * live2.addCandle(completedCandle);
 * live2.addCandle(formingCandle, { partial: true });
 * ```
 */

import type { NormalizedCandle } from "../types";
import { createCandleAggregator } from "./candle-aggregator";
import type {
  CandleAggregator,
  IndicatorSnapshot,
  LiveCandle,
  LiveCandleEventMap,
  LiveCandleOptions,
  LiveCandleState,
  LiveIndicatorFactory,
  Trade,
} from "./types";

type IndicatorEntry = {
  instance: ReturnType<LiveIndicatorFactory>;
  factory: LiveIndicatorFactory;
};

/**
 * Create a LiveCandle instance.
 *
 * @param options - Configuration options
 * @param fromState - Optional saved state for restoration
 * @returns A LiveCandle instance
 *
 * @example
 * ```ts
 * const live = createLiveCandle({
 *   intervalMs: 60_000,
 *   indicators: [
 *     { name: "sma20", create: (s) => createSma({ period: 20 }, { fromState: s }) },
 *     { name: "rsi14", create: (s) => createRsi({ period: 14 }, { fromState: s }) },
 *   ],
 *   history: historicalCandles,
 *   maxHistory: 500,
 * });
 *
 * live.on("tick", ({ candle, snapshot, isNewCandle }) => {
 *   updateChart(candle, snapshot);
 * });
 *
 * live.on("candleComplete", ({ candle, snapshot }) => {
 *   console.log("Candle closed:", candle.close, "SMA:", snapshot.sma20);
 * });
 *
 * // Feed ticks from a WebSocket
 * ws.on("trade", (t) => live.addTick(t));
 * ```
 */
export function createLiveCandle(
  options: LiveCandleOptions,
  fromState?: LiveCandleState,
): LiveCandle {
  const { maxHistory } = options;

  // Aggregator (tick mode only)
  let aggregator: CandleAggregator | null = null;
  if (options.intervalMs != null) {
    aggregator = createCandleAggregator(
      { intervalMs: options.intervalMs },
      fromState?.aggregatorState ?? undefined,
    );
  }

  // Internal state
  const indicators = new Map<string, IndicatorEntry>();
  const _completedCandles: NormalizedCandle[] = fromState?.completedCandles
    ? [...fromState.completedCandles]
    : [];
  const _history: NormalizedCandle[] = options.history ?? [];
  let _formingCandle: NormalizedCandle | null = null;
  let _lastSnapshot: IndicatorSnapshot = {};
  let disposed = false;

  // Event system
  const listeners = {
    tick: new Set<(payload: LiveCandleEventMap["tick"]) => void>(),
    candleComplete: new Set<(payload: LiveCandleEventMap["candleComplete"]) => void>(),
  };
  let emitting = false;
  const pendingOps: Array<() => void> = [];

  // --- Helpers ---

  function assertNotDisposed(): void {
    if (disposed) {
      throw new Error("LiveCandle is disposed");
    }
  }

  function buildSnapshot(mode: "next" | "peek", candle: NormalizedCandle): IndicatorSnapshot {
    const snap: IndicatorSnapshot = {};
    for (const [name, entry] of indicators) {
      snap[name] =
        mode === "next" ? entry.instance.next(candle).value : entry.instance.peek(candle).value;
    }
    return snap;
  }

  function pushCompleted(candle: NormalizedCandle): void {
    _completedCandles.push(candle);
    if (maxHistory != null && _completedCandles.length > maxHistory) {
      _completedCandles.splice(0, _completedCandles.length - maxHistory);
    }
  }

  function emit<K extends keyof LiveCandleEventMap>(
    event: K,
    payload: LiveCandleEventMap[K],
  ): void {
    for (const cb of listeners[event]) {
      (cb as (p: LiveCandleEventMap[K]) => void)(payload);
    }
  }

  function drainPending(): void {
    while (pendingOps.length > 0) {
      const op = pendingOps.shift();
      if (op) op();
    }
  }

  function warmUpIndicator(instance: ReturnType<LiveIndicatorFactory>): void {
    for (const candle of _history) {
      instance.next(candle);
    }
    for (const candle of _completedCandles) {
      instance.next(candle);
    }
  }

  // --- Register initial indicators ---

  const stateMap = new Map<string, unknown>();
  if (fromState?.indicatorEntries) {
    for (const e of fromState.indicatorEntries) {
      stateMap.set(e.name, e.state);
    }
  }

  if (options.indicators) {
    for (const cfg of options.indicators) {
      const savedState = cfg.state ?? stateMap.get(cfg.name);
      const instance = cfg.create(savedState);
      if (!savedState) {
        warmUpIndicator(instance);
      }
      indicators.set(cfg.name, { instance, factory: cfg.create });
    }
  }

  // --- Process helpers ---

  function processAddTick(trade: Trade): void {
    assertNotDisposed();

    if (!aggregator) {
      throw new Error("intervalMs is required for addTick");
    }

    if (emitting) {
      pendingOps.push(() => processAddTick(trade));
      return;
    }

    emitting = true;
    try {
      const completed = aggregator.addTrade(trade);
      let isNewCandle = false;

      if (completed) {
        isNewCandle = true;
        pushCompleted(completed);
        const nextSnap = buildSnapshot("next", completed);
        emit("candleComplete", { candle: completed, snapshot: nextSnap });
      }

      const forming = aggregator.getCurrentCandle();
      if (forming) {
        _formingCandle = forming;
        const peekSnap = buildSnapshot("peek", forming);
        _lastSnapshot = peekSnap;
        emit("tick", { candle: forming, snapshot: peekSnap, isNewCandle });
      }
    } finally {
      emitting = false;
    }
    drainPending();
  }

  function processAddCandle(candle: NormalizedCandle, opts?: { partial?: boolean }): void {
    assertNotDisposed();

    if (emitting) {
      pendingOps.push(() => processAddCandle(candle, opts));
      return;
    }

    emitting = true;
    try {
      if (opts?.partial) {
        _formingCandle = candle;
        const peekSnap = buildSnapshot("peek", candle);
        _lastSnapshot = peekSnap;
        emit("tick", { candle, snapshot: peekSnap, isNewCandle: false });
      } else {
        pushCompleted(candle);
        _formingCandle = null;
        const nextSnap = buildSnapshot("next", candle);
        _lastSnapshot = nextSnap;
        emit("candleComplete", { candle, snapshot: nextSnap });
        emit("tick", { candle, snapshot: nextSnap, isNewCandle: true });
      }
    } finally {
      emitting = false;
    }
    drainPending();
  }

  // --- Build LiveCandle object ---

  return {
    addTick(trade: Trade): void {
      processAddTick(trade);
    },

    addCandle(candle: NormalizedCandle, opts?: { partial?: boolean }): void {
      processAddCandle(candle, opts);
    },

    addIndicator(name: string, create: LiveIndicatorFactory, state?: unknown): void {
      assertNotDisposed();
      if (indicators.has(name)) {
        throw new Error(`Indicator "${name}" already registered`);
      }
      const instance = create(state);
      if (!state) {
        warmUpIndicator(instance);
      }
      indicators.set(name, { instance, factory: create });
    },

    removeIndicator(name: string): void {
      indicators.delete(name);
    },

    get candle(): NormalizedCandle | null {
      return _formingCandle;
    },

    get completedCandles(): readonly NormalizedCandle[] {
      return _completedCandles;
    },

    getIndicator(name: string): unknown {
      return _lastSnapshot[name];
    },

    get snapshot(): IndicatorSnapshot {
      return { ..._lastSnapshot };
    },

    on<K extends keyof LiveCandleEventMap>(
      event: K,
      cb: (payload: LiveCandleEventMap[K]) => void,
    ): () => void {
      const set = listeners[event] as Set<(payload: LiveCandleEventMap[K]) => void>;
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },

    flush(): NormalizedCandle | null {
      if (!aggregator) return null;
      const flushed = aggregator.flush();
      if (!flushed) return null;

      pushCompleted(flushed);
      _formingCandle = null;
      const nextSnap = buildSnapshot("next", flushed);
      _lastSnapshot = nextSnap;

      emitting = true;
      try {
        emit("candleComplete", { candle: flushed, snapshot: nextSnap });
      } finally {
        emitting = false;
      }
      drainPending();

      return flushed;
    },

    getState(): LiveCandleState {
      return {
        aggregatorState: aggregator?.getState() ?? null,
        indicatorEntries: Array.from(indicators).map(([name, entry]) => ({
          name,
          state: entry.instance.getState(),
        })),
        completedCandles: [..._completedCandles],
      };
    },

    dispose(): void {
      listeners.tick.clear();
      listeners.candleComplete.clear();
      indicators.clear();
      _completedCandles.length = 0;
      pendingOps.length = 0;
      _formingCandle = null;
      _lastSnapshot = {};
      disposed = true;
    },
  };
}
