/**
 * Coverage tests for scoring/calculator.ts
 *
 * Each test verifies actual scoring behavior (score values, strength classification,
 * signal weighting) rather than just "it doesn't throw". Tests are organized by
 * the specific logic branch they exercise.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedCandle, ScoringConfig, SignalDefinition } from "../../types";
import {
  calculateScore,
  calculateScoreBreakdown,
  calculateScoreSeries,
  isScoreAbove,
  isScoreBelow,
} from "../calculator";

// =============================================================================
// Helpers
// =============================================================================

function makeCandles(
  count: number,
  opts: { startPrice?: number; trend?: "up" | "down" | "flat"; volume?: number } = {},
): NormalizedCandle[] {
  const { startPrice = 100, trend = "flat", volume = 1_000_000 } = opts;
  const candles: NormalizedCandle[] = [];
  let price = startPrice;
  const t0 = 1_000_000_000_000;

  for (let i = 0; i < count; i++) {
    const delta = trend === "up" ? 0.5 : trend === "down" ? -0.5 : 0;
    price += delta;
    candles.push({
      time: t0 + i * 86_400_000,
      open: price - delta * 0.3,
      high: price + 1,
      low: price - 1,
      close: price,
      volume,
    });
  }
  return candles;
}

function fixedSignal(
  value: number,
  weight = 1,
  category?: SignalDefinition["category"],
): SignalDefinition {
  return {
    name: `fixed_${value}`,
    displayName: `Fixed ${value}`,
    weight,
    category,
    evaluate: () => value,
  };
}

function throwingSignal(weight = 1): SignalDefinition {
  return {
    name: "throwing",
    displayName: "Throws",
    weight,
    evaluate: () => {
      throw new Error("boom");
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("calculator-coverage", () => {
  // ---- getStrength threshold boundaries ----
  describe("strength classification verifies correct boundary mapping", () => {
    const candles = makeCandles(5);

    it("score at 70 maps to strong with default thresholds (boundary test)", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.7, 1)] };
      const result = calculateScore(candles, 0, config);
      expect(result.normalizedScore).toBe(70);
      expect(result.strength).toBe("strong");
    });

    it("score at 69.9 maps to moderate (just below strong threshold)", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.699, 1)] };
      const result = calculateScore(candles, 0, config);
      expect(result.normalizedScore).toBeCloseTo(69.9, 0);
      expect(result.strength).toBe("moderate");
    });

    it("score at 50 maps to moderate (boundary test)", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.5, 1)] };
      expect(calculateScore(candles, 0, config).strength).toBe("moderate");
    });

    it("score at 30 maps to weak (boundary test)", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.3, 1)] };
      expect(calculateScore(candles, 0, config).strength).toBe("weak");
    });

    it("score at 29 maps to none (below all thresholds)", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.29, 1)] };
      expect(calculateScore(candles, 0, config).strength).toBe("none");
    });

    it("custom thresholds shift all boundary categories correctly", () => {
      // With custom thresholds: strong>=90, moderate>=80, weak>=55
      // A score of 55 should be weak, not moderate or none
      const config: ScoringConfig = {
        signals: [fixedSignal(0.55, 1)],
        strongThreshold: 90,
        moderateThreshold: 80,
        weakThreshold: 55,
      };
      const result = calculateScore(candles, 0, config);
      expect(result.normalizedScore).toBeCloseTo(55, 5);
      expect(result.strength).toBe("weak");

      // Score of 85 should be moderate (>=80, <90)
      const config2: ScoringConfig = {
        signals: [fixedSignal(0.85, 1)],
        strongThreshold: 90,
        moderateThreshold: 80,
        weakThreshold: 55,
      };
      expect(calculateScore(candles, 0, config2).strength).toBe("moderate");
    });
  });

  // ---- evaluateSignal clamping: verify values are clamped not just that it runs ----
  describe("signal value clamping enforces 0-1 range for scoring integrity", () => {
    const candles = makeCandles(3);

    it("negative evaluator output is clamped to 0, preventing negative scores", () => {
      const config: ScoringConfig = {
        signals: [{ name: "neg", displayName: "neg", weight: 1, evaluate: () => -5 }],
      };
      const r = calculateScore(candles, 0, config);
      expect(r.rawScore).toBe(0);
      expect(r.normalizedScore).toBe(0);
      expect(r.activeSignals).toBe(0);
    });

    it("evaluator output >1 is clamped to 1, preventing score inflation", () => {
      const config: ScoringConfig = {
        signals: [{ name: "big", displayName: "big", weight: 2, evaluate: () => 10 }],
      };
      const r = calculateScore(candles, 0, config);
      // 10 clamped to 1, weight 2 => rawScore 2, maxScore 2, normalized 100
      expect(r.rawScore).toBe(2);
      expect(r.normalizedScore).toBe(100);
    });

    it("throwing evaluator contributes 0 to score without crashing the pipeline", () => {
      // Two signals: one throws (weight 3), one returns 1.0 (weight 2)
      const config: ScoringConfig = {
        signals: [throwingSignal(3), fixedSignal(1, 2)],
      };
      const bd = calculateScoreBreakdown(candles, 0, config);

      // Throwing signal should contribute nothing
      expect(bd.contributions[0].rawValue).toBe(0);
      expect(bd.contributions[0].isActive).toBe(false);
      expect(bd.contributions[0].score).toBe(0);

      // Working signal should contribute normally
      expect(bd.contributions[1].rawValue).toBe(1);
      expect(bd.contributions[1].isActive).toBe(true);
      expect(bd.contributions[1].score).toBe(2); // 1.0 * weight 2

      // Aggregates: rawScore = 0 + 2 = 2, maxScore = 3 + 2 = 5
      expect(bd.rawScore).toBe(2);
      expect(bd.maxScore).toBe(5);
      expect(bd.normalizedScore).toBe(40); // 2/5 * 100
      expect(bd.activeSignals).toBe(1);
    });
  });

  // ---- empty signals: zero-division safety ----
  describe("empty signal array returns complete zero result without errors", () => {
    it("returns all-zero fields with 'none' strength for empty signals", () => {
      const r = calculateScore(makeCandles(2), 0, { signals: [] });
      expect(r).toEqual({
        rawScore: 0,
        normalizedScore: 0,
        maxScore: 0,
        strength: "none",
        activeSignals: 0,
        totalSignals: 0,
      });
    });
  });

  // ---- breakdown custom thresholds ----
  describe("calculateScoreBreakdown applies custom thresholds to strength", () => {
    const candles = makeCandles(5);

    it("breakdown respects custom thresholds for strength classification", () => {
      const config: ScoringConfig = {
        signals: [fixedSignal(0.45, 1)],
        strongThreshold: 90,
        moderateThreshold: 70,
        weakThreshold: 45,
      };
      const bd = calculateScoreBreakdown(candles, 0, config);
      expect(bd.normalizedScore).toBe(45);
      expect(bd.strength).toBe("weak"); // 45 >= weakThreshold
    });

    it("breakdown with all-zero signals correctly shows no active contributions", () => {
      const config: ScoringConfig = {
        signals: [fixedSignal(0, 2), fixedSignal(0, 3)],
      };
      const bd = calculateScoreBreakdown(candles, 0, config);
      expect(bd.normalizedScore).toBe(0);
      expect(bd.strength).toBe("none");
      expect(bd.activeSignals).toBe(0);
      expect(bd.contributions.every((c) => !c.isActive)).toBe(true);
      expect(bd.contributions.every((c) => c.rawValue === 0)).toBe(true);
    });
  });

  // ---- calculateScoreSeries with precomputed indicators ----
  describe("calculateScoreSeries precomputes indicators for O(n) performance", () => {
    it("rsi14 requiredIndicator triggers precomputation and flows to evaluator", () => {
      const candles = makeCandles(30);
      const config: ScoringConfig = {
        signals: [
          {
            name: "rsiSignal",
            displayName: "RSI Signal",
            weight: 1,
            requiredIndicators: ["rsi14"],
            evaluate: (_c, _i, _ctx, pre) => {
              // Verify precomputed data was actually populated
              return pre?.rsi14 && pre.rsi14.length > 0 ? 0.5 : 0;
            },
          },
        ],
      };
      const series = calculateScoreSeries(candles, config, 20);
      expect(series.length).toBe(10);
      // All bars should get score 50 because precomputed rsi14 is populated
      expect(series[0].score.normalizedScore).toBe(50);
      expect(series[9].score.normalizedScore).toBe(50);
    });

    it("multiple required indicators (macd, stoch, sma, ema, volumeMa20) all precompute", () => {
      const candles = makeCandles(40);
      const config: ScoringConfig = {
        signals: [
          {
            name: "multi",
            displayName: "Multi",
            weight: 1,
            requiredIndicators: ["macd", "stoch", "sma", "ema", "volumeMa20"],
            evaluate: (_c, _i, _ctx, pre) => {
              // Verify all 5 indicator types are populated
              const allPresent = pre?.macd && pre?.stoch && pre?.sma && pre?.ema && pre?.volumeMa20;
              return allPresent ? 0.8 : 0;
            },
          },
        ],
      };
      const series = calculateScoreSeries(candles, config, 35);
      expect(series.length).toBe(5);
      // Score 80 confirms all 5 precomputed indicators were available
      expect(series[0].score.normalizedScore).toBe(80);
    });

    it("volume indicators (volumeAnomaly, volumeTrend, cmf20) all precompute", () => {
      const candles = makeCandles(40);
      const config: ScoringConfig = {
        signals: [
          {
            name: "vol",
            displayName: "Vol",
            weight: 1,
            requiredIndicators: ["volumeAnomaly", "volumeTrend", "cmf20"],
            evaluate: (_c, _i, _ctx, pre) => {
              return pre?.volumeAnomaly && pre?.volumeTrend && pre?.cmf20 ? 0.6 : 0;
            },
          },
        ],
      };
      const series = calculateScoreSeries(candles, config, 35);
      expect(series.length).toBe(5);
      expect(series[0].score.normalizedScore).toBe(60);
    });

    it("perfectOrder and perfectOrderEnhanced precompute on uptrend data", () => {
      const candles = makeCandles(80, { trend: "up" });
      const config: ScoringConfig = {
        signals: [
          {
            name: "po",
            displayName: "PO",
            weight: 1,
            requiredIndicators: ["perfectOrder", "perfectOrderEnhanced"],
            evaluate: (_c, _i, _ctx, pre) => {
              return pre?.perfectOrder && pre?.perfectOrderEnhanced ? 0.9 : 0;
            },
          },
        ],
      };
      const series = calculateScoreSeries(candles, config, 75);
      expect(series.length).toBe(5);
      expect(series[0].score.normalizedScore).toBe(90);
    });

    it("signals without requiredIndicators still work in series mode", () => {
      const candles = makeCandles(10);
      const config: ScoringConfig = {
        signals: [
          {
            name: "noReqs",
            displayName: "No Reqs",
            weight: 1,
            evaluate: () => 0.7,
            // no requiredIndicators
          },
        ],
      };
      const series = calculateScoreSeries(candles, config);
      expect(series.length).toBe(10);
      // Every bar should score 70 from fixed evaluator
      series.forEach((item) => {
        expect(item.score.normalizedScore).toBe(70);
      });
    });
  });

  // ---- isScoreAbove / isScoreBelow boundary tests ----
  describe("isScoreAbove/Below threshold comparison semantics", () => {
    const candles = makeCandles(5);

    it("isScoreAbove returns true when score equals threshold (>= semantics)", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.5, 1)] };
      expect(isScoreAbove(candles, 0, 50, config)).toBe(true);
    });

    it("isScoreAbove returns false when score is 1 below threshold", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.49, 1)] };
      expect(isScoreAbove(candles, 0, 50, config)).toBe(false);
    });

    it("isScoreBelow returns true when score equals threshold (<= semantics)", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.5, 1)] };
      expect(isScoreBelow(candles, 0, 50, config)).toBe(true);
    });

    it("isScoreBelow returns false when score is 1 above threshold", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.51, 1)] };
      expect(isScoreBelow(candles, 0, 50, config)).toBe(false);
    });

    it("isScoreAbove accepts optional MtfContext without affecting result", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.8, 1)] };
      const context = { htfBias: "bullish" as const };
      // Score should still be 80 regardless of context (fixed signal)
      expect(isScoreAbove(candles, 0, 70, config, context as any)).toBe(true);
    });

    it("isScoreBelow accepts optional MtfContext without affecting result", () => {
      const config: ScoringConfig = { signals: [fixedSignal(0.1, 1)] };
      const context = { htfBias: "bearish" as const };
      expect(isScoreBelow(candles, 0, 20, config, context as any)).toBe(true);
    });
  });

  // ---- maxScore = 0 branch ----
  describe("zero-weight signals produce normalizedScore 0 (no division by zero)", () => {
    const candles = makeCandles(5);

    it("all weights zero means maxScore=0 and normalizedScore=0", () => {
      const config: ScoringConfig = {
        signals: [fixedSignal(1, 0), fixedSignal(0.5, 0)],
      };
      const r = calculateScore(candles, 0, config);
      expect(r.maxScore).toBe(0);
      expect(r.normalizedScore).toBe(0);
      expect(r.rawScore).toBe(0);
    });

    it("breakdown also handles maxScore=0 without NaN", () => {
      const config: ScoringConfig = {
        signals: [fixedSignal(1, 0)],
      };
      const bd = calculateScoreBreakdown(candles, 0, config);
      expect(bd.maxScore).toBe(0);
      expect(bd.normalizedScore).toBe(0);
      expect(Number.isNaN(bd.normalizedScore)).toBe(false);
    });
  });

  // ---- weighted scoring arithmetic ----
  describe("weighted scoring correctly computes composite scores", () => {
    const candles = makeCandles(5);

    it("high-weight signal dominates score over low-weight signal", () => {
      // Signal A: value 1.0, weight 10 (contributes 10/12 = 83.3% of max)
      // Signal B: value 0.0, weight 2 (contributes nothing)
      const config: ScoringConfig = {
        signals: [fixedSignal(1, 10), fixedSignal(0, 2)],
      };
      const r = calculateScore(candles, 0, config);
      expect(r.rawScore).toBe(10);
      expect(r.maxScore).toBe(12);
      expect(r.normalizedScore).toBeCloseTo(83.33, 1);
      expect(r.activeSignals).toBe(1);
    });

    it("partial signal values produce proportional weighted scores", () => {
      // Signal A: value 0.5, weight 4 => 2
      // Signal B: value 0.3, weight 6 => 1.8
      // Total: 3.8 / 10 * 100 = 38
      const config: ScoringConfig = {
        signals: [fixedSignal(0.5, 4), fixedSignal(0.3, 6)],
      };
      const r = calculateScore(candles, 0, config);
      expect(r.rawScore).toBeCloseTo(3.8, 5);
      expect(r.normalizedScore).toBe(38);
      expect(r.activeSignals).toBe(2);
    });
  });
});
