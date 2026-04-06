/**
 * Incremental Weis Wave Volume
 *
 * Accumulates volume within directional price waves.
 * When price direction reverses (exceeding threshold), a new wave begins.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type WeisWaveValue = {
  waveVolume: number;
  direction: "up" | "down";
};

export type WeisWaveState = {
  waveVolume: number;
  direction: "up" | "down";
  prevCandle: { close: number; high: number; low: number } | null;
  method: string;
  threshold: number;
  count: number;
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
  warmUpOptions?: WarmUpOptions<WeisWaveState>,
): IncrementalIndicator<WeisWaveValue, WeisWaveState> {
  const method = options.method ?? "close";
  const threshold = options.threshold ?? 0;

  let waveVolume: number;
  let direction: "up" | "down";
  let prevCandle: { close: number; high: number; low: number } | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    waveVolume = s.waveVolume;
    direction = s.direction;
    prevCandle = s.prevCandle;
    count = s.count;
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
      // First bar
      waveVolume = candle.volume;
      direction = "up";
      prevCandle = { close: candle.close, high: candle.high, low: candle.low };
      return { waveVolume, direction };
    }

    const move = getMove(candle);
    const newDir: "up" | "down" = move >= 0 ? "up" : "down";

    if (newDir !== direction && Math.abs(move) > threshold) {
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

  const indicator: IncrementalIndicator<WeisWaveValue, WeisWaveState> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      if (prevCandle === null) {
        return {
          time: candle.time,
          value: { waveVolume: candle.volume, direction: "up" as const },
        };
      }

      const move = getMove(candle);
      const newDir: "up" | "down" = move >= 0 ? "up" : "down";

      let peekVolume: number;
      let peekDir: "up" | "down";

      if (newDir !== direction && Math.abs(move) > threshold) {
        peekDir = newDir;
        peekVolume = candle.volume;
      } else {
        peekDir = direction;
        peekVolume = waveVolume + candle.volume;
      }

      return { time: candle.time, value: { waveVolume: peekVolume, direction: peekDir } };
    },

    getState(): WeisWaveState {
      return { waveVolume, direction, prevCandle, method, threshold, count };
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
