/**
 * Weis Wave Volume
 *
 * Accumulates volume within price waves (directional moves).
 * When the price direction reverses, a new wave begins.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Weis Wave value
 */
export type WeisWaveValue = {
  /** Cumulative volume for the current wave */
  waveVolume: number;
  /** Current wave direction */
  direction: "up" | "down";
};

/**
 * Weis Wave options
 */
export type WeisWaveOptions = {
  /** Price method for direction detection: 'close' or 'highlow' (default: 'close') */
  method?: "close" | "highlow";
  /** Minimum price change to trigger a new wave (default: 0) */
  threshold?: number;
};

/**
 * Calculate Weis Wave Volume
 *
 * Accumulates volume while price moves in one direction.
 * When price reverses (based on close or high/low), a new wave starts.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of Weis Wave values
 *
 * @example
 * ```ts
 * const waves = weisWave(candles);
 * ```
 */
export function weisWave(
  candles: Candle[] | NormalizedCandle[],
  options: WeisWaveOptions = {},
): Series<WeisWaveValue> {
  const { method = "close", threshold = 0 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<WeisWaveValue> = [];
  let currentDirection: "up" | "down" = "up";
  let waveVolume = normalized[0].volume;

  // Initialize direction from first two bars if available
  if (normalized.length >= 2) {
    const priceChange = getDirectionChange(normalized[0], normalized[1], method);
    currentDirection = priceChange >= 0 ? "up" : "down";
  }

  result.push({
    time: normalized[0].time,
    value: { waveVolume, direction: currentDirection },
  });

  for (let i = 1; i < normalized.length; i++) {
    const priceChange = getDirectionChange(normalized[i - 1], normalized[i], method);
    const absChange = Math.abs(priceChange);

    // Check if direction reverses
    const newDirection: "up" | "down" = priceChange >= 0 ? "up" : "down";
    const reversed = newDirection !== currentDirection && absChange > threshold;

    if (reversed) {
      currentDirection = newDirection;
      waveVolume = normalized[i].volume;
    } else {
      waveVolume += normalized[i].volume;
    }

    result.push({
      time: normalized[i].time,
      value: { waveVolume, direction: currentDirection },
    });
  }

  return result;
}

/**
 * Get directional price change between two candles
 */
function getDirectionChange(
  prev: NormalizedCandle,
  curr: NormalizedCandle,
  method: "close" | "highlow",
): number {
  if (method === "highlow") {
    const midPrev = (prev.high + prev.low) / 2;
    const midCurr = (curr.high + curr.low) / 2;
    return midCurr - midPrev;
  }
  return curr.close - prev.close;
}
