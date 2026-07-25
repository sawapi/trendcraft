/**
 * Incremental Volume Anomaly Detection
 *
 * Detects abnormal volume spikes using ratio and z-score methods.
 *
 * State category: **Windowed** (a single fixed-size raw volume
 * buffer). Resume with a different `period` carries the raw volume
 * buffer forward. `highThreshold` / `extremeThreshold` / `useZScore` /
 * `zScoreThreshold` are resume-invariant — they only classify the
 * already-computed ratio / z-score, never the buffer.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import { centeredMoments } from "../../../core/statistics";
import type { NormalizedCandle, VolumeAnomalyValue } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for Volume Anomaly. Params (`period`,
 * `highThreshold`, `extremeThreshold`, `useZScore`, `zScoreThreshold`)
 * live in `meta.params`.
 */
export type VolumeAnomalyState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const VOLUME_ANOMALY_VERSION = 1;

type VolumeAnomalyParams = {
  period: number;
  highThreshold: number;
  extremeThreshold: number;
  useZScore: boolean;
  zScoreThreshold: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<VolumeAnomalyState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<VolumeAnomalyValue, IndicatorSnapshot<VolumeAnomalyState>> {
  const { params, state, reconfigured } = resolveResume<VolumeAnomalyParams, VolumeAnomalyState>({
    indicator: "volumeAnomaly",
    version: VOLUME_ANOMALY_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: {
      period: 20,
      highThreshold: 2.0,
      extremeThreshold: 3.0,
      useZScore: true,
      zScoreThreshold: 2.0,
    },
    resumeInvariantParams: ["highThreshold", "extremeThreshold", "useZScore", "zScoreThreshold"],
  });

  const period = requireParam(
    "volumeAnomaly",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const highThreshold = params.highThreshold;
  const extremeThreshold = params.extremeThreshold;
  const useZScore = params.useZScore;
  const zScoreThreshold = params.zScoreThreshold;

  let buffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the raw volume buffer forward.
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
    }
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function computeFromBuffer(volume: number, buf: CircularBuffer<number>): VolumeAnomalyValue {
    // Batch computes stats over [i-period+1 ... i] (including current candle)
    // When called, buffer already contains the current volume
    if (buf.length < period) {
      return {
        volume,
        avgVolume: volume,
        ratio: 1,
        isAnomaly: false,
        level: null,
        zScore: null,
      };
    }

    // Two-pass, matching the batch indicator: the one-pass form collapses the
    // variance to zero when volumes are large relative to their spread, which
    // silently disables the z-score branch. See centeredMoments.
    const { mean: avgVolume, sumSqDev } = centeredMoments(buf.toArray());
    const stdDev = Math.sqrt(sumSqDev / period);

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

  const indicator: IncrementalIndicator<
    VolumeAnomalyValue,
    IndicatorSnapshot<VolumeAnomalyState>
  > = {
    next(candle: NormalizedCandle) {
      count++;
      buffer.push(candle.volume);
      const value = computeFromBuffer(candle.volume, buffer);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Simulate buffer with current volume added
      const peekBuf = CircularBuffer.fromSnapshot<number>(buffer.snapshot());
      peekBuf.push(candle.volume);
      return { time: candle.time, value: computeFromBuffer(candle.volume, peekBuf) };
    },

    getState(): IndicatorSnapshot<VolumeAnomalyState> {
      return makeSnapshot(
        "volumeAnomaly",
        VOLUME_ANOMALY_VERSION,
        { period, highThreshold, extremeThreshold, useZScore, zScoreThreshold },
        { buffer: buffer.snapshot(), count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
