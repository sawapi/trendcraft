/**
 * Incremental Volume Anomaly Detection
 *
 * Detects abnormal volume spikes using ratio and z-score methods.
 */

import type { NormalizedCandle, VolumeAnomalyValue } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type VolumeAnomalyState = {
  period: number;
  highThreshold: number;
  extremeThreshold: number;
  useZScore: boolean;
  zScoreThreshold: number;
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Volume Anomaly indicator
 *
 * @example
 * ```ts
 * const va = createVolumeAnomaly({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = va.next(candle);
 *   if (value.isAnomaly) console.log(value.level, value.ratio);
 * }
 * ```
 */
export function createVolumeAnomaly(
  options: {
    period?: number;
    highThreshold?: number;
    extremeThreshold?: number;
    useZScore?: boolean;
    zScoreThreshold?: number;
  } = {},
  warmUpOptions?: WarmUpOptions<VolumeAnomalyState>,
): IncrementalIndicator<VolumeAnomalyValue, VolumeAnomalyState> {
  const period = options.period ?? 20;
  const highThreshold = options.highThreshold ?? 2.0;
  const extremeThreshold = options.extremeThreshold ?? 3.0;
  const useZScore = options.useZScore ?? true;
  const zScoreThreshold = options.zScoreThreshold ?? 2.0;

  let buffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function compute(volume: number): VolumeAnomalyValue {
    if (count < period) {
      return {
        volume,
        avgVolume: volume,
        ratio: 1,
        isAnomaly: false,
        level: null,
        zScore: null,
      };
    }

    // Calculate mean and stddev from buffer
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = buffer.get(i);
      sum += v;
      sumSq += v * v;
    }

    const avgVolume = sum / period;
    const variance = sumSq / period - avgVolume * avgVolume;
    const stdDev = Math.sqrt(Math.max(0, variance));

    const ratio = avgVolume > 0 ? volume / avgVolume : 1;
    const zScore = stdDev > 0 ? (volume - avgVolume) / stdDev : null;

    let isAnomaly = false;
    let level: "normal" | "high" | "extreme" | null = "normal";

    if (ratio >= extremeThreshold) {
      isAnomaly = true;
      level = "extreme";
    } else if (ratio >= highThreshold) {
      isAnomaly = true;
      level = "high";
    }

    if (useZScore && zScore !== null && zScore >= zScoreThreshold) {
      isAnomaly = true;
      if (zScore >= zScoreThreshold * 1.5 && level !== "extreme") {
        level = "extreme";
      } else if (level === "normal") {
        level = "high";
      }
    }

    return { volume, avgVolume, ratio, isAnomaly, level, zScore };
  }

  const indicator: IncrementalIndicator<VolumeAnomalyValue, VolumeAnomalyState> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = compute(candle.volume);
      buffer.push(candle.volume);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      return { time: candle.time, value: compute(candle.volume) };
    },

    getState(): VolumeAnomalyState {
      return {
        period,
        highThreshold,
        extremeThreshold,
        useZScore,
        zScoreThreshold,
        buffer: buffer.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
