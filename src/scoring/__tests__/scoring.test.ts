import { describe, expect, it } from "vitest";
import type { NormalizedCandle, ScoringConfig, SignalDefinition } from "../../types";
import { ScoreBuilder } from "../builder";
import {
  calculateScore,
  calculateScoreBreakdown,
  calculateScoreSeries,
  isScoreAbove,
  isScoreBelow,
} from "../calculator";
import {
  minActiveSignals,
  scoreAbove,
  scoreBelow,
  scoreIncreasing,
  scoreStrength,
  scoreWithMinSignals,
} from "../conditions";
import {
  createAggressivePreset,
  createBalancedPreset,
  createConservativePreset,
  createMeanReversionPreset,
  createMomentumPreset,
  createTrendFollowingPreset,
  getPreset,
  listPresets,
} from "../presets";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create test candles with predictable values
 */
function createTestCandles(
  count: number,
  options: {
    startPrice?: number;
    trend?: "up" | "down" | "sideways";
    volatility?: number;
    baseVolume?: number;
  } = {},
): NormalizedCandle[] {
  const { startPrice = 100, trend = "sideways", volatility = 1, baseVolume = 1000000 } = options;

  const candles: NormalizedCandle[] = [];
  let price = startPrice;
  const startTime = Date.now() - count * 86400000;

  for (let i = 0; i < count; i++) {
    // Apply trend
    let delta = 0;
    if (trend === "up") {
      delta = 0.5 * volatility;
    } else if (trend === "down") {
      delta = -0.5 * volatility;
    } else {
      delta = Math.sin(i * 0.5) * 0.3 * volatility;
    }

    price = price + delta;
    const high = price + volatility;
    const low = price - volatility;
    const open = price - delta * 0.5;
    const close = price;

    candles.push({
      time: startTime + i * 86400000,
      open,
      high,
      low,
      close,
      volume: baseVolume * (0.8 + Math.random() * 0.4),
    });
  }

  return candles;
}

/**
 * Create a simple signal that always returns a fixed value
 */
function createFixedSignal(value: number, weight = 1): SignalDefinition {
  return {
    name: `fixed_${value}`,
    displayName: `Fixed ${value}`,
    weight,
    category: "momentum",
    evaluate: () => value,
  };
}

/**
 * Create a signal that throws an error
 */
function createErrorSignal(weight = 1): SignalDefinition {
  return {
    name: "error",
    displayName: "Error Signal",
    weight,
    category: "momentum",
    evaluate: () => {
      throw new Error("Test error");
    },
  };
}

// =============================================================================
// Calculator Tests
// =============================================================================

describe("Signal Scoring Calculator", () => {
  describe("calculateScore", () => {
    it("should return zero score for empty signals", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = { signals: [] };

      const result = calculateScore(candles, 49, config);

      expect(result.rawScore).toBe(0);
      expect(result.normalizedScore).toBe(0);
      expect(result.maxScore).toBe(0);
      expect(result.strength).toBe("none");
      expect(result.activeSignals).toBe(0);
      expect(result.totalSignals).toBe(0);
    });

    it("should calculate correct score for single signal", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [createFixedSignal(1, 2)],
      };

      const result = calculateScore(candles, 49, config);

      expect(result.rawScore).toBe(2); // 1 * 2
      expect(result.maxScore).toBe(2);
      expect(result.normalizedScore).toBe(100); // 2/2 * 100
      expect(result.activeSignals).toBe(1);
      expect(result.totalSignals).toBe(1);
    });

    it("should calculate weighted sum for multiple signals", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [
          createFixedSignal(1, 3), // 1 * 3 = 3
          createFixedSignal(0.5, 2), // 0.5 * 2 = 1
          createFixedSignal(0, 1), // 0 * 1 = 0
        ],
      };

      const result = calculateScore(candles, 49, config);

      expect(result.rawScore).toBe(4); // 3 + 1 + 0
      expect(result.maxScore).toBe(6); // 3 + 2 + 1
      expect(result.normalizedScore).toBeCloseTo(66.67, 1); // 4/6 * 100
      expect(result.activeSignals).toBe(2); // only signals with value > 0
    });

    it("should classify strength correctly with default thresholds", () => {
      const candles = createTestCandles(50);

      // Strong: >= 70
      let config: ScoringConfig = { signals: [createFixedSignal(0.75, 1)] };
      expect(calculateScore(candles, 49, config).strength).toBe("strong");

      // Moderate: >= 50
      config = { signals: [createFixedSignal(0.55, 1)] };
      expect(calculateScore(candles, 49, config).strength).toBe("moderate");

      // Weak: >= 30
      config = { signals: [createFixedSignal(0.35, 1)] };
      expect(calculateScore(candles, 49, config).strength).toBe("weak");

      // None: < 30
      config = { signals: [createFixedSignal(0.2, 1)] };
      expect(calculateScore(candles, 49, config).strength).toBe("none");
    });

    it("should apply custom thresholds", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.65, 1)],
        strongThreshold: 80,
        moderateThreshold: 60,
        weakThreshold: 40,
      };

      const result = calculateScore(candles, 49, config);
      expect(result.normalizedScore).toBe(65);
      expect(result.strength).toBe("moderate"); // 65 >= 60, < 80
    });

    it("should clamp signal values to 0-1 range", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [
          { ...createFixedSignal(1.5, 1), evaluate: () => 1.5 }, // over 1
          { ...createFixedSignal(-0.5, 1), evaluate: () => -0.5 }, // under 0
        ],
      };

      const result = calculateScore(candles, 49, config);

      // 1.5 clamped to 1, -0.5 clamped to 0
      expect(result.rawScore).toBe(1);
      expect(result.normalizedScore).toBe(50); // 1/2 * 100
    });

    it("should handle signal evaluation errors gracefully", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [createFixedSignal(1, 2), createErrorSignal(2)],
      };

      // Should not throw
      const result = calculateScore(candles, 49, config);

      // Error signal returns 0, so only first signal contributes
      expect(result.rawScore).toBe(2);
      expect(result.maxScore).toBe(4);
      expect(result.normalizedScore).toBe(50);
    });
  });

  describe("calculateScoreBreakdown", () => {
    it("should return detailed contributions for each signal", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [
          { ...createFixedSignal(1, 3), category: "momentum" },
          { ...createFixedSignal(0.5, 2), category: "trend" },
          { ...createFixedSignal(0, 1), category: "volume" },
        ],
      };

      const breakdown = calculateScoreBreakdown(candles, 49, config);

      expect(breakdown.contributions).toHaveLength(3);

      expect(breakdown.contributions[0]).toMatchObject({
        rawValue: 1,
        score: 3,
        weight: 3,
        isActive: true,
        category: "momentum",
      });

      expect(breakdown.contributions[1]).toMatchObject({
        rawValue: 0.5,
        score: 1,
        weight: 2,
        isActive: true,
        category: "trend",
      });

      expect(breakdown.contributions[2]).toMatchObject({
        rawValue: 0,
        score: 0,
        weight: 1,
        isActive: false,
        category: "volume",
      });
    });

    it("should include same aggregate values as calculateScore", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [createFixedSignal(1, 3), createFixedSignal(0.5, 2)],
      };

      const score = calculateScore(candles, 49, config);
      const breakdown = calculateScoreBreakdown(candles, 49, config);

      expect(breakdown.rawScore).toBe(score.rawScore);
      expect(breakdown.normalizedScore).toBe(score.normalizedScore);
      expect(breakdown.maxScore).toBe(score.maxScore);
      expect(breakdown.strength).toBe(score.strength);
      expect(breakdown.activeSignals).toBe(score.activeSignals);
      expect(breakdown.totalSignals).toBe(score.totalSignals);
    });
  });

  describe("calculateScoreSeries", () => {
    it("should calculate scores for all candles", () => {
      const candles = createTestCandles(10);
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.8, 1)],
      };

      const series = calculateScoreSeries(candles, config);

      expect(series).toHaveLength(10);
      series.forEach((item, i) => {
        expect(item.time).toBe(candles[i].time);
        expect(item.score.normalizedScore).toBe(80);
      });
    });

    it("should respect startIndex parameter", () => {
      const candles = createTestCandles(10);
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.5, 1)],
      };

      const series = calculateScoreSeries(candles, config, 5);

      expect(series).toHaveLength(5); // from index 5 to 9
      expect(series[0].time).toBe(candles[5].time);
    });
  });

  describe("isScoreAbove / isScoreBelow", () => {
    it("should check score above threshold", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.8, 1)], // 80 normalized score
      };

      expect(isScoreAbove(candles, 49, 70, config)).toBe(true);
      expect(isScoreAbove(candles, 49, 80, config)).toBe(true); // equal is above
      expect(isScoreAbove(candles, 49, 81, config)).toBe(false);
    });

    it("should check score below threshold", () => {
      const candles = createTestCandles(50);
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.3, 1)], // 30 normalized score
      };

      expect(isScoreBelow(candles, 49, 40, config)).toBe(true);
      expect(isScoreBelow(candles, 49, 30, config)).toBe(true); // equal is below
      expect(isScoreBelow(candles, 49, 29, config)).toBe(false);
    });
  });
});

// =============================================================================
// Builder Tests
// =============================================================================

describe("ScoreBuilder", () => {
  describe("basic functionality", () => {
    it("should create instance with create()", () => {
      const builder = ScoreBuilder.create();
      expect(builder).toBeInstanceOf(ScoreBuilder);
    });

    it("should support method chaining", () => {
      const builder = ScoreBuilder.create().addRsiOversold().addMacdBullish().addVolumeSpike();

      expect(builder.signalCount).toBe(3);
    });

    it("should set custom thresholds", () => {
      const config = ScoreBuilder.create().setThresholds(80, 60, 40).addRsiOversold().build();

      expect(config.strongThreshold).toBe(80);
      expect(config.moderateThreshold).toBe(60);
      expect(config.weakThreshold).toBe(40);
    });

    it("should add custom signal", () => {
      const customSignal = createFixedSignal(1, 5);
      const config = ScoreBuilder.create().addSignal(customSignal).build();

      expect(config.signals).toHaveLength(1);
      expect(config.signals[0]).toBe(customSignal);
    });

    it("should add multiple signals at once", () => {
      const signals = [createFixedSignal(1, 2), createFixedSignal(0.5, 3)];
      const config = ScoreBuilder.create().addSignals(signals).build();

      expect(config.signals).toHaveLength(2);
    });

    it("should track signal count", () => {
      const builder = ScoreBuilder.create();
      expect(builder.signalCount).toBe(0);

      builder.addRsiOversold();
      expect(builder.signalCount).toBe(1);

      builder.addMacdBullish().addVolumeSpike();
      expect(builder.signalCount).toBe(3);
    });

    it("should calculate max score", () => {
      const builder = ScoreBuilder.create()
        .addRsiOversold(30, 2.0)
        .addMacdBullish(1.5)
        .addVolumeSpike(1.5, 3.0);

      expect(builder.maxScore).toBe(6.5); // 2.0 + 1.5 + 3.0
    });

    it("should build immutable config", () => {
      const builder = ScoreBuilder.create().addRsiOversold();
      const config = builder.build();

      // Adding more signals shouldn't affect built config
      builder.addMacdBullish();

      expect(config.signals).toHaveLength(1);
    });
  });

  describe("momentum signal methods", () => {
    it("should add RSI oversold signal", () => {
      const config = ScoreBuilder.create().addRsiOversold(25, 2.5, 14).build();

      expect(config.signals).toHaveLength(1);
      expect(config.signals[0].name).toBe("rsiOversold25");
      expect(config.signals[0].weight).toBe(2.5);
      expect(config.signals[0].category).toBe("momentum");
    });

    it("should add RSI overbought signal", () => {
      const config = ScoreBuilder.create().addRsiOverbought(75, 2.0).build();

      expect(config.signals[0].name).toBe("rsiOverbought75");
      expect(config.signals[0].category).toBe("momentum");
    });

    it("should add MACD bullish signal", () => {
      const config = ScoreBuilder.create().addMacdBullish(2.0).build();

      expect(config.signals[0].name).toBe("macdBullish");
      expect(config.signals[0].weight).toBe(2.0);
    });

    it("should add MACD bearish signal", () => {
      const config = ScoreBuilder.create().addMacdBearish(1.5).build();

      expect(config.signals[0].name).toBe("macdBearish");
    });

    it("should add Stoch oversold signal", () => {
      const config = ScoreBuilder.create().addStochOversold(15, 2.0).build();

      expect(config.signals[0].name).toBe("stochOversold15");
    });

    it("should add Stoch bullish cross signal", () => {
      const config = ScoreBuilder.create().addStochBullishCross(20, 2.5).build();

      expect(config.signals[0].name).toBe("stochBullishCross");
      expect(config.signals[0].weight).toBe(2.5);
    });
  });

  describe("trend signal methods", () => {
    it("should add Perfect Order bullish signal", () => {
      const config = ScoreBuilder.create().addPerfectOrderBullish(3.5).build();

      expect(config.signals[0].name).toBe("poBullish");
      expect(config.signals[0].weight).toBe(3.5);
      expect(config.signals[0].category).toBe("trend");
    });

    it("should add PO confirmation signal", () => {
      const config = ScoreBuilder.create().addPOConfirmation(3.0).build();

      expect(config.signals[0].name).toBe("poConfirmation");
    });

    it("should add pullback entry signal", () => {
      const config = ScoreBuilder.create().addPullbackEntry(20, 2.5).build();

      expect(config.signals[0].name).toBe("pullback20");
      expect(config.signals[0].weight).toBe(2.5);
    });

    it("should add golden cross signal", () => {
      const config = ScoreBuilder.create().addGoldenCross(50, 200, 3.0).build();

      expect(config.signals[0].name).toBe("goldenCross");
      expect(config.signals[0].displayName).toBe("Golden Cross (50/200)");
    });

    it("should add price above EMA signal", () => {
      const config = ScoreBuilder.create().addPriceAboveEma(20, 1.5).build();

      expect(config.signals[0].name).toBe("priceAboveEma20");
    });
  });

  describe("volume signal methods", () => {
    it("should add volume spike signal", () => {
      const config = ScoreBuilder.create().addVolumeSpike(1.8, 2.0).build();

      expect(config.signals[0].name).toBe("volumeSpike");
      expect(config.signals[0].weight).toBe(2.0);
      expect(config.signals[0].category).toBe("volume");
    });

    it("should add volume anomaly signal", () => {
      const config = ScoreBuilder.create().addVolumeAnomaly(2.5, 2.5).build();

      expect(config.signals[0].name).toBe("volumeAnomaly");
      expect(config.signals[0].displayName).toBe("Volume Anomaly (2.5σ)");
    });

    it("should add bullish volume trend signal", () => {
      const config = ScoreBuilder.create().addBullishVolumeTrend(2.0).build();

      expect(config.signals[0].name).toBe("bullishVolumeTrend");
    });

    it("should add CMF positive signal", () => {
      const config = ScoreBuilder.create().addCmfPositive(0.15, 1.5).build();

      expect(config.signals[0].name).toBe("cmfPositive");
      expect(config.signals[0].displayName).toBe("CMF > 0.15");
    });
  });
});

// =============================================================================
// Presets Tests
// =============================================================================

describe("Presets", () => {
  describe("preset factory functions", () => {
    it("should create momentum preset with correct signals", () => {
      const config = createMomentumPreset();

      expect(config.signals.length).toBeGreaterThan(0);
      expect(config.strongThreshold).toBe(70);
      expect(config.moderateThreshold).toBe(50);
      expect(config.weakThreshold).toBe(30);

      // Should include momentum-focused signals
      const names = config.signals.map((s) => s.name);
      expect(names).toContain("rsiOversold30");
      expect(names).toContain("macdBullish");
    });

    it("should create mean reversion preset", () => {
      const config = createMeanReversionPreset();

      expect(config.signals.length).toBeGreaterThan(0);
      // Mean reversion has stricter thresholds
      expect(config.strongThreshold).toBe(75);
    });

    it("should create trend following preset", () => {
      const config = createTrendFollowingPreset();

      const names = config.signals.map((s) => s.name);
      expect(names).toContain("poConfirmation");
      expect(names).toContain("poBullish");
    });

    it("should create balanced preset", () => {
      const config = createBalancedPreset();

      // Should have signals from multiple categories
      const categories = new Set(config.signals.map((s) => s.category));
      expect(categories.size).toBeGreaterThanOrEqual(2);
    });

    it("should create aggressive preset with lower thresholds", () => {
      const config = createAggressivePreset();

      expect(config.strongThreshold).toBe(60);
      expect(config.moderateThreshold).toBe(40);
      expect(config.weakThreshold).toBe(25);
    });

    it("should create conservative preset with higher thresholds", () => {
      const config = createConservativePreset();

      expect(config.strongThreshold).toBe(80);
      expect(config.moderateThreshold).toBe(60);
      expect(config.weakThreshold).toBe(40);
    });
  });

  describe("getPreset", () => {
    it("should return correct preset by name", () => {
      const momentum = getPreset("momentum");
      const meanReversion = getPreset("meanReversion");
      const trendFollowing = getPreset("trendFollowing");
      const balanced = getPreset("balanced");

      expect(momentum.signals.length).toBeGreaterThan(0);
      expect(meanReversion.signals.length).toBeGreaterThan(0);
      expect(trendFollowing.signals.length).toBeGreaterThan(0);
      expect(balanced.signals.length).toBeGreaterThan(0);
    });

    it("should throw for unknown preset", () => {
      expect(() => getPreset("unknown" as any)).toThrow("Unknown preset");
    });
  });

  describe("listPresets", () => {
    it("should return all available preset names", () => {
      const presets = listPresets();

      expect(presets).toContain("momentum");
      expect(presets).toContain("meanReversion");
      expect(presets).toContain("trendFollowing");
      expect(presets).toContain("balanced");
      expect(presets).toHaveLength(4);
    });
  });
});

// =============================================================================
// Conditions Tests
// =============================================================================

describe("Backtest Conditions", () => {
  const testCandles = createTestCandles(100);

  describe("scoreAbove", () => {
    it("should return true when score is above threshold", () => {
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.8, 1)], // 80 normalized
      };

      const condition = scoreAbove(70, config);
      expect(condition(testCandles, 99)).toBe(true);
    });

    it("should return false when score is below threshold", () => {
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.5, 1)], // 50 normalized
      };

      const condition = scoreAbove(70, config);
      expect(condition(testCandles, 99)).toBe(false);
    });

    it("should work with preset name", () => {
      const condition = scoreAbove(70, "balanced");

      // Should not throw and return boolean
      const result = condition(testCandles, 99);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("scoreBelow", () => {
    it("should return true when score is below threshold", () => {
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.2, 1)], // 20 normalized
      };

      const condition = scoreBelow(30, config);
      expect(condition(testCandles, 99)).toBe(true);
    });

    it("should return false when score is above threshold", () => {
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.5, 1)], // 50 normalized
      };

      const condition = scoreBelow(30, config);
      expect(condition(testCandles, 99)).toBe(false);
    });
  });

  describe("scoreStrength", () => {
    it("should filter for strong signals", () => {
      const strongConfig: ScoringConfig = {
        signals: [createFixedSignal(0.8, 1)], // 80 = strong
      };
      const moderateConfig: ScoringConfig = {
        signals: [createFixedSignal(0.55, 1)], // 55 = moderate
      };

      expect(scoreStrength("strong", strongConfig)(testCandles, 99)).toBe(true);
      expect(scoreStrength("strong", moderateConfig)(testCandles, 99)).toBe(false);
    });

    it("should filter for moderate (includes strong)", () => {
      const strongConfig: ScoringConfig = {
        signals: [createFixedSignal(0.8, 1)],
      };
      const moderateConfig: ScoringConfig = {
        signals: [createFixedSignal(0.55, 1)],
      };
      const weakConfig: ScoringConfig = {
        signals: [createFixedSignal(0.35, 1)],
      };

      expect(scoreStrength("moderate", strongConfig)(testCandles, 99)).toBe(true);
      expect(scoreStrength("moderate", moderateConfig)(testCandles, 99)).toBe(true);
      expect(scoreStrength("moderate", weakConfig)(testCandles, 99)).toBe(false);
    });

    it("should filter for weak (includes moderate and strong)", () => {
      const config: ScoringConfig = {
        signals: [createFixedSignal(0.35, 1)], // 35 = weak
      };
      const noneConfig: ScoringConfig = {
        signals: [createFixedSignal(0.2, 1)], // 20 = none
      };

      expect(scoreStrength("weak", config)(testCandles, 99)).toBe(true);
      expect(scoreStrength("weak", noneConfig)(testCandles, 99)).toBe(false);
    });
  });

  describe("minActiveSignals", () => {
    it("should require minimum active signals", () => {
      const config: ScoringConfig = {
        signals: [
          createFixedSignal(1, 1),
          createFixedSignal(0.5, 1),
          createFixedSignal(0, 1), // inactive
        ],
      };

      expect(minActiveSignals(2, config)(testCandles, 99)).toBe(true);
      expect(minActiveSignals(3, config)(testCandles, 99)).toBe(false);
    });
  });

  describe("scoreWithMinSignals", () => {
    it("should require both score and min signals", () => {
      const config: ScoringConfig = {
        signals: [createFixedSignal(1, 1), createFixedSignal(1, 1)],
      };

      // Score = 100, active = 2
      expect(scoreWithMinSignals(70, 2, config)(testCandles, 99)).toBe(true);
      expect(scoreWithMinSignals(70, 3, config)(testCandles, 99)).toBe(false); // not enough signals
      expect(scoreWithMinSignals(101, 2, config)(testCandles, 99)).toBe(false); // score too low
    });
  });

  describe("scoreIncreasing", () => {
    it("should detect score increase from previous bar", () => {
      const currentIndex = 0;
      const config: ScoringConfig = {
        signals: [
          {
            name: "increasing",
            displayName: "Increasing",
            weight: 1,
            category: "momentum",
            evaluate: (_, index) => {
              // Return higher value as index increases
              return Math.min(1, index * 0.1);
            },
          },
        ],
      };

      // At index 50, score = 100 (value = 1.0)
      // At index 49, score = 100 (value = 1.0, clamped)
      // No increase expected because both are clamped to 1
      expect(scoreIncreasing(5, config)(testCandles, 50)).toBe(false);

      // At index 5, score = 50 (value = 0.5)
      // At index 4, score = 40 (value = 0.4)
      // Increase of 10
      expect(scoreIncreasing(10, config)(testCandles, 5)).toBe(true);
      expect(scoreIncreasing(15, config)(testCandles, 5)).toBe(false);
    });

    it("should return false for index < 1", () => {
      const config: ScoringConfig = {
        signals: [createFixedSignal(1, 1)],
      };

      expect(scoreIncreasing(0, config)(testCandles, 0)).toBe(false);
    });
  });
});
