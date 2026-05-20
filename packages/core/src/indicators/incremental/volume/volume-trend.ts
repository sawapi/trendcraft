/**
 * Incremental Volume Trend Confirmation
 *
 * Analyzes whether volume confirms or diverges from price trend
 * using rolling windows for price linear regression and volume comparison.
 *
 * State category: **Windowed** (three fixed-size raw buffers — closes,
 * volumes, and volume-MA volumes — plus a running volume sum). Resume
 * with different `pricePeriod` / `volumePeriod` / `maPeriod` carries
 * the raw buffers forward at the new capacities and recomputes the
 * volume-MA running sum. `minPriceChange` is resume-invariant — it
 * only classifies the already-computed trend, never the buffers.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, VolumeTrendValue } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for Volume Trend. Params (`pricePeriod`,
 * `volumePeriod`, `maPeriod`, `minPriceChange`) live in `meta.params`.
 */
export type VolumeTrendState = {
  priceBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  volumeBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  volumeSum: number;
  volumeMaBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const VOLUME_TREND_VERSION = 1;

type VolumeTrendParams = {
  pricePeriod: number;
  volumePeriod: number;
  maPeriod: number;
  minPriceChange: number;
};

/**
 * Create an incremental Volume Trend indicator
 *
 * Analyzes price trend (via linear regression) and volume trend (first-half vs second-half)
 * to determine confirmation or divergence.
 *
 * @param options - Configuration options
 * @param options.pricePeriod - Period for price trend detection (default: 10)
 * @param options.volumePeriod - Period for volume trend detection (default: 10)
 * @param options.maPeriod - Period for volume moving average (default: 20)
 * @param options.minPriceChange - Minimum % change for price trend (default: 2.0)
 *
 * @example
 * ```ts
 * const vt = createVolumeTrend({ pricePeriod: 10, volumePeriod: 10 });
 * for (const candle of stream) {
 *   const { value } = vt.next(candle);
 *   if (vt.isWarmedUp) {
 *     console.log(value.priceTrend, value.volumeTrend, value.isConfirmed);
 *   }
 * }
 * ```
 */
export function createVolumeTrend(
  options: {
    pricePeriod?: number;
    volumePeriod?: number;
    maPeriod?: number;
    minPriceChange?: number;
  } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<VolumeTrendState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<VolumeTrendValue, IndicatorSnapshot<VolumeTrendState>> {
  const { params, state, reconfigured } = resolveResume<VolumeTrendParams, VolumeTrendState>({
    indicator: "volumeTrend",
    version: VOLUME_TREND_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { pricePeriod: 10, volumePeriod: 10, maPeriod: 20, minPriceChange: 2.0 },
    resumeInvariantParams: ["minPriceChange"],
  });

  const pricePeriod = requireParam(
    "volumeTrend",
    params,
    "pricePeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const volumePeriod = requireParam(
    "volumeTrend",
    params,
    "volumePeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const maPeriod = requireParam(
    "volumeTrend",
    params,
    "maPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const minPriceChange = params.minPriceChange;

  let priceBuffer: CircularBuffer<number>;
  let volumeBuffer: CircularBuffer<number>;
  let volumeSum: number;
  let volumeMaBuffer: CircularBuffer<number>;
  let count: number;

  /** Rebuild a buffer at `capacity`, carrying the most recent values forward. */
  function carryBuffer(
    snapshot: ReturnType<CircularBuffer<number>["snapshot"]>,
    capacity: number,
  ): CircularBuffer<number> {
    const old = CircularBuffer.fromSnapshot(snapshot);
    const next = new CircularBuffer<number>(capacity);
    const carry = Math.min(old.length, capacity);
    for (let i = old.length - carry; i < old.length; i++) {
      next.push(old.get(i));
    }
    return next;
  }

  if (state !== null) {
    if (reconfigured) {
      // One or more periods changed — carry every raw buffer forward
      // at its new capacity and recompute the volume-MA running sum.
      priceBuffer = carryBuffer(state.priceBuffer, pricePeriod);
      volumeBuffer = carryBuffer(state.volumeBuffer, volumePeriod);
      volumeMaBuffer = carryBuffer(state.volumeMaBuffer, maPeriod);
      volumeSum = 0;
      for (let i = 0; i < volumeMaBuffer.length; i++) {
        volumeSum += volumeMaBuffer.get(i);
      }
    } else {
      priceBuffer = CircularBuffer.fromSnapshot(state.priceBuffer);
      volumeBuffer = CircularBuffer.fromSnapshot(state.volumeBuffer);
      volumeMaBuffer = CircularBuffer.fromSnapshot(state.volumeMaBuffer);
      volumeSum = state.volumeSum;
    }
    count = state.count;
  } else {
    priceBuffer = new CircularBuffer<number>(pricePeriod);
    volumeBuffer = new CircularBuffer<number>(volumePeriod);
    volumeSum = 0;
    volumeMaBuffer = new CircularBuffer<number>(maPeriod);
    count = 0;
  }

  const neutralValue: VolumeTrendValue = {
    priceTrend: "neutral",
    volumeTrend: "neutral",
    isConfirmed: false,
    hasDivergence: false,
    confidence: 0,
  };

  function analyzePriceTrend(): { direction: "up" | "down" | "neutral"; strength: number } {
    const n = priceBuffer.length;
    if (n < 2) return { direction: "neutral", strength: 0 };

    const first = priceBuffer.get(0);
    const last = priceBuffer.get(n - 1);
    const change = first > 0 ? ((last - first) / first) * 100 : 0;

    // Linear regression slope
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const val = priceBuffer.get(i);
      sumX += i;
      sumY += val;
      sumXY += i * val;
      sumX2 += i * i;
    }

    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const avgPrice = sumY / n;
    const normalizedSlope = avgPrice > 0 ? (slope / avgPrice) * 100 : 0;

    let direction: "up" | "down" | "neutral";
    if (change > minPriceChange && normalizedSlope > 0) {
      direction = "up";
    } else if (change < -minPriceChange && normalizedSlope < 0) {
      direction = "down";
    } else {
      direction = "neutral";
    }

    const strength = Math.min(Math.abs(change) / (minPriceChange * 2), 1);
    return { direction, strength };
  }

  function analyzeVolumeTrend(currentVolume: number): {
    direction: "up" | "down" | "neutral";
    strength: number;
  } {
    const n = volumeBuffer.length;
    if (n < 2) return { direction: "neutral", strength: 0 };

    const halfN = Math.floor(n / 2);
    let firstHalfSum = 0;
    let secondHalfSum = 0;

    for (let i = 0; i < halfN; i++) {
      firstHalfSum += volumeBuffer.get(i);
    }
    for (let i = halfN; i < n; i++) {
      secondHalfSum += volumeBuffer.get(i);
    }

    const firstHalfAvg = firstHalfSum / halfN;
    const secondHalfAvg = secondHalfSum / (n - halfN);

    let direction: "up" | "down" | "neutral";
    let strength = 0;

    if (firstHalfAvg > 0) {
      const volumeChange = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

      if (volumeChange > 0.1) {
        direction = "up";
        strength = Math.min(volumeChange, 1);
      } else if (volumeChange < -0.1) {
        direction = "down";
        strength = Math.min(Math.abs(volumeChange), 1);
      } else {
        direction = "neutral";
      }
    } else {
      direction = "neutral";
    }

    // Boost strength if current volume significantly above MA
    if (volumeMaBuffer.isFull) {
      const ma = volumeSum / maPeriod;
      if (ma > 0) {
        const volumeRatio = currentVolume / ma;
        if (volumeRatio > 1.5) {
          strength = Math.min(strength + 0.3, 1);
        }
      }
    }

    return { direction, strength };
  }

  function evaluate(
    priceTrend: { direction: "up" | "down" | "neutral"; strength: number },
    volTrend: { direction: "up" | "down" | "neutral"; strength: number },
  ): VolumeTrendValue {
    if (priceTrend.direction === "neutral") {
      return neutralValue;
    }

    const isConfirmed =
      (priceTrend.direction === "up" && volTrend.direction === "up") ||
      (priceTrend.direction === "down" && volTrend.direction === "up");

    const hasDivergence =
      (priceTrend.direction === "up" && volTrend.direction === "down") ||
      (priceTrend.direction === "down" && volTrend.direction === "down");

    let confidence = 0;
    if (isConfirmed) {
      confidence = ((priceTrend.strength + volTrend.strength) / 2) * 100;
    } else if (hasDivergence) {
      confidence = ((priceTrend.strength + volTrend.strength) / 2) * 80;
    }

    return {
      priceTrend: priceTrend.direction,
      volumeTrend: volTrend.direction,
      isConfirmed,
      hasDivergence,
      confidence: Math.round(confidence),
    };
  }

  function processCandle(candle: NormalizedCandle): VolumeTrendValue {
    // Update price buffer
    priceBuffer.push(candle.close);

    // Update volume buffer
    volumeBuffer.push(candle.volume);

    // Update volume MA running sum
    if (volumeMaBuffer.isFull) {
      volumeSum -= volumeMaBuffer.oldest();
    }
    volumeSum += candle.volume;
    volumeMaBuffer.push(candle.volume);

    // Gate on buffer fill, not `count`: after a period-growing resume
    // the carried buffers are shorter than the old `count`.
    if (!priceBuffer.isFull || !volumeBuffer.isFull || !volumeMaBuffer.isFull) {
      return neutralValue;
    }

    const priceTrend = analyzePriceTrend();
    const volTrend = analyzeVolumeTrend(candle.volume);
    return evaluate(priceTrend, volTrend);
  }

  const indicator: IncrementalIndicator<VolumeTrendValue, IndicatorSnapshot<VolumeTrendState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // For peek we simulate without mutating state. After the
      // simulated push each buffer is full iff it currently holds
      // at least `period - 1` values.
      if (
        priceBuffer.length < pricePeriod - 1 ||
        volumeBuffer.length < volumePeriod - 1 ||
        volumeMaBuffer.length < maPeriod - 1
      ) {
        return { time: candle.time, value: neutralValue };
      }

      // Simulate price buffer with new value
      const tempPrices: number[] = [];
      const pLen = priceBuffer.length;
      const startIdx = pLen >= pricePeriod - 1 ? pLen - pricePeriod + 1 : 0;
      for (let i = startIdx; i < pLen; i++) {
        tempPrices.push(priceBuffer.get(i));
      }
      tempPrices.push(candle.close);

      // Price trend analysis
      const n = tempPrices.length;
      const first = tempPrices[0];
      const last = tempPrices[n - 1];
      const change = first > 0 ? ((last - first) / first) * 100 : 0;

      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += tempPrices[i];
        sumXY += i * tempPrices[i];
        sumX2 += i * i;
      }
      const denom = n * sumX2 - sumX * sumX;
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const avgPrice = sumY / n;
      const normalizedSlope = avgPrice > 0 ? (slope / avgPrice) * 100 : 0;

      let priceDir: "up" | "down" | "neutral";
      if (change > minPriceChange && normalizedSlope > 0) priceDir = "up";
      else if (change < -minPriceChange && normalizedSlope < 0) priceDir = "down";
      else priceDir = "neutral";
      const priceStrength = Math.min(Math.abs(change) / (minPriceChange * 2), 1);

      // Simulate volume buffer with new value
      const tempVols: number[] = [];
      const vLen = volumeBuffer.length;
      const vStartIdx = vLen >= volumePeriod - 1 ? vLen - volumePeriod + 1 : 0;
      for (let i = vStartIdx; i < vLen; i++) {
        tempVols.push(volumeBuffer.get(i));
      }
      tempVols.push(candle.volume);

      const vn = tempVols.length;
      const halfN = Math.floor(vn / 2);
      let firstHalfSum = 0;
      let secondHalfSum = 0;
      for (let i = 0; i < halfN; i++) firstHalfSum += tempVols[i];
      for (let i = halfN; i < vn; i++) secondHalfSum += tempVols[i];

      const firstHalfAvg = firstHalfSum / halfN;
      const secondHalfAvg = secondHalfSum / (vn - halfN);

      let volDir: "up" | "down" | "neutral" = "neutral";
      let volStrength = 0;

      if (firstHalfAvg > 0) {
        const volumeChange = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
        if (volumeChange > 0.1) {
          volDir = "up";
          volStrength = Math.min(volumeChange, 1);
        } else if (volumeChange < -0.1) {
          volDir = "down";
          volStrength = Math.min(Math.abs(volumeChange), 1);
        }
      }

      // Volume MA boost
      let peekVolSum = volumeSum;
      if (volumeMaBuffer.isFull) {
        peekVolSum -= volumeMaBuffer.oldest();
      }
      peekVolSum += candle.volume;
      const peekMaLen = Math.min(volumeMaBuffer.length + 1, maPeriod);
      if (peekMaLen >= maPeriod) {
        const ma = peekVolSum / maPeriod;
        if (ma > 0 && candle.volume / ma > 1.5) {
          volStrength = Math.min(volStrength + 0.3, 1);
        }
      }

      const priceTrend = { direction: priceDir, strength: priceStrength };
      const volTrend = { direction: volDir, strength: volStrength };

      return { time: candle.time, value: evaluate(priceTrend, volTrend) };
    },

    getState(): IndicatorSnapshot<VolumeTrendState> {
      return makeSnapshot(
        "volumeTrend",
        VOLUME_TREND_VERSION,
        { pricePeriod, volumePeriod, maPeriod, minPriceChange },
        {
          priceBuffer: priceBuffer.snapshot(),
          volumeBuffer: volumeBuffer.snapshot(),
          volumeSum,
          volumeMaBuffer: volumeMaBuffer.snapshot(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return priceBuffer.isFull && volumeBuffer.isFull && volumeMaBuffer.isFull;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
