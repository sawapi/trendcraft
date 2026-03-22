import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PrecomputedIndicators } from "../../types";
import {
  createBullishVolumeTrendEvaluator,
  createCmfNegativeEvaluator,
  createCmfPositiveEvaluator,
  createHighVolumeUpCandleEvaluator,
  createVolumeAnomalyEvaluator,
  createVolumeSpikeEvaluator,
} from "../signals/volume";

// =============================================================================
// Test Helpers
// =============================================================================

function createTestCandles(
  count: number,
  options: { startPrice?: number; trend?: "up" | "down" | "sideways"; baseVolume?: number } = {},
): NormalizedCandle[] {
  const { startPrice = 100, trend = "sideways", baseVolume = 1000000 } = options;
  const candles: NormalizedCandle[] = [];
  let price = startPrice;
  const startTime = Date.now() - count * 86400000;

  for (let i = 0; i < count; i++) {
    let delta = 0;
    if (trend === "up") delta = 0.5;
    else if (trend === "down") delta = -0.5;
    else delta = Math.sin(i * 0.5) * 0.3;

    price = price + delta;
    candles.push({
      time: startTime + i * 86400000,
      open: price - delta * 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: baseVolume,
    });
  }
  return candles;
}

// =============================================================================
// Volume Spike Evaluator
// =============================================================================

describe("createVolumeSpikeEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createVolumeSpikeEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 1 when volume >= 2x threshold via precomputed", () => {
    const evaluate = createVolumeSpikeEvaluator(1.5, 20);
    const candles = createTestCandles(25, { baseVolume: 1000000 });
    // Set current candle volume to 3x average (= 2 * threshold of 1.5)
    candles[22].volume = 3000000;
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 1000000 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(1);
  });

  it("should return scaled score between threshold and 2x threshold", () => {
    const evaluate = createVolumeSpikeEvaluator(1.5, 20);
    const candles = createTestCandles(25, { baseVolume: 1000000 });
    // Volume = 2x average, threshold = 1.5, ratio = 2
    candles[22].volume = 2000000;
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 1000000 : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // ratio=2, threshold=1.5: 0.5 + (2 - 1.5) / (1.5 * 2) = 0.5 + 0.5/3 ≈ 0.667
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1);
  });

  it("should return 0 when volume is below threshold", () => {
    const evaluate = createVolumeSpikeEvaluator(1.5, 20);
    const candles = createTestCandles(25, { baseVolume: 1000000 });
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 1000000 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when avgVol is 0", () => {
    const evaluate = createVolumeSpikeEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 0 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when avgVol is null", () => {
    const evaluate = createVolumeSpikeEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25).fill(null),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Volume Anomaly Evaluator
// =============================================================================

describe("createVolumeAnomalyEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createVolumeAnomalyEvaluator(2, 20);
    const candles = createTestCandles(25);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 0.7+ when isAnomaly and zScore exceeds threshold", () => {
    const evaluate = createVolumeAnomalyEvaluator(2, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeAnomaly: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? { ratio: 3, level: "high", isAnomaly: true, zScore: 3 } : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // isAnomaly=true, zScore=3, excess=1: min(1, 0.7 + 1 * 0.1) = 0.8
    expect(score).toBeCloseTo(0.8, 5);
  });

  it("should cap score at 1", () => {
    const evaluate = createVolumeAnomalyEvaluator(2, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeAnomaly: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20 ? { ratio: 10, level: "extreme", isAnomaly: true, zScore: 10 } : null,
        ),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    expect(score).toBe(1);
  });

  it("should return 0 when isAnomaly is false", () => {
    const evaluate = createVolumeAnomalyEvaluator(2, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeAnomaly: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20 ? { ratio: 1, level: "normal", isAnomaly: false, zScore: 0.5 } : null,
        ),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when zScore is null", () => {
    const evaluate = createVolumeAnomalyEvaluator(2, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeAnomaly: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20 ? { ratio: 3, level: "high", isAnomaly: true, zScore: null } : null,
        ),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Bullish Volume Trend Evaluator
// =============================================================================

describe("createBullishVolumeTrendEvaluator", () => {
  it("should return 0 when index < maPeriod", () => {
    const evaluate = createBullishVolumeTrendEvaluator(20);
    const candles = createTestCandles(25);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 1 when confirmed, price up, volume up", () => {
    const evaluate = createBullishVolumeTrendEvaluator(20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeTrend: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20
            ? {
                isConfirmed: true,
                priceTrend: "up",
                volumeTrend: "up",
                confidence: 80,
                hasDivergence: false,
              }
            : null,
        ),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(1);
  });

  it("should return confidence/100 when price up with high confidence", () => {
    const evaluate = createBullishVolumeTrendEvaluator(20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeTrend: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20
            ? {
                isConfirmed: false,
                priceTrend: "up",
                volumeTrend: "down",
                confidence: 85,
                hasDivergence: false,
              }
            : null,
        ),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    expect(score).toBeCloseTo(0.85, 5);
  });

  it("should return 0 when confidence <= 70", () => {
    const evaluate = createBullishVolumeTrendEvaluator(20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeTrend: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20
            ? {
                isConfirmed: false,
                priceTrend: "up",
                volumeTrend: "down",
                confidence: 50,
                hasDivergence: false,
              }
            : null,
        ),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when price trend is down", () => {
    const evaluate = createBullishVolumeTrendEvaluator(20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      volumeTrend: Array(25)
        .fill(null)
        .map((_, i) =>
          i >= 20
            ? {
                isConfirmed: true,
                priceTrend: "down",
                volumeTrend: "up",
                confidence: 80,
                hasDivergence: false,
              }
            : null,
        ),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// CMF Positive Evaluator
// =============================================================================

describe("createCmfPositiveEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createCmfPositiveEvaluator(0.1, 20);
    const candles = createTestCandles(25);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 0.5-1 scaling when CMF >= threshold", () => {
    const evaluate = createCmfPositiveEvaluator(0.1, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      cmf20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 0.1 : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // CMF=0.1, threshold=0.1: min(1, 0.1/(0.2) + 0.5) = min(1, 1.0)
    expect(score).toBe(1);
  });

  it("should return partial score for positive CMF below threshold", () => {
    const evaluate = createCmfPositiveEvaluator(0.1, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      cmf20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 0.05 : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // CMF=0.05, threshold=0.1: (0.05/0.1) * 0.5 = 0.25
    expect(score).toBeCloseTo(0.25, 5);
  });

  it("should return 0 for negative CMF", () => {
    const evaluate = createCmfPositiveEvaluator(0.1, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      cmf20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? -0.1 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when CMF is null", () => {
    const evaluate = createCmfPositiveEvaluator(0.1, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      cmf20: Array(25).fill(null),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// CMF Negative Evaluator
// =============================================================================

describe("createCmfNegativeEvaluator", () => {
  it("should return 0.5-1 scaling when CMF <= threshold", () => {
    const evaluate = createCmfNegativeEvaluator(-0.1, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      cmf20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? -0.1 : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // CMF=-0.1, threshold=-0.1: min(1, |-0.1|/(|-0.1|*2) + 0.5) = min(1, 1.0)
    expect(score).toBe(1);
  });

  it("should return partial score for negative CMF above threshold", () => {
    const evaluate = createCmfNegativeEvaluator(-0.1, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      cmf20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? -0.05 : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // CMF=-0.05, threshold=-0.1: (|-0.05|/|-0.1|) * 0.5 = 0.25
    expect(score).toBeCloseTo(0.25, 5);
  });

  it("should return 0 for positive CMF", () => {
    const evaluate = createCmfNegativeEvaluator(-0.1, 20);
    const candles = createTestCandles(25);
    const precomputed: PrecomputedIndicators = {
      cmf20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 0.1 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// High Volume Up Candle Evaluator
// =============================================================================

describe("createHighVolumeUpCandleEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createHighVolumeUpCandleEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 0 for down candle regardless of volume", () => {
    const evaluate = createHighVolumeUpCandleEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    // Force down candle
    candles[22].close = candles[22].open - 2;
    candles[22].volume = 3000000;
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 1000000 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should return 0.6+ for up candle with high volume", () => {
    const evaluate = createHighVolumeUpCandleEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    // Force up candle with large body
    candles[22].open = 95;
    candles[22].close = 105;
    candles[22].high = 106;
    candles[22].low = 94;
    candles[22].volume = 2000000;
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 1000000 : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // Up candle, ratio=2 >= 1.5, bodySize=10, range=12, bodyRatio=10/12≈0.833
    // score = min(1, 0.6 + 0.833*0.4) ≈ min(1, 0.933)
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 when volume ratio is below threshold", () => {
    const evaluate = createHighVolumeUpCandleEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    // Force up candle with normal volume
    candles[22].open = 98;
    candles[22].close = 102;
    candles[22].volume = 1000000;
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 1000000 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when avgVol is 0", () => {
    const evaluate = createHighVolumeUpCandleEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    candles[22].open = 98;
    candles[22].close = 102;
    candles[22].volume = 2000000;
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 0 : null)),
    };
    expect(evaluate(candles, 22, undefined, precomputed)).toBe(0);
  });

  it("should handle zero range candle gracefully", () => {
    const evaluate = createHighVolumeUpCandleEvaluator(1.5, 20);
    const candles = createTestCandles(25);
    // Up candle with zero range (high == low but open < close is impossible with same high/low)
    candles[22].open = 99;
    candles[22].close = 100;
    candles[22].high = 100;
    candles[22].low = 100;
    candles[22].volume = 2000000;
    const precomputed: PrecomputedIndicators = {
      volumeMa20: Array(25)
        .fill(null)
        .map((_, i) => (i >= 20 ? 1000000 : null)),
    };
    const score = evaluate(candles, 22, undefined, precomputed);
    // range=0, bodyRatio=0, score = min(1, 0.6 + 0*0.4) = 0.6
    expect(score).toBeCloseTo(0.6, 5);
  });
});
