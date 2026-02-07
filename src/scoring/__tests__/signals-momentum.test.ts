import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PrecomputedIndicators } from "../../types";
import {
  createMacdBearishEvaluator,
  createMacdBullishEvaluator,
  createRsiNeutralEvaluator,
  createRsiOverboughtEvaluator,
  createRsiOversoldEvaluator,
  createStochBullishCrossEvaluator,
  createStochOverboughtEvaluator,
  createStochOversoldEvaluator,
} from "../signals/momentum";

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
// RSI Oversold Evaluator
// =============================================================================

describe("createRsiOversoldEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createRsiOversoldEvaluator(30, 14);
    const candles = createTestCandles(20);
    expect(evaluate(candles, 5)).toBe(0);
  });

  it("should return 1 when RSI <= threshold via precomputed", () => {
    const evaluate = createRsiOversoldEvaluator(30, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 25 : null)),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(1);
  });

  it("should return gradual falloff for RSI between threshold and threshold+10", () => {
    const evaluate = createRsiOversoldEvaluator(30, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 35 : null)),
    };
    const score = evaluate(candles, 15, undefined, precomputed);
    // RSI=35, threshold=30: 1 - (35-30)/10 = 0.5
    expect(score).toBeCloseTo(0.5, 5);
  });

  it("should return 0 when RSI > threshold+10", () => {
    const evaluate = createRsiOversoldEvaluator(30, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 50 : null)),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(0);
  });

  it("should fallback to computation when period != 14", () => {
    const evaluate = createRsiOversoldEvaluator(30, 10);
    // Need enough candles for RSI computation
    const candles = createTestCandles(50, { trend: "down", startPrice: 200 });
    const score = evaluate(candles, 49);
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 for null precomputed values", () => {
    const evaluate = createRsiOversoldEvaluator(30, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// RSI Overbought Evaluator
// =============================================================================

describe("createRsiOverboughtEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createRsiOverboughtEvaluator(70, 14);
    const candles = createTestCandles(20);
    expect(evaluate(candles, 5)).toBe(0);
  });

  it("should return 1 when RSI >= threshold via precomputed", () => {
    const evaluate = createRsiOverboughtEvaluator(70, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 80 : null)),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(1);
  });

  it("should return gradual falloff for RSI between threshold-10 and threshold", () => {
    const evaluate = createRsiOverboughtEvaluator(70, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 65 : null)),
    };
    const score = evaluate(candles, 15, undefined, precomputed);
    // RSI=65, threshold=70: 1 - (70-65)/10 = 0.5
    expect(score).toBeCloseTo(0.5, 5);
  });

  it("should return 0 when RSI < threshold-10", () => {
    const evaluate = createRsiOverboughtEvaluator(70, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 50 : null)),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// RSI Neutral Evaluator
// =============================================================================

describe("createRsiNeutralEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createRsiNeutralEvaluator(40, 60, 14);
    const candles = createTestCandles(20);
    expect(evaluate(candles, 5)).toBe(0);
  });

  it("should return 1 when RSI is within neutral zone", () => {
    const evaluate = createRsiNeutralEvaluator(40, 60, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 50 : null)),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(1);
  });

  it("should return 1 at lower boundary", () => {
    const evaluate = createRsiNeutralEvaluator(40, 60, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 40 : null)),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(1);
  });

  it("should return 0 when RSI is outside neutral zone", () => {
    const evaluate = createRsiNeutralEvaluator(40, 60, 14);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      rsi14: Array(20).fill(null).map((_, i) => (i >= 14 ? 30 : null)),
    };
    expect(evaluate(candles, 15, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// MACD Bullish Evaluator
// =============================================================================

describe("createMacdBullishEvaluator", () => {
  it("should return 0 when index < slowPeriod + signalPeriod", () => {
    const evaluate = createMacdBullishEvaluator();
    const candles = createTestCandles(40);
    expect(evaluate(candles, 30)).toBe(0);
  });

  it("should return 1 on histogram crossover (negative to positive) via precomputed", () => {
    const evaluate = createMacdBullishEvaluator();
    const candles = createTestCandles(40);
    const precomputed: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
          i >= 35
            ? i === 35
              ? { macd: -0.5, signal: 0, histogram: -0.5 }
              : { macd: 0.5, signal: 0, histogram: 0.5 }
            : { macd: 0 as number | null, signal: 0 as number | null, histogram: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 36, undefined, precomputed)).toBe(1);
  });

  it("should return 0.5 when histogram is positive (sustained bullish)", () => {
    const evaluate = createMacdBullishEvaluator();
    const candles = createTestCandles(40);
    const precomputed: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
          i >= 35
            ? { macd: 0.5, signal: 0, histogram: 0.5 }
            : { macd: 0 as number | null, signal: 0 as number | null, histogram: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 36, undefined, precomputed)).toBe(0.5);
  });

  it("should return 0 when histogram is negative", () => {
    const evaluate = createMacdBullishEvaluator();
    const candles = createTestCandles(40);
    const precomputed: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
          i >= 35
            ? { macd: -0.5, signal: 0, histogram: -0.5 }
            : { macd: 0 as number | null, signal: 0 as number | null, histogram: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 36, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when current or prev histogram is null", () => {
    const evaluate = createMacdBullishEvaluator();
    const candles = createTestCandles(40);
    const precomputed: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
          i >= 35
            ? { macd: 0.5, signal: 0, histogram: null }
            : { macd: 0 as number | null, signal: 0 as number | null, histogram: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 36, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// MACD Bearish Evaluator
// =============================================================================

describe("createMacdBearishEvaluator", () => {
  it("should return 1 on histogram crossover (positive to negative) via precomputed", () => {
    const evaluate = createMacdBearishEvaluator();
    const candles = createTestCandles(40);
    const precomputed: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
          i >= 35
            ? i === 35
              ? { macd: 0.5, signal: 0, histogram: 0.5 }
              : { macd: -0.5, signal: 0, histogram: -0.5 }
            : { macd: 0 as number | null, signal: 0 as number | null, histogram: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 36, undefined, precomputed)).toBe(1);
  });

  it("should return 0.5 when histogram is negative (sustained bearish)", () => {
    const evaluate = createMacdBearishEvaluator();
    const candles = createTestCandles(40);
    const precomputed: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
          i >= 35
            ? { macd: -0.5, signal: 0, histogram: -0.5 }
            : { macd: 0 as number | null, signal: 0 as number | null, histogram: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 36, undefined, precomputed)).toBe(0.5);
  });

  it("should return 0 when histogram is positive", () => {
    const evaluate = createMacdBearishEvaluator();
    const candles = createTestCandles(40);
    const precomputed: PrecomputedIndicators = {
      macd: Array.from({ length: 40 }, (_, i) =>
          i >= 35
            ? { macd: 0.5, signal: 0, histogram: 0.5 }
            : { macd: 0 as number | null, signal: 0 as number | null, histogram: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 36, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Stochastics Oversold Evaluator
// =============================================================================

describe("createStochOversoldEvaluator", () => {
  it("should return 0 when index < kPeriod + dPeriod", () => {
    const evaluate = createStochOversoldEvaluator();
    const candles = createTestCandles(20);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 1 when both K and D are <= threshold", () => {
    const evaluate = createStochOversoldEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) =>
          i >= 17 ? { k: 15, d: 18 } : { k: 0 as number | null, d: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(1);
  });

  it("should return 0.7 when only K is <= threshold", () => {
    const evaluate = createStochOversoldEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) =>
          i >= 17 ? { k: 15, d: 25 } : { k: 0 as number | null, d: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0.7);
  });

  it("should return 0 when both K and D are above threshold", () => {
    const evaluate = createStochOversoldEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) =>
          i >= 17 ? { k: 50, d: 55 } : { k: 0 as number | null, d: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when k or d is null", () => {
    const evaluate = createStochOversoldEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) =>
          i >= 17 ? { k: null, d: null } : { k: 0 as number | null, d: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Stochastics Overbought Evaluator
// =============================================================================

describe("createStochOverboughtEvaluator", () => {
  it("should return 1 when both K and D are >= threshold", () => {
    const evaluate = createStochOverboughtEvaluator(80);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) =>
          i >= 17 ? { k: 85, d: 82 } : { k: 0 as number | null, d: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(1);
  });

  it("should return 0.7 when only K is >= threshold", () => {
    const evaluate = createStochOverboughtEvaluator(80);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) =>
          i >= 17 ? { k: 85, d: 70 } : { k: 0 as number | null, d: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0.7);
  });

  it("should return 0 when both K and D are below threshold", () => {
    const evaluate = createStochOverboughtEvaluator(80);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) =>
          i >= 17 ? { k: 50, d: 55 } : { k: 0 as number | null, d: 0 as number | null },
        ),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Stochastics Bullish Cross Evaluator
// =============================================================================

describe("createStochBullishCrossEvaluator", () => {
  it("should return 0 when index < kPeriod + dPeriod + 1", () => {
    const evaluate = createStochBullishCrossEvaluator();
    const candles = createTestCandles(20);
    expect(evaluate(candles, 15)).toBe(0);
  });

  it("should return 1 when K crosses above D in oversold zone", () => {
    const evaluate = createStochBullishCrossEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) => {
          if (i === 17) return { k: 10, d: 15 }; // K below D
          if (i === 18) return { k: 22, d: 18 }; // K crosses above D, within oversold+10
          return { k: 0 as number | null, d: 0 as number | null };
        }),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(1);
  });

  it("should return 0.5 when K crosses above D outside oversold zone", () => {
    const evaluate = createStochBullishCrossEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) => {
          if (i === 17) return { k: 40, d: 50 }; // K below D
          if (i === 18) return { k: 55, d: 50 }; // K crosses above D, outside oversold
          return { k: 0 as number | null, d: 0 as number | null };
        }),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0.5);
  });

  it("should return 0 when no crossover", () => {
    const evaluate = createStochBullishCrossEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) => {
          if (i === 17) return { k: 55, d: 50 }; // K already above D
          if (i === 18) return { k: 60, d: 50 }; // K still above D (no cross)
          return { k: 0 as number | null, d: 0 as number | null };
        }),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when prev k or d is null", () => {
    const evaluate = createStochBullishCrossEvaluator(20);
    const candles = createTestCandles(20);
    const precomputed: PrecomputedIndicators = {
      stoch: Array.from({ length: 20 }, (_, i) => {
          if (i === 17) return { k: null, d: null };
          if (i === 18) return { k: 22, d: 18 };
          return { k: 0 as number | null, d: 0 as number | null };
        }),
    };
    expect(evaluate(candles, 18, undefined, precomputed)).toBe(0);
  });
});
