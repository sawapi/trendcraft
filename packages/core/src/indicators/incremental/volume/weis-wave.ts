/**
 * Incremental Weis Wave Volume
 *
 * Accumulates volume within directional price waves.
 * When price direction reverses (exceeding threshold), a new wave begins.
 *
 * State category: **Recursive** (`waveVolume` is a cumulative
 * accumulator whose reset points depend on `method` / `threshold`).
 * Resume with a different `method` or `threshold` is refused — the
 * saved wave was accumulated under the old reversal rule.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

export type WeisWaveValue = {
  waveVolume: number;
  direction: "up" | "down";
};

/**
 * Bare state shape for Weis Wave. Params (`method`, `threshold`) live
 * in `meta.params`.
 */
export type WeisWaveState = {
  waveVolume: number;
  direction: "up" | "down";
  prevCandle: { close: number; high: number; low: number } | null;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const WEIS_WAVE_VERSION = 1;

type WeisWaveParams = {
  method: "close" | "highlow";
  threshold: number;
};

/**
 * Create an incremental Weis Wave Volume indicator
 *
 * @param options - Configuration options
 * @param options.method - Direction detection method: 'close' or 'highlow' (default: 'close')
 * @param options.threshold - Minimum price change to trigger reversal (default: 0)
 *
 * @example
 * ```ts
 * const weis = createWeisWave({ method: 'close', threshold: 0 });
 * for (const candle of stream) {
 *   const { value } = weis.next(candle);
 *   console.log(value.waveVolume, value.direction);
 * }
 * ```
 */
export function createWeisWave(
  options: { method?: "close" | "highlow"; threshold?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<WeisWaveState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<WeisWaveValue, IndicatorSnapshot<WeisWaveState>> {
  const { params, state } = resolveResume<WeisWaveParams, WeisWaveState>({
    indicator: "weisWave",
    version: WEIS_WAVE_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { method: "close", threshold: 0 },
  });

  const method = requireParam(
    "weisWave",
    params,
    "method",
    (v): v is "close" | "highlow" => v === "close" || v === "highlow",
    'must be "close" or "highlow"',
  );
  const threshold = requireParam(
    "weisWave",
    params,
    "threshold",
    (v): v is number => typeof v === "number" && v >= 0,
    "must be a non-negative number",
  );

  let waveVolume: number;
  let direction: "up" | "down";
  let prevCandle: { close: number; high: number; low: number } | null;
  let count: number;

  if (state !== null) {
    waveVolume = state.waveVolume;
    direction = state.direction;
    prevCandle = state.prevCandle;
    count = state.count;
  } else {
    waveVolume = 0;
    direction = "up";
    prevCandle = null;
    count = 0;
  }

  function getMove(candle: NormalizedCandle): number {
    if (prevCandle === null) return 0;
    if (method === "highlow") {
      return (candle.high + candle.low) / 2 - (prevCandle.high + prevCandle.low) / 2;
    }
    return candle.close - prevCandle.close;
  }

  function processCandle(candle: NormalizedCandle): WeisWaveValue {
    if (prevCandle === null) {
      // First bar. The batch indicator seeds bar-0 direction from the
      // bar0->bar1 move, which a streaming consumer cannot see yet, so
      // "up" is a provisional label until the first move is observed.
      waveVolume = candle.volume;
      direction = "up";
      prevCandle = { close: candle.close, high: candle.high, low: candle.low };
      return { waveVolume, direction };
    }

    const move = getMove(candle);
    const newDir: "up" | "down" = move >= 0 ? "up" : "down";

    if (count === 2) {
      // Second bar: the first observed move defines the initial wave
      // direction — the batch seeds bar-0 direction from this same move
      // with no threshold applied — so it can never be a reversal.
      // Adopt it and keep accumulating on top of bar 0's volume;
      // resetting here dropped bar 0 from the entire first wave.
      direction = newDir;
      waveVolume += candle.volume;
    } else if (newDir !== direction && Math.abs(move) > threshold) {
      // Direction reversal - start new wave
      direction = newDir;
      waveVolume = candle.volume;
    } else {
      // Continue current wave
      waveVolume += candle.volume;
    }

    prevCandle = { close: candle.close, high: candle.high, low: candle.low };
    return { waveVolume, direction };
  }

  const indicator: IncrementalIndicator<WeisWaveValue, IndicatorSnapshot<WeisWaveState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Run the real `next()` and put the saved state back, instead of
      // hand-maintaining a mirror of `processCandle` — a mirror has to
      // restate every rule (first bar, second-bar adoption, reversal)
      // and silently drifts when one changes. Restoring after is safe
      // here: `next()` replaces `prevCandle` with a fresh object and
      // the other fields are primitives, so nothing the caller ever
      // received is mutated.
      const saved = { waveVolume, direction, prevCandle, count };
      const result = indicator.next(candle);
      waveVolume = saved.waveVolume;
      direction = saved.direction;
      prevCandle = saved.prevCandle;
      count = saved.count;
      return result;
    },

    getState(): IndicatorSnapshot<WeisWaveState> {
      return makeSnapshot(
        "weisWave",
        WEIS_WAVE_VERSION,
        { method, threshold },
        { waveVolume, direction, prevCandle, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 1;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
