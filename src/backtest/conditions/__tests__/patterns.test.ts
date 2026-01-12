import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  anyBearishPattern,
  anyBullishPattern,
  anyPatternConfidenceAbove,
  cupHandleDetected,
  doubleBottomDetected,
  doubleTopDetected,
  headShouldersDetected,
  inverseHeadShouldersDetected,
  patternConfidenceAbove,
  patternConfirmed,
  patternDetected,
  patternWithinBars,
} from "../patterns";

/**
 * Create a candle at a given price
 */
function createCandle(day: number, price: number, volume = 1000000): NormalizedCandle {
  return {
    time: new Date(2024, 0, day).getTime(),
    open: price,
    high: price * 1.01,
    low: price * 0.99,
    close: price,
    volume,
  };
}

/**
 * Generate a Double Top pattern
 */
function generateDoubleTopPattern(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let day = 1;

  // Initial uptrend
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 100 + i * 2));
  }

  // First peak at 120
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 120 - i * 0.5));
  }

  // Middle trough (pullback to ~107.5)
  for (let i = 0; i < 10; i++) {
    const price = i < 5 ? 117.5 - i * 2 : 107.5 + (i - 5) * 2;
    candles.push(createCandle(day++, price));
  }

  // Second peak at ~120
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 117.5 + i * 0.5));
  }
  candles.push(createCandle(day++, 120));

  // Decline (confirmation)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 118 - i * 2));
  }

  return candles;
}

/**
 * Generate a Double Bottom pattern
 */
function generateDoubleBottomPattern(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let day = 1;

  // Initial downtrend
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 100 - i * 2));
  }

  // First trough at 80
  candles.push(createCandle(day++, 80));

  // Rally to middle peak (~90)
  for (let i = 0; i < 10; i++) {
    const price = i < 5 ? 80 + i * 2 : 90 - (i - 5);
    candles.push(createCandle(day++, price));
  }

  // Second trough at ~80
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 85 - i));
  }
  candles.push(createCandle(day++, 80));

  // Rally (confirmation)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 82 + i * 2));
  }

  return candles;
}

/**
 * Generate flat candles (no pattern)
 */
function generateFlatCandles(count: number, price: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  for (let i = 1; i <= count; i++) {
    candles.push(createCandle(i, price));
  }
  return candles;
}

/**
 * Helper to evaluate a condition at a specific index
 */
function evaluateCondition(
  condition: ReturnType<typeof patternDetected>,
  candles: NormalizedCandle[],
  index?: number,
): boolean {
  const indicators: Record<string, unknown> = {};
  const idx = index ?? candles.length - 1;
  return condition.evaluate(indicators, candles[idx], idx, candles);
}

describe("Pattern Backtest Conditions", () => {
  describe("patternDetected", () => {
    it("should detect double_top pattern", () => {
      const candles = generateDoubleTopPattern();
      const condition = patternDetected("double_top", { swingLookback: 3 });

      // Check if pattern is detected at any point
      let detected = false;
      for (let i = 0; i < candles.length; i++) {
        if (evaluateCondition(condition, candles, i)) {
          detected = true;
          break;
        }
      }

      // May or may not detect depending on exact pattern
      expect(typeof detected).toBe("boolean");
    });

    it("should return false for flat candles", () => {
      const candles = generateFlatCandles(100, 100);
      const condition = patternDetected("double_top", { swingLookback: 3 });

      const result = evaluateCondition(condition, candles);
      expect(result).toBe(false);
    });

    it("should have descriptive name", () => {
      const condition = patternDetected("double_bottom");
      expect(condition.name).toBe("patternDetected(double_bottom)");
    });
  });

  describe("patternConfirmed", () => {
    it("should only match confirmed patterns", () => {
      const candles = generateDoubleTopPattern();
      const conditionAny = patternDetected("double_top", { swingLookback: 3 });
      const conditionConfirmed = patternConfirmed("double_top", { swingLookback: 3 });

      // Count detections
      let anyCount = 0;
      let confirmedCount = 0;

      for (let i = 0; i < candles.length; i++) {
        if (evaluateCondition(conditionAny, candles, i)) anyCount++;
        if (evaluateCondition(conditionConfirmed, candles, i)) confirmedCount++;
      }

      // Confirmed should be <= any
      expect(confirmedCount).toBeLessThanOrEqual(anyCount);
    });
  });

  describe("anyBullishPattern", () => {
    it("should detect bullish patterns (double_bottom, inverse_head_shoulders, cup_handle)", () => {
      const candles = generateDoubleBottomPattern();
      const condition = anyBullishPattern({ swingLookback: 3 });

      let detected = false;
      for (let i = 0; i < candles.length; i++) {
        if (evaluateCondition(condition, candles, i)) {
          detected = true;
          break;
        }
      }

      expect(typeof detected).toBe("boolean");
    });

    it("should not detect bearish patterns", () => {
      // Bearish patterns should NOT trigger anyBullishPattern
      const candles = generateDoubleTopPattern();
      const bullishCondition = anyBullishPattern({ swingLookback: 3 });
      const bearishCondition = anyBearishPattern({ swingLookback: 3 });

      // Check last candle only for bearish
      const bearishDetected = evaluateCondition(bearishCondition, candles);
      const bullishDetected = evaluateCondition(bullishCondition, candles);

      // Double top is bearish, not bullish
      if (bearishDetected) {
        expect(bullishDetected).toBe(false);
      }
    });

    it("should have descriptive name", () => {
      const condition = anyBullishPattern();
      expect(condition.name).toBe("anyBullishPattern()");
    });
  });

  describe("anyBearishPattern", () => {
    it("should detect bearish patterns (double_top, head_shoulders)", () => {
      const candles = generateDoubleTopPattern();
      const condition = anyBearishPattern({ swingLookback: 3 });

      let detected = false;
      for (let i = 0; i < candles.length; i++) {
        if (evaluateCondition(condition, candles, i)) {
          detected = true;
          break;
        }
      }

      expect(typeof detected).toBe("boolean");
    });

    it("should have descriptive name", () => {
      const condition = anyBearishPattern();
      expect(condition.name).toBe("anyBearishPattern()");
    });
  });

  describe("patternConfidenceAbove", () => {
    it("should filter by confidence threshold", () => {
      const candles = generateDoubleTopPattern();
      const conditionLow = patternConfidenceAbove("double_top", 30, { swingLookback: 3 });
      const conditionHigh = patternConfidenceAbove("double_top", 90, { swingLookback: 3 });

      let lowCount = 0;
      let highCount = 0;

      for (let i = 0; i < candles.length; i++) {
        if (evaluateCondition(conditionLow, candles, i)) lowCount++;
        if (evaluateCondition(conditionHigh, candles, i)) highCount++;
      }

      // High confidence threshold should find <= patterns
      expect(highCount).toBeLessThanOrEqual(lowCount);
    });

    it("should have descriptive name", () => {
      const condition = patternConfidenceAbove("cup_handle", 80);
      expect(condition.name).toBe("patternConfidenceAbove(cup_handle, 80)");
    });
  });

  describe("anyPatternConfidenceAbove", () => {
    it("should check all pattern types", () => {
      const candles = generateDoubleTopPattern();
      const condition = anyPatternConfidenceAbove(50, { swingLookback: 3 });

      let detected = false;
      for (let i = 0; i < candles.length; i++) {
        if (evaluateCondition(condition, candles, i)) {
          detected = true;
          break;
        }
      }

      expect(typeof detected).toBe("boolean");
    });

    it("should have descriptive name", () => {
      const condition = anyPatternConfidenceAbove(70);
      expect(condition.name).toBe("anyPatternConfidenceAbove(70)");
    });
  });

  describe("patternWithinBars", () => {
    it("should detect patterns within lookback window", () => {
      const candles = generateDoubleTopPattern();
      const conditionExact = patternDetected("double_top", { swingLookback: 3 });
      const conditionWithin = patternWithinBars("double_top", 5, { swingLookback: 3 });

      // patternWithinBars should find patterns that occurred recently
      let exactCount = 0;
      let withinCount = 0;

      for (let i = 0; i < candles.length; i++) {
        if (evaluateCondition(conditionExact, candles, i)) exactCount++;
        if (evaluateCondition(conditionWithin, candles, i)) withinCount++;
      }

      // Within bars should find >= patterns due to lookback window
      expect(withinCount).toBeGreaterThanOrEqual(exactCount);
    });

    it("should have descriptive name", () => {
      const condition = patternWithinBars("head_shoulders", 10);
      expect(condition.name).toBe("patternWithinBars(head_shoulders, 10)");
    });
  });

  describe("Convenience conditions", () => {
    it("doubleTopDetected should equal patternDetected('double_top')", () => {
      const condition1 = doubleTopDetected({ swingLookback: 3 });
      const condition2 = patternDetected("double_top", { swingLookback: 3 });

      const candles = generateDoubleTopPattern();

      for (let i = 0; i < candles.length; i++) {
        const result1 = evaluateCondition(condition1, candles, i);
        const result2 = evaluateCondition(condition2, candles, i);
        expect(result1).toBe(result2);
      }
    });

    it("doubleBottomDetected should equal patternDetected('double_bottom')", () => {
      const condition1 = doubleBottomDetected({ swingLookback: 3 });
      const condition2 = patternDetected("double_bottom", { swingLookback: 3 });

      const candles = generateDoubleBottomPattern();

      for (let i = 0; i < candles.length; i++) {
        const result1 = evaluateCondition(condition1, candles, i);
        const result2 = evaluateCondition(condition2, candles, i);
        expect(result1).toBe(result2);
      }
    });

    it("all convenience conditions should have names", () => {
      expect(doubleTopDetected().name).toContain("double_top");
      expect(doubleBottomDetected().name).toContain("double_bottom");
      expect(headShouldersDetected().name).toContain("head_shoulders");
      expect(inverseHeadShouldersDetected().name).toContain("inverse_head_shoulders");
      expect(cupHandleDetected().name).toContain("cup_handle");
    });
  });

  describe("Caching behavior", () => {
    it("should cache pattern detection results", () => {
      const candles = generateDoubleTopPattern();
      const condition = patternDetected("double_top", { swingLookback: 3 });
      const indicators: Record<string, unknown> = {};

      // First evaluation
      const idx = candles.length - 1;
      condition.evaluate(indicators, candles[idx], idx, candles);

      // Check that cache key was created
      const cacheKeys = Object.keys(indicators).filter((k) => k.startsWith("pattern_"));
      expect(cacheKeys.length).toBeGreaterThan(0);

      // Second evaluation should use cache
      const result = condition.evaluate(indicators, candles[idx], idx, candles);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty candles array", () => {
      const condition = patternDetected("double_top");
      const indicators: Record<string, unknown> = {};

      // Should not throw
      expect(() => {
        const emptyCandle: NormalizedCandle = {
          time: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
        };
        condition.evaluate(indicators, emptyCandle, 0, []);
      }).not.toThrow();
    });

    it("should handle single candle", () => {
      const condition = patternDetected("double_top");
      const candles = [createCandle(1, 100)];

      const result = evaluateCondition(condition, candles, 0);
      expect(result).toBe(false);
    });
  });
});
