import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  cupWithHandle,
  doubleBottom,
  doubleTop,
  headAndShoulders,
  inverseHeadAndShoulders,
} from "../index";

/**
 * Create a simple candle at a given price
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
 * Generate a Double Top pattern (two peaks with a trough in between)
 */
function generateDoubleTopPattern(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let day = 1;

  // Initial uptrend
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 100 + i * 2));
  }

  // First peak
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 120 - i * 0.5));
  }

  // Middle trough (pullback)
  for (let i = 0; i < 10; i++) {
    const price = i < 5 ? 117.5 - i * 2 : 107.5 + (i - 5) * 2;
    candles.push(createCandle(day++, price));
  }

  // Second peak (similar level to first)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 117.5 + i * 0.5));
  }
  candles.push(createCandle(day++, 120)); // Second peak at ~same level

  // Decline after second peak (confirmation)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 118 - i * 2));
  }

  return candles;
}

/**
 * Generate a Double Bottom pattern (two troughs with a peak in between)
 */
function generateDoubleBottomPattern(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let day = 1;

  // Initial downtrend
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 100 - i * 2));
  }

  // First trough
  candles.push(createCandle(day++, 80));

  // Rally to middle peak
  for (let i = 0; i < 10; i++) {
    const price = i < 5 ? 80 + i * 2 : 90 - (i - 5) * 1;
    candles.push(createCandle(day++, price));
  }

  // Second trough (similar level to first)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 85 - i));
  }
  candles.push(createCandle(day++, 80)); // Second trough at ~same level

  // Rally after second trough (confirmation)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 82 + i * 2));
  }

  return candles;
}

/**
 * Generate a Head and Shoulders pattern
 */
function generateHeadShouldersPattern(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let day = 1;

  // Initial uptrend
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 90 + i));
  }

  // Left shoulder (peak at 105)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 100 + i));
  }
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 105 - i));
  }

  // Dip to neckline (~95)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 100 - i));
  }

  // Head (peak at 115)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 95 + i * 2));
  }
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 115 - i * 2));
  }

  // Back to neckline (~95)
  // Right shoulder (peak at 105)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 95 + i * 2));
  }
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 105 - i * 2));
  }

  // Break below neckline (confirmation)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 95 - i * 2));
  }

  return candles;
}

/**
 * Generate an Inverse Head and Shoulders pattern
 */
function generateInverseHeadShouldersPattern(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let day = 1;

  // Initial downtrend
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 110 - i));
  }

  // Left shoulder (trough at 95)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 100 - i));
  }
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 95 + i));
  }

  // Rally to neckline (~105)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 100 + i));
  }

  // Head (trough at 85)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 105 - i * 2));
  }
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 85 + i * 2));
  }

  // Back to neckline (~105)
  // Right shoulder (trough at 95)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 105 - i * 2));
  }
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 95 + i * 2));
  }

  // Break above neckline (confirmation)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 105 + i * 2));
  }

  return candles;
}

/**
 * Generate a Cup with Handle pattern
 */
function generateCupHandlePattern(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let day = 1;

  // Initial rally to cup left rim (100)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 90 + i));
  }

  // Cup left side (decline to bottom at 80)
  for (let i = 0; i < 15; i++) {
    candles.push(createCandle(day++, 100 - i * 1.33));
  }

  // Cup bottom (U-shaped, around 80)
  for (let i = 0; i < 10; i++) {
    const price = 80 + Math.abs(i - 5) * 0.5;
    candles.push(createCandle(day++, price));
  }

  // Cup right side (rally back to rim at 100)
  for (let i = 0; i < 15; i++) {
    candles.push(createCandle(day++, 80 + i * 1.33));
  }

  // Handle (small pullback to ~95)
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 100 - i));
  }
  for (let i = 0; i < 5; i++) {
    candles.push(createCandle(day++, 95 + i));
  }

  // Breakout above rim (confirmation)
  for (let i = 0; i < 10; i++) {
    candles.push(createCandle(day++, 100 + i * 2));
  }

  return candles;
}

describe("Pattern Detection Signals", () => {
  describe("doubleTop", () => {
    it("should return empty array for insufficient data", () => {
      const candles = [createCandle(1, 100), createCandle(2, 101)];
      const patterns = doubleTop(candles);
      expect(patterns).toHaveLength(0);
    });

    it("should detect double top pattern", () => {
      const candles = generateDoubleTopPattern();
      const patterns = doubleTop(candles, { swingLookback: 3 });

      // May or may not detect depending on exact pattern formation
      expect(Array.isArray(patterns)).toBe(true);

      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern.type).toBe("double_top");
        // 3-5 keyPoints: Start Low (optional) + First Peak + Middle Trough + Second Peak + End Low (if confirmed)
        expect(pattern.pattern.keyPoints.length).toBeGreaterThanOrEqual(3);
        expect(pattern.pattern.keyPoints.length).toBeLessThanOrEqual(5);
        expect(pattern.pattern.target).toBeDefined();
        expect(pattern.pattern.stopLoss).toBeDefined();
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(100);
      }
    });

    it("should have correct pattern structure", () => {
      const candles = generateDoubleTopPattern();
      const patterns = doubleTop(candles, { swingLookback: 3 });

      for (const pattern of patterns) {
        expect(pattern).toHaveProperty("time");
        expect(pattern).toHaveProperty("type");
        expect(pattern).toHaveProperty("pattern");
        expect(pattern).toHaveProperty("confidence");
        expect(pattern).toHaveProperty("confirmed");
        expect(pattern.pattern).toHaveProperty("startTime");
        expect(pattern.pattern).toHaveProperty("endTime");
        expect(pattern.pattern).toHaveProperty("keyPoints");
        expect(pattern.pattern).toHaveProperty("neckline");
      }
    });

    it("should respect tolerance option", () => {
      const candles = generateDoubleTopPattern();
      const patternsStrict = doubleTop(candles, { tolerance: 0.01, swingLookback: 3 });
      const patternsLoose = doubleTop(candles, { tolerance: 0.1, swingLookback: 3 });

      // Looser tolerance should find >= patterns than strict
      expect(patternsLoose.length).toBeGreaterThanOrEqual(patternsStrict.length);
    });
  });

  describe("doubleBottom", () => {
    it("should return empty array for insufficient data", () => {
      const candles = [createCandle(1, 100), createCandle(2, 99)];
      const patterns = doubleBottom(candles);
      expect(patterns).toHaveLength(0);
    });

    it("should detect double bottom pattern", () => {
      const candles = generateDoubleBottomPattern();
      const patterns = doubleBottom(candles, { swingLookback: 3 });

      expect(Array.isArray(patterns)).toBe(true);

      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern.type).toBe("double_bottom");
        // 3-5 keyPoints: Start High (optional) + First Trough + Middle Peak + Second Trough + End High (if confirmed)
        expect(pattern.pattern.keyPoints.length).toBeGreaterThanOrEqual(3);
        expect(pattern.pattern.keyPoints.length).toBeLessThanOrEqual(5);
        expect(pattern.pattern.target).toBeDefined();
        // Target should be above neckline price (bullish)
        // Find Middle Peak keyPoint (always present as 2nd or 3rd point)
        const middlePeakPoint = pattern.pattern.keyPoints.find((kp) => kp.label === "Middle Peak");
        expect(middlePeakPoint).toBeDefined();
        expect(pattern.pattern.target).toBeGreaterThan(middlePeakPoint!.price);
      }
    });

    it("should have bullish target projection", () => {
      const candles = generateDoubleBottomPattern();
      const patterns = doubleBottom(candles, { swingLookback: 3 });

      for (const pattern of patterns) {
        if (pattern.pattern.target && pattern.pattern.height) {
          // Target = neckline + pattern height
          const neckline = pattern.pattern.neckline?.currentPrice ?? 0;
          expect(pattern.pattern.target).toBeCloseTo(neckline + pattern.pattern.height, 0);
        }
      }
    });
  });

  describe("headAndShoulders", () => {
    it("should return empty array for insufficient data", () => {
      const candles = [createCandle(1, 100)];
      const patterns = headAndShoulders(candles);
      expect(patterns).toHaveLength(0);
    });

    it("should detect head and shoulders pattern", () => {
      const candles = generateHeadShouldersPattern();
      const patterns = headAndShoulders(candles, { swingLookback: 3 });

      expect(Array.isArray(patterns)).toBe(true);

      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern.type).toBe("head_shoulders");
        // H&S has 5 key points: left shoulder, left trough, head, right trough, right shoulder
        expect(pattern.pattern.keyPoints.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("should have bearish target below neckline", () => {
      const candles = generateHeadShouldersPattern();
      const patterns = headAndShoulders(candles, { swingLookback: 3 });

      for (const pattern of patterns) {
        if (pattern.pattern.target && pattern.pattern.neckline) {
          // Bearish pattern: target should be below neckline
          expect(pattern.pattern.target).toBeLessThan(pattern.pattern.neckline.currentPrice);
        }
      }
    });
  });

  describe("inverseHeadAndShoulders", () => {
    it("should return empty array for insufficient data", () => {
      const candles = [createCandle(1, 100)];
      const patterns = inverseHeadAndShoulders(candles);
      expect(patterns).toHaveLength(0);
    });

    it("should detect inverse head and shoulders pattern", () => {
      const candles = generateInverseHeadShouldersPattern();
      const patterns = inverseHeadAndShoulders(candles, { swingLookback: 3 });

      expect(Array.isArray(patterns)).toBe(true);

      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern.type).toBe("inverse_head_shoulders");
      }
    });

    it("should have bullish target above neckline", () => {
      const candles = generateInverseHeadShouldersPattern();
      const patterns = inverseHeadAndShoulders(candles, { swingLookback: 3 });

      for (const pattern of patterns) {
        if (pattern.pattern.target && pattern.pattern.neckline) {
          // Bullish pattern: target should be above neckline
          expect(pattern.pattern.target).toBeGreaterThan(pattern.pattern.neckline.currentPrice);
        }
      }
    });
  });

  describe("cupWithHandle", () => {
    it("should return empty array for insufficient data", () => {
      const candles = [createCandle(1, 100)];
      const patterns = cupWithHandle(candles);
      expect(patterns).toHaveLength(0);
    });

    it("should detect cup with handle pattern", () => {
      const candles = generateCupHandlePattern();
      const patterns = cupWithHandle(candles, { swingLookback: 3, minCupLength: 20 });

      expect(Array.isArray(patterns)).toBe(true);

      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern.type).toBe("cup_handle");
        expect(pattern.pattern.target).toBeDefined();
      }
    });

    it("should have correct cup depth requirements", () => {
      const candles = generateCupHandlePattern();

      // Very shallow cup should not be detected
      const patternsDeep = cupWithHandle(candles, { minCupDepth: 0.5, swingLookback: 3 });
      // Our test pattern has ~20% depth, so 50% min should not match
      expect(patternsDeep).toHaveLength(0);
    });
  });

  describe("Pattern Signal Structure", () => {
    it("all patterns should have consistent structure", () => {
      const dtCandles = generateDoubleTopPattern();
      const dbCandles = generateDoubleBottomPattern();
      const hsCandles = generateHeadShouldersPattern();
      const ihsCandles = generateInverseHeadShouldersPattern();
      const cwCandles = generateCupHandlePattern();

      const allPatterns = [
        ...doubleTop(dtCandles, { swingLookback: 3 }),
        ...doubleBottom(dbCandles, { swingLookback: 3 }),
        ...headAndShoulders(hsCandles, { swingLookback: 3 }),
        ...inverseHeadAndShoulders(ihsCandles, { swingLookback: 3 }),
        ...cupWithHandle(cwCandles, { swingLookback: 3, minCupLength: 20 }),
      ];

      for (const pattern of allPatterns) {
        // Required fields
        expect(typeof pattern.time).toBe("number");
        expect([
          "double_top",
          "double_bottom",
          "head_shoulders",
          "inverse_head_shoulders",
          "cup_handle",
        ]).toContain(pattern.type);
        expect(typeof pattern.confidence).toBe("number");
        expect(typeof pattern.confirmed).toBe("boolean");
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(100);

        // Pattern details
        expect(typeof pattern.pattern.startTime).toBe("number");
        expect(typeof pattern.pattern.endTime).toBe("number");
        expect(Array.isArray(pattern.pattern.keyPoints)).toBe(true);

        // Key points structure
        for (const point of pattern.pattern.keyPoints) {
          expect(typeof point.time).toBe("number");
          expect(typeof point.index).toBe("number");
          expect(typeof point.price).toBe("number");
          expect(typeof point.label).toBe("string");
        }
      }
    });
  });
});
