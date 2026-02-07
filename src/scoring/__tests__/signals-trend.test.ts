import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PrecomputedIndicators } from "../../types";
import {
  createDeathCrossEvaluator,
  createGoldenCrossEvaluator,
  createPOConfirmationEvaluator,
  createPerfectOrderBearishEvaluator,
  createPerfectOrderBullishEvaluator,
  createPriceAboveEmaEvaluator,
  createPriceBelowEmaEvaluator,
  createPullbackEntryEvaluator,
} from "../signals/trend";

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
// Perfect Order Bullish Evaluator
// =============================================================================

describe("createPerfectOrderBullishEvaluator", () => {
  it("should return 0 when index < longest period", () => {
    const evaluate = createPerfectOrderBullishEvaluator([5, 20, 60]);
    const candles = createTestCandles(70);
    expect(evaluate(candles, 30)).toBe(0);
  });

  it("should return 0.8-1.0 for bullish perfect order via precomputed", () => {
    const evaluate = createPerfectOrderBullishEvaluator([5, 20, 60]);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrder: Array(70)
        .fill(null)
        .map((_, i) => (i >= 60 ? { type: "bullish", strength: 50 } : null)),
    };
    const score = evaluate(candles, 65, undefined, precomputed);
    expect(score).toBeGreaterThanOrEqual(0.8);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should cap strength bonus at 0.2", () => {
    const evaluate = createPerfectOrderBullishEvaluator([5, 20, 60]);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrder: Array(70)
        .fill(null)
        .map((_, i) => (i >= 60 ? { type: "bullish", strength: 200 } : null)),
    };
    const score = evaluate(candles, 65, undefined, precomputed);
    expect(score).toBe(1);
  });

  it("should return 0 for bearish perfect order", () => {
    const evaluate = createPerfectOrderBullishEvaluator([5, 20, 60]);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrder: Array(70)
        .fill(null)
        .map((_, i) => (i >= 60 ? { type: "bearish", strength: 50 } : null)),
    };
    expect(evaluate(candles, 65, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when precomputed value is null", () => {
    const evaluate = createPerfectOrderBullishEvaluator([5, 20, 60]);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrder: Array(70).fill(null),
    };
    expect(evaluate(candles, 65, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Perfect Order Bearish Evaluator
// =============================================================================

describe("createPerfectOrderBearishEvaluator", () => {
  it("should return 0.8-1.0 for bearish perfect order via precomputed", () => {
    const evaluate = createPerfectOrderBearishEvaluator([5, 20, 60]);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrder: Array(70)
        .fill(null)
        .map((_, i) => (i >= 60 ? { type: "bearish", strength: 50 } : null)),
    };
    const score = evaluate(candles, 65, undefined, precomputed);
    expect(score).toBeGreaterThanOrEqual(0.8);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 for bullish perfect order", () => {
    const evaluate = createPerfectOrderBearishEvaluator([5, 20, 60]);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrder: Array(70)
        .fill(null)
        .map((_, i) => (i >= 60 ? { type: "bullish", strength: 50 } : null)),
    };
    expect(evaluate(candles, 65, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// PO Confirmation Evaluator
// =============================================================================

describe("createPOConfirmationEvaluator", () => {
  it("should return 0 when index < longPeriod + slopeLookback", () => {
    const evaluate = createPOConfirmationEvaluator([5, 20, 60], 3);
    const candles = createTestCandles(70);
    expect(evaluate(candles, 60)).toBe(0);
  });

  it("should return 1 for BULLISH_PO with confirmationFormed", () => {
    const evaluate = createPOConfirmationEvaluator([5, 20, 60], 3);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrderEnhanced: Array(70)
        .fill(null)
        .map((_, i) =>
          i >= 63
            ? { state: "BULLISH_PO", isConfirmed: true, confirmationFormed: true }
            : null,
        ),
    };
    expect(evaluate(candles, 65, undefined, precomputed)).toBe(1);
  });

  it("should return 0.8 for BULLISH_PO isConfirmed without confirmationFormed", () => {
    const evaluate = createPOConfirmationEvaluator([5, 20, 60], 3);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrderEnhanced: Array(70)
        .fill(null)
        .map((_, i) =>
          i >= 63
            ? { state: "BULLISH_PO", isConfirmed: true, confirmationFormed: false }
            : null,
        ),
    };
    expect(evaluate(candles, 65, undefined, precomputed)).toBe(0.8);
  });

  it("should return 0.5 for PRE_BULLISH_PO state", () => {
    const evaluate = createPOConfirmationEvaluator([5, 20, 60], 3);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrderEnhanced: Array(70)
        .fill(null)
        .map((_, i) =>
          i >= 63
            ? { state: "PRE_BULLISH_PO", isConfirmed: false, confirmationFormed: false }
            : null,
        ),
    };
    expect(evaluate(candles, 65, undefined, precomputed)).toBe(0.5);
  });

  it("should return 0 for non-bullish state", () => {
    const evaluate = createPOConfirmationEvaluator([5, 20, 60], 3);
    const candles = createTestCandles(70);
    const precomputed: PrecomputedIndicators = {
      perfectOrderEnhanced: Array(70)
        .fill(null)
        .map((_, i) =>
          i >= 63
            ? { state: "BEARISH_PO", isConfirmed: false, confirmationFormed: false }
            : null,
        ),
    };
    expect(evaluate(candles, 65, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Pullback Entry Evaluator
// =============================================================================

describe("createPullbackEntryEvaluator", () => {
  it("should return 0 when index < maPeriod", () => {
    const evaluate = createPullbackEntryEvaluator(20);
    const candles = createTestCandles(30);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 1 for pullback touch with rising MA and price above MA", () => {
    const evaluate = createPullbackEntryEvaluator(20, 1);
    const candles = createTestCandles(30, { trend: "up" });
    // Use precomputed SMA data where MA is rising and price touches MA
    const smaMap = new Map<number, (number | null)[]>();
    const smaData = Array(30)
      .fill(null)
      .map((_, i) => (i >= 20 ? candles[i].close - 0.5 : null));
    smaMap.set(20, smaData);
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    const score = evaluate(candles, 25, undefined, precomputed);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 when price does not touch MA", () => {
    const evaluate = createPullbackEntryEvaluator(20, 0.1);
    const candles = createTestCandles(30, { trend: "up" });
    // SMA far below price
    const smaMap = new Map<number, (number | null)[]>();
    const smaData = Array(30)
      .fill(null)
      .map((_, i) => (i >= 20 ? candles[i].close - 50 : null));
    smaMap.set(20, smaData);
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    expect(evaluate(candles, 25, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Golden Cross Evaluator
// =============================================================================

describe("createGoldenCrossEvaluator", () => {
  it("should return 0 when index < longPeriod + 1", () => {
    const evaluate = createGoldenCrossEvaluator(5, 10);
    const candles = createTestCandles(20);
    expect(evaluate(candles, 8)).toBe(0);
  });

  it("should return 1 on crossover via precomputed", () => {
    const evaluate = createGoldenCrossEvaluator(5, 10);
    const candles = createTestCandles(20);
    const smaMap = new Map<number, (number | null)[]>();
    // Short MA crosses above long MA
    const shortData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 99; // prev: short below long
        if (i === 12) return 102; // current: short above long
        return null;
      });
    const longData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 100; // prev
        if (i === 12) return 100; // current
        return null;
      });
    smaMap.set(5, shortData);
    smaMap.set(10, longData);
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    expect(evaluate(candles, 12, undefined, precomputed)).toBe(1);
  });

  it("should return 0.3 when already above (no crossover)", () => {
    const evaluate = createGoldenCrossEvaluator(5, 10);
    const candles = createTestCandles(20);
    const smaMap = new Map<number, (number | null)[]>();
    // Short MA already above long MA (no crossover)
    const shortData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 102;
        if (i === 12) return 103;
        return null;
      });
    const longData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 100;
        if (i === 12) return 100;
        return null;
      });
    smaMap.set(5, shortData);
    smaMap.set(10, longData);
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    expect(evaluate(candles, 12, undefined, precomputed)).toBe(0.3);
  });

  it("should return 0 when short MA is below long MA", () => {
    const evaluate = createGoldenCrossEvaluator(5, 10);
    const candles = createTestCandles(20);
    const smaMap = new Map<number, (number | null)[]>();
    const shortData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 98;
        if (i === 12) return 97;
        return null;
      });
    const longData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 100;
        if (i === 12) return 100;
        return null;
      });
    smaMap.set(5, shortData);
    smaMap.set(10, longData);
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    expect(evaluate(candles, 12, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when values are null", () => {
    const evaluate = createGoldenCrossEvaluator(5, 10);
    const candles = createTestCandles(20);
    const smaMap = new Map<number, (number | null)[]>();
    smaMap.set(5, Array(20).fill(null));
    smaMap.set(10, Array(20).fill(null));
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    expect(evaluate(candles, 12, undefined, precomputed)).toBe(0);
  });
});

// =============================================================================
// Death Cross Evaluator
// =============================================================================

describe("createDeathCrossEvaluator", () => {
  it("should return 1 on crossover via precomputed", () => {
    const evaluate = createDeathCrossEvaluator(5, 10);
    const candles = createTestCandles(20);
    const smaMap = new Map<number, (number | null)[]>();
    // Short MA crosses below long MA
    const shortData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 101; // prev: short above long
        if (i === 12) return 98; // current: short below long
        return null;
      });
    const longData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 100;
        if (i === 12) return 100;
        return null;
      });
    smaMap.set(5, shortData);
    smaMap.set(10, longData);
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    expect(evaluate(candles, 12, undefined, precomputed)).toBe(1);
  });

  it("should return 0.3 when already below", () => {
    const evaluate = createDeathCrossEvaluator(5, 10);
    const candles = createTestCandles(20);
    const smaMap = new Map<number, (number | null)[]>();
    const shortData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 98;
        if (i === 12) return 97;
        return null;
      });
    const longData = Array(20)
      .fill(null)
      .map((_, i) => {
        if (i === 11) return 100;
        if (i === 12) return 100;
        return null;
      });
    smaMap.set(5, shortData);
    smaMap.set(10, longData);
    const precomputed: PrecomputedIndicators = { sma: smaMap };
    expect(evaluate(candles, 12, undefined, precomputed)).toBe(0.3);
  });
});

// =============================================================================
// Price Above/Below EMA Evaluators
// =============================================================================

describe("createPriceAboveEmaEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createPriceAboveEmaEvaluator(20);
    const candles = createTestCandles(30);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 1 when price is above EMA via precomputed", () => {
    const evaluate = createPriceAboveEmaEvaluator(20);
    const candles = createTestCandles(30);
    const emaMap = new Map<number, (number | null)[]>();
    const emaData = Array(30)
      .fill(null)
      .map((_, i) => (i >= 20 ? candles[i].close - 5 : null));
    emaMap.set(20, emaData);
    const precomputed: PrecomputedIndicators = { ema: emaMap };
    expect(evaluate(candles, 25, undefined, precomputed)).toBe(1);
  });

  it("should return 0 when price is below EMA via precomputed", () => {
    const evaluate = createPriceAboveEmaEvaluator(20);
    const candles = createTestCandles(30);
    const emaMap = new Map<number, (number | null)[]>();
    const emaData = Array(30)
      .fill(null)
      .map((_, i) => (i >= 20 ? candles[i].close + 5 : null));
    emaMap.set(20, emaData);
    const precomputed: PrecomputedIndicators = { ema: emaMap };
    expect(evaluate(candles, 25, undefined, precomputed)).toBe(0);
  });

  it("should return 0 when EMA value is null", () => {
    const evaluate = createPriceAboveEmaEvaluator(20);
    const candles = createTestCandles(30);
    const emaMap = new Map<number, (number | null)[]>();
    emaMap.set(20, Array(30).fill(null));
    const precomputed: PrecomputedIndicators = { ema: emaMap };
    expect(evaluate(candles, 25, undefined, precomputed)).toBe(0);
  });
});

describe("createPriceBelowEmaEvaluator", () => {
  it("should return 0 when index < period", () => {
    const evaluate = createPriceBelowEmaEvaluator(20);
    const candles = createTestCandles(30);
    expect(evaluate(candles, 10)).toBe(0);
  });

  it("should return 1 when price is below EMA via precomputed", () => {
    const evaluate = createPriceBelowEmaEvaluator(20);
    const candles = createTestCandles(30);
    const emaMap = new Map<number, (number | null)[]>();
    const emaData = Array(30)
      .fill(null)
      .map((_, i) => (i >= 20 ? candles[i].close + 5 : null));
    emaMap.set(20, emaData);
    const precomputed: PrecomputedIndicators = { ema: emaMap };
    expect(evaluate(candles, 25, undefined, precomputed)).toBe(1);
  });

  it("should return 0 when price is above EMA via precomputed", () => {
    const evaluate = createPriceBelowEmaEvaluator(20);
    const candles = createTestCandles(30);
    const emaMap = new Map<number, (number | null)[]>();
    const emaData = Array(30)
      .fill(null)
      .map((_, i) => (i >= 20 ? candles[i].close - 5 : null));
    emaMap.set(20, emaData);
    const precomputed: PrecomputedIndicators = { ema: emaMap };
    expect(evaluate(candles, 25, undefined, precomputed)).toBe(0);
  });
});
